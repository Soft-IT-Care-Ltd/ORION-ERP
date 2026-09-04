import type { LeadActivityType, LeadFileType, LeadSource, LeadStage } from '@prisma/client';

/**
 * Lead pipeline এর কনস্ট্যান্ট ও লেবেল — PRD সেকশন ৫.১।
 *
 * এই ফাইলটি client component ও server দুই জায়গা থেকেই import হয়, তাই এখানে
 * শুধু type-only Prisma import (runtime এ `@prisma/client` bundle হবে না)।
 */

/** বোর্ডে কলামগুলো ঠিক এই ক্রমেই দেখাবে — PRD এর funnel অর্ডার */
export const LEAD_STAGES = [
  'NEW',
  'CONTACTED',
  'SITE_VISIT_SCHEDULED',
  'SITE_VISIT_DONE',
  'NEGOTIATION',
  'BOOKING',
  'SALE_AGREEMENT_SIGNED',
  'WON',
  'LOST',
] as const satisfies readonly LeadStage[];

export const STAGE_LABEL: Record<LeadStage, string> = {
  NEW: 'নতুন লিড',
  CONTACTED: 'যোগাযোগ হয়েছে',
  SITE_VISIT_SCHEDULED: 'সাইট ভিজিট নির্ধারিত',
  SITE_VISIT_DONE: 'সাইট ভিজিট সম্পন্ন',
  NEGOTIATION: 'দরদাম',
  BOOKING: 'বুকিং (অ্যাডভান্স)',
  SALE_AGREEMENT_SIGNED: 'চুক্তি স্বাক্ষরিত',
  WON: 'Won (কনভার্টেড)',
  LOST: 'Lost',
};

/** ইংরেজি short label — chart axis / টুলটিপে ব্যবহারের জন্য */
export const STAGE_LABEL_EN: Record<LeadStage, string> = {
  NEW: 'New Lead',
  CONTACTED: 'Contacted',
  SITE_VISIT_SCHEDULED: 'Site Visit Scheduled',
  SITE_VISIT_DONE: 'Site Visit Done',
  NEGOTIATION: 'Negotiation',
  BOOKING: 'Booking',
  SALE_AGREEMENT_SIGNED: 'Sale Agreement Signed',
  WON: 'Won',
  LOST: 'Lost',
};

/** কলাম হেডারের accent — Won সবুজ, Lost লাল, বাকিগুলো ব্র্যান্ড navy→gold */
export const STAGE_ACCENT: Record<LeadStage, string> = {
  NEW: 'bg-slate-400',
  CONTACTED: 'bg-sky-500',
  SITE_VISIT_SCHEDULED: 'bg-indigo-500',
  SITE_VISIT_DONE: 'bg-violet-500',
  NEGOTIATION: 'bg-amber-500',
  BOOKING: 'bg-orion-gold',
  SALE_AGREEMENT_SIGNED: 'bg-teal-500',
  WON: 'bg-emerald-600',
  LOST: 'bg-destructive',
};

export const SOURCE_LABEL: Record<LeadSource, string> = {
  FACEBOOK_ADS: 'ফেসবুক অ্যাডস',
  WEBSITE: 'ওয়েবসাইট',
  WALK_IN: 'ওয়াক-ইন',
  REFERRAL: 'রেফারেল',
  COLD_CALL: 'কোল্ড কল',
  EXHIBITION: 'প্রপার্টি ফেয়ার',
  OTHER: 'অন্যান্য',
};

export const LEAD_SOURCES = Object.keys(SOURCE_LABEL) as LeadSource[];

/**
 * Lost reason — PRD সেকশন ৫.১ এ নির্ধারিত mandatory dropdown।
 * DB তে ইংরেজি canonical string সেভ হয় (রিপোর্ট/এক্সপোর্টে স্থিতিশীল),
 * UI তে বাংলা লেবেল দেখানো হয়।
 */
export const LOST_REASONS = [
  'Price too high',
  'Chose competitor',
  'Location mismatch',
  'Financing issue',
  'No response',
  'Other',
] as const;

export type LostReason = (typeof LOST_REASONS)[number];

export const LOST_REASON_LABEL: Record<LostReason, string> = {
  'Price too high': 'দাম বেশি মনে হয়েছে',
  'Chose competitor': 'প্রতিযোগীকে বেছে নিয়েছে',
  'Location mismatch': 'লোকেশন পছন্দ হয়নি',
  'Financing issue': 'অর্থায়ন/লোন সমস্যা',
  'No response': 'সাড়া দিচ্ছে না',
  Other: 'অন্যান্য',
};

export function lostReasonLabel(reason: string | null | undefined) {
  if (!reason) return null;
  return LOST_REASON_LABEL[reason as LostReason] ?? reason;
}

export const ACTIVITY_LABEL: Record<LeadActivityType, string> = {
  CREATED: 'লিড তৈরি',
  NOTE: 'নোট',
  STAGE_CHANGED: 'স্টেজ পরিবর্তন',
  ASSIGNED: 'অ্যাসাইনমেন্ট',
  FOLLOW_UP_SET: 'ফলো-আপ',
};

/** ফলো-আপ তারিখ কতটা জরুরি — কার্ডে রঙ ঠিক করতে */
export type FollowUpTone = 'overdue' | 'today' | 'upcoming';

/**
 * তারিখ শুধু server এ ফরম্যাট করা হয় (client এ করলে TZ ভেদে hydration mismatch হয়)।
 * `today` প্যারামিটার দিন-শুরুর সময় (local midnight)।
 */
export function followUpTone(date: Date, today: Date): FollowUpTone {
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (day.getTime() < today.getTime()) return 'overdue';
  if (day.getTime() === today.getTime()) return 'today';
  return 'upcoming';
}

export const FOLLOW_UP_TONE_CLASS: Record<FollowUpTone, string> = {
  overdue: 'text-destructive',
  today: 'text-amber-600 dark:text-amber-500',
  upcoming: 'text-muted-foreground',
};

/** বাজেট রেঞ্জ → "৳45,00,000 – ৳55,00,000" ধরনের এক লাইনের লেবেল */
export function budgetLabel(
  min: number | null,
  max: number | null,
  format: (n: number) => string,
): string | null {
  if (min == null && max == null) return null;
  if (min != null && max != null) return `${format(min)} – ${format(max)}`;
  return format((min ?? max) as number);
}

/* ---------------------------------------------------------------- documents */

/** PRD সেকশন ৫.১ — Lead Documents এর File Type */
export const FILE_TYPE_LABEL: Record<LeadFileType, string> = {
  FLOOR_PLAN: 'ফ্লোর প্ল্যান',
  THREE_D_DESIGN: '3D ডিজাইন',
  PROPOSAL: 'প্রস্তাবনা',
  LAND_DOCUMENT: 'জমির দলিল',
  OTHER: 'অন্যান্য',
};

export const LEAD_FILE_TYPES = Object.keys(FILE_TYPE_LABEL) as LeadFileType[];

/** ডকুমেন্ট লিস্টে টাইপ ব্যাজের রঙ */
export const FILE_TYPE_BADGE: Record<LeadFileType, string> = {
  FLOOR_PLAN: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
  THREE_D_DESIGN: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300',
  PROPOSAL: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300',
  LAND_DOCUMENT: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  OTHER: 'bg-muted text-muted-foreground',
};

/* ------------------------------------------------------- প্রবাসী local contact */

/**
 * লোকাল কন্টাক্টের সম্পর্ক — ফ্রি-টেক্সট ফিল্ডে `<datalist>` সাজেশন হিসেবে যায়
 * (PRD এ ফিল্ডটি text, তাই তালিকার বাইরেও লেখা যাবে)।
 */
export const LOCAL_CONTACT_RELATIONS = [
  'ভাই',
  'বোন',
  'বাবা',
  'মা',
  'স্ত্রী',
  'ছেলে',
  'বন্ধু',
  'আত্মীয়',
  'প্রতিবেশী',
  'ব্যবসায়িক অংশীদার',
] as const;
