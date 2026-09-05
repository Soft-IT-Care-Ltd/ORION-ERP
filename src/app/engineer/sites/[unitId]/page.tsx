import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, MapPin } from 'lucide-react';
import { getAuthorizedUser } from '@/lib/guards';
import { findScopedUnit } from '@/lib/project-access';
import { loadUnitTimeline } from '@/lib/phase-data';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PhaseProgressSummary, PhaseTimeline, PhaseUpdateLog } from '@/components/phase-timeline';
import { PhaseUpdateDialog } from '../phase-update-dialog';

export const metadata = { title: 'ফেজ আপডেট' };

export default async function EngineerUnitPage({ params }: { params: { unitId: string } }) {
  const user = await getAuthorizedUser('phase:update');
  if (!user) redirect('/');

  // scope সহ — অন্য সাইটের ইউনিট URL দিয়ে খোলা যাবে না
  const unit = await findScopedUnit(user, params.unitId);
  if (!unit) notFound();

  const { phases, summary, updates } = await loadUnitTimeline(unit.id, new Date());

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
        <h1 className="text-xl font-semibold">
          {unit.project.name} — {unit.unitNo}
        </h1>
        <p className="flex items-center gap-1 text-sm text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          {unit.project.location}
        </p>
      </div>

      <PhaseProgressSummary
        summary={summary}
        title={`${unit.unitNo} — নির্মাণ অগ্রগতি`}
        subtitle={unit.project.name}
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
            emptyMessage="এই ইউনিটে এখনো ফেজ টাইমলাইন নেই — অ্যাডমিনকে টেমপ্লেট প্রয়োগ করতে বলুন"
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
            emptyMessage="আপনি এখনো এই ইউনিটে কোনো আপডেট দেননি"
          />
        </CardContent>
      </Card>
    </div>
  );
}
