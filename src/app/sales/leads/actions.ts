'use server';

import { revalidatePath } from 'next/cache';
import { LeadActivityType, LeadFileType, LeadSource, LeadStage, Role } from '@prisma/client';
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
import { FILE_TYPE_LABEL, lostReasonLabel, STAGE_LABEL } from '@/lib/leads';
import { saveUploadedFile } from '@/lib/upload';
import { countryLabel } from '@/lib/countries';
import {
  addNoteSchema,
  changeStageSchema,
  createLeadSchema,
  updateLeadSchema,
  uploadDocumentSchema,
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
    // ফোন দুই ভাগে আসে — country picker এর ISO কোড ও লোকাল নম্বর
    phoneCountry: field(formData, 'phoneCountry'),
    phoneNumber: field(formData, 'phoneNumber'),
    residenceCountry: field(formData, 'residenceCountry'),
    email: field(formData, 'email'),
    source: field(formData, 'source'),
    unitId: field(formData, 'unitId'),
    projectLocation: field(formData, 'projectLocation'),
    budgetMin: field(formData, 'budgetMin'),
    budgetMax: field(formData, 'budgetMax'),
    assignedToId: field(formData, 'assignedToId'),
    nextFollowUpAt: field(formData, 'nextFollowUpAt'),
    localContactName: field(formData, 'localContactName'),
    localContactPhone: field(formData, 'localContactPhone'),
    localContactRelation: field(formData, 'localContactRelation'),
  };
}

/** Lead টেবিলে যাওয়া কলামগুলো — create ও update দুই জায়গায় একই ম্যাপিং */
function leadWriteData(
  input: {
    name: string;
    phone: string;
    email?: string;
    source: string;
    unitId?: string;
    residenceCountry?: string;
    projectLocation?: string;
    budgetMin?: number;
    budgetMax?: number;
    nextFollowUpAt?: string;
    localContactName?: string;
    localContactPhone?: string;
    localContactRelation?: string;
  },
  assignedToId: string | null,
) {
  return {
    name: input.name,
    phone: input.phone,
    email: input.email || null,
    source: input.source as LeadSource,
    unitId: input.unitId ?? null,
    residenceCountry: input.residenceCountry ?? null,
    projectLocation: input.projectLocation ?? null,
    budgetMin: input.budgetMin ?? null,
    budgetMax: input.budgetMax ?? null,
    assignedToId,
    nextFollowUpAt: parseFollowUpDate(input.nextFollowUpAt),
    localContactName: input.localContactName ?? null,
    localContactPhone: input.localContactPhone ?? null,
    localContactRelation: input.localContactRelation ?? null,
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
        data: leadWriteData(input, assignedToId),
        select: { id: true, name: true },
      });

      const residence = countryLabel(input.residenceCountry);
      await tx.leadActivity.create({
        data: {
          leadId: created.id,
          type: LeadActivityType.CREATED,
          note: residence
            ? `লিড তৈরি করা হয়েছে (স্টেজ: ${STAGE_LABEL.NEW}) · অবস্থান: ${residence}`
            : `লিড তৈরি করা হয়েছে (স্টেজ: ${STAGE_LABEL.NEW})`,
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
      metadata: {
        name: lead.name,
        source: input.source,
        assignedToId,
        ...(input.residenceCountry ? { residenceCountry: input.residenceCountry } : {}),
      },
    });

    // অন্য কাউকে assign করা হলে তাকে জানানো
    if (assignedToId && assignedToId !== actor.id) {
      await notify({
        userId: assignedToId,
        type: 'LEAD_ASSIGNED',
        message: `নতুন লিড আপনাকে দেওয়া হয়েছে — ${lead.name}`,
        link: `/sales/leads/${lead.id}`,
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
    select: {
      id: true,
      name: true,
      assignedToId: true,
      nextFollowUpAt: true,
      residenceCountry: true,
    },
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
        data: { ...leadWriteData(input, assignedToId), nextFollowUpAt },
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
        link: `/sales/leads/${input.id}`,
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
    select: {
      id: true,
      name: true,
      stage: true,
      assignedToId: true,
      sale: { select: { id: true } },
    },
  });
  if (!existing) return NOT_FOUND;

  if (existing.stage === stage && stage !== LeadStage.LOST) {
    return { ok: true, message: 'স্টেজ অপরিবর্তিত' };
  }

  // PRD সেকশন ৫.১ — Won এ যাওয়া মানে ইউনিট সহ সেল তৈরি হওয়া। UI ডায়ালগ খুলে
  // `convertLeadToSale` ডাকে; সরাসরি এখানে এলে স্টেজ বদলে সেল বাদ পড়ে যেত।
  if (stage === LeadStage.WON && !existing.sale) {
    return {
      ok: false,
      message: 'Won এ নিতে হলে ইউনিট নির্বাচন করে সেল কনফার্ম করুন',
      fieldErrors: { stage: 'সেল কনফার্ম করা প্রয়োজন' },
    };
  }

  // সেল তৈরি হয়ে গেলে লিড আর পাইপলাইনে ফেরত যাবে না — ইউনিট SOLD, কাস্টমার তৈরি।
  // ফেরাতে হলে আগে সেলটি বাতিল করতে হবে (Phase 4 — Accounts/Admin)।
  if (existing.stage === LeadStage.WON && existing.sale && stage !== LeadStage.WON) {
    return {
      ok: false,
      message: 'সেল তৈরি হয়ে গেছে — স্টেজ ফেরাতে হলে আগে সেলটি বাতিল করতে হবে',
    };
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

// ---------------------------------------------------------------- documents

/** একবারে সর্বোচ্চ কতগুলো ফাইল — accidental bulk আপলোড ঠেকাতে */
const MAX_FILES_PER_UPLOAD = 10;

/**
 * PRD সেকশন ৫.১ — Lead Documents (Floor Plan / 3D Design / Proposal / জমির দলিল)।
 * একসাথে একাধিক ফাইল নেওয়া যায়; প্রতিটির টাইপ ও বিবরণ একই সাবমিশনে প্রযোজ্য।
 */
export async function uploadLeadDocuments(
  formData: FormData,
): Promise<ActionResult<{ uploaded: number }>> {
  const actor = await getAuthorizedUser('document:upload');
  if (!actor) return FORBIDDEN;

  const parsed = uploadDocumentSchema.safeParse({
    leadId: field(formData, 'leadId'),
    fileType: field(formData, 'fileType'),
    description: field(formData, 'description'),
  });
  if (!parsed.success) {
    return { ok: false, message: 'ইনপুট সঠিক নয়', fieldErrors: zodErrors(parsed.error) };
  }
  const { leadId, description } = parsed.data;
  const fileType = parsed.data.fileType as LeadFileType;

  // scope সহ — অন্যের লিডে ফাইল যোগ করা যাবে না
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, ...leadScope(actor) },
    select: { id: true },
  });
  if (!lead) return NOT_FOUND;

  const files = formData.getAll('files').filter((f): f is File => f instanceof File && f.size > 0);
  // multipart filename হেডার latin-1 এ ডিকোড হয় (বাংলা নাম নষ্ট হয়ে যায়),
  // তাই client একই ক্রমে আসল নামগুলো টেক্সট ফিল্ড হিসেবেও পাঠায়
  const clientNames = formData.getAll('fileNames').map((n) => String(n));

  if (files.length === 0) return { ok: false, message: 'অন্তত একটি ফাইল নির্বাচন করুন' };
  if (files.length > MAX_FILES_PER_UPLOAD) {
    return { ok: false, message: `একবারে সর্বোচ্চ ${MAX_FILES_PER_UPLOAD} টি ফাইল দেওয়া যাবে` };
  }

  const saved: { fileUrl: string; fileName: string }[] = [];
  const failed: string[] = [];

  for (const [index, file] of files.entries()) {
    const originalName = clientNames[index] || file.name;
    const result = await saveUploadedFile(file, ['leads', leadId], originalName);
    if (result.ok) saved.push({ fileUrl: result.file.url, fileName: result.file.fileName });
    else failed.push(`${originalName} — ${result.reason}`);
  }

  // একটিও সেভ না হলে DB তে কিছু লেখার দরকার নেই
  if (saved.length === 0) {
    return { ok: false, message: failed[0] ?? 'কোনো ফাইল আপলোড করা যায়নি' };
  }

  await prisma.$transaction(async (tx) => {
    await tx.leadDocument.createMany({
      data: saved.map((f) => ({
        leadId,
        fileUrl: f.fileUrl,
        fileName: f.fileName,
        fileType,
        description: description ?? null,
        uploadedById: actor.id,
      })),
    });

    await tx.leadActivity.create({
      data: {
        leadId,
        type: LeadActivityType.NOTE,
        note: `${saved.length} টি ফাইল যোগ করা হয়েছে — ${FILE_TYPE_LABEL[fileType]} (${saved
          .map((f) => f.fileName)
          .join(', ')})`,
        createdById: actor.id,
      },
    });
  });

  await logActivity({
    entityType: 'Lead',
    entityId: leadId,
    userId: actor.id,
    action: 'DOCUMENT_UPLOADED',
    metadata: { fileType, count: saved.length, fileNames: saved.map((f) => f.fileName) },
  });

  revalidateLead(leadId);

  // আংশিক সফল হলে কোনটি বাদ পড়ল সেটাও জানানো দরকার
  return {
    ok: true,
    message:
      failed.length === 0
        ? `${saved.length} টি ফাইল আপলোড হয়েছে`
        : `${saved.length} টি আপলোড হয়েছে · ${failed.length} টি বাদ পড়েছে (${failed[0]})`,
    data: { uploaded: saved.length },
  };
}
