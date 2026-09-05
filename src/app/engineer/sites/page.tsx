import Link from 'next/link';
import { redirect } from 'next/navigation';
import { format } from 'date-fns';
import { ChevronRight, HardHat, MapPin } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { getAuthorizedUser } from '@/lib/guards';
import { phaseProgressSelect, projectScope } from '@/lib/project-access';
import { summarizePhases } from '@/lib/phases';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PhaseProgressBar } from '@/components/phase-timeline';

export const metadata = { title: 'আমার সাইট' };

/**
 * PRD সেকশন ৫.২ — ইঞ্জিনিয়ারের "আমার সাইট"।
 * অ্যাসাইন করা প্রজেক্টের ইউনিটগুলো; ট্যাপ করলে ফেজ আপডেটের পাতা খোলে।
 * ADMIN ও এখানে ঢুকতে পারেন — তিনি সব প্রজেক্ট দেখেন (`projectScope`)।
 */
export default async function MySitesPage() {
  const user = await getAuthorizedUser('phase:update');
  if (!user) redirect('/');

  const now = new Date();

  const projects = await prisma.project.findMany({
    where: projectScope(user),
    select: {
      id: true,
      name: true,
      location: true,
      startDate: true,
      engineer: { select: { name: true } },
      units: {
        select: {
          id: true,
          unitNo: true,
          status: true,
          phases: { select: phaseProgressSelect, orderBy: { order: 'asc' } },
        },
        orderBy: { unitNo: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const totalUnits = projects.reduce((sum, project) => sum + project.units.length, 0);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">আমার সাইট</h1>
        <p className="text-sm text-muted-foreground">
          {projects.length} টি প্রজেক্ট · {totalUnits} টি ইউনিট — ইউনিটে ট্যাপ করে ফেজ আপডেট দিন
        </p>
      </div>

      {projects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <HardHat className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium">আপনার নামে কোনো সাইট অ্যাসাইন করা নেই</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              অ্যাডমিন প্রজেক্টে আপনাকে সাইট ইঞ্জিনিয়ার হিসেবে যুক্ত করলে সেটি এখানে দেখা যাবে।
            </p>
          </CardContent>
        </Card>
      ) : (
        projects.map((project) => {
          const summaries = project.units.map((unit) => ({
            unit,
            summary: summarizePhases(unit.phases, now),
          }));
          const delayed = summaries.filter((s) => s.summary.delayedCount > 0).length;

          return (
            <Card key={project.id}>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="text-base">{project.name}</CardTitle>
                    <p className="flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{project.location}</span>
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="secondary">{project.units.length} ইউনিট</Badge>
                    {delayed > 0 ? (
                      <Badge variant="destructive">{delayed} টি পিছিয়ে</Badge>
                    ) : null}
                  </div>
                </div>
                {project.startDate ? (
                  <p className="text-xs text-muted-foreground">
                    নির্মাণ শুরু: {format(project.startDate, 'dd MMM yyyy')}
                  </p>
                ) : null}
              </CardHeader>

              <CardContent className="pt-0">
                {project.units.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    এই প্রজেক্টে এখনো ইউনিট যোগ করা হয়নি
                  </p>
                ) : (
                  <ul className="divide-y">
                    {summaries.map(({ unit, summary }) => (
                      <li key={unit.id}>
                        <Link
                          href={`/engineer/sites/${unit.id}`}
                          className="-mx-2 flex items-center gap-3 rounded-md px-2 py-3 transition-colors hover:bg-muted/60"
                        >
                          <div className="min-w-0 flex-1 space-y-1.5">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{unit.unitNo}</span>
                              {summary.delayedCount > 0 ? (
                                <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[11px] font-semibold text-destructive">
                                  {summary.delayedCount} বিলম্বিত
                                </span>
                              ) : null}
                            </div>
                            <PhaseProgressBar progress={summary.progress} />
                            <p className="truncate text-xs text-muted-foreground">
                              {summary.total === 0
                                ? 'ফেজ টাইমলাইন নেই'
                                : summary.current
                                  ? `চলমান: ${summary.current.nameBn ?? summary.current.name}`
                                  : 'সব ফেজ সম্পন্ন'}
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
          );
        })
      )}
    </div>
  );
}
