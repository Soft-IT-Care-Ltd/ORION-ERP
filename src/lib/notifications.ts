import { prisma } from '@/lib/prisma';

/**
 * In-app notification (Phase 6 এ email/SMS চ্যানেল যোগ হবে — PRD সেকশন ৫.৬)।
 */
export type NotificationType =
  | 'FOLLOW_UP_DUE'
  | 'PAYMENT_DUE'
  | 'PAYMENT_OVERDUE'
  | 'PHASE_MILESTONE'
  | 'DOCUMENT_UPLOADED'
  | 'LEAD_ASSIGNED'
  | 'SALE_DRAFT_CREATED';

export async function notify(params: { userId: string; type: NotificationType; message: string }) {
  return prisma.notification.create({
    data: { userId: params.userId, type: params.type, message: params.message },
  });
}

/**
 * একই মেসেজ একাধিক ইউজারকে (যেমন সব Accounts + Admin কে ড্রাফট সেলের খবর)।
 * খালি তালিকায় কিছুই লেখে না।
 */
export async function notifyMany(params: {
  userIds: string[];
  type: NotificationType;
  message: string;
}) {
  if (params.userIds.length === 0) return;
  return prisma.notification.createMany({
    data: params.userIds.map((userId) => ({
      userId,
      type: params.type,
      message: params.message,
    })),
  });
}

export async function markAsRead(notificationId: string) {
  return prisma.notification.update({
    where: { id: notificationId },
    data: { readStatus: true },
  });
}
