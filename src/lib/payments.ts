import { addDays, addMonths, differenceInCalendarDays, format, startOfDay } from 'date-fns';
import type { InstallmentStatus, PaymentMethod } from '@prisma/client';

/**
 * Payment plan, installment schedule ও collection এর কনস্ট্যান্ট, লেবেল ও হিসাব —
 * PRD সেকশন ৫.৩।
 *
 * `lib/phases.ts` এর মতোই এখানে শুধু type-only Prisma import ও বিশুদ্ধ ফাংশন,
 * কারণ ফাইলটি client component (প্ল্যান বিল্ডার, পেমেন্ট এন্ট্রি ফর্ম) থেকেও
 * import হয় — `@prisma/client` runtime বা `lib/prisma` এখানে আনা যাবে না।
 * DB-নির্ভর অংশ `lib/payment-data.ts` এ।
 */

/* -------------------------------------------------------------- labels */

export const INSTALLMENT_STATUS_LABEL: Record<InstallmentStatus, string> = {
  SCHEDULED: 'নির্ধারিত',
  PARTIAL: 'আংশিক',
  PAID: 'পরিশোধিত',
  OVERDUE: 'বকেয়া',
};

/**
 * ব্যাজের রঙ — PRD সেকশন ৫.৩: Paid=সবুজ, Partial=হলুদ, Overdue=লাল, Scheduled=ধূসর।
 * light ও dark দুই থিমেই পড়া যায়।
 */
export const INSTALLMENT_STATUS_BADGE: Record<InstallmentStatus, string> = {
  SCHEDULED: 'bg-muted text-muted-foreground',
  PARTIAL: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300',
  PAID: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  OVERDUE: 'bg-destructive/15 text-destructive',
};

/** টেবিলের সারির হালকা টিন্ট — এক নজরে রঙ-কোডেড শিডিউল */
export const INSTALLMENT_STATUS_ROW: Record<InstallmentStatus, string> = {
  SCHEDULED: '',
  PARTIAL: 'bg-amber-50/70 dark:bg-amber-950/20',
  PAID: 'bg-emerald-50/70 dark:bg-emerald-950/20',
  OVERDUE: 'bg-destructive/5',
};

/** সারির বাঁ পাশের রঙিন বার (মোবাইল কার্ড ভিউতেও ব্যবহার হয়) */
export const INSTALLMENT_STATUS_ACCENT: Record<InstallmentStatus, string> = {
  SCHEDULED: 'bg-muted-foreground/30',
  PARTIAL: 'bg-amber-500',
  PAID: 'bg-emerald-600',
  OVERDUE: 'bg-destructive',
};

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  CASH: 'নগদ (Cash)',
  BANK_TRANSFER: 'ব্যাংক ট্রান্সফার',
  BKASH: 'বিকাশ (bKash)',
  NAGAD: 'নগদ (Nagad)',
  CHEQUE: 'চেক',
  OTHER: 'অন্যান্য',
};

/** এই মাধ্যমগুলোতে রেফারেন্স (TrxID/চেক নং) না থাকলে পরে হিসাব মেলানো কঠিন */
export const METHOD_NOTE_HINT: Partial<Record<PaymentMethod, string>> = {
  BANK_TRANSFER: 'ব্যাংক ও ট্রানজেকশন রেফারেন্স',
  BKASH: 'bKash TrxID',
  NAGAD: 'Nagad TrxID',
  CHEQUE: 'চেক নম্বর ও ব্যাংক',
};

/* ------------------------------------------------------------ template */

/**
 * PRD সেকশন ৫.৩ এর স্যাম্পল পেমেন্ট প্ল্যান।
 *
 * খেয়াল রাখুন: PRD টেবিলের শতাংশগুলো যোগ করলে ৯০% হয় (5+15+10+50+10)। তাই
 * হ্যান্ডওভারের কিস্তিটি এখানে **অবশিষ্ট (balance)** হিসেবে ধরা হয় — "Handover এ
 * বাকি" — যাতে প্ল্যানের যোগফল সবসময় ঠিক সেল ভ্যালুর সমান হয় এবং রাউন্ডিংয়ের
 * খুচরো টাকাও কোথাও হারিয়ে না যায়। ডিফল্ট মানগুলোতে হ্যান্ডওভারে পড়ে ২০%;
 * বিল্ডারে হার বদলে ১০% করা যায় (যেমন মাসিক ৩% বা ১৬টি কিস্তি)।
 */
export const DEFAULT_PLAN_TEMPLATE = {
  bookingPercent: 5,
  downPaymentPercent: 15,
  /** বুকিংয়ের কত দিন পরে ডাউন পেমেন্ট (PRD: "৩০ দিনের মধ্যে") */
  downPaymentDays: 30,
  agreementPercent: 10,
  /** বুকিং থেকে সেল এগ্রিমেন্ট পর্যন্ত ডিফল্ট ব্যবধান */
  agreementDays: 60,
  monthlyCount: 20,
  monthlyPercent: 2.5,
  /** এগ্রিমেন্টের কত দিন পরে প্রথম মাসিক কিস্তি */
  firstInstallmentDays: 30,
  /** শেষ মাসিক কিস্তির কত দিন পরে হ্যান্ডওভার */
  handoverDays: 30,
} as const;

export type PlanTemplateInput = {
  totalAmount: number;
  bookingDate: Date;
  bookingPercent: number;
  downPaymentPercent: number;
  downPaymentDays: number;
  agreementPercent: number;
  agreementDate: Date;
  monthlyCount: number;
  monthlyPercent: number;
  firstInstallmentDate: Date;
  handoverDate: Date;
};

export type GeneratedInstallment = {
  label: string;
  order: number;
  dueDate: Date;
  amount: number;
  /** মোট মূল্যের শতকরা হার — হ্যান্ডওভারেরটি হিসাব করে বসানো হয় */
  percentage: number;
};

/** টাকার অঙ্ক — পূর্ণসংখ্যায় (পয়সা হিসাব বাংলাদেশি রিয়েল এস্টেটে ব্যবহার হয় না) */
const taka = (value: number) => Math.round(value);

/** শতাংশ দুই দশমিক পর্যন্ত — 2.5%, 16.67% */
const pct = (part: number, total: number) =>
  total > 0 ? Math.round((part / total) * 10000) / 100 : 0;

/**
 * টেমপ্লেট থেকে পুরো installment schedule তৈরি (PRD সেকশন ৫.৩)।
 *
 * প্রতিটি কিস্তি পূর্ণ টাকায় রাউন্ড হয়, আর শেষ (হ্যান্ডওভার) কিস্তিতে অবশিষ্ট
 * পুরোটা বসে — তাই `sum(installments) === totalAmount` সবসময় সত্য।
 */
export function generateSchedule(input: PlanTemplateInput): GeneratedInstallment[] {
  const {
    totalAmount,
    bookingDate,
    bookingPercent,
    downPaymentPercent,
    downPaymentDays,
    agreementPercent,
    agreementDate,
    monthlyCount,
    monthlyPercent,
    firstInstallmentDate,
    handoverDate,
  } = input;

  const rows: GeneratedInstallment[] = [];
  const add = (label: string, dueDate: Date, percent: number) => {
    if (percent <= 0) return;
    rows.push({
      label,
      order: rows.length + 1,
      dueDate: startOfDay(dueDate),
      amount: taka((totalAmount * percent) / 100),
      percentage: percent,
    });
  };

  add('Booking Money', bookingDate, bookingPercent);
  add('Down Payment', addDays(bookingDate, downPaymentDays), downPaymentPercent);
  add('Sale Agreement Signing', agreementDate, agreementPercent);

  for (let i = 0; i < monthlyCount; i += 1) {
    add(
      `Installment ${i + 1}/${monthlyCount}`,
      addMonths(firstInstallmentDate, i),
      monthlyPercent,
    );
  }

  // হ্যান্ডওভারের কিস্তি = মোট − বাকি সব (রাউন্ডিংয়ের খুচরোসহ)
  const allocated = rows.reduce((sum, row) => sum + row.amount, 0);
  const balance = taka(totalAmount) - allocated;
  if (balance > 0) {
    rows.push({
      label: 'On Handover (balance)',
      order: rows.length + 1,
      dueDate: startOfDay(handoverDate),
      amount: balance,
      percentage: pct(balance, totalAmount),
    });
  }

  return rows;
}

/** টেমপ্লেটের হারগুলো থেকে হ্যান্ডওভারে কত শতাংশ পড়বে — বিল্ডারে live দেখানোর জন্য */
export function balancePercent(input: {
  bookingPercent: number;
  downPaymentPercent: number;
  agreementPercent: number;
  monthlyCount: number;
  monthlyPercent: number;
}): number {
  const used =
    input.bookingPercent +
    input.downPaymentPercent +
    input.agreementPercent +
    input.monthlyCount * input.monthlyPercent;
  return Math.round((100 - used) * 100) / 100;
}

/**
 * বুকিং তারিখ থেকে বাকি তারিখগুলোর ডিফল্ট — বিল্ডার খোলার সময় প্রি-ফিল হয়,
 * ব্যবহারকারী পরে বদলাতে পারেন।
 */
export function defaultPlanDates(
  bookingDate: Date,
  monthlyCount: number = DEFAULT_PLAN_TEMPLATE.monthlyCount,
) {
  const agreementDate = addDays(bookingDate, DEFAULT_PLAN_TEMPLATE.agreementDays);
  const firstInstallmentDate = addDays(agreementDate, DEFAULT_PLAN_TEMPLATE.firstInstallmentDays);
  const lastInstallmentDate = addMonths(firstInstallmentDate, Math.max(0, monthlyCount - 1));
  return {
    bookingDate,
    agreementDate,
    firstInstallmentDate,
    handoverDate: addDays(lastInstallmentDate, DEFAULT_PLAN_TEMPLATE.handoverDays),
  };
}

/* ------------------------------------------------------------ compute */

/**
 * কিস্তির কার্যকর স্ট্যাটাস।
 *
 * `lib/phases.ts` এর মতোই DB তে `Installment.status` একটি স্ন্যাপশট (aging কুয়েরির
 * সুবিধার জন্য), কিন্তু "বকেয়া" নিছক তারিখ পেরোলেই হয়ে যায় — কেউ কিছু না করলেও।
 * তাই দেখানোর সময় সবসময় আজকের তারিখ ধরে এই ফাংশনটিই চালানো হয়, আর ওভারডিউ
 * sweep একই ফাংশন দিয়ে DB তে লিখে রাখে — দুটো কখনো আলাদা নিয়মে চলে না।
 *
 * আংশিক পরিশোধিত কিস্তির due date পেরিয়ে গেলে **OVERDUE** ধরা হয় (PARTIAL নয়) —
 * কালেকশনের দৃষ্টিতে বকেয়াই বেশি জরুরি সংকেত; কত টাকা জমা পড়েছে তা সারিতেই দেখা যায়।
 */
export function computeInstallmentStatus(
  installment: { amount: number; dueDate: Date },
  paidAmount: number,
  now: Date,
): InstallmentStatus {
  if (paidAmount >= installment.amount) return 'PAID';
  if (startOfDay(installment.dueDate).getTime() < startOfDay(now).getTime()) return 'OVERDUE';
  return paidAmount > 0 ? 'PARTIAL' : 'SCHEDULED';
}

/** due date পেরিয়ে যাওয়ার পর কত দিন — বকেয়া না হলে null */
export function overdueDays(
  installment: { amount: number; dueDate: Date },
  paidAmount: number,
  now: Date,
): number | null {
  if (computeInstallmentStatus(installment, paidAmount, now) !== 'OVERDUE') return null;
  return Math.max(1, differenceInCalendarDays(startOfDay(now), startOfDay(installment.dueDate)));
}

/* -------------------------------------------------------------- aging */

/** PRD সেকশন ৫.৩ — overdue aging report এর তিনটি বালতি */
export const AGING_BUCKETS = ['0-15', '16-30', '30+'] as const;
export type AgingBucket = (typeof AGING_BUCKETS)[number];

export const AGING_BUCKET_LABEL: Record<AgingBucket, string> = {
  '0-15': '০–১৫ দিন',
  '16-30': '১৬–৩০ দিন',
  '30+': '৩০+ দিন',
};

/** বালতিভেদে রঙ — যত পুরনো বকেয়া তত গাঢ় সতর্কতা */
export const AGING_BUCKET_TONE: Record<AgingBucket, string> = {
  '0-15': 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300',
  '16-30': 'bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-300',
  '30+': 'bg-destructive/15 text-destructive',
};

export function agingBucket(days: number): AgingBucket {
  if (days <= 15) return '0-15';
  if (days <= 30) return '16-30';
  return '30+';
}

export type AgingRow = {
  bucket: AgingBucket;
  /** বকেয়া কিস্তির সংখ্যা */
  count: number;
  /** কতগুলো আলাদা সেল/অ্যাকাউন্ট (PRD এর "7 accounts") */
  accounts: number;
  /** এখনো অনাদায়ী অঙ্ক (কিস্তির মোট নয় — যা বাকি) */
  amount: number;
};

/** খালি রিপোর্টেও তিনটি বালতিই দেখানো হয় (০ সহ) — তাই এই ভিত্তি */
export function emptyAging(): AgingRow[] {
  return AGING_BUCKETS.map((bucket) => ({ bucket, count: 0, accounts: 0, amount: 0 }));
}

/* ---------------------------------------------------------- serialize */

/** শিডিউল টেবিলের ইনপুট — Date/Decimal ছাড়া, client এ পাঠানোর উপযোগী */
export type PaymentView = {
  id: string;
  receiptNo: string;
  amount: number;
  method: PaymentMethod;
  note: string | null;
  /** server এ ফরম্যাট করা — client এ করলে TZ ভেদে hydration mismatch হতো */
  paidAtLabel: string;
  /** epoch ms — পেমেন্ট হিস্টরি সাজাতে (লেবেল দিয়ে সাজানো যেত না) */
  paidAtTime: number;
  receivedByName: string;
};

export type InstallmentView = {
  id: string;
  label: string;
  order: number;
  /** "১২ জানু ২০২৭" নয় — date-fns এর ইংরেজি ফরম্যাট, বাকি অ্যাপের মতোই */
  dueDateLabel: string;
  /** `<input type="date">` এ বসানোর জন্য — এডিট মোডে লাগে */
  dueDateValue: string;
  amount: number;
  percentage: number | null;
  paidAmount: number;
  remaining: number;
  /** আজকের তারিখ ধরে হিসাব করা কার্যকর স্ট্যাটাস */
  status: InstallmentStatus;
  overdueDays: number | null;
  payments: PaymentView[];
};

export type PlanSummary = {
  total: number;
  collected: number;
  /** এখনো আদায় হয়নি — total − collected */
  outstanding: number;
  overdueAmount: number;
  overdueCount: number;
  paidCount: number;
  count: number;
  /** আদায়ের হার (%) */
  collectedPercent: number;
  /** পরবর্তী পরিশোধযোগ্য কিস্তি (বকেয়াসহ, order অনুযায়ী প্রথম অসম্পূর্ণ) */
  next: { label: string; dueDateLabel: string; remaining: number } | null;
};

export function summarizeInstallments(installments: InstallmentView[]): PlanSummary {
  const total = installments.reduce((sum, i) => sum + i.amount, 0);
  const collected = installments.reduce((sum, i) => sum + i.paidAmount, 0);
  const overdue = installments.filter((i) => i.status === 'OVERDUE');
  const next = installments.find((i) => i.status !== 'PAID') ?? null;

  return {
    total,
    collected,
    outstanding: total - collected,
    overdueAmount: overdue.reduce((sum, i) => sum + i.remaining, 0),
    overdueCount: overdue.length,
    paidCount: installments.filter((i) => i.status === 'PAID').length,
    count: installments.length,
    collectedPercent: total > 0 ? Math.round((collected / total) * 100) : 0,
    next: next
      ? { label: next.label, dueDateLabel: next.dueDateLabel, remaining: next.remaining }
      : null,
  };
}

/** DB row (Decimal সহ) → `InstallmentView` */
export type InstallmentRow = {
  id: string;
  label: string;
  order: number;
  dueDate: Date;
  amount: { toString(): string };
  percentage: { toString(): string } | null;
  payments: {
    id: string;
    receiptNo: string;
    amountReceived: { toString(): string };
    method: PaymentMethod;
    note: string | null;
    paidAt: Date;
    receivedBy: { name: string };
  }[];
};

export function toInstallmentView(row: InstallmentRow, now: Date): InstallmentView {
  const amount = Number(row.amount);
  const paidAmount = row.payments.reduce((sum, p) => sum + Number(p.amountReceived), 0);

  return {
    id: row.id,
    label: row.label,
    order: row.order,
    dueDateLabel: format(row.dueDate, 'dd MMM yyyy'),
    dueDateValue: format(row.dueDate, 'yyyy-MM-dd'),
    amount,
    percentage: row.percentage === null ? null : Number(row.percentage),
    paidAmount,
    // অতিরিক্ত আদায় হলে (রাউন্ডিং/অগ্রিম) বাকি ঋণাত্মক দেখানো হবে না
    remaining: Math.max(0, amount - paidAmount),
    status: computeInstallmentStatus({ amount, dueDate: row.dueDate }, paidAmount, now),
    overdueDays: overdueDays({ amount, dueDate: row.dueDate }, paidAmount, now),
    payments: row.payments.map((p) => ({
      id: p.id,
      receiptNo: p.receiptNo,
      amount: Number(p.amountReceived),
      method: p.method,
      note: p.note,
      paidAtLabel: format(p.paidAt, 'dd MMM yyyy, h:mm a'),
      paidAtTime: p.paidAt.getTime(),
      receivedByName: p.receivedBy.name,
    })),
  };
}

/* ---------------------------------------------------- payment history */

/** পেমেন্ট হিস্টরির একটি সারি — কোন কিস্তির বিপরীতে টাকা এসেছিল তা সহ */
export type PaymentHistoryItem = PaymentView & {
  installmentId: string;
  installmentLabel: string;
};

/**
 * শিডিউলের সব কিস্তির পেমেন্টগুলো একটি তালিকায় — সবচেয়ে সাম্প্রতিকটি আগে।
 *
 * PRD সেকশন ৫.৪ — কাস্টমার "কবে কত দিয়েছি" এক নজরে দেখেন, আর প্রতিটির পাশে
 * রসিদের লিংক থাকে। কিস্তি-ভিত্তিক ভিউটা `PaymentScheduleTable` এই দেয়, তাই
 * এখানে ক্রমটা তারিখের।
 */
export function paymentHistory(installments: InstallmentView[]): PaymentHistoryItem[] {
  return installments
    .flatMap((installment) =>
      installment.payments.map((payment) => ({
        ...payment,
        installmentId: installment.id,
        installmentLabel: installment.label,
      })),
    )
    .sort((a, b) => b.paidAtTime - a.paidAtTime);
}

/* ------------------------------------------------------------ receipt */

/**
 * রসিদ নম্বর — "ORB-2026-000123"। সর্বশেষ ক্রমিক DB থেকে এসে এখানে ফরম্যাট হয়
 * (`lib/payment-data.ts` → `nextReceiptNo`)। বছরভিত্তিক সিরিজ, কারণ অ্যাকাউন্টসে
 * বছর শেষে হিসাব মেলানো সহজ হয়।
 */
export const RECEIPT_PREFIX = 'ORB';

export function formatReceiptNo(year: number, serial: number): string {
  return `${RECEIPT_PREFIX}-${year}-${String(serial).padStart(6, '0')}`;
}

/**
 * টাকার অঙ্ক কথায় — "Taka Twenty Five Lakh Only"।
 *
 * বাংলাদেশি রসিদে অঙ্কের পাশে কথায় লেখা প্রথাগত (এবং ঘষামাজা ঠেকায়)। ভারতীয়
 * উপমহাদেশের গ্রুপিং — crore / lakh / thousand। ইংরেজিতে রাখা হয়েছে কারণ রসিদটি
 * ব্যাংক/আইনি কাজে ব্যবহৃত হতে পারে।
 */
const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen',
  'Eighteen', 'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

/** ০–৯৯৯ → কথায় */
function underThousand(value: number): string {
  if (value === 0) return '';
  if (value < 20) return ONES[value];
  if (value < 100) {
    const rest = value % 10;
    return `${TENS[Math.floor(value / 10)]}${rest ? ` ${ONES[rest]}` : ''}`;
  }
  const rest = value % 100;
  return `${ONES[Math.floor(value / 100)]} Hundred${rest ? ` ${underThousand(rest)}` : ''}`;
}

export function amountInWords(amount: number): string {
  const value = Math.round(Math.abs(amount));
  if (value === 0) return 'Taka Zero Only';

  const groups: [number, string][] = [
    [10_000_000, 'Crore'],
    [100_000, 'Lakh'],
    [1_000, 'Thousand'],
  ];

  let remaining = value;
  const parts: string[] = [];

  for (const [unit, name] of groups) {
    const count = Math.floor(remaining / unit);
    if (count > 0) {
      // ১০০ কোটির উপরে গেলে কোটির ঘরেই তিন অঙ্কের বেশি বসে — তাই recursion
      parts.push(`${count >= 1000 ? amountInWordsRaw(count) : underThousand(count)} ${name}`);
      remaining %= unit;
    }
  }

  if (remaining > 0) parts.push(underThousand(remaining));

  return `Taka ${parts.join(' ')} Only`;
}

/** ভেতরের ব্যবহার — "Taka"/"Only" ছাড়া */
function amountInWordsRaw(value: number): string {
  return amountInWords(value).replace(/^Taka /, '').replace(/ Only$/, '');
}
