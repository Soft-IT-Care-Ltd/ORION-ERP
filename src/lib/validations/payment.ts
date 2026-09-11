import { z } from 'zod';
import { PaymentMethod } from '@prisma/client';
import {
  id,
  integerBetween,
  nullableId,
  optionalText,
  percent,
  positiveAmount,
  requiredDate,
  requiredText,
} from './common';

/**
 * Payment plan, installment schedule ও payment entry এর ইনপুট যাচাই —
 * PRD সেকশন ৫.৫। ফর্ম (client) ও server action — দুই জায়গাতেই এই স্কিমাই চলে।
 */

/** একটি প্ল্যানে এর বেশি কিস্তি বাস্তবে হয় না — অসীম লুপ/পেলোড ঠেকানোর সীমা */
const MAX_INSTALLMENTS = 120;

// পয়সা নয়, পূর্ণ টাকা — শিডিউল ও রসিদ সব জায়গায় একই রাউন্ডিং
const amount = positiveAmount({ round: true });

/* ------------------------------------------------- template generation */

export const generatePlanSchema = z
  .object({
    projectId: id,
    bookingDate: requiredDate,
    bookingPercent: percent('সাইনআপ মানি'),
    downPaymentPercent: percent('ডাউন পেমেন্ট'),
    downPaymentDays: integerBetween(0, 365, 'ডাউন পেমেন্টের দিন ০–৩৬৫'),
    agreementPercent: percent('এগ্রিমেন্ট'),
    agreementDate: requiredDate,
    monthlyCount: integerBetween(0, 100, 'মাসিক কিস্তির সংখ্যা ০–১০০'),
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
  id: z
    .string()
    .optional()
    .transform((v) => (v?.trim() ? v.trim() : undefined)),
  label: requiredText(2, 120, 'কিস্তির নাম দিন'),
  dueDate: requiredDate,
  amount,
  /** ঐচ্ছিক — "এই ফেজ শেষ হলে এই কিস্তি" (PRD সেকশন ৫.৫) */
  phaseId: nullableId,
});

export const saveScheduleSchema = z.object({
  projectId: id,
  installments: z
    .array(installmentRow)
    .min(1, 'অন্তত একটি কিস্তি রাখতে হবে')
    .max(MAX_INSTALLMENTS, `সর্বোচ্চ ${MAX_INSTALLMENTS}টি কিস্তি`),
});

/** প্ল্যান মুছে ফেলা — id ছাড়া আর কিছু লাগে না */
export const projectIdSchema = z.object({ projectId: id });

/* -------------------------------------------------------- payment entry */

export const paymentEntrySchema = z.object({
  installmentId: z.string().trim().min(1, 'কিস্তি নির্বাচন করুন'),
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
