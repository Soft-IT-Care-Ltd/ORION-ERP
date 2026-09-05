import Link from 'next/link';
import { redirect } from 'next/navigation';
import { format } from 'date-fns';
import { AlertTriangle, Building2, ChevronRight, HardHat, ListChecks } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { getAuthorizedUser } from '@/lib/guards';
import { phaseProgressSelect, projectScope, unitScope } from '@/lib/project-access';
import { computePhaseStatus, summarizePhases } from '@/lib/phases';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PhaseProgressBar, PhaseUpdateLog } from '@/components/phase-timeline';

export const metadata = { title: 'সাইট ড্যাশবোর্ড' };

export default async function EngineerDashboard() {
  const user = await getAuthorizedUser('phase:view');
  if (!user) redirect('/');

  const now = new Date();

  const [projects, recentUpdates] = await Promise.all([
    prisma.project.findMany({
      where: projectScope(user),
      select: {
        id: true,
        name: true,
        units: {
          select: {
            id: true,
            unitNo: true,
            phases: { select: phaseProgressSelect, orderBy: { order: 'asc' } },
          },
          orderBy: { unitNo: 'asc' },
        },
      },
    }),
    prisma.phaseUpdate.findMany({
      where: { phase: { unit: unitScope(user) } },
      select: {
        id: true,
        percentComplete: true,
        note: true,
        photoUrls: true,
        createdAt: true,
        phase: {
          select: { name: true, unit: { select: { unitNo: true, project: { select: { name: true } } } } },
        },
        updatedBy: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ]);

  const units = projects.flatMap((project) =>
    project.units.map((unit) => ({
      ...unit,
      projectName: project.name,
      summary: summarizePhases(unit.phases, now),
    })),
  );

  // মনোযোগ দরকার এমন ইউনিট — পরিকল্পিত তারিখ পেরিয়ে যাওয়া ফেজ আছে যেগুলোতে
  const attention = units
    .filter((unit) => unit.summary.delayedCount > 0)
    .sort((a, b) => b.summary.delayedCount - a.summary.delayedCount);

  const delayedPhaseCount = units.reduce((sum, unit) => sum + unit.summary.delayedCount, 0);
  const doneUnits = units.filter((unit) => unit.summary.total > 0 && unit.summary.progress >= 100);

  const stats = [
    { label: 'অ্যাসাইন করা প্রজেক্ট', value: projects.length, icon: Building2 },
    { label: 'ইউনিট', value: units.length, icon: HardHat },
    { label: 'বিলম্বিত ফেজ', value: delayedPhaseCount, icon: AlertTriangle, alert: true },
    { label: 'সম্পন্ন ইউনিট', value: doneUnits.length, icon: ListChecks },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">সাইট ড্যাশবোর্ড</h1>
        <p className="text-sm text-muted-foreground">আপনার সাইটের ফেজ অগ্রগতি</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, alert }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground sm:text-sm">
                {label}
              </CardTitle>
              <Icon
                className={
                  alert && value > 0 ? 'h-4 w-4 text-destructive' : 'h-4 w-4 text-muted-foreground'
                }
              />
            </CardHeader>
            <CardContent>
              <p
                className={
                  alert && value > 0
                    ? 'text-2xl font-semibold text-destructive'
                    : 'text-2xl font-semibold'
                }
              >
                {value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">মনোযোগ দরকার</CardTitle>
          <CardDescription>
            পরিকল্পিত তারিখ পেরিয়ে গেছে কিন্তু এখনো সম্পন্ন হয়নি এমন ফেজ আছে যে ইউনিটগুলোতে
          </CardDescription>
        </CardHeader>
        <CardContent>
          {attention.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {units.length === 0
                ? 'আপনার নামে এখনো কোনো সাইট অ্যাসাইন করা হয়নি'
                : 'কোনো ফেজ পিছিয়ে নেই — সব ঠিক আছে'}
            </p>
          ) : (
            <ul className="divide-y">
              {attention.slice(0, 6).map((unit) => (
                <li key={unit.id}>
                  <Link
                    href={`/engineer/sites/${unit.id}`}
                    className="-mx-2 flex items-center gap-3 rounded-md px-2 py-3 transition-colors hover:bg-muted/60"
                  >
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <p className="truncate text-sm font-medium">
                        {unit.projectName} — {unit.unitNo}
                      </p>
                      <PhaseProgressBar progress={unit.summary.progress} />
                      <p className="text-xs text-destructive">
                        {unit.summary.delayedCount} টি ফেজ পিছিয়ে
                        {unit.summary.current ? (
                          <span className="text-muted-foreground">
                            {' '}
                            · চলমান: {unit.summary.current.nameBn ?? unit.summary.current.name}
                          </span>
                        ) : null}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">সাম্প্রতিক আপডেট</CardTitle>
          <CardDescription>আপনার সাইটগুলোতে সর্বশেষ দেওয়া অগ্রগতি</CardDescription>
        </CardHeader>
        <CardContent>
          <PhaseUpdateLog
            updates={recentUpdates.map((update) => ({
              id: update.id,
              phaseName: `${update.phase.unit.project.name} — ${update.phase.unit.unitNo} · ${update.phase.name}`,
              percentComplete: update.percentComplete,
              note: update.note,
              photoUrls: update.photoUrls,
              authorName: update.updatedBy.name,
              createdAtLabel: format(update.createdAt, 'dd MMM yyyy, h:mm a'),
            }))}
            emptyMessage="এখনো কোনো আপডেট দেওয়া হয়নি — 'আমার সাইট' থেকে শুরু করুন"
          />
        </CardContent>
      </Card>
    </div>
  );
}
