import { z } from 'zod';
import { UnitStatus } from '@prisma/client';
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
 * Project, Unit, PhaseTemplate ও PhaseUpdate এর ইনপুট যাচাই — PRD সেকশন ৫.২।
 * ফর্ম (client) ও server action — দুই জায়গাতেই এই স্কিমাই চলে।
 */

const price = positiveAmount({
  message: 'সঠিক মূল্য দিন',
  maxMessage: 'মূল্য অস্বাভাবিক বেশি — যাচাই করুন',
});

/* ------------------------------------------------------------- project */

export const projectSchema = z.object({
  name: requiredText(2, 120, 'প্রজেক্টের নাম দিন'),
  location: requiredText(2, 180, 'অবস্থান দিন'),
  description: optionalText(1000),
  startDate: nullableDate,
  engineerId: nullableId,
});

export const updateProjectSchema = projectSchema.extend({ id });

export const projectIdSchema = z.object({ id });

/* ---------------------------------------------------------------- unit */

/** খালি → `null`; নইলে ধনাত্মক আয়তন */
const sizeSqft = z
  .string()
  .optional()
  .transform((v) => {
    const trimmed = v?.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed.replace(/,/g, ''));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
  })
  .refine((v) => v !== undefined, 'সঠিক আয়তন দিন')
  .transform((v) => v as number | null);

export const unitSchema = z.object({
  projectId: id,
  unitNo: requiredText(1, 30, 'ইউনিট নম্বর দিন'),
  sizeSqft,
  price,
  status: z.nativeEnum(UnitStatus, {
    errorMap: () => ({ message: 'স্ট্যাটাস নির্বাচন করুন' }),
  }),
});

export const updateUnitSchema = unitSchema.extend({ id });

export const unitIdSchema = z.object({ id });

/* ------------------------------------------------------- phase template */

const templateRow = z.object({
  name: requiredText(2, 120, 'ফেজের নাম দিন'),
  defaultDurationDays: integerBetween(0, 3650, 'সময়কাল ০–৩৬৫০ দিনের মধ্যে দিন').transform((v) =>
    v > 0 ? v : null,
  ),
});

export const savePhaseTemplateSchema = z.object({
  projectId: id,
  phases: z
    .array(templateRow)
    .min(1, 'অন্তত একটি ফেজ রাখতে হবে')
    .max(30, 'সর্বোচ্চ ৩০টি ফেজ')
    .refine(
      (rows) => new Set(rows.map((r) => r.name.toLowerCase())).size === rows.length,
      'একই নামের ফেজ দুবার দেওয়া যাবে না',
    ),
});

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
  /** ফেজ পিছিয়ে থাকলে কারণ — PRD সেকশন ৫.২ (Delay Reason) */
  delayReason: optionalText(500),
});

export type ProjectInput = z.infer<typeof projectSchema>;
export type UnitInput = z.infer<typeof unitSchema>;
export type PhaseUpdateInput = z.infer<typeof phaseUpdateSchema>;
