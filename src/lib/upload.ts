import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ALLOWED_EXTENSIONS, ALLOWED_UPLOAD_TYPES, MAX_UPLOAD_BYTES } from '@/lib/upload-limits';
import {
  deleteObject,
  keyFromPublicUrl,
  putObject,
  readR2Config,
  type R2Config,
} from '@/lib/storage';

/**
 * ফাইল স্টোরেজ হেল্পার — Cloudflare R2 (`08_R2_STORAGE_MIGRATION.md`)।
 *
 * Vercel এর serverless ফাইলসিস্টেম read-only, তাই প্রোডাকশনে লোকাল ডিস্কে লেখা
 * যায় না। R2 এর পাঁচটি env variable সেট থাকলে ফাইল সরাসরি বাকেটে যায় ও পূর্ণ
 * পাবলিক URL সেভ হয়। সেগুলো না থাকলে **শুধু ডেভেলপমেন্টে** আগের মতোই
 * `public/uploads/` এ পড়ে (R2 অ্যাকাউন্ট ছাড়াই লোকালি কাজ করা যায়); প্রোডাকশনে
 * কনফিগ না থাকলে আপলোড পরিষ্কার বার্তা দিয়ে থেমে যায় — নীরবে ভাঙে না।
 *
 * কলাররা `{ url, fileName, size }` ছাড়া আর কিছু জানে না, তাই ব্যাকএন্ড বদলালেও
 * (LeadDocument, প্রজেক্ট ডকুমেন্ট, ফেজ ফটো) কোনো কল-সাইট বদলাতে হয় না।
 *
 * server-only: `node:fs` ও R2 সিক্রেট ব্যবহার করে, client bundle এ যাবে না।
 */

export type SavedFile = { url: string; fileName: string; size: number };
export type UploadResult = { ok: true; file: SavedFile } | { ok: false; reason: string };

/** ইউজারের দেওয়া নাম শুধু *দেখানোর* জন্য — পাথে কখনো ব্যবহার হয় না */
function safeDisplayName(name: string) {
  const base = name.split(/[\\/]/).pop() ?? 'file';
  // control character বাদ — বাকিটা (স্পেস, বাংলা অক্ষর, ইউনিকোড) অক্ষত থাকে
  return base.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 120) || 'file';
}

/** ফোল্ডার সেগমেন্ট — path traversal ঠেকাতে কড়া allowlist */
function safeSegment(segment: string) {
  const clean = segment.replace(/[^a-zA-Z0-9_-]/g, '');
  if (!clean) throw new Error(`Unsafe upload folder segment: ${segment}`);
  return clean;
}

type Validated = { displayName: string; ext: string; contentType: string };

/**
 * সাইজ, এক্সটেনশন ও MIME যাচাই — স্টোরেজ ব্যাকএন্ড যা-ই হোক, নিয়ম একই।
 * সফল হলে সেভ করার জন্য দরকারি তিনটি মান ফেরত দেয়।
 */
function validateUpload(file: File, originalName?: string): Validated | { reason: string } {
  if (file.size === 0) return { reason: 'ফাইলটি খালি' };
  if (file.size > MAX_UPLOAD_BYTES) {
    return {
      reason: `ফাইল ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB এর বেশি হতে পারবে না`,
    };
  }

  const displayName = safeDisplayName(originalName || file.name);
  const ext = path.extname(displayName).toLowerCase();
  const allowedMimes = ALLOWED_UPLOAD_TYPES[ext];

  if (!allowedMimes) {
    return { reason: `এই ধরনের ফাইল নেওয়া হয় না (${ALLOWED_EXTENSIONS.join(', ')})` };
  }
  // কিছু ব্রাউজার/OS টাইপ পাঠায় না — তখন এক্সটেনশনই ভরসা
  const type = file.type?.toLowerCase();
  if (type && type !== 'application/octet-stream' && !allowedMimes.includes(type)) {
    return { reason: 'ফাইলের ধরন ও এক্সটেনশন মিলছে না' };
  }

  // বাকেটে যে ContentType বসবে — ব্রাউজার এটি দেখেই ছবি ইনলাইন দেখায়। উপরে
  // যাচাই হয়ে যাওয়া ব্রাউজার-টাইপ, নইলে এক্সটেনশনের canonical টাইপ
  const contentType = type && allowedMimes.includes(type) ? type : allowedMimes[0];

  return { displayName, ext, contentType };
}

/**
 * একটি ফাইল স্টোরেজে সেভ করে পাবলিক URL ফেরত দেয়।
 *
 * `folder` = key prefix, যেমন `['leads', leadId]` → key দাঁড়ায়
 * `leads/<leadId>/<uuid>.<ext>`। লোকাল fallback এও পাথের গঠন একই
 * (`public/uploads/leads/<leadId>/<uuid>.<ext>`), তাই দুই মোডে বিন্যাস মেলে।
 *
 * `originalName` — multipart এর filename হেডার latin-1 এ ডিকোড হয় বলে অ-ASCII
 * (বাংলা) নাম নষ্ট হয়ে যায়; কলার আলাদা টেক্সট ফিল্ডে আসল নাম পেলে সেটি দিতে পারে।
 */
export async function saveUploadedFile(
  file: File,
  folder: string[],
  originalName?: string,
): Promise<UploadResult> {
  const checked = validateUpload(file, originalName);
  if ('reason' in checked) return { ok: false, reason: checked.reason };

  const { displayName, ext, contentType } = checked;
  const segments = folder.map(safeSegment);
  // স্টোরেজের নাম সবসময় সিস্টেমের তৈরি — ইউজারের দেওয়া নাম থেকে নয়
  const key = [...segments, `${randomUUID()}${ext}`].join('/');

  const config = readR2Config();
  const saved = config
    ? await saveToR2(config, { key, file, displayName, contentType })
    : await saveToLocalDisk({ key, file });

  if (!saved.ok) return saved;

  return { ok: true, file: { url: saved.url, fileName: displayName, size: file.size } };
}

type SaveOutcome = { ok: true; url: string } | { ok: false; reason: string };

async function saveToR2(
  config: R2Config,
  params: { key: string; file: File; displayName: string; contentType: string },
): Promise<SaveOutcome> {
  try {
    const url = await putObject(config, {
      key: params.key,
      body: Buffer.from(await params.file.arrayBuffer()),
      contentType: params.contentType,
      fileName: params.displayName,
    });
    return { ok: true, url };
  } catch (error) {
    console.error('saveUploadedFile: R2 upload failed', error);
    return { ok: false, reason: 'ফাইল সেভ করা যায়নি (স্টোরেজে পৌঁছায়নি)' };
  }
}

/**
 * R2 কনফিগ না থাকলে ডেভেলপমেন্টের fallback। প্রোডাকশনে ইচ্ছে করেই ব্যর্থ হয় —
 * Vercel এ "সেভ হয়েছে" দেখিয়ে পরে ফাইলটি উধাও হওয়ার চেয়ে এখনই বলা ভালো।
 */
async function saveToLocalDisk(params: { key: string; file: File }): Promise<SaveOutcome> {
  if (process.env.NODE_ENV === 'production') {
    console.error('saveUploadedFile: R2 env variables missing in production');
    return {
      ok: false,
      reason: 'ফাইল স্টোরেজ কনফিগার করা নেই — অ্যাডমিনকে R2 সেটিংস ঠিক করতে বলুন',
    };
  }

  const target = path.join(process.cwd(), 'public', 'uploads', ...params.key.split('/'));

  try {
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, Buffer.from(await params.file.arrayBuffer()));
  } catch (error) {
    console.error('saveUploadedFile: local write failed', error);
    return { ok: false, reason: 'ফাইল সেভ করা যায়নি' };
  }

  return { ok: true, url: `/uploads/${params.key}` };
}

/**
 * সেভ করা ফাইল মুছে ফেলা (ডকুমেন্ট/ফটো ডিলিটের সঙ্গে)। `url` হলো ডাটাবেসে রাখা
 * `fileUrl`।
 *
 * মুছতে না পারলে কলার থেমে যায় না — বাকেটে একটি অনাথ ফাইল থেকে যাওয়া, ইউজারের
 * ডিলিট আটকে দেওয়ার চেয়ে কম ক্ষতিকর। তাই ফেরত মান শুধু জানায় মোছা গেল কি না।
 */
export async function deleteUploadedFile(url: string): Promise<boolean> {
  const config = readR2Config();

  if (config) {
    const key = keyFromPublicUrl(config, url);
    // অন্য হোস্টের (বা R2 তে যাওয়ার আগের লোকাল) URL — বাকেটে মোছার কিছু নেই
    if (!key) return false;
    try {
      await deleteObject(config, key);
      return true;
    } catch (error) {
      console.error('deleteUploadedFile: R2 delete failed', error);
      return false;
    }
  }

  if (!url.startsWith('/uploads/')) return false;

  // এখানে `safeSegment` চলে না — সেটি `.` ও ফেলে দেয়, ফলে `<uuid>.png` হয়ে যেত
  // `<uuid>png`। তাই পাথটি বানিয়ে যাচাই করা হয় সেটি সত্যিই uploads ফোল্ডারের
  // ভেতরে আছে কিনা — `..` দিয়ে বাইরে বেরোনোর চেষ্টা এতে আটকায়
  const root = path.join(process.cwd(), 'public', 'uploads');
  const target = path.resolve(root, url.slice('/uploads/'.length));
  if (!target.startsWith(root + path.sep)) return false;

  try {
    await unlink(target);
    return true;
  } catch (error) {
    console.error('deleteUploadedFile: local delete failed', error);
    return false;
  }
}
