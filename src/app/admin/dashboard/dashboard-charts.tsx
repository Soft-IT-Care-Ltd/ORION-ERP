import Link from 'next/link';
import { format } from 'date-fns';
import {
  funnelRangeStart,
  loadCollectionTrend,
  loadProjectProgress,
  loadSalesFunnel,
  COLLECTION_MONTHS,
} from '@/lib/report-data';
import { FUNNEL_RANGES, FUNNEL_RANGE_LABEL, type FunnelRange } from '@/lib/reports';
import { formatBDT, cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SalesFunnelChart } from './sales-funnel-chart';
import { ProjectProgressChart } from './project-progress-chart';
import { CollectionChart } from './collection-chart';

/**
 * Admin ড্যাশবোর্ডের তিনটি চার্ট — PRD সেকশন ৫.৭ (Reporting & Analytics)।
 *
 * ডেটা লোড এখানে (server), আঁকা পাশের client কম্পোনেন্টগুলোতে — তাই Recharts
 * শুধু এই তিনটি কার্ডের জন্যই ক্লায়েন্টে যায়, বাকি ড্যাশবোর্ড server-rendered থাকে।
 *
 * ফোল্ডারটিতে `page.tsx` নেই, তাই `/admin/dashboard` নামে কোনো রুট তৈরি হয় না —
 * ফাইলগুলো `/admin` পাতার সাথেই colocated।
 */
export async function DashboardCharts({ funnelRange }: { funnelRange: FunnelRange }) {
  const now = new Date();

  const [funnel, projects, collection] = await Promise.all([
    loadSalesFunnel(funnelRange, now),
    loadProjectProgress(now),
    loadCollectionTrend(now),
  ]);

  const rangeStart = funnelRangeStart(funnelRange, now);

  return (
    /*
     * `min-w-0` প্রতিটি কার্ডে জরুরি — grid আইটেমের ডিফল্ট `min-width: auto`
     * মানে কলামটি তার সবচেয়ে চওড়া কনটেন্টের নিচে নামতে পারে না। কালেকশন
     * চার্টের ভেতরের ন্যূনতম প্রস্থ তখন পুরো কলামকেই টেনে বড় করত আর মোবাইলে
     * তিনটি কার্ডই স্ক্রিনের বাইরে চলে যেত।
     */
    <div className="grid gap-4 lg:grid-cols-2">
      {/* ১. Sales Funnel — PRD সেকশন ৫.১ */}
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
          <nav className="flex shrink-0 gap-1 rounded-md bg-muted p-1" aria-label="ফানেলের সময়সীমা">
            {FUNNEL_RANGES.map((range) => (
              <Link
                key={range}
                href={range === 'month' ? '/admin' : `/admin?funnel=${range}`}
                scroll={false}
                aria-current={range === funnelRange ? 'page' : undefined}
                className={cn(
                  'rounded px-2.5 py-1 text-xs font-medium transition-colors',
                  range === funnelRange
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {FUNNEL_RANGE_LABEL[range]}
              </Link>
            ))}
          </nav>
        </CardHeader>
        <CardContent>
          <SalesFunnelChart report={funnel} />
          <p className="mt-2 text-xs text-muted-foreground">
            প্রতিটি ধাপের সংখ্যা সঞ্চিত — অর্থাৎ যতগুলো লিড অন্তত ওই ধাপ পর্যন্ত পৌঁছেছে
            (Lost লিডগুলো তারা যতদূর গিয়েছিল সেই ধাপ পর্যন্ত গোনা)।
          </p>
        </CardContent>
      </Card>

      {/* ২. Project Progress Overview — PRD সেকশন ৫.৭ */}
      <Card className="min-w-0">
        <CardHeader className="space-y-1">
          <CardTitle className="text-base">প্রজেক্টের অগ্রগতি</CardTitle>
          <CardDescription>
            {projects.length > 0
              ? `${projects.length} টি সক্রিয় প্রজেক্টের ইউনিট-গড় % complete`
              : 'ফেজ টাইমলাইন বসানো প্রজেক্টগুলোর গড় অগ্রগতি'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProjectProgressChart rows={projects} />
        </CardContent>
      </Card>

      {/* ৩. Collected vs Receivable — PRD সেকশন ৫.৩ */}
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
    </div>
  );
}
