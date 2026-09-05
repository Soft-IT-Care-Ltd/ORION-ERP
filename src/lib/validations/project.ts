import { z } from 'zod';
import { UnitStatus } from '@prisma/client';
import { PERCENT_OPTIONS } from '@/lib/phases';

/**
 * Project, Unit, PhaseTemplate ও PhaseUpdate এর ইনপুট যাচাই — PRD সেকশন ৫.২।
 */

/** ভুল করে অতিরিক্ত শূন্য বসানো ঠেকাতে (১০০ কোটি) — `validations/sale.ts` এর মতোই */
const MAX_UNIT_PRICE = 10_000_000_000;

/** খালি স্ট্রিং → undefined (ঐচ্ছিক টেক্সট ফিল্ড) */
const optionalText = (max: number) =>
  z
    .string()
    .optional()
    .transform((v) => {
      const trimmed = v?.trim();
      return trimmed ? trimmed : undefined;
    })
    .refine((v) => v === undefined || v.length <= max, `সর্বোচ্চ ${max} অক্ষর`);

/** "yyyy-MM-dd" (date input) → local midnight Date; খালি হলে null */
const optionalDate = z
  .string()
  .optional()
  .transform((v) => {
    const trimmed = v?.trim();
    if (!trimmed) return null;
    // `new Date("2026-01-05")` UTC ধরে — দেশভেদে একদিন পিছিয়ে যেত, তাই হাতে ভাঙা
    const [y, m, d] = trimmed.split('-').map(Number);
    if (!y || !m || !d) return undefined;
    return new Date(y, m - 1, d);
  })
  .refine((v) => v !== undefined, 'সঠিক তারিখ দিন')
  .transform((v) => v as Date | null);

/** খালি স্ট্রিং → null (ঐচ্ছিক relation id) */
const optionalId = z
  .string()
  .optional()
  .transform((v) => (v?.trim() ? v.trim() : null));

const amount = z
  .union([z.string(), z.number()])
  .transform((v) => (typeof v === 'number' ? v : Number(String(v).replace(/,/g, '').trim())))
  .refine((v) => Number.isFinite(v) && v > 0, 'সঠিক মূল্য দিন')
  .refine((v) => !Number.isFinite(v) || v <= MAX_UNIT_PRICE, 'মূল্য অস্বাভাবিক বেশি — যাচাই করুন');

/* ------------------------------------------------------------- project */

export const projectSchema = z.object({
  name: z.string().trim().min(2, 'প্রজেক্টের নাম দিন').max(120, 'নাম সর্বোচ্চ ১২০ অক্ষর'),
  location: z.string().trim().min(2, 'অবস্থান দিন').max(180, 'অবস্থান সর্বোচ্চ ১৮০ অক্ষর'),
  description: optionalText(1000),
  startDate: optionalDate,
  engineerId: optionalId,
});

export const updateProjectSchema = projectSchema.extend({ id: z.string().min(1) });

/* ---------------------------------------------------------------- unit */

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
  projectId: z.string().min(1),
  unitNo: z.string().trim().min(1, 'ইউনিট নম্বর দিন').max(30, 'ইউনিট নম্বর সর্বোচ্চ ৩০ অক্ষর'),
  sizeSqft,
  price: amount,
  status: z.nativeEnum(UnitStatus),
});

export const updateUnitSchema = unitSchema.extend({ id: z.string().min(1) });

/* ------------------------------------------------------- phase template */

const templateRow = z.object({
  name: z.string().trim().min(2, 'ফেজের নাম দিন').max(120, 'নাম সর্বোচ্চ ১২০ অক্ষর'),
  defaultDurationDays: z
    .union([z.string(), z.number()])
    .transform((v) => (typeof v === 'number' ? v : Number(String(v).trim() || '0')))
    .refine((v) => Number.isInteger(v) && v >= 0 && v <= 3650, 'সময়কাল ০–৩৬৫০ দিনের মধ্যে দিন')
    .transform((v) => (v > 0 ? v : null)),
});

export const savePhaseTemplateSchema = z.object({
  projectId: z.string().min(1),
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
  projectId: z.string().min(1),
  /** না দিলে প্রজেক্টের startDate ব্যবহার হবে */
  startDate: optionalDate,
});

/* --------------------------------------------------------- phase update */

export const phaseUpdateSchema = z.object({
  phaseId: z.string().min(1),
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
