/**
 * Sale ডকুমেন্টের টাইপ, লেবেল ও গ্রুপিং — PRD সেকশন ৫.৪ ও ৫.৫।
 *
 * `Document.type` স্কিমাতে ফ্রি-টেক্সট string (enum নয়), কারণ প্রতিটি প্রজেক্টে
 * কাগজের নাম আলাদা হতে পারে। তাই canonical তালিকাটা এখানে রাখা হয়েছে — অচেনা
 * টাইপ এলে "অন্যান্য" গ্রুপে পড়বে, কিন্তু আসল লেখাটা সারিতে দেখানো হয়।
 *
 * `lib/payments.ts` এর মতোই এখানে শুধু বিশুদ্ধ ফাংশন ও type-only import —
 * ফাইলটি client component থেকেও import করা যাবে।
 */

/** দেখানোর ক্রম — কাস্টমার যে ক্রমে কাগজগুলো হাতে পান */
export const DOCUMENT_TYPES = [
  'Booking Form',
  'Sale Agreement',
  'Allotment Letter',
  'Sale Deed',
  'Receipt',
  'Other',
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_TYPE_LABEL: Record<DocumentType, string> = {
  'Booking Form': 'বুকিং ফর্ম',
  'Sale Agreement': 'সেল এগ্রিমেন্ট',
  'Allotment Letter': 'অ্যালটমেন্ট লেটার',
  'Sale Deed': 'সেল দলিল',
  Receipt: 'পেমেন্ট রসিদ',
  Other: 'অন্যান্য',
};

/** গ্রুপ হেডারের ব্যাজ — `FILE_TYPE_BADGE` (lead documents) এর সমান্তরাল */
export const DOCUMENT_TYPE_BADGE: Record<DocumentType, string> = {
  'Booking Form': 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
  'Sale Agreement': 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300',
  'Allotment Letter': 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300',
  'Sale Deed': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  Receipt: 'bg-orion-navy/10 text-orion-navy dark:bg-orion-gold/15 dark:text-orion-gold',
  Other: 'bg-muted text-muted-foreground',
};

/**
 * DB এর ফ্রি-টেক্সট টাইপ → canonical টাইপ।
 *
 * বানানভেদ (case, স্পেস, "Money Receipt"/"Deed of Sale") মিলিয়ে নেওয়া হয় যাতে
 * একই কাগজ দুটি আলাদা গ্রুপে ভাগ হয়ে না যায়।
 */
export function normalizeDocumentType(raw: string): DocumentType {
  const key = raw.trim().toLowerCase().replace(/[\s_-]+/g, ' ');

  const exact = DOCUMENT_TYPES.find((type) => type.toLowerCase() === key);
  if (exact) return exact;

  if (key.includes('booking')) return 'Booking Form';
  if (key.includes('allot')) return 'Allotment Letter';
  if (key.includes('deed')) return 'Sale Deed';
  if (key.includes('agreement')) return 'Sale Agreement';
  if (key.includes('receipt') || key.includes('invoice')) return 'Receipt';
  return 'Other';
}

/** ফাইলের এক্সটেনশন ব্যাজ — "PDF", "JPG" */
export function fileExtLabel(fileUrl: string): string | null {
  const ext = fileUrl.split('?')[0].split('.').pop();
  if (!ext || ext.length > 5 || ext.includes('/')) return null;
  return ext.toUpperCase();
}

/**
 * ডাউনলোডের ফাইলনেম। ডিস্কে নামগুলো UUID (`lib/upload.ts`), তাই কাস্টমারের
 * ডাউনলোড ফোল্ডারে অর্থবহ নাম যাতে থাকে — "Booking-Form-A-4.pdf"।
 */
export function documentDownloadName(type: DocumentType, unitNo: string, fileUrl: string): string {
  const ext = fileUrl.split('?')[0].split('.').pop();
  const base = `${type}-${unitNo}`.replace(/[^A-Za-z0-9_-]+/g, '-').replace(/-+/g, '-');
  return ext && ext.length <= 5 ? `${base}.${ext.toLowerCase()}` : base;
}

/* ---------------------------------------------------------- view model */

/**
 * তালিকার একটি সারি। দুই রকম হতে পারে:
 * - আপলোড করা ফাইল (`fileUrl`) — সরাসরি ডাউনলোড
 * - সিস্টেমে তৈরি কাগজ (`href`) — যেমন পেমেন্ট রসিদ, যা প্রিন্ট/PDF পেজ
 */
export type DocumentItem = {
  id: string;
  type: DocumentType;
  /** DB তে লেখা নাম/টাইপ — canonical তালিকার বাইরের লেখাও অক্ষত দেখানো হয় */
  title: string;
  meta?: string | null;
  fileUrl?: string | null;
  downloadName?: string | null;
  href?: string | null;
  badge?: string | null;
};

export type DocumentGroup = {
  type: DocumentType;
  label: string;
  items: DocumentItem[];
};

/** টাইপ অনুযায়ী গ্রুপ — যে টাইপে কিছু নেই সেটি বাদ, ক্রম `DOCUMENT_TYPES` অনুযায়ী */
export function groupDocuments(items: DocumentItem[]): DocumentGroup[] {
  return DOCUMENT_TYPES.map((type) => ({
    type,
    label: DOCUMENT_TYPE_LABEL[type],
    items: items.filter((item) => item.type === type),
  })).filter((group) => group.items.length > 0);
}
