import Link from 'next/link';
import { redirect } from 'next/navigation';
import { format } from 'date-fns';
import { AlertTriangle, ArrowRight, ChevronRight, Wallet } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { getAuthorizedUser } from '@/lib/guards';
import {
  loadAgingReport,
  loadCollectionKpi,
  markOverdueInstallments,
} from '@/lib/payment-data';
import { computeInstallmentStatus } from '@/lib/payments';
import { PROJECT_STATUS_BADGE, PROJECT_STATUS_LABEL } from '@/lib/projects';
import { cn, formatBDT } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AgingSummary } from '@/components/payment-schedule';

export const metadata = { title: 'পেমেন্ট' };

/**
 * PRD সেকশন ৫.৭ (Financial report) — Admin এর পেমেন্ট ওভারভিউ:
 * collected vs receivable, aging, আর প্রজেক্ট-ভিত্তিক আদায়ের অবস্থা।
 *
 * প্ল্যান তৈরি/এডিট ও পেমেন্ট এন্ট্রি অ্যাকাউন্টস প্যানেলেই হয় — Admin এর
 * `ROUTE_ROLES` এ `/accounts` অনুমোদিত, তাই লিংকগুলো সেখানেই পাঠায় (দুই জায়গায়
 * একই ফর্ম রাখার দরকার নেই)।
 */
export default async function AdminPaymentsPage() {
  const admin = await getAuthorizedUser('report:financial');
  if (!admin) redirect('/');

  const now = new Date();
  await markOverdueInstallments(now);

  const [kpi, aging, projectRows] = await Promise.all([
    loadCollectionKpi(now),
    loadAgingReport(now),
    prisma.project.findMany({
      select: {
        id: true,
        totalContractValue: true,
        title: true,
        createdAt: true,
        startDate: true,
        status: true,
        customer: { select: { user: { select: { name: true } } } },
        paymentPlan: {
          select: {
            installments: {
              select: {
                amount: true,
                dueDate: true,
                payments: { select: { amountReceived: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const rows = projectRows.map((project) => {
    const installments = project.paymentPlan?.installments ?? [];
    let scheduled = 0;
    let collected = 0;
    let overdue = 0;

    for (const installment of installments) {
      const amount = Number(installment.amount);
      const paid = installment.payments.reduce((sum, p) => sum + Number(p.amountReceived), 0);
      scheduled += amount;
      collected += paid;
      if (
        computeInstallmentStatus({ amount, dueDate: installment.dueDate }, paid, now) === 'OVERDUE'
      ) {
        overdue += amount - paid;
      }
    }

    return {
      id: project.id,
      customerName: project.customer.user.name,
      projectTitle: project.title,
      startedAt: project.startDate ?? project.createdAt,
      status: project.status,
      totalAmount: Number(project.totalContractValue),
      hasPlan: installments.length > 0,
      scheduled,
      collected,
      overdue,
      percent: scheduled > 0 ? Math.round((collected / scheduled) * 100) : 0,
    };
  });

  const collectedPercent =
    kpi.planTotal > 0 ? Math.round((kpi.planCollected / kpi.planTotal) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">পেমেন্ট ওভারভিউ</h1>
          <p className="text-sm text-muted-foreground">
            সব প্রজেক্ট মিলিয়ে collected vs receivable ও বকেয়ার অবস্থা
          </p>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href="/accounts/schedule">
            শিডিউল ম্যানেজ করুন
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="প্ল্যানের মোট" value={formatBDT(kpi.planTotal)} />
        <Kpi
          label="আদায়কৃত"
          value={formatBDT(kpi.planCollected)}
          hint={`${collectedPercent}%`}
          tone="text-emerald-700 dark:text-emerald-400"
        />
        <Kpi label="অনাদায়ী" value={formatBDT(kpi.outstanding)} />
        <Kpi
          label="বকেয়া"
          value={formatBDT(aging.totalAmount)}
          hint={`${aging.totalCount} কিস্তি · ${aging.totalAccounts} অ্যাকাউন্ট`}
          tone={aging.totalAmount > 0 ? 'text-destructive' : undefined}
        />
      </div>

      {aging.totalCount > 0 ? (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base">Aging সারসংক্ষেপ</CardTitle>
                <CardDescription>PRD সেকশন ৫.৩ — ০–১৫ / ১৬–৩০ / ৩০+ দিন</CardDescription>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link href="/accounts/overdue">
                  বিস্তারিত
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <AgingSummary
              buckets={aging.buckets}
              totalAmount={aging.totalAmount}
              totalCount={aging.totalCount}
              totalAccounts={aging.totalAccounts}
            />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">প্রজেক্ট-ভিত্তিক আদায়</CardTitle>
          <CardDescription>
            {rows.length} টি প্রজেক্ট · বিস্তারিত শিডিউল দেখতে যেকোনো সারিতে ক্লিক করুন
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="flex flex-col items-center gap-2 rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
              <Wallet className="h-6 w-6" />
              এখনো কোনো প্রজেক্ট নেই
            </p>
          ) : (
            <ul className="space-y-2">
              {rows.map((row) => (
                <li key={row.id}>
                  <Link
                    href={`/accounts/schedule/${row.id}`}
                    className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-medium">{row.customerName}</span>
                        <Badge
                          variant="secondary"
                          className={cn('text-[11px]', PROJECT_STATUS_BADGE[row.status])}
                        >
                          {PROJECT_STATUS_LABEL[row.status]}
                        </Badge>
                        {row.overdue > 0 ? (
                          <Badge variant="destructive" className="text-[11px]">
                            <AlertTriangle className="mr-1 h-3 w-3" />
                            {formatBDT(row.overdue)} বকেয়া
                          </Badge>
                        ) : null}
                      </div>
                      <p className="truncate text-sm text-muted-foreground">
                        {row.projectTitle} · শুরু {format(row.startedAt, 'dd MMM yyyy')} ·{' '}
                        {formatBDT(row.totalAmount)}
                      </p>
                      {row.hasPlan ? (
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-full max-w-48 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-emerald-600"
                              style={{ width: `${Math.min(100, row.percent)}%` }}
                            />
                          </div>
                          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                            {formatBDT(row.collected)} / {formatBDT(row.scheduled)} ({row.percent}%)
                          </span>
                        </div>
                      ) : (
                        <p className="text-xs font-medium text-amber-700 dark:text-amber-500">
                          পেমেন্ট প্ল্যান এখনো সেট হয়নি
                        </p>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
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

function Kpi({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: string;
}) {
  return (
    <Card>
      <CardContent className="space-y-1 p-4">
        <p className="truncate text-xs text-muted-foreground">{label}</p>
        <p className={cn('truncate text-xl font-semibold tabular-nums', tone)}>{value}</p>
        {hint ? <p className="truncate text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}
