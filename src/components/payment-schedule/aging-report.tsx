import Link from 'next/link';
import { AlertTriangle, Phone } from 'lucide-react';
import { cn, formatBDT } from '@/lib/utils';
import { AGING_BUCKET_LABEL, AGING_BUCKET_TONE, type AgingRow } from '@/lib/payments';
import type { OverdueRow } from '@/lib/payment-data';

/**
 * PRD সেকশন ৫.৩ — overdue aging report (0-15 / 16-30 / 30+ দিন), প্রতিটি বালতিতে
 * মোট অঙ্ক ও কিস্তির সংখ্যা। অ্যাকাউন্টস ড্যাশবোর্ড ও ওভারডিউ পেজ — দুই জায়গাতেই।
 */
export function AgingSummary({
  buckets,
  totalAmount,
  totalCount,
  totalAccounts,
  className,
}: {
  buckets: AgingRow[];
  totalAmount: number;
  totalCount: number;
  totalAccounts: number;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="grid gap-2 sm:grid-cols-3">
        {buckets.map((row) => (
          <div key={row.bucket} className="rounded-lg border p-3">
            <div className="flex items-center justify-between gap-2">
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                  AGING_BUCKET_TONE[row.bucket],
                )}
              >
                {AGING_BUCKET_LABEL[row.bucket]}
              </span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {row.count} কিস্তি
              </span>
            </div>
            <p className="mt-2 text-lg font-semibold tabular-nums">{formatBDT(row.amount)}</p>
            <p className="text-xs text-muted-foreground">
              {row.accounts} টি অ্যাকাউন্ট
            </p>
          </div>
        ))}
      </div>

      <p className="mt-2 text-sm text-muted-foreground">
        মোট বকেয়া{' '}
        <span className="font-semibold text-destructive tabular-nums">
          {formatBDT(totalAmount)}
        </span>{' '}
        · {totalCount} টি কিস্তি · {totalAccounts} টি অ্যাকাউন্ট
      </p>
    </div>
  );
}

/** বকেয়া কিস্তির বিস্তারিত তালিকা — সবচেয়ে পুরনো আগে */
export function OverdueTable({
  rows,
  emptyMessage = 'কোনো বকেয়া কিস্তি নেই',
  className,
}: {
  rows: OverdueRow[];
  emptyMessage?: string;
  className?: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className={className}>
      {/* মোবাইল কার্ড */}
      <ul className="space-y-2 md:hidden">
        {rows.map((row) => (
          <li key={row.installmentId} className="rounded-lg border border-destructive/30 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <Link
                  href={`/accounts/schedule/${row.saleId}`}
                  className="truncate font-medium hover:underline"
                >
                  {row.customerName}
                </Link>
                <p className="truncate text-xs text-muted-foreground">{row.unitLabel}</p>
              </div>
              <span
                className={cn(
                  'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold',
                  AGING_BUCKET_TONE[row.bucket],
                )}
              >
                {row.overdueDays} দিন
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0 truncate">
                {row.label}
                <span className="text-muted-foreground"> · {row.dueDateLabel}</span>
              </span>
              <span className="shrink-0 font-semibold text-destructive tabular-nums">
                {formatBDT(row.remaining)}
              </span>
            </div>
            {row.customerPhone ? (
              <a
                href={`tel:${row.customerPhone}`}
                className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <Phone className="h-3 w-3" />
                {row.customerPhone}
              </a>
            ) : null}
          </li>
        ))}
      </ul>

      {/* টেবিল (md+) */}
      <div className="hidden overflow-x-auto rounded-lg border md:block">
        <table className="w-full caption-bottom text-sm">
          <thead className="border-b bg-muted/50">
            <tr className="text-left [&>th]:px-3 [&>th]:py-2 [&>th]:font-medium">
              <th>কাস্টমার</th>
              <th>ইউনিট</th>
              <th>কিস্তি</th>
              <th className="whitespace-nowrap">শেষ তারিখ</th>
              <th className="text-right whitespace-nowrap">কত দিন</th>
              <th className="text-right">বকেয়া</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.installmentId} className="border-b last:border-0 [&>td]:px-3 [&>td]:py-2">
                <td>
                  <Link
                    href={`/accounts/schedule/${row.saleId}`}
                    className="font-medium hover:underline"
                  >
                    {row.customerName}
                  </Link>
                  {row.customerPhone ? (
                    <a
                      href={`tel:${row.customerPhone}`}
                      className="block text-xs text-muted-foreground hover:text-foreground"
                    >
                      {row.customerPhone}
                    </a>
                  ) : null}
                </td>
                <td className="text-muted-foreground">{row.unitLabel}</td>
                <td>{row.label}</td>
                <td className="whitespace-nowrap tabular-nums">{row.dueDateLabel}</td>
                <td className="text-right">
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums',
                      AGING_BUCKET_TONE[row.bucket],
                    )}
                  >
                    {row.overdueDays} দিন
                  </span>
                </td>
                <td className="whitespace-nowrap text-right font-semibold text-destructive tabular-nums">
                  {formatBDT(row.remaining)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t bg-muted/30 font-medium">
            <tr className="[&>td]:px-3 [&>td]:py-2">
              <td colSpan={5}>
                <span className="inline-flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                  মোট বকেয়া ({rows.length} কিস্তি)
                </span>
              </td>
              <td className="whitespace-nowrap text-right text-destructive tabular-nums">
                {formatBDT(rows.reduce((sum, r) => sum + r.remaining, 0))}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
