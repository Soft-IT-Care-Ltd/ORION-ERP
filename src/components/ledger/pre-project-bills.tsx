import Link from 'next/link';
import { Download, Receipt } from 'lucide-react';
import { cn, formatBDT } from '@/lib/utils';
import type { LedgerEntryView } from '@/lib/ledger-data';

/**
 * PRD সেকশন ৫.২ ও ৫.৭ — কাস্টমার পোর্টালের "প্রি-প্রজেক্ট সার্ভিস বিল" সেকশন।
 *
 * Won হওয়ার আগে নেওয়া সার্ভিসগুলোর (সাইট ভিজিট, সয়েল টেস্ট, ডিজাইন, সরকারি
 * অনুমোদন) বিল, প্রতিটির পাশে রসিদ ডাউনলোডের বোতাম — কনস্ট্রাকশন কিস্তির
 * `PaymentHistory` এর মতোই, শুধু উৎস `LedgerEntry` (`Payment` নয়)।
 *
 * এখানে যে সারিগুলো আসে সেগুলো `loadClientVisibleEntries` এর — অর্থাৎ DB
 * কুয়েরিতেই `type=INCOME` ও `clientVisible=true` যাচাই হয়ে এসেছে। এই
 * কম্পোনেন্ট কিছু ফিল্টার করে না (করলে ভরসাটা UI তে চলে যেত); তবু `amount` ছাড়া
 * অন্য কিছু দেখায় না বলে ভুল করে expense সারি পাঠালেও internal cost এর
 * ব্যাখ্যা ফাঁস হয় না।
 *
 * মোবাইলে কার্ড-সারি, md থেকে টেবিল (CLAUDE.md নিয়ম ৩)।
 */
export function PreProjectBills({
  bills,
  emptyMessage = 'কনস্ট্রাকশন শুরুর আগের কোনো সার্ভিস বিল নেই',
  className,
}: {
  bills: LedgerEntryView[];
  emptyMessage?: string;
  className?: string;
}) {
  if (bills.length === 0) {
    return (
      <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </p>
    );
  }

  const total = bills.reduce((sum, bill) => sum + bill.amount, 0);

  return (
    <div className={className}>
      {/* ---------------------------------------------------- মোবাইল কার্ড */}
      <ul className="space-y-2 md:hidden">
        {bills.map((bill) => (
          <li key={bill.id} className="rounded-lg border p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium">{bill.categoryLabel}</p>
                <p className="text-xs text-muted-foreground">{bill.dateLabel}</p>
              </div>
              <span className="shrink-0 font-semibold tabular-nums">{bill.amountLabel}</span>
            </div>

            {bill.receiptNo ? (
              <p className="mt-1.5 inline-flex items-center gap-1 font-mono text-xs text-muted-foreground">
                <Receipt className="h-3 w-3 shrink-0" />
                {bill.receiptNo}
              </p>
            ) : null}
            {bill.note ? (
              <p className="mt-0.5 text-xs text-muted-foreground">{bill.note}</p>
            ) : null}

            <BillReceiptLink bill={bill} className="mt-2 w-full" />
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
              <th>সার্ভিস</th>
              <th className="text-right">অঙ্ক</th>
              <th className="w-px" />
            </tr>
          </thead>
          <tbody>
            {bills.map((bill) => (
              <tr key={bill.id} className="border-b last:border-0 [&>td]:px-3 [&>td]:py-2">
                <td className="whitespace-nowrap font-mono text-xs">{bill.receiptNo ?? '—'}</td>
                <td className="whitespace-nowrap tabular-nums">{bill.dateLabel}</td>
                <td className="font-medium">
                  {bill.categoryLabel}
                  {bill.note ? (
                    <span className="block text-xs font-normal text-muted-foreground">
                      {bill.note}
                    </span>
                  ) : null}
                </td>
                <td className="whitespace-nowrap text-right font-medium tabular-nums">
                  {bill.amountLabel}
                </td>
                <td className="whitespace-nowrap text-right">
                  <BillReceiptLink bill={bill} />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t bg-muted/30 font-medium">
            <tr className="[&>td]:px-3 [&>td]:py-2">
              <td colSpan={3}>মোট ({bills.length} টি বিল)</td>
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
        <span>মোট ({bills.length} টি বিল)</span>
        <span className="tabular-nums text-emerald-700 dark:text-emerald-400">
          {formatBDT(total)}
        </span>
      </div>
    </div>
  );
}

/**
 * রসিদ পেজের লিংক। রসিদ নম্বর ছাড়া এন্ট্রির (ট্যাগহীন general income) কোনো
 * প্রিন্টযোগ্য রসিদ নেই — তখন লিংকটাও দেখানো হয় না, কারণ পেজটি 404 দিত।
 */
function BillReceiptLink({ bill, className }: { bill: LedgerEntryView; className?: string }) {
  if (!bill.receiptNo) return null;

  return (
    <Link
      href={`/receipts/bill/${bill.id}`}
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
