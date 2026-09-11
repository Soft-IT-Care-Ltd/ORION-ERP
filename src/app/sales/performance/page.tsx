import { redirect } from 'next/navigation';
import { differenceInCalendarDays, startOfMonth } from 'date-fns';
import { LeadStage, type Prisma } from '@prisma/client';
import { CalendarPlus, KanbanSquare, Percent, Timer, Trophy } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { getAuthorizedUser } from '@/lib/guards';
import { can } from '@/lib/rbac';
import { findAssignableExecutives, leadScope } from '@/lib/lead-access';
import { loadSalesFunnel } from '@/lib/report-data';
import { parseFunnelRange, FUNNEL_RANGE_LABEL } from '@/lib/reports';
import { formatBDT } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/stat-card';
import { RangeTabs } from '@/components/reports/range-tabs';
import { SalesFunnelChart } from '@/app/admin/dashboard/sales-funnel-chart';
import { ExecutiveFilter } from '../follow-up/executive-filter';

export const metadata = { title: 'পারফরম্যান্স' };

// লগইন করা ইউজারভেদে আলাদা ডেটা
export const dynamic = 'force-dynamic';

/**
 * PRD সেকশন ৫.১০ — "রিপোর্ট/অ্যানালিটিক্স: নিজের performance"।
 *
 * এক্সিকিউটিভ নিজের ফানেল ও KPI দেখেন; ADMIN ড্রপডাউন থেকে যে কারও পারফরম্যান্স
 * দেখতে পারেন। ফানেলের হিসাবটা Admin রিপোর্টের সঙ্গে এক (`loadSalesFunnel`) —
 * দুই জায়গায় আলাদা নিয়ম থাকলে সংখ্যা মিলত না।
 */
export default async function PerformancePage({
  searchParams,
}: {
  searchParams: { executive?: string; range?: string };
}) {
  const user = await getAuthorizedUser('lead:viewOwn');
  if (!user) redirect('/');

  const viewAll = can(user.role, 'lead:viewAll');
  const executives = viewAll ? await findAssignableExecutives() : [];
  const range = parseFunnelRange(searchParams.range);
  const now = new Date();

  // ADMIN কাউকে বাছাই না করলে পুরো কোম্পানির সংখ্যা; অন্য role এ সবসময় নিজেরটাই
  const selectedId = viewAll ? searchParams.executive?.trim() || undefined : user.id;
  const scope: Prisma.LeadWhereInput = viewAll
    ? selectedId
      ? selectedId === 'unassigned'
        ? { assignedToId: null }
        : { assignedToId: selectedId }
      : {}
    : leadScope(user);

  const subject =
    selectedId && selectedId !== 'unassigned'
      ? executives.find((e) => e.id === selectedId)?.name ?? user.name
      : selectedId === 'unassigned'
        ? 'অ্যাসাইন করা হয়নি'
        : viewAll
          ? 'সব এক্সিকিউটিভ'
          : user.name;

  const monthStart = startOfMonth(now);

  const [funnel, totalAssigned, newThisMonth, wonThisMonth, wonLeads] = await Promise.all([
    loadSalesFunnel(range, now, scope),
    prisma.lead.count({ where: scope }),
    prisma.lead.count({ where: { ...scope, createdAt: { gte: monthStart } } }),
    prisma.lead.count({
      where: { ...scope, stage: LeadStage.WON, project: { createdAt: { gte: monthStart } } },
    }),
    // lead-to-won দিন হিসাব করতে — Project.createdAt ই কনভার্শনের মুহূর্ত
    prisma.lead.findMany({
      where: { ...scope, stage: LeadStage.WON, project: { isNot: null } },
      select: {
        createdAt: true,
        project: { select: { createdAt: true, totalContractValue: true } },
      },
    }),
  ]);

  // গড় lead-to-won দিন — কনভার্ট হওয়া লিড না থাকলে দেখানোর কিছু নেই
  const conversionDays = wonLeads
    .map((lead) =>
      lead.project ? Math.max(0, differenceInCalendarDays(lead.project.createdAt, lead.createdAt)) : null,
    )
    .filter((days): days is number => days !== null);
  const avgDays =
    conversionDays.length > 0
      ? Math.round(conversionDays.reduce((a, b) => a + b, 0) / conversionDays.length)
      : null;

  const contractValue = wonLeads.reduce(
    (sum, lead) => sum + Number(lead.project?.totalContractValue ?? 0),
    0,
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">পারফরম্যান্স</h1>
          <p className="text-sm text-muted-foreground">
            {subject} · ফানেল {FUNNEL_RANGE_LABEL[range].toLowerCase()} এ তৈরি হওয়া লিডের
          </p>
        </div>
        {viewAll ? (
          <ExecutiveFilter
            executives={executives}
            selected={searchParams.executive}
            label="এক্সিকিউটিভ নির্বাচন"
          />
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="মোট assigned লিড" value={totalAssigned} icon={KanbanSquare} />
        <StatCard label="এই মাসে নতুন লিড" value={newThisMonth} icon={CalendarPlus} />
        <StatCard
          label="এই মাসে Won"
          value={wonThisMonth}
          icon={Trophy}
          tone="text-emerald-600"
        />
        <StatCard label="Win rate" value={`${funnel.winRate}%`} icon={Percent} />
        <StatCard
          label="গড় lead → Won"
          value={avgDays === null ? '—' : `${avgDays} দিন`}
          icon={Timer}
        />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">ফানেল ও stage-to-stage কনভার্শন</CardTitle>
              <CardDescription>
                প্রতিটি বার = অন্তত ওই ধাপ পর্যন্ত পৌঁছানো লিড (Lost সহ, তার সর্বোচ্চ ধাপে গোনা)।
                বারের ডানে পরের ধাপে যাওয়ার হার।
              </CardDescription>
            </div>
            <RangeTabs
              basePath="/sales/performance"
              param="range"
              current={range}
              extraParams={{ executive: searchParams.executive }}
            />
          </div>
        </CardHeader>
        <CardContent>
          <SalesFunnelChart report={funnel} />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">ধাপে ধাপে কনভার্শন</CardTitle>
            <CardDescription>
              কোথায় সবচেয়ে বেশি লিড আটকে যাচ্ছে — সেখানেই মনোযোগ দরকার (PRD সেকশন ৩)।
            </CardDescription>
          </CardHeader>
          <CardContent>
            {funnel.total === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                এই সময়সীমায় কোনো লিড নেই।
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[380px] text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="pb-2 pr-3 font-medium">ধাপ</th>
                      <th className="pb-2 pr-3 text-right font-medium">লিড</th>
                      <th className="pb-2 text-right font-medium">পরের ধাপে</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {funnel.rows.map((row) => (
                      <tr key={row.stage}>
                        <td className="py-2 pr-3">{row.labelBn}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{row.count}</td>
                        <td className="py-2 text-right tabular-nums">
                          {row.conversion === null ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            `${row.conversion}%`
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">সারসংক্ষেপ</CardTitle>
            <CardDescription>{FUNNEL_RANGE_LABEL[range]} এ তৈরি হওয়া লিডের ভিত্তিতে</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="divide-y text-sm">
              <div className="flex items-center justify-between py-2">
                <dt className="text-muted-foreground">ফানেলে ঢোকা লিড</dt>
                <dd className="font-medium tabular-nums">{funnel.total}</dd>
              </div>
              <div className="flex items-center justify-between py-2">
                <dt className="text-muted-foreground">Won</dt>
                <dd className="font-medium tabular-nums text-emerald-600">{funnel.won}</dd>
              </div>
              <div className="flex items-center justify-between py-2">
                <dt className="text-muted-foreground">Lost</dt>
                <dd className="font-medium tabular-nums text-destructive">{funnel.lost}</dd>
              </div>
              <div className="flex items-center justify-between py-2">
                <dt className="text-muted-foreground">Win rate</dt>
                <dd className="font-medium tabular-nums">{funnel.winRate}%</dd>
              </div>
              <div className="flex items-center justify-between py-2">
                <dt className="text-muted-foreground">মোট কন্ট্রাক্ট ভ্যালু (সব সময়)</dt>
                <dd className="font-medium tabular-nums">{formatBDT(contractValue)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
