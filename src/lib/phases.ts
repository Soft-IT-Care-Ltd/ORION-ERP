import { differenceInCalendarDays, format } from 'date-fns';
import type { PhaseStatus } from '@prisma/client';

/**
 * Construction phase timeline এর কনস্ট্যান্ট, লেবেল ও হিসাব — PRD সেকশন ৫.৪।
 *
 * `lib/leads.ts` / `lib/sales.ts` এর মতোই এখানে শুধু type-only Prisma import ও
 * বিশুদ্ধ ফাংশন, কারণ ফাইলটি client component (ইঞ্জিনিয়ারের আপডেট ফর্ম) থেকেও
 * import হয় — `@prisma/client` runtime বা `lib/prisma` এখানে আনা যাবে না।
 */

/* ------------------------------------------------------------ template */

export type PhaseTemplateSeed = {
  name: string;
  /** PRD টেবিলের typical duration এর মাঝামাঝি মান (দিন) */
  defaultDurationDays: number;
  /** PRD টেবিলের "Owner" কলাম — টেমপ্লেট প্রিভিউতে দেখানোর জন্য */
  owner: string;
};

/**
 * PRD সেকশন ৫.৪ এর ডিফল্ট ৭-ফেজ টেমপ্লেট।
 *
 * v2 তে জমি, ডিজাইন ও সরকারি অনুমোদন **প্রি-প্রজেক্ট পাইপলাইনে** (লিড স্টেজ)
 * হয়ে যায়, তাই প্রজেক্টের ফেজ শুরু হয় সরাসরি নির্মাণকাজ থেকে। তালিকাটি
 * গ্লোবাল টেমপ্লেটের ডিফল্ট — Admin → ফেজ টেমপ্লেট থেকে নাম/সময়কাল বদলানো যায়।
 */
export const DEFAULT_PHASE_TEMPLATE: PhaseTemplateSeed[] = [
  { name: 'Site Mobilization / Set-up', defaultDurationDays: 8, owner: 'Site Engineer' }, // ৫–১০ দিন
  { name: 'Foundation Work', defaultDurationDays: 40, owner: 'Site Engineer' }, // ৩০–৪৫ দিন
  { name: 'Structure (Column/Beam/Slab)', defaultDurationDays: 270, owner: 'Site Engineer' }, // ৬–১২ মাস
  { name: 'Brick Work & Plaster', defaultDurationDays: 75, owner: 'Site Engineer' }, // ২–৩ মাস
  { name: 'Electrical, Plumbing & Sanitary', defaultDurationDays: 45, owner: 'Site Engineer' }, // ১–২ মাস
  { name: 'Finishing (Tiles, Paint, Fittings)', defaultDurationDays: 75, owner: 'Site Engineer' }, // ২–৩ মাস
  { name: 'Final Inspection & Handover', defaultDurationDays: 22, owner: 'Admin + Engineer' }, // ১৫–৩০ দিন
];

/**
 * ডিফল্ট ফেজগুলোর বাংলা উপশিরোনাম — কাস্টমার/ইঞ্জিনিয়ার প্যানেলে নামের নিচে দেখায়।
 * নাম এডিট করা কাস্টম ফেজে কিছু দেখাবে না (key মিলবে না) — সেটাই কাম্য।
 */
export const PHASE_NAME_BN: Record<string, string> = {
  'Site Mobilization / Set-up': 'সাইট প্রস্তুতি ও মালামাল',
  'Foundation Work': 'ফাউন্ডেশন',
  'Structure (Column/Beam/Slab)': 'স্ট্রাকচার (কলাম/বিম/স্ল্যাব)',
  'Brick Work & Plaster': 'ইটের গাঁথুনি ও প্লাস্টার',
  'Electrical, Plumbing & Sanitary': 'ইলেকট্রিক, প্লাম্বিং ও স্যানিটারি',
  'Finishing (Tiles, Paint, Fittings)': 'ফিনিশিং (টাইলস, রং, ফিটিংস)',
  'Final Inspection & Handover': 'চূড়ান্ত পরিদর্শন ও হ্যান্ডওভার',
};

/** PRD সেকশন ৫.৪ — ইঞ্জিনিয়ার এই ধাপগুলোতেই % দেয় (slider/dropdown) */
export const PERCENT_OPTIONS = [0, 25, 50, 75, 100] as const;
export type PercentOption = (typeof PERCENT_OPTIONS)[number];

export function isPercentOption(value: number): value is PercentOption {
  return (PERCENT_OPTIONS as readonly number[]).includes(value);
}

/* -------------------------------------------------------------- labels */

export const PHASE_STATUS_LABEL: Record<PhaseStatus, string> = {
  UPCOMING: 'আসন্ন',
  IN_PROGRESS: 'চলমান',
  DONE: 'সম্পন্ন',
  DELAYED: 'বিলম্বিত',
};

/** ব্যাজ/চিপের রঙ — light ও dark দুই থিমেই পড়া যায় */
export const PHASE_STATUS_BADGE: Record<PhaseStatus, string> = {
  UPCOMING: 'bg-muted text-muted-foreground',
  IN_PROGRESS: 'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-300',
  DONE: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  DELAYED: 'bg-destructive/15 text-destructive',
};

/** প্রগ্রেস বারের ফিল */
export const PHASE_STATUS_FILL: Record<PhaseStatus, string> = {
  UPCOMING: 'bg-muted-foreground/30',
  IN_PROGRESS: 'bg-sky-500',
  DONE: 'bg-emerald-600',
  DELAYED: 'bg-destructive',
};

/** স্টেপারের ডট — আসন্ন ফেজে ফাঁপা বৃত্ত (ভেতরে ক্রমিক নম্বর) */
export const PHASE_STATUS_DOT: Record<PhaseStatus, string> = {
  UPCOMING: 'border border-dashed border-muted-foreground/50 bg-background text-muted-foreground',
  IN_PROGRESS: 'bg-sky-500 text-white',
  DONE: 'bg-emerald-600 text-white',
  DELAYED: 'bg-destructive text-destructive-foreground',
};

/* ------------------------------------------------------------ compute */

const clampPercent = (value: number) => Math.min(100, Math.max(0, Math.round(value)));

/**
 * ফেজের কার্যকর স্ট্যাটাস।
 *
 * DB তে `Phase.status` লেখা থাকে (কুয়েরি/রিপোর্টের সুবিধার জন্য), কিন্তু "বিলম্বিত"
 * নিছক সময় পেরোলেই হয়ে যায় — কেউ আপডেট না দিলেও। তাই DB এর মান স্ন্যাপশট, আর
 * দেখানোর সময় সবসময় আজকের তারিখ ধরে এই ফাংশনটিই চালানো হয়। লেখা ও পড়া — দুই
 * জায়গায় একই ফাংশন বলে দুটো কখনো আলাদা নিয়মে চলে না।
 */
export function computePhaseStatus(
  phase: { percentComplete: number; plannedEnd: Date | null },
  now: Date,
): PhaseStatus {
  if (clampPercent(phase.percentComplete) >= 100) return 'DONE';
  if (phase.plannedEnd && phase.plannedEnd.getTime() < now.getTime()) return 'DELAYED';
  return phase.percentComplete > 0 ? 'IN_PROGRESS' : 'UPCOMING';
}

/** planned duration (দিন) — দুই তারিখই থাকলে, নইলে null */
function plannedDays(phase: { plannedStart: Date | null; plannedEnd: Date | null }): number | null {
  if (!phase.plannedStart || !phase.plannedEnd) return null;
  const days = differenceInCalendarDays(phase.plannedEnd, phase.plannedStart) + 1;
  return days > 0 ? days : null;
}

/**
 * প্রজেক্টের সামগ্রিক অগ্রগতি (%) — PRD সেকশন ৫.৪ এর "৬৫% সম্পন্ন"।
 *
 * সব ফেজের planned duration জানা থাকলে সময়-ভারিত গড়, নইলে সরল গড়। ভারিত গড়
 * জরুরি — Structure ফেজ একাই ৯ মাস, আর Handover ৩ সপ্তাহ; সরল গড়ে দুটোর ওজন
 * সমান হয়ে অগ্রগতি বাড়িয়ে দেখাত।
 */
export function overallProgress(
  phases: { percentComplete: number; plannedStart: Date | null; plannedEnd: Date | null }[],
): number {
  if (phases.length === 0) return 0;

  const days = phases.map(plannedDays);
  const weights = days.every((d): d is number => d !== null) ? days : phases.map(() => 1);
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  if (totalWeight === 0) return 0;

  const weighted = phases.reduce(
    (sum, phase, i) => sum + clampPercent(phase.percentComplete) * weights[i],
    0,
  );
  return Math.round(weighted / totalWeight);
}

/**
 * "এখন কোন ফেজ চলছে" — প্রথম অসম্পূর্ণ ফেজ (order অনুযায়ী)।
 * সব শেষ হলে null (তখন UI "হ্যান্ডওভার সম্পন্ন" দেখায়)।
 */
export function currentPhase<T extends { order: number; percentComplete: number }>(
  phases: T[],
): T | null {
  return [...phases].sort((a, b) => a.order - b.order).find((p) => p.percentComplete < 100) ?? null;
}

/** লিস্ট/হেডারে দেখানোর সারসংক্ষেপ — কতটুকু এগিয়েছে ও এখন কোন ফেজ চলছে */
export type PhaseProgressRow = {
  name: string;
  order: number;
  percentComplete: number;
  plannedStart: Date | null;
  plannedEnd: Date | null;
};

export type PhaseSummary = {
  progress: number;
  total: number;
  doneCount: number;
  delayedCount: number;
  /** চলমান (বা পরবর্তী) ফেজ — সব শেষ হলে null */
  current: { name: string; nameBn: string | null; status: PhaseStatus } | null;
};

export function summarizePhases(phases: PhaseProgressRow[], now: Date): PhaseSummary {
  const active = currentPhase(phases);

  return {
    progress: overallProgress(phases),
    total: phases.length,
    doneCount: phases.filter((p) => p.percentComplete >= 100).length,
    delayedCount: phases.filter((p) => computePhaseStatus(p, now) === 'DELAYED').length,
    current: active
      ? {
          name: active.name,
          nameBn: PHASE_NAME_BN[active.name] ?? null,
          status: computePhaseStatus(active, now),
        }
      : null,
  };
}

/** planned end পেরিয়ে যাওয়ার পর কত দিন — DELAYED না হলে null */
export function delayDays(
  phase: { percentComplete: number; plannedEnd: Date | null },
  now: Date,
): number | null {
  if (computePhaseStatus(phase, now) !== 'DELAYED' || !phase.plannedEnd) return null;
  return Math.max(1, differenceInCalendarDays(now, phase.plannedEnd));
}

/**
 * টেমপ্লেট থেকে planned date সিরিজ — প্রতিটি ফেজ আগেরটির শেষের পরদিন শুরু।
 * duration না দিলে সেই ফেজের তারিখ ফাঁকা থাকে এবং পরেরটি একই দিন থেকে গোনা শুরু করে।
 */
export function planPhaseDates(
  templates: { defaultDurationDays: number | null }[],
  startDate: Date | null,
): { plannedStart: Date | null; plannedEnd: Date | null }[] {
  if (!startDate) return templates.map(() => ({ plannedStart: null, plannedEnd: null }));

  let cursor = new Date(startDate);
  cursor.setHours(0, 0, 0, 0);

  return templates.map((t) => {
    if (!t.defaultDurationDays || t.defaultDurationDays <= 0) {
      return { plannedStart: null, plannedEnd: null };
    }
    const plannedStart = new Date(cursor);
    const plannedEnd = new Date(cursor);
    // duration দিনের মধ্যে শুরুর দিনটিও ধরা — ৪৫ দিনের ফেজ = start + ৪৪
    plannedEnd.setDate(plannedEnd.getDate() + t.defaultDurationDays - 1);

    cursor = new Date(plannedEnd);
    cursor.setDate(cursor.getDate() + 1);

    return { plannedStart, plannedEnd };
  });
}

/* ---------------------------------------------------------- serialize */

/** টাইমলাইন কম্পোনেন্টের ইনপুট — Date/Decimal ছাড়া, client এ পাঠানোর উপযোগী */
export type PhaseView = {
  id: string;
  name: string;
  /** ডিফল্ট টেমপ্লেটের ফেজ হলে বাংলা উপশিরোনাম */
  nameBn: string | null;
  order: number;
  /** আজকের তারিখ ধরে হিসাব করা কার্যকর স্ট্যাটাস */
  status: PhaseStatus;
  percentComplete: number;
  plannedStart: string | null;
  plannedEnd: string | null;
  actualStart: string | null;
  actualEnd: string | null;
  delayReason: string | null;
  /** DELAYED হলে কত দিন পিছিয়ে */
  delayDays: number | null;
  updateCount: number;
  photoCount: number;
};

/** ইঞ্জিনিয়ারের একটি সাইট আপডেট — `PhaseUpdateLog` এর ইনপুট */
export type PhaseUpdateItem = {
  id: string;
  phaseName: string;
  /** এই আপডেটে যে % সেট হয়েছিল — পুরনো রেকর্ডে null থাকতে পারে */
  percentComplete: number | null;
  note: string | null;
  photoUrls: string[];
  authorName: string;
  /** server এ ফরম্যাট করা — client এ করলে TZ ভেদে hydration mismatch হতো */
  createdAtLabel: string;
};

export type PhaseRow = {
  id: string;
  name: string;
  order: number;
  percentComplete: number;
  plannedStart: Date | null;
  plannedEnd: Date | null;
  actualStart: Date | null;
  actualEnd: Date | null;
  delayReason: string | null;
};

const day = (date: Date | null) => (date ? format(date, 'dd MMM yyyy') : null);

export function toPhaseView(
  phase: PhaseRow,
  now: Date,
  counts?: { updates?: number; photos?: number },
): PhaseView {
  return {
    id: phase.id,
    name: phase.name,
    nameBn: PHASE_NAME_BN[phase.name] ?? null,
    order: phase.order,
    status: computePhaseStatus(phase, now),
    percentComplete: clampPercent(phase.percentComplete),
    plannedStart: day(phase.plannedStart),
    plannedEnd: day(phase.plannedEnd),
    actualStart: day(phase.actualStart),
    actualEnd: day(phase.actualEnd),
    delayReason: phase.delayReason,
    delayDays: delayDays(phase, now),
    updateCount: counts?.updates ?? 0,
    photoCount: counts?.photos ?? 0,
  };
}
