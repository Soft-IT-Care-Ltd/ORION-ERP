import { z } from 'zod';
import { DOCUMENT_TYPES } from '@/lib/documents';
import { id, optionalText } from './common';

/**
 * সেল ডকুমেন্ট আপলোডের মেটাডেটা — PRD সেকশন ৫.৪ ও ৫.৫।
 * ফাইল নিজে আলাদাভাবে যাচাই হয় (`lib/upload.ts` — সাইজ, এক্সটেনশন, MIME)।
 */
export const uploadSaleDocumentSchema = z.object({
  saleId: id,
  // `Document.type` স্কিমাতে ফ্রি-টেক্সট, কিন্তু ফর্ম থেকে শুধু canonical তালিকাই
  // নেওয়া হয় — নইলে একই কাগজ নানা বানানে ঢুকে গ্রুপিং ভেঙে যেত
  type: z.enum(DOCUMENT_TYPES, {
    errorMap: () => ({ message: 'ডকুমেন্টের ধরন নির্বাচন করুন' }),
  }),
  description: optionalText(300, 'বিবরণ খুব বড় হয়ে গেছে'),
});

export type UploadSaleDocumentInput = z.infer<typeof uploadSaleDocumentSchema>;
