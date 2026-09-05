import type { LeadStage, SaleStatus } from '@prisma/client';
import type { FollowUpTone } from '@/lib/leads';
import type { EditableLead } from '../leads/lead-form-dialog';

/**
 * বোর্ডের কার্ডে যা দেখানো হয়। তারিখ/টাকা server এ ফরম্যাট করে string আকারে
 * পাঠানো হয় — client এ ফরম্যাট করলে timezone/locale ভেদে hydration mismatch হতো,
 * আর Prisma Decimal সরাসরি client component এ serialize হয় না।
 */
export type PipelineLead = {
  id: string;
  name: string;
  /** পাঠযোগ্য রূপ — e.g. `+971 50 123 4567` */
  phone: string;
  /** `tel:` লিংকের জন্য */
  phoneE164: string;
  stage: LeadStage;
  sourceLabel: string;
  assignedToName: string | null;
  followUpLabel: string | null;
  followUpTone: FollowUpTone | null;
  budgetLabel: string | null;
  lostReason: string | null;
  /** প্রবাসী ব্যাজ — দেশ সেট করা থাকলে (PRD সেকশন ৫.১, প্রবাসী-কেন্দ্রিক নোট) */
  residence: { flag: string; label: string } | null;
  /** সংযুক্ত ফাইলের সংখ্যা — ০ হলে কার্ডে আইকন দেখানো হয় না */
  documentCount: number;
  /** Won এ কনভার্ট হয়ে সেল তৈরি হলে — নইলে null (কার্ডে "সেল কনফার্ম" অপশন দেখায়) */
  sale: { status: SaleStatus; unitLabel: string; amountLabel: string } | null;
  /** এডিট ডায়ালগ যেন আবার ফেচ ছাড়াই খুলতে পারে */
  editable: EditableLead;
};
