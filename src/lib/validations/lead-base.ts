import { z } from 'zod';
import {
  BUILDING_TYPES,
  LEAD_FILE_TYPES,
  LEAD_SOURCES,
  LEAD_STAGES,
  LOST_REASONS,
} from '@/lib/leads';
import { COUNTRIES, OTHER_COUNTRY } from '@/lib/countries';
import {
  id,
  optionalAmount,
  optionalDateString,
  optionalEmail,
  optionalId,
  optionalText,
  requiredText,
} from './common';

/**
 * লিড ফর্মের **client-safe** অংশ — এই ফাইলে libphonenumber নেই, তাই ব্রাউজার
 * bundle এ ঢুকলেও ভারী হয় না।
 *
 * ফোন নম্বরের আসল যাচাই (E.164 তে রূপান্তর, দেশভেদে দৈর্ঘ্য/প্রিফিক্স) হয়
 * `validations/lead.ts` এ — সেটি শুধু server action থেকে import হয়। এখানে
 * নম্বরের গঠনটুকু দেখা হয়, যাতে ব্রাউজারেই স্পষ্ট ভুল ধরা পড়ে; বাকিটা সার্ভার
 * বলে দেয়।
 */

const COUNTRY_CODES = COUNTRIES.map((c) => c.code);

/** libphonenumber ছাড়া যতটুকু বলা যায় — অঙ্ক, স্পেস, বন্ধনী, `+`/`-` */
const PHONE_SHAPE = /^[+\d][\d\s().-]{5,24}$/;

const residenceCountrySchema = z
  .string()
  .optional()
  .transform((v) => (v?.trim() ? v.trim() : undefined))
  .refine(
    (v) => v === undefined || v === OTHER_COUNTRY || COUNTRY_CODES.includes(v),
    'তালিকা থেকে একটি দেশ নির্বাচন করুন',
  );

export const baseLead = z.object({
  name: requiredText(2, 80, 'নাম কমপক্ষে ২ অক্ষরের হতে হবে'),
  // country picker এর ISO কোড + লোকাল নম্বর — server এ E.164 তে জোড়া লাগে
  phoneCountry: z.string().trim().min(1, 'দেশ নির্বাচন করুন'),
  phoneNumber: z
    .string()
    .trim()
    .min(1, 'ফোন নম্বর দিন')
    .refine((v) => PHONE_SHAPE.test(v), 'নম্বরটি সঠিক নয় — শুধু অঙ্ক লিখুন'),
  residenceCountry: residenceCountrySchema,
  email: optionalEmail,
  source: z.enum(LEAD_SOURCES as unknown as [string, ...string[]], {
    errorMap: () => ({ message: 'সোর্স নির্বাচন করুন' }),
  }),
  projectLocation: optionalText(160, 'লোকেশন খুব বড় হয়ে গেছে'),
  // PRD সেকশন ৫.১ — জমির আয়তন free-text (বাংলাদেশে কাঠা/শতক/বিঘা সব চলে)
  landSize: optionalText(40, 'আয়তনটি খুব বড় হয়ে গেছে'),
  buildingType: z
    .string()
    .optional()
    .transform((v) => (v?.trim() ? v.trim() : undefined))
    .refine(
      (v) => v === undefined || (BUILDING_TYPES as string[]).includes(v),
      'বাড়ির ধরন নির্বাচন করুন',
    ),
  budgetMin: optionalAmount,
  budgetMax: optionalAmount,
  assignedToId: optionalId,
  nextFollowUpAt: optionalDateString,
  localContactName: optionalText(80, 'নাম খুব বড় হয়ে গেছে'),
  localContactPhone: optionalText(24, 'নম্বর খুব বড় হয়ে গেছে'),
  localContactRelation: optionalText(40, 'সম্পর্ক খুব বড় হয়ে গেছে'),
});

export type BaseLead = z.infer<typeof baseLead>;

/**
 * ফোন-নিরপেক্ষ নিয়মগুলো — client ও server দুই দিকেই চলে।
 * (server এ এর সঙ্গে libphonenumber এর যাচাই যোগ হয়।)
 */
export function leadShapeRules(data: BaseLead, ctx: z.RefinementCtx) {
  // ১) লোকাল কন্টাক্ট বাংলাদেশে থাকা ব্যক্তি — গঠনটুকু এখানে, দেশ-যাচাই সার্ভারে
  if (data.localContactPhone !== undefined && !PHONE_SHAPE.test(data.localContactPhone)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['localContactPhone'],
      message: 'সঠিক বাংলাদেশি নম্বর দিন (যেমন 01711223344)',
    });
  }

  // ২) নাম বা নম্বর ছাড়া শুধু সম্পর্ক লিখে রাখলে রেকর্ডটি অর্থহীন
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

  // ৩) বাজেট রেঞ্জ উল্টো নয়
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

/* ------------------------------------------------- ফর্ম (client) স্কিমা */

export const leadFormSchema = baseLead.superRefine(leadShapeRules);
export const updateLeadFormSchema = baseLead.extend({ id }).superRefine(leadShapeRules);

/* --------------------------- ফোন ছাড়া বাকি লিড অ্যাকশন — দুই দিকেই একই স্কিমা */

export const changeStageSchema = z
  .object({
    id,
    stage: z.enum(LEAD_STAGES as unknown as [string, ...string[]], {
      errorMap: () => ({ message: 'সঠিক স্টেজ নয়' }),
    }),
    lostReason: optionalText(120, 'কারণটি খুব বড় হয়ে গেছে'),
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
  id,
  note: requiredText(2, 1000, 'নোট কমপক্ষে ২ অক্ষরের হতে হবে', 'নোট খুব বড় হয়ে গেছে'),
});

/** ডকুমেন্ট আপলোডের মেটাডেটা — ফাইল নিজে আলাদাভাবে যাচাই হয় (`lib/upload.ts`) */
export const uploadDocumentSchema = z.object({
  leadId: id,
  fileType: z.enum(LEAD_FILE_TYPES as unknown as [string, ...string[]], {
    errorMap: () => ({ message: 'ফাইলের ধরন নির্বাচন করুন' }),
  }),
  description: optionalText(300, 'বিবরণ খুব বড় হয়ে গেছে'),
});
