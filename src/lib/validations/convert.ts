import { z } from 'zod';
import { id, nullableDate, optionalEmail, positiveAmount } from './common';
import { ratePerSqft, totalSqft } from './project';

/**
 * Lead → Project কনভার্শনের ইনপুট যাচাই (PRD সেকশন ৫.৩)।
 *
 * v2 তে "Won" মানে কন্ট্রাক্ট সাইন + প্রথম কনস্ট্রাকশন পেমেন্ট — তাই ফর্মে
 * কন্ট্রাক্ট ভ্যালু, per-sqft রেট, আয়তন ও শুরুর তারিখ নেওয়া হয়।
 */
export const convertLeadSchema = z.object({
  leadId: id,
  totalContractValue: positiveAmount({
    message: 'সঠিক কন্ট্রাক্ট ভ্যালু দিন',
    maxMessage: 'অঙ্কটি অস্বাভাবিক বেশি — যাচাই করুন',
    round: true,
  }),
  ratePerSqft,
  totalSqft,
  startDate: nullableDate,
  /** না দিলে লিডের ইমেইল, তাও না থাকলে placeholder তৈরি হয় */
  customerEmail: optionalEmail,
});

export type ConvertLeadInput = z.infer<typeof convertLeadSchema>;
