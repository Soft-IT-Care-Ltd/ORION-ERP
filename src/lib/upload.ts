import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ALLOWED_EXTENSIONS, ALLOWED_UPLOAD_TYPES, MAX_UPLOAD_BYTES } from '@/lib/upload-limits';

/**
 * ফাইল স্টোরেজ হেল্পার — আপাতত লোকাল `public/uploads/` এ সেভ করে।
 *
 * পরে S3/R2 তে যেতে হলে শুধু `saveUploadedFile` এর ভেতরটা বদলালেই হবে —
 * কলাররা `{ url, fileName, size }` ছাড়া আর কিছু জানে না। (Phase 3 এর site photo
 * ও Phase 4 এর রিসিট আপলোডেও এই একই হেল্পার ব্যবহার হবে।)
 *
 * server-only: `node:fs` import করে, client bundle এ যাবে না।
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

/**
 * একটি ফাইল ডিস্কে সেভ করে পাবলিক URL ফেরত দেয়।
 *
 * `folder` = `public/uploads/` এর নিচের সাব-পাথ, যেমন `['leads', leadId]`।
 * `originalName` — multipart এর filename হেডার latin-1 এ ডিকোড হয় বলে অ-ASCII
 * (বাংলা) নাম নষ্ট হয়ে যায়; কলার আলাদা টেক্সট ফিল্ডে আসল নাম পেলে সেটি দিতে পারে।
 */
export async function saveUploadedFile(
  file: File,
  folder: string[],
  originalName?: string,
): Promise<UploadResult> {
  if (file.size === 0) return { ok: false, reason: 'ফাইলটি খালি' };
  if (file.size > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      reason: `ফাইল ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB এর বেশি হতে পারবে না`,
    };
  }

  const displayName = safeDisplayName(originalName || file.name);
  const ext = path.extname(displayName).toLowerCase();
  const allowedMimes = ALLOWED_UPLOAD_TYPES[ext];

  if (!allowedMimes) {
    return { ok: false, reason: `এই ধরনের ফাইল নেওয়া হয় না (${ALLOWED_EXTENSIONS.join(', ')})` };
  }
  // কিছু ব্রাউজার/OS টাইপ পাঠায় না — তখন এক্সটেনশনই ভরসা
  const type = file.type?.toLowerCase();
  if (type && type !== 'application/octet-stream' && !allowedMimes.includes(type)) {
    return { ok: false, reason: 'ফাইলের ধরন ও এক্সটেনশন মিলছে না' };
  }

  const segments = folder.map(safeSegment);
  const dir = path.join(process.cwd(), 'public', 'uploads', ...segments);
  // ডিস্কের নাম সবসময় সিস্টেমের তৈরি — ইউজারের দেওয়া নাম থেকে নয়
  const storedName = `${randomUUID()}${ext}`;

  try {
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, storedName), Buffer.from(await file.arrayBuffer()));
  } catch (error) {
    console.error('saveUploadedFile failed', error);
    return { ok: false, reason: 'ফাইল সেভ করা যায়নি' };
  }

  return {
    ok: true,
    file: {
      url: `/uploads/${segments.join('/')}/${storedName}`,
      fileName: displayName,
      size: file.size,
    },
  };
}
