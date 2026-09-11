import Link from 'next/link';
import { redirect } from 'next/navigation';
import { format } from 'date-fns';
import { AlertTriangle, Building2, ChevronRight, HardHat, ListChecks } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { getAuthorizedUser } from '@/lib/guards';
import { phaseProgressSelect, projectScope } from '@/lib/project-access';
import { computePhaseStatus, summarizePhases } from '@/lib/phases';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/stat-card';
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
        title: true,
        phases: { select: phaseProgressSelect, orderBy: { order: 'asc' } },
      },
    }),
    prisma.phaseUpdate.findMany({
      where: { phase: { project: projectScope(user) } },
      select: {
        id: true,
        percentComplete: true,
        note: true,
        photoUrls: true,
        createdAt: true,
        phase: { select: { name: true, project: { select: { title: true } } } },
        updatedBy: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ]);

  const sites = projects.map((project) => ({
    id: project.id,
    title: project.title,
    summary: summarizePhases(project.phases, now),
  }));

  // মনোযোগ দরকার এমন সাইট — পরিকল্পিত তারিখ পেরিয়ে যাওয়া ফেজ আছে যেগুলোতে
  const attention = sites
    .filter((site) => site.summary.delayedCount > 0)
    .sort((a, b) => b.summary.delayedCount - a.summary.delayedCount);

  const delayedPhaseCount = sites.reduce((sum, site) => sum + site.summary.delayedCount, 0);
  const doneSites = sites.filter((site) => site.summary.total > 0 && site.summary.progress >= 100);
  const activePhases = sites.reduce((sum, site) => sum + site.summary.total, 0);

  const stats = [
    { label: 'অ্যাসাইন করা সাইট', value: projects.length, icon: Building2 },
    { label: 'মোট ফেজ', value: activePhases, icon: HardHat },
    {
      label: 'বিলম্বিত ফেজ',
      value: delayedPhaseCount,
      icon: AlertTriangle,
      tone: 'text-destructive',
    },
    { label: 'সম্পন্ন সাইট', value: doneSites.length, icon: ListChecks },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">সাইট ড্যাশবোর্ড</h1>
        <p className="text-sm text-muted-foreground">আপনার সাইটের ফেজ অগ্রগতি</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">মনোযোগ দরকার</CardTitle>
          <CardDescription>
            পরিকল্পিত তারিখ পেরিয়ে গেছে কিন্তু এখনো সম্পন্ন হয়নি এমন ফেজ আছে যে সাইটগুলোতে
          </CardDescription>
        </CardHeader>
        <CardContent>
          {attention.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {sites.length === 0
                ? 'আপনার নামে এখনো কোনো সাইট অ্যাসাইন করা হয়নি'
                : 'কোনো ফেজ পিছিয়ে নেই — সব ঠিক আছে'}
            </p>
          ) : (
            <ul className="divide-y">
              {attention.slice(0, 6).map((site) => (
                <li key={site.id}>
                  <Link
                    href={`/engineer/sites/${site.id}`}
                    className="-mx-2 flex items-center gap-3 rounded-md px-2 py-3 transition-colors hover:bg-muted/60"
                  >
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <p className="truncate text-sm font-medium">{site.title}</p>
                      <PhaseProgressBar progress={site.summary.progress} />
                      <p className="text-xs text-destructive">
                        {site.summary.delayedCount} টি ফেজ পিছিয়ে
                        {site.summary.current ? (
                          <span className="text-muted-foreground">
                            {' '}
                            · চলমান: {site.summary.current.nameBn ?? site.summary.current.name}
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
              phaseName: `${update.phase.project.title} · ${update.phase.name}`,
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
