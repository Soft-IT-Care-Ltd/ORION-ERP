'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { getAuthorizedUser } from '@/lib/guards';
import { logActivity } from '@/lib/activity-log';
import { notify } from '@/lib/notifications';
import { saveUploadedFile } from '@/lib/upload';
import { DOCUMENT_TYPE_LABEL, type DocumentType } from '@/lib/documents';
import { uploadSaleDocumentSchema } from '@/lib/validations/document';
import {
  type ActionResult,
  FORBIDDEN,
  NOT_FOUND,
  zodErrors,
} from '@/lib/action-result';

export type { ActionResult } from '@/lib/action-result';

/** লিড ডকুমেন্টের মতোই — একবারে এতগুলোর বেশি ফাইল নেওয়া হয় না */
const MAX_FILES_PER_UPLOAD = 10;

function field(formData: FormData, key: string) {
  const value = formData.get(key);
  return value === null ? undefined : String(value);
}

/**
 * PRD সেকশন ৫.৪ ও ৫.৫ — সেলের কাগজপত্র (বুকিং ফর্ম, সেল এগ্রিমেন্ট, অ্যালটমেন্ট
 * লেটার, দলিল) আপলোড। ফাইলগুলো কাস্টমার পোর্টালে সঙ্গে সঙ্গে দেখা যায়।
 *
 * অনুমতি `document:manageSale` — PRD সেকশন ৪ অনুযায়ী শুধু Admin ও Accounts।
 * লিড ডকুমেন্টের `document:upload` দিয়ে যাচাই করা হয়নি, কারণ সেটি
 * MARKETING/ENGINEER এরও আছে (তাদের নিজেদের মডিউলের ফাইলের জন্য)।
 */
export async function uploadSaleDocuments(
  formData: FormData,
): Promise<ActionResult<{ uploaded: number }>> {
  const actor = await getAuthorizedUser('document:manageSale');
  if (!actor) return FORBIDDEN;

  const parsed = uploadSaleDocumentSchema.safeParse({
    saleId: field(formData, 'saleId'),
    type: field(formData, 'type'),
    description: field(formData, 'description'),
  });
  if (!parsed.success) {
    const fieldErrors = zodErrors(parsed.error);
    return { ok: false, message: fieldErrors.type ?? 'ইনপুট সঠিক নয়', fieldErrors };
  }
  const { saleId, description } = parsed.data;
  const type: DocumentType = parsed.data.type;

  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    select: {
      id: true,
      customer: { select: { userId: true } },
      unit: { select: { unitNo: true, project: { select: { name: true } } } },
    },
  });
  if (!sale) return NOT_FOUND;

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
    const result = await saveUploadedFile(file, ['sales', saleId], originalName);
    if (result.ok) saved.push({ fileUrl: result.file.url, fileName: result.file.fileName });
    else failed.push(`${originalName} — ${result.reason}`);
  }

  // একটিও সেভ না হলে DB তে কিছু লেখার দরকার নেই
  if (saved.length === 0) {
    return { ok: false, message: failed[0] ?? 'কোনো ফাইল আপলোড করা যায়নি' };
  }

  await prisma.document.createMany({
    data: saved.map((f) => ({
      saleId,
      type,
      fileUrl: f.fileUrl,
      fileName: f.fileName,
      description: description ?? null,
      uploadedById: actor.id,
    })),
  });

  // CLAUDE.md নিয়ম ৪ — critical action এর audit trail
  await logActivity({
    entityType: 'Sale',
    entityId: saleId,
    userId: actor.id,
    action: 'DOCUMENT_UPLOADED',
    metadata: { type, count: saved.length, fileNames: saved.map((f) => f.fileName) },
  });

  // PRD সেকশন ৫.৬ — "document uploaded" ইভেন্টে কাস্টমারকে জানানো
  await notify({
    userId: sale.customer.userId,
    type: 'DOCUMENT_UPLOADED',
    message: `${sale.unit.project.name} — ${sale.unit.unitNo}: ${saved.length} টি নতুন ডকুমেন্ট যোগ হয়েছে (${DOCUMENT_TYPE_LABEL[type]})`,
    link: '/customer/documents',
  });

  revalidatePath(`/accounts/schedule/${saleId}`);
  // কাস্টমার পোর্টালের যে পাতাগুলোতে ফাইলটি দেখা যাবে
  revalidatePath('/customer');
  revalidatePath('/customer/documents');

  // আংশিক সফল হলে কোনটি বাদ পড়ল সেটাও জানানো দরকার
  return {
    ok: true,
    message:
      failed.length === 0
        ? `${saved.length} টি ডকুমেন্ট আপলোড হয়েছে`
        : `${saved.length} টি আপলোড হয়েছে · ${failed.length} টি বাদ পড়েছে (${failed[0]})`,
    data: { uploaded: saved.length },
  };
}
