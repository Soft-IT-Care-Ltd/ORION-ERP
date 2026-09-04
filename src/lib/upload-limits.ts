/**
 * আপলোডের সীমা ও অনুমোদিত ফাইল টাইপ — client ও server দুই জায়গা থেকেই দরকার,
 * তাই `lib/upload.ts` (যেটি `node:fs` ব্যবহার করে) থেকে আলাদা রাখা হয়েছে।
 */

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // ১০ MB

/**
 * অনুমোদিত এক্সটেনশন → সম্ভাব্য MIME।
 *
 * ফাইলগুলো অ্যাপের নিজের origin থেকেই সার্ভ হয়, তাই স্ক্রিপ্ট চালাতে পারে এমন
 * টাইপ (`.svg`, `.html`) ইচ্ছে করেই বাদ — নইলে আপলোড দিয়েই XSS সম্ভব হতো।
 */
export const ALLOWED_UPLOAD_TYPES: Record<string, string[]> = {
  '.pdf': ['application/pdf'],
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.png': ['image/png'],
  '.webp': ['image/webp'],
  '.heic': ['image/heic', 'image/heif'],
  '.doc': ['application/msword'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  '.xls': ['application/vnd.ms-excel'],
  '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  '.zip': ['application/zip', 'application/x-zip-compressed'],
};

export const ALLOWED_EXTENSIONS = Object.keys(ALLOWED_UPLOAD_TYPES);

/** `<input accept="…">` এ বসানোর জন্য */
export const UPLOAD_ACCEPT = ALLOWED_EXTENSIONS.join(',');

/** "2.4 MB" ধরনের পাঠযোগ্য সাইজ */
export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
