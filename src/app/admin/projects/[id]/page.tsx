import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { format } from 'date-fns';
import { ArrowLeft, ExternalLink, HardHat, MapPin, UserRound, Video, Wallet } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { getAuthorizedUser } from '@/lib/guards';
import { findAssignableEngineers } from '@/lib/project-access';
import { loadProjectTimeline } from '@/lib/phase-data';
import { loadProjectPlan } from '@/lib/payment-data';
import { buildingTypeLabel } from '@/lib/leads';
import { isEmbeddableStreamUrl, PROJECT_STATUS_BADGE, PROJECT_STATUS_LABEL } from '@/lib/projects';
import { cn, formatBDT } from '@/lib/utils';
import { formatPhoneInternational } from '@/lib/phone';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PhaseProgressSummary, PhaseTimeline, PhaseUpdateLog } from '@/components/phase-timeline';
import { PaymentScheduleTable, PaymentSummary } from '@/components/payment-schedule';
import { ApplyTemplateButton } from '../apply-template-button';
import { ProjectRowActions } from '../project-row-actions';
import type { EditableProject, EngineerOption } from '../project-edit-dialog';

export const metadata = { title: 'প্রজেক্ট বিবরণ' };

export const dynamic = 'force-dynamic';

export default async function ProjectDetailPage({ params }: { params: { id: string } }) {
  const admin = await getAuthorizedUser('project:manage');
  if (!admin) redirect('/');

  const now = new Date();

  const [project, engineerRows] = await Promise.all([
    prisma.project.findUnique({
      where: { id: params.id },
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
        createdAt: true,
        engineer: { select: { id: true, name: true, email: true } },
        customer: {
          select: { user: { select: { name: true, email: true, phone: true } } },
        },
        lead: { select: { id: true, name: true, landSize: true } },
        _count: { select: { phases: true, documents: true } },
      },
    }),
    findAssignableEngineers(),
  ]);

  if (!project) notFound();

  const [timeline, plan] = await Promise.all([
    loadProjectTimeline(project.id, now),
    loadProjectPlan(project.id, now),
  ]);

  const engineers = engineerRows as EngineerOption[];
  const building = buildingTypeLabel(project.buildingType);
  const editable: EditableProject = {
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
          <h1 className="text-xl font-semibold">{project.title}</h1>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <UserRound className="h-3.5 w-3.5" />
              {project.customer.user.name}
              {project.customer.user.phone
                ? ` · ${formatPhoneInternational(project.customer.user.phone)}`
                : ''}
            </span>
            {project.landLocation ? (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {project.landLocation}
              </span>
            ) : null}
          </p>
        </div>
        <ProjectRowActions
          project={editable}
          engineers={engineers}
          phaseCount={project._count.phases}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span
          className={cn('rounded px-2 py-0.5 text-xs font-medium', PROJECT_STATUS_BADGE[project.status])}
        >
          {PROJECT_STATUS_LABEL[project.status]}
        </span>
        {building ? <Badge variant="secondary">{building}</Badge> : null}
        {project.floors ? <Badge variant="outline">{project.floors} তলা</Badge> : null}
        {project.lead.landSize ? (
          <Badge variant="outline">জমি {project.lead.landSize}</Badge>
        ) : null}
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
        <Button asChild size="sm" variant="ghost">
          <Link href={`/sales/leads/${project.lead.id}`}>
            লিড ও বিলিং দেখুন
            <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Wallet className="h-3.5 w-3.5" />
              কন্ট্রাক্ট ভ্যালু
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-xl font-semibold tabular-nums">
              {formatBDT(Number(project.totalContractValue))}
            </p>
            {project.ratePerSqft && project.totalSqft ? (
              <p className="text-xs text-muted-foreground">
                ৳{Number(project.ratePerSqft)}/sqft × {Number(project.totalSqft)} sqft
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              আদায় হয়েছে
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-xl font-semibold tabular-nums text-emerald-600">
              {formatBDT(plan.summary.collected)}
            </p>
            <p className="text-xs text-muted-foreground">
              বাকি {formatBDT(plan.summary.outstanding)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              ডকুমেন্ট ও পেমেন্ট প্ল্যান
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-sm">
              {project._count.documents} টি ডকুমেন্ট ·{' '}
              {plan.planId ? `${plan.installments.length} টি কিস্তি` : 'প্ল্যান বাকি'}
            </p>
            <Button asChild size="sm" variant="outline" className="mt-2">
              <Link href={`/accounts/schedule/${project.id}`}>
                {plan.planId ? 'শিডিউল দেখুন' : 'প্ল্যান তৈরি করুন'}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* PRD সেকশন ৫.৪ — লাইভ CC ক্যামেরা (Admin এখানে যাচাই করে নিতে পারেন) */}
      {isEmbeddableStreamUrl(project.cameraStreamUrl) ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Video className="h-4 w-4 text-muted-foreground" />
              লাইভ ক্যামেরা
            </CardTitle>
            <CardDescription>
              কাস্টমার পোর্টালে এই ফিডটিই দেখানো হয়। লিংক বদলাতে &ldquo;এডিট&rdquo; ব্যবহার করুন।
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="aspect-video w-full overflow-hidden rounded-md border bg-muted">
              <iframe
                src={project.cameraStreamUrl ?? ''}
                title={`${project.title} — লাইভ ক্যামেরা`}
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
                referrerPolicy="no-referrer"
                sandbox="allow-scripts allow-same-origin allow-presentation"
                className="h-full w-full"
              />
            </div>
            <a
              href={project.cameraStreamUrl ?? '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 break-all text-xs text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="h-3 w-3 shrink-0" />
              {project.cameraStreamUrl}
            </a>
          </CardContent>
        </Card>
      ) : null}

      <PhaseProgressSummary
        summary={timeline.summary}
        title="নির্মাণ অগ্রগতি"
        subtitle={project.title}
      />

      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="text-base">ফেজ টাইমলাইন</CardTitle>
            <CardDescription>
              শুধু দেখার জন্য — % ও ছবি আপডেট করেন দায়িত্বপ্রাপ্ত সাইট ইঞ্জিনিয়ার (PRD সেকশন ৪)।
            </CardDescription>
          </div>
          <ApplyTemplateButton
            projectId={project.id}
            hasPhases={project._count.phases > 0}
            defaultStartDate={project.startDate ? format(project.startDate, 'yyyy-MM-dd') : null}
          />
        </CardHeader>
        <CardContent>
          <PhaseTimeline
            phases={timeline.phases}
            emptyMessage="এই প্রজেক্টে টাইমলাইন নেই — উপরের বোতাম দিয়ে টেমপ্লেট প্রয়োগ করুন"
          />
        </CardContent>
      </Card>

      {plan.installments.length > 0 ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">পেমেন্ট শিডিউল</CardTitle>
            <CardDescription>
              কিস্তি সেট/এডিট করেন Accounts —{' '}
              <Link href={`/accounts/schedule/${project.id}`} className="underline">
                শিডিউল পাতা
              </Link>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 px-0 sm:px-6">
            <div className="px-4 sm:px-0">
              <PaymentSummary
                summary={plan.summary}
                title="পেমেন্ট প্ল্যান"
                subtitle={project.title}
              />
            </div>
            <PaymentScheduleTable
              installments={plan.installments}
              emptyMessage="এই প্রজেক্টের জন্য এখনো পেমেন্ট প্ল্যান তৈরি হয়নি"
            />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">সাইট আপডেট ({timeline.updates.length})</CardTitle>
          <CardDescription>ইঞ্জিনিয়ারের দেওয়া অগ্রগতি, মন্তব্য ও সাইট ফটো</CardDescription>
        </CardHeader>
        <CardContent>
          <PhaseUpdateLog updates={timeline.updates} />
        </CardContent>
      </Card>
    </div>
  );
}
