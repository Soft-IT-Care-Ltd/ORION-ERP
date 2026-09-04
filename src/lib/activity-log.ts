import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

/**
 * প্রতিটি critical action (payment entry, stage change, phase update) এখানে লগ হবে।
 * CLAUDE.md নিয়ম ৪ + PRD সেকশন ৭ (Audit trail)।
 */
export async function logActivity(params: {
  entityType: string; // "Lead" | "Payment" | "Phase" ...
  entityId: string;
  userId: string;
  action: string; // "STAGE_CHANGED" | "PAYMENT_RECEIVED" ...
  metadata?: Prisma.InputJsonValue;
}) {
  return prisma.activityLog.create({
    data: {
      entityType: params.entityType,
      entityId: params.entityId,
      userId: params.userId,
      action: params.action,
      metadata: params.metadata,
    },
  });
}
