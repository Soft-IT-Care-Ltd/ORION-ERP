import { format } from 'date-fns';
import type { SaleStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { loadSalePlan, type SalePlan } from '@/lib/payment-data';
import { loadUnitTimeline, type UnitTimeline } from '@/lib/phase-data';
import { paymentHistory, type PaymentHistoryItem } from '@/lib/payments';
import { loadSaleDocuments } from '@/lib/document-data';
import { groupDocuments, type DocumentGroup, type DocumentItem } from '@/lib/documents';
import { formatBDT } from '@/lib/utils';

/**
 * কাস্টমার পোর্টালের ডেটা — PRD সেকশন ৫.৪।
 *
 * পোর্টালের চারটি পাতা (ড্যাশবোর্ড, অগ্রগতি, পেমেন্ট, ডকুমেন্ট) একই কাস্টমারের
 * একই সেল/ইউনিট নিয়ে কাজ করে, তাই কুয়েরিগুলো এক জায়গায় (`lib/phase-data.ts` ও
 * `lib/payment-data.ts` এর মতোই)।
 *
 * **স্কোপ:** প্রতিটি কুয়েরি `customer.userId` দিয়েই শুরু হয় — লগইন করা ইউজারের
 * নিজের রেকর্ড ছাড়া অন্য কিছু কখনো ফেরত আসে না (PRD সেকশন ৪)। এটি server-only।
 */

export type CustomerUnit = {
  saleId: string;
  unitId: string;
  status: SaleStatus;
  projectName: string;
  projectLocation: string;
  unitNo: string;
  /** "Orion Green — A-4" */
  label: string;
  sizeSqft: number | null;
  /** সেল/বুকিংয়ের তারিখ — server এ ফরম্যাট করা (TZ-নিরপেক্ষ রাখতে) */
  bookingDateLabel: string;
  totalAmount: number;
};

const saleSelect = {
  id: true,
  status: true,
  saleDate: true,
  totalAmount: true,
  unit: {
    select: {
      id: true,
      unitNo: true,
      sizeSqft: true,
      project: { select: { name: true, location: true } },
    },
  },
} as const;

type SaleRow = {
  id: string;
  status: SaleStatus;
  saleDate: Date;
  totalAmount: { toString(): string };
  unit: {
    id: string;
    unitNo: string;
    sizeSqft: { toString(): string } | null;
    project: { name: string; location: string };
  };
};

function toCustomerUnit(sale: SaleRow): CustomerUnit {
  return {
    saleId: sale.id,
    unitId: sale.unit.id,
    status: sale.status,
    projectName: sale.unit.project.name,
    projectLocation: sale.unit.project.location,
    unitNo: sale.unit.unitNo,
    label: `${sale.unit.project.name} — ${sale.unit.unitNo}`,
    sizeSqft: sale.unit.sizeSqft === null ? null : Number(sale.unit.sizeSqft),
    bookingDateLabel: format(sale.saleDate, 'dd MMM yyyy'),
    totalAmount: Number(sale.totalAmount),
  };
}

/** লগইন করা কাস্টমারের ইউনিটগুলো — নতুন সেল আগে */
export async function loadCustomerUnits(userId: string): Promise<CustomerUnit[]> {
  const customer = await prisma.customer.findUnique({
    where: { userId },
    select: { sales: { select: saleSelect, orderBy: { saleDate: 'desc' } } },
  });

  return (customer?.sales ?? []).map(toCustomerUnit);
}

/* ------------------------------------------------------------ documents */

/**
 * এক ইউনিটের ডকুমেন্ট তালিকা — আপলোড করা কাগজ + সিস্টেমে তৈরি পেমেন্ট রসিদ।
 *
 * রসিদগুলো `Document` রো নয় (সেগুলো `Payment` থেকে তৈরি প্রিন্ট পেজ), কিন্তু
 * কাস্টমারের চোখে ওগুলোও ডকুমেন্ট — তাই একই তালিকায় "পেমেন্ট রসিদ" গ্রুপে
 * দেখানো হয় (PRD সেকশন ৫.৪ — "booking form, allotment letter … + receipt")।
 */
function buildDocumentGroups(
  uploaded: DocumentItem[],
  payments: PaymentHistoryItem[],
): DocumentGroup[] {
  const receipts: DocumentItem[] = payments.map((payment) => ({
    id: `receipt-${payment.id}`,
    type: 'Receipt',
    title: `রসিদ ${payment.receiptNo}`,
    meta: `${payment.paidAtLabel} · ${formatBDT(payment.amount)}`,
    href: `/receipts/${payment.id}`,
    badge: 'PDF',
  }));

  return groupDocuments([...uploaded, ...receipts]);
}

/* --------------------------------------------------------- full portal */

export type CustomerUnitDetail = {
  unit: CustomerUnit;
  timeline: UnitTimeline;
  plan: SalePlan;
  /** সব কিস্তির পেমেন্ট একসাথে, সাম্প্রতিকটি আগে */
  payments: PaymentHistoryItem[];
  documents: DocumentGroup[];
};

async function loadUnitDetail(sale: SaleRow, now: Date): Promise<CustomerUnitDetail> {
  const unit = toCustomerUnit(sale);

  const [timeline, plan, documents] = await Promise.all([
    loadUnitTimeline(unit.unitId, now),
    loadSalePlan(unit.saleId, now),
    // কে আপলোড করেছেন সেটি কাস্টমারকে দেখানো হয় না (`showUploader` বন্ধ)
    loadSaleDocuments(unit.saleId, unit.unitNo),
  ]);

  const payments = paymentHistory(plan.installments);

  return { unit, timeline, plan, payments, documents: buildDocumentGroups(documents, payments) };
}

/**
 * কাস্টমার ড্যাশবোর্ডের পুরো ডেটা — ইউনিটপ্রতি সারাংশ, ফেজ টাইমলাইন, পেমেন্ট
 * শিডিউল, পেমেন্ট হিস্টরি ও ডকুমেন্ট।
 *
 * সাধারণত একজন কাস্টমারের একটি ইউনিটই থাকে; একাধিক থাকলে প্রতিটির জন্য আলাদা
 * সেকশন দেখানো হয়, তাই তালিকা।
 */
export async function loadCustomerPortal(
  userId: string,
  now: Date,
): Promise<CustomerUnitDetail[]> {
  const customer = await prisma.customer.findUnique({
    where: { userId },
    select: { sales: { select: saleSelect, orderBy: { saleDate: 'desc' } } },
  });

  return Promise.all((customer?.sales ?? []).map((sale) => loadUnitDetail(sale, now)));
}

/** শুধু ডকুমেন্ট পাতার জন্য — টাইমলাইন লোড না করে হালকা কুয়েরি */
export async function loadCustomerDocuments(
  userId: string,
  now: Date,
): Promise<{ unit: CustomerUnit; documents: DocumentGroup[] }[]> {
  const customer = await prisma.customer.findUnique({
    where: { userId },
    select: { sales: { select: saleSelect, orderBy: { saleDate: 'desc' } } },
  });

  return Promise.all(
    (customer?.sales ?? []).map(async (sale) => {
      const unit = toCustomerUnit(sale);
      const [plan, documents] = await Promise.all([
        loadSalePlan(unit.saleId, now),
        loadSaleDocuments(unit.saleId, unit.unitNo),
      ]);

      return {
        unit,
        documents: buildDocumentGroups(documents, paymentHistory(plan.installments)),
      };
    }),
  );
}
