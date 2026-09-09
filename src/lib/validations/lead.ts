import { z } from 'zod';
import { toBangladeshiE164, toE164 } from '@/lib/phone';
import { baseLead, leadShapeRules, type BaseLead } from './lead-base';
import { id } from './common';

/**
 * লিড ফর্মের **server-side** স্কিমা।
 *
 * এই ফাইলটি শুধু server action থেকে import হয় — `lib/phone.ts` (libphonenumber)
 * client bundle এ যাওয়া ঠেকাতে। ফর্মের বাকি নিয়মগুলো `lead-base.ts` এ, যেটি
 * ক্লায়েন্টও ব্যবহার করে; ফলে দুই দিকে একই নিয়ম, শুধু সার্ভারে ফোনের যাচাইটা
 * বাড়তি।
 */

/** `lead-base.ts` এর client-safe স্কিমাগুলো — action গুলো এক জায়গা থেকেই নেয় */
export {
  addNoteSchema,
  changeStageSchema,
  leadFormSchema,
  updateLeadFormSchema,
  uploadDocumentSchema,
} from './lead-base';

/** ফোন নম্বরগুলো সত্যিই ওই দেশের বৈধ নম্বর কিনা (`lead-base` এ শুধু গঠন দেখা হয়) */
function leadPhoneRules(data: BaseLead, ctx: z.RefinementCtx) {
  // ফোন — country picker + লোকাল নম্বর মিলিয়ে E.164 হতে হবে (PRD সেকশন ৫.১)
  const phone = toE164(data.phoneNumber, data.phoneCountry);
  if (!phone.ok) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['phoneNumber'], message: phone.reason });
  }

  // লোকাল কন্টাক্ট বাংলাদেশে থাকা ব্যক্তি — নম্বরটি বাংলাদেশি হতে হবে
  if (data.localContactPhone !== undefined) {
    const local = toBangladeshiE164(data.localContactPhone);
    if (!local.ok) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['localContactPhone'],
        message: local.reason,
      });
    }
  }
}

function leadRules(data: BaseLead, ctx: z.RefinementCtx) {
  leadShapeRules(data, ctx);
  leadPhoneRules(data, ctx);
}

/**
 * ফোন নম্বরগুলো E.164 তে নামিয়ে আনে। `leadRules` পাস করার পরেই চলে
 * (Zod refinement ব্যর্থ হলে transform স্কিপ হয়) — তাই এখানে দুটোই valid।
 */
function normalizeLeadPhones<T extends BaseLead>(data: T) {
  return {
    ...data,
    phone: (toE164(data.phoneNumber, data.phoneCountry) as { e164: string }).e164,
    localContactPhone:
      data.localContactPhone === undefined
        ? undefined
        : (toBangladeshiE164(data.localContactPhone) as { e164: string }).e164,
  };
}

export const createLeadSchema = baseLead.superRefine(leadRules).transform(normalizeLeadPhones);

export const updateLeadSchema = baseLead
  .extend({ id })
  .superRefine(leadRules)
  .transform(normalizeLeadPhones);

export type CreateLeadInput = z.infer<typeof createLeadSchema>;
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;
