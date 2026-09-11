import type { LeadStage } from '@prisma/client';
import type { CsvValue } from '@/lib/csv';
import type { Permission } from '@/lib/rbac';

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

/** PRD সেকশন ৫.১০ — "Project-wise progress vs timeline" এর একটি সারি */
export type ProjectProgressRow = {
  projectId: string;
  name: string;
  /** ফেজের সময়-ভারিত গড় অগ্রগতি (%) */
  progress: number;
  phaseCount: number;
  /** ১০০% সম্পন্ন ফেজ */
  donePhases: number;
  /** planned end পেরিয়ে যাওয়া ফেজের সংখ্যা — চার্টে লাল ইঙ্গিত */
  delayedPhases: number;
};

/* --------------------------------------------------- collected vs due */

/**
 * এক মাসের কালেকশন — PRD সেকশন ৫.১০ এর KPI (Receivable / Collected / %)।
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

/* ------------------------------------------------------------ exports */

/**
 * এক্সপোর্টযোগ্য রিপোর্টের তালিকা — PRD সেকশন ৫.১০।
 *
 * প্রতিটি রিপোর্ট একই আকারে ডেটা দেয় (`ReportDataset`), তাই CSV রুট
 * (`/api/reports/<id>`) ও প্রিন্ট-ভিউ (`/admin/reports/print`) — দুটোই একই
 * লোডার ব্যবহার করে, আলাদা করে কিছু লিখতে হয় না।
 */

/** ঘরের ধরন — CSV তে কাঁচা সংখ্যা যায় (Excel এ যোগ করা যায়), পর্দায় ফরম্যাট হয় */
export type ReportColumnKind = 'text' | 'number' | 'money' | 'percent';

export type ReportColumn = {
  header: string;
  kind?: ReportColumnKind;
};

export type ReportDataset = {
  columns: ReportColumn[];
  rows: CsvValue[][];
};

export type ReportGroup = 'sales' | 'projects' | 'finance';

export const REPORT_GROUP_LABEL: Record<ReportGroup, string> = {
  sales: 'সেলস ও মার্কেটিং',
  projects: 'প্রজেক্ট',
  finance: 'আর্থিক',
};

export type ReportDefinition = {
  label: string;
  description: string;
  group: ReportGroup;
  /** এই রিপোর্ট নামাতে কোন permission লাগে (`lib/rbac.ts`) */
  permission: Permission;
  /** সময়সীমার টগল প্রযোজ্য কি না — না হলে রিপোর্টটি সবসময় "এখনকার অবস্থা" */
  timeScoped: boolean;
  /** ফাইলনেমের গোড়া — শেষে তারিখ বসে */
  slug: string;
};

export const REPORTS = {
  'sales-funnel': {
    label: 'সেলস ফানেল ও কনভার্শন',
    description: 'স্টেজভিত্তিক লিড সংখ্যা ও পরের ধাপে যাওয়ার হার',
    group: 'sales',
    permission: 'report:full',
    timeScoped: true,
    slug: 'sales-funnel',
  },
  'executive-performance': {
    label: 'এক্সিকিউটিভ পারফরম্যান্স',
    description: 'মার্কেটিং এক্সিকিউটিভভেদে লিড, Won/Lost ও কন্ট্রাক্ট ভ্যালু',
    group: 'sales',
    permission: 'report:full',
    timeScoped: true,
    slug: 'executive-performance',
  },
  'lead-source': {
    label: 'লিড সোর্স ROI',
    description: 'কোন সোর্স থেকে কত লিড ও কত কনভার্শন হয়েছে',
    group: 'sales',
    permission: 'report:full',
    timeScoped: true,
    slug: 'lead-source',
  },
  leads: {
    label: 'লিড তালিকা',
    description: 'সব ফিল্ডসহ কাঁচা লিড ডেটা — নিজের মতো ছেঁকে নেওয়ার জন্য',
    group: 'sales',
    permission: 'report:full',
    timeScoped: true,
    slug: 'leads',
  },
  'project-progress': {
    label: 'প্রজেক্ট-ভিত্তিক অগ্রগতি',
    description: 'প্রতিটি প্রজেক্টের % complete, চলমান ফেজ ও বিলম্ব',
    group: 'projects',
    permission: 'report:full',
    timeScoped: false,
    slug: 'project-progress',
  },
  collection: {
    label: 'আদায় বনাম পাওনা (মাসিক)',
    description: 'শেষ ১২ মাসের due, আদায় ও আদায়ের হার',
    group: 'finance',
    permission: 'report:financial',
    timeScoped: false,
    slug: 'collection',
  },
  'overdue-aging': {
    label: 'বকেয়া aging',
    description: '০–১৫ / ১৬–৩০ / ৩০+ দিনের বকেয়া কিস্তির বিস্তারিত',
    group: 'finance',
    permission: 'report:financial',
    timeScoped: false,
    slug: 'overdue-aging',
  },
  'client-profitability': {
    label: 'ক্লায়েন্ট-ভিত্তিক লাভ/ক্ষতি',
    description: 'প্রতি ক্লায়েন্টের billed − internal cost = margin (PRD সেকশন ৫.১০)',
    group: 'finance',
    permission: 'report:financial',
    timeScoped: false,
    slug: 'client-profitability',
  },
  'company-ledger': {
    label: 'কোম্পানি লেজার (মাসিক)',
    description: 'সব আয়/ব্যয় এন্ট্রি — ক্লায়েন্ট-ট্যাগ সহ ও ছাড়া',
    group: 'finance',
    permission: 'report:financial',
    timeScoped: true,
    slug: 'company-ledger',
  },
  payments: {
    label: 'পেমেন্ট লেজার',
    description: 'রসিদ নম্বরসহ আদায় হওয়া প্রতিটি টাকার এন্ট্রি',
    group: 'finance',
    permission: 'report:financial',
    timeScoped: true,
    slug: 'payments',
  },
} as const satisfies Record<string, ReportDefinition>;

export type ReportId = keyof typeof REPORTS;

export const REPORT_IDS = Object.keys(REPORTS) as ReportId[];

export function isReportId(value: string): value is ReportId {
  return Object.prototype.hasOwnProperty.call(REPORTS, value);
}

/** "orion-payments-2026-09-09.csv" */
export function reportFilename(id: ReportId, now: Date, extension = 'csv'): string {
  const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate(),
  ).padStart(2, '0')}`;
  return `orion-${REPORTS[id].slug}-${stamp}.${extension}`;
}

/** পর্দায় দেখানোর জন্য ঘরের মান — CSV এর কাঁচা মান থেকে আলাদা */
export function formatReportCell(
  value: CsvValue,
  kind: ReportColumnKind | undefined,
  money: (n: number) => string,
): string {
  if (value === null || value === undefined || value === '') return '—';
  if (kind === 'money') return money(Number(value));
  if (kind === 'percent') return `${value}%`;
  if (kind === 'number') return new Intl.NumberFormat('en-IN').format(Number(value));
  return String(value);
}
