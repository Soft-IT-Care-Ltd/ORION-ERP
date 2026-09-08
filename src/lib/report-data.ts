import {
  addMonths,
  endOfMonth,
  format,
  startOfDay,
  startOfMonth,
  startOfQuarter,
  subMonths,
} from 'date-fns';
import { LeadStage, type LeadSource, type Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  LEAD_SOURCES,
  LEAD_STAGES,
  lostReasonLabel,
  SOURCE_LABEL,
  STAGE_LABEL,
  STAGE_LABEL_EN,
} from '@/lib/leads';
import { AGING_BUCKET_LABEL, PAYMENT_METHOD_LABEL } from '@/lib/payments';
import { loadAgingReport } from '@/lib/payment-data';
import { UNIT_STATUS_LABEL } from '@/lib/sales';
import { computePhaseStatus, overallProgress, summarizePhases } from '@/lib/phases';
import {
  ratio,
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
 * Admin ড্যাশবোর্ডের তিনটি চার্টের ডেটা — PRD সেকশন ৫.৭।
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
export async function loadSalesFunnel(range: FunnelRange, now: Date): Promise<FunnelReport> {
  const start = funnelRangeStart(range, now);
  const where: Prisma.LeadWhereInput = start ? { createdAt: { gte: start } } : {};

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
 * PRD সেকশন ৫.৭ — প্রতিটি active প্রজেক্টের ইউনিটগুলোর গড় % complete।
 *
 * প্রতিটি ইউনিটের অগ্রগতি `overallProgress` দিয়ে হিসাব হয় (ফেজের planned
 * duration ধরে ভারিত গড়) — ইঞ্জিনিয়ার/কাস্টমার প্যানেলে ইউনিটের পাতায় যে
 * সংখ্যাটা দেখা যায়, ড্যাশবোর্ডেও ঠিক সেটিই। সরল `_avg(percentComplete)` নিলে
 * ৯ মাসের Structure আর ৩ সপ্তাহের Handover সমান ওজন পেত, আর দুই জায়গার সংখ্যা
 * মিলত না।
 *
 * "active" = অন্তত একটি ইউনিটে ফেজ টাইমলাইন বসানো আছে। টাইমলাইন ছাড়া প্রজেক্টের
 * অগ্রগতি মাপার কিছু নেই, তাই সেগুলো চার্টে আসে না।
 */
export async function loadProjectProgress(now: Date): Promise<ProjectProgressRow[]> {
  const projects = await prisma.project.findMany({
    where: { units: { some: { phases: { some: {} } } } },
    select: {
      id: true,
      name: true,
      units: {
        select: {
          id: true,
          phases: {
            select: { percentComplete: true, plannedStart: true, plannedEnd: true },
            orderBy: { order: 'asc' },
          },
        },
      },
    },
  });

  const rows = projects.map((project) => {
    const units = project.units.filter((unit) => unit.phases.length > 0);
    const progressPerUnit = units.map((unit) => overallProgress(unit.phases));

    const delayedPhases = units.reduce(
      (sum, unit) =>
        sum + unit.phases.filter((phase) => computePhaseStatus(phase, now) === 'DELAYED').length,
      0,
    );

    return {
      projectId: project.id,
      name: project.name,
      progress:
        progressPerUnit.length > 0
          ? Math.round(progressPerUnit.reduce((a, b) => a + b, 0) / progressPerUnit.length)
          : 0,
      unitCount: units.length,
      doneUnits: progressPerUnit.filter((p) => p >= 100).length,
      delayedPhases,
    } satisfies ProjectProgressRow;
  });

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

/* ------------------------------------------------------ dashboard stats */

export type DashboardStats = {
  activeUsers: number;
  leads: number;
  projects: number;
  units: number;
  /** আজ পর্যন্ত ফলো-আপের তারিখ পেরিয়ে যাওয়া খোলা লিড */
  overdueFollowUps: number;
};

/** ড্যাশবোর্ডের উপরের কার্ডগুলোর সংখ্যা */
export async function loadDashboardStats(now: Date): Promise<DashboardStats> {
  const [activeUsers, leads, projects, units, overdueFollowUps] = await Promise.all([
    prisma.user.count({ where: { active: true } }),
    prisma.lead.count(),
    prisma.project.count(),
    prisma.unit.count(),
    prisma.lead.count({
      where: {
        nextFollowUpAt: { lt: startOfDay(now) },
        stage: { notIn: [LeadStage.WON, LeadStage.LOST] },
      },
    }),
  ]);

  return { activeUsers, leads, projects, units, overdueFollowUps };
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
      return unitProgressDataset(now);
    case 'collection':
      return collectionDataset(now);
    case 'overdue-aging':
      return overdueAgingDataset(now);
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

/** দুই রোলআপেই একই কুয়েরি লাগে — লিড + (থাকলে) তার সেলের মূল্য */
async function leadRollupRows(range: FunnelRange, now: Date) {
  return prisma.lead.findMany({
    where: { createdAt: rangeFilter(range, now) },
    select: {
      stage: true,
      source: true,
      assignedTo: { select: { id: true, name: true } },
      sale: { select: { totalAmount: true } },
    },
  });
}

type Rollup = { total: number; won: number; lost: number; value: number };

const emptyRollup = (): Rollup => ({ total: 0, won: 0, lost: 0, value: 0 });

function addToRollup(bucket: Rollup, lead: { stage: LeadStage; sale: { totalAmount: unknown } | null }) {
  bucket.total += 1;
  if (lead.stage === LeadStage.WON) {
    bucket.won += 1;
    bucket.value += Number(lead.sale?.totalAmount ?? 0);
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
      assignedTo: { select: { name: true } },
      interestedUnit: { select: { unitNo: true, project: { select: { name: true } } } },
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
      { header: 'আগ্রহী ইউনিট' },
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
      lead.interestedUnit
        ? `${lead.interestedUnit.project.name} — ${lead.interestedUnit.unitNo}`
        : null,
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

/* ---------------------------------------------------- unit progress */

/**
 * ইউনিট-ভিত্তিক অগ্রগতি — ড্যাশবোর্ডের চার্ট প্রজেক্ট-গড় দেখায়, কিন্তু
 * এক্সপোর্টে ইউনিট ধরে ধরে দরকার হয় (কোন ফ্ল্যাটে কাজ আটকে আছে)।
 */
async function unitProgressDataset(now: Date): Promise<ReportDataset> {
  const units = await prisma.unit.findMany({
    where: { phases: { some: {} } },
    orderBy: [{ project: { name: 'asc' } }, { unitNo: 'asc' }],
    select: {
      unitNo: true,
      status: true,
      project: { select: { name: true, location: true, engineer: { select: { name: true } } } },
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
      { header: 'এলাকা' },
      { header: 'ইউনিট' },
      { header: 'ইউনিট স্ট্যাটাস' },
      { header: 'ইঞ্জিনিয়ার' },
      { header: 'অগ্রগতি (%)', kind: 'percent' },
      { header: 'মোট ফেজ', kind: 'number' },
      { header: 'সম্পন্ন ফেজ', kind: 'number' },
      { header: 'বিলম্বিত ফেজ', kind: 'number' },
      { header: 'চলমান ফেজ' },
      { header: 'পরিকল্পিত শেষ' },
    ],
    rows: units.map((unit) => {
      const summary = summarizePhases(unit.phases, now);
      const last = unit.phases[unit.phases.length - 1];
      return [
        unit.project.name,
        unit.project.location,
        unit.unitNo,
        UNIT_STATUS_LABEL[unit.status],
        unit.project.engineer?.name ?? null,
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
      { header: 'ইউনিট' },
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
      row.unitLabel,
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
              sale: {
                select: {
                  customer: { select: { user: { select: { name: true, phone: true } } } },
                  unit: { select: { unitNo: true, project: { select: { name: true } } } },
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
      { header: 'ইউনিট' },
      { header: 'কিস্তি' },
      { header: 'কিস্তির শেষ তারিখ' },
      { header: 'জমা (৳)', kind: 'money' },
      { header: 'মাধ্যম' },
      { header: 'রেফারেন্স' },
      { header: 'গ্রহণকারী' },
    ],
    rows: payments.map((payment) => {
      const sale = payment.installment.paymentPlan.sale;
      return [
        payment.receiptNo,
        dateLabel(payment.paidAt),
        sale.customer.user.name,
        sale.customer.user.phone,
        `${sale.unit.project.name} — ${sale.unit.unitNo}`,
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
