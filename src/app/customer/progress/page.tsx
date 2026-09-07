import { redirect } from 'next/navigation';
import { HardHat, MapPin } from 'lucide-react';
import { auth } from '@/lib/auth';
import { loadCustomerUnits } from '@/lib/customer-data';
import { loadUnitTimeline } from '@/lib/phase-data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PhaseProgressSummary, PhaseTimeline, PhaseUpdateLog } from '@/components/phase-timeline';

export const metadata = { title: 'নির্মাণ অগ্রগতি' };

/**
 * PRD সেকশন ৫.২ ও ৫.৪ — কাস্টমার নিজের ইউনিটের progress timeline ও সাইট ফটো দেখেন।
 *
 * এখানে `PhaseTimeline` কে `actions` ছাড়া ব্যবহার করা হয়েছে, তাই এটি সম্পূর্ণ
 * read-only — কাস্টমার কিছু বদলাতে পারেন না (PRD সেকশন ৪)। ইউনিটের তালিকা
 * ড্যাশবোর্ডের মতোই `lib/customer-data.ts` থেকে আসে।
 */
export default async function CustomerProgressPage() {
  const session = await auth();
  if (!session?.user) redirect('/login?callbackUrl=/customer/progress');

  const now = new Date();
  const units = await loadCustomerUnits(session.user.id);
  const timelines = await Promise.all(
    units.map(async (unit) => ({ unit, timeline: await loadUnitTimeline(unit.unitId, now) })),
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
        timelines.map(({ unit, timeline }) => (
          <div key={unit.saleId} className="space-y-3">
            <PhaseProgressSummary
              summary={timeline.summary}
              title={unit.label}
              subtitle={unit.projectLocation}
            />

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">ফেজ টাইমলাইন</CardTitle>
                <CardDescription className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  {unit.projectLocation}
                  {unit.sizeSqft ? ` · ${unit.sizeSqft} sqft` : null}
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
