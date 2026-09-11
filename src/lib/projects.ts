import type { BuildingType, ProjectStatus } from '@prisma/client';
import { BUILDING_TYPE_LABEL } from '@/lib/leads';

/**
 * কনস্ট্রাকশন প্রজেক্টের কনস্ট্যান্ট ও লেবেল — PRD সেকশন ৫.৩/৫.৪ (v2)।
 *
 * v2 তে "Project" মানে **এক ক্লায়েন্টের একটি কনস্ট্রাকশন জব** (আগের multi-unit
 * Project→Unit→Sale মডেল নয়)। `lib/leads.ts` এর মতোই এখানে শুধু type-only Prisma
 * import ও বিশুদ্ধ ফাংশন, কারণ ফাইলটি client component থেকেও import হয়।
 */

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  ACTIVE: 'চলমান',
  ON_HOLD: 'স্থগিত',
  COMPLETED: 'সম্পন্ন',
};

export const PROJECT_STATUSES = Object.keys(PROJECT_STATUS_LABEL) as ProjectStatus[];

export const PROJECT_STATUS_HINT: Record<ProjectStatus, string> = {
  ACTIVE: 'নির্মাণ কাজ চলছে',
  ON_HOLD: 'সাময়িকভাবে বন্ধ',
  COMPLETED: 'হ্যান্ডওভার সম্পন্ন',
};

export const PROJECT_STATUS_BADGE: Record<ProjectStatus, string> = {
  ACTIVE: 'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-300',
  ON_HOLD: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300',
  COMPLETED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
};

/**
 * Lead → Project কনভার্শনের সময় শিরোনাম — "রহিম সাহেবের ডুপ্লেক্স — সোনাডাঙ্গা"।
 * Building type বা লোকেশন না থাকলে যেটুকু জানা আছে তা দিয়েই নাম হয়।
 */
export function buildProjectTitle(lead: {
  name: string;
  buildingType?: BuildingType | null;
  projectLocation?: string | null;
}): string {
  const type = lead.buildingType ? BUILDING_TYPE_LABEL[lead.buildingType] : 'কনস্ট্রাকশন';
  const base = `${lead.name} এর ${type}`;
  const location = lead.projectLocation?.trim();
  return location ? `${base} — ${location}` : base;
}

/**
 * per-sqft রেট ও আয়তন থেকে আনুমানিক কন্ট্রাক্ট ভ্যালু — কনভার্শন ফর্মে
 * "রেট × sqft" বসালেই মোট অঙ্কটা প্রস্তাব করা হয় (ইউজার বদলাতে পারে)।
 */
export function estimateContractValue(
  ratePerSqft: number | null | undefined,
  totalSqft: number | null | undefined,
): number | null {
  if (!ratePerSqft || !totalSqft) return null;
  const value = Math.round(ratePerSqft * totalSqft);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * লাইভ CC ক্যামেরার URL কাস্টমার পোর্টালে `<iframe>` এ বসানো হয় (PRD সেকশন ৫.৪)।
 * শুধু http/https মানা হয় — `javascript:` ধরনের স্কিম বসিয়ে দিলে সেটি
 * কাস্টমারের ব্রাউজারে স্ক্রিপ্ট চালানোর সুযোগ করে দিত।
 */
export function isEmbeddableStreamUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}
