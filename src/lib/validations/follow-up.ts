import { z } from 'zod';
import { id, optionalDateString, requiredText } from './common';

/**
 * ফলো-আপ লগ (PRD সেকশন ৫.১ — Automation rules)।
 *
 * একটি সাবমিশনে দুটো কাজ হয়: একটি নতুন `LeadActivity` নোট, আর লিডের পরবর্তী
 * ফলো-আপ তারিখ হালনাগাদ। তারিখ খালি রাখলে "আর ফলো-আপ নেই" — তখন তারিখটি
 * মুছে যায়, যাতে লিডটি ফলো-আপ তালিকা থেকে সরে যায়।
 */
export const logFollowUpSchema = z.object({
  leadId: id,
  note: requiredText(2, 1000, 'নোট কমপক্ষে ২ অক্ষরের হতে হবে', 'নোট খুব বড় হয়ে গেছে'),
  nextFollowUpAt: optionalDateString,
});

export type LogFollowUpInput = z.infer<typeof logFollowUpSchema>;
