'use server';

import { revalidatePath } from 'next/cache';
import { Prisma, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import type { ZodError } from 'zod';
import { prisma } from '@/lib/prisma';
import { getAuthorizedUser } from '@/lib/guards';
import { logActivity } from '@/lib/activity-log';
import {
  createUserSchema,
  resetPasswordSchema,
  toggleActiveSchema,
  updateUserSchema,
} from '@/lib/validations/user';

export type ActionResult =
  | { ok: true; message: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };

const FORBIDDEN: ActionResult = {
  ok: false,
  message: 'এই কাজটি করার অনুমতি আপনার নেই',
};

function zodErrors(error: ZodError): Record<string, string> {
  return Object.fromEntries(
    error.issues.map((issue) => [String(issue.path[0] ?? '_'), issue.message]),
  );
}

/** সিস্টেমে অন্তত একজন সক্রিয় ADMIN থাকতেই হবে */
async function isLastActiveAdmin(userId: string) {
  const count = await prisma.user.count({
    where: { role: Role.ADMIN, active: true, id: { not: userId } },
  });
  return count === 0;
}

export async function createUser(formData: FormData): Promise<ActionResult> {
  const admin = await getAuthorizedUser('user:manage');
  if (!admin) return FORBIDDEN;

  const parsed = createUserSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    phone: formData.get('phone'),
    role: formData.get('role'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return { ok: false, message: 'ইনপুট সঠিক নয়', fieldErrors: zodErrors(parsed.error) };
  }

  const { name, email, phone, role, password } = parsed.data;
  const passwordHash = await bcrypt.hash(password, 10);

  try {
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { name, email, phone: phone || null, role, passwordHash },
      });

      // CUSTOMER role এর ইউজারের জন্য Customer প্রোফাইলও দরকার (Sale এর FK)
      if (role === Role.CUSTOMER) {
        await tx.customer.create({ data: { userId: created.id } });
      }

      return created;
    });

    await logActivity({
      entityType: 'User',
      entityId: user.id,
      userId: admin.id,
      action: 'USER_CREATED',
      metadata: { email: user.email, role: user.role },
    });

    revalidatePath('/admin/users');
    return { ok: true, message: `${name} যোগ করা হয়েছে` };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return {
        ok: false,
        message: 'এই ইমেইলে ইতিমধ্যে একটি অ্যাকাউন্ট আছে',
        fieldErrors: { email: 'ইমেইলটি ব্যবহৃত হয়েছে' },
      };
    }
    console.error('createUser failed', error);
    return { ok: false, message: 'ইউজার তৈরি করা যায়নি' };
  }
}

export async function updateUser(formData: FormData): Promise<ActionResult> {
  const admin = await getAuthorizedUser('user:manage');
  if (!admin) return FORBIDDEN;

  const parsed = updateUserSchema.safeParse({
    id: formData.get('id'),
    name: formData.get('name'),
    email: formData.get('email'),
    phone: formData.get('phone'),
    role: formData.get('role'),
  });
  if (!parsed.success) {
    return { ok: false, message: 'ইনপুট সঠিক নয়', fieldErrors: zodErrors(parsed.error) };
  }

  const { id, name, email, phone, role } = parsed.data;

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true, customer: { select: { id: true } } },
  });
  if (!target) return { ok: false, message: 'ইউজার খুঁজে পাওয়া যায়নি' };

  const roleChanged = target.role !== role;

  if (roleChanged) {
    if (target.id === admin.id) {
      return { ok: false, message: 'নিজের role নিজে পরিবর্তন করা যাবে না' };
    }
    if (target.role === Role.ADMIN && (await isLastActiveAdmin(target.id))) {
      return { ok: false, message: 'সিস্টেমে অন্তত একজন সক্রিয় অ্যাডমিন থাকতে হবে' };
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: { name, email, phone: phone || null, role },
      });

      if (role === Role.CUSTOMER && !target.customer) {
        await tx.customer.create({ data: { userId: id } });
      }
    });

    await logActivity({
      entityType: 'User',
      entityId: id,
      userId: admin.id,
      action: roleChanged ? 'USER_ROLE_CHANGED' : 'USER_UPDATED',
      metadata: roleChanged ? { from: target.role, to: role } : { name, email },
    });

    revalidatePath('/admin/users');
    return {
      ok: true,
      message: roleChanged
        ? `${name} এর role পরিবর্তন হয়েছে (পরের লগইনে সম্পূর্ণ কার্যকর হবে)`
        : `${name} আপডেট হয়েছে`,
    };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return {
        ok: false,
        message: 'এই ইমেইলে ইতিমধ্যে একটি অ্যাকাউন্ট আছে',
        fieldErrors: { email: 'ইমেইলটি ব্যবহৃত হয়েছে' },
      };
    }
    console.error('updateUser failed', error);
    return { ok: false, message: 'আপডেট করা যায়নি' };
  }
}

export async function setUserActive(input: { id: string; active: boolean }): Promise<ActionResult> {
  const admin = await getAuthorizedUser('user:manage');
  if (!admin) return FORBIDDEN;

  const parsed = toggleActiveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: 'ইনপুট সঠিক নয়' };

  const { id, active } = parsed.data;

  if (id === admin.id && !active) {
    return { ok: false, message: 'নিজের অ্যাকাউন্ট নিজে নিষ্ক্রিয় করা যাবে না' };
  }

  const target = await prisma.user.findUnique({
    where: { id },
    select: { name: true, role: true },
  });
  if (!target) return { ok: false, message: 'ইউজার খুঁজে পাওয়া যায়নি' };

  if (!active && target.role === Role.ADMIN && (await isLastActiveAdmin(id))) {
    return { ok: false, message: 'সিস্টেমে অন্তত একজন সক্রিয় অ্যাডমিন থাকতে হবে' };
  }

  await prisma.user.update({ where: { id }, data: { active } });

  await logActivity({
    entityType: 'User',
    entityId: id,
    userId: admin.id,
    action: active ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
  });

  revalidatePath('/admin/users');
  return {
    ok: true,
    message: `${target.name} কে ${active ? 'সক্রিয়' : 'নিষ্ক্রিয়'} করা হয়েছে`,
  };
}

export async function resetPassword(formData: FormData): Promise<ActionResult> {
  const admin = await getAuthorizedUser('user:manage');
  if (!admin) return FORBIDDEN;

  const parsed = resetPasswordSchema.safeParse({
    id: formData.get('id'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return { ok: false, message: 'ইনপুট সঠিক নয়', fieldErrors: zodErrors(parsed.error) };
  }

  const { id, password } = parsed.data;

  const target = await prisma.user.findUnique({ where: { id }, select: { name: true } });
  if (!target) return { ok: false, message: 'ইউজার খুঁজে পাওয়া যায়নি' };

  await prisma.user.update({
    where: { id },
    data: { passwordHash: await bcrypt.hash(password, 10) },
  });

  await logActivity({
    entityType: 'User',
    entityId: id,
    userId: admin.id,
    action: 'USER_PASSWORD_RESET',
  });

  revalidatePath('/admin/users');
  return { ok: true, message: `${target.name} এর পাসওয়ার্ড পরিবর্তন হয়েছে` };
}
