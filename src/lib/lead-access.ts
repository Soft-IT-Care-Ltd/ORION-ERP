import type { Prisma, Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { can } from '@/lib/rbac';

/**
 * লিড ownership — PRD সেকশন ৪:
 * ADMIN সব লিড দেখে, MARKETING শুধু নিজের assigned লিড।
 *
 * প্রতিটি lead query তে এই where-clause টি spread করতে হবে, যাতে অন্যের লিড
 * URL/id গেস করেও দেখা বা এডিট করা না যায়।
 */
export function leadScope(user: { id: string; role: Role }): Prisma.LeadWhereInput {
  return can(user.role, 'lead:viewAll') ? {} : { assignedToId: user.id };
}

/** এই ইউজার কি লিডটি দেখতে/এডিট করতে পারবে? না পারলে null */
export async function findScopedLead(user: { id: string; role: Role }, leadId: string) {
  return prisma.lead.findFirst({
    where: { id: leadId, ...leadScope(user) },
    select: { id: true, name: true, stage: true, assignedToId: true },
  });
}

/**
 * লিড কাকে assign করা যাবে — যাদের `lead:viewOwn`/`lead:edit` আছে (MARKETING),
 * সঙ্গে ADMIN (নিজে হ্যান্ডেল করলে)। শুধু সক্রিয় ইউজার।
 */
export function findAssignableExecutives() {
  return prisma.user.findMany({
    where: { active: true, role: { in: ['MARKETING', 'ADMIN'] } },
    select: { id: true, name: true, role: true },
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
  });
}
