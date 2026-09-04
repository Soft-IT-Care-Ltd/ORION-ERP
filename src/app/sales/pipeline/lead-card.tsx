'use client';

import Link from 'next/link';
import { CSS } from '@dnd-kit/utilities';
import { useDraggable } from '@dnd-kit/core';
import {
  CalendarClock,
  GripVertical,
  Loader2,
  MoreVertical,
  Pencil,
  Phone,
  User2,
  Wallet,
} from 'lucide-react';
import type { LeadStage } from '@prisma/client';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  FOLLOW_UP_TONE_CLASS,
  LEAD_STAGES,
  lostReasonLabel,
  STAGE_LABEL,
} from '@/lib/leads';
import type { PipelineLead } from './types';

function CardBody({
  lead,
  canEdit,
  pending,
  onEdit,
  onChangeStage,
  dragHandle,
}: {
  lead: PipelineLead;
  canEdit: boolean;
  pending: boolean;
  onEdit?: (lead: PipelineLead) => void;
  onChangeStage?: (lead: PipelineLead, stage: LeadStage) => void;
  dragHandle?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex overflow-hidden rounded-lg border bg-card shadow-sm transition-shadow',
        pending && 'opacity-60',
      )}
    >
      {dragHandle}

      <div className="min-w-0 flex-1 p-3">
        <div className="flex items-start gap-2">
          <Link
            href={`/sales/leads/${lead.id}`}
            className="min-w-0 flex-1 text-sm font-semibold leading-tight hover:underline"
          >
            {lead.name}
          </Link>

          {pending ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
          ) : canEdit ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                className="-mr-1 -mt-1 shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={`${lead.name} — অপশন`}
              >
                <MoreVertical className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem asChild>
                  <Link href={`/sales/leads/${lead.id}`}>বিস্তারিত ও নোট</Link>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onEdit?.(lead)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  এডিট
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {/* মোবাইল / কীবোর্ড ফলব্যাক — drag ছাড়াই স্টেজ বদলানো */}
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>স্টেজ পরিবর্তন</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="max-h-[60vh] overflow-y-auto">
                    <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                      বর্তমান: {STAGE_LABEL[lead.stage]}
                    </DropdownMenuLabel>
                    <DropdownMenuRadioGroup
                      value={lead.stage}
                      onValueChange={(value) => onChangeStage?.(lead, value as LeadStage)}
                    >
                      {LEAD_STAGES.map((stage) => (
                        <DropdownMenuRadioItem key={stage} value={stage}>
                          {STAGE_LABEL[stage]}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>

        <a
          href={`tel:${lead.phone}`}
          className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <Phone className="h-3 w-3 shrink-0" />
          {lead.phone}
        </a>

        {lead.budgetLabel ? (
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Wallet className="h-3 w-3 shrink-0" />
            <span className="truncate">{lead.budgetLabel}</span>
          </p>
        ) : null}

        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          <User2 className="h-3 w-3 shrink-0" />
          <span className="truncate">{lead.assignedToName ?? 'অ্যাসাইন করা হয়নি'}</span>
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            {lead.sourceLabel}
          </span>

          {lead.followUpLabel ? (
            <span
              className={cn(
                'flex items-center gap-1 text-[11px] font-medium',
                FOLLOW_UP_TONE_CLASS[lead.followUpTone ?? 'upcoming'],
              )}
            >
              <CalendarClock className="h-3 w-3 shrink-0" />
              {lead.followUpLabel}
            </span>
          ) : null}
        </div>

        {lead.stage === 'LOST' && lead.lostReason ? (
          <p className="mt-2 rounded bg-destructive/10 px-1.5 py-1 text-[11px] text-destructive">
            {lostReasonLabel(lead.lostReason)}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** DragOverlay এ দেখানোর জন্য — কোনো dnd hook ছাড়া স্থির কপি */
export function LeadCardPreview({ lead }: { lead: PipelineLead }) {
  return (
    <div className="w-[248px] rotate-2 cursor-grabbing shadow-lg">
      <CardBody
        lead={lead}
        canEdit={false}
        pending={false}
        dragHandle={
          <div className="flex w-7 shrink-0 items-center justify-center border-r bg-muted/60">
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
        }
      />
    </div>
  );
}

export function LeadCard({
  lead,
  canEdit,
  pending,
  onEdit,
  onChangeStage,
}: {
  lead: PipelineLead;
  canEdit: boolean;
  pending: boolean;
  onEdit: (lead: PipelineLead) => void;
  onChangeStage: (lead: PipelineLead, stage: LeadStage) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
    disabled: !canEdit || pending,
  });

  return (
    <div
      ref={setNodeRef}
      style={transform ? { transform: CSS.Translate.toString(transform) } : undefined}
      className={cn('touch-manipulation', isDragging && 'opacity-40')}
    >
      <CardBody
        lead={lead}
        canEdit={canEdit}
        pending={pending}
        onEdit={onEdit}
        onChangeStage={onChangeStage}
        dragHandle={
          canEdit ? (
            // পুরো কার্ড নয়, বাঁ পাশের স্ট্রিপটাই drag handle — এতে ভেতরের লিংক ও
            // মেনু স্বাভাবিকভাবে কাজ করে, আর মোবাইলে বোর্ড স্ক্রল করাও যায়
            <button
              type="button"
              className="flex w-7 shrink-0 cursor-grab touch-none items-center justify-center border-r bg-muted/40 text-muted-foreground hover:bg-muted active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              aria-label={`${lead.name} — স্টেজ বদলাতে টেনে নিন`}
              {...attributes}
              {...listeners}
            >
              <GripVertical className="h-4 w-4" />
            </button>
          ) : (
            <div className="w-1.5 shrink-0 bg-muted" />
          )
        }
      />
    </div>
  );
}
