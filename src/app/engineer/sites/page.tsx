import Link from 'next/link';
import { redirect } from 'next/navigation';
import { format } from 'date-fns';
import { ChevronRight, HardHat, MapPin, UserRound } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { getAuthorizedUser } from '@/lib/guards';
import { phaseProgressSelect, projectScope } from '@/lib/project-access';
import { summarizePhases } from '@/lib/phases';
import { buildingTypeLabel } from '@/lib/leads';
import { PROJECT_STATUS_LABEL } from '@/lib/projects';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { PhaseProgressBar } from '@/components/phase-timeline';

export const metadata = { title: 'আমার সাইট' };

export const dynamic = 'force-dynamic';

/**
 * PRD সেকশন ৫.৪ — ইঞ্জিনিয়ারের "আমার সাইট"।
 *
 * v2 তে এক প্রজেক্ট = এক ক্লায়েন্টের একটি কনস্ট্রাকশন জব, তাই তালিকাটি সরাসরি
 * প্রজেক্টের — v2 তে আর দুই স্তরের কাঠামো নেই। ট্যাপ করলে ফেজ আপডেটের
 * পাতা খোলে। ADMIN ও এখানে ঢুকতে পারেন — তিনি সব প্রজেক্ট দেখেন (`projectScope`)।
 */
export default async function MySitesPage() {
  const user = await getAuthorizedUser('phase:update');
  if (!user) redirect('/');

  const now = new Date();

  const projects = await prisma.project.findMany({
    where: projectScope(user),
    select: {
      id: true,
      title: true,
      landLocation: true,
      buildingType: true,
      floors: true,
      startDate: true,
      status: true,
      customer: { select: { user: { select: { name: true } } } },
      phases: { select: phaseProgressSelect, orderBy: { order: 'asc' } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const rows = projects.map((project) => ({
    project,
    summary: summarizePhases(project.phases, now),
  }));
  const delayed = rows.filter((row) => row.summary.delayedCount > 0).length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">আমার সাইট</h1>
        <p className="text-sm text-muted-foreground">
          {projects.length} টি প্রজেক্ট
          {delayed > 0 ? ` · ${delayed} টিতে ফেজ পিছিয়ে` : ''} — সাইটে ট্যাপ করে ফেজ আপডেট দিন
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
        <ul className="space-y-2">
          {rows.map(({ project, summary }) => (
            <li key={project.id}>
              <Link
                href={`/engineer/sites/${project.id}`}
                className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
              >
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-medium">{project.title}</span>
                    <Badge variant="secondary" className="text-[11px]">
                      {PROJECT_STATUS_LABEL[project.status]}
                    </Badge>
                    {summary.delayedCount > 0 ? (
                      <Badge variant="destructive" className="text-[11px]">
                        {summary.delayedCount} বিলম্বিত
                      </Badge>
                    ) : null}
                  </div>

                  <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <UserRound className="h-3 w-3 shrink-0" />
                      {project.customer.user.name}
                    </span>
                    {project.landLocation ? (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="truncate">{project.landLocation}</span>
                      </span>
                    ) : null}
                    {buildingTypeLabel(project.buildingType) ? (
                      <span>
                        {buildingTypeLabel(project.buildingType)}
                        {project.floors ? ` · ${project.floors} তলা` : ''}
                      </span>
                    ) : null}
                  </p>

                  <PhaseProgressBar progress={summary.progress} />
                  <p className="truncate text-xs text-muted-foreground">
                    {summary.total === 0
                      ? 'ফেজ টাইমলাইন নেই'
                      : summary.current
                        ? `চলমান: ${summary.current.nameBn ?? summary.current.name}`
                        : 'সব ফেজ সম্পন্ন'}
                    {project.startDate
                      ? ` · শুরু ${format(project.startDate, 'dd MMM yyyy')}`
                      : ''}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
