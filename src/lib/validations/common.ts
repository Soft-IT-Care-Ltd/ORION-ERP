import { z } from 'zod';

/**
 * ফর্ম ফিল্ডের সাধারণ বিল্ডিং ব্লক — টাকা, তারিখ, ঐচ্ছিক টেক্সট, id।
 *
 * আগে প্রতিটি স্কিমা ফাইলে এগুলোর নিজস্ব কপি ছিল, ফলে একই ভুল ইনপুটে জায়গাভেদে
 * আলাদা বাংলা মেসেজ আসত। এক জায়গায় আনার পর মেসেজ ও আচরণ সব ফর্মে এক।
 *
 * ফাইলটি ইচ্ছে করেই **শুধু zod** এর উপর নির্ভর করে — কোনো Prisma runtime বা
 * `node:` import নেই — যাতে client component থেকেও import করা যায় এবং একই
 * স্কিমা ব্রাউজারে ও সার্ভারে দুবার চলতে পারে (`lib/validations/form.ts`)।
 */

/** সর্বোচ্চ টাকার অঙ্ক — ভুল করে অতিরিক্ত শূন্য বসানো ঠেকাতে (১০০ কোটি) */
export const MAX_AMOUNT = 10_000_000_000;

/** সংখ্যা → বাংলা অঙ্ক, শুধু error message এ বসানোর জন্য (`৩০` বনাম `30`) */
export function bnNum(value: number) {
  return String(value).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[Number(d)]);
}

/**
 * রেকর্ড / relation id।
 *
 * Server action আসলে একটি পাবলিক HTTP endpoint — ব্রাউজারের ফর্ম ছাড়াও যে কেউ
 * সরাসরি ডাকতে পারে। তাই id ও যাচাই করা হয়; খালি স্ট্রিং পেলে কুয়েরি চালানোর
 * আগেই থামে।
 */
export const id = z.string().trim().min(1, 'রেকর্ডটি শনাক্ত করা যায়নি');

/** খালি স্ট্রিং → `undefined` (ঐচ্ছিক relation id) */
export const optionalId = z
  .string()
  .optional()
  .transform((v) => (v?.trim() ? v.trim() : undefined));

/** খালি স্ট্রিং → `null` — Prisma তে সরাসরি বসানোর জন্য */
export const nullableId = z
  .string()
  .optional()
  .transform((v) => (v?.trim() ? v.trim() : null));

/** খালি স্ট্রিং → `undefined`; নইলে trim করা টেক্সট (সর্বোচ্চ `max` অক্ষর) */
export function optionalText(max: number, message = `সর্বোচ্চ ${bnNum(max)} অক্ষর`) {
  return z
    .string()
    .optional()
    .transform((v) => {
      const trimmed = v?.trim();
      return trimmed ? trimmed : undefined;
    })
    .refine((v) => v === undefined || v.length <= max, message);
}

/** বাধ্যতামূলক টেক্সট — trim করে দৈর্ঘ্য যাচাই */
export function requiredText(
  min: number,
  max: number,
  message: string,
  maxMessage = `সর্বোচ্চ ${bnNum(max)} অক্ষর`,
) {
  return z.string().trim().min(min, message).max(max, maxMessage);
}

/**
 * `"2026-01-05"` → ওই দিনের local midnight।
 *
 * `new Date("2026-01-05")` স্ট্রিংটিকে UTC ধরে, ফলে UTC+6 এ থাকা ব্যবহারকারীর
 * কাছে তারিখটা একদিন পিছিয়ে দেখাত — তাই হাতে ভাঙা হয়। রোল-ওভারও আটকানো হয়
 * (`2026-02-31` → `new Date` চুপচাপ ৩ মার্চ বানিয়ে দিত)।
 */
export function parseLocalDate(value: string): Date | undefined {
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return undefined;
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
    return undefined;
  }
  return date;
}

/** `<input type=date>` এর মান → Date (বাধ্যতামূলক) */
export const requiredDate = z
  .string()
  .trim()
  .min(1, 'তারিখ দিন')
  .transform(parseLocalDate)
  .refine((v) => v !== undefined, 'সঠিক তারিখ দিন')
  .transform((v) => v as Date);

/** `<input type=date>` এর মান → Date; খালি হলে `null` */
export const nullableDate = z
  .string()
  .optional()
  .transform((v) => {
    const trimmed = v?.trim();
    return trimmed ? parseLocalDate(trimmed) : null;
  })
  .refine((v) => v !== undefined, 'সঠিক তারিখ দিন')
  .transform((v) => v as Date | null);

/**
 * তারিখটি `"yyyy-MM-dd"` স্ট্রিং হিসেবেই থাকে (Date এ বদলায় না)।
 * লিডের ফলো-আপে দরকার — সেখানে দিনের মাঝামাঝি সময় বসানো হয় (TZ শিফটে দিন
 * যেন না পাল্টায়), তাই রূপান্তরটা কলারের হাতে ছাড়া।
 */
export const optionalDateString = z
  .string()
  .optional()
  .transform((v) => {
    const trimmed = v?.trim();
    return trimmed ? trimmed : undefined;
  })
  .refine(
    (v) => v === undefined || (/^\d{4}-\d{2}-\d{2}$/.test(v) && parseLocalDate(v) !== undefined),
    'সঠিক তারিখ দিন',
  );

/**
 * ধনাত্মক টাকার অঙ্ক। `"45,00,000"` ধরনের কমা-সহ লেখাও চলে (ব্যবহারকারী
 * প্রায়ই কপি-পেস্ট করেন)।
 *
 * `round` দিলে পয়সা বাদ দিয়ে পূর্ণ টাকা — কিস্তি, রসিদ ও শিডিউলে একই রাউন্ডিং
 * না রাখলে যোগফল সেল ভ্যালুর সঙ্গে মিলত না।
 */
export function positiveAmount({
  message = 'সঠিক অঙ্ক দিন',
  maxMessage = 'অঙ্কটি অস্বাভাবিক বেশি — যাচাই করুন',
  max = MAX_AMOUNT,
  round = false,
}: { message?: string; maxMessage?: string; max?: number; round?: boolean } = {}) {
  const base = z
    .union([z.string(), z.number()])
    .transform((v) => (typeof v === 'number' ? v : Number(String(v).replace(/,/g, '').trim())))
    .refine((v) => Number.isFinite(v) && v > 0, message)
    // NaN এখানে আবার ধরা পড়লে দুটো মেসেজ জমত, আর "অস্বাভাবিক বেশি" টাই শেষে টিকত
    .refine((v) => !Number.isFinite(v) || v <= max, maxMessage);

  return round ? base.transform((v) => Math.round(v)) : base;
}

/** খালি → `undefined`; নইলে ঋণাত্মক নয় এমন সংখ্যা (বাজেট রেঞ্জ) */
export const optionalAmount = z
  .union([z.string(), z.number()])
  .optional()
  .transform((v) => {
    if (v === undefined || v === null || v === '') return undefined;
    const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, ''));
    return Number.isFinite(n) ? n : NaN;
  })
  .refine((v) => v === undefined || (!Number.isNaN(v) && v >= 0), 'সঠিক অঙ্ক দিন')
  .refine((v) => v === undefined || Number.isNaN(v) || v <= MAX_AMOUNT, 'অঙ্কটি অস্বাভাবিক বেশি');

/** ০ থেকে ১০০ এর নিচে — শতাংশ ফিল্ড (১০০% হলে বাকি কিছু থাকত না) */
export function percent(label: string) {
  return z
    .union([z.string(), z.number()])
    .transform((v) => (typeof v === 'number' ? v : Number(String(v).trim() || '0')))
    .refine((v) => Number.isFinite(v) && v >= 0 && v < 100, `${label} ০–১০০% এর মধ্যে দিন`);
}

/** পূর্ণসংখ্যা, নির্দিষ্ট সীমার মধ্যে (কিস্তির সংখ্যা, দিন, সময়কাল) */
export function integerBetween(min: number, max: number, message: string) {
  return z
    .union([z.string(), z.number()])
    .transform((v) => (typeof v === 'number' ? v : Number(String(v).trim() || '0')))
    .refine((v) => Number.isInteger(v) && v >= min && v <= max, message);
}

/** খালি → `undefined`; নইলে valid ইমেইল (lowercase) */
export const optionalEmail = z
  .string()
  .optional()
  .transform((v) => (v === undefined || v.trim() === '' ? undefined : v.trim().toLowerCase()))
  .refine((v) => v === undefined || z.string().email().safeParse(v).success, 'সঠিক ইমেইল দিন');

export const requiredEmail = z.string().trim().toLowerCase().email('সঠিক ইমেইল দিন');
