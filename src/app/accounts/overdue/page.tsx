import { redirect } from 'next/navigation';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { getAuthorizedUser } from '@/lib/guards';
import { loadAgingReport, markOverdueInstallments } from '@/lib/payment-data';
import { AGING_BUCKET_LABEL } from '@/lib/payments';
import { formatBDT } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AgingSummary, OverdueTable } from '@/components/payment-schedule';
import { OverdueSweepButton } from '../payments/overdue-sweep-button';

export const metadata = { title: 'ওভারডিউ রিপোর্ট' };

/**
 * PRD সেকশন ৫.৩ — Overdue aging report (0-15 / 16-30 / 30+ দিন), প্রতিটি বালতিতে
 * মোট অঙ্ক ও কিস্তির সংখ্যা, সঙ্গে বকেয়া কিস্তিগুলোর বিস্তারিত তালিকা।
 */
export default async function OverduePage() {
  const accounts = await getAuthorizedUser('report:financial');
  if (!accounts) redirect('/');

  const now = new Date();
  // রিপোর্ট দেখার আগেই স্ট্যাটাস তাজা করে নেওয়া হয় — cron না চললেও সংখ্যা মিলবে
  await markOverdueInstallments(now);
  const aging = await loadAgingReport(now);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">ওভারডিউ রিপোর্ট</h1>
          <p className="text-sm text-muted-foreground">
            due date পেরিয়ে যাওয়া কিস্তিগুলোর বয়স-ভিত্তিক হিসাব
          </p>
        </div>
        <OverdueSweepButton />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Aging সারসংক্ষেপ</CardTitle>
          <CardDescription>
            &quot;বকেয়া&quot; বলতে অনাদায়ী অঙ্ক — আংশিক জমা হলে যতটুকু বাকি সেটুকুই ধরা হয়েছে
          </CardDescription>
        </CardHeader>
        <CardContent>
          {aging.totalCount === 0 ? (
            <p className="flex items-center justify-center gap-2 rounded-md border border-dashed p-6 text-sm text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
              কোনো কিস্তি বকেয়া নেই — সব সময়মতো আদায় হয়েছে
            </p>
          ) : (
            <AgingSummary
              buckets={aging.buckets}
              totalAmount={aging.totalAmount}
              totalCount={aging.totalCount}
              totalAccounts={aging.totalAccounts}
            />
          )}
        </CardContent>
      </Card>

      {aging.totalCount > 0 ? (
        <>
          {aging.buckets
            .filter((bucket) => bucket.count > 0)
            .map((bucket) => (
              <Card key={bucket.bucket}>
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                      {AGING_BUCKET_LABEL[bucket.bucket]} বকেয়া
                    </CardTitle>
                    <p className="text-sm">
                      <span className="font-semibold text-destructive tabular-nums">
                        {formatBDT(bucket.amount)}
                      </span>
                      <span className="text-muted-foreground">
                        {' '}
                        · {bucket.count} কিস্তি · {bucket.accounts} অ্যাকাউন্ট
                      </span>
                    </p>
                  </div>
                </CardHeader>
                <CardContent>
                  <OverdueTable rows={aging.rows.filter((row) => row.bucket === bucket.bucket)} />
                </CardContent>
              </Card>
            ))}
        </>
      ) : null}
    </div>
  );
}
