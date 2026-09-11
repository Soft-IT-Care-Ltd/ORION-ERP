import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { format } from 'date-fns';
import type { LeadActivityType } from '@prisma/client';
import {
  ArrowLeft,
  ArrowRight,
  ArrowRightLeft,
  Building2,
  CalendarClock,
  CirclePlus,
  Globe2,
  HardHat,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  PhoneCall,
  Ruler,
  UserRound,
  UserCog,
  Wallet,
} from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { getAuthorizedUser } from '@/lib/guards';
import { can } from '@/lib/rbac';
import { findAssignableExecutives, leadScope } from '@/lib/lead-access';
import { cn, formatBDT } from '@/lib/utils';
import { countryFlag, countryLabel } from '@/lib/countries';
import { formatPhoneInternational, formatPhoneNational } from '@/lib/phone';
import {
  ACTIVITY_LABEL,
  budgetLabel,
  buildingTypeLabel,
  CONDITIONAL_STAGE_HINT,
  FOLLOW_UP_TONE_CLASS,
  followUpTone,
  isConditionalStage,
  lostReasonLabel,
  SOURCE_LABEL,
  STAGE_ACCENT,
  STAGE_LABEL,
} from '@/lib/leads';
import { PROJECT_STATUS_BADGE, PROJECT_STATUS_LABEL } from '@/lib/projects';
import { loadLeadLedger } from '@/lib/ledger-data';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { leadCardSelect, startOfToday, toEditableLead } from '../serialize';
import { AddNoteForm } from './add-note-form';
import { BillingSection } from './billing-section';
import { ChecklistSection, type ChecklistItemView } from './checklist-section';
import { DocumentList } from './document-list';
import { DocumentUploadForm } from './document-upload-form';
import { LeadDetailActions } from './lead-detail-actions';
import { DEFAULT_LEAD_TAB, isLeadTab, LeadTabs } from './lead-tabs';

export const metadata = { title: 'লিড বিস্তারিত' };

export const dynamic = 'force-dynamic';

const ACTIVITY_ICON: Record<LeadActivityType, typeof MessageSquare> = {
  CREATED: CirclePlus,
  NOTE: MessageSquare,
  STAGE_CHANGED: ArrowRightLeft,
  ASSIGNED: UserCog,
  FOLLOW_UP_SET: CalendarClock,
};

function InfoRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Phone;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="text-sm">{children}</div>
      </div>
    </div>
  );
}

export default async function LeadDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { tab?: string };
}) {
  const user = await getAuthorizedUser('lead:viewOwn');
  if (!user) redirect('/');

  // scope সহ — অন্যের লিডের id দিলে 404, "নেই" আর "দেখার অনুমতি নেই" আলাদা করা হয় না
  const lead = await prisma.lead.findFirst({
    where: { id: params.id, ...leadScope(user) },
    select: {
      ...leadCardSelect,
      createdAt: true,
      // কার্ডের চেয়ে বেশি — কাস্টমার কে, কবে প্রজেক্ট শুরু
      project: {
        select: {
          id: true,
          title: true,
          status: true,
          totalContractValue: true,
          ratePerSqft: true,
          totalSqft: true,
          startDate: true,
          createdAt: true,
          customer: {
            select: { id: true, user: { select: { name: true, email: true, phone: true } } },
          },
          _count: { select: { phases: true } },
        },
      },
      checklist: {
        select: {
          id: true,
          label: true,
          status: true,
          note: true,
          doneAt: true,
          doneBy: { select: { name: true } },
        },
        orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
      },
      activities: {
        select: {
          id: true,
          type: true,
          note: true,
          createdAt: true,
          createdBy: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 200,
      },
      documents: {
        select: {
          id: true,
          fileUrl: true,
          fileName: true,
          fileType: true,
          description: true,
          uploadedAt: true,
          uploadedBy: { select: { name: true } },
        },
        orderBy: { uploadedAt: 'desc' },
        take: 200,
      },
    },
  });
  if (!lead) notFound();

  const canEdit = can(user.role, 'lead:edit');
  const canUpload = can(user.role, 'document:upload');
  const canManageChecklist = can(user.role, 'checklist:manage');
  // PRD সেকশন ৪ — বিলিং ট্যাব শুধু যারা লেজার দেখতে পারেন; তৈরি করতে পারেন
  // শুধু ADMIN ও ACCOUNTS (`ledger:manage`), MARKETING read-only
  const canViewLedger = can(user.role, 'ledger:view');
  const canManageLedger = can(user.role, 'ledger:manage');
  const viewAll = can(user.role, 'lead:viewAll');
  const executives = canEdit ? await findAssignableExecutives() : [];

  const requestedTab = isLeadTab(searchParams.tab) ? searchParams.tab : DEFAULT_LEAD_TAB;
  // অনুমতি না থাকলে বিলিং ট্যাবটি নেই — URL এ হাতে লিখলেও সারসংক্ষেপে ফিরে যায়
  const tab = requestedTab === 'billing' && !canViewLedger ? DEFAULT_LEAD_TAB : requestedTab;

  // লেজারটি শুধু তখনই লোড হয় যখন ট্যাবটি খোলা ও অনুমতি আছে — অন্য ট্যাবে
  // অপ্রয়োজনীয় কুয়েরি চলে না, আর ডেটাটি ব্রাউজারেও যায় না
  const ledger =
    tab === 'billing' && canViewLedger
      ? await loadLeadLedger(lead.id, { name: lead.name, phone: lead.phone })
      : null;

  const today = startOfToday();
  const residence = countryLabel(lead.residenceCountry);
  const hasLocalContact = Boolean(
    lead.localContactName || lead.localContactPhone || lead.localContactRelation,
  );
  const budget = budgetLabel(
    lead.budgetMin === null ? null : Number(lead.budgetMin),
    lead.budgetMax === null ? null : Number(lead.budgetMax),
    formatBDT,
  );
  const building = buildingTypeLabel(lead.buildingType);

  const checklistItems: ChecklistItemView[] = lead.checklist.map((item) => ({
    id: item.id,
    label: item.label,
    done: item.status === 'DONE',
    note: item.note,
    doneByName: item.doneBy?.name ?? null,
    doneAtLabel: item.doneAt ? format(item.doneAt, 'dd MMM yyyy, h:mm a') : null,
  }));

  return (
    <div className="space-y-4">
      <Link
        href="/sales/pipeline"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        পাইপলাইনে ফিরুন
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold">{lead.name}</h1>
            <Badge variant="secondary" className="gap-1.5 whitespace-nowrap">
              <span className={cn('h-2 w-2 rounded-full', STAGE_ACCENT[lead.stage])} />
              {STAGE_LABEL[lead.stage]}
            </Badge>
            {isConditionalStage(lead.stage) ? (
              <span className="rounded-full border border-dashed px-2 py-0.5 text-[11px] text-muted-foreground">
                {CONDITIONAL_STAGE_HINT}
              </span>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">
            {format(lead.createdAt, 'dd MMM yyyy')} এ তৈরি · সোর্স {SOURCE_LABEL[lead.source]}
            {residence ? ` · ${countryFlag(lead.residenceCountry)} ${residence}` : ''}
          </p>
        </div>

        <LeadDetailActions
          lead={toEditableLead(lead)}
          stage={lead.stage}
          leadName={lead.name}
          executives={executives}
          canAssign={viewAll}
          canEdit={canEdit}
          canConvert={can(user.role, 'lead:convert')}
          hasProject={lead.project !== null}
        />
      </div>

      {lead.stage === 'LOST' && lead.lostReason ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <span className="font-medium">Lost</span> — {lostReasonLabel(lead.lostReason)}
        </div>
      ) : null}

      {/* PRD সেকশন ৫.৩ — Won এ কনভার্ট হওয়া কনস্ট্রাকশন প্রজেক্টের সারাংশ */}
      {lead.project ? (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                <HardHat className="h-4 w-4 text-muted-foreground" />
                প্রজেক্ট
                <span
                  className={cn(
                    'rounded px-1.5 py-0.5 text-xs font-medium',
                    PROJECT_STATUS_BADGE[lead.project.status],
                  )}
                >
                  {PROJECT_STATUS_LABEL[lead.project.status]}
                </span>
              </CardTitle>
              <Button asChild size="sm" variant="outline">
                <Link href={`/admin/projects/${lead.project.id}`}>
                  প্রজেক্ট দেখুন
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <InfoRow icon={Building2} label="প্রজেক্ট">
              {lead.project.title}
              <span className="block text-xs text-muted-foreground">
                {lead.project._count.phases} টি ফেজ
              </span>
            </InfoRow>
            <InfoRow icon={Wallet} label="কন্ট্রাক্ট ভ্যালু">
              <span className="font-medium">
                {formatBDT(Number(lead.project.totalContractValue))}
              </span>
              {lead.project.ratePerSqft && lead.project.totalSqft ? (
                <span className="block text-xs text-muted-foreground">
                  ৳{Number(lead.project.ratePerSqft)}/sqft × {Number(lead.project.totalSqft)} sqft
                </span>
              ) : null}
            </InfoRow>
            <InfoRow icon={UserRound} label="কাস্টমার">
              {lead.project.customer.user.name}
              <span className="block break-all text-xs text-muted-foreground">
                {lead.project.customer.user.email}
              </span>
            </InfoRow>
            <InfoRow icon={CalendarClock} label="নির্মাণ শুরু">
              {lead.project.startDate
                ? format(lead.project.startDate, 'dd MMM yyyy')
                : 'নির্ধারিত নয়'}
              <span className="block text-xs text-muted-foreground">
                {format(lead.project.createdAt, 'dd MMM yyyy')} এ কনভার্ট
              </span>
            </InfoRow>
          </CardContent>
        </Card>
      ) : null}

      <LeadTabs
        leadId={lead.id}
        active={tab}
        tabs={[
          { id: 'overview', label: 'সারসংক্ষেপ' },
          { id: 'checklist', label: 'চেকলিস্ট', count: checklistItems.length },
          ...(canViewLedger
            ? ([{ id: 'billing', label: 'বিলিং / লেজার' }] as const)
            : ([] as const)),
        ]}
      />

      {tab === 'overview' ? (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <Card className="h-fit">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">লিড তথ্য</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <InfoRow icon={Phone} label="ফোন">
                <a href={`tel:${lead.phone}`} className="hover:underline">
                  {formatPhoneInternational(lead.phone)}
                </a>
              </InfoRow>

              <InfoRow icon={Globe2} label="বর্তমান বসবাস">
                {residence ? (
                  <span>
                    <span aria-hidden className="mr-1">
                      {countryFlag(lead.residenceCountry)}
                    </span>
                    {residence}
                  </span>
                ) : (
                  <span className="text-muted-foreground">নির্ধারিত নয়</span>
                )}
              </InfoRow>

              <InfoRow icon={Mail} label="ইমেইল">
                {lead.email ? (
                  <a href={`mailto:${lead.email}`} className="break-all hover:underline">
                    {lead.email}
                  </a>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </InfoRow>

              <InfoRow icon={Wallet} label="বাজেট রেঞ্জ">
                {budget ?? <span className="text-muted-foreground">—</span>}
              </InfoRow>

              {/* PRD সেকশন ৫.১ — কনস্ট্রাকশন সার্ভিসে এই দুটোই কাজের ভিত্তি */}
              <InfoRow icon={Building2} label="বাড়ির ধরন">
                {building ?? <span className="text-muted-foreground">নির্ধারিত নয়</span>}
              </InfoRow>

              <InfoRow icon={Ruler} label="জমির আয়তন">
                {lead.landSize ?? <span className="text-muted-foreground">নির্ধারিত নয়</span>}
              </InfoRow>

              <InfoRow icon={MapPin} label="জমির অবস্থান">
                {lead.projectLocation ?? <span className="text-muted-foreground">নির্ধারিত নয়</span>}
              </InfoRow>

              <Separator />

              <InfoRow icon={UserCog} label="মার্কেটিং এক্সিকিউটিভ">
                {lead.assignedTo?.name ?? (
                  <span className="text-muted-foreground">অ্যাসাইন করা হয়নি</span>
                )}
              </InfoRow>

              <InfoRow icon={CalendarClock} label="পরবর্তী ফলো-আপ">
                {lead.nextFollowUpAt ? (
                  <span
                    className={cn(
                      'font-medium',
                      FOLLOW_UP_TONE_CLASS[followUpTone(lead.nextFollowUpAt, today)],
                    )}
                  >
                    {format(lead.nextFollowUpAt, 'dd MMM yyyy')}
                  </span>
                ) : (
                  <span className="text-muted-foreground">নির্ধারিত নয়</span>
                )}
              </InfoRow>

              {/* PRD সেকশন ৫.১ — প্রবাসী ক্লায়েন্টের দেশে থাকা যোগাযোগকারী */}
              {hasLocalContact ? (
                <>
                  <Separator />
                  <InfoRow icon={PhoneCall} label="লোকাল কন্টাক্ট (বাংলাদেশে)">
                    <p>
                      {lead.localContactName ?? '—'}
                      {lead.localContactRelation ? (
                        <span className="text-muted-foreground">
                          {' '}
                          ({lead.localContactRelation})
                        </span>
                      ) : null}
                    </p>
                    {lead.localContactPhone ? (
                      <a href={`tel:${lead.localContactPhone}`} className="hover:underline">
                        {formatPhoneNational(lead.localContactPhone)}
                      </a>
                    ) : null}
                  </InfoRow>
                </>
              ) : null}
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  ডকুমেন্ট
                  {lead.documents.length > 0 ? (
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      {lead.documents.length} টি
                    </span>
                  ) : null}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {canUpload ? <DocumentUploadForm leadId={lead.id} /> : null}
                <DocumentList
                  documents={lead.documents.map((doc) => ({
                    id: doc.id,
                    fileUrl: doc.fileUrl,
                    fileName: doc.fileName,
                    fileType: doc.fileType,
                    description: doc.description,
                    uploadedByName: doc.uploadedBy.name,
                    uploadedAtLabel: format(doc.uploadedAt, 'dd MMM yyyy'),
                  }))}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">অ্যাক্টিভিটি ও নোট</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {canEdit ? (
                  <>
                    <AddNoteForm leadId={lead.id} />
                    <Separator />
                  </>
                ) : null}

                {lead.activities.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    এখনো কোনো অ্যাক্টিভিটি নেই।
                  </p>
                ) : (
                  <ol className="relative space-y-4 border-l pl-6">
                    {lead.activities.map((activity) => {
                      const Icon = ACTIVITY_ICON[activity.type];
                      return (
                        <li key={activity.id} className="relative">
                          <span className="absolute -left-[33px] flex h-5 w-5 items-center justify-center rounded-full border bg-background">
                            <Icon className="h-3 w-3 text-muted-foreground" />
                          </span>
                          <p className="text-sm">{activity.note}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {ACTIVITY_LABEL[activity.type]} ·{' '}
                            {activity.createdBy?.name ?? 'সিস্টেম'} ·{' '}
                            {format(activity.createdAt, 'dd MMM yyyy, h:mm a')}
                          </p>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}

      {tab === 'checklist' ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">চেকলিস্ট</CardTitle>
            <p className="text-sm text-muted-foreground">
              কোন কাজ শেষ, কোনটা বাকি, কোন কাগজ ক্লায়েন্ট থেকে নেওয়া হয়েছে — PRD সেকশন ৫.১।
            </p>
          </CardHeader>
          <CardContent>
            <ChecklistSection
              leadId={lead.id}
              items={checklistItems}
              canManage={canManageChecklist}
            />
          </CardContent>
        </Card>
      ) : null}

      {tab === 'billing' && ledger ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">বিলিং ও ইন্টারনাল কস্ট</CardTitle>
            <p className="text-sm text-muted-foreground">
              সাইট ভিজিট, সার্ভে, সয়েল টেস্ট, ডিজাইন ও সরকারি অনুমোদনের বিল এবং তার বিপরীতে
              Orion এর খরচ — Won হওয়ার আগেও এখানে লেখা যায় (PRD সেকশন ৫.২)।
            </p>
          </CardHeader>
          <CardContent>
            <BillingSection
              leadId={lead.id}
              entries={ledger.entries}
              summary={ledger.summary}
              canManage={canManageLedger}
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
