import { eachMonthOfInterval, endOfMonth, format, startOfMonth, subMonths } from 'date-fns';
import { LedgerType, type LedgerCategory, type Prisma, type Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { can } from '@/lib/rbac';
import {
  formatLedgerReceiptNo,
  ledgerReceiptPrefix,
  summarizeClientLedger,
  summarizeLedger,
  type ClientLedgerSummary,
  type LedgerSummary,
} from '@/lib/ledger';
import { LEDGER_CATEGORY_LABEL } from '@/lib/ledger';
import { whatsAppReceiptLink } from '@/lib/whatsapp';
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
  /** ক্লায়েন্টের সাথে ট্যাগ করা এন্ট্রি হলে সেই লিড — নইলে null (company-wide) */
  leadId: string | null;
  leadName: string | null;
  /** INCOME + রসিদ থাকলে `wa.me` deep-link, নইলে null (PRD সেকশন ৫.২) */
  whatsAppUrl: string | null;
  /** আগে পাঠানো হয়েছিল কিনা — তালিকায় "পাঠানো হয়েছে" চিহ্ন */
  whatsAppSentLabel: string | null;
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
  lead: { select: { id: true, name: true, phone: true } },
} satisfies Prisma.LedgerEntrySelect;

export type LedgerEntryRow = Prisma.LedgerEntryGetPayload<{ select: typeof ledgerEntrySelect }>;

/**
 * DB row → ভিউ।
 *
 * `wa.me` লিংকটি শুধু তখনই তৈরি হয় যখন কলার স্পষ্টভাবে `withWhatsApp` চায় —
 * কাস্টমার পোর্টালের কুয়েরিতে (`loadClientVisibleEntries`) চাওয়া হয় না, কারণ
 * রসিদ *পাঠানো* অ্যাকাউন্টসের কাজ, ক্লায়েন্টের নয়।
 */
export function toLedgerEntryView(
  row: LedgerEntryRow,
  options?: { withWhatsApp?: boolean },
): LedgerEntryView {
  const amount = Number(row.amount);
  const categoryLabel = LEDGER_CATEGORY_LABEL[row.category];
  const dateLabel = format(row.date, 'dd MMM yyyy');

  return {
    id: row.id,
    type: row.type,
    category: row.category,
    categoryLabel,
    amount,
    amountLabel: formatBDT(amount),
    dateLabel,
    note: row.note,
    receiptNo: row.receiptNo,
    clientVisible: row.clientVisible,
    createdByName: row.createdBy.name,
    leadId: row.lead?.id ?? null,
    leadName: row.lead?.name ?? null,
    whatsAppUrl:
      options?.withWhatsApp && row.type === LedgerType.INCOME && row.receiptNo && row.lead
        ? whatsAppReceiptLink({
            phone: row.lead.phone,
            clientName: row.lead.name,
            receiptNo: row.receiptNo,
            categoryLabel,
            amountLabel: formatBDT(amount),
            dateLabel,
          })
        : null,
    whatsAppSentLabel: row.whatsappSentAt ? format(row.whatsappSentAt, 'dd MMM yyyy') : null,
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
export async function loadLeadLedger(leadId: string): Promise<LeadLedger> {
  const rows = await prisma.ledgerEntry.findMany({
    where: { leadId },
    select: ledgerEntrySelect,
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
  });

  const entries = rows.map((row) => toLedgerEntryView(row, { withWhatsApp: true }));
  return { entries, summary: summarizeLedger(entries) };
}

/* --------------------------------------------------------- client view */

export type ClientLedger = {
  entries: LedgerEntryView[];
  summary: ClientLedgerSummary;
  /** Won হয়ে থাকলে সেই প্রজেক্ট — সামারি কার্ডে "কন্ট্রাক্ট" অংশটি তখনই আসে */
  project: { id: string; title: string } | null;
};

/**
 * Lead/Project ডিটেইলের **Client Ledger** ট্যাব — PRD সেকশন ৫.৬ (১)।
 *
 * `loadLeadLedger` এর সব এন্ট্রি, সঙ্গে কনস্ট্রাকশন কন্ট্রাক্টের কিস্তি ও আদায়
 * মিলিয়ে মোট billed / received / internal cost / net profit।
 *
 * শুধু `ledger:view` আছে এমন role ই ডাকে — কাস্টমার কখনো নয় (এখানে EXPENSE ও
 * থাকে)।
 */
export async function loadClientLedger(leadId: string): Promise<ClientLedger> {
  const [{ entries }, project] = await Promise.all([
    loadLeadLedger(leadId),
    prisma.project.findUnique({
      where: { leadId },
      select: {
        id: true,
        title: true,
        paymentPlan: {
          select: {
            installments: {
              select: { amount: true, payments: { select: { amountReceived: true } } },
            },
          },
        },
      },
    }),
  ]);

  const installments = project?.paymentPlan?.installments ?? [];
  const contract = {
    total: installments.reduce((sum, i) => sum + Number(i.amount), 0),
    collected: installments.reduce(
      (sum, i) => sum + i.payments.reduce((s, p) => s + Number(p.amountReceived), 0),
      0,
    ),
  };

  return {
    entries,
    summary: summarizeClientLedger(entries, contract),
    project: project ? { id: project.id, title: project.title } : null,
  };
}

/**
 * কাস্টমার পোর্টালে দেখানোর মতো এন্ট্রি — PRD সেকশন ৫.৭।
 *
 * দুটো শর্তই DB তে: `type = INCOME` ও `clientVisible = true`। EXPENSE কখনো
 * `clientVisible` হতে পারে না (`lib/ledger.ts` → `resolveClientVisible` এ
 * enforce করা), কিন্তু এখানে দ্বিতীয়বার যাচাই করা হয় — defence in depth।
 */
export async function loadClientVisibleEntries(leadId: string): Promise<LedgerEntryView[]> {
  const rows = await prisma.ledgerEntry.findMany({
    where: { leadId, type: LedgerType.INCOME, clientVisible: true },
    select: ledgerEntrySelect,
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
  });

  return rows.map((row) => toLedgerEntryView(row));
}

/* ------------------------------------------------- service bill receipt */

export type ServiceBillReceipt = {
  id: string;
  receiptNo: string;
  categoryLabel: string;
  amount: number;
  date: Date;
  note: string | null;
  issuedByName: string;
  client: {
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
  };
  /** Won হয়ে থাকলে কনস্ট্রাকশন জবটি — রসিদের "প্রজেক্ট" ঘরে */
  project: { id: string; title: string; landLocation: string | null } | null;
};

/**
 * প্রি-প্রজেক্ট সার্ভিস বিলের প্রিন্টযোগ্য রসিদ — PRD সেকশন ৫.২ ও ৫.৭
 * ("downloadable invoice/receipt (PDF) — pre-project বিল ও construction
 * installment দুটোই")।
 *
 * **নিরাপত্তা (PRD সেকশন ৪):** where-clause এ তিনটি শর্ত সবসময় থাকে —
 * `type = INCOME`, `clientVisible = true` ও একটি রসিদ নম্বর। অর্থাৎ কোনো
 * EXPENSE এর id সরাসরি URL এ বসিয়ে দিলেও কুয়েরিটি খালি ফেরত দেয়, role যাই হোক।
 * তার উপরে কাস্টমারের জন্য ownership — এন্ট্রির লিডটি তার **নিজের প্রজেক্টের**
 * লিড কিনা, সেটিও একই কুয়েরিতে (`lead.project.customer.userId`), যাতে অন্যের
 * entry id আন্দাজ করেও রসিদ খোলা না যায়।
 */
export async function loadServiceBillReceipt(
  entryId: string,
  viewer: { id: string; role: Role },
): Promise<ServiceBillReceipt | null> {
  // Admin/Accounts যেকোনো ক্লায়েন্টের রসিদ ছাপাতে পারেন (`receipt:generate`);
  // কাস্টমার শুধু নিজের প্রজেক্টের সঙ্গে বাঁধা লিডেরটি
  const ownership: Prisma.LedgerEntryWhereInput = can(viewer.role, 'receipt:generate')
    ? {}
    : { lead: { project: { customer: { userId: viewer.id } } } };

  const row = await prisma.ledgerEntry.findFirst({
    where: {
      id: entryId,
      type: LedgerType.INCOME,
      clientVisible: true,
      receiptNo: { not: null },
      ...ownership,
    },
    select: {
      id: true,
      category: true,
      amount: true,
      date: true,
      note: true,
      receiptNo: true,
      createdBy: { select: { name: true } },
      lead: {
        select: {
          name: true,
          phone: true,
          email: true,
          projectLocation: true,
          project: {
            select: {
              id: true,
              title: true,
              landLocation: true,
              customer: { select: { address: true } },
            },
          },
        },
      },
    },
  });

  if (!row?.lead || !row.receiptNo) return null;

  return {
    id: row.id,
    receiptNo: row.receiptNo,
    categoryLabel: LEDGER_CATEGORY_LABEL[row.category],
    amount: Number(row.amount),
    date: row.date,
    note: row.note,
    issuedByName: row.createdBy.name,
    client: {
      name: row.lead.name,
      phone: row.lead.phone,
      email: row.lead.email,
      // Won হয়ে থাকলে কাস্টমার প্রোফাইলের ঠিকানা, নইলে লিডের জমির অবস্থান
      address: row.lead.project?.customer.address ?? row.lead.projectLocation,
    },
    project: row.lead.project
      ? {
          id: row.lead.project.id,
          title: row.lead.project.title,
          landLocation: row.lead.project.landLocation,
        }
      : null,
  };
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

/**
 * PRD সেকশন ৫.৬ — কোম্পানি লেজারের তালিকা (ফিল্টারসহ)।
 *
 * `leadId` থাকুক বা না থাকুক — সব এন্ট্রি একসাথে; ফিল্টার দিয়ে মাস, ধরন,
 * ক্যাটেগরি বা নির্দিষ্ট ক্লায়েন্টে সীমিত করা যায়। সামারিটি **ফিল্টার করা
 * এন্ট্রিগুলোরই** (যা দেখা যাচ্ছে তারই যোগফল, নইলে বিভ্রান্তি হতো)।
 */
export type CompanyLedgerFilter = {
  from: Date;
  to: Date;
  type?: LedgerType;
  category?: LedgerCategory;
  leadId?: string;
  /** 'client' → শুধু ক্লায়েন্ট-ট্যাগ করা, 'general' → শুধু ট্যাগহীন */
  tagged?: 'client' | 'general';
  take?: number;
};

export type CompanyLedger = {
  entries: LedgerEntryView[];
  summary: CompanyLedgerSummary;
  /** ফিল্টারে মোট কতগুলো এন্ট্রি (তালিকা `take` এ কাটা পড়তে পারে) */
  totalCount: number;
};

export async function loadCompanyLedger(filter: CompanyLedgerFilter): Promise<CompanyLedger> {
  const where: Prisma.LedgerEntryWhereInput = {
    date: { gte: filter.from, lte: filter.to },
    ...(filter.type ? { type: filter.type } : {}),
    ...(filter.category ? { category: filter.category } : {}),
    ...(filter.leadId ? { leadId: filter.leadId } : {}),
    ...(filter.tagged === 'client' ? { NOT: { leadId: null } } : {}),
    ...(filter.tagged === 'general' ? { leadId: null } : {}),
  };

  const [rows, totalCount] = await Promise.all([
    prisma.ledgerEntry.findMany({
      where,
      select: ledgerEntrySelect,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: filter.take ?? 100,
    }),
    prisma.ledgerEntry.count({ where }),
  ]);

  // সামারিটি পুরো ফিল্টারের (তালিকা কাটা পড়লেও যোগফল ঠিক থাকে)
  const all = await prisma.ledgerEntry.findMany({
    where,
    select: { type: true, amount: true, leadId: true },
  });

  const summary = summarizeLedger(all.map((r) => ({ type: r.type, amount: Number(r.amount) })));

  return {
    entries: rows.map((row) => toLedgerEntryView(row, { withWhatsApp: true })),
    summary: { ...summary, generalCount: all.filter((r) => r.leadId === null).length },
    totalCount,
  };
}

/* ------------------------------------------------------ monthly trend */

export type LedgerMonth = {
  /** `2026-09` — কী হিসেবে */
  key: string;
  /** `Sep 26` — চার্টের অক্ষে */
  label: string;
  income: number;
  expense: number;
  net: number;
};

/**
 * PRD সেকশন ৫.৬ — ড্যাশবোর্ডের "মাসিক Total Income vs Total Expense"।
 * `leadId` থাকুক বা না থাকুক, সব এন্ট্রি গোনা হয় (company-wide হিসাব)।
 */
export async function loadMonthlyLedgerTrend(now: Date, months = 6): Promise<LedgerMonth[]> {
  const from = startOfMonth(subMonths(now, months - 1));
  const to = endOfMonth(now);

  const rows = await prisma.ledgerEntry.findMany({
    where: { date: { gte: from, lte: to } },
    select: { type: true, amount: true, date: true },
  });

  const buckets = new Map<string, LedgerMonth>();
  for (const month of eachMonthOfInterval({ start: from, end: to })) {
    const key = format(month, 'yyyy-MM');
    buckets.set(key, { key, label: format(month, 'MMM yy'), income: 0, expense: 0, net: 0 });
  }

  for (const row of rows) {
    const bucket = buckets.get(format(row.date, 'yyyy-MM'));
    if (!bucket) continue;
    if (row.type === LedgerType.INCOME) bucket.income += Number(row.amount);
    else bucket.expense += Number(row.amount);
  }

  return [...buckets.values()].map((bucket) => ({
    ...bucket,
    net: bucket.income - bucket.expense,
  }));
}

/* -------------------------------------------------------- lead options */

export type LedgerLeadOption = {
  id: string;
  name: string;
  /** "মোঃ রহিম — সোনাডাঙ্গা" ধরনের দ্বিতীয় লাইন */
  hint: string | null;
  /** Won হয়ে প্রজেক্ট হয়ে গেছে কিনা */
  hasProject: boolean;
};

/**
 * লেজার এন্ট্রিতে ক্লায়েন্ট ট্যাগ করার ড্রপডাউন (PRD সেকশন ৫.৬)।
 * Lost লিড বাদ — সেখানে নতুন বিল/খরচ বসানোর কথা নয়।
 */
export async function listLedgerLeadOptions(): Promise<LedgerLeadOption[]> {
  const rows = await prisma.lead.findMany({
    where: { stage: { not: 'LOST' } },
    select: {
      id: true,
      name: true,
      phone: true,
      projectLocation: true,
      project: { select: { id: true } },
    },
    orderBy: [{ updatedAt: 'desc' }],
    take: 500,
  });

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    hint: row.projectLocation ?? row.phone,
    hasProject: row.project !== null,
  }));
}
