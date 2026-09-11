import { format } from 'date-fns';
import { prisma } from '@/lib/prisma';
import {
  summarizePhases,
  toPhaseView,
  type PhaseSummary,
  type PhaseUpdateItem,
  type PhaseView,
} from '@/lib/phases';

/**
 * একটি প্রজেক্টের পুরো ফেজ টাইমলাইন — Admin, Engineer ও Customer, তিন প্যানেলেই
 * একই ডেটা লাগে, তাই কুয়েরিটা এক জায়গায়।
 *
 * এটি server-only (`lib/prisma` import করে) — client component থেকে import নয়;
 * বিশুদ্ধ হিসাব ও লেবেল `lib/phases.ts` এ আছে।
 */

/** এক প্রজেক্টে এতগুলোর বেশি আপডেট বাস্তবে হয় না — অসীম কুয়েরি ঠেকানোর সীমা */
const MAX_UPDATES = 100;

export type ProjectTimeline = {
  phases: PhaseView[];
  summary: PhaseSummary;
  updates: PhaseUpdateItem[];
};

export async function loadProjectTimeline(
  projectId: string,
  now: Date,
): Promise<ProjectTimeline> {
  const phases = await prisma.phase.findMany({
    where: { projectId },
    select: {
      id: true,
      name: true,
      order: true,
      percentComplete: true,
      plannedStart: true,
      plannedEnd: true,
      actualStart: true,
      actualEnd: true,
      delayReason: true,
    },
    orderBy: { order: 'asc' },
  });

  const updateRows = await prisma.phaseUpdate.findMany({
    where: { phase: { projectId } },
    select: {
      id: true,
      phaseId: true,
      percentComplete: true,
      note: true,
      photoUrls: true,
      createdAt: true,
      phase: { select: { name: true } },
      updatedBy: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: MAX_UPDATES,
  });

  // ফেজভিত্তিক আপডেট ও ছবির সংখ্যা — টাইমলাইনের ব্যাজে দেখানোর জন্য
  const counts = new Map<string, { updates: number; photos: number }>();
  for (const row of updateRows) {
    const current = counts.get(row.phaseId) ?? { updates: 0, photos: 0 };
    counts.set(row.phaseId, {
      updates: current.updates + 1,
      photos: current.photos + row.photoUrls.length,
    });
  }

  return {
    phases: phases.map((phase) => toPhaseView(phase, now, counts.get(phase.id))),
    summary: summarizePhases(phases, now),
    updates: updateRows.map((row) => ({
      id: row.id,
      phaseName: row.phase.name,
      percentComplete: row.percentComplete,
      note: row.note,
      photoUrls: row.photoUrls,
      authorName: row.updatedBy.name,
      createdAtLabel: format(row.createdAt, 'dd MMM yyyy, h:mm a'),
    })),
  };
}
