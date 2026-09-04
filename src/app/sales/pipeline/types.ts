import type { LeadStage } from '@prisma/client';
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
  phone: string;
  stage: LeadStage;
  sourceLabel: string;
  assignedToName: string | null;
  followUpLabel: string | null;
  followUpTone: FollowUpTone | null;
  budgetLabel: string | null;
  lostReason: string | null;
  /** এডিট ডায়ালগ যেন আবার ফেচ ছাড়াই খুলতে পারে */
  editable: EditableLead;
};
