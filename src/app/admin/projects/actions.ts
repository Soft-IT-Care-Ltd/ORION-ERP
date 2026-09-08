'use server';

import { revalidatePath } from 'next/cache';
import { Prisma, UnitStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getAuthorizedUser } from '@/lib/guards';
import { logActivity } from '@/lib/activity-log';
import { notify } from '@/lib/notifications';
import { type ActionResult, FORBIDDEN, NOT_FOUND, zodErrors } from '@/lib/action-result';
import { DEFAULT_PHASE_TEMPLATE, planPhaseDates } from '@/lib/phases';
import {
  applyTemplateSchema,
  savePhaseTemplateSchema,
  unitSchema,
  updateProjectSchema,
  updateUnitSchema,
  projectSchema,
} from '@/lib/validations/project';

export type { ActionResult } from '@/lib/action-result';

/** প্রজেক্ট বদলালে যেসব প্যানেলের ডেটা বাসি হয় */
function revalidateProject(projectId?: string) {
  revalidatePath('/admin/projects');
  if (projectId) revalidatePath(`/admin/projects/${projectId}`);
  revalidatePath('/admin');
  revalidatePath('/engineer');
  revalidatePath('/engineer/sites');
  revalidatePath('/customer/progress');
}

/** এই প্রজেক্টের দায়িত্বপ্রাপ্ত ইঞ্জিনিয়ারকে (থাকলে) জানানো */
async function notifyEngineer(engineerId: string | null, message: string, actorId: string) {
  if (!engineerId || engineerId === actorId) return;
  await notify({ userId: engineerId, type: 'PHASE_MILESTONE', message, link: '/engineer/sites' });
}

/* ------------------------------------------------------------- project */

export async function createProject(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const admin = await getAuthorizedUser('project:manage');
  if (!admin) return FORBIDDEN;

  const parsed = projectSchema.safeParse({
    name: formData.get('name'),
    location: formData.get('location'),
    description: formData.get('description'),
    startDate: formData.get('startDate'),
    engineerId: formData.get('engineerId'),
  });
  if (!parsed.success) {
    return { ok: false, message: 'ইনপুট সঠিক নয়', fieldErrors: zodErrors(parsed.error) };
  }

  const { name, location, description, startDate, engineerId } = parsed.data;

  try {
    // নতুন প্রজেক্ট ডিফল্ট ৮-ফেজ টেমপ্লেট নিয়েই শুরু হয় (PRD সেকশন ৫.২) —
    // অ্যাডমিন পরে প্রজেক্ট-ভেদে নাম/সময়কাল বদলে নিতে পারেন
    const project = await prisma.project.create({
      data: {
        name,
        location,
        description: description ?? null,
        startDate,
        engineerId,
        phaseTemplates: {
          create: DEFAULT_PHASE_TEMPLATE.map((t, index) => ({
            name: t.name,
            order: index + 1,
            defaultDurationDays: t.defaultDurationDays,
          })),
        },
      },
      select: { id: true },
    });

    await logActivity({
      entityType: 'Project',
      entityId: project.id,
      userId: admin.id,
      action: 'PROJECT_CREATED',
      metadata: { name, location, engineerId, phaseTemplateCount: DEFAULT_PHASE_TEMPLATE.length },
    });

    await notifyEngineer(engineerId, `নতুন সাইট অ্যাসাইন করা হয়েছে — ${name}`, admin.id);

    revalidateProject(project.id);
    return { ok: true, message: `${name} তৈরি হয়েছে (ডিফল্ট ৮টি ফেজ সহ)`, data: { id: project.id } };
  } catch (error) {
    console.error('createProject failed', error);
    return { ok: false, message: 'প্রজেক্ট তৈরি করা যায়নি' };
  }
}

export async function updateProject(formData: FormData): Promise<ActionResult> {
  const admin = await getAuthorizedUser('project:manage');
  if (!admin) return FORBIDDEN;

  const parsed = updateProjectSchema.safeParse({
    id: formData.get('id'),
    name: formData.get('name'),
    location: formData.get('location'),
    description: formData.get('description'),
    startDate: formData.get('startDate'),
    engineerId: formData.get('engineerId'),
  });
  if (!parsed.success) {
    return { ok: false, message: 'ইনপুট সঠিক নয়', fieldErrors: zodErrors(parsed.error) };
  }

  const { id, name, location, description, startDate, engineerId } = parsed.data;

  const existing = await prisma.project.findUnique({
    where: { id },
    select: { id: true, name: true, engineerId: true },
  });
  if (!existing) return NOT_FOUND;

  try {
    await prisma.project.update({
      where: { id },
      data: { name, location, description: description ?? null, startDate, engineerId },
    });

    await logActivity({
      entityType: 'Project',
      entityId: id,
      userId: admin.id,
      action: 'PROJECT_UPDATED',
      metadata: { name, location, engineerId },
    });

    if (engineerId && engineerId !== existing.engineerId) {
      await notifyEngineer(engineerId, `নতুন সাইট অ্যাসাইন করা হয়েছে — ${name}`, admin.id);
    }

    revalidateProject(id);
    return { ok: true, message: `${name} আপডেট হয়েছে` };
  } catch (error) {
    console.error('updateProject failed', error);
    return { ok: false, message: 'আপডেট করা যায়নি' };
  }
}

export async function deleteProject(input: { id: string }): Promise<ActionResult> {
  const admin = await getAuthorizedUser('project:manage');
  if (!admin) return FORBIDDEN;

  const project = await prisma.project.findUnique({
    where: { id: input.id },
    select: {
      id: true,
      name: true,
      units: { select: { id: true, sale: { select: { id: true } }, _count: { select: { leads: true } } } },
    },
  });
  if (!project) return NOT_FOUND;

  // বিক্রি হয়ে যাওয়া বা লিডের সঙ্গে যুক্ত ইউনিট থাকলে প্রজেক্ট মোছা যাবে না —
  // ইতিহাস (Sale, Lead) হারিয়ে যেত
  const sold = project.units.filter((u) => u.sale !== null).length;
  const linked = project.units.filter((u) => u._count.leads > 0).length;
  if (sold > 0 || linked > 0) {
    return {
      ok: false,
      message: `মোছা যাবে না — ${sold} টি ইউনিট বিক্রিত ও ${linked} টি লিডের সঙ্গে যুক্ত`,
    };
  }

  try {
    // Phase/PhaseTemplate ডাটাবেসেই cascade হয়; Unit → Project cascade নয়
    // (ভুল করে বিক্রিত ইউনিট মুছে যাওয়া ঠেকাতে), তাই এখানে হাতে মোছা হচ্ছে
    await prisma.$transaction([
      prisma.unit.deleteMany({ where: { projectId: project.id } }),
      prisma.project.delete({ where: { id: project.id } }),
    ]);

    await logActivity({
      entityType: 'Project',
      entityId: project.id,
      userId: admin.id,
      action: 'PROJECT_DELETED',
      metadata: { name: project.name, unitCount: project.units.length },
    });

    revalidateProject();
    return { ok: true, message: `${project.name} মুছে ফেলা হয়েছে` };
  } catch (error) {
    console.error('deleteProject failed', error);
    return { ok: false, message: 'প্রজেক্ট মোছা যায়নি' };
  }
}

/* ---------------------------------------------------------------- unit */

export async function createUnit(formData: FormData): Promise<ActionResult> {
  const admin = await getAuthorizedUser('project:manage');
  if (!admin) return FORBIDDEN;

  const parsed = unitSchema.safeParse({
    projectId: formData.get('projectId'),
    unitNo: formData.get('unitNo'),
    sizeSqft: formData.get('sizeSqft'),
    price: formData.get('price'),
    status: formData.get('status'),
  });
  if (!parsed.success) {
    return { ok: false, message: 'ইনপুট সঠিক নয়', fieldErrors: zodErrors(parsed.error) };
  }

  const { projectId, unitNo, sizeSqft, price, status } = parsed.data;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      startDate: true,
      phaseTemplates: {
        select: { name: true, order: true, defaultDurationDays: true },
        orderBy: { order: 'asc' },
      },
    },
  });
  if (!project) return NOT_FOUND;

  const dates = planPhaseDates(project.phaseTemplates, project.startDate);

  try {
    const unit = await prisma.unit.create({
      data: {
        projectId,
        unitNo,
        sizeSqft,
        price: new Prisma.Decimal(price),
        status,
        // নতুন ইউনিট প্রজেক্টের টেমপ্লেট অনুযায়ী নিজের ফেজ টাইমলাইন নিয়েই তৈরি হয়
        phases: {
          create: project.phaseTemplates.map((t, index) => ({
            name: t.name,
            order: t.order,
            plannedStart: dates[index].plannedStart,
            plannedEnd: dates[index].plannedEnd,
          })),
        },
      },
      select: { id: true },
    });

    await logActivity({
      entityType: 'Unit',
      entityId: unit.id,
      userId: admin.id,
      action: 'UNIT_CREATED',
      metadata: {
        projectId,
        unitNo,
        price: String(price),
        phaseCount: project.phaseTemplates.length,
      },
    });

    revalidateProject(projectId);
    return {
      ok: true,
      message:
        project.phaseTemplates.length > 0
          ? `${unitNo} যোগ হয়েছে — ${project.phaseTemplates.length} টি ফেজ তৈরি হয়েছে`
          : `${unitNo} যোগ হয়েছে`,
    };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return {
        ok: false,
        message: `এই প্রজেক্টে "${unitNo}" নামে ইউনিট আগেই আছে`,
        fieldErrors: { unitNo: 'ইউনিট নম্বরটি ব্যবহৃত হয়েছে' },
      };
    }
    console.error('createUnit failed', error);
    return { ok: false, message: 'ইউনিট তৈরি করা যায়নি' };
  }
}

export async function updateUnit(formData: FormData): Promise<ActionResult> {
  const admin = await getAuthorizedUser('project:manage');
  if (!admin) return FORBIDDEN;

  const parsed = updateUnitSchema.safeParse({
    id: formData.get('id'),
    projectId: formData.get('projectId'),
    unitNo: formData.get('unitNo'),
    sizeSqft: formData.get('sizeSqft'),
    price: formData.get('price'),
    status: formData.get('status'),
  });
  if (!parsed.success) {
    return { ok: false, message: 'ইনপুট সঠিক নয়', fieldErrors: zodErrors(parsed.error) };
  }

  const { id, projectId, unitNo, sizeSqft, price, status } = parsed.data;

  const existing = await prisma.unit.findUnique({
    where: { id },
    select: { id: true, projectId: true, status: true, sale: { select: { id: true } } },
  });
  if (!existing || existing.projectId !== projectId) return NOT_FOUND;

  // বিক্রিত ইউনিটের স্ট্যাটাস হাতে বদলালে Sale এর সঙ্গে অসঙ্গতি তৈরি হতো
  if (existing.sale && status !== UnitStatus.SOLD) {
    return {
      ok: false,
      message: 'ইউনিটটি বিক্রি হয়ে গেছে — স্ট্যাটাস "বিক্রিত" ছাড়া অন্য কিছু করা যাবে না',
      fieldErrors: { status: 'সেল বাতিল না করে বদলানো যাবে না' },
    };
  }

  try {
    await prisma.unit.update({
      where: { id },
      data: { unitNo, sizeSqft, price: new Prisma.Decimal(price), status },
    });

    await logActivity({
      entityType: 'Unit',
      entityId: id,
      userId: admin.id,
      action: 'UNIT_UPDATED',
      metadata: { projectId, unitNo, price: String(price), status },
    });

    revalidateProject(projectId);
    return { ok: true, message: `${unitNo} আপডেট হয়েছে` };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return {
        ok: false,
        message: `এই প্রজেক্টে "${unitNo}" নামে ইউনিট আগেই আছে`,
        fieldErrors: { unitNo: 'ইউনিট নম্বরটি ব্যবহৃত হয়েছে' },
      };
    }
    console.error('updateUnit failed', error);
    return { ok: false, message: 'আপডেট করা যায়নি' };
  }
}

export async function deleteUnit(input: { id: string }): Promise<ActionResult> {
  const admin = await getAuthorizedUser('project:manage');
  if (!admin) return FORBIDDEN;

  const unit = await prisma.unit.findUnique({
    where: { id: input.id },
    select: {
      id: true,
      unitNo: true,
      projectId: true,
      sale: { select: { id: true } },
      _count: { select: { leads: true } },
    },
  });
  if (!unit) return NOT_FOUND;

  if (unit.sale) return { ok: false, message: `${unit.unitNo} বিক্রিত — মোছা যাবে না` };
  if (unit._count.leads > 0) {
    return {
      ok: false,
      message: `${unit.unitNo} ${unit._count.leads} টি লিডের সঙ্গে যুক্ত — আগে লিডগুলো থেকে সরান`,
    };
  }

  try {
    // Phase ও PhaseUpdate ডাটাবেসে cascade delete হবে
    await prisma.unit.delete({ where: { id: unit.id } });

    await logActivity({
      entityType: 'Unit',
      entityId: unit.id,
      userId: admin.id,
      action: 'UNIT_DELETED',
      metadata: { projectId: unit.projectId, unitNo: unit.unitNo },
    });

    revalidateProject(unit.projectId);
    return { ok: true, message: `${unit.unitNo} মুছে ফেলা হয়েছে` };
  } catch (error) {
    console.error('deleteUnit failed', error);
    return { ok: false, message: 'ইউনিট মোছা যায়নি' };
  }
}

/* ------------------------------------------------------- phase template */

/**
 * টেমপ্লেটের পুরো তালিকা একবারে সেভ (ক্রম = তালিকার ক্রম)।
 *
 * টেমপ্লেট হলো *ব্লুপ্রিন্ট* — নতুন ইউনিট তৈরির সময় বা "টেমপ্লেট প্রয়োগ" চাপলে
 * এটি থেকে Phase তৈরি হয়। আগে তৈরি হয়ে যাওয়া ইউনিটের ফেজ এতে বদলায় না, কারণ
 * সেখানে ইঞ্জিনিয়ারের অগ্রগতি ও ছবি জমা আছে।
 */
export async function savePhaseTemplate(input: {
  projectId: string;
  phases: { name: string; defaultDurationDays: string | number }[];
}): Promise<ActionResult> {
  const admin = await getAuthorizedUser('project:manage');
  if (!admin) return FORBIDDEN;

  const parsed = savePhaseTemplateSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, message: issue?.message ?? 'ইনপুট সঠিক নয়' };
  }

  const { projectId, phases } = parsed.data;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true },
  });
  if (!project) return NOT_FOUND;

  try {
    await prisma.$transaction([
      prisma.phaseTemplate.deleteMany({ where: { projectId } }),
      prisma.phaseTemplate.createMany({
        data: phases.map((p, index) => ({
          projectId,
          name: p.name,
          order: index + 1,
          defaultDurationDays: p.defaultDurationDays,
        })),
      }),
    ]);

    await logActivity({
      entityType: 'Project',
      entityId: projectId,
      userId: admin.id,
      action: 'PHASE_TEMPLATE_SAVED',
      metadata: { phaseCount: phases.length, names: phases.map((p) => p.name) },
    });

    revalidateProject(projectId);
    return { ok: true, message: `ফেজ টেমপ্লেট সেভ হয়েছে (${phases.length} টি ফেজ)` };
  } catch (error) {
    console.error('savePhaseTemplate failed', error);
    return { ok: false, message: 'টেমপ্লেট সেভ করা যায়নি' };
  }
}

/**
 * এখনো টাইমলাইন নেই এমন ইউনিটগুলোতে প্রজেক্টের টেমপ্লেট বসানো।
 * যেসব ইউনিটে আগেই ফেজ আছে সেগুলো ছোঁয়া হয় না — অগ্রগতি মুছে যেত।
 */
export async function applyTemplateToUnits(input: {
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

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      startDate: true,
      engineerId: true,
      phaseTemplates: {
        select: { name: true, order: true, defaultDurationDays: true },
        orderBy: { order: 'asc' },
      },
    },
  });
  if (!project) return NOT_FOUND;

  if (project.phaseTemplates.length === 0) {
    return { ok: false, message: 'আগে ফেজ টেমপ্লেট সেট করুন' };
  }

  const units = await prisma.unit.findMany({
    where: { projectId, phases: { none: {} } },
    select: { id: true },
  });
  if (units.length === 0) {
    return { ok: false, message: 'সব ইউনিটেই টাইমলাইন আছে — নতুন কিছু তৈরি হয়নি' };
  }

  const dates = planPhaseDates(project.phaseTemplates, startDate ?? project.startDate);

  try {
    await prisma.phase.createMany({
      data: units.flatMap((unit) =>
        project.phaseTemplates.map((t, index) => ({
          unitId: unit.id,
          name: t.name,
          order: t.order,
          plannedStart: dates[index].plannedStart,
          plannedEnd: dates[index].plannedEnd,
        })),
      ),
    });

    await logActivity({
      entityType: 'Project',
      entityId: projectId,
      userId: admin.id,
      action: 'PHASE_TEMPLATE_APPLIED',
      metadata: {
        unitCount: units.length,
        phaseCount: project.phaseTemplates.length,
        startDate: (startDate ?? project.startDate)?.toISOString() ?? null,
      },
    });

    await notifyEngineer(
      project.engineerId,
      `${project.name} — ${units.length} টি ইউনিটে ফেজ টাইমলাইন যোগ হয়েছে`,
      admin.id,
    );

    revalidateProject(projectId);
    return {
      ok: true,
      message: `${units.length} টি ইউনিটে ${project.phaseTemplates.length} টি করে ফেজ তৈরি হয়েছে`,
    };
  } catch (error) {
    console.error('applyTemplateToUnits failed', error);
    return { ok: false, message: 'টেমপ্লেট প্রয়োগ করা যায়নি' };
  }
}
