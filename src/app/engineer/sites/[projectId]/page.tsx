import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, MapPin, UserRound } from 'lucide-react';
import { getAuthorizedUser } from '@/lib/guards';
import { findScopedProject } from '@/lib/project-access';
import { loadProjectTimeline } from '@/lib/phase-data';
import { buildingTypeLabel } from '@/lib/leads';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PhaseProgressSummary, PhaseTimeline, PhaseUpdateLog } from '@/components/phase-timeline';
import { PhaseUpdateDialog } from '../phase-update-dialog';

export const metadata = { title: 'ফেজ আপডেট' };

export const dynamic = 'force-dynamic';

export default async function EngineerSitePage({ params }: { params: { projectId: string } }) {
  const user = await getAuthorizedUser('phase:update');
  if (!user) redirect('/');

  // scope সহ — অন্য কারও সাইটের id দিয়ে খোলা যাবে না
  const project = await findScopedProject(user, params.projectId);
  if (!project) notFound();

  const { phases, summary, updates } = await loadProjectTimeline(project.id, new Date());

  // এখানেই টাইমলাইনটি এডিটযোগ্য হয় — প্রতিটি ফেজের বিপরীতে আপডেট বাটন।
  // Admin ও Customer একই কম্পোনেন্ট `actions` ছাড়া ব্যবহার করে, তাই সেখানে read-only।
  const actions = Object.fromEntries(
    phases.map((phase) => [
      phase.id,
      <PhaseUpdateDialog
        key={phase.id}
        phase={{
          id: phase.id,
          name: phase.name,
          percentComplete: phase.percentComplete,
          isDelayed: phase.status === 'DELAYED',
          delayReason: phase.delayReason,
        }}
      />,
    ]),
  );

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/engineer/sites">
          <ArrowLeft className="mr-2 h-4 w-4" />
          আমার সাইট
        </Link>
      </Button>

      <div className="space-y-1">
        <h1 className="text-xl font-semibold">{project.title}</h1>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <UserRound className="h-3.5 w-3.5 shrink-0" />
            {project.customer.user.name}
          </span>
          {project.landLocation ? (
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              {project.landLocation}
            </span>
          ) : null}
          {buildingTypeLabel(project.buildingType) ? (
            <span>
              {buildingTypeLabel(project.buildingType)}
              {project.floors ? ` · ${project.floors} তলা` : ''}
            </span>
          ) : null}
        </p>
      </div>

      <PhaseProgressSummary
        summary={summary}
        title="নির্মাণ অগ্রগতি"
        subtitle={project.title}
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">ফেজ টাইমলাইন</CardTitle>
          <CardDescription>
            প্রতিটি ফেজের &ldquo;আপডেট&rdquo; বাটনে ট্যাপ করে % , মন্তব্য ও সাইট ফটো দিন।
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PhaseTimeline
            phases={phases}
            actions={actions}
            emptyMessage="এই সাইটে এখনো ফেজ টাইমলাইন নেই — অ্যাডমিনকে টেমপ্লেট প্রয়োগ করতে বলুন"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">সাইট আপডেটের ইতিহাস ({updates.length})</CardTitle>
          <CardDescription>সর্বশেষ আপডেট আগে</CardDescription>
        </CardHeader>
        <CardContent>
          <PhaseUpdateLog
            updates={updates}
            emptyMessage="এই সাইটে এখনো কোনো আপডেট দেওয়া হয়নি"
          />
        </CardContent>
      </Card>
    </div>
  );
}
