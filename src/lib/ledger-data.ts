import { format } from 'date-fns';
import { LedgerType, type LedgerCategory, type Prisma, type Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { can } from '@/lib/rbac';
import {
  formatLedgerReceiptNo,
  ledgerReceiptPrefix,
  summarizeLedger,
  whatsAppReceiptLink,
  type LedgerSummary,
} from '@/lib/ledger';
import { LEDGER_CATEGORY_LABEL } from '@/lib/ledger';
import { formatBDT } from '@/lib/utils';

/**
 * LedgerEntry এর DB অংশ — PRD সেকশন ৫.২ (pre-project billing) ও ৫.৬ (company ledger)।
 *
 * এটি server-only (`lib/prisma` import করে); বিশুদ্ধ লেবেল ও হিসাব `lib/ledger.ts` এ।
 *
 * **নিরাপত্তা নীতি (PRD সেকশন ৪):** internal cost/expense কখনোই customer role এর
 * কোনো ভিউতে যাবে না। তাই কাস্টমারের কুয়েরিটি (`loadClientVisibleEntries`) DB
 * লেভেলেই `type: INCOME` **এবং** `clientVisible: true` — দুটোই চায়; UI তে লুকানোর
 * উপর ভরসা করা হয় না।
 */

/* ---------------------------------------------------------------- view */

export type LedgerEntryView = {
  id: string;
  type: LedgerType;
  category: LedgerCategory;
  categoryLabel: string;
  amount: number;
  amountLabel: string;
  /** server এ ফরম্যাট করা — client এ করলে TZ ভেদে hydration mismatch হতো */
  dateLabel: string;
  note: string | null;
  receiptNo: string | null;
  clientVisible: boolean;
  createdByName: string;
  /** INCOME + রসিদ থাকলে `wa.me` deep-link, নইলে null (PRD সেকশন ৫.২) */
  whatsAppUrl: string | null;
};

export const ledgerEntrySelect = {
  id: true,
  type: true,
  category: true,
  amount: true,
  date: true,
  note: true,
  receiptNo: true,
  clientVisible: true,
  whatsappSentAt: true,
  createdBy: { select: { name: true } },
} satisfies Prisma.LedgerEntrySelect;

export type LedgerEntryRow = Prisma.LedgerEntryGetPayload<{ select: typeof ledgerEntrySelect }>;

export function toLedgerEntryView(
  row: LedgerEntryRow,
  client?: { name: string; phone: string | null },
): LedgerEntryView {
  const amount = Number(row.amount);
  const categoryLabel = LEDGER_CATEGORY_LABEL[row.category];

  return {
    id: row.id,
    type: row.type,
    category: row.category,
    categoryLabel,
    amount,
    amountLabel: formatBDT(amount),
    dateLabel: format(row.date, 'dd MMM yyyy'),
    note: row.note,
    receiptNo: row.receiptNo,
    clientVisible: row.clientVisible,
    createdByName: row.createdBy.name,
    whatsAppUrl:
      row.type === LedgerType.INCOME && row.receiptNo && client
        ? whatsAppReceiptLink({
            phone: client.phone,
            clientName: client.name,
            receiptNo: row.receiptNo,
            categoryLabel,
            amountLabel: formatBDT(amount),
            dateLabel: format(row.date, 'dd MMM yyyy'),
          })
        : null,
  };
}

/* --------------------------------------------------------------- load */

export type LeadLedger = {
  entries: LedgerEntryView[];
  summary: LedgerSummary;
};

/**
 * এক লিডের (ক্লায়েন্টের) পুরো লেজার — বিল ও ইন্টারনাল কস্ট দুটোই।
 * শুধু `ledger:view` আছে এমন role এই ফাংশনটি ডাকে (Admin/Accounts/Marketing);
 * কাস্টমার কখনো নয় — তার জন্য `loadClientVisibleEntries`।
 */
export async function loadLeadLedger(
  leadId: string,
  client: { name: string; phone: string | null },
): Promise<LeadLedger> {
  const rows = await prisma.ledgerEntry.findMany({
    where: { leadId },
    select: ledgerEntrySelect,
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
  });

  const entries = rows.map((row) => toLedgerEntryView(row, client));
  return { entries, summary: summarizeLedger(entries) };
}

/**
 * কাস্টমার পোর্টালে দেখানোর মতো এন্ট্রি — PRD সেকশন ৫.৭।
 *
 * দুটো শর্তই DB তে: `type = INCOME` ও `clientVisible = true`। EXPENSE কখনো
 * `clientVisible` হতে পারে না (`lib/ledger-write.ts` এ enforce করা), কিন্তু
 * এখানে দ্বিতীয়বার যাচাই করা হয় — defence in depth।
 */
export async function loadClientVisibleEntries(leadId: string): Promise<LedgerEntryView[]> {
  const rows = await prisma.ledgerEntry.findMany({
    where: { leadId, type: LedgerType.INCOME, clientVisible: true },
    select: ledgerEntrySelect,
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
  });

  return rows.map((row) => toLedgerEntryView(row));
}

/** এই ইউজার কি লেজার এন্ট্রি *তৈরি* করতে পারবে? (Admin/Accounts — PRD সেকশন ৪) */
export function canManageLedger(role: Role): boolean {
  return can(role, 'ledger:manage');
}

/* ------------------------------------------------------------ receipt */

/**
 * পরবর্তী রসিদ নম্বর — "RCT-260911-0007" (PRD সেকশন ৫.২)।
 *
 * তারিখভিত্তিক সিরিজ; সেই দিনের সর্বশেষটি খুঁজতে string sort ই যথেষ্ট, কারণ
 * ক্রমিক অংশ শূন্য দিয়ে ৪ ঘরে প্যাড করা। `receiptNo` unique — একই সঙ্গে দুটি
 * এন্ট্রি এলে একটি ব্যর্থ হবে, কলার তখন আবার চেষ্টা করে।
 */
export async function nextLedgerReceiptNo(date = new Date()): Promise<string> {
  const prefix = ledgerReceiptPrefix(date);
  const last = await prisma.ledgerEntry.findFirst({
    where: { receiptNo: { startsWith: prefix } },
    orderBy: { receiptNo: 'desc' },
    select: { receiptNo: true },
  });

  const serial = last ? Number(last.receiptNo?.split('-')[2] ?? '0') : 0;
  return formatLedgerReceiptNo(date, (Number.isFinite(serial) ? serial : 0) + 1);
}

/* ------------------------------------------------------- company view */

export type CompanyLedgerSummary = LedgerSummary & {
  /** ক্লায়েন্টের সাথে ট্যাগ করা নয় এমন এন্ট্রি (office rent, salary …) */
  generalCount: number;
};

/** PRD সেকশন ৫.৬ — Main Company Ledger এর মাসিক সামারি */
export async function loadCompanyLedgerSummary(
  from: Date,
  to: Date,
): Promise<CompanyLedgerSummary> {
  const rows = await prisma.ledgerEntry.findMany({
    where: { date: { gte: from, lte: to } },
    select: { type: true, amount: true, leadId: true },
  });

  const summary = summarizeLedger(rows.map((r) => ({ type: r.type, amount: Number(r.amount) })));
  return { ...summary, generalCount: rows.filter((r) => r.leadId === null).length };
}
