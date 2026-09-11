import { z } from 'zod';
import { id, optionalText, requiredText } from './common';

/**
 * Lead checklist এর ইনপুট যাচাই — PRD সেকশন ৫.১।
 * তালিকা fixed নয়, তাই label ফ্রি-টেক্সট; quick-add বোতামগুলোও এই স্কিমাই ব্যবহার করে।
 */
export const addChecklistItemSchema = z.object({
  leadId: id,
  label: requiredText(2, 160, 'কাজের নাম কমপক্ষে ২ অক্ষরের হতে হবে', 'নামটি খুব বড় হয়ে গেছে'),
  note: optionalText(500, 'নোট খুব বড় হয়ে গেছে'),
});

export const toggleChecklistItemSchema = z.object({
  id,
  /** true হলে DONE (doneBy/doneAt বসবে), false হলে আবার PENDING */
  done: z.boolean(),
});

export const checklistItemIdSchema = z.object({ id });

export type AddChecklistItemInput = z.infer<typeof addChecklistItemSchema>;
