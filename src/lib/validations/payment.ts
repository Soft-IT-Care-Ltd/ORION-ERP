import { z } from 'zod';
import { PaymentMethod } from '@prisma/client';

/**
 * Payment plan, installment schedule ও payment entry এর ইনপুট যাচাই —
 * PRD সেকশন ৫.৩।
 */

/** ভুল করে অতিরিক্ত শূন্য বসানো ঠেকাতে (১০০ কোটি) — `validations/sale.ts` এর মতোই */
const MAX_AMOUNT = 10_000_000_000;

/** একটি প্ল্যানে এর বেশি কিস্তি বাস্তবে হয় না — অসীম লুপ/পেলোড ঠেকানোর সীমা */
const MAX_INSTALLMENTS = 120;

const amount = z
  .union([z.string(), z.number()])
  .transform((v) => (typeof v === 'number' ? v : Number(String(v).replace(/,/g, '').trim())))
  .refine((v) => Number.isFinite(v) && v > 0, 'সঠিক অঙ্ক দিন')
  .refine((v) => !Number.isFinite(v) || v <= MAX_AMOUNT, 'অঙ্কটি অস্বাভাবিক বেশি — যাচাই করুন')
  // পয়সা নয়, পূর্ণ টাকা — শিডিউল ও রসিদ সব জায়গায় একই রাউন্ডিং
  .transform((v) => Math.round(v));

/** "yyyy-MM-dd" (date input) → local midnight Date */
const requiredDate = z
  .string()
  .trim()
  .min(1, 'তারিখ দিন')
  .transform((v) => {
    // `new Date("2026-01-05")` UTC ধরে — দেশভেদে একদিন পিছিয়ে যেত, তাই হাতে ভাঙা
    const [y, m, d] = v.split('-').map(Number);
    if (!y || !m || !d) return undefined;
    return new Date(y, m - 1, d);
  })
  .refine((v) => v !== undefined, 'সঠিক তারিখ দিন')
  .transform((v) => v as Date);

const optionalText = (max: number) =>
  z
    .string()
    .optional()
    .transform((v) => {
      const trimmed = v?.trim();
      return trimmed ? trimmed : undefined;
    })
    .refine((v) => v === undefined || v.length <= max, `সর্বোচ্চ ${max} অক্ষর`);

const percent = (label: string) =>
  z
    .union([z.string(), z.number()])
    .transform((v) => (typeof v === 'number' ? v : Number(String(v).trim() || '0')))
    .refine((v) => Number.isFinite(v) && v >= 0 && v < 100, `${label} ০–১০০% এর মধ্যে দিন`);

/* ------------------------------------------------- template generation */

export const generatePlanSchema = z
  .object({
    saleId: z.string().min(1),
    bookingDate: requiredDate,
    bookingPercent: percent('বুকিং'),
    downPaymentPercent: percent('ডাউন পেমেন্ট'),
    downPaymentDays: z
      .union([z.string(), z.number()])
      .transform((v) => (typeof v === 'number' ? v : Number(String(v).trim() || '0')))
      .refine((v) => Number.isInteger(v) && v >= 0 && v <= 365, 'ডাউন পেমেন্টের দিন ০–৩৬৫'),
    agreementPercent: percent('এগ্রিমেন্ট'),
    agreementDate: requiredDate,
    monthlyCount: z
      .union([z.string(), z.number()])
      .transform((v) => (typeof v === 'number' ? v : Number(String(v).trim() || '0')))
      .refine((v) => Number.isInteger(v) && v >= 0 && v <= 100, 'মাসিক কিস্তির সংখ্যা ০–১০০'),
    monthlyPercent: percent('মাসিক কিস্তি'),
    firstInstallmentDate: requiredDate,
    handoverDate: requiredDate,
  })
  .refine(
    (v) =>
      v.bookingPercent +
        v.downPaymentPercent +
        v.agreementPercent +
        v.monthlyCount * v.monthlyPercent <
      100,
    {
      message: 'শতাংশের যোগফল ১০০% এর কম হতে হবে — বাকিটা হ্যান্ডওভারের কিস্তি হবে',
      path: ['monthlyPercent'],
    },
  );

/* ------------------------------------------------------ manual schedule */

const installmentRow = z.object({
  /** আগে থেকে থাকা কিস্তি হলে তার id; নতুন সারিতে খালি */
  id: z.string().optional().transform((v) => (v?.trim() ? v.trim() : undefined)),
  label: z.string().trim().min(2, 'কিস্তির নাম দিন').max(120, 'নাম সর্বোচ্চ ১২০ অক্ষর'),
  dueDate: requiredDate,
  amount,
});

export const saveScheduleSchema = z.object({
  saleId: z.string().min(1),
  installments: z
    .array(installmentRow)
    .min(1, 'অন্তত একটি কিস্তি রাখতে হবে')
    .max(MAX_INSTALLMENTS, `সর্বোচ্চ ${MAX_INSTALLMENTS}টি কিস্তি`),
});

/* -------------------------------------------------------- payment entry */

export const paymentEntrySchema = z.object({
  installmentId: z.string().min(1, 'কিস্তি নির্বাচন করুন'),
  amountReceived: amount,
  method: z.nativeEnum(PaymentMethod, { errorMap: () => ({ message: 'মাধ্যম নির্বাচন করুন' }) }),
  /** খালি রাখলে server নিজে ক্রমিক রসিদ নম্বর তৈরি করবে */
  receiptNo: optionalText(40),
  /** চেক নম্বর / bKash TrxID / ব্যাংক রেফারেন্স */
  note: optionalText(300),
  paidAt: requiredDate,
});

export type GeneratePlanInput = z.infer<typeof generatePlanSchema>;
export type SaveScheduleInput = z.infer<typeof saveScheduleSchema>;
export type PaymentEntryInput = z.infer<typeof paymentEntrySchema>;
