import Link from 'next/link';
import { redirect } from 'next/navigation';
import { format } from 'date-fns';
import { Building2, HardHat, MapPin } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { getAuthorizedUser } from '@/lib/guards';
import { findAssignableEngineers, phaseProgressSelect } from '@/lib/project-access';
import { summarizePhases } from '@/lib/phases';
import { UNIT_STATUS_LABEL } from '@/lib/sales';
import { formatBDT } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PhaseProgressBar } from '@/components/phase-timeline';
import { NewProjectButton } from './new-project-button';
import { ProjectRowActions } from './project-row-actions';
import type { EngineerOption } from './project-form-dialog';

export const metadata = { title: 'প্রজেক্ট ও ইউনিট' };

export default async function ProjectsPage() {
  const admin = await getAuthorizedUser('project:manage');
  if (!admin) redirect('/');

  const now = new Date();

  const [projects, engineerRows] = await Promise.all([
    prisma.project.findMany({
      select: {
        id: true,
        name: true,
        location: true,
        description: true,
        startDate: true,
        engineerId: true,
        engineer: { select: { id: true, name: true } },
        _count: { select: { units: true, phaseTemplates: true } },
        units: {
          select: {
            id: true,
            status: true,
            price: true,
            phases: { select: phaseProgressSelect, orderBy: { order: 'asc' } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    findAssignableEngineers(),
  ]);

  const engineers = engineerRows as EngineerOption[];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">প্রজেক্ট ও ইউনিট</h1>
          <p className="text-sm text-muted-foreground">
            মোট {projects.length} টি প্রজেক্ট ·{' '}
            {projects.reduce((sum, p) => sum + p._count.units, 0)} টি ইউনিট
          </p>
        </div>
        <NewProjectButton engineers={engineers} />
      </div>

      {projects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <Building2 className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium">এখনো কোনো প্রজেক্ট নেই</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              প্রথম প্রজেক্ট তৈরি করুন — PRD সেকশন ৫.২ এর ডিফল্ট ৮টি ফেজ টেমপ্লেট সহ শুরু হবে।
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {projects.map((project) => {
            // প্রজেক্টের অগ্রগতি = ইউনিটগুলোর অগ্রগতির গড়
            const unitSummaries = project.units.map((unit) => summarizePhases(unit.phases, now));
            const withTimeline = unitSummaries.filter((s) => s.total > 0);
            const progress =
              withTimeline.length > 0
                ? Math.round(
                    withTimeline.reduce((sum, s) => sum + s.progress, 0) / withTimeline.length,
                  )
                : 0;
            const delayedUnits = unitSummaries.filter((s) => s.delayedCount > 0).length;
            const soldCount = project.units.filter((u) => u.status === 'SOLD').length;
            const availableCount = project.units.filter((u) => u.status === 'AVAILABLE').length;

            return (
              <Card key={project.id} className="flex flex-col">
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
                  <div className="min-w-0 space-y-1">
                    <CardTitle className="text-base">
                      <Link href={`/admin/projects/${project.id}`} className="hover:underline">
                        {project.name}
                      </Link>
                    </CardTitle>
                    <p className="flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{project.location}</span>
                    </p>
                  </div>
                  <ProjectRowActions
                    project={{
                      id: project.id,
                      name: project.name,
                      location: project.location,
                      description: project.description,
                      startDate: project.startDate
                        ? format(project.startDate, 'yyyy-MM-dd')
                        : null,
                      engineerId: project.engineerId,
                    }}
                    engineers={engineers}
                    unitCount={project._count.units}
                  />
                </CardHeader>

                <CardContent className="flex flex-1 flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <Badge variant="secondary">{project._count.units} ইউনিট</Badge>
                    {availableCount > 0 ? (
                      <Badge variant="outline">
                        {availableCount} {UNIT_STATUS_LABEL.AVAILABLE}
                      </Badge>
                    ) : null}
                    {soldCount > 0 ? (
                      <Badge variant="outline">
                        {soldCount} {UNIT_STATUS_LABEL.SOLD}
                      </Badge>
                    ) : null}
                    <Badge variant="outline">{project._count.phaseTemplates} ফেজ টেমপ্লেট</Badge>
                    {delayedUnits > 0 ? (
                      <Badge variant="destructive">{delayedUnits} ইউনিট বিলম্বিত</Badge>
                    ) : null}
                  </div>

                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">
                      নির্মাণ অগ্রগতি (ইউনিটগুলোর গড়)
                    </p>
                    <PhaseProgressBar progress={progress} />
                  </div>

                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    <div className="flex gap-1.5">
                      <dt className="text-muted-foreground">শুরু</dt>
                      <dd>{project.startDate ? format(project.startDate, 'dd MMM yyyy') : '—'}</dd>
                    </div>
                    <div className="flex min-w-0 gap-1.5">
                      <dt className="shrink-0 text-muted-foreground">মোট মূল্য</dt>
                      <dd className="truncate">
                        {formatBDT(
                          project.units.reduce((sum, unit) => sum + Number(unit.price), 0),
                        )}
                      </dd>
                    </div>
                  </dl>

                  <p className="mt-auto flex items-center gap-1.5 border-t pt-3 text-xs text-muted-foreground">
                    <HardHat className="h-3.5 w-3.5 shrink-0" />
                    {project.engineer ? (
                      <span className="truncate">সাইট ইঞ্জিনিয়ার: {project.engineer.name}</span>
                    ) : (
                      <span className="text-amber-700 dark:text-amber-500">
                        কোনো ইঞ্জিনিয়ার অ্যাসাইন করা হয়নি
                      </span>
                    )}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
