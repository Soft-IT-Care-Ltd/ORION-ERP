import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, HardHat, MapPin } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { getAuthorizedUser } from '@/lib/guards';
import { loadUnitTimeline } from '@/lib/phase-data';
import { UNIT_STATUS_LABEL } from '@/lib/sales';
import { formatBDT } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PhaseProgressSummary, PhaseTimeline, PhaseUpdateLog } from '@/components/phase-timeline';

export const metadata = { title: 'ইউনিটের ফেজ টাইমলাইন' };

export default async function AdminUnitTimelinePage({
  params,
}: {
  params: { id: string; unitId: string };
}) {
  const admin = await getAuthorizedUser('project:manage');
  if (!admin) redirect('/');

  const unit = await prisma.unit.findFirst({
    where: { id: params.unitId, projectId: params.id },
    select: {
      id: true,
      unitNo: true,
      sizeSqft: true,
      price: true,
      status: true,
      project: {
        select: { id: true, name: true, location: true, engineer: { select: { name: true } } },
      },
    },
  });
  if (!unit) notFound();

  // Admin এই টাইমলাইন শুধু *দেখেন* — `actions` prop না দেওয়ায় কম্পোনেন্টটি read-only।
  // এডিট করার সুযোগ শুধু ইঞ্জিনিয়ার প্যানেলে (PRD সেকশন ৪)।
  const { phases, summary, updates } = await loadUnitTimeline(unit.id, new Date());

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href={`/admin/projects/${unit.project.id}`}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {unit.project.name}
        </Link>
      </Button>

      <div className="space-y-1">
        <h1 className="text-xl font-semibold">
          {unit.project.name} — {unit.unitNo}
        </h1>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" />
            {unit.project.location}
          </span>
          <span className="flex items-center gap-1">
            <HardHat className="h-3.5 w-3.5" />
            {unit.project.engineer?.name ?? 'ইঞ্জিনিয়ার অ্যাসাইন করা হয়নি'}
          </span>
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge variant="secondary">{UNIT_STATUS_LABEL[unit.status]}</Badge>
        <Badge variant="outline">{formatBDT(Number(unit.price))}</Badge>
        {unit.sizeSqft ? <Badge variant="outline">{Number(unit.sizeSqft)} sqft</Badge> : null}
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
            শুধু দেখার জন্য — % ও ছবি আপডেট করেন দায়িত্বপ্রাপ্ত সাইট ইঞ্জিনিয়ার
            (PRD সেকশন ৪)।
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PhaseTimeline
            phases={phases}
            emptyMessage="এই ইউনিটে টাইমলাইন নেই — প্রজেক্ট পেজ থেকে টেমপ্লেট প্রয়োগ করুন"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">সাইট আপডেট ({updates.length})</CardTitle>
          <CardDescription>ইঞ্জিনিয়ারের দেওয়া অগ্রগতি, মন্তব্য ও সাইট ফটো</CardDescription>
        </CardHeader>
        <CardContent>
          <PhaseUpdateLog updates={updates} />
        </CardContent>
      </Card>
    </div>
  );
}
