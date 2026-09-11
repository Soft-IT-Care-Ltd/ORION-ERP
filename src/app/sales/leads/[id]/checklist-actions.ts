'use server';

import { revalidatePath } from 'next/cache';
import { ChecklistStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getAuthorizedUser, type AuthorizedUser } from '@/lib/guards';
import { logActivity } from '@/lib/activity-log';
import { leadScope } from '@/lib/lead-access';
import { type ActionResult, FORBIDDEN, NOT_FOUND, zodErrors } from '@/lib/action-result';
import {
  addChecklistItemSchema,
  checklistItemIdSchema,
  toggleChecklistItemSchema,
} from '@/lib/validations/checklist';

export type { ActionResult } from '@/lib/action-result';

/**
 * Lead checklist এর CRUD — PRD সেকশন ৫.১।
 *
 * প্রতিটি অ্যাকশন `leadScope` দিয়ে শুরু হয়: আইটেমের id গেস করেও অন্যের লিডের
 * চেকলিস্ট বদলানো যাবে না (server action আসলে একটি পাবলিক endpoint)।
 */

function revalidateLead(leadId: string) {
  revalidatePath(`/sales/leads/${leadId}`);
}

/** আইটেমটি এমন লিডের, যেটি এই ইউজার দেখতে পারেন? না হলে null */
async function findScopedItem(actor: AuthorizedUser, itemId: string) {
  return prisma.leadChecklistItem.findFirst({
    where: { id: itemId, lead: leadScope(actor) },
    select: { id: true, label: true, status: true, leadId: true },
  });
}

export async function addChecklistItem(input: {
  leadId: string;
  label: string;
  note?: string;
}): Promise<ActionResult<{ id: string }>> {
  const actor = await getAuthorizedUser('checklist:manage');
  if (!actor) return FORBIDDEN;

  const parsed = addChecklistItemSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors = zodErrors(parsed.error);
    return { ok: false, message: fieldErrors.label ?? 'ইনপুট সঠিক নয়', fieldErrors };
  }
  const { leadId, label, note } = parsed.data;

  const lead = await prisma.lead.findFirst({
    where: { id: leadId, ...leadScope(actor) },
    select: { id: true },
  });
  if (!lead) return NOT_FOUND;

  try {
    const item = await prisma.leadChecklistItem.create({
      data: { leadId, label, note: note ?? null },
      select: { id: true },
    });

    await logActivity({
      entityType: 'Lead',
      entityId: leadId,
      userId: actor.id,
      action: 'CHECKLIST_ITEM_ADDED',
      metadata: { itemId: item.id, label },
    });

    revalidateLead(leadId);
    return { ok: true, message: `"${label}" যোগ হয়েছে`, data: { id: item.id } };
  } catch (error) {
    console.error('addChecklistItem failed', error);
    return { ok: false, message: 'আইটেম যোগ করা যায়নি' };
  }
}

/**
 * টিক দেওয়া/তোলা। DONE হলে `doneBy`/`doneAt` অটো বসে (PRD সেকশন ৫.১), আর আবার
 * PENDING করলে দুটোই মুছে যায় — নইলে "কে কবে শেষ করেছে" তথ্যটা মিথ্যা হয়ে থাকত।
 */
export async function toggleChecklistItem(input: {
  id: string;
  done: boolean;
}): Promise<ActionResult> {
  const actor = await getAuthorizedUser('checklist:manage');
  if (!actor) return FORBIDDEN;

  const parsed = toggleChecklistItemSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: 'ইনপুট সঠিক নয়', fieldErrors: zodErrors(parsed.error) };
  }
  const { id, done } = parsed.data;

  const item = await findScopedItem(actor, id);
  if (!item) return NOT_FOUND;

  try {
    await prisma.leadChecklistItem.update({
      where: { id },
      data: done
        ? { status: ChecklistStatus.DONE, doneById: actor.id, doneAt: new Date() }
        : { status: ChecklistStatus.PENDING, doneById: null, doneAt: null },
    });

    await logActivity({
      entityType: 'Lead',
      entityId: item.leadId,
      userId: actor.id,
      action: done ? 'CHECKLIST_ITEM_DONE' : 'CHECKLIST_ITEM_REOPENED',
      metadata: { itemId: id, label: item.label },
    });

    revalidateLead(item.leadId);
    return {
      ok: true,
      message: done ? `"${item.label}" সম্পন্ন` : `"${item.label}" আবার বাকি হিসেবে চিহ্নিত`,
    };
  } catch (error) {
    console.error('toggleChecklistItem failed', error);
    return { ok: false, message: 'আপডেট করা যায়নি' };
  }
}

export async function deleteChecklistItem(input: { id: string }): Promise<ActionResult> {
  const actor = await getAuthorizedUser('checklist:manage');
  if (!actor) return FORBIDDEN;

  const parsed = checklistItemIdSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: 'ইনপুট সঠিক নয়', fieldErrors: zodErrors(parsed.error) };
  }

  const item = await findScopedItem(actor, parsed.data.id);
  if (!item) return NOT_FOUND;

  try {
    await prisma.leadChecklistItem.delete({ where: { id: item.id } });

    await logActivity({
      entityType: 'Lead',
      entityId: item.leadId,
      userId: actor.id,
      action: 'CHECKLIST_ITEM_DELETED',
      metadata: { itemId: item.id, label: item.label },
    });

    revalidateLead(item.leadId);
    return { ok: true, message: `"${item.label}" মুছে ফেলা হয়েছে` };
  } catch (error) {
    console.error('deleteChecklistItem failed', error);
    return { ok: false, message: 'মোছা যায়নি' };
  }
}
