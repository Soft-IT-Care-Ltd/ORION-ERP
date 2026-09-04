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
  | 'LEAD_ASSIGNED';

export async function notify(params: { userId: string; type: NotificationType; message: string }) {
  return prisma.notification.create({
    data: { userId: params.userId, type: params.type, message: params.message },
  });
}

export async function markAsRead(notificationId: string) {
  return prisma.notification.update({
    where: { id: notificationId },
    data: { readStatus: true },
  });
}
