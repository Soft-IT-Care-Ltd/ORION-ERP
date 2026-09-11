/**
 * প্রজেক্ট ডকুমেন্টের টাইপ, লেবেল ও গ্রুপিং — PRD সেকশন ৫.৭ ও ৫.৮।
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
  'Contract',
  'Govt Approval Copy',
  'Design Drawing',
  'Land Document',
  'Receipt',
  'Handover Certificate',
  'Other',
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_TYPE_LABEL: Record<DocumentType, string> = {
  Contract: 'কনস্ট্রাকশন চুক্তি',
  'Govt Approval Copy': 'সরকারি অনুমোদন কপি',
  'Design Drawing': 'ডিজাইন / ড্রয়িং',
  'Land Document': 'জমির দলিল',
  Receipt: 'পেমেন্ট রসিদ',
  'Handover Certificate': 'হ্যান্ডওভার সার্টিফিকেট',
  Other: 'অন্যান্য',
};

/** গ্রুপ হেডারের ব্যাজ — `FILE_TYPE_BADGE` (lead documents) এর সমান্তরাল */
export const DOCUMENT_TYPE_BADGE: Record<DocumentType, string> = {
  Contract: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300',
  'Govt Approval Copy': 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300',
  'Design Drawing': 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
  'Land Document': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  Receipt: 'bg-orion-navy/10 text-orion-navy dark:bg-orion-gold/15 dark:text-orion-gold',
  'Handover Certificate': 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300',
  Other: 'bg-muted text-muted-foreground',
};

/**
 * DB এর ফ্রি-টেক্সট টাইপ → canonical টাইপ।
 *
 * বানানভেদ (case, স্পেস, "Money Receipt"/"RAJUK Approval") মিলিয়ে নেওয়া হয় যাতে
 * একই কাগজ দুটি আলাদা গ্রুপে ভাগ হয়ে না যায়।
 */
export function normalizeDocumentType(raw: string): DocumentType {
  const key = raw.trim().toLowerCase().replace(/[\s_-]+/g, ' ');

  const exact = DOCUMENT_TYPES.find((type) => type.toLowerCase() === key);
  if (exact) return exact;

  if (key.includes('contract') || key.includes('agreement')) return 'Contract';
  if (key.includes('approval') || key.includes('rajuk') || key.includes('permit')) {
    return 'Govt Approval Copy';
  }
  if (key.includes('drawing') || key.includes('design') || key.includes('plan')) {
    return 'Design Drawing';
  }
  if (key.includes('land') || key.includes('deed') || key.includes('dolil')) return 'Land Document';
  if (key.includes('receipt') || key.includes('invoice')) return 'Receipt';
  if (key.includes('handover') || key.includes('completion')) return 'Handover Certificate';
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
 * ডাউনলোড ফোল্ডারে অর্থবহ নাম যাতে থাকে — "Contract-Rahim-Duplex.pdf"।
 */
export function documentDownloadName(
  type: DocumentType,
  projectRef: string,
  fileUrl: string,
): string {
  const ext = fileUrl.split('?')[0].split('.').pop();
  const base = `${type}-${projectRef}`.replace(/[^A-Za-z0-9_-]+/g, '-').replace(/-+/g, '-');
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
