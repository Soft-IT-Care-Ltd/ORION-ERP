import { addDays, endOfDay, format, startOfDay, subDays } from 'date-fns';
import { InstallmentStatus, LeadStage, Prisma, Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { agingBucket, type AgingBucket } from '@/lib/payments';
import { formatBDT } from '@/lib/utils';

/**
 * In-app notification — PRD সেকশন ৫.৬ (Notifications & Reminders)।
 *
 * দুই স্তর:
 *
 *  ১. **তাৎক্ষণিক** — কোনো ইউজারের অ্যাকশনের সাথে সাথে (`notify` / `notifyMany`)।
 *     যেমন লিড অ্যাসাইন, পেমেন্ট এন্ট্রি, ডকুমেন্ট আপলোড। কল-সাইট server action এ।
 *
 *  ২. **সময়-নির্ভর (sweep)** — কেউ কিছু না করলেও নিছক তারিখ পেরোলেই যেগুলো ঘটে:
 *     ফলো-আপ ওভারডিউ, কিস্তির ৭ দিন আগের রিমাইন্ডার, বকেয়া কিস্তি। এগুলো
 *     `runNotificationSweep()` স্ক্যান করে লেখে — `/api/cron/overdue` থেকে রোজ,
 *     আর cron না চললেও বেল লোডের সময় ঘণ্টায় একবার (`sweepIfStale`)।
 *
 * sweep বারবার চলে বলে প্রতিটি sweep-নোটিফিকেশনে একটি স্থিতিশীল `key` থাকে
 * (`Notification.@@unique([userId, key])`) — একই খবর একই ইউজারকে দ্বিতীয়বার
 * লেখা হয় না। বকেয়ার ক্ষেত্রে key তে aging বালতিটিও থাকে, তাই বকেয়া পুরনো হয়ে
 * পরের বালতিতে গেলে (১৫ → ৩০ → ৩০+ দিন) একটি নতুন, জোরালো রিমাইন্ডার যায়।
 *
 * এটি server-only (`lib/prisma` import করে) — client component থেকে শুধু
 * `import type` করা যাবে।
 */

export type NotificationType =
  | 'FOLLOW_UP_DUE'
  | 'PAYMENT_DUE'
  | 'PAYMENT_OVERDUE'
  | 'PHASE_MILESTONE'
  | 'DOCUMENT_UPLOADED'
  | 'LEAD_ASSIGNED'
  | 'SALE_DRAFT_CREATED';

/** বেল ড্রপডাউনে একবারে সর্বোচ্চ কতগুলো দেখানো হবে */
export const NOTIFICATION_FEED_LIMIT = 15;

/* ------------------------------------------------------------- write */

type NotifyInput = {
  userId: string;
  type: NotificationType;
  message: string;
  /** ক্লিক করলে যেখানে যাবে */
  link?: string | null;
  /** পুনরাবৃত্ত ইভেন্টের ডিডুপ কী — এককালীন খবরে দিতে হয় না */
  key?: string | null;
};

export async function notify(params: NotifyInput) {
  return prisma.notification.create({
    data: {
      userId: params.userId,
      type: params.type,
      message: params.message,
      link: params.link ?? null,
      key: params.key ?? null,
    },
  });
}

/**
 * একই মেসেজ একাধিক ইউজারকে (যেমন সব Accounts + Admin কে ড্রাফট সেলের খবর)।
 * খালি তালিকায় কিছুই লেখে না।
 */
export async function notifyMany(params: {
  userIds: string[];
  type: NotificationType;
  message: string;
  link?: string | null;
  key?: string | null;
}) {
  if (params.userIds.length === 0) return { count: 0 };
  return writeNotifications(
    params.userIds.map((userId) => ({
      userId,
      type: params.type,
      message: params.message,
      link: params.link ?? null,
      key: params.key ?? null,
    })),
  );
}

/**
 * ব্যাচ ইনসার্ট — sweep গুলো এটিই ব্যবহার করে (সারি-প্রতি একটি কুয়েরি নয়)।
 *
 * `skipDuplicates` DB এর unique কনস্ট্রেইন্টে আটকানো সারিগুলো নীরবে বাদ দেয়;
 * একই ব্যাচের ভেতরের পুনরাবৃত্তি আগেই JS এ ছেঁকে ফেলা হয়। key ছাড়া সারি
 * (এককালীন খবর) কখনো ডুপ্লিকেট গণ্য হয় না — NULL Postgres এ স্বতন্ত্র।
 */
async function writeNotifications(rows: Prisma.NotificationCreateManyInput[]) {
  const seen = new Set<string>();
  const data = rows.filter((row) => {
    if (!row.key) return true;
    const id = `${row.userId}|${row.key}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  if (data.length === 0) return { count: 0 };
  return prisma.notification.createMany({ data, skipDuplicates: true });
}

export async function markAsRead(notificationId: string, userId?: string) {
  // userId দিলে ownership সহ — অন্যের নোটিফিকেশন id দিয়ে পড়া-চিহ্নিত করা যাবে না
  return prisma.notification.updateMany({
    where: { id: notificationId, ...(userId ? { userId } : {}) },
    data: { readStatus: true },
  });
}

export async function markAllAsRead(userId: string) {
  return prisma.notification.updateMany({
    where: { userId, readStatus: false },
    data: { readStatus: true },
  });
}

/* -------------------------------------------------------------- read */

export type NotificationView = {
  id: string;
  type: NotificationType;
  message: string;
  link: string | null;
  readStatus: boolean;
  /** server এ ফরম্যাট করা — client এ করলে TZ ভেদে hydration mismatch হতো */
  createdAtLabel: string;
};

export type NotificationFeed = {
  items: NotificationView[];
  unreadCount: number;
};

/** বেলের ড্রপডাউন — সাম্প্রতিক কয়েকটি + মোট অপঠিত সংখ্যা */
export async function loadNotifications(
  userId: string,
  limit = NOTIFICATION_FEED_LIMIT,
): Promise<NotificationFeed> {
  const [rows, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        type: true,
        message: true,
        link: true,
        readStatus: true,
        createdAt: true,
      },
    }),
    prisma.notification.count({ where: { userId, readStatus: false } }),
  ]);

  return {
    items: rows.map((row) => ({
      id: row.id,
      type: row.type as NotificationType,
      message: row.message,
      link: row.link,
      readStatus: row.readStatus,
      createdAtLabel: format(row.createdAt, 'dd MMM yyyy, h:mm a'),
    })),
    unreadCount,
  };
}

/* -------------------------------------------------------- dedupe key */

/**
 * sweep-নোটিফিকেশনের স্থিতিশীল কী।
 *
 * ফলো-আপের কী তে তারিখটাও আছে — তাই এক্সিকিউটিভ ফলো-আপ পিছিয়ে দিলে সেটি
 * আবার পেরোনোর পর নতুন রিমাইন্ডার যাবে, কিন্তু একই তারিখের জন্য একবারই।
 */
const KEY = {
  followUp: (leadId: string, due: Date) => `followup:${leadId}:${format(due, 'yyyy-MM-dd')}`,
  installmentDueSoon: (installmentId: string) => `due-soon:${installmentId}`,
  installmentOverdue: (installmentId: string, bucket: AgingBucket) =>
    `overdue:${installmentId}:${bucket}`,
  phaseDone: (phaseId: string) => `phase-done:${phaseId}`,
};

/* --------------------------------------------------- recipient lookup */

/**
 * কিস্তির খবর কারা পাবেন — PRD সেকশন ৫.৩: "customer + accounts কে"।
 * সক্রিয় ACCOUNTS ইউজার একজনও না থাকলে ADMIN রা পান, নইলে খবরটা কোথাও পৌঁছাত না।
 */
async function collectionStaffIds(): Promise<string[]> {
  const accounts = await prisma.user.findMany({
    where: { active: true, role: Role.ACCOUNTS },
    select: { id: true },
  });
  if (accounts.length > 0) return accounts.map((u) => u.id);

  const admins = await prisma.user.findMany({
    where: { active: true, role: Role.ADMIN },
    select: { id: true },
  });
  return admins.map((u) => u.id);
}

/* ------------------------------------------------------- follow-up due */

/**
 * PRD সেকশন ৫.১ — ফলো-আপের তারিখ পেরিয়ে গেছে অথচ লিডটি এখনো খোলা।
 * assigned marketing executive কে জানানো হয়; Won/Lost লিড বাদ।
 *
 * "পেরিয়ে গেছে" মানে আজকের দিন শুরুর আগে — `lib/leads.ts` এর `followUpTone`
 * যে নিয়মে কার্ডকে লাল দেখায়, ঠিক সেটিই।
 */
export async function notifyDueFollowUps(now = new Date()) {
  const leads = await prisma.lead.findMany({
    where: {
      nextFollowUpAt: { lt: startOfDay(now) },
      stage: { notIn: [LeadStage.WON, LeadStage.LOST] },
      assignedTo: { is: { active: true } },
    },
    select: { id: true, name: true, nextFollowUpAt: true, assignedToId: true },
  });

  const rows = leads.flatMap((lead) => {
    if (!lead.assignedToId || !lead.nextFollowUpAt) return [];
    return [
      {
        userId: lead.assignedToId,
        type: 'FOLLOW_UP_DUE' satisfies NotificationType,
        message: `ফলো-আপের তারিখ পেরিয়ে গেছে — ${lead.name} (${format(lead.nextFollowUpAt, 'dd MMM yyyy')})`,
        link: `/sales/leads/${lead.id}`,
        key: KEY.followUp(lead.id, lead.nextFollowUpAt),
      },
    ];
  });

  const { count } = await writeNotifications(rows);
  return { scanned: leads.length, created: count };
}

/* ------------------------------------------------ installment reminders */

/** কিস্তি + সেল/কাস্টমার/ইউনিটের পরিচিতি — দুই রিমাইন্ডারেই একই select */
const dueInstallmentSelect = {
  id: true,
  label: true,
  dueDate: true,
  amount: true,
  payments: { select: { amountReceived: true } },
  paymentPlan: {
    select: {
      sale: {
        select: {
          id: true,
          customer: { select: { userId: true, user: { select: { name: true, active: true } } } },
          unit: { select: { unitNo: true, project: { select: { name: true } } } },
        },
      },
    },
  },
} satisfies Prisma.InstallmentSelect;

type DueInstallment = Prisma.InstallmentGetPayload<{ select: typeof dueInstallmentSelect }>;

/** এখনো কত টাকা বাকি — আংশিক আদায় বাদ দিয়ে */
function remainingOf(row: DueInstallment) {
  const paid = row.payments.reduce((sum, p) => sum + Number(p.amountReceived), 0);
  return Number(row.amount) - paid;
}

/**
 * PRD সেকশন ৫.৩ — due date এর ৭ দিন আগে রিমাইন্ডার (customer + accounts কে)।
 *
 * আজ থেকে আগামী ৭ দিনের মধ্যে যেসব কিস্তির তারিখ, সেগুলোই। প্রতিটি কিস্তির
 * জন্য মাত্র একবার — key তে installment id, তাই sweep রোজ চললেও পুনরাবৃত্তি নেই।
 */
export async function notifyUpcomingInstallments(now = new Date()) {
  const rows = await prisma.installment.findMany({
    where: {
      dueDate: { gte: startOfDay(now), lte: endOfDay(addDays(now, 7)) },
      status: { not: InstallmentStatus.PAID },
    },
    select: dueInstallmentSelect,
  });

  const staffIds = rows.length > 0 ? await collectionStaffIds() : [];
  const data: Prisma.NotificationCreateManyInput[] = [];

  for (const row of rows) {
    const remaining = remainingOf(row);
    // পুরো টাকা আগেই জমা পড়ে গেছে (status এখনো সিঙ্ক হয়নি) — মনে করানোর কিছু নেই
    if (remaining <= 0) continue;

    const sale = row.paymentPlan.sale;
    const key = KEY.installmentDueSoon(row.id);
    const dateLabel = format(row.dueDate, 'dd MMM yyyy');
    const unitLabel = `${sale.unit.project.name} — ${sale.unit.unitNo}`;

    if (sale.customer.user.active) {
      data.push({
        userId: sale.customer.userId,
        type: 'PAYMENT_DUE',
        message: `আসন্ন কিস্তি — ${row.label}, ${formatBDT(remaining)} · শেষ তারিখ ${dateLabel}`,
        link: '/customer/payments',
        key,
      });
    }

    for (const userId of staffIds) {
      data.push({
        userId,
        type: 'PAYMENT_DUE',
        message: `${sale.customer.user.name} (${unitLabel}) — ${row.label} ${formatBDT(remaining)} · ${dateLabel} এ due`,
        link: `/accounts/schedule/${sale.id}`,
        key,
      });
    }
  }

  const { count } = await writeNotifications(data);
  return { scanned: rows.length, created: count };
}

/**
 * PRD সেকশন ৫.৩ — কিস্তি overdue হলে (customer + accounts কে)।
 *
 * key তে aging বালতি থাকায় প্রতিটি কিস্তিতে সর্বোচ্চ তিনটি রিমাইন্ডার যায় —
 * বকেয়া হওয়ার পর, ১৫ দিন পেরোলে, আর ৩০ দিন পেরোলে। রোজকার পুনরাবৃত্তি নেই,
 * কিন্তু বকেয়া পুরনো হলে খবরটা আবার সামনে আসে।
 */
export async function notifyOverdueInstallments(now = new Date()) {
  const rows = await prisma.installment.findMany({
    where: {
      dueDate: { lt: startOfDay(now) },
      status: { not: InstallmentStatus.PAID },
    },
    select: dueInstallmentSelect,
  });

  const staffIds = rows.length > 0 ? await collectionStaffIds() : [];
  const data: Prisma.NotificationCreateManyInput[] = [];

  for (const row of rows) {
    const remaining = remainingOf(row);
    if (remaining <= 0) continue;

    const sale = row.paymentPlan.sale;
    const days = Math.max(
      1,
      Math.round((startOfDay(now).getTime() - startOfDay(row.dueDate).getTime()) / 86_400_000),
    );
    const key = KEY.installmentOverdue(row.id, agingBucket(days));
    const unitLabel = `${sale.unit.project.name} — ${sale.unit.unitNo}`;

    if (sale.customer.user.active) {
      data.push({
        userId: sale.customer.userId,
        type: 'PAYMENT_OVERDUE',
        message: `কিস্তি বকেয়া — ${row.label}, ${formatBDT(remaining)} · ${days} দিন পেরিয়েছে`,
        link: '/customer/payments',
        key,
      });
    }

    for (const userId of staffIds) {
      data.push({
        userId,
        type: 'PAYMENT_OVERDUE',
        message: `বকেয়া ${days} দিন — ${sale.customer.user.name} (${unitLabel}) ${row.label} ${formatBDT(remaining)}`,
        link: '/accounts/overdue',
        key,
      });
    }
  }

  const { count } = await writeNotifications(data);
  return { scanned: rows.length, created: count };
}

/* ---------------------------------------------------- phase milestone */

/** sweep মোডে এত দিনের মধ্যে শেষ হওয়া ফেজগুলোই ধরা হয় — পুরনো খবর পাঠানো হয় না */
const PHASE_DONE_LOOKBACK_DAYS = 30;

/**
 * PRD সেকশন ৫.২/৫.৬ — ফেজ "DONE" হলে কাস্টমারকে জানানো।
 *
 * `Phase.status` একটি স্ন্যাপশট (`lib/phases.ts` দ্রষ্টব্য), তাই শর্তটি
 * `percentComplete >= 100` — `computePhaseStatus` ঠিক এই নিয়মেই DONE বলে।
 *
 * দুই ভাবে চলে: ইঞ্জিনিয়ার ১০০% দেওয়ার সাথে সাথে (`phaseId` দিয়ে), আর sweep এ
 * (সাম্প্রতিক শেষ হওয়া সব ফেজ)। key এক বলে দুটোতে একই খবর দুবার যায় না —
 * অ্যাডমিন সরাসরি ফেজ এডিট করে ১০০% করলেও কাস্টমার খবরটা পাবেন।
 */
export async function notifyDonePhases(params: { phaseId?: string; now?: Date } = {}) {
  const now = params.now ?? new Date();

  const phases = await prisma.phase.findMany({
    where: {
      ...(params.phaseId
        ? { id: params.phaseId }
        : { actualEnd: { gte: subDays(startOfDay(now), PHASE_DONE_LOOKBACK_DAYS) } }),
      percentComplete: { gte: 100 },
      unit: { sale: { isNot: null } },
    },
    select: {
      id: true,
      name: true,
      unit: {
        select: {
          unitNo: true,
          project: { select: { name: true } },
          sale: {
            select: { customer: { select: { userId: true, user: { select: { active: true } } } } },
          },
        },
      },
    },
  });

  const data = phases.flatMap((phase) => {
    const customer = phase.unit.sale?.customer;
    if (!customer || !customer.user.active) return [];
    return [
      {
        userId: customer.userId,
        type: 'PHASE_MILESTONE' satisfies NotificationType,
        message: `"${phase.name}" ফেজ সম্পন্ন হয়েছে — ${phase.unit.project.name} · ${phase.unit.unitNo}`,
        link: '/customer/progress',
        key: KEY.phaseDone(phase.id),
      },
    ];
  });

  const { count } = await writeNotifications(data);
  return { scanned: phases.length, created: count };
}

/* -------------------------------------------------------------- sweep */

export type SweepResult = {
  followUps: { scanned: number; created: number };
  upcomingInstallments: { scanned: number; created: number };
  overdueInstallments: { scanned: number; created: number };
  donePhases: { scanned: number; created: number };
  created: number;
};

/**
 * তিন ধরনের সময়-নির্ভর নোটিফিকেশন একসাথে (PRD সেকশন ৫.৬)।
 * idempotent — দিনে যতবারই চলুক, একই খবর দ্বিতীয়বার লেখা হয় না।
 */
export async function runNotificationSweep(now = new Date()): Promise<SweepResult> {
  const followUps = await notifyDueFollowUps(now);
  const upcomingInstallments = await notifyUpcomingInstallments(now);
  const overdueInstallments = await notifyOverdueInstallments(now);
  const donePhases = await notifyDonePhases({ now });

  return {
    followUps,
    upcomingInstallments,
    overdueInstallments,
    donePhases,
    created:
      followUps.created +
      upcomingInstallments.created +
      overdueInstallments.created +
      donePhases.created,
  };
}

/** দুটি sweep এর মধ্যে ন্যূনতম বিরতি — বেল লোডের ফলব্যাক পথের জন্য */
const SWEEP_INTERVAL_MS = 60 * 60 * 1000;
let lastSweepAt = 0;

/**
 * cron ছাড়াও নোটিফিকেশন যাতে আসে, তার ফলব্যাক — বেল রেন্ডারের সময় ডাকা হয়
 * (`PanelShell`), কিন্তু ঘণ্টায় একবারের বেশি চলে না।
 *
 * থ্রটলটি ইন-মেমরি, তাই একাধিক সার্ভার ইনস্ট্যান্স থাকলে প্রতিটিতে আলাদা করে
 * চলবে — ক্ষতি নেই, sweep idempotent। প্রোডাকশনে `/api/cron/overdue` ই আসল পথ;
 * এটি শুধু নিশ্চিত করে যে cron সেট না করা থাকলেও রিমাইন্ডার হারিয়ে যায় না।
 */
export async function sweepIfStale(now = new Date()): Promise<SweepResult | null> {
  if (now.getTime() - lastSweepAt < SWEEP_INTERVAL_MS) return null;
  lastSweepAt = now.getTime();

  try {
    return await runNotificationSweep(now);
  } catch (error) {
    // পেজ রেন্ডার এতে ভাঙবে না — পরের ঘণ্টায় আবার চেষ্টা হবে
    console.error('notification sweep failed', error);
    return null;
  }
}
