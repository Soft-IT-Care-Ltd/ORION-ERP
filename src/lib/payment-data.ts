import { endOfMonth, format, startOfDay, startOfMonth } from 'date-fns';
import { InstallmentStatus, type Prisma, type Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { can } from '@/lib/rbac';
import {
  agingBucket,
  computeInstallmentStatus,
  emptyAging,
  formatReceiptNo,
  summarizeInstallments,
  toInstallmentView,
  type AgingRow,
  type InstallmentView,
  type PlanSummary,
} from '@/lib/payments';

/**
 * Payment plan / collection এর DB অংশ — Admin, Accounts ও Customer, তিন প্যানেলেই
 * একই কুয়েরি লাগে, তাই এক জায়গায় (`lib/phase-data.ts` এর মতো)।
 *
 * এটি server-only (`lib/prisma` import করে); বিশুদ্ধ হিসাব ও লেবেল `lib/payments.ts` এ।
 */

type Actor = { id: string; role: Role };

/* --------------------------------------------------------------- scope */

/**
 * বিলিং-লেভেল ownership — PRD সেকশন ৪: ADMIN ও ACCOUNTS সব প্রজেক্টের হিসাব
 * দেখেন, CUSTOMER শুধু নিজেরটা (read-only)।
 *
 * `lib/lead-access.ts` / `lib/project-access.ts` এর মতোই প্রতিটি কুয়েরিতে এই
 * where-clause spread করতে হবে — নইলে অন্যের প্রজেক্ট id গেস করে দেখে ফেলা যেত।
 * (`projectScope` ইঞ্জিনিয়ারের জন্য, এটি অ্যাকাউন্টস/কাস্টমারের জন্য — দুটোর
 * নিয়ম আলাদা, তাই আলাদা ফাংশন।)
 */
export function billingScope(user: Actor): Prisma.ProjectWhereInput {
  if (can(user.role, 'paymentPlan:manage')) return {};
  return { customer: { userId: user.id } };
}

/* -------------------------------------------------------------- select */

/** শিডিউল টেবিলের জন্য দরকারি ফিল্ডগুলো — সব প্যানেলে একই select */
export const installmentSelect = {
  id: true,
  label: true,
  order: true,
  dueDate: true,
  amount: true,
  percentage: true,
  phaseId: true,
  phase: { select: { name: true } },
  payments: {
    select: {
      id: true,
      receiptNo: true,
      amountReceived: true,
      method: true,
      note: true,
      paidAt: true,
      receivedBy: { select: { name: true } },
    },
    orderBy: { paidAt: 'asc' },
  },
} satisfies Prisma.InstallmentSelect;

/** প্রজেক্ট ও কাস্টমারের পরিচিতি — শিডিউল হেডার ও রসিদে যা দেখানো হয় */
export const projectHeaderSelect = {
  id: true,
  title: true,
  landLocation: true,
  buildingType: true,
  floors: true,
  totalSqft: true,
  ratePerSqft: true,
  totalContractValue: true,
  startDate: true,
  status: true,
  createdAt: true,
  lead: { select: { id: true, name: true, phone: true } },
  customer: {
    select: {
      id: true,
      address: true,
      user: { select: { id: true, name: true, phone: true, email: true } },
    },
  },
} satisfies Prisma.ProjectSelect;

export type ProjectHeader = Prisma.ProjectGetPayload<{ select: typeof projectHeaderSelect }>;

/* ---------------------------------------------------------- load plan */

export type ProjectPlan = {
  planId: string | null;
  installments: InstallmentView[];
  summary: PlanSummary;
};

/**
 * একটি প্রজেক্টের পুরো পেমেন্ট শিডিউল। প্ল্যান এখনো তৈরি না হলে `planId` null ও
 * তালিকা খালি — UI তখন "প্ল্যান তৈরি করুন" দেখায়।
 */
export async function loadProjectPlan(projectId: string, now: Date): Promise<ProjectPlan> {
  const plan = await prisma.paymentPlan.findUnique({
    where: { projectId },
    select: {
      id: true,
      installments: { select: installmentSelect, orderBy: [{ order: 'asc' }, { dueDate: 'asc' }] },
    },
  });

  const installments = (plan?.installments ?? []).map((row) => toInstallmentView(row, now));

  return {
    planId: plan?.id ?? null,
    installments,
    summary: summarizeInstallments(installments),
  };
}

/** ইউজার এই প্রজেক্টের হিসাব দেখতে পারবে কি না যাচাই করে হেডার দেয় — না পারলে null */
export async function findScopedProjectHeader(
  user: Actor,
  projectId: string,
): Promise<ProjectHeader | null> {
  return prisma.project.findFirst({
    where: { id: projectId, ...billingScope(user) },
    select: projectHeaderSelect,
  });
}

/* ------------------------------------------------- overdue detection */

/**
 * ওভারডিউ ডিটেকশন (PRD সেকশন ৫.৫)।
 *
 * due date পেরিয়ে গেছে অথচ পুরো টাকা আসেনি — এমন কিস্তিকে OVERDUE লেখা হয়।
 * উল্টোটাও হয়: due date পিছিয়ে দিলে বা টাকা জমা পড়লে স্ট্যাটাস আবার ঠিক হয়ে যায়।
 * হিসাবটা `computeInstallmentStatus` ই করে — অর্থাৎ UI যা দেখায় আর DB তে যা লেখা
 * থাকে, দুটোর নিয়ম এক।
 *
 * PAID কিস্তি বাদ — সেগুলো বদলানোর একমাত্র উপায় পেমেন্ট মুছে ফেলা, যা সিস্টেমে নেই।
 * cron ও on-demand (ড্যাশবোর্ড লোড / "এখনই চালান" বোতাম) — দুই জায়গা থেকেই চলে।
 */
export async function markOverdueInstallments(now = new Date()) {
  const rows = await prisma.installment.findMany({
    where: { status: { not: InstallmentStatus.PAID } },
    select: {
      id: true,
      amount: true,
      dueDate: true,
      status: true,
      payments: { select: { amountReceived: true } },
    },
  });

  // একই লক্ষ্য-স্ট্যাটাসের কিস্তিগুলো একসাথে আপডেট — সারি-প্রতি একটি কুয়েরি নয়
  const changes = new Map<InstallmentStatus, string[]>();
  for (const row of rows) {
    const paid = row.payments.reduce((sum, p) => sum + Number(p.amountReceived), 0);
    const next = computeInstallmentStatus(
      { amount: Number(row.amount), dueDate: row.dueDate },
      paid,
      now,
    );
    if (next === row.status) continue;
    const list = changes.get(next);
    if (list) list.push(row.id);
    else changes.set(next, [row.id]);
  }

  if (changes.size > 0) {
    await prisma.$transaction(
      [...changes.entries()].map(([status, ids]) =>
        prisma.installment.updateMany({ where: { id: { in: ids } }, data: { status } }),
      ),
    );
  }

  const newlyOverdue = changes.get(InstallmentStatus.OVERDUE)?.length ?? 0;
  const updated = [...changes.values()].reduce((sum, ids) => sum + ids.length, 0);

  return { scanned: rows.length, updated, newlyOverdue };
}

/* ---------------------------------------------------- aging report */

export type OverdueRow = {
  installmentId: string;
  projectId: string;
  label: string;
  /** server এ ফরম্যাট করা — client এ করলে TZ ভেদে hydration mismatch হতো */
  dueDateLabel: string;
  overdueDays: number;
  bucket: ReturnType<typeof agingBucket>;
  amount: number;
  paidAmount: number;
  remaining: number;
  customerName: string;
  customerPhone: string | null;
  projectTitle: string;
};

export type AgingReport = {
  buckets: AgingRow[];
  rows: OverdueRow[];
  totalAmount: number;
  totalCount: number;
  /** কতগুলো আলাদা প্রজেক্ট/অ্যাকাউন্ট বকেয়া (PRD এর "7 accounts") */
  totalAccounts: number;
};

/**
 * PRD সেকশন ৫.৫ — overdue aging report (0-15 / 16-30 / 30+ দিন)।
 * "amount" মানে অনাদায়ী অঙ্ক (কিস্তির মোট নয়) — আংশিক আদায় বাদ দিয়ে যা বাকি।
 */
export async function loadAgingReport(now = new Date()): Promise<AgingReport> {
  const rows = await prisma.installment.findMany({
    where: { dueDate: { lt: startOfDay(now) }, status: { not: InstallmentStatus.PAID } },
    select: {
      id: true,
      label: true,
      dueDate: true,
      amount: true,
      payments: { select: { amountReceived: true } },
      paymentPlan: {
        select: {
          project: {
            select: {
              id: true,
              title: true,
              customer: { select: { user: { select: { name: true, phone: true } } } },
            },
          },
        },
      },
    },
    orderBy: { dueDate: 'asc' },
  });

  const buckets = emptyAging();
  const bucketAccounts = new Map<string, Set<string>>();
  const accounts = new Set<string>();
  const detail: OverdueRow[] = [];

  for (const row of rows) {
    const amount = Number(row.amount);
    const paidAmount = row.payments.reduce((sum, p) => sum + Number(p.amountReceived), 0);
    const remaining = amount - paidAmount;
    // অতিরিক্ত/সমান আদায় হয়ে গেলে স্ট্যাটাস এখনো বদলায়নি — রিপোর্টে আসবে না
    if (remaining <= 0) continue;

    const days = Math.max(
      1,
      Math.round((startOfDay(now).getTime() - startOfDay(row.dueDate).getTime()) / 86_400_000),
    );
    const bucket = agingBucket(days);
    const project = row.paymentPlan.project;

    const target = buckets.find((b) => b.bucket === bucket)!;
    target.count += 1;
    target.amount += remaining;
    const set = bucketAccounts.get(bucket) ?? new Set<string>();
    set.add(project.id);
    bucketAccounts.set(bucket, set);
    accounts.add(project.id);

    detail.push({
      installmentId: row.id,
      projectId: project.id,
      label: row.label,
      dueDateLabel: format(row.dueDate, 'dd MMM yyyy'),
      overdueDays: days,
      bucket,
      amount,
      paidAmount,
      remaining,
      customerName: project.customer.user.name,
      customerPhone: project.customer.user.phone,
      projectTitle: project.title,
    });
  }

  for (const bucket of buckets) {
    bucket.accounts = bucketAccounts.get(bucket.bucket)?.size ?? 0;
  }

  return {
    buckets,
    // সবচেয়ে পুরনো বকেয়া আগে — অ্যাকাউন্টস এই ক্রমেই ফলো-আপ করে
    rows: detail.sort((a, b) => b.overdueDays - a.overdueDays),
    totalAmount: detail.reduce((sum, r) => sum + r.remaining, 0),
    totalCount: detail.length,
    totalAccounts: accounts.size,
  };
}

/* ------------------------------------------------------ dashboard KPI */

export type CollectionKpi = {
  /** এই মাসে due কিস্তির অনাদায়ী অঙ্ক — PRD এর "Total Receivable (এই মাসে due)" */
  monthReceivable: number;
  monthReceivableCount: number;
  /** এই মাসে আদায় হওয়া টাকা */
  monthCollected: number;
  monthCollectedCount: number;
  /** সব প্ল্যান মিলিয়ে মোট ও আদায়কৃত */
  planTotal: number;
  planCollected: number;
  outstanding: number;
  /** পেমেন্ট প্ল্যান এখনো সেট হয়নি এমন প্রজেক্ট */
  plansPending: number;
};

/** অ্যাকাউন্টস ড্যাশবোর্ডের সংখ্যাগুলো — PRD সেকশন ৫.৫ (Dashboard KPI) */
export async function loadCollectionKpi(now = new Date()): Promise<CollectionKpi> {
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const [monthDue, monthPayments, planTotals, collectedTotal, plansPending] = await Promise.all([
    prisma.installment.findMany({
      where: { dueDate: { gte: monthStart, lte: monthEnd } },
      select: { amount: true, payments: { select: { amountReceived: true } } },
    }),
    prisma.payment.aggregate({
      where: { paidAt: { gte: monthStart, lte: monthEnd } },
      _sum: { amountReceived: true },
      _count: true,
    }),
    prisma.installment.aggregate({ _sum: { amount: true } }),
    prisma.payment.aggregate({ _sum: { amountReceived: true } }),
    prisma.project.count({ where: { paymentPlan: null } }),
  ]);

  const monthReceivable = monthDue.reduce((sum, row) => {
    const paid = row.payments.reduce((s, p) => s + Number(p.amountReceived), 0);
    return sum + Math.max(0, Number(row.amount) - paid);
  }, 0);

  const planTotal = Number(planTotals._sum.amount ?? 0);
  const planCollected = Number(collectedTotal._sum.amountReceived ?? 0);

  return {
    monthReceivable,
    monthReceivableCount: monthDue.length,
    monthCollected: Number(monthPayments._sum.amountReceived ?? 0),
    monthCollectedCount: monthPayments._count,
    planTotal,
    planCollected,
    outstanding: Math.max(0, planTotal - planCollected),
    plansPending,
  };
}

/* ----------------------------------------------------------- receipt */

/**
 * পরবর্তী রসিদ নম্বর — "ORB-2026-000123"।
 *
 * বছরভিত্তিক সিরিজ; সর্বশেষটি খুঁজতে string sort ই যথেষ্ট, কারণ ক্রমিক অংশ
 * শূন্য দিয়ে ৬ ঘরে প্যাড করা। `receiptNo` unique — একই সঙ্গে দুটি এন্ট্রি এলে
 * একটি ব্যর্থ হবে, কলার তখন আবার চেষ্টা করে (কলিং কোডে retry আছে)।
 */
export async function nextReceiptNo(now = new Date()): Promise<string> {
  const year = now.getFullYear();
  const last = await prisma.payment.findFirst({
    where: { receiptNo: { startsWith: `ORB-${year}-` } },
    orderBy: { receiptNo: 'desc' },
    select: { receiptNo: true },
  });

  const serial = last ? Number(last.receiptNo.split('-')[2] ?? '0') : 0;
  return formatReceiptNo(year, (Number.isFinite(serial) ? serial : 0) + 1);
}
