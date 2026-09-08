/**
 * CSV তৈরি — PRD সেকশন ৫.৭ (Export reports)।
 *
 * বিশুদ্ধ ফাংশন, কোনো নির্ভরতা নেই। দুটো জিনিস বিশেষভাবে খেয়াল রাখা হয়েছে,
 * কারণ ফাইলগুলো বাস্তবে Excel এই খোলা হবে:
 *
 *  ১. **BOM** — UTF-8 BOM ছাড়া Excel বাংলা লেখাকে ল্যাটিন-১ ধরে নেয় আর
 *     "à¦…à¦¾" জাতীয় আবর্জনা দেখায়।
 *  ২. **Formula injection** — `=`, `+`, `-`, `@` দিয়ে শুরু হওয়া ঘর Excel
 *     সূত্র হিসেবে চালায়। কাস্টমারের নাম/নোট ইউজারের দেওয়া টেক্সট, তাই সেগুলো
 *     নিরপেক্ষ করে দেওয়া হয় (OWASP CSV injection)।
 */

export type CsvValue = string | number | boolean | null | undefined;

export type CsvColumn<T> = {
  header: string;
  value: (row: T) => CsvValue;
};

/** Excel এর জন্য UTF-8 BOM */
const BOM = '\uFEFF';

/** Excel বেশি নির্ভরযোগ্যভাবে CRLF পড়ে */
const EOL = '\r\n';

/** সূত্র হিসেবে চলতে পারে এমন শুরুর অক্ষর */
const FORMULA_START = /^[=+\-@\t\r]/;

export function escapeCsvCell(value: CsvValue): string {
  if (value === null || value === undefined) return '';

  let text = typeof value === 'string' ? value : String(value);

  // সংখ্যা ঋণাত্মক হলে সেটি সূত্র নয় — শুধু টেক্সট ঘরেই সতর্কতা লাগে
  if (typeof value === 'string' && FORMULA_START.test(text)) text = `'${text}`;

  // নতুন লাইন ঘরের ভেতরেই থাকে (quote করা আছে), কিন্তু CR বাদ দিলে সারি ভাঙে না
  text = text.replace(/\r\n?/g, '\n');

  return /[",\n]/.test(text) || text !== text.trim()
    ? `"${text.replace(/"/g, '""')}"`
    : text;
}

/** কলাম-সংজ্ঞা থেকে পুরো CSV (হেডার সহ) */
export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const lines = [
    columns.map((c) => escapeCsvCell(c.header)).join(','),
    ...rows.map((row) => columns.map((c) => escapeCsvCell(c.value(row))).join(',')),
  ];
  return BOM + lines.join(EOL) + EOL;
}

/**
 * আগে থেকে তৈরি হেডার + সারির ম্যাট্রিক্স থেকে CSV।
 * রিপোর্ট লোডারগুলো এই আকারেই ডেটা দেয় — একই ডেটা CSV ও প্রিন্ট-ভিউ, দুই
 * জায়গাতেই ব্যবহার হয় (`lib/report-data.ts`)।
 */
export function matrixToCsv(headers: string[], rows: CsvValue[][]): string {
  const lines = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((row) => row.map(escapeCsvCell).join(',')),
  ];
  return BOM + lines.join(EOL) + EOL;
}

/**
 * ডাউনলোডের ফাইলনেম — `Content-Disposition` হেডারে।
 * ASCII fallback + RFC 5987 এর `filename*` দুটোই দেওয়া হয়, কারণ নামে বাংলা
 * থাকলে পুরনো ব্রাউজার শুধু ASCII অংশটাই বোঝে।
 */
export function contentDisposition(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}
