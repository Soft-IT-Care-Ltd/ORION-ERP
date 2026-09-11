import type { ReactNode } from 'react';
import Link from 'next/link';
import { AlertTriangle, Check, Receipt } from 'lucide-react';
import { cn, formatBDT } from '@/lib/utils';
import {
  INSTALLMENT_STATUS_ACCENT,
  INSTALLMENT_STATUS_BADGE,
  INSTALLMENT_STATUS_LABEL,
  INSTALLMENT_STATUS_ROW,
  PAYMENT_METHOD_LABEL,
  type InstallmentView,
  type PaymentView,
} from '@/lib/payments';

/**
 * PRD সেকশন ৫.৩ — status অনুযায়ী রঙ-কোডেড পেমেন্ট শিডিউল
 * (Paid=সবুজ, Partial=হলুদ, Overdue=লাল, Scheduled=ধূসর)।
 *
 * `PhaseTimeline` এর মতোই Admin, Accounts ও Customer — তিন প্যানেলেই এই একই
 * কম্পোনেন্ট। ইচ্ছে করেই server component (কোনো hook/handler নেই): শুধু ডেটা
 * দেখায়। এডিটের সুযোগ আসে `actions` prop দিয়ে — Accounts প্যানেল প্রতিটি কিস্তির
 * বিপরীতে "পেমেন্ট এন্ট্রি" বাটন পাঠায়, Customer কিছু পাঠায় না, তাই read-only
 * (PRD সেকশন ৪ — কাস্টমার শুধু দেখবে)।
 *
 * লেআউট: মোবাইলে কার্ড, md থেকে টেবিল (CLAUDE.md নিয়ম ৩)।
 */
export function PaymentScheduleTable({
  installments,
  actions,
  showReceipts = true,
  emptyMessage = 'এই প্রজেক্টের জন্য এখনো পেমেন্ট প্ল্যান তৈরি হয়নি',
  className,
}: {
  installments: InstallmentView[];
  /** installment id → অতিরিক্ত কনটেন্ট (যেমন "পেমেন্ট নিন" বাটন); না দিলে read-only */
  actions?: Record<string, ReactNode>;
  /** পরিশোধের রসিদগুলো সারির নিচে খোলা যাবে কিনা */
  showReceipts?: boolean;
  emptyMessage?: string;
  className?: string;
}) {
  if (installments.length === 0) {
    return (
      <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </p>
    );
  }

  const ordered = [...installments].sort((a, b) => a.order - b.order);
  const hasActions = Boolean(actions);
  const totals = ordered.reduce(
    (acc, i) => ({
      amount: acc.amount + i.amount,
      paid: acc.paid + i.paidAmount,
      remaining: acc.remaining + i.remaining,
    }),
    { amount: 0, paid: 0, remaining: 0 },
  );

  return (
    <div className={className}>
      {/* ---------------------------------------------------- মোবাইল কার্ড */}
      <ul className="space-y-2 md:hidden">
        {ordered.map((installment) => (
          <li
            key={installment.id}
            className={cn(
              'relative overflow-hidden rounded-lg border pl-3',
              INSTALLMENT_STATUS_ROW[installment.status],
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                'absolute inset-y-0 left-0 w-1.5',
                INSTALLMENT_STATUS_ACCENT[installment.status],
              )}
            />
            <div className="space-y-2 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{installment.label}</p>
                  <p className="text-xs text-muted-foreground">
                    শেষ তারিখ {installment.dueDateLabel}
                    {installment.percentage !== null ? ` · ${installment.percentage}%` : null}
                  </p>
                </div>
                <StatusBadge installment={installment} />
              </div>

              <dl className="grid grid-cols-3 gap-2 text-xs">
                <Figure label="অঙ্ক" value={formatBDT(installment.amount)} />
                <Figure label="পরিশোধিত" value={formatBDT(installment.paidAmount)} />
                <Figure
                  label="বাকি"
                  value={formatBDT(installment.remaining)}
                  tone={installment.remaining > 0 ? 'due' : 'clear'}
                />
              </dl>

              {showReceipts ? <Receipts payments={installment.payments} /> : null}
              {actions?.[installment.id] ? (
                <div className="pt-1">{actions[installment.id]}</div>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      {/* ------------------------------------------------------ টেবিল (md+) */}
      <div className="hidden overflow-x-auto rounded-lg border md:block">
        <table className="w-full caption-bottom text-sm">
          <thead className="border-b bg-muted/50">
            <tr className="text-left [&>th]:px-3 [&>th]:py-2 [&>th]:font-medium">
              <th className="w-10 text-center">#</th>
              <th>কিস্তি</th>
              <th className="whitespace-nowrap">শেষ তারিখ</th>
              <th className="text-right">অঙ্ক</th>
              <th className="text-right">পরিশোধিত</th>
              <th className="text-right">বাকি</th>
              <th>স্ট্যাটাস</th>
              {hasActions ? <th className="w-px" /> : null}
            </tr>
          </thead>
          <tbody>
            {ordered.map((installment) => (
              <tr
                key={installment.id}
                className={cn(
                  'border-b last:border-0 [&>td]:px-3 [&>td]:py-2',
                  INSTALLMENT_STATUS_ROW[installment.status],
                )}
              >
                <td className="text-center text-xs text-muted-foreground tabular-nums">
                  {installment.order}
                </td>
                <td>
                  <div className="flex items-start gap-2">
                    <span
                      aria-hidden="true"
                      className={cn(
                        'mt-1 h-3.5 w-1 shrink-0 rounded-full',
                        INSTALLMENT_STATUS_ACCENT[installment.status],
                      )}
                    />
                    <div className="min-w-0">
                      <p className="font-medium">{installment.label}</p>
                      {installment.percentage !== null ? (
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {installment.percentage}%
                        </p>
                      ) : null}
                      {showReceipts ? <Receipts payments={installment.payments} /> : null}
                    </div>
                  </div>
                </td>
                <td className="whitespace-nowrap">
                  <p className="tabular-nums">{installment.dueDateLabel}</p>
                  {installment.overdueDays !== null ? (
                    <p className="flex items-center gap-1 text-xs font-medium text-destructive">
                      <AlertTriangle className="h-3 w-3 shrink-0" />
                      {installment.overdueDays} দিন পার
                    </p>
                  ) : null}
                </td>
                <td className="whitespace-nowrap text-right tabular-nums">
                  {formatBDT(installment.amount)}
                </td>
                <td className="whitespace-nowrap text-right tabular-nums">
                  {installment.paidAmount > 0 ? (
                    formatBDT(installment.paidAmount)
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td
                  className={cn(
                    'whitespace-nowrap text-right tabular-nums',
                    installment.remaining > 0 ? 'font-medium' : 'text-muted-foreground',
                  )}
                >
                  {installment.remaining > 0 ? formatBDT(installment.remaining) : '—'}
                </td>
                <td>
                  <StatusBadge installment={installment} />
                </td>
                {hasActions ? (
                  <td className="whitespace-nowrap text-right">{actions?.[installment.id]}</td>
                ) : null}
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t bg-muted/30 font-medium">
            <tr className="[&>td]:px-3 [&>td]:py-2">
              <td colSpan={3}>মোট ({ordered.length} কিস্তি)</td>
              <td className="whitespace-nowrap text-right tabular-nums">
                {formatBDT(totals.amount)}
              </td>
              <td className="whitespace-nowrap text-right tabular-nums text-emerald-700 dark:text-emerald-400">
                {formatBDT(totals.paid)}
              </td>
              <td className="whitespace-nowrap text-right tabular-nums">
                {formatBDT(totals.remaining)}
              </td>
              <td colSpan={hasActions ? 2 : 1} />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* মোবাইলে tfoot দেখা যায় না — তাই আলাদা যোগফল */}
      <div className="mt-2 flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2 text-sm font-medium md:hidden">
        <span>মোট ({ordered.length} কিস্তি)</span>
        <span className="tabular-nums">{formatBDT(totals.amount)}</span>
      </div>
    </div>
  );
}

function StatusBadge({ installment }: { installment: InstallmentView }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold',
        INSTALLMENT_STATUS_BADGE[installment.status],
      )}
    >
      {installment.status === 'PAID' ? <Check className="h-3 w-3" /> : null}
      {installment.status === 'OVERDUE' ? <AlertTriangle className="h-3 w-3" /> : null}
      {INSTALLMENT_STATUS_LABEL[installment.status]}
      {installment.status === 'OVERDUE' && installment.overdueDays !== null ? (
        <span className="tabular-nums">· {installment.overdueDays}দি</span>
      ) : null}
    </span>
  );
}

function Figure({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'due' | 'clear';
}) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          'tabular-nums',
          tone === 'due' ? 'font-medium' : tone === 'clear' ? 'text-muted-foreground' : null,
        )}
      >
        {value}
      </dd>
    </div>
  );
}

/**
 * এক কিস্তির বিপরীতে জমা পড়া রসিদগুলো। `<details>` ব্যবহার করা হয়েছে যাতে
 * কম্পোনেন্টটি server component ই থাকে (state ছাড়া খোলা/বন্ধ)।
 */
function Receipts({ payments }: { payments: PaymentView[] }) {
  if (payments.length === 0) return null;

  return (
    <details className="mt-1 text-xs">
      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
        {payments.length} টি রসিদ
      </summary>
      <ul className="mt-1 space-y-1 border-l pl-2">
        {payments.map((payment) => (
          <li key={payment.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <Link
              href={`/receipts/${payment.id}`}
              className="inline-flex items-center gap-1 font-medium hover:underline"
            >
              <Receipt className="h-3 w-3 shrink-0" />
              {payment.receiptNo}
            </Link>
            <span className="tabular-nums">{formatBDT(payment.amount)}</span>
            <span className="text-muted-foreground">{PAYMENT_METHOD_LABEL[payment.method]}</span>
            <span className="text-muted-foreground">{payment.paidAtLabel}</span>
            {payment.note ? (
              <span className="text-muted-foreground">· {payment.note}</span>
            ) : null}
          </li>
        ))}
      </ul>
    </details>
  );
}
