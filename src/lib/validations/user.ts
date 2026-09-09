import { z } from 'zod';
import { ROLES } from '@/lib/rbac';
import { id, requiredEmail, requiredText } from './common';

const roleSchema = z.enum(ROLES, { errorMap: () => ({ message: 'role নির্বাচন করুন' }) });

/** বাংলাদেশি মোবাইল নম্বর: 01XXXXXXXXX */
const phoneSchema = z
  .string()
  .trim()
  .regex(/^01[3-9]\d{8}$/, 'সঠিক মোবাইল নম্বর দিন (যেমন 01711223344)')
  .optional()
  .or(z.literal(''));

const passwordSchema = z.string().min(8, 'পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে');

const nameSchema = requiredText(2, 80, 'নাম কমপক্ষে ২ অক্ষরের হতে হবে');

export const createUserSchema = z.object({
  name: nameSchema,
  email: requiredEmail,
  phone: phoneSchema,
  role: roleSchema,
  password: passwordSchema,
});

export const updateUserSchema = z.object({
  id,
  name: nameSchema,
  email: requiredEmail,
  phone: phoneSchema,
  role: roleSchema,
});

export const resetPasswordSchema = z.object({ id, password: passwordSchema });

export const toggleActiveSchema = z.object({ id, active: z.boolean() });

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
