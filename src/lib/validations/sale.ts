import { z } from 'zod';

/**
 * Lead → Sale কনভার্শনের ইনপুট যাচাই (PRD সেকশন ৫.১)।
 * ফর্মটি ছোট — ইউনিট, চূড়ান্ত মূল্য, আর কাস্টমার পোর্টালের ইমেইল।
 */

/** সর্বোচ্চ সেল ভ্যালু — ভুল করে অতিরিক্ত শূন্য বসানো ঠেকাতে (১০০ কোটি) */
const MAX_SALE_AMOUNT = 10_000_000_000;

const requiredAmount = z
  .union([z.string(), z.number()])
  .transform((v) => (typeof v === 'number' ? v : Number(String(v).replace(/,/g, '').trim())))
  .refine((v) => Number.isFinite(v) && v > 0, 'সঠিক মূল্য দিন')
  // NaN এখানে আবার ধরা পড়লে দুটো মেসেজ জমত, আর "অস্বাভাবিক বেশি" টাই শেষে টিকত
  .refine((v) => !Number.isFinite(v) || v <= MAX_SALE_AMOUNT, 'মূল্য অস্বাভাবিক বেশি — যাচাই করুন');

/** খালি হলে undefined; নইলে valid ইমেইল (lowercase) */
const optionalEmail = z
  .string()
  .optional()
  .transform((v) => (v === undefined || v.trim() === '' ? undefined : v.trim().toLowerCase()))
  .refine((v) => v === undefined || z.string().email().safeParse(v).success, 'সঠিক ইমেইল দিন');

export const convertLeadSchema = z.object({
  leadId: z.string().min(1),
  unitId: z.string().min(1, 'ইউনিট নির্বাচন করুন'),
  totalAmount: requiredAmount,
  /** না দিলে লিডের ইমেইল, তাও না থাকলে placeholder তৈরি হয় */
  customerEmail: optionalEmail,
});

export type ConvertLeadInput = z.infer<typeof convertLeadSchema>;
