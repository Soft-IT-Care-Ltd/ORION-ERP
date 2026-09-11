import { format } from 'date-fns';
import type { BuildingType, ProjectStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { loadProjectPlan, type ProjectPlan } from '@/lib/payment-data';
import { loadProjectTimeline, type ProjectTimeline } from '@/lib/phase-data';
import { loadClientVisibleEntries, type LedgerEntryView } from '@/lib/ledger-data';
import { paymentHistory, type PaymentHistoryItem } from '@/lib/payments';
import { loadProjectDocuments } from '@/lib/document-data';
import { groupDocuments, type DocumentGroup, type DocumentItem } from '@/lib/documents';
import { isEmbeddableStreamUrl } from '@/lib/projects';
import { formatBDT } from '@/lib/utils';

/**
 * কাস্টমার পোর্টালের ডেটা — PRD সেকশন ৫.৭।
 *
 * পোর্টালের চারটি পাতা (ড্যাশবোর্ড, অগ্রগতি, পেমেন্ট, ডকুমেন্ট) একই কাস্টমারের
 * একই প্রজেক্ট নিয়ে কাজ করে, তাই কুয়েরিগুলো এক জায়গায় (`lib/phase-data.ts` ও
 * `lib/payment-data.ts` এর মতোই)।
 *
 * **স্কোপ:** প্রতিটি কুয়েরি `customer.userId` দিয়েই শুরু হয় — লগইন করা ইউজারের
 * নিজের রেকর্ড ছাড়া অন্য কিছু কখনো ফেরত আসে না (PRD সেকশন ৪)। এটি server-only।
 *
 * **নিরাপত্তা নীতি:** এখান থেকে কোনো internal cost/expense কখনো বের হয় না —
 * `loadClientVisibleEntries` DB লেভেলেই `type=INCOME` ও `clientVisible=true`
 * দুটোই চায় (PRD সেকশন ৪ ও ৫.৭)।
 */

export type CustomerProject = {
  projectId: string;
  title: string;
  landLocation: string | null;
  buildingType: BuildingType | null;
  floors: number | null;
  totalSqft: number | null;
  status: ProjectStatus;
  /** নির্মাণ শুরুর তারিখ — server এ ফরম্যাট করা (TZ-নিরপেক্ষ রাখতে) */
  startDateLabel: string | null;
  totalContractValue: number;
  /** লাইভ CC ক্যামেরা — শুধু বৈধ http/https হলে (PRD সেকশন ৫.৪) */
  cameraStreamUrl: string | null;
};

const projectSelect = {
  id: true,
  title: true,
  landLocation: true,
  buildingType: true,
  floors: true,
  totalSqft: true,
  status: true,
  startDate: true,
  createdAt: true,
  totalContractValue: true,
  cameraStreamUrl: true,
  leadId: true,
} as const;

type ProjectRow = {
  id: string;
  title: string;
  landLocation: string | null;
  buildingType: BuildingType | null;
  floors: number | null;
  totalSqft: { toString(): string } | null;
  status: ProjectStatus;
  startDate: Date | null;
  createdAt: Date;
  totalContractValue: { toString(): string };
  cameraStreamUrl: string | null;
  leadId: string;
};

function toCustomerProject(project: ProjectRow): CustomerProject {
  return {
    projectId: project.id,
    title: project.title,
    landLocation: project.landLocation,
    buildingType: project.buildingType,
    floors: project.floors,
    totalSqft: project.totalSqft === null ? null : Number(project.totalSqft),
    status: project.status,
    startDateLabel: project.startDate ? format(project.startDate, 'dd MMM yyyy') : null,
    totalContractValue: Number(project.totalContractValue),
    // অ্যাডমিন ভুল স্কিমের লিংক বসিয়ে দিলে সেটি iframe এ যাবে না
    cameraStreamUrl: isEmbeddableStreamUrl(project.cameraStreamUrl)
      ? project.cameraStreamUrl
      : null,
  };
}

/** লগইন করা কাস্টমারের প্রজেক্ট — নতুনটি আগে */
export async function loadCustomerProjects(userId: string): Promise<CustomerProject[]> {
  const customer = await prisma.customer.findUnique({
    where: { userId },
    select: { projects: { select: projectSelect, orderBy: { createdAt: 'desc' } } },
  });

  return (customer?.projects ?? []).map(toCustomerProject);
}

/* ------------------------------------------------------------ documents */

/**
 * এক প্রজেক্টের ডকুমেন্ট তালিকা — আপলোড করা কাগজ + সিস্টেমে তৈরি পেমেন্ট রসিদ।
 *
 * রসিদগুলো `Document` রো নয় (সেগুলো `Payment` থেকে তৈরি প্রিন্ট পেজ), কিন্তু
 * কাস্টমারের চোখে ওগুলোও ডকুমেন্ট — তাই একই তালিকায় "পেমেন্ট রসিদ" গ্রুপে
 * দেখানো হয় (PRD সেকশন ৫.৭)।
 */
function buildDocumentGroups(
  uploaded: DocumentItem[],
  payments: PaymentHistoryItem[],
  preProjectBills: LedgerEntryView[],
): DocumentGroup[] {
  const receipts: DocumentItem[] = payments.map((payment) => ({
    id: `receipt-${payment.id}`,
    type: 'Receipt',
    title: `রসিদ ${payment.receiptNo}`,
    meta: `${payment.paidAtLabel} · ${formatBDT(payment.amount)}`,
    href: `/receipts/${payment.id}`,
    badge: 'PDF',
  }));

  // PRD সেকশন ৫.২ — pre-project সার্ভিসের বিলগুলোও কাস্টমারের রসিদ; কিস্তির
  // রসিদের মতোই এগুলোর নিজস্ব প্রিন্ট পেজ আছে (`/receipts/bill/[entryId]`)।
  // রসিদ নম্বর ছাড়া এন্ট্রির প্রিন্টযোগ্য রূপ নেই, তাই সেগুলো বাদ।
  const bills: DocumentItem[] = preProjectBills
    .filter((entry) => entry.receiptNo !== null)
    .map((entry) => ({
      id: `bill-${entry.id}`,
      type: 'Receipt',
      title: `রসিদ ${entry.receiptNo}`,
      meta: `${entry.dateLabel} · ${entry.categoryLabel} · ${entry.amountLabel}`,
      href: `/receipts/bill/${entry.id}`,
      badge: 'PDF',
    }));

  return groupDocuments([...uploaded, ...receipts, ...bills]);
}

/* --------------------------------------------------------- full portal */

export type CustomerProjectDetail = {
  project: CustomerProject;
  timeline: ProjectTimeline;
  plan: ProjectPlan;
  /** সব কিস্তির পেমেন্ট একসাথে, সাম্প্রতিকটি আগে */
  payments: PaymentHistoryItem[];
  /** Won হওয়ার আগের সার্ভিস বিল — শুধু client-visible income (PRD সেকশন ৫.২) */
  preProjectBills: LedgerEntryView[];
  documents: DocumentGroup[];
};

async function loadProjectDetail(row: ProjectRow, now: Date): Promise<CustomerProjectDetail> {
  const project = toCustomerProject(row);

  const [timeline, plan, documents, preProjectBills] = await Promise.all([
    loadProjectTimeline(project.projectId, now),
    loadProjectPlan(project.projectId, now),
    // কে আপলোড করেছেন সেটি কাস্টমারকে দেখানো হয় না (`showUploader` বন্ধ)
    loadProjectDocuments(project.projectId, project.title),
    loadClientVisibleEntries(row.leadId),
  ]);

  const payments = paymentHistory(plan.installments);

  return {
    project,
    timeline,
    plan,
    payments,
    preProjectBills,
    documents: buildDocumentGroups(documents, payments, preProjectBills),
  };
}

/**
 * কাস্টমার ড্যাশবোর্ডের পুরো ডেটা — প্রজেক্ট সারাংশ, ফেজ টাইমলাইন, পেমেন্ট
 * শিডিউল, পেমেন্ট হিস্টরি, প্রি-প্রজেক্ট বিল ও ডকুমেন্ট।
 *
 * সাধারণত একজন কাস্টমারের একটি প্রজেক্টই থাকে; একাধিক থাকলে (দ্বিতীয় বাড়ি)
 * প্রতিটির জন্য আলাদা সেকশন দেখানো হয়, তাই তালিকা।
 */
export async function loadCustomerPortal(
  userId: string,
  now: Date,
): Promise<CustomerProjectDetail[]> {
  const customer = await prisma.customer.findUnique({
    where: { userId },
    select: { projects: { select: projectSelect, orderBy: { createdAt: 'desc' } } },
  });

  return Promise.all((customer?.projects ?? []).map((project) => loadProjectDetail(project, now)));
}

/**
 * শুধু পেমেন্ট পাতার জন্য — ফেজ টাইমলাইন ও ডকুমেন্ট ছাড়া।
 *
 * কিস্তির প্ল্যান, পরিশোধের ইতিহাস ও প্রি-প্রজেক্ট সার্ভিস বিল — PRD সেকশন ৫.৭
 * এর "payment schedule + payment history + downloadable invoice/receipt …
 * pre-project বিল ও construction installment দুটোই"।
 */
export type CustomerPaymentsView = {
  project: CustomerProject;
  plan: ProjectPlan;
  payments: PaymentHistoryItem[];
  preProjectBills: LedgerEntryView[];
};

export async function loadCustomerPayments(
  userId: string,
  now: Date,
): Promise<CustomerPaymentsView[]> {
  const customer = await prisma.customer.findUnique({
    where: { userId },
    select: { projects: { select: projectSelect, orderBy: { createdAt: 'desc' } } },
  });

  return Promise.all(
    (customer?.projects ?? []).map(async (row) => {
      const project = toCustomerProject(row);
      const [plan, preProjectBills] = await Promise.all([
        loadProjectPlan(project.projectId, now),
        loadClientVisibleEntries(row.leadId),
      ]);

      return { project, plan, payments: paymentHistory(plan.installments), preProjectBills };
    }),
  );
}

/** শুধু ডকুমেন্ট পাতার জন্য — টাইমলাইন লোড না করে হালকা কুয়েরি */
export async function loadCustomerDocuments(
  userId: string,
  now: Date,
): Promise<{ project: CustomerProject; documents: DocumentGroup[] }[]> {
  const customer = await prisma.customer.findUnique({
    where: { userId },
    select: { projects: { select: projectSelect, orderBy: { createdAt: 'desc' } } },
  });

  return Promise.all(
    (customer?.projects ?? []).map(async (row) => {
      const project = toCustomerProject(row);
      const [plan, documents, bills] = await Promise.all([
        loadProjectPlan(project.projectId, now),
        loadProjectDocuments(project.projectId, project.title),
        loadClientVisibleEntries(row.leadId),
      ]);

      return {
        project,
        documents: buildDocumentGroups(documents, paymentHistory(plan.installments), bills),
      };
    }),
  );
}
