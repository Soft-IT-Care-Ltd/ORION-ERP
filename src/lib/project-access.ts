import type { Prisma, Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { can } from '@/lib/rbac';

/**
 * প্রজেক্ট ownership — PRD সেকশন ৪ (Permission Matrix):
 * ADMIN সব প্রজেক্ট দেখে ও ম্যানেজ করে, ENGINEER শুধু তার **assigned project** এর
 * ফেজ আপডেট করতে পারে।
 *
 * v2 তে এক প্রজেক্ট = এক ক্লায়েন্টের কনস্ট্রাকশন জব (আগের Unit স্তরটি নেই), তাই
 * scope টিও সরাসরি Project এর উপরেই।
 *
 * `lib/lead-access.ts` এর মতোই প্রতিটি কুয়েরিতে এই where-clause spread করতে হবে,
 * যাতে অন্য সাইটের প্রজেক্ট id গেস করেও আপডেট করা না যায়।
 */

type Actor = { id: string; role: Role };

export function projectScope(user: Actor): Prisma.ProjectWhereInput {
  return can(user.role, 'project:manage') ? {} : { engineerId: user.id };
}

/** এই ইউজার কি প্রজেক্টটির ফেজ দেখতে/আপডেট করতে পারবে? না পারলে null */
export async function findScopedProject(user: Actor, projectId: string) {
  return prisma.project.findFirst({
    where: { id: projectId, ...projectScope(user) },
    select: {
      id: true,
      title: true,
      landLocation: true,
      buildingType: true,
      floors: true,
      status: true,
      startDate: true,
      engineerId: true,
      lead: { select: { id: true, name: true, phone: true } },
      customer: { select: { user: { select: { name: true, phone: true } } } },
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

/** প্রজেক্টের অগ্রগতি হিসাব করার জন্য ন্যূনতম ফিল্ড (লিস্ট পেজে) */
export const phaseProgressSelect = {
  id: true,
  name: true,
  order: true,
  percentComplete: true,
  plannedStart: true,
  plannedEnd: true,
} satisfies Prisma.PhaseSelect;
