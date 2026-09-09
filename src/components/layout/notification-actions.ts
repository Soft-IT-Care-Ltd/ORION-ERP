'use server';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { id as idSchema } from '@/lib/validations/common';
import {
  loadNotifications,
  markAllAsRead,
  markAsRead,
  type NotificationFeed,
} from '@/lib/notifications';

/**
 * নোটিফিকেশন বেলের server action গুলো — PRD সেকশন ৫.৬।
 *
 * প্রতিটিতে সেশন থেকেই userId নেওয়া হয়, ক্লায়েন্ট থেকে নয় — নইলে অন্যের
 * নোটিফিকেশন পড়া বা পড়া-চিহ্নিত করা যেত। নিষ্ক্রিয় অ্যাকাউন্টও কিছু পাবে না
 * (`PanelShell` একই যাচাই করে)।
 */
async function currentUserId(): Promise<string | null> {
  const session = await auth();
  if (!session?.user) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, active: true },
  });
  return user?.active ? user.id : null;
}

const EMPTY: NotificationFeed = { items: [], unreadCount: 0 };

/** বেল খুললে ও পোলিংয়ে — সাম্প্রতিক তালিকা আবার আনা */
export async function fetchNotifications(): Promise<NotificationFeed> {
  const userId = await currentUserId();
  if (!userId) return EMPTY;
  return loadNotifications(userId);
}

export async function readNotification(id: string): Promise<NotificationFeed> {
  const userId = await currentUserId();
  if (!userId) return EMPTY;

  // ক্লায়েন্ট থেকে আসা কাঁচা id — Prisma তে বসানোর আগে যাচাই
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return loadNotifications(userId);

  await markAsRead(parsed.data, userId);
  return loadNotifications(userId);
}

export async function readAllNotifications(): Promise<NotificationFeed> {
  const userId = await currentUserId();
  if (!userId) return EMPTY;

  await markAllAsRead(userId);
  return loadNotifications(userId);
}
