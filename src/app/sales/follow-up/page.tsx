import { redirect } from 'next/navigation';
import { format } from 'date-fns';
import { LeadStage, type Prisma } from '@prisma/client';
import { AlertTriangle, CalendarCheck, CalendarClock, CalendarDays } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { getAuthorizedUser } from '@/lib/guards';
import { can } from '@/lib/rbac';
import { findAssignableExecutives, leadScope } from '@/lib/lead-access';
import { LEAD_STAGES, STAGE_LABEL } from '@/lib/leads';
import { formatPhoneInternational } from '@/lib/phone';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/stat-card';
import { startOfToday } from '../leads/serialize';
import { ExecutiveFilter } from './executive-filter';
import { FollowUpGroup, type FollowUpLead } from './follow-up-group';

export const metadata = { title: 'ফলো-আপ' };

// লগইন করা ইউজারভেদে আলাদা ডেটা
export const dynamic = 'force-dynamic';

/** ফলো-আপ শুধু চলমান লিডে — Won/Lost এ আর ফলো-আপ লাগে না */
const OPEN_STAGES = LEAD_STAGES.filter(
  (s) => s !== LeadStage.WON && s !== LeadStage.LOST,
) as LeadStage[];

/** "আসছে" গ্রুপে আগামী কত দিন দেখানো হবে (PRD সেকশন ৫.১ — ৭ দিনের রিমাইন্ডার) */
const UPCOMING_DAYS = 7;

export default async function FollowUpPage({
  searchParams,
}: {
  searchParams: { executive?: string };
}) {
  const user = await getAuthorizedUser('lead:viewOwn');
  if (!user) redirect('/');

  const viewAll = can(user.role, 'lead:viewAll');
  const executives = viewAll ? await findAssignableExecutives() : [];

  // Admin চাইলে একজন এক্সিকিউটিভের ফলো-আপ আলাদা করে দেখতে পারেন; অন্য role এ
  // `leadScope` এমনিতেই নিজের লিডেই আটকে রাখে, তাই ফিল্টারটি উপেক্ষিত
  const selected = viewAll ? searchParams.executive?.trim() || undefined : undefined;
  const executiveFilter: Prisma.LeadWhereInput = selected
    ? selected === 'unassigned'
      ? { assignedToId: null }
      : { assignedToId: selected }
    : {};

  const today = startOfToday();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const horizon = new Date(today);
  horizon.setDate(horizon.getDate() + UPCOMING_DAYS + 1);

  const baseWhere: Prisma.LeadWhereInput = {
    ...leadScope(user),
    ...executiveFilter,
    stage: { in: OPEN_STAGES },
  };

  const rows = await prisma.lead.findMany({
    where: {
      ...baseWhere,
      nextFollowUpAt: { not: null, lt: horizon },
    },
    select: {
      id: true,
      name: true,
      phone: true,
      stage: true,
      nextFollowUpAt: true,
      assignedTo: { select: { name: true } },
      // শেষ নোটটি — কার্ডে "সর্বশেষ কী কথা হয়েছিল" দেখানোর জন্য
      activities: {
        select: { note: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
    orderBy: [{ nextFollowUpAt: 'asc' }, { updatedAt: 'desc' }],
    take: 300,
  });

  const toView = (row: (typeof rows)[number]): FollowUpLead => {
    const last = row.activities[0];
    return {
      id: row.id,
      name: row.name,
      phone: formatPhoneInternational(row.phone),
      phoneE164: row.phone,
      stageLabel: STAGE_LABEL[row.stage],
      assignedToName: row.assignedTo?.name ?? null,
      followUpDate: row.nextFollowUpAt ? format(row.nextFollowUpAt, 'yyyy-MM-dd') : '',
      followUpLabel: row.nextFollowUpAt ? format(row.nextFollowUpAt, 'dd MMM yyyy') : '—',
      lastNote: last?.note ?? null,
      lastNoteLabel: last ? format(last.createdAt, 'dd MMM yyyy') : null,
    };
  };

  // তিন গ্রুপ — বকেয়া / আজকে / আগামী ৭ দিন (PRD সেকশন ৫.১)
  const overdue: FollowUpLead[] = [];
  const dueToday: FollowUpLead[] = [];
  const upcoming: FollowUpLead[] = [];

  for (const row of rows) {
    if (!row.nextFollowUpAt) continue;
    const view = toView(row);
    if (row.nextFollowUpAt < today) overdue.push(view);
    else if (row.nextFollowUpAt < tomorrow) dueToday.push(view);
    else upcoming.push(view);
  }

  const canEdit = can(user.role, 'lead:edit');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">ফলো-আপ</h1>
          <p className="text-sm text-muted-foreground">
            {viewAll ? 'সব এক্সিকিউটিভের' : 'আপনার'} লিড যেগুলোর ফলো-আপ বকেয়া, আজকে, বা আগামী{' '}
            {UPCOMING_DAYS} দিনের মধ্যে
          </p>
        </div>
        {viewAll ? (
          <ExecutiveFilter executives={executives} selected={searchParams.executive} />
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="বকেয়া (Overdue)"
          value={overdue.length}
          icon={AlertTriangle}
          tone="text-destructive"
        />
        <StatCard
          label="আজকে"
          value={dueToday.length}
          icon={CalendarClock}
          tone="text-amber-600 dark:text-amber-500"
        />
        <StatCard label={`আসছে (${UPCOMING_DAYS} দিন)`} value={upcoming.length} icon={CalendarDays} />
        <StatCard label="মোট" value={rows.length} icon={CalendarCheck} />
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">সব ফলো-আপ শেষ</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="py-6 text-center text-sm text-muted-foreground">
              এই মুহূর্তে বকেয়া বা আসন্ন কোনো ফলো-আপ নেই। লিড ডিটেইল বা পাইপলাইন থেকে পরবর্তী
              ফলো-আপ তারিখ বসিয়ে রাখুন।
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <FollowUpGroup
            title="আজকে"
            tone="today"
            leads={dueToday}
            canLog={canEdit}
            showAssignee={viewAll}
          />
          <FollowUpGroup
            title="বকেয়া (Overdue)"
            tone="overdue"
            leads={overdue}
            canLog={canEdit}
            showAssignee={viewAll}
          />
          <FollowUpGroup
            title={`আসছে (${UPCOMING_DAYS} দিনের মধ্যে)`}
            tone="upcoming"
            leads={upcoming}
            canLog={canEdit}
            showAssignee={viewAll}
          />
        </div>
      )}
    </div>
  );
}
