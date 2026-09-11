import { z } from 'zod';
import { BuildingType, ProjectStatus } from '@prisma/client';
import { PERCENT_OPTIONS } from '@/lib/phases';
import {
  id,
  integerBetween,
  nullableDate,
  nullableId,
  optionalText,
  positiveAmount,
  requiredText,
} from './common';

/**
 * Project, PhaseTemplate ও PhaseUpdate এর ইনপুট যাচাই — PRD সেকশন ৫.৩/৫.৪।
 * ফর্ম (client) ও server action — দুই জায়গাতেই এই স্কিমাই চলে।
 *
 * v2 তে Project সরাসরি Lead থেকে তৈরি হয় (`validations/convert.ts`), তাই এখানে
 * শুধু তৈরি-পরবর্তী **এডিট** ও ফেজ সংক্রান্ত স্কিমাগুলো।
 */

/** খালি → `null`; নইলে ধনাত্মক আয়তন/রেট */
function nullablePositiveNumber(message: string) {
  return z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => {
      if (v === undefined || v === null || String(v).trim() === '') return null;
      const parsed = typeof v === 'number' ? v : Number(String(v).replace(/,/g, '').trim());
      return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
    })
    .refine((v) => v !== undefined, message)
    .transform((v) => v as number | null);
}

export const totalSqft = nullablePositiveNumber('সঠিক আয়তন দিন');
export const ratePerSqft = nullablePositiveNumber('সঠিক রেট দিন');

export const buildingTypeField = z
  .string()
  .optional()
  .transform((v) => (v?.trim() ? v.trim() : null))
  .refine(
    (v) => v === null || Object.prototype.hasOwnProperty.call(BuildingType, v),
    'বাড়ির ধরন নির্বাচন করুন',
  )
  .transform((v) => v as BuildingType | null);

/**
 * লাইভ ক্যামেরার stream URL — কাস্টমার পোর্টালে `<iframe>` এ বসে, তাই স্কিমটি
 * http/https ছাড়া কিছু হতে পারবে না (`javascript:` বসিয়ে দিলে সেটি কাস্টমারের
 * ব্রাউজারে স্ক্রিপ্ট চালানোর সুযোগ করে দিত)।
 */
export const cameraStreamUrl = z
  .string()
  .optional()
  .transform((v) => (v?.trim() ? v.trim() : null))
  .refine((v) => {
    if (v === null) return true;
    if (v.length > 500) return false;
    try {
      const parsed = new URL(v);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }, 'সঠিক http/https লিংক দিন');

/* ------------------------------------------------------------- project */

export const updateProjectSchema = z.object({
  id,
  title: requiredText(2, 160, 'প্রজেক্টের নাম দিন'),
  landLocation: optionalText(180, 'অবস্থান খুব বড় হয়ে গেছে'),
  buildingType: buildingTypeField,
  floors: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => {
      if (v === undefined || v === null || String(v).trim() === '') return null;
      const parsed = typeof v === 'number' ? v : Number(String(v).trim());
      return Number.isInteger(parsed) && parsed > 0 && parsed <= 50 ? parsed : undefined;
    })
    .refine((v) => v !== undefined, 'তলার সংখ্যা ১–৫০ এর মধ্যে দিন')
    .transform((v) => v as number | null),
  totalSqft,
  ratePerSqft,
  totalContractValue: positiveAmount({
    message: 'সঠিক কন্ট্রাক্ট ভ্যালু দিন',
    maxMessage: 'অঙ্কটি অস্বাভাবিক বেশি — যাচাই করুন',
    round: true,
  }),
  startDate: nullableDate,
  cameraStreamUrl,
  status: z.nativeEnum(ProjectStatus, {
    errorMap: () => ({ message: 'স্ট্যাটাস নির্বাচন করুন' }),
  }),
  engineerId: nullableId,
});

export const projectIdSchema = z.object({ id });

/* ------------------------------------------------------- phase template */

const templateRow = z.object({
  name: requiredText(2, 120, 'ফেজের নাম দিন'),
  defaultDurationDays: integerBetween(0, 3650, 'সময়কাল ০–৩৬৫০ দিনের মধ্যে দিন').transform((v) =>
    v > 0 ? v : null,
  ),
});

/**
 * v2 তে টেমপ্লেট গ্লোবাল — কোনো `projectId` নেই। Lead → Project কনভার্শনের সময়
 * এখান থেকেই ফেজগুলো কপি হয় (PRD সেকশন ৫.৩)।
 */
export const savePhaseTemplateSchema = z.object({
  phases: z
    .array(templateRow)
    .min(1, 'অন্তত একটি ফেজ রাখতে হবে')
    .max(30, 'সর্বোচ্চ ৩০টি ফেজ')
    .refine(
      (rows) => new Set(rows.map((r) => r.name.toLowerCase())).size === rows.length,
      'একই নামের ফেজ দুবার দেওয়া যাবে না',
    ),
});

/** এখনো টাইমলাইন নেই এমন প্রজেক্টে গ্লোবাল টেমপ্লেট বসানো */
export const applyTemplateSchema = z.object({
  projectId: id,
  /** না দিলে প্রজেক্টের startDate ব্যবহার হবে */
  startDate: nullableDate,
});

/* --------------------------------------------------------- phase update */

export const phaseUpdateSchema = z.object({
  phaseId: id,
  percentComplete: z
    .union([z.string(), z.number()])
    .transform((v) => (typeof v === 'number' ? v : Number(String(v).trim())))
    .refine(
      (v) => (PERCENT_OPTIONS as readonly number[]).includes(v),
      `% হতে হবে ${PERCENT_OPTIONS.join('/')} এর একটি`,
    ),
  note: optionalText(2000),
  /** ফেজ পিছিয়ে থাকলে কারণ — PRD সেকশন ৫.৪ (Delay Reason) */
  delayReason: optionalText(500),
});

export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type PhaseUpdateInput = z.infer<typeof phaseUpdateSchema>;
