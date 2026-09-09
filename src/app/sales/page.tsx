import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LeadStage } from '@prisma/client';
import { AlertTriangle, CalendarClock, KanbanSquare, Trophy } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { getAuthorizedUser } from '@/lib/guards';
import { can } from '@/lib/rbac';
import { leadScope } from '@/lib/lead-access';
import { cn } from '@/lib/utils';
import { LEAD_STAGES, STAGE_ACCENT, STAGE_LABEL } from '@/lib/leads';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/stat-card';
import { startOfToday } from './leads/serialize';

export const metadata = { title: 'সেলস ড্যাশবোর্ড' };

export const dynamic = 'force-dynamic';

/** ফলো-আপ বাকি আছে ধরা হয় শুধু চলমান লিডে — Won/Lost এ আর ফলো-আপ লাগে না */
const OPEN_STAGES = LEAD_STAGES.filter(
  (s) => s !== LeadStage.WON && s !== LeadStage.LOST,
) as LeadStage[];

export default async function SalesDashboard() {
  const user = await getAuthorizedUser('lead:viewOwn');
  if (!user) redirect('/');

  const viewAll = can(user.role, 'lead:viewAll');
  const scope = leadScope(user);

  const today = startOfToday();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [grouped, total, overdue, dueToday] = await Promise.all([
    prisma.lead.groupBy({ by: ['stage'], where: scope, _count: { _all: true } }),
    prisma.lead.count({ where: scope }),
    prisma.lead.count({
      where: { ...scope, stage: { in: OPEN_STAGES }, nextFollowUpAt: { lt: today } },
    }),
    prisma.lead.count({
      where: {
        ...scope,
        stage: { in: OPEN_STAGES },
        nextFollowUpAt: { gte: today, lt: tomorrow },
      },
    }),
  ]);

  const countByStage = new Map(grouped.map((g) => [g.stage, g._count._all]));
  const funnel = LEAD_STAGES.map((stage) => ({
    stage,
    count: countByStage.get(stage) ?? 0,
  }));
  const maxCount = Math.max(1, ...funnel.map((f) => f.count));
  const won = countByStage.get(LeadStage.WON) ?? 0;

  const kpis = [
    { label: 'মোট লিড', value: total, icon: KanbanSquare, tone: '' },
    { label: 'ফলো-আপ ওভারডিউ', value: overdue, icon: AlertTriangle, tone: 'text-destructive' },
    {
      label: 'আজকের ফলো-আপ',
      value: dueToday,
      icon: CalendarClock,
      tone: 'text-amber-600 dark:text-amber-500',
    },
    { label: 'Won', value: won, icon: Trophy, tone: 'text-emerald-600' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">সেলস ড্যাশবোর্ড</h1>
          <p className="text-sm text-muted-foreground">
            {viewAll ? 'সব এক্সিকিউটিভের লিড' : 'আপনার assigned লিডের সারসংক্ষেপ'}
          </p>
        </div>
        <Link
          href="/sales/pipeline"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <KanbanSquare className="h-4 w-4" />
          পাইপলাইন খুলুন
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <StatCard key={kpi.label} {...kpi} />
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">ফানেল — স্টেজ অনুযায়ী লিড</CardTitle>
          <CardDescription>
            প্রতিটি লিড এখন যে স্টেজে আছে তার সংখ্যা
            {viewAll ? '' : ' (শুধু আপনার assigned লিড)'} । সময়-ভিত্তিক conversion rate রিপোর্ট
            Phase 6 এ আসবে।
          </CardDescription>
        </CardHeader>
        <CardContent>
          {total === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              এখনো কোনো লিড নেই —{' '}
              <Link href="/sales/pipeline" className="font-medium underline">
                পাইপলাইন
              </Link>{' '}
              থেকে প্রথম লিড যোগ করুন।
            </p>
          ) : (
            <ul className="space-y-2">
              {funnel.map(({ stage, count }) => (
                <li key={stage}>
                  <Link
                    href="/sales/pipeline"
                    className="flex items-center gap-3 rounded-md px-1 py-1 hover:bg-muted/60"
                  >
                    <span className="w-36 shrink-0 truncate text-xs sm:w-44 sm:text-sm">
                      {STAGE_LABEL[stage]}
                    </span>
                    <span className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
                      <span
                        className={cn('block h-full rounded-full', STAGE_ACCENT[stage])}
                        style={{ width: `${Math.round((count / maxCount) * 100)}%` }}
                      />
                    </span>
                    <span className="w-8 shrink-0 text-right text-sm font-semibold tabular-nums">
                      {count}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
