/**
 * ফাইল স্টোরেজের যাচাই — `npm run test:storage`
 *
 * `lib/upload.ts` + `lib/storage.ts` দুই অবস্থাতেই পরীক্ষা হয়: R2 কনফিগ আছে
 * (বাকেটে যাবে) ও নেই (dev এ লোকাল ডিস্ক)। এটি deploy-critical কোড — R2 ভুল
 * হলে প্রোডাকশনে প্রতিটি আপলোড নীরবে হারিয়ে যেত, অথচ বাকি অ্যাপ চলত।
 *
 * নেটওয়ার্ক লাগে না: `S3Client.prototype.send` প্যাচ করে দেখা হয় *কোন কমান্ড,
 * কোন ইনপুট নিয়ে* যাচ্ছে। SDK এর wire format আমাদের পরীক্ষার বিষয় নয়।
 *
 * `check-validations.mts` এর মতোই টেস্ট ফ্রেমওয়ার্ক ছাড়া (tsx + node:assert),
 * আর ফাইলটি `.mts` কারণ মডিউলগুলো প্যাচের *পরে* লোড করতে top-level await লাগে।
 */

import assert from 'node:assert/strict';
import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { S3Client } from '@aws-sdk/client-s3';

const ROOT = path.join(import.meta.dirname, '..');

/** ১×১ px PNG — আসল ছবি, যাতে বাইটগুলো মিলিয়ে দেখা যায় */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

function file(name: string, bytes: Buffer, type: string) {
  return new File([bytes], name, { type });
}

const R2_KEYS = [
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET_NAME',
  'R2_PUBLIC_URL',
] as const;

function clearR2Env() {
  for (const key of R2_KEYS) delete process.env[key];
}

function setR2Env() {
  process.env.R2_ACCOUNT_ID = 'acct123';
  process.env.R2_ACCESS_KEY_ID = 'ak';
  process.env.R2_SECRET_ACCESS_KEY = 'sk';
  process.env.R2_BUCKET_NAME = 'orion-erp-files';
  process.env.R2_PUBLIC_URL = 'https://pub-test.r2.dev/'; // শেষের / ইচ্ছে করেই
}

// বাকেটে যাওয়া কমান্ডগুলো জমা — আসল HTTP কল হয় না
const sent: { name: string; input: Record<string, unknown> }[] = [];
S3Client.prototype.send = (async (command: {
  constructor: { name: string };
  input: Record<string, unknown>;
}) => {
  sent.push({ name: command.constructor.name, input: command.input });
  return {};
}) as never;

// প্যাচের পরে লোড — নইলে মডিউলগুলো আসল `send` ধরে রাখত
const { saveUploadedFile, deleteUploadedFile } = await import('../src/lib/upload');
const storage = await import('../src/lib/storage');

/* ── ১. R2 কনফিগ নেই → dev এ লোকাল ডিস্ক ───────────────────────────── */
{
  clearR2Env();
  const result = await saveUploadedFile(
    file('সাইট ছবি.png', PNG, 'image/png'),
    ['phases', 'test-phase'],
  );

  assert.ok(result.ok, 'লোকাল ফলব্যাকে সেভ হওয়ার কথা');
  assert.match(result.file.url, /^\/uploads\/phases\/test-phase\/[0-9a-f-]{36}\.png$/);
  assert.equal(result.file.fileName, 'সাইট ছবি.png', 'বাংলা ডিসপ্লে-নাম অক্ষত');
  assert.equal(result.file.size, PNG.length);

  const onDisk = await readFile(path.join(ROOT, 'public', result.file.url));
  assert.deepEqual(onDisk, PNG, 'ডিস্কের বাইট হুবহু');
  assert.equal(sent.length, 0, 'R2 কনফিগ ছাড়া কোনো SDK কল যাবে না');

  // ডিলিটও — এক্সটেনশনসহ পাথ ঠিকঠাক বানায় কিনা
  assert.equal(await deleteUploadedFile(result.file.url), true);
  await assert.rejects(() => readFile(path.join(ROOT, 'public', result.file.url)));
  await rm(path.join(ROOT, 'public', 'uploads', 'phases', 'test-phase'), {
    recursive: true,
    force: true,
  });
  console.log('✔ ১. R2 ছাড়া dev fallback — লেখা, URL, নাম ও ডিলিট ঠিক');
}

/* ── ২. ভ্যালিডেশন R2 তে যাওয়ার পরেও অপরিবর্তিত ─────────────────────── */
{
  const empty = await saveUploadedFile(file('a.png', Buffer.alloc(0), 'image/png'), ['leads', 'x']);
  assert.ok(!empty.ok && empty.reason.includes('খালি'));

  // স্ক্রিপ্ট চালাতে পারে এমন টাইপ — আপলোড দিয়েই XSS ঠেকাতে বাদ
  const badExt = await saveUploadedFile(file('evil.svg', PNG, 'image/svg+xml'), ['leads', 'x']);
  assert.ok(!badExt.ok && badExt.reason.includes('ধরনের ফাইল নেওয়া হয় না'));

  const mismatch = await saveUploadedFile(file('a.png', PNG, 'application/pdf'), ['leads', 'x']);
  assert.ok(!mismatch.ok && mismatch.reason.includes('মিলছে না'));

  const tooBig = await saveUploadedFile(
    file('a.png', Buffer.alloc(11 * 1024 * 1024), 'image/png'),
    ['leads', 'x'],
  );
  assert.ok(!tooBig.ok && tooBig.reason.includes('MB'));

  assert.equal(sent.length, 0, 'ভ্যালিডেশনে আটকালে বাকেটে কিছু যাবে না');
  console.log('✔ ২. সাইজ / এক্সটেনশন / MIME ভ্যালিডেশন অপরিবর্তিত');
}

/* ── ৩. R2 কনফিগ আছে → PutObjectCommand ─────────────────────────────── */
{
  setR2Env();

  const config = storage.readR2Config();
  assert.ok(config, 'পাঁচটি variable থাকলে কনফিগ পাওয়া যাবে');
  assert.equal(config.publicUrl, 'https://pub-test.r2.dev', 'শেষের / ছেঁটে ফেলা হয়');

  const result = await saveUploadedFile(file('ছাদ ঢালাই.jpg', PNG, 'image/jpeg'), [
    'phases',
    'ph-1',
  ]);
  assert.ok(result.ok);
  assert.match(
    result.file.url,
    /^https:\/\/pub-test\.r2\.dev\/phases\/ph-1\/[0-9a-f-]{36}\.jpg$/,
    'পূর্ণ পাবলিক URL ফেরত আসে',
  );

  assert.equal(sent.length, 1);
  const put = sent[0];
  assert.equal(put.name, 'PutObjectCommand');
  assert.equal(put.input.Bucket, 'orion-erp-files');
  assert.match(
    String(put.input.Key),
    /^phases\/ph-1\/[0-9a-f-]{36}\.jpg$/,
    'key তে UUID — ইউজারের দেওয়া নাম কখনো পাথে যায় না',
  );
  assert.equal(put.input.ContentType, 'image/jpeg');
  assert.equal(put.input.CacheControl, 'public, max-age=31536000, immutable');
  assert.equal(
    put.input.ContentDisposition,
    `inline; filename*=UTF-8''${encodeURIComponent('ছাদ ঢালাই.jpg')}`,
    'বাংলা নাম RFC 5987 এ',
  );
  assert.deepEqual(put.input.Body, PNG, 'ফাইলের বাইট হুবহু');

  sent.length = 0;
  console.log('✔ ৩. R2 কনফিগ থাকলে PutObjectCommand — বাকেট, key, হেডার ও বাইট ঠিক');
}

/* ── ৪. ডিলিট ও URL → key ───────────────────────────────────────────── */
{
  const config = storage.readR2Config();
  assert.ok(config);

  assert.equal(
    storage.keyFromPublicUrl(config, 'https://pub-test.r2.dev/leads/l1/a.png'),
    'leads/l1/a.png',
  );
  assert.equal(storage.keyFromPublicUrl(config, '/uploads/leads/l1/a.png'), null, 'পুরনো লোকাল URL');
  assert.equal(storage.keyFromPublicUrl(config, 'https://evil.example/x.png'), null, 'অন্য হোস্ট');

  assert.equal(await deleteUploadedFile('https://pub-test.r2.dev/leads/l1/a.png'), true);
  assert.equal(sent[0]?.name, 'DeleteObjectCommand');
  assert.equal(sent[0]?.input.Key, 'leads/l1/a.png');

  sent.length = 0;
  assert.equal(await deleteUploadedFile('https://evil.example/x.png'), false);
  assert.equal(sent.length, 0, 'বাইরের URL এ কোনো ডিলিট কল যাবে না');
  console.log('✔ ৪. URL → key, DeleteObjectCommand ও অন্য-হোস্ট প্রত্যাখ্যান');
}

/* ── ৫. অসম্পূর্ণ কনফিগ = কনফিগ নেই ─────────────────────────────────── */
{
  for (const missing of R2_KEYS) {
    setR2Env();
    process.env[missing] = '';
    assert.equal(storage.readR2Config(), null, `${missing} ফাঁকা থাকলে R2 বন্ধ থাকবে`);
  }
  console.log('✔ ৫. পাঁচটির যেকোনো একটি না থাকলেই R2 চালু ধরা হয় না');
}

/* ── ৬. প্রোডাকশনে R2 ছাড়া আপলোড থামবে ──────────────────────────────── */
{
  clearR2Env();
  const previous = process.env.NODE_ENV;
  // Vercel এর ফাইলসিস্টেম read-only — "সেভ হয়েছে" দেখিয়ে ফাইল হারানোর চেয়ে
  // এখানেই থেমে যাওয়া ভালো
  process.env.NODE_ENV = 'production';

  const result = await saveUploadedFile(file('a.png', PNG, 'image/png'), ['leads', 'l1']);
  assert.ok(!result.ok, 'প্রোডাকশনে কনফিগ ছাড়া সফল হওয়া চলবে না');
  assert.ok(result.reason.includes('স্টোরেজ কনফিগার করা নেই'));
  assert.equal(sent.length, 0);

  process.env.NODE_ENV = previous;
  console.log('✔ ৬. প্রোডাকশনে R2 কনফিগ ছাড়া আপলোড পরিষ্কার বার্তা দিয়ে থামে');
}

console.log('\nসব যাচাই পাস');
