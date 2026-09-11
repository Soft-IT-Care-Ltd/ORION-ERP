import { format } from 'date-fns';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  DOCUMENT_TYPE_LABEL,
  documentDownloadName,
  fileExtLabel,
  normalizeDocumentType,
  type DocumentItem,
} from '@/lib/documents';

/**
 * প্রজেক্ট ডকুমেন্টের DB অংশ — Admin/Accounts (আপলোড ও তালিকা) এবং Customer
 * পোর্টাল, দুই জায়গাতেই একই কুয়েরি ও একই সারি-রূপান্তর লাগে, তাই এক জায়গায়
 * (`lib/payment-data.ts` / `lib/phase-data.ts` এর মতোই)।
 *
 * এটি server-only; বিশুদ্ধ লেবেল, টাইপ ও গ্রুপিং `lib/documents.ts` এ।
 */

export const projectDocumentSelect = {
  id: true,
  type: true,
  fileUrl: true,
  fileName: true,
  description: true,
  uploadedAt: true,
  uploadedBy: { select: { name: true } },
} satisfies Prisma.DocumentSelect;

export type ProjectDocumentRow = Prisma.DocumentGetPayload<{
  select: typeof projectDocumentSelect;
}>;

/**
 * DB row → তালিকার সারি।
 *
 * `showUploader` — Admin/Accounts এর কাছে "কে দিয়েছে" জরুরি; কাস্টমারের কাছে
 * অফিসের কোন কর্মী ফাইলটি দিয়েছেন সেটি প্রাসঙ্গিক নয়, তাই সেখানে বন্ধ।
 */
export function toDocumentItem(
  row: ProjectDocumentRow,
  projectRef: string,
  options?: { showUploader?: boolean },
): DocumentItem {
  const type = normalizeDocumentType(row.type);
  const meta = [
    DOCUMENT_TYPE_LABEL[type],
    format(row.uploadedAt, 'dd MMM yyyy'),
    options?.showUploader ? row.uploadedBy.name : null,
    row.description,
  ].filter(Boolean) as string[];

  return {
    id: row.id,
    type,
    // ডিস্কের নাম UUID — তালিকায় আপলোডের সময়কার আসল নামই দেখানো হয়
    title: row.fileName,
    meta: meta.join(' · '),
    fileUrl: row.fileUrl,
    downloadName: documentDownloadName(type, projectRef, row.fileUrl),
    badge: fileExtLabel(row.fileUrl),
  };
}

/** এক প্রজেক্টের সব ডকুমেন্ট — নতুনটি আগে */
export async function loadProjectDocuments(
  projectId: string,
  projectRef: string,
  options?: { showUploader?: boolean },
): Promise<DocumentItem[]> {
  const rows = await prisma.document.findMany({
    where: { projectId },
    select: projectDocumentSelect,
    orderBy: { uploadedAt: 'desc' },
  });

  return rows.map((row) => toDocumentItem(row, projectRef, options));
}
