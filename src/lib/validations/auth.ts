import { z } from 'zod';

/** ক্লায়েন্ট ও সার্ভার — দুই জায়গাতেই ব্যবহৃত হয়, তাই server-only import মুক্ত রাখা হয়েছে */
export const credentialsSchema = z.object({
  email: z.string().email('সঠিক ইমেইল দিন'),
  password: z.string().min(6, 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে'),
});

export type CredentialsInput = z.infer<typeof credentialsSchema>;
