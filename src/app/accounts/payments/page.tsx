import Link from 'next/link';
import { redirect } from 'next/navigation';
import { addDays, format, startOfDay } from 'date-fns';
import { Printer } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { getAuthorizedUser } from '@/lib/guards';
import { markOverdueInstallments, paymentReceiptWhatsAppLink } from '@/lib/payment-data';
import {
  computeInstallmentStatus,
  INSTALLMENT_STATUS_BADGE,
  INSTALLMENT_STATUS_LABEL,
  PAYMENT_METHOD_LABEL,
} from '@/lib/payments';
import { cn, formatBDT } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { WhatsAppSendButton } from '@/components/whatsapp';
import { PaymentEntryButton, type ProjectOption } from './payment-entry-dialog';
import { OverdueSweepButton } from './overdue-sweep-button';

export const metadata = { title: 'পেমেন্ট এন্ট্রি' };

/** আগামী কত দিনের কিস্তি "এখনই আদায়যোগ্য" তালিকায় আসবে */
const UPCOMING_WINDOW_DAYS = 30;

/** সাম্প্রতিক পেমেন্ট তালিকায় সর্বোচ্চ কতগুলো */
const RECENT_LIMIT = 25;

/**
 * PRD সেকশন ৫.৩ — পেমেন্ট এন্ট্রি।
 * উপরে এখনই আদায়যোগ্য কিস্তিগুলো (বকেয়া আগে), নিচে সাম্প্রতিক রসিদ।
 */
export default async function PaymentsPage() {
  const accounts = await getAuthorizedUser('payment:create');
  if (!accounts) redirect('/');

  const now = new Date();
  await markOverdueInstallments(now);

  const [dueRows, recentPayments, projectRows] = await Promise.all([
    prisma.installment.findMany({
      where: {
        status: { not: 'PAID' },
        dueDate: { lte: addDays(startOfDay(now), UPCOMING_WINDOW_DAYS) },
      },
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
    }),
    prisma.payment.findMany({
      select: {
        id: true,
        receiptNo: true,
        amountReceived: true,
        method: true,
        note: true,
        paidAt: true,
        whatsappSentAt: true,
        receivedBy: { select: { name: true } },
        installment: {
          select: {
            label: true,
            amount: true,
            payments: { select: { amountReceived: true } },
            paymentPlan: {
              select: {
                project: {
                  select: {
                    id: true,
                    title: true,
                    // রসিদ WhatsApp এ পাঠাতে নম্বরটি লাগে (PRD সেকশন ৫.২)
                    customer: { select: { user: { select: { name: true, phone: true } } } },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { paidAt: 'desc' },
      take: RECENT_LIMIT,
    }),
    prisma.project.findMany({
      where: { paymentPlan: { isNot: null } },
      select: {
        id: true,
        customer: { select: { user: { select: { name: true } } } },
        title: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const projects: ProjectOption[] = projectRows.map((project) => ({
    id: project.id,
    label: project.title,
    customerName: project.customer.user.name,
  }));

  const due = dueRows
    .map((row) => {
      const amount = Number(row.amount);
      const paid = row.payments.reduce((sum, p) => sum + Number(p.amountReceived), 0);
      const project = row.paymentPlan.project;
      return {
        id: row.id,
        label: row.label,
        dueDate: row.dueDate,
        remaining: amount - paid,
        status: computeInstallmentStatus({ amount, dueDate: row.dueDate }, paid, now),
        projectId: project.id,
        customerName: project.customer.user.name,
        projectTitle: project.title,
      };
    })
    .filter((row) => row.remaining > 0);

  const overdueTotal = due
    .filter((row) => row.status === 'OVERDUE')
    .reduce((sum, row) => sum + row.remaining, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">পেমেন্ট এন্ট্রি</h1>
          <p className="text-sm text-muted-foreground">
            আগামী {UPCOMING_WINDOW_DAYS} দিনের ও বকেয়া কিস্তি — মোট {due.length} টি
            {overdueTotal > 0 ? (
              <span className="font-medium text-destructive"> · বকেয়া {formatBDT(overdueTotal)}</span>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <OverdueSweepButton />
          <PaymentEntryButton projects={projects} />
        </div>
      </div>

      <Card>
        <CardHeader className="p-4 pb-3 sm:p-6 sm:pb-3">
          <CardTitle className="text-base">এখনই আদায়যোগ্য</CardTitle>
          <CardDescription>বকেয়া কিস্তি আগে, তারপর তারিখের ক্রমে</CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
          {due.length === 0 ? (
            <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              আগামী {UPCOMING_WINDOW_DAYS} দিনে আদায়যোগ্য কোনো কিস্তি নেই
            </p>
          ) : (
            <ul className="space-y-2">
              {[...due]
                .sort((a, b) => {
                  const aOverdue = a.status === 'OVERDUE';
                  const bOverdue = b.status === 'OVERDUE';
                  if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
                  return a.dueDate.getTime() - b.dueDate.getTime();
                })
                .map((row) => (
                  <li
                    key={row.id}
                    className={cn(
                      'flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-lg border p-3',
                      row.status === 'OVERDUE' ? 'border-destructive/30 bg-destructive/5' : null,
                    )}
                  >
                    {/* মোবাইলে তথ্য নিজের সারি পায় — নইলে `flex-1` অংশটি অঙ্ক ও
                        বোতামের চাপে ~৫০px এ নেমে গিয়ে নাম/প্রজেক্ট দুটোই "মোঃ র…" হয়ে যেত */}
                    <div className="w-full min-w-0 sm:w-auto sm:flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/accounts/schedule/${row.projectId}`}
                          className="truncate font-medium hover:underline"
                        >
                          {row.customerName}
                        </Link>
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                            INSTALLMENT_STATUS_BADGE[row.status],
                          )}
                        >
                          {INSTALLMENT_STATUS_LABEL[row.status]}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground sm:truncate">
                        {row.projectTitle} · {row.label} · {format(row.dueDate, 'dd MMM yyyy')}
                      </p>
                    </div>
                    <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end">
                      <span className="font-semibold tabular-nums">{formatBDT(row.remaining)}</span>
                      <PaymentEntryButton
                        projects={projects}
                        initialProjectId={row.projectId}
                        initialInstallmentId={row.id}
                        label="জমা নিন"
                        size="sm"
                        variant="outline"
                      />
                    </div>
                  </li>
                ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-4 pb-3 sm:p-6 sm:pb-3">
          <CardTitle className="text-base">সাম্প্রতিক পেমেন্ট</CardTitle>
          <CardDescription>শেষ {RECENT_LIMIT} টি রসিদ — প্রিন্ট/PDF করা যাবে</CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
          {recentPayments.length === 0 ? (
            <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              এখনো কোনো পেমেন্ট রেকর্ড হয়নি
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full caption-bottom text-sm">
                <thead className="border-b bg-muted/50">
                  <tr className="text-left [&>th]:px-3 [&>th]:py-2 [&>th]:font-medium">
                    <th>রসিদ</th>
                    <th>কাস্টমার</th>
                    <th className="hidden sm:table-cell">কিস্তি</th>
                    <th className="hidden md:table-cell">মাধ্যম</th>
                    <th className="whitespace-nowrap">তারিখ</th>
                    <th className="text-right">অঙ্ক</th>
                    <th className="w-px" />
                  </tr>
                </thead>
                <tbody>
                  {recentPayments.map((payment) => {
                    const project = payment.installment.paymentPlan.project;
                    const installmentPaid = payment.installment.payments.reduce(
                      (sum, p) => sum + Number(p.amountReceived),
                      0,
                    );
                    const whatsAppUrl = paymentReceiptWhatsAppLink({
                      paymentId: payment.id,
                      receiptNo: payment.receiptNo,
                      clientName: project.customer.user.name,
                      clientPhone: project.customer.user.phone,
                      projectTitle: project.title,
                      installmentLabel: payment.installment.label,
                      amount: Number(payment.amountReceived),
                      paidAt: payment.paidAt,
                      remaining: Math.max(0, Number(payment.installment.amount) - installmentPaid),
                    });
                    return (
                      <tr key={payment.id} className="border-b last:border-0 [&>td]:px-3 [&>td]:py-2">
                        <td className="whitespace-nowrap font-medium">{payment.receiptNo}</td>
                        <td className="min-w-[9rem]">
                          <Link
                            href={`/accounts/schedule/${project.id}`}
                            className="whitespace-nowrap hover:underline"
                          >
                            {project.customer.user.name}
                          </Link>
                          <p className="line-clamp-2 text-xs text-muted-foreground">
                            {project.title}
                          </p>
                        </td>
                        <td className="hidden sm:table-cell">{payment.installment.label}</td>
                        <td className="hidden md:table-cell">
                          {PAYMENT_METHOD_LABEL[payment.method]}
                          {payment.note ? (
                            <p className="text-xs text-muted-foreground">{payment.note}</p>
                          ) : null}
                        </td>
                        <td className="whitespace-nowrap tabular-nums">
                          {format(payment.paidAt, 'dd MMM yyyy')}
                          <p className="text-xs text-muted-foreground">
                            {payment.receivedBy.name}
                          </p>
                        </td>
                        <td className="whitespace-nowrap text-right font-semibold tabular-nums">
                          {formatBDT(Number(payment.amountReceived))}
                        </td>
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {/* সরু সারি — শুধু আইকন, লেখাটি tooltip/aria-label এ */}
                            <WhatsAppSendButton
                              url={whatsAppUrl}
                              entity="payment"
                              id={payment.id}
                              iconOnly
                              label="রসিদ WhatsApp এ পাঠান"
                              sentLabel={
                                payment.whatsappSentAt
                                  ? format(payment.whatsappSentAt, 'dd MMM yyyy')
                                  : null
                              }
                            />
                            <Link
                              href={`/receipts/${payment.id}`}
                              target="_blank"
                              className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-muted-foreground hover:text-foreground"
                            >
                              <Printer className="h-3.5 w-3.5" />
                              রসিদ
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
