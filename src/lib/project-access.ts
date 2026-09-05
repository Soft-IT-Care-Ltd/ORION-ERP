import type { Prisma, Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { can } from '@/lib/rbac';

/**
 * প্রজেক্ট/ইউনিট ownership — PRD সেকশন ৪ (Permission Matrix):
 * ADMIN সব প্রজেক্ট দেখে ও ম্যানেজ করে, ENGINEER শুধু তার **assigned project** এর
 * ফেজ আপডেট করতে পারে।
 *
 * `lib/lead-access.ts` এর মতোই প্রতিটি কুয়েরিতে এই where-clause spread করতে হবে,
 * যাতে অন্য সাইটের ইউনিট id গেস করেও আপডেট করা না যায়।
 */

type Actor = { id: string; role: Role };

export function projectScope(user: Actor): Prisma.ProjectWhereInput {
  return can(user.role, 'project:manage') ? {} : { engineerId: user.id };
}

export function unitScope(user: Actor): Prisma.UnitWhereInput {
  return can(user.role, 'project:manage') ? {} : { project: { engineerId: user.id } };
}

/** এই ইউজার কি ইউনিটটির ফেজ দেখতে/আপডেট করতে পারবে? না পারলে null */
export async function findScopedUnit(user: Actor, unitId: string) {
  return prisma.unit.findFirst({
    where: { id: unitId, ...unitScope(user) },
    select: {
      id: true,
      unitNo: true,
      project: { select: { id: true, name: true, location: true, engineerId: true } },
    },
  });
}

/**
 * প্রজেক্টে অ্যাসাইন করা যায় এমন ইউজার — সাইট ইঞ্জিনিয়ার, সঙ্গে ADMIN
 * (ছোট প্রজেক্টে অ্যাডমিন নিজেই সাইট দেখেন)। শুধু সক্রিয় অ্যাকাউন্ট।
 */
export function findAssignableEngineers() {
  return prisma.user.findMany({
    where: { active: true, role: { in: ['ENGINEER', 'ADMIN'] } },
    select: { id: true, name: true, role: true },
    orderBy: [{ role: 'desc' }, { name: 'asc' }],
  });
}

/** টাইমলাইন দেখানোর জন্য দরকারি ফেজ ফিল্ডগুলো — সব প্যানেলে একই select */
export const phaseTimelineSelect = {
  id: true,
  name: true,
  order: true,
  status: true,
  percentComplete: true,
  plannedStart: true,
  plannedEnd: true,
  actualStart: true,
  actualEnd: true,
  delayReason: true,
  _count: { select: { updates: true } },
} satisfies Prisma.PhaseSelect;

export type PhaseTimelineRow = Prisma.PhaseGetPayload<{ select: typeof phaseTimelineSelect }>;

/** ইউনিটের অগ্রগতি হিসাব করার জন্য ন্যূনতম ফিল্ড (লিস্ট পেজে) */
export const phaseProgressSelect = {
  id: true,
  name: true,
  order: true,
  percentComplete: true,
  plannedStart: true,
  plannedEnd: true,
} satisfies Prisma.PhaseSelect;
