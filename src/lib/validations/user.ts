import { z } from 'zod';
import { ROLES } from '@/lib/rbac';

const roleSchema = z.enum(ROLES, { errorMap: () => ({ message: 'role নির্বাচন করুন' }) });

/** বাংলাদেশি মোবাইল নম্বর: 01XXXXXXXXX */
const phoneSchema = z
  .string()
  .trim()
  .regex(/^01[3-9]\d{8}$/, 'সঠিক মোবাইল নম্বর দিন (যেমন 01711223344)')
  .optional()
  .or(z.literal(''));

const passwordSchema = z.string().min(8, 'পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে');

export const createUserSchema = z.object({
  name: z.string().trim().min(2, 'নাম কমপক্ষে ২ অক্ষরের হতে হবে').max(80),
  email: z.string().trim().toLowerCase().email('সঠিক ইমেইল দিন'),
  phone: phoneSchema,
  role: roleSchema,
  password: passwordSchema,
});

export const updateUserSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(2, 'নাম কমপক্ষে ২ অক্ষরের হতে হবে').max(80),
  email: z.string().trim().toLowerCase().email('সঠিক ইমেইল দিন'),
  phone: phoneSchema,
  role: roleSchema,
});

export const resetPasswordSchema = z.object({
  id: z.string().min(1),
  password: passwordSchema,
});

export const toggleActiveSchema = z.object({
  id: z.string().min(1),
  active: z.boolean(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
