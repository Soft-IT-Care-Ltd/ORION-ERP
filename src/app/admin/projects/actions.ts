'use server';

import { revalidatePath } from 'next/cache';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getAuthorizedUser } from '@/lib/guards';
import { logActivity } from '@/lib/activity-log';
import { notify } from '@/lib/notifications';
import { type ActionResult, FORBIDDEN, NOT_FOUND, zodErrors } from '@/lib/action-result';
import { planPhaseDates } from '@/lib/phases';
import {
  applyTemplateSchema,
  projectIdSchema,
  savePhaseTemplateSchema,
  updateProjectSchema,
} from '@/lib/validations/project';

export type { ActionResult } from '@/lib/action-result';

/**
 * v2 তে Project **তৈরি** হয় শুধু Lead → Won কনভার্শনে
 * (`app/sales/leads/convert-actions.ts`) — এক ক্লায়েন্ট = এক প্রজেক্ট, তাই আলাদা
 * "নতুন প্রজেক্ট" ফর্ম নেই। এখানে তৈরি-পরবর্তী কাজগুলো: এডিট, ফেজ টেমপ্লেট প্রয়োগ,
 * আর গ্লোবাল টেমপ্লেট সেভ।
 */

/** প্রজেক্ট বদলালে যেসব প্যানেলের ডেটা বাসি হয় */
function revalidateProject(projectId?: string) {
  revalidatePath('/admin/projects');
  if (projectId) revalidatePath(`/admin/projects/${projectId}`);
  revalidatePath('/admin');
  revalidatePath('/engineer');
  revalidatePath('/engineer/sites');
  revalidatePath('/customer');
  revalidatePath('/customer/progress');
}

/** এই প্রজেক্টের দায়িত্বপ্রাপ্ত ইঞ্জিনিয়ারকে (থাকলে) জানানো */
async function notifyEngineer(engineerId: string | null, message: string, actorId: string) {
  if (!engineerId || engineerId === actorId) return;
  await notify({ userId: engineerId, type: 'PHASE_MILESTONE', message, link: '/engineer/sites' });
}

/* ------------------------------------------------------------- project */

export async function updateProject(formData: FormData): Promise<ActionResult> {
  const admin = await getAuthorizedUser('project:manage');
  if (!admin) return FORBIDDEN;

  const parsed = updateProjectSchema.safeParse({
    id: formData.get('id'),
    title: formData.get('title'),
    landLocation: formData.get('landLocation'),
    buildingType: formData.get('buildingType'),
    floors: formData.get('floors'),
    totalSqft: formData.get('totalSqft'),
    ratePerSqft: formData.get('ratePerSqft'),
    totalContractValue: formData.get('totalContractValue'),
    startDate: formData.get('startDate'),
    cameraStreamUrl: formData.get('cameraStreamUrl'),
    status: formData.get('status'),
    engineerId: formData.get('engineerId'),
  });
  if (!parsed.success) {
    return { ok: false, message: 'ইনপুট সঠিক নয়', fieldErrors: zodErrors(parsed.error) };
  }

  const { id, ...data } = parsed.data;

  const existing = await prisma.project.findUnique({
    where: { id },
    select: { id: true, title: true, engineerId: true, cameraStreamUrl: true },
  });
  if (!existing) return NOT_FOUND;

  try {
    await prisma.project.update({
      where: { id },
      data: {
        ...data,
        totalContractValue: new Prisma.Decimal(data.totalContractValue),
        totalSqft: data.totalSqft === null ? null : new Prisma.Decimal(data.totalSqft),
        ratePerSqft: data.ratePerSqft === null ? null : new Prisma.Decimal(data.ratePerSqft),
      },
    });

    await logActivity({
      entityType: 'Project',
      entityId: id,
      userId: admin.id,
      action: 'PROJECT_UPDATED',
      metadata: {
        title: data.title,
        status: data.status,
        engineerId: data.engineerId,
        totalContractValue: String(data.totalContractValue),
        // ক্যামেরার লিংক বদলানো হলে সেটি আলাদা করে দেখা যায় (কাস্টমারের ভিউ বদলায়)
        cameraChanged: existing.cameraStreamUrl !== data.cameraStreamUrl,
      },
    });

    if (data.engineerId && data.engineerId !== existing.engineerId) {
      await notifyEngineer(data.engineerId, `নতুন সাইট অ্যাসাইন করা হয়েছে — ${data.title}`, admin.id);
    }

    revalidateProject(id);
    return { ok: true, message: `${data.title} আপডেট হয়েছে` };
  } catch (error) {
    console.error('updateProject failed', error);
    return { ok: false, message: 'আপডেট করা যায়নি' };
  }
}

/**
 * প্রজেক্ট মোছা। পেমেন্ট এসে গেলে বা ডকুমেন্ট জমা থাকলে মোছা যায় না — হিসাবের
 * ইতিহাস হারিয়ে যেত। ফেজ ও ফেজ-আপডেট ডাটাবেসেই cascade হয়; লিডটি Won এ থেকে
 * যায় না, আবার পাইপলাইনে ফেরত যায় (Negotiation) যাতে সেটি অনাথ না থাকে।
 */
export async function deleteProject(input: { id: string }): Promise<ActionResult> {
  const admin = await getAuthorizedUser('project:manage');
  if (!admin) return FORBIDDEN;

  // server action সরাসরি ডাকা যায় — id টাও যাচাই করে তবেই কুয়েরি
  const parsed = projectIdSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: 'ইনপুট সঠিক নয়', fieldErrors: zodErrors(parsed.error) };
  }

  const project = await prisma.project.findUnique({
    where: { id: parsed.data.id },
    select: {
      id: true,
      title: true,
      leadId: true,
      _count: { select: { documents: true } },
      paymentPlan: {
        select: {
          id: true,
          installments: { select: { _count: { select: { payments: true } } } },
        },
      },
    },
  });
  if (!project) return NOT_FOUND;

  const paymentCount = (project.paymentPlan?.installments ?? []).reduce(
    (sum, installment) => sum + installment._count.payments,
    0,
  );
  if (paymentCount > 0) {
    return {
      ok: false,
      message: `মোছা যাবে না — এই প্রজেক্টে ${paymentCount} টি পেমেন্ট এন্ট্রি আছে`,
    };
  }
  if (project._count.documents > 0) {
    return {
      ok: false,
      message: `মোছা যাবে না — ${project._count.documents} টি ডকুমেন্ট যুক্ত আছে`,
    };
  }

  try {
    await prisma.$transaction([
      // Installment → PaymentPlan cascade, Phase → Project cascade (schema)
      ...(project.paymentPlan
        ? [prisma.paymentPlan.delete({ where: { id: project.paymentPlan.id } })]
        : []),
      prisma.project.delete({ where: { id: project.id } }),
      // লিডটি আবার পাইপলাইনে — নইলে Won অবস্থায় প্রজেক্টহীন হয়ে আটকে থাকত
      prisma.lead.update({ where: { id: project.leadId }, data: { stage: 'NEGOTIATION' } }),
    ]);

    await logActivity({
      entityType: 'Project',
      entityId: project.id,
      userId: admin.id,
      action: 'PROJECT_DELETED',
      metadata: { title: project.title, leadId: project.leadId },
    });

    revalidateProject();
    revalidatePath('/sales/pipeline');
    revalidatePath(`/sales/leads/${project.leadId}`);
    return {
      ok: true,
      message: `${project.title} মুছে ফেলা হয়েছে — লিডটি দরদাম স্টেজে ফেরত গেছে`,
    };
  } catch (error) {
    console.error('deleteProject failed', error);
    return { ok: false, message: 'প্রজেক্ট মোছা যায়নি' };
  }
}

/* ------------------------------------------------------- phase template */

/**
 * গ্লোবাল টেমপ্লেটের পুরো তালিকা একবারে সেভ (ক্রম = তালিকার ক্রম)।
 *
 * টেমপ্লেট হলো *ব্লুপ্রিন্ট* — Lead → Project কনভার্শনের সময় (বা "টেমপ্লেট প্রয়োগ"
 * চাপলে) এটি থেকে Phase তৈরি হয়। আগে তৈরি হয়ে যাওয়া প্রজেক্টের ফেজ এতে বদলায় না,
 * কারণ সেখানে ইঞ্জিনিয়ারের অগ্রগতি ও ছবি জমা আছে।
 */
export async function savePhaseTemplate(input: {
  phases: { name: string; defaultDurationDays: string | number }[];
}): Promise<ActionResult> {
  const admin = await getAuthorizedUser('project:manage');
  if (!admin) return FORBIDDEN;

  const parsed = savePhaseTemplateSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, message: issue?.message ?? 'ইনপুট সঠিক নয়' };
  }

  const { phases } = parsed.data;

  try {
    await prisma.$transaction([
      prisma.phaseTemplate.deleteMany({}),
      prisma.phaseTemplate.createMany({
        data: phases.map((p, index) => ({
          name: p.name,
          order: index + 1,
          defaultDurationDays: p.defaultDurationDays,
        })),
      }),
    ]);

    await logActivity({
      entityType: 'PhaseTemplate',
      entityId: 'global',
      userId: admin.id,
      action: 'PHASE_TEMPLATE_SAVED',
      metadata: { phaseCount: phases.length, names: phases.map((p) => p.name) },
    });

    revalidatePath('/admin/phase-templates');
    revalidateProject();
    return { ok: true, message: `ফেজ টেমপ্লেট সেভ হয়েছে (${phases.length} টি ফেজ)` };
  } catch (error) {
    console.error('savePhaseTemplate failed', error);
    return { ok: false, message: 'টেমপ্লেট সেভ করা যায়নি' };
  }
}

/**
 * এখনো টাইমলাইন নেই এমন প্রজেক্টে গ্লোবাল টেমপ্লেট বসানো।
 * যেখানে আগেই ফেজ আছে সেটি ছোঁয়া হয় না — অগ্রগতি মুছে যেত।
 */
export async function applyTemplateToProject(input: {
  projectId: string;
  startDate?: string;
}): Promise<ActionResult> {
  const admin = await getAuthorizedUser('project:manage');
  if (!admin) return FORBIDDEN;

  const parsed = applyTemplateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: 'ইনপুট সঠিক নয়', fieldErrors: zodErrors(parsed.error) };
  }

  const { projectId, startDate } = parsed.data;

  const [project, templates] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        title: true,
        startDate: true,
        engineerId: true,
        _count: { select: { phases: true } },
      },
    }),
    prisma.phaseTemplate.findMany({
      select: { name: true, order: true, defaultDurationDays: true },
      orderBy: { order: 'asc' },
    }),
  ]);
  if (!project) return NOT_FOUND;

  if (templates.length === 0) {
    return { ok: false, message: 'আগে ফেজ টেমপ্লেট সেট করুন (Admin → ফেজ টেমপ্লেট)' };
  }
  if (project._count.phases > 0) {
    return { ok: false, message: 'এই প্রজেক্টে আগেই ফেজ টাইমলাইন আছে — নতুন কিছু তৈরি হয়নি' };
  }

  const dates = planPhaseDates(templates, startDate ?? project.startDate);

  try {
    await prisma.phase.createMany({
      data: templates.map((t, index) => ({
        projectId: project.id,
        name: t.name,
        order: t.order,
        plannedStart: dates[index].plannedStart,
        plannedEnd: dates[index].plannedEnd,
      })),
    });

    // শুরুর তারিখ আলাদা দেওয়া হলে সেটিই প্রজেক্টের startDate হয়ে যায়, নইলে
    // পরে টেমপ্লেট আবার প্রয়োগ করলে দুই রকম তারিখ বেরোত
    if (startDate && startDate.getTime() !== project.startDate?.getTime()) {
      await prisma.project.update({ where: { id: project.id }, data: { startDate } });
    }

    await logActivity({
      entityType: 'Project',
      entityId: projectId,
      userId: admin.id,
      action: 'PHASE_TEMPLATE_APPLIED',
      metadata: {
        phaseCount: templates.length,
        startDate: (startDate ?? project.startDate)?.toISOString() ?? null,
      },
    });

    await notifyEngineer(
      project.engineerId,
      `${project.title} — ${templates.length} টি ফেজ টাইমলাইন যোগ হয়েছে`,
      admin.id,
    );

    revalidateProject(projectId);
    return { ok: true, message: `${templates.length} টি ফেজ তৈরি হয়েছে` };
  } catch (error) {
    console.error('applyTemplateToProject failed', error);
    return { ok: false, message: 'টেমপ্লেট প্রয়োগ করা যায়নি' };
  }
}
