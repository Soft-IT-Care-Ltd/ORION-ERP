import Link from 'next/link';
import { format } from 'date-fns';
import { ArrowRight } from 'lucide-react';
import { loadMonthlyLedgerTrend } from '@/lib/ledger-data';
import {
  funnelRangeStart,
  loadClientProfitability,
  loadCollectionTrend,
  loadProjectProgress,
  loadSalesFunnel,
  COLLECTION_MONTHS,
} from '@/lib/report-data';
import type { FunnelRange } from '@/lib/reports';
import { formatBDT } from '@/lib/utils';
import { RangeTabs } from '@/components/reports/range-tabs';
import { LedgerTrendChart } from '@/components/reports/ledger-trend-chart';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SalesFunnelChart } from './sales-funnel-chart';
import { ProjectProgressChart } from './project-progress-chart';
import { CollectionChart } from './collection-chart';
import { ClientProfitabilityTable } from './client-profitability-table';

/**
 * Admin ড্যাশবোর্ডের পাঁচটি চার্ট/টেবিল — PRD সেকশন ৫.১০ (Reporting & Analytics)।
 *
 * ডেটা লোড এখানে (server), আঁকা পাশের client কম্পোনেন্টগুলোতে — তাই Recharts
 * শুধু চার্টের কার্ডগুলোর জন্যই ক্লায়েন্টে যায়, বাকি ড্যাশবোর্ড server-rendered
 * থাকে। প্রতিটি সংখ্যা Prisma aggregate/groupBy কুয়েরি থেকে; কোথাও স্যাম্পল
 * ডেটা বসানো নেই।
 *
 * ফোল্ডারটিতে `page.tsx` নেই, তাই `/admin/dashboard` নামে কোনো রুট তৈরি হয় না —
 * ফাইলগুলো `/admin` পাতার সাথেই colocated।
 */

/** কোম্পানি লেজারের চার্টে কত মাসের প্রবণতা — কালেকশন চার্টের সমান উইন্ডো */
const LEDGER_TREND_MONTHS = 12;

export async function DashboardCharts({ funnelRange }: { funnelRange: FunnelRange }) {
  const now = new Date();

  const [funnel, projects, collection, profitability, ledgerTrend] = await Promise.all([
    loadSalesFunnel(funnelRange, now),
    loadProjectProgress(now),
    loadCollectionTrend(now),
    loadClientProfitability(),
    loadMonthlyLedgerTrend(now, LEDGER_TREND_MONTHS),
  ]);

  const rangeStart = funnelRangeStart(funnelRange, now);
  const ledgerTotals = ledgerTrend.reduce(
    (sum, month) => ({
      income: sum.income + month.income,
      expense: sum.expense + month.expense,
    }),
    { income: 0, expense: 0 },
  );
  const ledgerNet = ledgerTotals.income - ledgerTotals.expense;

  return (
    /*
     * `min-w-0` প্রতিটি কার্ডে জরুরি — grid আইটেমের ডিফল্ট `min-width: auto`
     * মানে কলামটি তার সবচেয়ে চওড়া কনটেন্টের নিচে নামতে পারে না। কালেকশন
     * চার্টের ভেতরের ন্যূনতম প্রস্থ তখন পুরো কলামকেই টেনে বড় করত আর মোবাইলে
     * তিনটি কার্ডই স্ক্রিনের বাইরে চলে যেত।
     */
    <div className="grid gap-4 lg:grid-cols-2">
      {/* ১. Pre-project funnel — PRD সেকশন ৫.১ */}
      <Card className="min-w-0">
        <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
          <div className="space-y-1">
            <CardTitle className="text-base">সেলস ফানেল</CardTitle>
            <CardDescription>
              {rangeStart
                ? `${format(rangeStart, 'dd MMM yyyy')} থেকে তৈরি হওয়া লিড`
                : 'সব লিড'}{' '}
              · মোট {funnel.total} · Won {funnel.won} ({funnel.winRate}%) · Lost {funnel.lost}
            </CardDescription>
          </div>
          {/* PRD সেকশন ৫.১ — "মাসিক/quarterly ভিত্তিতে দেখা যাবে" */}
          <RangeTabs
            basePath="/admin"
            param="funnel"
            current={funnelRange}
            label="ফানেলের সময়সীমা"
          />
        </CardHeader>
        <CardContent>
          <SalesFunnelChart report={funnel} />
          <p className="mt-2 text-xs text-muted-foreground">
            প্রতিটি ধাপের সংখ্যা সঞ্চিত — অর্থাৎ যতগুলো লিড অন্তত ওই ধাপ পর্যন্ত পৌঁছেছে
            (Lost লিডগুলো তারা যতদূর গিয়েছিল সেই ধাপ পর্যন্ত গোনা)।
          </p>
        </CardContent>
      </Card>

      {/* ২. Project Progress Overview — PRD সেকশন ৫.১০ */}
      <Card className="min-w-0">
        <CardHeader className="space-y-1">
          <CardTitle className="text-base">প্রজেক্টের অগ্রগতি</CardTitle>
          <CardDescription>
            {projects.length > 0
              ? `${projects.length} টি সক্রিয় প্রজেক্টের ফেজ-ভিত্তিক % complete`
              : 'ফেজ টাইমলাইন বসানো প্রজেক্টগুলোর গড় অগ্রগতি'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProjectProgressChart rows={projects} />
        </CardContent>
      </Card>

      {/* ৩. Collected vs Receivable — PRD সেকশন ৫.৫ */}
      {/* ১২ মাসের সময়-সারি — পুরো প্রস্থ পেলে মাসগুলো আলাদা করে পড়া যায় */}
      <Card className="min-w-0 lg:col-span-2">
        <CardHeader className="space-y-1">
          <CardTitle className="text-base">আদায় বনাম পাওনা</CardTitle>
          <CardDescription>
            শেষ {COLLECTION_MONTHS} মাস · পাওনা {formatBDT(collection.totalDue)} · আদায়{' '}
            {formatBDT(collection.totalCollected)} ({collection.rate}%) · বাকি{' '}
            {formatBDT(collection.totalOutstanding)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CollectionChart report={collection} />
        </CardContent>
      </Card>

      {/* ৪. Client-wise Profitability — PRD সেকশন ৫.১০ */}
      {/* টেবিলে অনেকগুলো কলাম — সংকুচিত কলামে পড়া কঠিন হতো, তাই পুরো প্রস্থ */}
      <Card className="min-w-0 lg:col-span-2">
        <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
          <div className="space-y-1">
            <CardTitle className="text-base">ক্লায়েন্ট-ভিত্তিক লাভ/ক্ষতি</CardTitle>
            <CardDescription>
              মোট বিল − ইন্টারনাল কস্ট = মার্জিন · সব ক্লায়েন্ট মিলিয়ে নিট{' '}
              {formatBDT(profitability.netMargin)} · কলামের নামে ক্লিক করে সাজান
            </CardDescription>
          </div>
          <Button asChild size="sm" variant="outline" className="shrink-0">
            <Link href="/admin/reports/client-profitability">
              পূর্ণ রিপোর্ট
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          <ClientProfitabilityTable report={profitability} />
        </CardContent>
      </Card>

      {/* ৫. Company Monthly Income vs Expense — PRD সেকশন ৫.৬/৫.১০ */}
      <Card className="min-w-0 lg:col-span-2">
        <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
          <div className="space-y-1">
            <CardTitle className="text-base">কোম্পানির মাসিক আয় ও খরচ</CardTitle>
            <CardDescription>
              শেষ {LEDGER_TREND_MONTHS} মাসের পুরো লেজার — ক্লায়েন্টে ট্যাগ করা ও সাধারণ,
              সব এন্ট্রি মিলিয়ে · আয় {formatBDT(ledgerTotals.income)} · খরচ{' '}
              {formatBDT(ledgerTotals.expense)} · নিট {formatBDT(ledgerNet)}
            </CardDescription>
          </div>
          <Button asChild size="sm" variant="outline" className="shrink-0">
            <Link href="/accounts/ledger">
              লেজার খুলুন
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          <LedgerTrendChart months={ledgerTrend} />
        </CardContent>
      </Card>
    </div>
  );
}
