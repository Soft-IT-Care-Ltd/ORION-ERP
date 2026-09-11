import { z } from 'zod';
import { LedgerCategory, LedgerType } from '@prisma/client';
import { id, nullableId, optionalText, positiveAmount, requiredDate } from './common';

/**
 * LedgerEntry এর ইনপুট যাচাই — PRD সেকশন ৫.২ (pre-project billing ও internal cost)
 * এবং ৫.৬ (company ledger)। ফর্ম (client) ও server action — দুই জায়গাতেই একই স্কিমা।
 *
 * **গুরুত্বপূর্ণ:** `clientVisible` ফর্ম থেকে আসে না। EXPENSE এ সেটি কখনো true
 * হতে পারবে না (PRD সেকশন ৪ — client কখনো Orion এর খরচ দেখবে না), তাই মানটি
 * server action এ `type` থেকেই ঠিক করা হয় — ইনপুটে রাখা হয়নি যাতে কেউ সরাসরি
 * অ্যাকশন ডেকে true পাঠাতে না পারে।
 */
export const ledgerEntrySchema = z.object({
  /** খালি হলে company-wide general entry (PRD সেকশন ৫.৬) */
  leadId: nullableId,
  type: z.nativeEnum(LedgerType, { errorMap: () => ({ message: 'ধরন নির্বাচন করুন' }) }),
  category: z.nativeEnum(LedgerCategory, {
    errorMap: () => ({ message: 'ক্যাটেগরি নির্বাচন করুন' }),
  }),
  amount: positiveAmount({ message: 'সঠিক অঙ্ক দিন', round: true }),
  date: requiredDate,
  note: optionalText(500, 'নোট খুব বড় হয়ে গেছে'),
});

export const ledgerEntryIdSchema = z.object({ id });

export type LedgerEntryInput = z.infer<typeof ledgerEntrySchema>;
