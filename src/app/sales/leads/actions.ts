'use server';

import { revalidatePath } from 'next/cache';
import { LeadActivityType, LeadSource, LeadStage, Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getAuthorizedUser, type AuthorizedUser } from '@/lib/guards';
import { logActivity } from '@/lib/activity-log';
import { notify } from '@/lib/notifications';
import { leadScope } from '@/lib/lead-access';
import {
  type ActionError,
  type ActionResult,
  FORBIDDEN,
  NOT_FOUND,
  zodErrors,
} from '@/lib/action-result';
import { lostReasonLabel, STAGE_LABEL } from '@/lib/leads';
import {
  addNoteSchema,
  changeStageSchema,
  createLeadSchema,
  updateLeadSchema,
} from '@/lib/validations/lead';

export type { ActionResult } from '@/lib/action-result';

/** লিড বদলালে যেসব পেজে পুরনো ডেটা ক্যাশ থাকতে পারে */
function revalidateLead(leadId?: string) {
  revalidatePath('/sales/pipeline');
  revalidatePath('/sales');
  if (leadId) revalidatePath(`/sales/leads/${leadId}`);
}

/**
 * `yyyy-MM-dd` → ওই দিনের দুপুর ১২টা (local)।
 * শুধু তারিখ ধরে রাখা দরকার, তাই মাঝদিন ব্যবহার — TZ শিফটে দিন পাল্টাবে না।
 */
function parseFollowUpDate(value: string | undefined): Date | null {
  if (!value) return null;
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

function sameDay(a: Date | null, b: Date | null) {
  if (a === null || b === null) return a === b;
  return a.toDateString() === b.toDateString();
}

/**
 * কাকে assign করা যাবে তা যাচাই — MARKETING নিজের বাইরে assign করতে পারবে না
 * (করতে পারলে নিজের ভিউ থেকে লিড হারিয়ে ফেলত), ADMIN যে কোনো সক্রিয়
 * MARKETING/ADMIN কে দিতে পারবে।
 */
async function resolveAssignee(
  actor: AuthorizedUser,
  requestedId: string | undefined,
): Promise<{ assignedToId: string | null; error?: never } | { error: ActionError }> {
  if (actor.role !== Role.ADMIN) return { assignedToId: actor.id };
  if (!requestedId) return { assignedToId: null };

  const target = await prisma.user.findFirst({
    where: { id: requestedId, active: true, role: { in: [Role.MARKETING, Role.ADMIN] } },
    select: { id: true },
  });
  if (!target) {
    return {
      error: {
        ok: false,
        message: 'ইনপুট সঠিক নয়',
        fieldErrors: { assignedToId: 'সক্রিয় মার্কেটিং এক্সিকিউটিভ নির্বাচন করুন' },
      },
    };
  }
  return { assignedToId: target.id };
}

/** unitId দেওয়া থাকলে সেটি সত্যিই আছে কিনা */
async function validateUnit(unitId: string | undefined): Promise<ActionError | null> {
  if (!unitId) return null;
  const unit = await prisma.unit.findUnique({ where: { id: unitId }, select: { id: true } });
  if (unit) return null;
  return {
    ok: false,
    message: 'ইনপুট সঠিক নয়',
    fieldErrors: { unitId: 'ইউনিটটি খুঁজে পাওয়া যায়নি' },
  };
}

/**
 * FormData.get() অনুপস্থিত ফিল্ডে `null` দেয় — যেমন disabled `<select>` (ইউনিট নেই)
 * বা যে ফিল্ড ওই role এ রেন্ডারই হয়নি (assignedToId)। zod এর optional স্কিমা
 * `undefined` বোঝে, `null` নয় — তাই এখানেই নরমালাইজ করা হয়।
 */
function field(formData: FormData, key: string) {
  const value = formData.get(key);
  return value === null ? undefined : value;
}

function leadFormValues(formData: FormData) {
  return {
    name: field(formData, 'name'),
    phone: field(formData, 'phone'),
    email: field(formData, 'email'),
    source: field(formData, 'source'),
    unitId: field(formData, 'unitId'),
    budgetMin: field(formData, 'budgetMin'),
    budgetMax: field(formData, 'budgetMax'),
    assignedToId: field(formData, 'assignedToId'),
    nextFollowUpAt: field(formData, 'nextFollowUpAt'),
  };
}

// ---------------------------------------------------------------- create

export async function createLead(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const actor = await getAuthorizedUser('lead:create');
  if (!actor) return FORBIDDEN;

  const parsed = createLeadSchema.safeParse(leadFormValues(formData));
  if (!parsed.success) {
    return { ok: false, message: 'ইনপুট সঠিক নয়', fieldErrors: zodErrors(parsed.error) };
  }
  const input = parsed.data;

  const unitError = await validateUnit(input.unitId);
  if (unitError) return unitError;

  const assignee = await resolveAssignee(actor, input.assignedToId);
  if (assignee.error) return assignee.error;
  const { assignedToId } = assignee;

  try {
    const lead: { id: string; name: string } = await prisma.$transaction(async (tx) => {
      const created = await tx.lead.create({
        data: {
          name: input.name,
          phone: input.phone,
          email: input.email || null,
          source: input.source as LeadSource,
          unitId: input.unitId ?? null,
          budgetMin: input.budgetMin ?? null,
          budgetMax: input.budgetMax ?? null,
          assignedToId,
          nextFollowUpAt: parseFollowUpDate(input.nextFollowUpAt),
        },
        select: { id: true, name: true },
      });

      await tx.leadActivity.create({
        data: {
          leadId: created.id,
          type: LeadActivityType.CREATED,
          note: `লিড তৈরি করা হয়েছে (স্টেজ: ${STAGE_LABEL.NEW})`,
          createdById: actor.id,
        },
      });

      return created;
    });

    await logActivity({
      entityType: 'Lead',
      entityId: lead.id,
      userId: actor.id,
      action: 'LEAD_CREATED',
      metadata: { name: lead.name, source: input.source, assignedToId },
    });

    // অন্য কাউকে assign করা হলে তাকে জানানো
    if (assignedToId && assignedToId !== actor.id) {
      await notify({
        userId: assignedToId,
        type: 'LEAD_ASSIGNED',
        message: `নতুন লিড আপনাকে দেওয়া হয়েছে — ${lead.name}`,
      });
    }

    revalidateLead(lead.id);
    return { ok: true, message: `${lead.name} যোগ করা হয়েছে`, data: { id: lead.id } };
  } catch (error) {
    console.error('createLead failed', error);
    return { ok: false, message: 'লিড তৈরি করা যায়নি' };
  }
}

// ---------------------------------------------------------------- update

export async function updateLead(formData: FormData): Promise<ActionResult> {
  const actor = await getAuthorizedUser('lead:edit');
  if (!actor) return FORBIDDEN;

  const parsed = updateLeadSchema.safeParse({
    id: field(formData, 'id'),
    ...leadFormValues(formData),
  });
  if (!parsed.success) {
    return { ok: false, message: 'ইনপুট সঠিক নয়', fieldErrors: zodErrors(parsed.error) };
  }
  const input = parsed.data;

  // scope সহ — অন্যের লিড id দিয়েও এডিট করা যাবে না
  const existing = await prisma.lead.findFirst({
    where: { id: input.id, ...leadScope(actor) },
    select: { id: true, name: true, assignedToId: true, nextFollowUpAt: true },
  });
  if (!existing) return NOT_FOUND;

  const unitError = await validateUnit(input.unitId);
  if (unitError) return unitError;

  const assignee = await resolveAssignee(actor, input.assignedToId);
  if (assignee.error) return assignee.error;
  const { assignedToId } = assignee;

  const nextFollowUpAt = parseFollowUpDate(input.nextFollowUpAt);
  const assigneeChanged = existing.assignedToId !== assignedToId;
  const followUpChanged = !sameDay(existing.nextFollowUpAt, nextFollowUpAt);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.lead.update({
        where: { id: input.id },
        data: {
          name: input.name,
          phone: input.phone,
          email: input.email || null,
          source: input.source as LeadSource,
          unitId: input.unitId ?? null,
          budgetMin: input.budgetMin ?? null,
          budgetMax: input.budgetMax ?? null,
          assignedToId,
          nextFollowUpAt,
        },
      });

      const timeline: { type: LeadActivityType; note: string }[] = [];

      if (assigneeChanged) {
        const to = assignedToId
          ? await tx.user.findUnique({ where: { id: assignedToId }, select: { name: true } })
          : null;
        timeline.push({
          type: LeadActivityType.ASSIGNED,
          note: to ? `অ্যাসাইন করা হয়েছে — ${to.name}` : 'অ্যাসাইনমেন্ট সরানো হয়েছে',
        });
      }

      if (followUpChanged) {
        timeline.push({
          type: LeadActivityType.FOLLOW_UP_SET,
          note: nextFollowUpAt
            ? `পরবর্তী ফলো-আপ: ${input.nextFollowUpAt}`
            : 'ফলো-আপ তারিখ সরানো হয়েছে',
        });
      }

      if (timeline.length > 0) {
        await tx.leadActivity.createMany({
          data: timeline.map((t) => ({ ...t, leadId: input.id, createdById: actor.id })),
        });
      }
    });

    await logActivity({
      entityType: 'Lead',
      entityId: input.id,
      userId: actor.id,
      action: 'LEAD_UPDATED',
      metadata: {
        name: input.name,
        ...(assigneeChanged ? { assignedFrom: existing.assignedToId, assignedTo: assignedToId } : {}),
      },
    });

    if (assigneeChanged && assignedToId && assignedToId !== actor.id) {
      await notify({
        userId: assignedToId,
        type: 'LEAD_ASSIGNED',
        message: `একটি লিড আপনাকে দেওয়া হয়েছে — ${input.name}`,
      });
    }

    revalidateLead(input.id);
    return { ok: true, message: `${input.name} আপডেট হয়েছে` };
  } catch (error) {
    console.error('updateLead failed', error);
    return { ok: false, message: 'আপডেট করা যায়নি' };
  }
}

// ---------------------------------------------------------------- stage change

export async function changeLeadStage(input: {
  id: string;
  stage: string;
  lostReason?: string;
}): Promise<ActionResult> {
  const actor = await getAuthorizedUser('lead:changeStage');
  if (!actor) return FORBIDDEN;

  const parsed = changeStageSchema.safeParse(input);
  if (!parsed.success) {
    // Lost reason না দিলে সেই মেসেজটাই toast এ দেখানো দরকার
    const fieldErrors = zodErrors(parsed.error);
    return {
      ok: false,
      message: fieldErrors.lostReason ?? fieldErrors.stage ?? 'ইনপুট সঠিক নয়',
      fieldErrors,
    };
  }
  const { id, lostReason } = parsed.data;
  const stage = parsed.data.stage as LeadStage;

  const existing = await prisma.lead.findFirst({
    where: { id, ...leadScope(actor) },
    select: { id: true, name: true, stage: true, assignedToId: true },
  });
  if (!existing) return NOT_FOUND;

  if (existing.stage === stage && stage !== LeadStage.LOST) {
    return { ok: true, message: 'স্টেজ অপরিবর্তিত' };
  }

  // LOST থেকে বেরোলে পুরনো কারণ আর প্রযোজ্য নয়
  const nextLostReason = stage === LeadStage.LOST ? (lostReason as string) : null;

  const note =
    stage === LeadStage.LOST
      ? `স্টেজ: ${STAGE_LABEL[existing.stage]} → ${STAGE_LABEL.LOST} · কারণ: ${lostReasonLabel(nextLostReason)}`
      : `স্টেজ: ${STAGE_LABEL[existing.stage]} → ${STAGE_LABEL[stage]}`;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.lead.update({
        where: { id },
        data: { stage, lostReason: nextLostReason },
      });

      await tx.leadActivity.create({
        data: {
          leadId: id,
          type: LeadActivityType.STAGE_CHANGED,
          note,
          createdById: actor.id,
        },
      });

      // PRD সেকশন ৫.১ — "Won" এ Project/Customer/Payment plan অটো-তৈরি Phase 3 এ
      if (stage === LeadStage.WON) {
        await tx.leadActivity.create({
          data: {
            leadId: id,
            type: LeadActivityType.NOTE,
            note: 'Won — প্রজেক্ট/পেমেন্ট প্ল্যান তৈরি বাকি (Phase 3 এ অটোমেটিক হবে)',
            createdById: actor.id,
          },
        });
      }
    });

    await logActivity({
      entityType: 'Lead',
      entityId: id,
      userId: actor.id,
      action: 'STAGE_CHANGED',
      metadata: { from: existing.stage, to: stage, ...(nextLostReason ? { lostReason: nextLostReason } : {}) },
    });

    revalidateLead(id);
    return {
      ok: true,
      message: `${existing.name} → ${STAGE_LABEL[stage]}`,
    };
  } catch (error) {
    console.error('changeLeadStage failed', error);
    return { ok: false, message: 'স্টেজ পরিবর্তন করা যায়নি' };
  }
}

// ---------------------------------------------------------------- note

export async function addLeadNote(input: { id: string; note: string }): Promise<ActionResult> {
  const actor = await getAuthorizedUser('lead:edit');
  if (!actor) return FORBIDDEN;

  const parsed = addNoteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: 'ইনপুট সঠিক নয়', fieldErrors: zodErrors(parsed.error) };
  }
  const { id, note } = parsed.data;

  const lead = await prisma.lead.findFirst({
    where: { id, ...leadScope(actor) },
    select: { id: true },
  });
  if (!lead) return NOT_FOUND;

  await prisma.leadActivity.create({
    data: { leadId: id, type: LeadActivityType.NOTE, note, createdById: actor.id },
  });

  await logActivity({
    entityType: 'Lead',
    entityId: id,
    userId: actor.id,
    action: 'NOTE_ADDED',
  });

  revalidateLead(id);
  return { ok: true, message: 'নোট যোগ হয়েছে' };
}
