import Link from 'next/link';
import { Download, Receipt } from 'lucide-react';
import { cn, formatBDT } from '@/lib/utils';
import { PAYMENT_METHOD_LABEL, type PaymentHistoryItem } from '@/lib/payments';

/**
 * PRD সেকশন ৫.৪ — কাস্টমারের payment history, প্রতিটি এন্ট্রির পাশে রসিদ
 * ডাউনলোডের বোতাম।
 *
 * রসিদ আলাদা PDF ফাইল নয় — `/receipts/[paymentId]` পেজটি প্রিন্ট-লেআউটে খোলে
 * এবং সেখান থেকে "প্রিন্ট / PDF" করা যায় (কারণটা ওই পেজের কমেন্টে: PDF
 * লাইব্রেরির বিল্ট-ইন ফন্টে বাংলা গ্লিফ নেই)।
 *
 * `PaymentScheduleTable` এর মতোই server component — শুধু ডেটা দেখায়। লেআউট
 * মোবাইলে কার্ড, md থেকে টেবিল (CLAUDE.md নিয়ম ৩)।
 */
export function PaymentHistory({
  payments,
  emptyMessage = 'এখনো কোনো পেমেন্ট জমা পড়েনি',
  className,
}: {
  payments: PaymentHistoryItem[];
  emptyMessage?: string;
  className?: string;
}) {
  if (payments.length === 0) {
    return (
      <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </p>
    );
  }

  const total = payments.reduce((sum, payment) => sum + payment.amount, 0);

  return (
    <div className={className}>
      {/* ---------------------------------------------------- মোবাইল কার্ড */}
      <ul className="space-y-2 md:hidden">
        {payments.map((payment) => (
          <li key={payment.id} className="rounded-lg border p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium">{payment.installmentLabel}</p>
                <p className="text-xs text-muted-foreground">{payment.paidAtLabel}</p>
              </div>
              <span className="shrink-0 font-semibold tabular-nums">
                {formatBDT(payment.amount)}
              </span>
            </div>

            <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1 font-mono">
                <Receipt className="h-3 w-3 shrink-0" />
                {payment.receiptNo}
              </span>
              <span>· {PAYMENT_METHOD_LABEL[payment.method]}</span>
              {payment.note ? <span>· {payment.note}</span> : null}
            </p>

            <ReceiptLink paymentId={payment.id} className="mt-2 w-full" />
          </li>
        ))}
      </ul>

      {/* ------------------------------------------------------ টেবিল (md+) */}
      <div className="hidden overflow-x-auto rounded-lg border md:block">
        <table className="w-full caption-bottom text-sm">
          <thead className="border-b bg-muted/50">
            <tr className="text-left [&>th]:px-3 [&>th]:py-2 [&>th]:font-medium">
              <th>রসিদ নং</th>
              <th className="whitespace-nowrap">তারিখ</th>
              <th>কিস্তি</th>
              <th>মাধ্যম</th>
              <th className="text-right">অঙ্ক</th>
              <th className="w-px" />
            </tr>
          </thead>
          <tbody>
            {payments.map((payment) => (
              <tr key={payment.id} className="border-b last:border-0 [&>td]:px-3 [&>td]:py-2">
                <td className="whitespace-nowrap font-mono text-xs">{payment.receiptNo}</td>
                <td className="whitespace-nowrap tabular-nums">{payment.paidAtLabel}</td>
                <td className="font-medium">{payment.installmentLabel}</td>
                <td>
                  {PAYMENT_METHOD_LABEL[payment.method]}
                  {payment.note ? (
                    <span className="block text-xs text-muted-foreground">{payment.note}</span>
                  ) : null}
                </td>
                <td className="whitespace-nowrap text-right font-medium tabular-nums">
                  {formatBDT(payment.amount)}
                </td>
                <td className="whitespace-nowrap text-right">
                  <ReceiptLink paymentId={payment.id} />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t bg-muted/30 font-medium">
            <tr className="[&>td]:px-3 [&>td]:py-2">
              <td colSpan={4}>মোট ({payments.length} টি পেমেন্ট)</td>
              <td className="whitespace-nowrap text-right tabular-nums text-emerald-700 dark:text-emerald-400">
                {formatBDT(total)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* মোবাইলে tfoot দেখা যায় না — তাই আলাদা যোগফল */}
      <div className="mt-2 flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2 text-sm font-medium md:hidden">
        <span>মোট ({payments.length} টি পেমেন্ট)</span>
        <span className="tabular-nums text-emerald-700 dark:text-emerald-400">
          {formatBDT(total)}
        </span>
      </div>
    </div>
  );
}

/** রসিদ পেজের লিংক — বোতামের মতো দেখতে, কিন্তু আসলে নেভিগেশন (server-safe) */
function ReceiptLink({ paymentId, className }: { paymentId: string; className?: string }) {
  return (
    <Link
      href={`/receipts/${paymentId}`}
      className={cn(
        'inline-flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border px-3 text-xs font-medium transition-colors hover:bg-muted',
        className,
      )}
    >
      <Download className="h-3.5 w-3.5 shrink-0" />
      রসিদ ডাউনলোড
    </Link>
  );
}
