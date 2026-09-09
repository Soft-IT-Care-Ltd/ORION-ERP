import { z } from 'zod';
import { id, optionalEmail, positiveAmount } from './common';

/**
 * Lead → Sale কনভার্শনের ইনপুট যাচাই (PRD সেকশন ৫.১)।
 * ফর্মটি ছোট — ইউনিট, চূড়ান্ত মূল্য, আর কাস্টমার পোর্টালের ইমেইল।
 */

export const convertLeadSchema = z.object({
  leadId: id,
  unitId: z.string().trim().min(1, 'ইউনিট নির্বাচন করুন'),
  totalAmount: positiveAmount({
    message: 'সঠিক মূল্য দিন',
    maxMessage: 'মূল্য অস্বাভাবিক বেশি — যাচাই করুন',
  }),
  /** না দিলে লিডের ইমেইল, তাও না থাকলে placeholder তৈরি হয় */
  customerEmail: optionalEmail,
});

export type ConvertLeadInput = z.infer<typeof convertLeadSchema>;
