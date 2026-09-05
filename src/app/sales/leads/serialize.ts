import { format } from 'date-fns';
import type { Prisma } from '@prisma/client';
import { budgetLabel, followUpTone, SOURCE_LABEL } from '@/lib/leads';
import { unitLabel } from '@/lib/sales';
import { countryFlag, countryLabel, DEFAULT_PHONE_COUNTRY } from '@/lib/countries';
import { formatPhoneInternational, splitPhone } from '@/lib/phone';
import { formatBDT } from '@/lib/utils';
import type { PipelineLead } from '../pipeline/types';
import type { EditableLead, UnitOption } from './lead-form-dialog';
import type { SaleUnitOption } from './won-sale-dialog';

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
  residenceCountry: true,
  projectLocation: true,
  budgetMin: true,
  budgetMax: true,
  assignedToId: true,
  nextFollowUpAt: true,
  localContactName: true,
  localContactPhone: true,
  localContactRelation: true,
  assignedTo: { select: { id: true, name: true } },
  _count: { select: { documents: true } },
  // Won এ কনভার্ট হয়েছে কিনা — কার্ডে ব্যাজ, আর স্টেজ মেনুর সিদ্ধান্ত এর উপর
  sale: {
    select: {
      id: true,
      status: true,
      totalAmount: true,
      unit: { select: { unitNo: true, project: { select: { name: true } } } },
    },
  },
} satisfies Prisma.LeadSelect;

export type LeadCardRow = Prisma.LeadGetPayload<{ select: typeof leadCardSelect }>;

/** Prisma Decimal client component এ পাঠানো যায় না — number/string এ নামিয়ে আনা হয় */
const toNumber = (value: Prisma.Decimal | null) => (value === null ? null : Number(value));

export function toEditableLead(lead: LeadCardRow): EditableLead {
  // DB তে E.164 থাকে; ফর্মে country picker + লোকাল নম্বর — তাই আবার ভাঙা হয়
  const phone = splitPhone(lead.phone);
  const localPhone = splitPhone(lead.localContactPhone);

  return {
    id: lead.id,
    name: lead.name,
    phoneCountry: phone.country ?? DEFAULT_PHONE_COUNTRY,
    phoneNumber: phone.national,
    residenceCountry: lead.residenceCountry,
    email: lead.email,
    source: lead.source,
    unitId: lead.unitId,
    projectLocation: lead.projectLocation,
    budgetMin: lead.budgetMin === null ? null : String(toNumber(lead.budgetMin)),
    budgetMax: lead.budgetMax === null ? null : String(toNumber(lead.budgetMax)),
    assignedToId: lead.assignedToId,
    nextFollowUpAt: lead.nextFollowUpAt ? format(lead.nextFollowUpAt, 'yyyy-MM-dd') : null,
    localContactName: lead.localContactName,
    // লোকাল কন্টাক্ট সবসময় বাংলাদেশি — ফর্মে দেশীয় রূপেই দেখানো সহজ
    localContactPhone: localPhone.national || null,
    localContactRelation: lead.localContactRelation,
  };
}

/** `today` = আজকের local midnight (request প্রতি একবার হিসাব করে পাঠান) */
export function toPipelineLead(lead: LeadCardRow, today: Date): PipelineLead {
  const residenceLabel = countryLabel(lead.residenceCountry);

  return {
    id: lead.id,
    name: lead.name,
    phone: formatPhoneInternational(lead.phone),
    phoneE164: lead.phone,
    stage: lead.stage,
    sourceLabel: SOURCE_LABEL[lead.source],
    assignedToName: lead.assignedTo?.name ?? null,
    followUpLabel: lead.nextFollowUpAt ? format(lead.nextFollowUpAt, 'dd MMM') : null,
    followUpTone: lead.nextFollowUpAt ? followUpTone(lead.nextFollowUpAt, today) : null,
    budgetLabel: budgetLabel(toNumber(lead.budgetMin), toNumber(lead.budgetMax), formatBDT),
    lostReason: lead.lostReason,
    residence: residenceLabel
      ? { flag: countryFlag(lead.residenceCountry), label: residenceLabel }
      : null,
    documentCount: lead._count.documents,
    sale: lead.sale
      ? {
          status: lead.sale.status,
          unitLabel: unitLabel(lead.sale.unit),
          amountLabel: formatBDT(Number(lead.sale.totalAmount)),
        }
      : null,
    editable: toEditableLead(lead),
  };
}

/** আজকের দিন-শুরু — ফলো-আপ overdue/today হিসাব করার রেফারেন্স */
export function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/* ------------------------------------------------------------------- units */

/**
 * ইউনিট ড্রপডাউন — লিড ফর্মে (শুধু নাম) ও সেল কনফার্ম ডায়ালগে (দাম, স্ট্যাটাস,
 * আগে বিক্রি হয়ে গেছে কিনা) — দুই জায়গায় একই সারি ব্যবহৃত হয়।
 */
export const unitOptionSelect = {
  id: true,
  unitNo: true,
  price: true,
  status: true,
  project: { select: { name: true } },
  sale: { select: { id: true } },
} satisfies Prisma.UnitSelect;

export type UnitOptionRow = Prisma.UnitGetPayload<{ select: typeof unitOptionSelect }>;

export function toUnitOption(unit: UnitOptionRow): UnitOption {
  return { id: unit.id, label: unitLabel(unit) };
}

export function toSaleUnitOption(unit: UnitOptionRow): SaleUnitOption {
  const price = Number(unit.price);
  return {
    id: unit.id,
    projectName: unit.project.name,
    unitNo: unit.unitNo,
    price: String(price),
    priceLabel: formatBDT(price),
    status: unit.status,
    // Sale.unitId unique — একটি ইউনিট একবারই বিক্রি হতে পারে
    taken: unit.sale !== null || unit.status === 'SOLD',
  };
}
