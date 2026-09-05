import type { SaleStatus, UnitStatus } from '@prisma/client';

/**
 * Lead → Sale কনভার্শনের কনস্ট্যান্ট ও লেবেল — PRD সেকশন ৫.১ (Automation rules)।
 *
 * `lib/leads.ts` এর মতোই এখানে শুধু type-only Prisma import, কারণ ফাইলটি client
 * component থেকেও import হয়।
 */

/**
 * PRD সেকশন ৫.১ — Won এ কনভার্ট হলে সেলটি "draft mode" এ তৈরি হয়; Accounts/Admin
 * PaymentPlan সেট করে কনফার্ম করলে তবেই CONFIRMED (Phase 4)।
 */
export const SALE_STATUS_LABEL: Record<SaleStatus, string> = {
  DRAFT: 'ড্রাফট',
  CONFIRMED: 'কনফার্মড',
};

/** স্ট্যাটাসের এক লাইনের ব্যাখ্যা — কার্ড/ডিটেইলে টুলটিপ ও সাবটেক্সট */
export const SALE_STATUS_HINT: Record<SaleStatus, string> = {
  DRAFT: 'পেমেন্ট প্ল্যান বাকি — Accounts/Admin কনফার্ম করবেন',
  CONFIRMED: 'পেমেন্ট প্ল্যান সেট করা হয়েছে',
};

export const SALE_STATUS_BADGE: Record<SaleStatus, string> = {
  DRAFT: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300',
  CONFIRMED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
};

export const UNIT_STATUS_LABEL: Record<UnitStatus, string> = {
  AVAILABLE: 'খালি',
  BOOKED: 'বুকড',
  SOLD: 'বিক্রিত',
  ON_HOLD: 'হোল্ডে',
};

/** ড্রপডাউন/লিস্টে ইউনিটের নাম — "Orion Green — B-4" */
export function unitLabel(unit: { unitNo: string; project: { name: string } }) {
  return `${unit.project.name} — ${unit.unitNo}`;
}
