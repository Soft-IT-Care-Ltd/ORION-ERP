import { format } from 'date-fns';
import type { Prisma } from '@prisma/client';
import { budgetLabel, followUpTone, SOURCE_LABEL } from '@/lib/leads';
import { formatBDT } from '@/lib/utils';
import type { PipelineLead } from '../pipeline/types';
import type { EditableLead } from './lead-form-dialog';

/**
 * বোর্ড ও ডিটেইল পেজ — দুই জায়গায় একই select ব্যবহার হয়, যাতে কার্ডের
 * সব ফিল্ড সবসময় থাকে (`toPipelineLead` টাইপ-সেফভাবে কাজ করে)।
 */
export const leadCardSelect = {
  id: true,
  name: true,
  phone: true,
  email: true,
  source: true,
  stage: true,
  lostReason: true,
  unitId: true,
  budgetMin: true,
  budgetMax: true,
  assignedToId: true,
  nextFollowUpAt: true,
  assignedTo: { select: { id: true, name: true } },
} satisfies Prisma.LeadSelect;

export type LeadCardRow = Prisma.LeadGetPayload<{ select: typeof leadCardSelect }>;

/** Prisma Decimal client component এ পাঠানো যায় না — number/string এ নামিয়ে আনা হয় */
const toNumber = (value: Prisma.Decimal | null) => (value === null ? null : Number(value));

export function toEditableLead(lead: LeadCardRow): EditableLead {
  return {
    id: lead.id,
    name: lead.name,
    phone: lead.phone,
    email: lead.email,
    source: lead.source,
    unitId: lead.unitId,
    budgetMin: lead.budgetMin === null ? null : String(toNumber(lead.budgetMin)),
    budgetMax: lead.budgetMax === null ? null : String(toNumber(lead.budgetMax)),
    assignedToId: lead.assignedToId,
    nextFollowUpAt: lead.nextFollowUpAt ? format(lead.nextFollowUpAt, 'yyyy-MM-dd') : null,
  };
}

/** `today` = আজকের local midnight (request প্রতি একবার হিসাব করে পাঠান) */
export function toPipelineLead(lead: LeadCardRow, today: Date): PipelineLead {
  return {
    id: lead.id,
    name: lead.name,
    phone: lead.phone,
    stage: lead.stage,
    sourceLabel: SOURCE_LABEL[lead.source],
    assignedToName: lead.assignedTo?.name ?? null,
    followUpLabel: lead.nextFollowUpAt ? format(lead.nextFollowUpAt, 'dd MMM') : null,
    followUpTone: lead.nextFollowUpAt ? followUpTone(lead.nextFollowUpAt, today) : null,
    budgetLabel: budgetLabel(toNumber(lead.budgetMin), toNumber(lead.budgetMax), formatBDT),
    lostReason: lead.lostReason,
    editable: toEditableLead(lead),
  };
}

/** আজকের দিন-শুরু — ফলো-আপ overdue/today হিসাব করার রেফারেন্স */
export function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}
