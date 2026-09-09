import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { format } from 'date-fns';
import { ArrowLeft, HardHat, MapPin } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { getAuthorizedUser } from '@/lib/guards';
import { findAssignableEngineers, phaseProgressSelect } from '@/lib/project-access';
import { summarizePhases } from '@/lib/phases';
import { UNIT_STATUS_LABEL } from '@/lib/sales';
import { formatBDT } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PhaseProgressBar } from '@/components/phase-timeline';
import { ProjectRowActions } from '../project-row-actions';
import type { EngineerOption } from '../project-form-dialog';
import { ApplyTemplateButton } from './apply-template-button';
import { NewUnitButton } from './new-unit-button';
import { PhaseTemplateEditor } from './phase-template-editor';
import { UnitRowActions } from './unit-row-actions';

export const metadata = { title: 'প্রজেক্ট বিবরণ' };

export default async function ProjectDetailPage({ params }: { params: { id: string } }) {
  const admin = await getAuthorizedUser('project:manage');
  if (!admin) redirect('/');

  const now = new Date();

  const [project, engineerRows] = await Promise.all([
    prisma.project.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        name: true,
        location: true,
        description: true,
        startDate: true,
        engineerId: true,
        engineer: { select: { id: true, name: true, email: true } },
        phaseTemplates: {
          select: { id: true, name: true, defaultDurationDays: true },
          orderBy: { order: 'asc' },
        },
        units: {
          select: {
            id: true,
            unitNo: true,
            sizeSqft: true,
            price: true,
            status: true,
            sale: { select: { id: true } },
            phases: { select: phaseProgressSelect, orderBy: { order: 'asc' } },
          },
          orderBy: { unitNo: 'asc' },
        },
      },
    }),
    findAssignableEngineers(),
  ]);

  if (!project) notFound();

  const engineers = engineerRows as EngineerOption[];
  const unitsWithoutTimeline = project.units.filter((unit) => unit.phases.length === 0).length;

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/admin/projects">
          <ArrowLeft className="mr-2 h-4 w-4" />
          সব প্রজেক্ট
        </Link>
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold">{project.name}</h1>
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            {project.location}
          </p>
          {project.description ? (
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{project.description}</p>
          ) : null}
        </div>
        <ProjectRowActions
          project={{
            id: project.id,
            name: project.name,
            location: project.location,
            description: project.description,
            startDate: project.startDate ? format(project.startDate, 'yyyy-MM-dd') : null,
            engineerId: project.engineerId,
          }}
          engineers={engineers}
          unitCount={project.units.length}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge variant="secondary">{project.units.length} ইউনিট</Badge>
        <Badge variant="outline">
          শুরু: {project.startDate ? format(project.startDate, 'dd MMM yyyy') : 'নির্ধারিত নয়'}
        </Badge>
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <HardHat className="h-4 w-4" />
          {project.engineer ? (
            project.engineer.name
          ) : (
            <span className="text-amber-700 dark:text-amber-500">ইঞ্জিনিয়ার অ্যাসাইন করা হয়নি</span>
          )}
        </span>
      </div>

      <Card>
        <CardHeader className="p-4 pb-3 sm:p-6 sm:pb-3">
          <CardTitle className="text-base">ফেজ টেমপ্লেট</CardTitle>
          <CardDescription>
            PRD সেকশন ৫.২ এর ডিফল্ট ৮টি ফেজ — প্রজেক্ট অনুযায়ী নাম, ক্রম ও সময়কাল বদলানো যায়।
            নতুন ইউনিট যোগ করলে এই টেমপ্লেট থেকেই তার টাইমলাইন তৈরি হবে; আগের ইউনিটের অগ্রগতি
            অপরিবর্তিত থাকে।
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 p-4 pt-0 sm:p-6 sm:pt-0">
          <PhaseTemplateEditor
            projectId={project.id}
            initial={project.phaseTemplates.map((t) => ({
              name: t.name,
              defaultDurationDays: t.defaultDurationDays ? String(t.defaultDurationDays) : '',
            }))}
          />
          <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
            <p className="text-xs text-muted-foreground">
              {unitsWithoutTimeline > 0
                ? `${unitsWithoutTimeline} টি ইউনিটে এখনো ফেজ টাইমলাইন নেই।`
                : 'সব ইউনিটেই ফেজ টাইমলাইন তৈরি হয়ে গেছে।'}
            </p>
            <ApplyTemplateButton
              projectId={project.id}
              pendingUnits={unitsWithoutTimeline}
              defaultStartDate={project.startDate ? format(project.startDate, 'yyyy-MM-dd') : null}
              disabled={project.phaseTemplates.length === 0}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="text-base">ইউনিট</CardTitle>
            <CardDescription>ইউনিটে ক্লিক করলে তার ফেজ টাইমলাইন দেখা যাবে</CardDescription>
          </div>
          <NewUnitButton projectId={project.id} phaseCount={project.phaseTemplates.length} />
        </CardHeader>
        <CardContent className="px-0 sm:px-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[110px]">ইউনিট</TableHead>
                  <TableHead className="hidden sm:table-cell">আয়তন</TableHead>
                  <TableHead>মূল্য</TableHead>
                  <TableHead>স্ট্যাটাস</TableHead>
                  <TableHead className="min-w-[160px]">নির্মাণ অগ্রগতি</TableHead>
                  <TableHead className="w-12 text-right">
                    <span className="sr-only">অপশন</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {project.units.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      এখনো কোনো ইউনিট যোগ করা হয়নি
                    </TableCell>
                  </TableRow>
                ) : (
                  project.units.map((unit) => {
                    const summary = summarizePhases(unit.phases, now);

                    return (
                      <TableRow key={unit.id}>
                        <TableCell>
                          <Link
                            href={`/admin/projects/${project.id}/units/${unit.id}`}
                            className="font-medium hover:underline"
                          >
                            {unit.unitNo}
                          </Link>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                          {unit.sizeSqft ? `${Number(unit.sizeSqft)} sqft` : '—'}
                        </TableCell>
                        <TableCell className="text-sm tabular-nums">
                          {formatBDT(Number(unit.price))}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="whitespace-nowrap">
                            {UNIT_STATUS_LABEL[unit.status]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {summary.total === 0 ? (
                            <span className="text-xs text-muted-foreground">টাইমলাইন নেই</span>
                          ) : (
                            <div className="space-y-1">
                              <PhaseProgressBar progress={summary.progress} />
                              <p className="truncate text-[11px] text-muted-foreground">
                                {summary.current
                                  ? (summary.current.nameBn ?? summary.current.name)
                                  : 'সব ফেজ সম্পন্ন'}
                                {summary.delayedCount > 0 ? (
                                  <span className="font-medium text-destructive">
                                    {' '}
                                    · {summary.delayedCount} বিলম্বিত
                                  </span>
                                ) : null}
                              </p>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <UnitRowActions
                            unit={{
                              id: unit.id,
                              unitNo: unit.unitNo,
                              sizeSqft: unit.sizeSqft ? String(Number(unit.sizeSqft)) : null,
                              price: String(Number(unit.price)),
                              status: unit.status,
                              locked: unit.sale !== null,
                            }}
                            projectId={project.id}
                            phaseCount={project.phaseTemplates.length}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
