import { redirect } from 'next/navigation';
import { HardHat, MapPin } from 'lucide-react';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { loadUnitTimeline } from '@/lib/phase-data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PhaseProgressSummary, PhaseTimeline, PhaseUpdateLog } from '@/components/phase-timeline';

export const metadata = { title: 'নির্মাণ অগ্রগতি' };

/**
 * PRD সেকশন ৫.২ ও ৫.৪ — কাস্টমার নিজের ইউনিটের progress timeline ও সাইট ফটো দেখেন।
 *
 * এখানে `PhaseTimeline` কে `actions` ছাড়া ব্যবহার করা হয়েছে, তাই এটি সম্পূর্ণ
 * read-only — কাস্টমার কিছু বদলাতে পারেন না (PRD সেকশন ৪)।
 */
export default async function CustomerProgressPage() {
  const session = await auth();
  if (!session?.user) redirect('/login?callbackUrl=/customer/progress');

  const customer = await prisma.customer.findUnique({
    where: { userId: session.user.id },
    select: {
      sales: {
        select: {
          id: true,
          status: true,
          unit: {
            select: {
              id: true,
              unitNo: true,
              sizeSqft: true,
              project: { select: { name: true, location: true } },
            },
          },
        },
        orderBy: { saleDate: 'desc' },
      },
    },
  });

  const now = new Date();
  const sales = customer?.sales ?? [];
  const timelines = await Promise.all(
    sales.map(async (sale) => ({ sale, timeline: await loadUnitTimeline(sale.unit.id, now) })),
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">নির্মাণ অগ্রগতি</h1>
        <p className="text-sm text-muted-foreground">আপনার ইউনিটের ধাপভিত্তিক অগ্রগতি ও সাইট ফটো</p>
      </div>

      {timelines.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <HardHat className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium">এখনো কোনো ইউনিট যুক্ত হয়নি</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              বুকিং সম্পন্ন হলে আপনার ইউনিটের নির্মাণ অগ্রগতি এখানে দেখা যাবে।
            </p>
          </CardContent>
        </Card>
      ) : (
        timelines.map(({ sale, timeline }) => (
          <div key={sale.id} className="space-y-3">
            <PhaseProgressSummary
              summary={timeline.summary}
              title={`${sale.unit.project.name} — ${sale.unit.unitNo}`}
              subtitle={sale.unit.project.location}
            />

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">ফেজ টাইমলাইন</CardTitle>
                <CardDescription className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  {sale.unit.project.location}
                  {sale.unit.sizeSqft ? ` · ${Number(sale.unit.sizeSqft)} sqft` : null}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PhaseTimeline
                  phases={timeline.phases}
                  emptyMessage="নির্মাণ টাইমলাইন এখনো তৈরি হয়নি — শীঘ্রই যোগ করা হবে"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">সাইট ফটো ও আপডেট</CardTitle>
                <CardDescription>সাইট ইঞ্জিনিয়ারের পাঠানো সর্বশেষ অগ্রগতি</CardDescription>
              </CardHeader>
              <CardContent>
                <PhaseUpdateLog
                  updates={timeline.updates}
                  emptyMessage="এখনো কোনো সাইট আপডেট যোগ করা হয়নি"
                />
              </CardContent>
            </Card>
          </div>
        ))
      )}
    </div>
  );
}
