import type { LeadStage } from '@prisma/client';

/**
 * Admin ড্যাশবোর্ডের রিপোর্ট/চার্টের কনস্ট্যান্ট, টাইপ ও বিশুদ্ধ হিসাব —
 * PRD সেকশন ৫.৭ (Reporting & Analytics)।
 *
 * `lib/payments.ts` / `lib/phases.ts` এর মতোই এখানে শুধু type-only Prisma import,
 * কারণ ফাইলটি Recharts এর client component থেকেও import হয়।
 * DB-নির্ভর অংশ `lib/report-data.ts` এ।
 */

/* -------------------------------------------------------------- colors */

/**
 * চার্ট সিরিজের রঙ — `globals.css` এর `--chart-*` টোকেন থেকে।
 *
 * SVG এর presentation attribute এ `var()` রিজলভ হয়, তাই light/dark টগলে
 * চার্টও নিজে থেকেই বদলায়। কম্পোনেন্টে কখনো hex বসানো হয় না।
 */
export const CHART_COLOR = {
  navy: 'hsl(var(--chart-1))',
  gold: 'hsl(var(--chart-2))',
  sky: 'hsl(var(--chart-3))',
  emerald: 'hsl(var(--chart-4))',
  alert: 'hsl(var(--chart-5))',
  grid: 'hsl(var(--border))',
  axis: 'hsl(var(--muted-foreground))',
} as const;

/** টুলটিপ/লেজেন্ডের কমন স্টাইল — তিন চার্টেই এক */
export const CHART_TOOLTIP_STYLE = {
  backgroundColor: 'hsl(var(--popover))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 'var(--radius)',
  color: 'hsl(var(--popover-foreground))',
  fontSize: '12px',
  padding: '6px 10px',
} as const;

/* ------------------------------------------------------------ formatting */

/**
 * অক্ষের টিকের জন্য সংক্ষিপ্ত টাকা — "৳42.5L", "৳1.2Cr"।
 * `formatBDT` পুরো অঙ্ক দেখায়, যা অক্ষে জায়গা নেয় বেশি; টুলটিপে সেটিই ব্যবহার হয়।
 */
export function formatCompactBDT(amount: number): string {
  const value = Math.round(amount);
  if (value === 0) return '৳0';

  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);

  const scale = (unit: number, suffix: string) => {
    const n = abs / unit;
    // ১০ এর নিচে এক দশমিক (৳4.5L), তার উপরে পূর্ণসংখ্যা (৳42L)
    return `${sign}৳${n >= 10 ? Math.round(n) : Math.round(n * 10) / 10}${suffix}`;
  };

  if (abs >= 10_000_000) return scale(10_000_000, 'Cr');
  if (abs >= 100_000) return scale(100_000, 'L');
  if (abs >= 1_000) return scale(1_000, 'K');
  return `${sign}৳${abs}`;
}

/* --------------------------------------------------------- sales funnel */

/** PRD সেকশন ৫.১ — funnel report এর সময়সীমা ("মাসিক/quarterly ভিত্তিতে") */
export const FUNNEL_RANGES = ['month', 'quarter', 'all'] as const;
export type FunnelRange = (typeof FUNNEL_RANGES)[number];

export const FUNNEL_RANGE_LABEL: Record<FunnelRange, string> = {
  month: 'এই মাস',
  quarter: 'এই কোয়ার্টার',
  all: 'সব সময়',
};

export function parseFunnelRange(value: string | undefined): FunnelRange {
  return (FUNNEL_RANGES as readonly string[]).includes(value ?? '')
    ? (value as FunnelRange)
    : 'month';
}

/**
 * ফানেলের একটি ধাপ — PRD সেকশন ৫.১ এর স্যাম্পল টেবিলের একটি সারি।
 *
 * `count` হলো **সঞ্চিত (cumulative)** সংখ্যা — অর্থাৎ যতগুলো লিড অন্তত এই ধাপ
 * পর্যন্ত পৌঁছেছে, এখন যে স্টেজেই থাকুক। PRD টেবিলে ঠিক এভাবেই সংখ্যাগুলো
 * কমতে কমতে যায় (200 → 120 → 78 …), আর তখনই conversion % অর্থবহ হয়।
 */
export type FunnelRow = {
  stage: LeadStage;
  label: string;
  labelBn: string;
  count: number;
  /** পরের ধাপে পৌঁছানোর হার (%) — শেষ ধাপে null */
  conversion: number | null;
};

export type FunnelReport = {
  rows: FunnelRow[];
  /** ফানেলে ঢোকা মোট লিড (Lost সহ) */
  total: number;
  won: number;
  lost: number;
  /** সামগ্রিক conversion — Won / মোট (%) */
  winRate: number;
};

/* ------------------------------------------------------ project progress */

/** PRD সেকশন ৫.৭ — "Project-wise progress vs timeline" এর একটি সারি */
export type ProjectProgressRow = {
  projectId: string;
  name: string;
  /** প্রজেক্টের ইউনিটগুলোর গড় অগ্রগতি (%) */
  progress: number;
  unitCount: number;
  /** ১০০% সম্পন্ন ইউনিট */
  doneUnits: number;
  /** planned end পেরিয়ে যাওয়া ফেজের সংখ্যা — চার্টে লাল ইঙ্গিত */
  delayedPhases: number;
};

/* --------------------------------------------------- collected vs due */

/**
 * এক মাসের কালেকশন — PRD সেকশন ৫.৩ এর KPI (Receivable / Collected / %)।
 *
 * `due` = ওই মাসে due হওয়া কিস্তিগুলোর মোট, `collected` = সেই কিস্তিগুলোর
 * বিপরীতে যত টাকা এসেছে (যখনই আসুক)। তাই `rate` মানে "ওই মাসের পাওনার কত
 * শতাংশ আদায় হয়েছে" — PRD এর "৳38,00,000 (89%)" ঠিক এই হিসাব।
 */
export type CollectionMonthRow = {
  /** "2026-09" — সাজানোর জন্য */
  month: string;
  /** অক্ষে দেখানোর লেবেল — "Sep 26" */
  label: string;
  due: number;
  collected: number;
  outstanding: number;
  /** ওই মাসে কিছু due না থাকলে null — শূন্য দেখালে "কিছুই আদায় হয়নি" বোঝাত */
  rate: number | null;
};

export type CollectionReport = {
  months: CollectionMonthRow[];
  /** পুরো উইন্ডোর যোগফল */
  totalDue: number;
  totalCollected: number;
  totalOutstanding: number;
  rate: number;
};

/** ভাগ করে শতাংশ — শূন্য হর নিরাপদে সামলায় */
export function ratio(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}
