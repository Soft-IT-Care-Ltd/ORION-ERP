import {
  addMonths,
  endOfMonth,
  format,
  startOfDay,
  startOfMonth,
  startOfQuarter,
  subMonths,
} from 'date-fns';
import { LeadStage, LedgerType, type LeadSource, type Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  buildingTypeLabel,
  LEAD_SOURCES,
  LEAD_STAGES,
  lostReasonLabel,
  SOURCE_LABEL,
  STAGE_LABEL,
  STAGE_LABEL_EN,
} from '@/lib/leads';
import { AGING_BUCKET_LABEL, PAYMENT_METHOD_LABEL } from '@/lib/payments';
import { loadAgingReport } from '@/lib/payment-data';
import { computeClientProfit, LEDGER_CATEGORY_LABEL, LEDGER_TYPE_SHORT } from '@/lib/ledger';
import { PROJECT_STATUS_LABEL } from '@/lib/projects';
import { computePhaseStatus, overallProgress, summarizePhases } from '@/lib/phases';
import {
  ratio,
  sortClientProfit,
  type ClientProfitReport,
  type ClientProfitRow,
  type CollectionMonthRow,
  type CollectionReport,
  type FunnelRange,
  type FunnelReport,
  type FunnelRow,
  type ProjectProgressRow,
  type ReportDataset,
  type ReportId,
} from '@/lib/reports';

/**
 * Admin ড্যাশবোর্ডের তিনটি চার্টের ডেটা — PRD সেকশন ৫.১০।
 * সবই আসল DB কুয়েরি (groupBy/aggregate); কোথাও স্যাম্পল ডেটা বসানো নেই।
 *
 * এটি server-only (`lib/prisma` import করে); বিশুদ্ধ টাইপ, রঙ ও ফরম্যাটিং
 * `lib/reports.ts` এ, যাতে Recharts এর client component সেখান থেকেই নিতে পারে।
 */

/* --------------------------------------------------------- sales funnel */

/** Lost বাদে পাইপলাইনের ধাপগুলো — ফানেলের বার এই ক্রমেই */
const FUNNEL_STAGES = LEAD_STAGES.filter((s) => s !== LeadStage.LOST);

/** স্টেজের ক্রমিক অবস্থান — "অন্তত কতদূর পৌঁছেছে" হিসাব করতে */
const STAGE_INDEX = new Map<LeadStage, number>(FUNNEL_STAGES.map((s, i) => [s, i]));

export function funnelRangeStart(range: FunnelRange, now: Date): Date | null {
  if (range === 'month') return startOfMonth(now);
  if (range === 'quarter') return startOfQuarter(now);
  return null;
}

/**
 * ActivityLog এর metadata থেকে একটি স্টেজ পড়া — `{ from, to }` দুটোই স্টেজের নাম।
 * পুরনো/ভিন্ন আকারের লগে null।
 */
function stageFromMeta(metadata: Prisma.JsonValue | null, field: 'from' | 'to'): LeadStage | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  const value = (metadata as Record<string, unknown>)[field];
  return typeof value === 'string' && STAGE_INDEX.has(value as LeadStage)
    ? (value as LeadStage)
    : null;
}

/**
 * PRD সেকশন ৫.১ — Sales funnel ও stage-wise conversion।
 *
 * বর্তমান স্টেজের গণনা `groupBy` দিয়ে আসে, তারপর সঞ্চিত করা হয়: Negotiation এ
 * বসে থাকা লিড আগে New/Contacted/Site Visit ও পেরিয়েছে, তাই সে উপরের প্রতিটি
 * ধাপেই গোনা হয় — নইলে conversion % এর কোনো মানে থাকত না।
 *
 * Lost লিডগুলো বাদ দিলে হার কৃত্রিমভাবে ভালো দেখাত (যে লিড Negotiation এ গিয়ে
 * হারিয়েছে, সে-ও তো Contacted হয়েছিল)। তাই তাদের **শেষ পৌঁছানো ধাপ** ActivityLog
 * এর STAGE_CHANGED রেকর্ড থেকে বের করে সেই পর্যন্ত গোনা হয়; ইতিহাস না থাকলে
 * (সরাসরি Lost হিসেবে তৈরি) New ধরা হয়।
 */
export async function loadSalesFunnel(
  range: FunnelRange,
  now: Date,
  /**
   * বাড়তি ফিল্টার — সেলস প্যানেলের "পারফরম্যান্স" পাতায় একজন এক্সিকিউটিভের
   * নিজের ফানেল দেখাতে `{ assignedToId }` পাঠানো হয়। খালি হলে পুরো কোম্পানির।
   */
  scope: Prisma.LeadWhereInput = {},
): Promise<FunnelReport> {
  const start = funnelRangeStart(range, now);
  const where: Prisma.LeadWhereInput = {
    ...scope,
    ...(start ? { createdAt: { gte: start } } : {}),
  };

  const grouped = await prisma.lead.groupBy({
    by: ['stage'],
    where,
    _count: { _all: true },
  });

  // প্রতিটি স্টেজে এখন কতগুলো লিড বসে আছে
  const atStage = new Map<LeadStage, number>();
  for (const row of grouped) atStage.set(row.stage, row._count._all);

  const lost = atStage.get(LeadStage.LOST) ?? 0;
  // "কে কতদূর পৌঁছেছিল" — Lost লিডগুলোকে তাদের সর্বোচ্চ ধাপে ফিরিয়ে বসানো
  const lostReached = lost > 0 ? await lostLeadsByReachedStage(where) : new Map<LeadStage, number>();

  const reached = FUNNEL_STAGES.map((stage) => {
    const index = STAGE_INDEX.get(stage)!;
    let count = 0;
    for (const [other, value] of atStage) {
      if (other === LeadStage.LOST) continue;
      // এই স্টেজ বা তার পরে থাকা মানেই এখানে পৌঁছেছিল
      if ((STAGE_INDEX.get(other) ?? -1) >= index) count += value;
    }
    for (const [other, value] of lostReached) {
      if ((STAGE_INDEX.get(other) ?? -1) >= index) count += value;
    }
    return count;
  });

  const rows: FunnelRow[] = FUNNEL_STAGES.map((stage, i) => ({
    stage,
    label: STAGE_LABEL_EN[stage],
    labelBn: STAGE_LABEL[stage],
    count: reached[i],
    conversion:
      i < FUNNEL_STAGES.length - 1 && reached[i] > 0 ? ratio(reached[i + 1], reached[i]) : null,
  }));

  const total = reached[0] ?? 0;
  const won = atStage.get(LeadStage.WON) ?? 0;

  return { rows, total, won, lost, winRate: ratio(won, total) };
}

/**
 * Lost লিডগুলো হারানোর আগে সর্বোচ্চ কোন ধাপে গিয়েছিল।
 * একটি কুয়েরিতে সব STAGE_CHANGED লগ, তারপর লিড-প্রতি সর্বোচ্চ ধাপ।
 */
async function lostLeadsByReachedStage(
  leadWhere: Prisma.LeadWhereInput,
): Promise<Map<LeadStage, number>> {
  const lostLeads = await prisma.lead.findMany({
    where: { ...leadWhere, stage: LeadStage.LOST },
    select: { id: true },
  });
  if (lostLeads.length === 0) return new Map();

  const logs = await prisma.activityLog.findMany({
    where: {
      entityType: 'Lead',
      action: 'STAGE_CHANGED',
      entityId: { in: lostLeads.map((l) => l.id) },
    },
    select: { entityId: true, metadata: true },
  });

  // ইতিহাস না থাকলে ফানেলের প্রথম ধাপ — অন্তত "New Lead" তো হয়েছিল
  const best = new Map<string, number>(lostLeads.map((l) => [l.id, 0]));
  for (const log of logs) {
    for (const field of ['from', 'to'] as const) {
      const stage = stageFromMeta(log.metadata, field);
      if (!stage) continue;
      const index = STAGE_INDEX.get(stage)!;
      if (index > (best.get(log.entityId) ?? 0)) best.set(log.entityId, index);
    }
  }

  const byStage = new Map<LeadStage, number>();
  for (const index of best.values()) {
    const stage = FUNNEL_STAGES[index];
    byStage.set(stage, (byStage.get(stage) ?? 0) + 1);
  }
  return byStage;
}

/* ------------------------------------------------------ project progress */

/** চার্টে এতগুলোর বেশি প্রজেক্ট দেখালে বার গুলো পড়া যায় না */
const MAX_PROJECTS_IN_CHART = 12;

/**
 * PRD সেকশন ৫.১০ — প্রতিটি active প্রজেক্টের ফেজ-ভিত্তিক % complete।
 *
 * প্রতিটি প্রজেক্টের অগ্রগতি `overallProgress` দিয়ে হিসাব হয় (ফেজের planned
 * duration ধরে ভারিত গড়) — ইঞ্জিনিয়ার/কাস্টমার প্যানেলে প্রজেক্টের পাতায় যে
 * সংখ্যাটা দেখা যায়, ড্যাশবোর্ডেও ঠিক সেটিই। সরল `_avg(percentComplete)` নিলে
 * ৯ মাসের Structure আর ৩ সপ্তাহের Handover সমান ওজন পেত, আর দুই জায়গার সংখ্যা
 * মিলত না।
 *
 * "active" = প্রজেক্টে ফেজ টাইমলাইন বসানো আছে। টাইমলাইন ছাড়া প্রজেক্টের
 * অগ্রগতি মাপার কিছু নেই, তাই সেগুলো চার্টে আসে না।
 */
export async function loadProjectProgress(now: Date): Promise<ProjectProgressRow[]> {
  const projects = await prisma.project.findMany({
    where: { phases: { some: {} } },
    select: {
      id: true,
      title: true,
      phases: {
        select: { percentComplete: true, plannedStart: true, plannedEnd: true },
        orderBy: { order: 'asc' },
      },
    },
  });

  const rows = projects.map((project) => ({
    projectId: project.id,
    name: project.title,
    progress: overallProgress(project.phases),
    phaseCount: project.phases.length,
    donePhases: project.phases.filter((phase) => phase.percentComplete >= 100).length,
    delayedPhases: project.phases.filter((phase) => computePhaseStatus(phase, now) === 'DELAYED')
      .length,
  })) satisfies ProjectProgressRow[];

  // কম এগোনো প্রজেক্ট আগে — ড্যাশবোর্ডে চোখ আগে সেখানেই পড়া উচিত
  return rows.sort((a, b) => a.progress - b.progress).slice(0, MAX_PROJECTS_IN_CHART);
}

/* -------------------------------------------------- collected vs due */

/** চার্টের উইন্ডো — চলতি মাস সহ পেছনের ১২ মাস */
export const COLLECTION_MONTHS = 12;

/**
 * PRD সেকশন ৫.৩/৫.৭ — মাসভিত্তিক Collected vs Receivable।
 *
 * প্রতিটি মাসের `due` = ওই মাসে due হওয়া কিস্তিগুলোর মোট, আর `collected` = সেই
 * কিস্তিগুলোর বিপরীতে আদায় হওয়া টাকা। তাই বার দুটির পার্থক্যই ওই মাসের এখনো
 * অনাদায়ী অঙ্ক, আর লাইনটি PRD এর "৳38,00,000 (89%)" ধরনের আদায়-হার।
 *
 * মাস-ভিত্তিক যোগফল Prisma এর `groupBy` দিয়ে সম্ভব নয় (গ্রুপ-কী হিসেবে
 * date_trunc নেই), তাই ১২ মাসের সারিগুলো এনে JS এ বালতিতে ফেলা হয় — উইন্ডোটা
 * সীমিত বলে সারির সংখ্যাও সীমিত। `payments` লাগে কারণ আংশিক আদায় বাদ দিতে হয়।
 */
export async function loadCollectionTrend(now: Date): Promise<CollectionReport> {
  const windowStart = startOfMonth(subMonths(now, COLLECTION_MONTHS - 1));
  const windowEnd = endOfMonth(now);

  const installments = await prisma.installment.findMany({
    where: { dueDate: { gte: windowStart, lte: windowEnd } },
    select: {
      dueDate: true,
      amount: true,
      payments: { select: { amountReceived: true } },
    },
  });

  // খালি মাসও চার্টে থাকতে হবে, নইলে সময়ের ব্যবধান বোঝা যায় না
  const buckets = new Map<string, CollectionMonthRow>();
  for (let i = 0; i < COLLECTION_MONTHS; i += 1) {
    const date = addMonths(windowStart, i);
    buckets.set(format(date, 'yyyy-MM'), {
      month: format(date, 'yyyy-MM'),
      label: format(date, 'MMM yy'),
      due: 0,
      collected: 0,
      outstanding: 0,
      rate: null,
    });
  }

  for (const row of installments) {
    const bucket = buckets.get(format(row.dueDate, 'yyyy-MM'));
    if (!bucket) continue;

    const amount = Number(row.amount);
    const paid = row.payments.reduce((sum, p) => sum + Number(p.amountReceived), 0);
    bucket.due += amount;
    // অতিরিক্ত আদায় (রাউন্ডিং/অগ্রিম) হলেও আদায় কিস্তির চেয়ে বেশি দেখানো হয় না
    bucket.collected += Math.min(amount, paid);
  }

  const months = [...buckets.values()].map((bucket) => ({
    ...bucket,
    outstanding: Math.max(0, bucket.due - bucket.collected),
    // কিছু due না থাকলে হার অনির্ধারিত — লাইনটি ওই মাসে ভাঙা থাকবে
    rate: bucket.due > 0 ? ratio(bucket.collected, bucket.due) : null,
  }));

  const totalDue = months.reduce((sum, m) => sum + m.due, 0);
  const totalCollected = months.reduce((sum, m) => sum + m.collected, 0);

  return {
    months,
    totalDue,
    totalCollected,
    totalOutstanding: Math.max(0, totalDue - totalCollected),
    rate: ratio(totalCollected, totalDue),
  };
}

/* -------------------------------------------------- client profitability */

/**
 * PRD সেকশন ৫.১০ — "Client-wise profitability report (billed − cost = margin)"।
 *
 * অ্যাডমিন ড্যাশবোর্ডের টেবিল ও CSV এক্সপোর্ট — দুটোই এই একটি লোডার ব্যবহার
 * করে, তাই পর্দার সংখ্যা আর নামানো ফাইলের সংখ্যা কখনো আলাদা হয় না।
 *
 * চারটি কুয়েরি, প্রতিটিই যোগফল-স্তরে:
 *  ১. যেসব লিডের হয় লেজার এন্ট্রি আছে, নয়তো প্রজেক্ট হয়ে গেছে — শুধু তারাই
 *     রিপোর্টে আসে (যে লিডে টাকার কোনো হিসাব নেই, তার সারি অর্থহীন)।
 *  ২. `groupBy(leadId, type)` — ক্লায়েন্টভেদে বিল ও ইন্টারনাল কস্ট।
 *  ৩+৪. কিস্তির মোট ও তার বিপরীতে আদায়। পেমেন্ট টেবিলটাই সবচেয়ে বড়, তাই
 *     সেটি `groupBy` দিয়ে DB তেই যোগ করে ফেলা হয়; কিস্তিগুলো আসে শুধু
 *     `id → paymentPlanId` ম্যাপ আর প্ল্যানের মোট বের করতে।
 *
 * সাজানো ডিফল্টে মার্জিন অনুযায়ী descending — সবচেয়ে লাভজনক ক্লায়েন্ট উপরে।
 */
export async function loadClientProfitability(): Promise<ClientProfitReport> {
  const [leads, ledgerSums, installments, paymentSums] = await Promise.all([
    prisma.lead.findMany({
      where: { OR: [{ ledgerEntries: { some: {} } }, { project: { isNot: null } }] },
      select: {
        id: true,
        name: true,
        phone: true,
        stage: true,
        project: {
          select: {
            title: true,
            totalContractValue: true,
            paymentPlan: { select: { id: true } },
          },
        },
      },
    }),
    prisma.ledgerEntry.groupBy({
      by: ['leadId', 'type'],
      where: { leadId: { not: null } },
      _sum: { amount: true },
    }),
    prisma.installment.findMany({ select: { id: true, paymentPlanId: true, amount: true } }),
    prisma.payment.groupBy({ by: ['installmentId'], _sum: { amountReceived: true } }),
  ]);

  // লিড → { billed, cost }
  const ledgerByLead = new Map<string, { billed: number; cost: number }>();
  for (const row of ledgerSums) {
    if (!row.leadId) continue;
    const bucket = ledgerByLead.get(row.leadId) ?? { billed: 0, cost: 0 };
    const amount = Number(row._sum.amount ?? 0);
    if (row.type === LedgerType.INCOME) bucket.billed += amount;
    else bucket.cost += amount;
    ledgerByLead.set(row.leadId, bucket);
  }

  const collectedByInstallment = new Map(
    paymentSums.map((row) => [row.installmentId, Number(row._sum.amountReceived ?? 0)]),
  );

  // প্ল্যান → { total, collected }
  const contractByPlan = new Map<string, { total: number; collected: number }>();
  for (const installment of installments) {
    const bucket = contractByPlan.get(installment.paymentPlanId) ?? { total: 0, collected: 0 };
    const amount = Number(installment.amount);
    bucket.total += amount;
    // অতিরিক্ত আদায় (রাউন্ডিং/অগ্রিম) কিস্তির চেয়ে বেশি দেখানো হয় না —
    // `loadCollectionTrend` ঠিক একই নিয়ম মানে
    bucket.collected += Math.min(amount, collectedByInstallment.get(installment.id) ?? 0);
    contractByPlan.set(installment.paymentPlanId, bucket);
  }

  const rows: ClientProfitRow[] = leads.map((lead) => {
    const ledger = ledgerByLead.get(lead.id) ?? { billed: 0, cost: 0 };
    const planId = lead.project?.paymentPlan?.id;
    const contract = (planId ? contractByPlan.get(planId) : null) ?? { total: 0, collected: 0 };
    const profit = computeClientProfit(ledger, contract);

    return {
      leadId: lead.id,
      name: lead.name,
      phone: lead.phone,
      stage: lead.stage,
      projectTitle: lead.project?.title ?? null,
      contractValue: lead.project ? Number(lead.project.totalContractValue) : null,
      serviceBilled: profit.serviceBilled,
      contractBilled: profit.contractBilled,
      totalBilled: profit.totalBilled,
      totalReceived: profit.totalReceived,
      totalCost: ledger.cost,
      netMargin: profit.netProfit,
      // বিল না থাকলে হার অনির্ধারিত — শূন্য দেখালে "কোনো লাভ নেই" বোঝাত
      marginRate: profit.totalBilled > 0 ? ratio(profit.netProfit, profit.totalBilled) : null,
    };
  });

  return {
    rows: sortClientProfit(rows, 'margin', 'desc'),
    totalBilled: rows.reduce((sum, row) => sum + row.totalBilled, 0),
    totalReceived: rows.reduce((sum, row) => sum + row.totalReceived, 0),
    totalCost: rows.reduce((sum, row) => sum + row.totalCost, 0),
    netMargin: rows.reduce((sum, row) => sum + row.netMargin, 0),
  };
}

/* ------------------------------------------------------ dashboard stats */

export type DashboardStats = {
  activeUsers: number;
  leads: number;
  projects: number;
  /** এখনো Won হয়নি এমন খোলা লিড — প্রি-প্রজেক্ট পাইপলাইনে যতগুলো আছে */
  openLeads: number;
  /** আজ পর্যন্ত ফলো-আপের তারিখ পেরিয়ে যাওয়া খোলা লিড */
  overdueFollowUps: number;
};

/** ড্যাশবোর্ডের উপরের কার্ডগুলোর সংখ্যা */
export async function loadDashboardStats(now: Date): Promise<DashboardStats> {
  const [activeUsers, leads, projects, openLeads, overdueFollowUps] = await Promise.all([
    prisma.user.count({ where: { active: true } }),
    prisma.lead.count(),
    prisma.project.count(),
    prisma.lead.count({ where: { stage: { notIn: [LeadStage.WON, LeadStage.LOST] } } }),
    prisma.lead.count({
      where: {
        nextFollowUpAt: { lt: startOfDay(now) },
        stage: { notIn: [LeadStage.WON, LeadStage.LOST] },
      },
    }),
  ]);

  return { activeUsers, leads, projects, openLeads, overdueFollowUps };
}

/* ---------------------------------------------------- export datasets */

/**
 * এক্সপোর্টের ডেটা — PRD সেকশন ৫.৭ ("Export reports")।
 *
 * প্রতিটি লোডার `ReportDataset` (কলাম + কাঁচা সারি) ফেরত দেয়। সংখ্যা কাঁচাই
 * থাকে — CSV তে Excel যাতে যোগ করতে পারে, আর পর্দায় `formatReportCell`
 * ফরম্যাট করে নেয়। এক ডেটা, দুই গন্তব্য।
 */
export async function loadReportDataset(
  id: ReportId,
  range: FunnelRange,
  now: Date,
): Promise<ReportDataset> {
  switch (id) {
    case 'sales-funnel':
      return salesFunnelDataset(range, now);
    case 'executive-performance':
      return executivePerformanceDataset(range, now);
    case 'lead-source':
      return leadSourceDataset(range, now);
    case 'leads':
      return leadsDataset(range);
    case 'project-progress':
      return projectProgressDataset(now);
    case 'collection':
      return collectionDataset(now);
    case 'overdue-aging':
      return overdueAgingDataset(now);
    case 'client-profitability':
      return clientProfitabilityDataset();
    case 'company-ledger':
      return companyLedgerDataset(range, now);
    case 'payments':
      return paymentsDataset(range, now);
  }
}

/** রেঞ্জ অনুযায়ী `createdAt`/`paidAt` ফিল্টার — 'all' এ কোনো শর্ত নয় */
function rangeFilter(range: FunnelRange, now: Date) {
  const start = funnelRangeStart(range, now);
  return start ? { gte: start } : undefined;
}

const dateLabel = (value: Date | null | undefined) =>
  value ? format(value, 'dd MMM yyyy') : null;

/* ------------------------------------------------------- sales funnel */

async function salesFunnelDataset(range: FunnelRange, now: Date): Promise<ReportDataset> {
  const report = await loadSalesFunnel(range, now);
  return {
    columns: [
      { header: 'ধাপ (Stage)' },
      { header: 'ধাপ (বাংলা)' },
      { header: 'লিড সংখ্যা', kind: 'number' },
      { header: 'পরের ধাপে (%)', kind: 'percent' },
    ],
    rows: report.rows.map((row) => [row.label, row.labelBn, row.count, row.conversion]),
  };
}

/* ------------------------------------------- executive / source rollup */

/** দুই রোলআপেই একই কুয়েরি লাগে — লিড + (থাকলে) তার প্রজেক্টের কন্ট্রাক্ট ভ্যালু */
async function leadRollupRows(range: FunnelRange, now: Date) {
  return prisma.lead.findMany({
    where: { createdAt: rangeFilter(range, now) },
    select: {
      stage: true,
      source: true,
      assignedTo: { select: { id: true, name: true } },
      project: { select: { totalContractValue: true } },
    },
  });
}

type Rollup = { total: number; won: number; lost: number; value: number };

const emptyRollup = (): Rollup => ({ total: 0, won: 0, lost: 0, value: 0 });

function addToRollup(
  bucket: Rollup,
  lead: { stage: LeadStage; project: { totalContractValue: unknown } | null },
) {
  bucket.total += 1;
  if (lead.stage === LeadStage.WON) {
    bucket.won += 1;
    bucket.value += Number(lead.project?.totalContractValue ?? 0);
  } else if (lead.stage === LeadStage.LOST) {
    bucket.lost += 1;
  }
}

/** PRD সেকশন ৫.৭ — "marketing executive-wise performance" */
async function executivePerformanceDataset(
  range: FunnelRange,
  now: Date,
): Promise<ReportDataset> {
  const leads = await leadRollupRows(range, now);

  const byExecutive = new Map<string, Rollup & { name: string }>();
  for (const lead of leads) {
    // অ্যাসাইন না করা লিডগুলোও দেখানো হয় — নইলে যোগফল মিলত না
    const id = lead.assignedTo?.id ?? '—';
    const bucket =
      byExecutive.get(id) ?? { ...emptyRollup(), name: lead.assignedTo?.name ?? 'অ্যাসাইন করা হয়নি' };
    addToRollup(bucket, lead);
    byExecutive.set(id, bucket);
  }

  return {
    columns: [
      { header: 'এক্সিকিউটিভ' },
      { header: 'মোট লিড', kind: 'number' },
      { header: 'Won', kind: 'number' },
      { header: 'Lost', kind: 'number' },
      { header: 'চলমান', kind: 'number' },
      { header: 'Win rate (%)', kind: 'percent' },
      { header: 'বিক্রয়মূল্য (৳)', kind: 'money' },
    ],
    rows: [...byExecutive.values()]
      .sort((a, b) => b.won - a.won || b.total - a.total)
      .map((row) => [
        row.name,
        row.total,
        row.won,
        row.lost,
        row.total - row.won - row.lost,
        ratio(row.won, row.total),
        row.value,
      ]),
  };
}

/** PRD সেকশন ৫.৭ — "Lead source ROI (কোন source থেকে বেশি conversion)" */
async function leadSourceDataset(range: FunnelRange, now: Date): Promise<ReportDataset> {
  const leads = await leadRollupRows(range, now);

  const bySource = new Map<LeadSource, Rollup>();
  for (const lead of leads) {
    const bucket = bySource.get(lead.source) ?? emptyRollup();
    addToRollup(bucket, lead);
    bySource.set(lead.source, bucket);
  }

  return {
    columns: [
      { header: 'সোর্স' },
      { header: 'মোট লিড', kind: 'number' },
      { header: 'Won', kind: 'number' },
      { header: 'Lost', kind: 'number' },
      { header: 'কনভার্শন (%)', kind: 'percent' },
      { header: 'বিক্রয়মূল্য (৳)', kind: 'money' },
      { header: 'গড় ডিল ভ্যালু (৳)', kind: 'money' },
    ],
    // সব সোর্সই থাকে (শূন্য সহ) — কোনটি একেবারেই কাজ করছে না, সেটাও তথ্য
    rows: LEAD_SOURCES.map((source) => {
      const row = bySource.get(source) ?? emptyRollup();
      return [
        SOURCE_LABEL[source],
        row.total,
        row.won,
        row.lost,
        ratio(row.won, row.total),
        row.value,
        row.won > 0 ? Math.round(row.value / row.won) : null,
      ];
    }),
  };
}

/* --------------------------------------------------------- lead list */

async function leadsDataset(range: FunnelRange): Promise<ReportDataset> {
  const leads = await prisma.lead.findMany({
    where: { createdAt: rangeFilter(range, new Date()) },
    orderBy: { createdAt: 'desc' },
    select: {
      name: true,
      phone: true,
      residenceCountry: true,
      email: true,
      source: true,
      stage: true,
      lostReason: true,
      projectLocation: true,
      budgetMin: true,
      budgetMax: true,
      nextFollowUpAt: true,
      createdAt: true,
      localContactName: true,
      localContactPhone: true,
      localContactRelation: true,
      landSize: true,
      buildingType: true,
      assignedTo: { select: { name: true } },
    },
  });

  return {
    columns: [
      { header: 'নাম' },
      { header: 'ফোন' },
      { header: 'বর্তমান দেশ' },
      { header: 'ইমেইল' },
      { header: 'সোর্স' },
      { header: 'স্টেজ' },
      { header: 'Lost কারণ' },
      { header: 'অ্যাসাইন' },
      { header: 'জমির আয়তন' },
      { header: 'বাড়ির ধরন' },
      { header: 'জমি/প্রজেক্ট এলাকা' },
      { header: 'বাজেট (কম) ৳', kind: 'money' },
      { header: 'বাজেট (বেশি) ৳', kind: 'money' },
      { header: 'পরবর্তী ফলো-আপ' },
      { header: 'লোকাল কন্টাক্ট' },
      { header: 'লোকাল ফোন' },
      { header: 'সম্পর্ক' },
      { header: 'তৈরি' },
    ],
    rows: leads.map((lead) => [
      lead.name,
      lead.phone,
      lead.residenceCountry,
      lead.email,
      SOURCE_LABEL[lead.source],
      STAGE_LABEL[lead.stage],
      lostReasonLabel(lead.lostReason),
      lead.assignedTo?.name ?? null,
      lead.landSize,
      buildingTypeLabel(lead.buildingType),
      lead.projectLocation,
      lead.budgetMin === null ? null : Number(lead.budgetMin),
      lead.budgetMax === null ? null : Number(lead.budgetMax),
      dateLabel(lead.nextFollowUpAt),
      lead.localContactName,
      lead.localContactPhone,
      lead.localContactRelation,
      dateLabel(lead.createdAt),
    ]),
  };
}

/* -------------------------------------------------- project progress */

/**
 * প্রজেক্ট-ভিত্তিক অগ্রগতি — ড্যাশবোর্ডের চার্ট শুধু % দেখায়, কিন্তু এক্সপোর্টে
 * ক্লায়েন্ট/ইঞ্জিনিয়ার/চলমান ফেজ ধরে ধরে দরকার হয় (কোন সাইটে কাজ আটকে আছে)।
 */
async function projectProgressDataset(now: Date): Promise<ReportDataset> {
  const projects = await prisma.project.findMany({
    where: { phases: { some: {} } },
    orderBy: { createdAt: 'desc' },
    select: {
      title: true,
      landLocation: true,
      buildingType: true,
      floors: true,
      status: true,
      customer: { select: { user: { select: { name: true } } } },
      engineer: { select: { name: true } },
      phases: {
        select: {
          name: true,
          order: true,
          percentComplete: true,
          plannedStart: true,
          plannedEnd: true,
        },
        orderBy: { order: 'asc' },
      },
    },
  });

  return {
    columns: [
      { header: 'প্রজেক্ট' },
      { header: 'ক্লায়েন্ট' },
      { header: 'জমির অবস্থান' },
      { header: 'বাড়ির ধরন' },
      { header: 'তলা', kind: 'number' },
      { header: 'স্ট্যাটাস' },
      { header: 'ইঞ্জিনিয়ার' },
      { header: 'অগ্রগতি (%)', kind: 'percent' },
      { header: 'মোট ফেজ', kind: 'number' },
      { header: 'সম্পন্ন ফেজ', kind: 'number' },
      { header: 'বিলম্বিত ফেজ', kind: 'number' },
      { header: 'চলমান ফেজ' },
      { header: 'পরিকল্পিত শেষ' },
    ],
    rows: projects.map((project) => {
      const summary = summarizePhases(project.phases, now);
      const last = project.phases[project.phases.length - 1];
      return [
        project.title,
        project.customer.user.name,
        project.landLocation,
        buildingTypeLabel(project.buildingType),
        project.floors,
        PROJECT_STATUS_LABEL[project.status],
        project.engineer?.name ?? null,
        summary.progress,
        summary.total,
        summary.doneCount,
        summary.delayedCount,
        summary.current ? summary.current.name : 'সব ফেজ সম্পন্ন',
        dateLabel(last?.plannedEnd),
      ];
    }),
  };
}

/* ------------------------------------------------------- finance */

async function collectionDataset(now: Date): Promise<ReportDataset> {
  const report = await loadCollectionTrend(now);
  return {
    columns: [
      { header: 'মাস' },
      { header: 'পাওনা (৳)', kind: 'money' },
      { header: 'আদায় (৳)', kind: 'money' },
      { header: 'বাকি (৳)', kind: 'money' },
      { header: 'আদায়ের হার (%)', kind: 'percent' },
    ],
    rows: report.months.map((m) => [m.label, m.due, m.collected, m.outstanding, m.rate]),
  };
}

async function overdueAgingDataset(now: Date): Promise<ReportDataset> {
  const report = await loadAgingReport(now);
  return {
    columns: [
      { header: 'কাস্টমার' },
      { header: 'ফোন' },
      { header: 'প্রজেক্ট' },
      { header: 'কিস্তি' },
      { header: 'শেষ তারিখ' },
      { header: 'কত দিন বকেয়া', kind: 'number' },
      { header: 'বালতি' },
      { header: 'কিস্তির অঙ্ক (৳)', kind: 'money' },
      { header: 'জমা (৳)', kind: 'money' },
      { header: 'বকেয়া (৳)', kind: 'money' },
    ],
    rows: report.rows.map((row) => [
      row.customerName,
      row.customerPhone,
      row.projectTitle,
      row.label,
      row.dueDateLabel,
      row.overdueDays,
      AGING_BUCKET_LABEL[row.bucket],
      row.amount,
      row.paidAmount,
      row.remaining,
    ]),
  };
}

async function paymentsDataset(range: FunnelRange, now: Date): Promise<ReportDataset> {
  const payments = await prisma.payment.findMany({
    where: { paidAt: rangeFilter(range, now) },
    orderBy: { paidAt: 'desc' },
    select: {
      receiptNo: true,
      amountReceived: true,
      method: true,
      note: true,
      paidAt: true,
      receivedBy: { select: { name: true } },
      installment: {
        select: {
          label: true,
          dueDate: true,
          paymentPlan: {
            select: {
              project: {
                select: {
                  title: true,
                  customer: { select: { user: { select: { name: true, phone: true } } } },
                },
              },
            },
          },
        },
      },
    },
  });

  return {
    columns: [
      { header: 'রসিদ নং' },
      { header: 'তারিখ' },
      { header: 'কাস্টমার' },
      { header: 'ফোন' },
      { header: 'প্রজেক্ট' },
      { header: 'কিস্তি' },
      { header: 'কিস্তির শেষ তারিখ' },
      { header: 'জমা (৳)', kind: 'money' },
      { header: 'মাধ্যম' },
      { header: 'রেফারেন্স' },
      { header: 'গ্রহণকারী' },
    ],
    rows: payments.map((payment) => {
      const project = payment.installment.paymentPlan.project;
      return [
        payment.receiptNo,
        dateLabel(payment.paidAt),
        project.customer.user.name,
        project.customer.user.phone,
        project.title,
        payment.installment.label,
        dateLabel(payment.installment.dueDate),
        Number(payment.amountReceived),
        PAYMENT_METHOD_LABEL[payment.method],
        payment.note,
        payment.receivedBy.name,
      ];
    }),
  };
}

/* ------------------------------------------- client profit / company ledger */

/**
 * PRD সেকশন ৫.১০ — "Client-wise profitability report"।
 *
 * ড্যাশবোর্ডের টেবিলের সঙ্গে এক সংখ্যা রাখতে হিসাবটি `loadClientProfitability`
 * এই করে; এখানে শুধু সেটিকে CSV এর কলাম-সারিতে সাজানো হয়। রিপোর্টটি শুধু
 * `report:financial` ওয়ালারা নামাতে পারেন — কাস্টমার কখনো নয়।
 */
async function clientProfitabilityDataset(): Promise<ReportDataset> {
  const report = await loadClientProfitability();

  return {
    columns: [
      { header: 'ক্লায়েন্ট' },
      { header: 'ফোন' },
      { header: 'স্টেজ' },
      { header: 'প্রজেক্ট' },
      { header: 'কন্ট্রাক্ট ভ্যালু (৳)', kind: 'money' },
      { header: 'প্রি-প্রজেক্ট বিল (৳)', kind: 'money' },
      { header: 'কনস্ট্রাকশন বিল (৳)', kind: 'money' },
      { header: 'মোট বিল (৳)', kind: 'money' },
      { header: 'মোট আদায় (৳)', kind: 'money' },
      { header: 'ইন্টারনাল কস্ট (৳)', kind: 'money' },
      { header: 'নিট মার্জিন (৳)', kind: 'money' },
      { header: 'মার্জিন (%)', kind: 'percent' },
    ],
    rows: report.rows.map((row) => [
      row.name,
      row.phone,
      STAGE_LABEL[row.stage],
      row.projectTitle,
      row.contractValue,
      row.serviceBilled,
      row.contractBilled,
      row.totalBilled,
      row.totalReceived,
      row.totalCost,
      row.netMargin,
      row.marginRate,
    ]),
  };
}

/** PRD সেকশন ৫.৬ — Main Company Ledger এর কাঁচা এন্ট্রি তালিকা */
async function companyLedgerDataset(range: FunnelRange, now: Date): Promise<ReportDataset> {
  const entries = await prisma.ledgerEntry.findMany({
    where: { date: rangeFilter(range, now) },
    orderBy: { date: 'desc' },
    select: {
      date: true,
      type: true,
      category: true,
      amount: true,
      note: true,
      receiptNo: true,
      clientVisible: true,
      lead: { select: { name: true, phone: true } },
      createdBy: { select: { name: true } },
    },
  });

  return {
    columns: [
      { header: 'তারিখ' },
      { header: 'ধরন' },
      { header: 'ক্যাটেগরি' },
      { header: 'ক্লায়েন্ট' },
      { header: 'ফোন' },
      { header: 'অঙ্ক (৳)', kind: 'money' },
      { header: 'রসিদ নং' },
      { header: 'ক্লায়েন্ট দেখতে পান' },
      { header: 'নোট' },
      { header: 'এন্ট্রি করেছেন' },
    ],
    rows: entries.map((entry) => [
      dateLabel(entry.date),
      LEDGER_TYPE_SHORT[entry.type],
      LEDGER_CATEGORY_LABEL[entry.category],
      entry.lead?.name ?? '(কোম্পানি — ক্লায়েন্ট ছাড়া)',
      entry.lead?.phone ?? null,
      Number(entry.amount),
      entry.receiptNo,
      entry.clientVisible ? 'হ্যাঁ' : 'না',
      entry.note,
      entry.createdBy.name,
    ]),
  };
}
