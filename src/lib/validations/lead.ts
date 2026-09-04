import { z } from 'zod';
import { LEAD_FILE_TYPES, LEAD_SOURCES, LEAD_STAGES, LOST_REASONS } from '@/lib/leads';
import { COUNTRIES, OTHER_COUNTRY } from '@/lib/countries';
import { toBangladeshiE164, toE164 } from '@/lib/phone';

/**
 * এই ফাইলটি শুধু server action থেকে import হয় — `lib/phone.ts` (libphonenumber)
 * client bundle এ যাওয়া ঠেকাতে।
 */

const COUNTRY_CODES = COUNTRIES.map((c) => c.code);

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

/** খালি স্ট্রিং → undefined; নইলে trim করা টেক্সট (সর্বোচ্চ `max` অক্ষর) */
const optionalText = (max: number, message: string) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v.trim() === '' ? undefined : v.trim()))
    .refine((v) => v === undefined || v.length <= max, message);

const residenceCountrySchema = z
  .string()
  .optional()
  .transform((v) => (v === undefined || v.trim() === '' ? undefined : v.trim()))
  .refine(
    (v) => v === undefined || v === OTHER_COUNTRY || COUNTRY_CODES.includes(v),
    'তালিকা থেকে একটি দেশ নির্বাচন করুন',
  );

const baseLead = z.object({
  name: z.string().trim().min(2, 'নাম কমপক্ষে ২ অক্ষরের হতে হবে').max(80),
  // country picker এর ISO কোড + লোকাল নম্বর — নিচে E.164 তে জোড়া লাগে
  phoneCountry: z.string().trim().min(1, 'দেশ নির্বাচন করুন'),
  phoneNumber: z.string().trim().min(1, 'ফোন নম্বর দিন'),
  residenceCountry: residenceCountrySchema,
  email: optionalEmail,
  source: z.enum(LEAD_SOURCES as [string, ...string[]], {
    errorMap: () => ({ message: 'সোর্স নির্বাচন করুন' }),
  }),
  unitId: optionalId,
  projectLocation: optionalText(160, 'লোকেশন খুব বড় হয়ে গেছে'),
  budgetMin: optionalAmount,
  budgetMax: optionalAmount,
  assignedToId: optionalId,
  nextFollowUpAt: optionalDate,
  localContactName: optionalText(80, 'নাম খুব বড় হয়ে গেছে'),
  localContactPhone: optionalText(24, 'নম্বর খুব বড় হয়ে গেছে'),
  localContactRelation: optionalText(40, 'সম্পর্ক খুব বড় হয়ে গেছে'),
});

type BaseLead = z.infer<typeof baseLead>;

/** create ও update — দুটোতেই এক নিয়ম */
function leadRules(data: BaseLead, ctx: z.RefinementCtx) {
  // ১) ফোন — country picker + লোকাল নম্বর মিলিয়ে E.164 হতে হবে (PRD সেকশন ৫.১)
  const phone = toE164(data.phoneNumber, data.phoneCountry);
  if (!phone.ok) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['phoneNumber'], message: phone.reason });
  }

  // ২) লোকাল কন্টাক্ট বাংলাদেশে থাকা ব্যক্তি — নম্বরটি বাংলাদেশি হতে হবে
  if (data.localContactPhone !== undefined) {
    const local = toBangladeshiE164(data.localContactPhone);
    if (!local.ok) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['localContactPhone'],
        message: local.reason,
      });
    }
  }

  // ৩) নাম বা নম্বর ছাড়া শুধু সম্পর্ক লিখে রাখলে রেকর্ডটি অর্থহীন
  if (
    data.localContactRelation !== undefined &&
    data.localContactName === undefined &&
    data.localContactPhone === undefined
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['localContactName'],
      message: 'সম্পর্ক লিখলে নাম বা ফোন নম্বরও দিন',
    });
  }

  // ৪) বাজেট রেঞ্জ উল্টো নয়
  if (
    data.budgetMin !== undefined &&
    data.budgetMax !== undefined &&
    data.budgetMin > data.budgetMax
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['budgetMax'],
      message: 'সর্বনিম্ন বাজেট সর্বোচ্চের চেয়ে বেশি হতে পারে না',
    });
  }
}

/**
 * ফোন নম্বরগুলো E.164 তে নামিয়ে আনে। `leadRules` পাস করার পরেই চলে
 * (Zod refinement ব্যর্থ হলে transform স্কিপ হয়) — তাই এখানে দুটোই valid।
 */
function normalizeLeadPhones<T extends BaseLead>(data: T) {
  return {
    ...data,
    phone: (toE164(data.phoneNumber, data.phoneCountry) as { e164: string }).e164,
    localContactPhone:
      data.localContactPhone === undefined
        ? undefined
        : (toBangladeshiE164(data.localContactPhone) as { e164: string }).e164,
  };
}

export const createLeadSchema = baseLead.superRefine(leadRules).transform(normalizeLeadPhones);

export const updateLeadSchema = baseLead
  .extend({ id: z.string().min(1) })
  .superRefine(leadRules)
  .transform(normalizeLeadPhones);

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
      d.stage !== 'LOST' || (LOST_REASONS as readonly string[]).includes(d.lostReason as string),
    { message: 'তালিকা থেকে একটি কারণ নির্বাচন করুন', path: ['lostReason'] },
  );

export const addNoteSchema = z.object({
  id: z.string().min(1),
  note: z.string().trim().min(2, 'নোট কমপক্ষে ২ অক্ষরের হতে হবে').max(1000, 'নোট খুব বড় হয়ে গেছে'),
});

/** ডকুমেন্ট আপলোডের মেটাডেটা — ফাইল নিজে আলাদাভাবে যাচাই হয় (`lib/upload.ts`) */
export const uploadDocumentSchema = z.object({
  leadId: z.string().min(1),
  fileType: z.enum(LEAD_FILE_TYPES as unknown as [string, ...string[]], {
    errorMap: () => ({ message: 'ফাইলের ধরন নির্বাচন করুন' }),
  }),
  description: optionalText(300, 'বিবরণ খুব বড় হয়ে গেছে'),
});

export type CreateLeadInput = z.infer<typeof createLeadSchema>;
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;
