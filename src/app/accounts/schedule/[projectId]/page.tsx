import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { format } from 'date-fns';
import { ArrowLeft, HardHat, MapPin, Phone, User } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { getAuthorizedUser } from '@/lib/guards';
import { can } from '@/lib/rbac';
import {
  findScopedProjectHeader,
  loadProjectPlan,
  markOverdueInstallments,
} from '@/lib/payment-data';
import { loadProjectDocuments } from '@/lib/document-data';
import { groupDocuments } from '@/lib/documents';
import { buildingTypeLabel } from '@/lib/leads';
import { PROJECT_STATUS_BADGE, PROJECT_STATUS_HINT, PROJECT_STATUS_LABEL } from '@/lib/projects';
import { cn, formatBDT } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PaymentScheduleTable, PaymentSummary } from '@/components/payment-schedule';
import { DocumentGroupList } from '@/components/documents';
import { PaymentEntryButton } from '../../payments/payment-entry-dialog';
import { PlanBuilder } from './plan-builder';
import { ProjectDocumentUploadForm } from './document-upload-form';

export const metadata = { title: 'পেমেন্ট প্ল্যান' };

export const dynamic = 'force-dynamic';

/**
 * PRD সেকশন ৫.৫ — এক প্রজেক্টের পেমেন্ট প্ল্যান: বিল্ডার + রঙ-কোডেড শিডিউল +
 * প্রতিটি কিস্তির বিপরীতে পেমেন্ট এন্ট্রি।
 *
 * প্রজেক্টের কাগজপত্রও (PRD সেকশন ৫.৮ — চুক্তি, সরকারি অনুমোদন কপি, রসিদ)
 * এখান থেকেই আপলোড হয়। Admin এর `ROUTE_ROLES` এ `/accounts` অনুমোদিত, তাই দুই
 * প্যানেলের জন্য আলাদা ফর্ম রাখার দরকার নেই।
 */
export default async function SchedulePage({ params }: { params: { projectId: string } }) {
  const accounts = await getAuthorizedUser('paymentPlan:view');
  if (!accounts) redirect('/');

  const now = new Date();
  await markOverdueInstallments(now);

  const project = await findScopedProjectHeader(accounts, params.projectId);
  if (!project) notFound();

  const [plan, documents, phases] = await Promise.all([
    loadProjectPlan(project.id, now),
    // অফিসের কে ফাইলটি দিয়েছেন সেটি এখানে দরকারি (কাস্টমারের পাতায় নয়)
    loadProjectDocuments(project.id, project.title, { showUploader: true }).then(groupDocuments),
    // কিস্তির সাথে ফেজ লিংক করার ড্রপডাউন (PRD সেকশন ৫.৫)
    prisma.phase.findMany({
      where: { projectId: params.projectId },
      select: { id: true, name: true, order: true },
      orderBy: { order: 'asc' },
    }),
  ]);

  // প্ল্যান এডিট ও পেমেন্ট এন্ট্রি — PRD সেকশন ৪ (রোল হার্ডকোড না করে permission দিয়ে)
  const canManage = can(accounts.role, 'paymentPlan:manage');
  // ডকুমেন্ট আপলোড আলাদা permission — Admin ও Accounts (PRD সেকশন ৪)
  const canManageDocuments = can(accounts.role, 'document:manageProject');

  // যে কিস্তিতে টাকা জমা পড়েছে সেটি বিল্ডারে তালা-দেওয়া থাকবে
  const lockedIds = plan.installments.filter((i) => i.payments.length > 0).map((i) => i.id);

  const projectOption = [
    { id: project.id, label: project.title, customerName: project.customer.user.name },
  ];

  const openInstallments = plan.installments
    .filter((i) => i.remaining > 0)
    .map((i) => ({
      id: i.id,
      label: i.label,
      dueDateLabel: i.dueDateLabel,
      remaining: i.remaining,
      status: i.status,
    }));

  // শিডিউল টেবিলের প্রতিটি সারিতে "জমা নিন" — পরিশোধিত কিস্তিতে নয়
  const actions = canManage
    ? Object.fromEntries(
        plan.installments
          .filter((installment) => installment.remaining > 0)
          .map((installment) => [
            installment.id,
            <PaymentEntryButton
              key={installment.id}
              projects={projectOption}
              initialProjectId={project.id}
              initialInstallmentId={installment.id}
              initialInstallments={openInstallments}
              label="জমা নিন"
              size="sm"
              variant="outline"
            />,
          ]),
      )
    : undefined;

  const building = buildingTypeLabel(project.buildingType);

  return (
    <div className="space-y-4">
      <Link
        href="/accounts/schedule"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        সব শিডিউল
      </Link>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="text-base">{project.customer.user.name}</CardTitle>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <HardHat className="h-3.5 w-3.5" />
                  {project.title}
                </span>
                {project.landLocation ? (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {project.landLocation}
                  </span>
                ) : null}
                {project.customer.user.phone ? (
                  <a
                    href={`tel:${project.customer.user.phone}`}
                    className="inline-flex items-center gap-1 hover:text-foreground"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    {project.customer.user.phone}
                  </a>
                ) : null}
                <span className="inline-flex items-center gap-1">
                  <User className="h-3.5 w-3.5" />
                  {project.customer.user.email}
                </span>
              </div>
            </div>
            <div className="text-right">
              <Badge
                className={cn('text-[11px]', PROJECT_STATUS_BADGE[project.status])}
                variant="secondary"
              >
                {PROJECT_STATUS_LABEL[project.status]}
              </Badge>
              <p className="mt-1 text-xs text-muted-foreground">
                {PROJECT_STATUS_HINT[project.status]}
              </p>
              <p className="mt-1 text-sm">
                {building ? `${building} · ` : ''}
                শুরু{' '}
                {format(project.startDate ?? project.createdAt, 'dd MMM yyyy')} ·{' '}
                <span className="font-semibold tabular-nums">
                  {formatBDT(Number(project.totalContractValue))}
                </span>
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <PaymentSummary
            summary={plan.summary}
            title="পেমেন্ট সারসংক্ষেপ"
            subtitle={
              plan.installments.length > 0
                ? `${plan.summary.count} টি কিস্তি · ${plan.summary.paidCount} টি পরিশোধিত`
                : 'এখনো শিডিউল তৈরি হয়নি'
            }
          />
        </CardContent>
      </Card>

      {canManage ? (
        <PlanBuilder
          projectId={project.id}
          totalAmount={Number(project.totalContractValue)}
          startDate={format(project.startDate ?? project.createdAt, 'yyyy-MM-dd')}
          installments={plan.installments}
          lockedIds={lockedIds}
          phases={phases}
        />
      ) : null}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base">পেমেন্ট শিডিউল</CardTitle>
          {canManage && openInstallments.length > 0 ? (
            <PaymentEntryButton
              projects={projectOption}
              initialProjectId={project.id}
              initialInstallments={openInstallments}
              size="sm"
            />
          ) : null}
        </CardHeader>
        <CardContent>
          <PaymentScheduleTable
            installments={plan.installments}
            actions={actions}
            emptyMessage="এই প্রজেক্টের জন্য এখনো পেমেন্ট প্ল্যান তৈরি হয়নি"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">ডকুমেন্ট</CardTitle>
          <CardDescription>
            কনস্ট্রাকশন চুক্তি, সরকারি অনুমোদন কপি, ডিজাইন ড্রয়িং ও রসিদ — কাস্টমার নিজের
            পোর্টাল থেকে এগুলো ডাউনলোড করতে পারেন
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <DocumentGroupList
            groups={documents}
            emptyMessage="এই প্রজেক্টের কোনো ডকুমেন্ট এখনো আপলোড করা হয়নি"
          />
          {canManageDocuments ? (
            <div className="border-t pt-4">
              <ProjectDocumentUploadForm projectId={project.id} />
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
