import Link from 'next/link';
import { redirect } from 'next/navigation';
import { format } from 'date-fns';
import { AlertTriangle, CalendarClock, ChevronRight, Wallet } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { getAuthorizedUser } from '@/lib/guards';
import { markOverdueInstallments } from '@/lib/payment-data';
import { computeInstallmentStatus } from '@/lib/payments';
import { SALE_STATUS_BADGE, SALE_STATUS_LABEL } from '@/lib/sales';
import { cn, formatBDT } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

export const metadata = { title: 'পেমেন্ট শিডিউল' };

/**
 * PRD সেকশন ৫.৩ — সব সেলের পেমেন্ট প্ল্যানের অবস্থা এক তালিকায়।
 * প্ল্যান বাকি থাকা সেলগুলো আগে দেখানো হয় — সেটাই অ্যাকাউন্টসের পরের কাজ।
 */
export default async function SchedulesPage() {
  const accounts = await getAuthorizedUser('paymentPlan:view');
  if (!accounts) redirect('/');

  const now = new Date();
  // পেজ খুললেই স্ট্যাটাস তাজা — cron না চললেও তালিকা সঠিক থাকে
  await markOverdueInstallments(now);

  const sales = await prisma.sale.findMany({
    select: {
      id: true,
      totalAmount: true,
      saleDate: true,
      status: true,
      customer: { select: { user: { select: { name: true, phone: true } } } },
      unit: { select: { unitNo: true, project: { select: { name: true } } } },
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
    orderBy: { saleDate: 'desc' },
  });

  const rows = sales.map((sale) => {
    const installments = sale.paymentPlan?.installments ?? [];
    let scheduled = 0;
    let collected = 0;
    let overdueAmount = 0;
    let overdueCount = 0;

    for (const installment of installments) {
      const amount = Number(installment.amount);
      const paid = installment.payments.reduce((sum, p) => sum + Number(p.amountReceived), 0);
      scheduled += amount;
      collected += paid;
      if (
        computeInstallmentStatus({ amount, dueDate: installment.dueDate }, paid, now) === 'OVERDUE'
      ) {
        overdueCount += 1;
        overdueAmount += amount - paid;
      }
    }

    return {
      id: sale.id,
      customerName: sale.customer.user.name,
      unitLabel: `${sale.unit.project.name} — ${sale.unit.unitNo}`,
      saleDate: sale.saleDate,
      status: sale.status,
      totalAmount: Number(sale.totalAmount),
      hasPlan: installments.length > 0,
      installmentCount: installments.length,
      scheduled,
      collected,
      collectedPercent: scheduled > 0 ? Math.round((collected / scheduled) * 100) : 0,
      overdueAmount,
      overdueCount,
    };
  });

  // প্ল্যান বাকি → বকেয়া আছে → বাকি সব
  const ordered = [...rows].sort((a, b) => {
    if (a.hasPlan !== b.hasPlan) return a.hasPlan ? 1 : -1;
    if ((a.overdueCount > 0) !== (b.overdueCount > 0)) return a.overdueCount > 0 ? -1 : 1;
    return b.saleDate.getTime() - a.saleDate.getTime();
  });

  const pendingPlans = rows.filter((r) => !r.hasPlan).length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">পেমেন্ট শিডিউল</h1>
        <p className="text-sm text-muted-foreground">
          মোট {rows.length} টি সেল
          {pendingPlans > 0 ? (
            <span className="font-medium text-amber-700 dark:text-amber-500">
              {' '}
              · {pendingPlans} টিতে প্ল্যান বাকি
            </span>
          ) : null}
        </p>
      </div>

      {ordered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <Wallet className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium">এখনো কোনো সেল নেই</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              সেলস প্যানেলে কোনো লিড &quot;Won&quot; হলে এখানে সেলটি আসবে — তখন পেমেন্ট প্ল্যান সেট
              করা যাবে।
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-2">
          {ordered.map((row) => (
            <li key={row.id}>
              <Link
                href={`/accounts/schedule/${row.id}`}
                className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-medium">{row.customerName}</span>
                    <Badge variant="secondary" className={cn('text-[11px]', SALE_STATUS_BADGE[row.status])}>
                      {SALE_STATUS_LABEL[row.status]}
                    </Badge>
                    {!row.hasPlan ? (
                      <Badge variant="outline" className="border-amber-500/50 text-[11px] text-amber-700 dark:text-amber-500">
                        <CalendarClock className="mr-1 h-3 w-3" />
                        প্ল্যান বাকি
                      </Badge>
                    ) : null}
                    {row.overdueCount > 0 ? (
                      <Badge variant="destructive" className="text-[11px]">
                        <AlertTriangle className="mr-1 h-3 w-3" />
                        {row.overdueCount} টি বকেয়া · {formatBDT(row.overdueAmount)}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="truncate text-sm text-muted-foreground">
                    {row.unitLabel} · সেল {format(row.saleDate, 'dd MMM yyyy')} ·{' '}
                    {formatBDT(row.totalAmount)}
                  </p>
                  {row.hasPlan ? (
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-full max-w-48 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-emerald-600"
                          style={{ width: `${Math.min(100, row.collectedPercent)}%` }}
                        />
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                        {formatBDT(row.collected)} / {formatBDT(row.scheduled)} (
                        {row.collectedPercent}%) · {row.installmentCount} কিস্তি
                      </span>
                    </div>
                  ) : null}
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
