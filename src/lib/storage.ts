import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

/**
 * Cloudflare R2 ক্লায়েন্ট ও কনফিগ — `lib/upload.ts` এর স্টোরেজ ব্যাকএন্ড
 * (`08_R2_STORAGE_MIGRATION.md`)।
 *
 * R2 এর API S3-compatible, তাই আলাদা SDK লাগে না — শুধু endpoint ও region
 * ("auto") বদলে `@aws-sdk/client-s3` ব্যবহার করা হয়।
 *
 * server-only: এখান থেকে কখনো client component এ import করা যাবে না, নইলে
 * সিক্রেট কী ব্রাউজার বান্ডলে চলে যেত।
 */

export type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  /** বাকেটের public base URL — শেষের `/` ছাড়া (e.g. `https://pub-xxx.r2.dev`) */
  publicUrl: string;
};

/**
 * পাঁচটি env variable এর সবগুলো থাকলে তবেই R2 চালু ধরা হয় — একটাও বাদ থাকলে
 * `null`, অর্থাৎ কলার লোকাল ডিস্কে ফেরত যাবে (dev এ R2 অ্যাকাউন্ট ছাড়াই কাজ চলে)।
 */
export function readR2Config(): R2Config | null {
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const bucket = process.env.R2_BUCKET_NAME?.trim();
  const publicUrl = process.env.R2_PUBLIC_URL?.trim().replace(/\/+$/, '');

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicUrl) return null;

  return { accountId, accessKeyId, secretAccessKey, bucket, publicUrl };
}

export function isR2Configured() {
  return readR2Config() !== null;
}

// একটিই ক্লায়েন্ট — প্রতি আপলোডে নতুন S3Client বানালে প্রতিবারই নতুন HTTPS
// কানেকশন পুল তৈরি হতো
let cached: { client: S3Client; accountId: string } | null = null;

function getClient(config: R2Config) {
  if (cached && cached.accountId === config.accountId) return cached.client;

  const client = new S3Client({
    // R2 এর কোনো আসল region নেই — S3 SDK কে সন্তুষ্ট করতে "auto"
    region: 'auto',
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  cached = { client, accountId: config.accountId };
  return client;
}

/** অবজেক্ট আপলোড করে তার পূর্ণ পাবলিক URL ফেরত দেয় */
export async function putObject(
  config: R2Config,
  params: {
    key: string;
    body: Buffer;
    contentType: string;
    /** ডাউনলোডের সময় ব্রাউজার যে নামটি দেখাবে (আসল, বাংলা হলেও) */
    fileName: string;
  },
) {
  await getClient(config).send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType,
      // key তে UUID আছে বলে একই key তে কখনো অন্য ফাইল বসে না — তাই immutable
      CacheControl: 'public, max-age=31536000, immutable',
      // RFC 5987 — বাংলা/ইউনিকোড ফাইলনেম হেডারে নিরাপদে পাঠানোর একমাত্র উপায়
      ContentDisposition: `inline; filename*=UTF-8''${encodeURIComponent(params.fileName)}`,
    }),
  );

  return `${config.publicUrl}/${params.key}`;
}

export async function deleteObject(config: R2Config, key: string) {
  await getClient(config).send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
}

/**
 * পাবলিক URL → বাকেটের key (URL টি এই বাকেটের না হলে `null`)।
 *
 * ডাটাবেসে আমরা পূর্ণ URL রাখি (`fileUrl`), কিন্তু মোছার সময় key দরকার। পুরনো
 * লোকাল-ডিস্ক URL (`/uploads/...`) এখানে `null` দেয় — সেগুলো R2 তে নেই।
 */
export function keyFromPublicUrl(config: R2Config, url: string) {
  const prefix = `${config.publicUrl}/`;
  if (!url.startsWith(prefix)) return null;
  const key = url.slice(prefix.length);
  return key.length > 0 ? key : null;
}
