import { z } from 'zod';
import { LEAD_SOURCES, LEAD_STAGES, LOST_REASONS } from '@/lib/leads';

/** বাংলাদেশি মোবাইল নম্বর — লিডের ফোন বাধ্যতামূলক (PRD সেকশন ৫.১) */
const phoneSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, ''))
  .pipe(z.string().regex(/^01[3-9]\d{8}$/, 'সঠিক মোবাইল নম্বর দিন (যেমন 01711223344)'));

const optionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .email('সঠিক ইমেইল দিন')
  .optional()
  .or(z.literal(''));

/** খালি স্ট্রিং → undefined; নইলে ধনাত্মক সংখ্যা */
const optionalAmount = z
  .union([z.string(), z.number()])
  .optional()
  .transform((v) => {
    if (v === undefined || v === null || v === '') return undefined;
    const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, ''));
    return Number.isFinite(n) ? n : NaN;
  })
  .refine((v) => v === undefined || (!Number.isNaN(v) && v >= 0), 'সঠিক অঙ্ক দিন');

/** খালি স্ট্রিং → undefined; নইলে yyyy-MM-dd */
const optionalDate = z
  .string()
  .optional()
  .transform((v) => (v === undefined || v.trim() === '' ? undefined : v.trim()))
  .refine((v) => v === undefined || /^\d{4}-\d{2}-\d{2}$/.test(v), 'সঠিক তারিখ দিন');

const optionalId = z
  .string()
  .optional()
  .transform((v) => (v === undefined || v.trim() === '' ? undefined : v.trim()));

const baseLead = z.object({
  name: z.string().trim().min(2, 'নাম কমপক্ষে ২ অক্ষরের হতে হবে').max(80),
  phone: phoneSchema,
  email: optionalEmail,
  source: z.enum(LEAD_SOURCES as [string, ...string[]], {
    errorMap: () => ({ message: 'সোর্স নির্বাচন করুন' }),
  }),
  unitId: optionalId,
  budgetMin: optionalAmount,
  budgetMax: optionalAmount,
  assignedToId: optionalId,
  nextFollowUpAt: optionalDate,
});

/** min ≤ max — দুটোই দেওয়া থাকলে */
const budgetOrder = (data: { budgetMin?: number; budgetMax?: number }) =>
  data.budgetMin === undefined || data.budgetMax === undefined || data.budgetMin <= data.budgetMax;

const budgetOrderIssue = {
  message: 'সর্বনিম্ন বাজেট সর্বোচ্চের চেয়ে বেশি হতে পারে না',
  path: ['budgetMax'],
};

export const createLeadSchema = baseLead.refine(budgetOrder, budgetOrderIssue);

export const updateLeadSchema = baseLead
  .extend({ id: z.string().min(1) })
  .refine(budgetOrder, budgetOrderIssue);

export const changeStageSchema = z
  .object({
    id: z.string().min(1),
    stage: z.enum(LEAD_STAGES as unknown as [string, ...string[]], {
      errorMap: () => ({ message: 'সঠিক স্টেজ নয়' }),
    }),
    lostReason: z
      .string()
      .optional()
      .transform((v) => (v === undefined || v.trim() === '' ? undefined : v.trim())),
  })
  // PRD: "Lost" এ গেলে reason বাধ্যতামূলক, আর অন্য স্টেজে reason অর্থহীন
  .refine((d) => d.stage !== 'LOST' || d.lostReason !== undefined, {
    message: 'Lost করার কারণ নির্বাচন করুন',
    path: ['lostReason'],
  })
  .refine(
    (d) =>
      d.stage !== 'LOST' ||
      (LOST_REASONS as readonly string[]).includes(d.lostReason as string),
    { message: 'তালিকা থেকে একটি কারণ নির্বাচন করুন', path: ['lostReason'] },
  );

export const addNoteSchema = z.object({
  id: z.string().min(1),
  note: z.string().trim().min(2, 'নোট কমপক্ষে ২ অক্ষরের হতে হবে').max(1000, 'নোট খুব বড় হয়ে গেছে'),
});

export type CreateLeadInput = z.infer<typeof createLeadSchema>;
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;
