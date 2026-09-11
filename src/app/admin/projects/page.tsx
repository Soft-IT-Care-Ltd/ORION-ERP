import Link from 'next/link';
import { redirect } from 'next/navigation';
import { format } from 'date-fns';
import { HardHat, MapPin, UserRound, Video } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { getAuthorizedUser } from '@/lib/guards';
import { findAssignableEngineers, phaseProgressSelect } from '@/lib/project-access';
import { summarizePhases } from '@/lib/phases';
import { buildingTypeLabel } from '@/lib/leads';
import { PROJECT_STATUS_BADGE, PROJECT_STATUS_LABEL } from '@/lib/projects';
import { cn, formatBDT } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PhaseProgressBar } from '@/components/phase-timeline';
import { ProjectRowActions } from './project-row-actions';
import type { EditableProject, EngineerOption } from './project-edit-dialog';

export const metadata = { title: 'প্রজেক্ট' };

export const dynamic = 'force-dynamic';

/** DB সারি → এডিট ডায়ালগের ফর্ম-মান (সব string) */
function toEditable(project: {
  id: string;
  title: string;
  landLocation: string | null;
  buildingType: EditableProject['buildingType'];
  floors: number | null;
  totalSqft: unknown;
  ratePerSqft: unknown;
  totalContractValue: unknown;
  startDate: Date | null;
  cameraStreamUrl: string | null;
  status: EditableProject['status'];
  engineerId: string | null;
}): EditableProject {
  return {
    id: project.id,
    title: project.title,
    landLocation: project.landLocation,
    buildingType: project.buildingType,
    floors: project.floors === null ? null : String(project.floors),
    totalSqft: project.totalSqft === null ? null : String(Number(project.totalSqft)),
    ratePerSqft: project.ratePerSqft === null ? null : String(Number(project.ratePerSqft)),
    totalContractValue: String(Number(project.totalContractValue)),
    startDate: project.startDate ? format(project.startDate, 'yyyy-MM-dd') : null,
    cameraStreamUrl: project.cameraStreamUrl,
    status: project.status,
    engineerId: project.engineerId,
  };
}

/**
 * সব কনস্ট্রাকশন প্রজেক্ট — v2 তে এক প্রজেক্ট = এক ক্লায়েন্টের একটি জব।
 *
 * নতুন প্রজেক্ট এখান থেকে তৈরি হয় না: লিড "Won" হলে সেলস পাইপলাইন থেকেই
 * কনভার্শনের সময় তৈরি হয় (PRD সেকশন ৫.৩)।
 */
export default async function ProjectsPage() {
  const admin = await getAuthorizedUser('project:manage');
  if (!admin) redirect('/');

  const now = new Date();

  const [projects, engineerRows] = await Promise.all([
    prisma.project.findMany({
      select: {
        id: true,
        title: true,
        landLocation: true,
        buildingType: true,
        floors: true,
        totalSqft: true,
        ratePerSqft: true,
        totalContractValue: true,
        startDate: true,
        cameraStreamUrl: true,
        status: true,
        engineerId: true,
        engineer: { select: { id: true, name: true } },
        customer: { select: { user: { select: { name: true } } } },
        lead: { select: { id: true } },
        phases: { select: phaseProgressSelect, orderBy: { order: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    findAssignableEngineers(),
  ]);

  const engineers = engineerRows as EngineerOption[];
  const totalValue = projects.reduce((sum, p) => sum + Number(p.totalContractValue), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">প্রজেক্ট</h1>
          <p className="text-sm text-muted-foreground">
            মোট {projects.length} টি কনস্ট্রাকশন জব · কন্ট্রাক্ট ভ্যালু {formatBDT(totalValue)}
          </p>
        </div>
      </div>

      {projects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <HardHat className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium">এখনো কোনো প্রজেক্ট নেই</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              প্রজেক্ট তৈরি হয় লিড &ldquo;Won&rdquo; হলে —{' '}
              <Link href="/sales/pipeline" className="font-medium underline">
                সেলস পাইপলাইন
              </Link>{' '}
              থেকে একটি লিড Won এ নিয়ে কন্ট্রাক্টের তথ্য দিন (PRD সেকশন ৫.৩)।
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {projects.map((project) => {
            const summary = summarizePhases(project.phases, now);
            const building = buildingTypeLabel(project.buildingType);

            return (
              <Card key={project.id} className="flex flex-col">
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
                  <div className="min-w-0 space-y-1">
                    <CardTitle className="text-base">
                      <Link href={`/admin/projects/${project.id}`} className="hover:underline">
                        {project.title}
                      </Link>
                    </CardTitle>
                    <p className="flex items-center gap-1 text-sm text-muted-foreground">
                      <UserRound className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{project.customer.user.name}</span>
                    </p>
                    {project.landLocation ? (
                      <p className="flex items-center gap-1 text-sm text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{project.landLocation}</span>
                      </p>
                    ) : null}
                  </div>
                  <ProjectRowActions
                    project={toEditable(project)}
                    engineers={engineers}
                    phaseCount={project.phases.length}
                  />
                </CardHeader>

                <CardContent className="flex flex-1 flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <span
                      className={cn(
                        'rounded px-1.5 py-0.5 font-medium',
                        PROJECT_STATUS_BADGE[project.status],
                      )}
                    >
                      {PROJECT_STATUS_LABEL[project.status]}
                    </span>
                    {building ? <Badge variant="secondary">{building}</Badge> : null}
                    {project.floors ? (
                      <Badge variant="outline">{project.floors} তলা</Badge>
                    ) : null}
                    {project.totalSqft ? (
                      <Badge variant="outline">{Number(project.totalSqft)} sqft</Badge>
                    ) : null}
                    {summary.delayedCount > 0 ? (
                      <Badge variant="destructive">{summary.delayedCount} ফেজ বিলম্বিত</Badge>
                    ) : null}
                    {project.cameraStreamUrl ? (
                      <Badge variant="outline" className="gap-1">
                        <Video className="h-3 w-3" />
                        লাইভ ক্যামেরা
                      </Badge>
                    ) : null}
                  </div>

                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">
                      নির্মাণ অগ্রগতি
                      {summary.total > 0 ? ` · ${summary.doneCount}/${summary.total} ফেজ সম্পন্ন` : ''}
                    </p>
                    {summary.total === 0 ? (
                      <p className="text-xs text-amber-700 dark:text-amber-500">
                        ফেজ টাইমলাইন নেই — প্রজেক্ট পেজ থেকে টেমপ্লেট প্রয়োগ করুন
                      </p>
                    ) : (
                      <>
                        <PhaseProgressBar progress={summary.progress} />
                        <p className="mt-1 truncate text-[11px] text-muted-foreground">
                          {summary.current
                            ? (summary.current.nameBn ?? summary.current.name)
                            : 'সব ফেজ সম্পন্ন'}
                        </p>
                      </>
                    )}
                  </div>

                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    <div className="flex gap-1.5">
                      <dt className="text-muted-foreground">শুরু</dt>
                      <dd>{project.startDate ? format(project.startDate, 'dd MMM yyyy') : '—'}</dd>
                    </div>
                    <div className="flex min-w-0 gap-1.5">
                      <dt className="shrink-0 text-muted-foreground">কন্ট্রাক্ট</dt>
                      <dd className="truncate">
                        {formatBDT(Number(project.totalContractValue))}
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
