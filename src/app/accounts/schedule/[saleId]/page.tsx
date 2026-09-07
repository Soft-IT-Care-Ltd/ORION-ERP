import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { format } from 'date-fns';
import { ArrowLeft, Building2, Phone, User } from 'lucide-react';
import { getAuthorizedUser } from '@/lib/guards';
import { can } from '@/lib/rbac';
import { findScopedSale, loadSalePlan, markOverdueInstallments } from '@/lib/payment-data';
import { loadSaleDocuments } from '@/lib/document-data';
import { groupDocuments } from '@/lib/documents';
import { SALE_STATUS_BADGE, SALE_STATUS_HINT, SALE_STATUS_LABEL } from '@/lib/sales';
import { cn, formatBDT } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PaymentScheduleTable, PaymentSummary } from '@/components/payment-schedule';
import { DocumentGroupList } from '@/components/documents';
import { PaymentEntryButton } from '../../payments/payment-entry-dialog';
import { PlanBuilder } from './plan-builder';
import { SaleDocumentUploadForm } from './document-upload-form';

export const metadata = { title: 'পেমেন্ট প্ল্যান' };

/**
 * PRD সেকশন ৫.৩ — এক সেলের পেমেন্ট প্ল্যান: বিল্ডার + রঙ-কোডেড শিডিউল +
 * প্রতিটি কিস্তির বিপরীতে পেমেন্ট এন্ট্রি।
 *
 * সেলের কাগজপত্রও (PRD সেকশন ৫.৪ — বুকিং ফর্ম, এগ্রিমেন্ট, অ্যালটমেন্ট লেটার)
 * এখান থেকেই আপলোড হয়। Admin এর `ROUTE_ROLES` এ `/accounts` অনুমোদিত, তাই দুই
 * প্যানেলের জন্য আলাদা ফর্ম রাখার দরকার নেই — অ্যাডমিন পেমেন্ট ওভারভিউ থেকে
 * এই পাতাতেই আসে।
 */
export default async function SchedulePage({ params }: { params: { saleId: string } }) {
  const accounts = await getAuthorizedUser('paymentPlan:view');
  if (!accounts) redirect('/');

  const now = new Date();
  await markOverdueInstallments(now);

  const sale = await findScopedSale(accounts, params.saleId);
  if (!sale) notFound();

  const plan = await loadSalePlan(sale.id, now);
  // অফিসের কে ফাইলটি দিয়েছেন সেটি এখানে দরকারি (কাস্টমারের পাতায় নয়)
  const documents = groupDocuments(
    await loadSaleDocuments(sale.id, sale.unit.unitNo, { showUploader: true }),
  );
  // প্ল্যান এডিট ও পেমেন্ট এন্ট্রি — PRD সেকশন ৪ (রোল হার্ডকোড না করে permission দিয়ে)
  const canManage = can(accounts.role, 'paymentPlan:manage');
  // ডকুমেন্ট আপলোড আলাদা permission — Admin ও Accounts (PRD সেকশন ৪)
  const canManageDocuments = can(accounts.role, 'document:manageSale');

  // যে কিস্তিতে টাকা জমা পড়েছে সেটি বিল্ডারে তালা-দেওয়া থাকবে
  const lockedIds = plan.installments.filter((i) => i.payments.length > 0).map((i) => i.id);

  const saleOption = [
    {
      id: sale.id,
      label: `${sale.unit.project.name} — ${sale.unit.unitNo}`,
      customerName: sale.customer.user.name,
    },
  ];

  // শিডিউল টেবিলের প্রতিটি সারিতে "জমা নিন" — পরিশোধিত কিস্তিতে নয়
  const actions = canManage
    ? Object.fromEntries(
        plan.installments
          .filter((installment) => installment.remaining > 0)
          .map((installment) => [
            installment.id,
            <PaymentEntryButton
              key={installment.id}
              sales={saleOption}
              initialSaleId={sale.id}
              initialInstallmentId={installment.id}
              initialInstallments={plan.installments
                .filter((i) => i.remaining > 0)
                .map((i) => ({
                  id: i.id,
                  label: i.label,
                  dueDateLabel: i.dueDateLabel,
                  remaining: i.remaining,
                  status: i.status,
                }))}
              label="জমা নিন"
              size="sm"
              variant="outline"
            />,
          ]),
      )
    : undefined;

  return (
    <div className="space-y-4">
      <Link
        href="/accounts/schedule"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        সব শিডিউল
      </Link>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="text-base">{sale.customer.user.name}</CardTitle>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5" />
                  {sale.unit.project.name} — {sale.unit.unitNo}
                </span>
                {sale.customer.user.phone ? (
                  <a
                    href={`tel:${sale.customer.user.phone}`}
                    className="inline-flex items-center gap-1 hover:text-foreground"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    {sale.customer.user.phone}
                  </a>
                ) : null}
                <span className="inline-flex items-center gap-1">
                  <User className="h-3.5 w-3.5" />
                  {sale.customer.user.email}
                </span>
              </div>
            </div>
            <div className="text-right">
              <Badge className={cn('text-[11px]', SALE_STATUS_BADGE[sale.status])} variant="secondary">
                {SALE_STATUS_LABEL[sale.status]}
              </Badge>
              <p className="mt-1 text-xs text-muted-foreground">{SALE_STATUS_HINT[sale.status]}</p>
              <p className="mt-1 text-sm">
                সেল তারিখ {format(sale.saleDate, 'dd MMM yyyy')} ·{' '}
                <span className="font-semibold tabular-nums">
                  {formatBDT(Number(sale.totalAmount))}
                </span>
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <PaymentSummary
            summary={plan.summary}
            title="পেমেন্ট সারসংক্ষেপ"
            subtitle={
              plan.installments.length > 0
                ? `${plan.summary.count} টি কিস্তি · ${plan.summary.paidCount} টি পরিশোধিত`
                : 'এখনো শিডিউল তৈরি হয়নি'
            }
          />
        </CardContent>
      </Card>

      {canManage ? (
        <PlanBuilder
          saleId={sale.id}
          totalAmount={Number(sale.totalAmount)}
          saleDate={format(sale.saleDate, 'yyyy-MM-dd')}
          installments={plan.installments}
          lockedIds={lockedIds}
        />
      ) : null}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base">পেমেন্ট শিডিউল</CardTitle>
          {canManage && plan.installments.some((i) => i.remaining > 0) ? (
            <PaymentEntryButton
              sales={saleOption}
              initialSaleId={sale.id}
              initialInstallments={plan.installments
                .filter((i) => i.remaining > 0)
                .map((i) => ({
                  id: i.id,
                  label: i.label,
                  dueDateLabel: i.dueDateLabel,
                  remaining: i.remaining,
                  status: i.status,
                }))}
              size="sm"
            />
          ) : null}
        </CardHeader>
        <CardContent>
          <PaymentScheduleTable installments={plan.installments} actions={actions} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">ডকুমেন্ট</CardTitle>
          <CardDescription>
            বুকিং ফর্ম, সেল এগ্রিমেন্ট, অ্যালটমেন্ট লেটার ও দলিল — কাস্টমার নিজের পোর্টাল
            থেকে এগুলো ডাউনলোড করতে পারেন
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <DocumentGroupList
            groups={documents}
            emptyMessage="এই সেলের কোনো ডকুমেন্ট এখনো আপলোড করা হয়নি"
          />
          {canManageDocuments ? (
            <div className="border-t pt-4">
              <SaleDocumentUploadForm saleId={sale.id} />
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
