import type { ChecklistStatus } from '@prisma/client';

/**
 * Lead checklist — PRD সেকশন ৫.১ ("Checklist / Task tracking")।
 *
 * তালিকাটি ইচ্ছাকৃতভাবে fixed নয়: টিম নিজেরাই আইটেম লিখতে পারে। নিচের
 * সাজেশনগুলো শুধু quick-add বোতাম — PRD এর উদাহরণ আইটেমগুলো, যাতে সবচেয়ে
 * সাধারণ কাজগুলো টাইপ না করেই যোগ করা যায়।
 */

export const CHECKLIST_SUGGESTIONS = [
  'সাইট ভিজিট সম্পন্ন',
  'জমির দলিলের কপি সংগ্রহ',
  'সয়েল টেস্ট রিপোর্ট পাওয়া গেছে',
  'ডিজাইন ক্লায়েন্টকে পাঠানো হয়েছে',
  'কোটেশন approve হয়েছে',
] as const;

export const CHECKLIST_STATUS_LABEL: Record<ChecklistStatus, string> = {
  PENDING: 'বাকি',
  DONE: 'সম্পন্ন',
};

/** কতটুকু শেষ হয়েছে — কার্ড হেডারে "৩/৫ সম্পন্ন" ও প্রগ্রেস বার */
export function checklistProgress(items: { status: ChecklistStatus }[]) {
  const total = items.length;
  const done = items.filter((item) => item.status === 'DONE').length;
  return { total, done, pending: total - done, percent: total === 0 ? 0 : Math.round((done / total) * 100) };
}
