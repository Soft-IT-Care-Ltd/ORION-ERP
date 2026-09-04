import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { format } from 'date-fns';
import type { LeadActivityType } from '@prisma/client';
import {
  ArrowLeft,
  ArrowRightLeft,
  Building2,
  CalendarClock,
  CirclePlus,
  Globe2,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  PhoneCall,
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
  FOLLOW_UP_TONE_CLASS,
  followUpTone,
  lostReasonLabel,
  SOURCE_LABEL,
  STAGE_ACCENT,
  STAGE_LABEL,
} from '@/lib/leads';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { leadCardSelect, startOfToday, toEditableLead } from '../serialize';
import { AddNoteForm } from './add-note-form';
import { DocumentList } from './document-list';
import { DocumentUploadForm } from './document-upload-form';
import { LeadDetailActions } from './lead-detail-actions';

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

export default async function LeadDetailPage({ params }: { params: { id: string } }) {
  const user = await getAuthorizedUser('lead:viewOwn');
  if (!user) redirect('/');

  // scope সহ — অন্যের লিডের id দিলে 404, "নেই" আর "দেখার অনুমতি নেই" আলাদা করা হয় না
  const lead = await prisma.lead.findFirst({
    where: { id: params.id, ...leadScope(user) },
    select: {
      ...leadCardSelect,
      createdAt: true,
      interestedUnit: {
        select: {
          id: true,
          unitNo: true,
          project: { select: { name: true, location: true } },
        },
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
  const viewAll = can(user.role, 'lead:viewAll');
  const executives = canEdit ? await findAssignableExecutives() : [];
  const units = canEdit
    ? await prisma.unit.findMany({
        select: { id: true, unitNo: true, project: { select: { name: true } } },
        orderBy: [{ project: { name: 'asc' } }, { unitNo: 'asc' }],
        take: 200,
      })
    : [];

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
          units={units.map((u) => ({
            id: u.id,
            label: `${u.project.name} — ${u.unitNo}`,
          }))}
          canAssign={viewAll}
          canEdit={canEdit}
        />
      </div>

      {lead.stage === 'LOST' && lead.lostReason ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <span className="font-medium">Lost</span> — {lostReasonLabel(lead.lostReason)}
        </div>
      ) : null}

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

            <InfoRow icon={Building2} label="আগ্রহী ইউনিট">
              {lead.interestedUnit ? (
                <>
                  {lead.interestedUnit.project.name} — {lead.interestedUnit.unitNo}
                  <span className="block text-xs text-muted-foreground">
                    {lead.interestedUnit.project.location}
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground">নির্ধারিত নয়</span>
              )}
            </InfoRow>

            <InfoRow icon={MapPin} label="প্রজেক্ট / জমির অবস্থান">
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
                      <span className="text-muted-foreground"> ({lead.localContactRelation})</span>
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
                          {ACTIVITY_LABEL[activity.type]} · {activity.createdBy?.name ?? 'সিস্টেম'}{' '}
                          · {format(activity.createdAt, 'dd MMM yyyy, h:mm a')}
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
    </div>
  );
}
