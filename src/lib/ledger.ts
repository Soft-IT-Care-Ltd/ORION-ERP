import type { LedgerCategory, LedgerType } from '@prisma/client';

/**
 * Client-wise ও company-wide accounting — PRD সেকশন ৫.২ ও ৫.৬।
 *
 * `lib/leads.ts` এর মতোই এখানে শুধু type-only Prisma import ও বিশুদ্ধ ফাংশন,
 * কারণ ফাইলটি Lead detail এর Billing ট্যাব (client component) থেকেও import হয়।
 * DB কুয়েরিগুলো `lib/ledger-data.ts` এ।
 */

export const LEDGER_TYPE_LABEL: Record<LedgerType, string> = {
  INCOME: 'আয় (ক্লায়েন্টকে বিল)',
  EXPENSE: 'খরচ (ইন্টারনাল কস্ট)',
};

/** ছোট জায়গায় (টেবিল সেল, ব্যাজ) — এক শব্দের রূপ */
export const LEDGER_TYPE_SHORT: Record<LedgerType, string> = {
  INCOME: 'আয়',
  EXPENSE: 'খরচ',
};

export const LEDGER_TYPES = Object.keys(LEDGER_TYPE_LABEL) as LedgerType[];

export const LEDGER_TYPE_BADGE: Record<LedgerType, string> = {
  INCOME: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  EXPENSE: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300',
};

export const LEDGER_CATEGORY_LABEL: Record<LedgerCategory, string> = {
  SITE_VISIT: 'সাইট ভিজিট',
  DIGITAL_SURVEY: 'ডিজিটাল সার্ভে',
  SOIL_TEST: 'সয়েল টেস্ট',
  DESIGN: 'ডিজাইন',
  GOVT_APPROVAL: 'সরকারি অনুমোদন',
  CONSTRUCTION_INSTALLMENT: 'কনস্ট্রাকশন কিস্তি',
  MATERIAL_COST: 'ম্যাটেরিয়াল খরচ',
  LABOR_COST: 'শ্রমিক খরচ',
  OFFICE_OVERHEAD: 'অফিস ওভারহেড',
  OTHER: 'অন্যান্য',
};

export const LEDGER_CATEGORIES = Object.keys(LEDGER_CATEGORY_LABEL) as LedgerCategory[];

/**
 * Lead পর্যায়ের (pre-project) বিলিং ক্যাটেগরি — PRD সেকশন ৫.২ এর সার্ভিস টেবিল।
 * Lead detail এর Billing ট্যাবে এই কটাই ড্রপডাউনে আসে; ম্যাটেরিয়াল/শ্রমিক/অফিস
 * খরচ প্রজেক্ট ও কোম্পানি লেজারের বিষয় (সেকশন ৫.৬)।
 */
/**
 * কোম্পানি লেজারের ফর্মে যে ক্যাটেগরিগুলো বাছা যায় (PRD সেকশন ৫.৬)।
 *
 * `CONSTRUCTION_INSTALLMENT` ইচ্ছে করেই বাদ — কনস্ট্রাকশন কিস্তির টাকা
 * `Payment` মডিউলে ওঠে (PRD সেকশন ৫.৫), লেজারে হাতে বসালে একই টাকা দুবার
 * গোনা হতো।
 */
export const LEDGER_FORM_CATEGORIES = [
  'SITE_VISIT',
  'DIGITAL_SURVEY',
  'SOIL_TEST',
  'DESIGN',
  'GOVT_APPROVAL',
  'MATERIAL_COST',
  'LABOR_COST',
  'OFFICE_OVERHEAD',
  'OTHER',
] as const satisfies readonly LedgerCategory[];

export const PRE_PROJECT_CATEGORIES = [
  'SITE_VISIT',
  'DIGITAL_SURVEY',
  'SOIL_TEST',
  'DESIGN',
  'GOVT_APPROVAL',
  'OTHER',
] as const satisfies readonly LedgerCategory[];

/* --------------------------------------------------------------- receipt */

/** `RCT-260911-0007` — তারিখভিত্তিক সিরিজ (PRD সেকশন ৫.২) */
export function formatLedgerReceiptNo(date: Date, sequence: number): string {
  const yy = String(date.getFullYear() % 100).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `RCT-${yy}${mm}${dd}-${String(sequence).padStart(4, '0')}`;
}

/** `RCT-260911-0007` এর সেই দিনের prefix — পরবর্তী ক্রম খুঁজতে */
export function ledgerReceiptPrefix(date: Date): string {
  return formatLedgerReceiptNo(date, 0).slice(0, -4);
}

/* ------------------------------------------------------- client access */

/**
 * **ক্রিটিক্যাল নিয়ম (PRD সেকশন ৪ ও ৫.৬):** একটি লেজার এন্ট্রি ক্লায়েন্ট দেখতে
 * পাবেন কিনা।
 *
 * শুধু তখনই `true`, যখন এন্ট্রিটি **আয় (INCOME)** এবং **একটি ক্লায়েন্টের সাথে
 * ট্যাগ করা**। অর্থাৎ:
 *  - EXPENSE → সবসময় `false` (Orion এর ইন্টারনাল খরচ ক্লায়েন্ট কখনো দেখবেন না),
 *  - leadId ছাড়া general entry → `false` (কারো পোর্টালে দেখানোর প্রশ্নই নেই)।
 *
 * মানটি কখনো ফর্ম/ইনপুট থেকে আসে না — server action এই ফাংশন দিয়েই ঠিক করে,
 * তাই সরাসরি অ্যাকশন ডেকেও `clientVisible: true` পাঠানো যায় না। কাস্টমারের
 * কুয়েরিতে (`lib/ledger-data.ts` → `loadClientVisibleEntries`) `type=INCOME` ও
 * `clientVisible=true` দুটোই আবার যাচাই হয় — defence in depth।
 */
export function resolveClientVisible(type: LedgerType, leadId: string | null): boolean {
  return type === 'INCOME' && leadId !== null;
}

/* -------------------------------------------------------------- summary */

export type LedgerSummary = {
  /** ক্লায়েন্টকে মোট কত বিল করা হয়েছে (income sum) */
  billed: number;
  /** Orion এর মোট ইন্টারনাল খরচ (expense sum) */
  cost: number;
  /** billed − cost */
  net: number;
  incomeCount: number;
  expenseCount: number;
};

export function summarizeLedger(
  entries: { type: LedgerType; amount: number }[],
): LedgerSummary {
  let billed = 0;
  let cost = 0;
  let incomeCount = 0;
  let expenseCount = 0;

  for (const entry of entries) {
    if (entry.type === 'INCOME') {
      billed += entry.amount;
      incomeCount += 1;
    } else {
      cost += entry.amount;
      expenseCount += 1;
    }
  }

  return { billed, cost, net: billed - cost, incomeCount, expenseCount };
}

/* ------------------------------------------------- client-wise summary */

/**
 * PRD সেকশন ৫.৬ — ক্লায়েন্ট প্রোফাইলের "মোট billed, মোট received, মোট internal
 * cost, net profit/loss"।
 *
 * ক্লায়েন্টের হিসাব দুই জায়গা থেকে আসে:
 *  ১. `LedgerEntry` — Won হওয়ার আগের সার্ভিস বিল (INCOME; রসিদ কাটা মানেই টাকা
 *     হাতে এসেছে, তাই এগুলো billed ও received দুটোতেই যায়) ও ইন্টারনাল খরচ
 *     (EXPENSE)।
 *  ২. `PaymentPlan` — কনস্ট্রাকশন কন্ট্রাক্টের কিস্তি (billed = প্ল্যানের মোট,
 *     received = আদায় হওয়া টাকা)।
 *
 * `net` = billed − cost (PRD সেকশন ৫.১০ এর "billed − cost = margin"); এখনো
 * অনাদায়ী টাকা থাকলে সেটি `outstanding` এ আলাদা দেখানো হয়।
 */
export type ClientLedgerSummary = LedgerSummary & {
  /** pre-project সার্ভিস বিল (ledger income) */
  serviceBilled: number;
  /** কনস্ট্রাকশন কন্ট্রাক্টে মোট কিস্তি */
  contractBilled: number;
  /** কনস্ট্রাকশন কিস্তিতে আদায় */
  contractCollected: number;
  /** মোট বিল — সার্ভিস + কন্ট্রাক্ট */
  totalBilled: number;
  /** মোট আদায় — সার্ভিস রসিদ + কিস্তির পেমেন্ট */
  totalReceived: number;
  /** এখনো বাকি — totalBilled − totalReceived */
  outstanding: number;
  /** মোট বিল − ইন্টারনাল কস্ট */
  netProfit: number;
};

export function summarizeClientLedger(
  entries: { type: LedgerType; amount: number }[],
  contract: { total: number; collected: number } = { total: 0, collected: 0 },
): ClientLedgerSummary {
  const ledger = summarizeLedger(entries);
  const totalBilled = ledger.billed + contract.total;
  const totalReceived = ledger.billed + contract.collected;

  return {
    ...ledger,
    serviceBilled: ledger.billed,
    contractBilled: contract.total,
    contractCollected: contract.collected,
    totalBilled,
    totalReceived,
    outstanding: Math.max(0, totalBilled - totalReceived),
    netProfit: totalBilled - ledger.cost,
  };
}
