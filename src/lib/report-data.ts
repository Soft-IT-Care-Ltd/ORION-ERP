import {
  addMonths,
  endOfMonth,
  format,
  startOfDay,
  startOfMonth,
  startOfQuarter,
  subMonths,
} from 'date-fns';
import { LeadStage, type Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { LEAD_STAGES, STAGE_LABEL, STAGE_LABEL_EN } from '@/lib/leads';
import { computePhaseStatus, overallProgress } from '@/lib/phases';
import {
  ratio,
  type CollectionMonthRow,
  type CollectionReport,
  type FunnelRange,
  type FunnelReport,
  type FunnelRow,
  type ProjectProgressRow,
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
