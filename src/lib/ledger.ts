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

/* ------------------------------------------------------------- WhatsApp */

/**
 * PRD সেকশন ৫.২ — MVP তে রিসিট `wa.me` deep-link দিয়ে পাঠানো হয় (prefilled
 * মেসেজ, PDF ম্যানুয়ালি অ্যাটাচ)। পরের ফেজে 360dialog API দিয়ে auto-send।
 *
 * `wa.me` শুধু অঙ্ক নেয় — `+`, স্পেস, ড্যাশ সব বাদ দিতে হয়।
 */
export function whatsAppDigits(phone: string | null | undefined): string | null {
  const digits = (phone ?? '').replace(/\D/g, '');
  return digits.length >= 8 ? digits : null;
}

export function whatsAppReceiptLink(params: {
  phone: string | null | undefined;
  clientName: string;
  receiptNo: string;
  categoryLabel: string;
  amountLabel: string;
  dateLabel: string;
  companyName?: string;
}): string | null {
  const digits = whatsAppDigits(params.phone);
  if (!digits) return null;

  const company = params.companyName ?? 'Orion Builders';
  const text = [
    `আসসালামু আলাইকুম ${params.clientName},`,
    `${company} — পেমেন্ট রসিদ`,
    `রসিদ নম্বর: ${params.receiptNo}`,
    `সার্ভিস: ${params.categoryLabel}`,
    `পরিমাণ: ${params.amountLabel}`,
    `তারিখ: ${params.dateLabel}`,
    '',
    'ধন্যবাদ।',
  ].join('\n');

  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
