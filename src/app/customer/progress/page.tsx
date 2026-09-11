import { redirect } from 'next/navigation';
import { HardHat, MapPin, Video } from 'lucide-react';
import { auth } from '@/lib/auth';
import { loadCustomerProjects } from '@/lib/customer-data';
import { loadProjectTimeline } from '@/lib/phase-data';
import { buildingTypeLabel } from '@/lib/leads';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PhaseProgressSummary, PhaseTimeline, PhaseUpdateLog } from '@/components/phase-timeline';
import { LiveCameraCard } from '../live-camera-card';

export const metadata = { title: 'নির্মাণ অগ্রগতি' };

export const dynamic = 'force-dynamic';

/**
 * PRD সেকশন ৫.৪ ও ৫.৭ — কাস্টমার নিজের প্রজেক্টের progress timeline, লাইভ ক্যামেরা
 * ও সাইট ফটো দেখেন।
 *
 * এখানে `PhaseTimeline` কে `actions` ছাড়া ব্যবহার করা হয়েছে, তাই এটি সম্পূর্ণ
 * read-only — কাস্টমার কিছু বদলাতে পারেন না (PRD সেকশন ৪)। প্রজেক্টের তালিকা
 * ড্যাশবোর্ডের মতোই `lib/customer-data.ts` থেকে আসে।
 */
export default async function CustomerProgressPage() {
  const session = await auth();
  if (!session?.user) redirect('/login?callbackUrl=/customer/progress');

  const now = new Date();
  const projects = await loadCustomerProjects(session.user.id);
  const timelines = await Promise.all(
    projects.map(async (project) => ({
      project,
      timeline: await loadProjectTimeline(project.projectId, now),
    })),
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">নির্মাণ অগ্রগতি</h1>
        <p className="text-sm text-muted-foreground">
          আপনার প্রজেক্টের ধাপভিত্তিক অগ্রগতি, লাইভ ক্যামেরা ও সাইট ফটো
        </p>
      </div>

      {timelines.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <HardHat className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium">এখনো কোনো প্রজেক্ট যুক্ত হয়নি</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              কন্ট্রাক্ট সাইন হলে আপনার প্রজেক্টের নির্মাণ অগ্রগতি এখানে দেখা যাবে।
            </p>
          </CardContent>
        </Card>
      ) : (
        timelines.map(({ project, timeline }) => (
          <div key={project.projectId} className="space-y-3">
            <PhaseProgressSummary
              summary={timeline.summary}
              title={project.title}
              subtitle={project.landLocation ?? undefined}
            />

            {project.cameraStreamUrl ? (
              <LiveCameraCard url={project.cameraStreamUrl} title={project.title} />
            ) : null}

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">ফেজ টাইমলাইন</CardTitle>
                <CardDescription className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  {project.landLocation ?? 'অবস্থান নির্ধারিত নয়'}
                  {buildingTypeLabel(project.buildingType)
                    ? ` · ${buildingTypeLabel(project.buildingType)}`
                    : null}
                  {project.totalSqft ? ` · ${project.totalSqft} sqft` : null}
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
