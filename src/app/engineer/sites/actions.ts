'use server';

import { revalidatePath } from 'next/cache';
import { PhaseStatus, Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getAuthorizedUser } from '@/lib/guards';
import { logActivity } from '@/lib/activity-log';
import { notifyDonePhases, notifyMany } from '@/lib/notifications';
import { unitScope } from '@/lib/project-access';
import { type ActionResult, FORBIDDEN, NOT_FOUND, zodErrors } from '@/lib/action-result';
import { computePhaseStatus } from '@/lib/phases';
import { saveUploadedFile } from '@/lib/upload';
import { isImageFileName } from '@/lib/upload-limits';
import { phaseUpdateSchema } from '@/lib/validations/project';

export type { ActionResult } from '@/lib/action-result';

/** একবারে সর্বোচ্চ কতগুলো সাইট ফটো — লিড ডকুমেন্ট আপলোডের মতোই সীমা */
const MAX_PHOTOS_PER_UPDATE = 10;

/** FormData এর মান স্ট্রিং হিসেবে (না থাকলে undefined) */
function field(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === 'string' ? value : undefined;
}

/**
 * PRD সেকশন ৫.২ — সাইট ইঞ্জিনিয়ারের ফেজ আপডেট।
 *
 * এক সাবমিটে: PhaseUpdate রেকর্ড (% + মন্তব্য + ছবি) তৈরি হয় এবং Phase এর
 * percentComplete / status / actual date গুলো সেই অনুযায়ী বসে।
 * ছবি আপাতত `public/uploads/phases/<phaseId>/` এ যায় — `lib/upload.ts` এর ভেতরটা
 * বদলালেই পরে S3/R2 তে সরানো যাবে।
 */
export async function submitPhaseUpdate(
  formData: FormData,
): Promise<ActionResult<{ percentComplete: number; photos: number }>> {
  const actor = await getAuthorizedUser('phase:update');
  if (!actor) return FORBIDDEN;

  const parsed = phaseUpdateSchema.safeParse({
    phaseId: field(formData, 'phaseId'),
    percentComplete: field(formData, 'percentComplete'),
    note: field(formData, 'note'),
    delayReason: field(formData, 'delayReason'),
  });
  if (!parsed.success) {
    const fieldErrors = zodErrors(parsed.error);
    return {
      ok: false,
      message: fieldErrors.percentComplete ?? 'ইনপুট সঠিক নয়',
      fieldErrors,
    };
  }

  const { phaseId, percentComplete, note, delayReason } = parsed.data;

  // scope সহ — অন্য সাইটের ফেজ id গেস করেও আপডেট করা যাবে না (PRD সেকশন ৪)
  const phase = await prisma.phase.findFirst({
    where: { id: phaseId, unit: unitScope(actor) },
    select: {
      id: true,
      name: true,
      percentComplete: true,
      plannedEnd: true,
      actualStart: true,
      unit: {
        select: {
          id: true,
          unitNo: true,
          project: { select: { id: true, name: true } },
          sale: { select: { customer: { select: { userId: true } } } },
        },
      },
    },
  });
  if (!phase) return NOT_FOUND;

  /* ------------------------------------------------------------- photos */

  const files = formData.getAll('photos').filter((f): f is File => f instanceof File && f.size > 0);
  // multipart এর filename হেডার latin-1 এ ডিকোড হয় — client আসল নামগুলো একই ক্রমে
  // আলাদা টেক্সট ফিল্ডেও পাঠায় (`lib/upload.ts` এর নোট দ্রষ্টব্য)
  const clientNames = formData.getAll('photoNames').map((n) => String(n));

  if (files.length > MAX_PHOTOS_PER_UPDATE) {
    return { ok: false, message: `একবারে সর্বোচ্চ ${MAX_PHOTOS_PER_UPDATE} টি ছবি দেওয়া যাবে` };
  }

  const photoUrls: string[] = [];
  const failed: string[] = [];

  for (const [index, file] of files.entries()) {
    const originalName = clientNames[index] || file.name;
    if (!isImageFileName(originalName)) {
      failed.push(`${originalName} — শুধু ছবি দেওয়া যাবে`);
      continue;
    }
    const result = await saveUploadedFile(file, ['phases', phase.id], originalName);
    if (result.ok) photoUrls.push(result.file.url);
    else failed.push(`${originalName} — ${result.reason}`);
  }

  // ছবি দিতে চেয়েছিলেন কিন্তু একটিও গেল না — নীরবে আপডেট লিখে ফেলা বিভ্রান্তিকর হতো
  if (files.length > 0 && photoUrls.length === 0) {
    return { ok: false, message: failed[0] ?? 'ছবি আপলোড করা যায়নি' };
  }

  /* -------------------------------------------------------------- write */

  const now = new Date();
  const status = computePhaseStatus({ percentComplete, plannedEnd: phase.plannedEnd }, now);
  const wasComplete = phase.percentComplete >= 100;
  const isComplete = percentComplete >= 100;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.phaseUpdate.create({
        data: {
          phaseId: phase.id,
          updatedById: actor.id,
          percentComplete,
          note: note ?? null,
          photoUrls,
        },
      });

      await tx.phase.update({
        where: { id: phase.id },
        data: {
          percentComplete,
          status,
          // কাজ শুরু হলো — প্রথমবার ০ এর বেশি % পেলে প্রকৃত শুরুর তারিখ বসে
          actualStart:
            phase.actualStart ?? (percentComplete > 0 ? now : null),
          // ১০০% এ প্রকৃত শেষের তারিখ; পরে % কমালে (ভুল সংশোধন) সেটি সরে যায়
          actualEnd: isComplete ? now : null,
          delayReason: status === PhaseStatus.DELAYED ? (delayReason ?? null) : null,
        },
      });
    });
  } catch (error) {
    console.error('submitPhaseUpdate failed', error);
    return { ok: false, message: 'আপডেট সেভ করা যায়নি' };
  }

  // CLAUDE.md নিয়ম ৪ — phase update একটি critical action
  await logActivity({
    entityType: 'Phase',
    entityId: phase.id,
    userId: actor.id,
    action: 'PHASE_UPDATED',
    metadata: {
      unitId: phase.unit.id,
      projectId: phase.unit.project.id,
      phaseName: phase.name,
      from: phase.percentComplete,
      to: percentComplete,
      status,
      photos: photoUrls.length,
    },
  });

  // ফেজ সম্পন্ন হলো — অ্যাডমিন ও (থাকলে) কাস্টমারকে জানানো (PRD সেকশন ৫.৬)
  if (isComplete && !wasComplete) {
    const label = `${phase.unit.project.name} — ${phase.unit.unitNo}: "${phase.name}" ফেজ সম্পন্ন`;

    const admins = await prisma.user.findMany({
      where: { active: true, role: Role.ADMIN, id: { not: actor.id } },
      select: { id: true },
    });
    await notifyMany({
      userIds: admins.map((a) => a.id),
      type: 'PHASE_MILESTONE',
      message: label,
      link: `/admin/projects/${phase.unit.project.id}/units/${phase.unit.id}`,
    });

    // কাস্টমারের খবরটি sweep ও এখান থেকে — দুই পথেই একই key, তাই দুবার যায় না
    await notifyDonePhases({ phaseId: phase.id, now });
  }

  revalidatePath('/engineer');
  revalidatePath('/engineer/sites');
  revalidatePath(`/engineer/sites/${phase.unit.id}`);
  revalidatePath(`/admin/projects/${phase.unit.project.id}`);
  revalidatePath(`/admin/projects/${phase.unit.project.id}/units/${phase.unit.id}`);
  revalidatePath('/admin/projects');
  revalidatePath('/customer/progress');

  const photoNote =
    photoUrls.length > 0 ? ` · ${photoUrls.length} টি ছবি যোগ হয়েছে` : '';
  const failNote = failed.length > 0 ? ` · ${failed.length} টি ছবি বাদ পড়েছে (${failed[0]})` : '';

  return {
    ok: true,
    message: `${phase.name} — ${percentComplete}% সেভ হয়েছে${photoNote}${failNote}`,
    data: { percentComplete, photos: photoUrls.length },
  };
}
