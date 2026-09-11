'use server';

import { randomBytes } from 'crypto';
import { revalidatePath } from 'next/cache';
import { LeadActivityType, LeadStage, Prisma, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { getAuthorizedUser } from '@/lib/guards';
import { logActivity } from '@/lib/activity-log';
import { notifyMany } from '@/lib/notifications';
import { leadScope } from '@/lib/lead-access';
import {
  type ActionError,
  type ActionResult,
  FORBIDDEN,
  NOT_FOUND,
  zodErrors,
} from '@/lib/action-result';
import { STAGE_LABEL } from '@/lib/leads';
import { buildProjectTitle } from '@/lib/projects';
import { planPhaseDates } from '@/lib/phases';
import { formatBDT } from '@/lib/utils';
import { convertLeadSchema } from '@/lib/validations/convert';

export type { ActionResult } from '@/lib/action-result';

/**
 * লিডে ইমেইল না থাকলে কাস্টমার অ্যাকাউন্টের placeholder ইমেইল এই ডোমেইনে তৈরি হয়।
 * `.invalid` RFC 2606 এ সংরক্ষিত — এখানে ভুল করেও মেইল চলে যাবে না। Admin পরে
 * ইউজার এডিট করে আসল ইমেইল বসাবেন।
 */
const CUSTOMER_EMAIL_DOMAIN = 'orion.invalid';

/**
 * নতুন কাস্টমার অ্যাকাউন্টের অস্থায়ী পাসওয়ার্ড — কনভার্শনের পর একবারই Admin কে
 * দেখানো হয় (কপি করার জন্য), কোথাও সংরক্ষিত থাকে না। ছোট রাখা হয়েছে যাতে
 * ফোনে বলে দেওয়া যায়, কিন্তু এলোমেলো বলে অনুমান করা যায় না।
 */
function generateTempPassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = randomBytes(10);
  return `Orion-${[...bytes].map((b) => alphabet[b % alphabet.length]).join('')}`;
}

/** transaction এর ভেতর থেকে ফিল্ড-এরর সহ বেরিয়ে আসার জন্য */
class ConvertError extends Error {
  constructor(public readonly result: ActionError) {
    super(result.message);
  }
}

function invalid(message: string, field?: string): ConvertError {
  return new ConvertError({
    ok: false,
    message,
    ...(field ? { fieldErrors: { [field]: message } } : {}),
  });
}

type Tx = Prisma.TransactionClient;

type ResolvedCustomer = {
  customerId: string;
  customerName: string;
  /** নতুন User অ্যাকাউন্ট তৈরি হয়েছে কিনা */
  created: boolean;
  /** ইমেইল না থাকায় placeholder বসানো হয়েছে কিনা */
  placeholderEmail: boolean;
  email: string;
};

/**
 * লিডের জন্য Customer বের করা বা তৈরি করা।
 *
 * ক্রম: (১) ইমেইল মিললে সেই অ্যাকাউন্ট, (২) একই ফোনের CUSTOMER অ্যাকাউন্ট,
 * (৩) কিছু না মিললে নতুন User (role=CUSTOMER) + Customer — নাম ও ফোন লিড থেকে।
 * নতুন অ্যাকাউন্টের অস্থায়ী পাসওয়ার্ডটি কনভার্শনের ফলাফলে ফেরত যায়, যাতে Admin
 * কপি করে কাস্টমারকে দিতে পারেন (PRD সেকশন ৫.৩)।
 */
async function resolveCustomer(
  tx: Tx,
  lead: { id: string; name: string; phone: string },
  email: string | undefined,
  passwordHash: string,
): Promise<ResolvedCustomer> {
  const byEmail = email
    ? await tx.user.findUnique({
        where: { email },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          customer: { select: { id: true } },
        },
      })
    : null;

  // ইমেইলটি অন্য role এর কারও — এটাকে কাস্টমার বানিয়ে ফেলা যাবে না
  if (byEmail && byEmail.role !== Role.CUSTOMER) {
    throw invalid(
      'এই ইমেইলটি অন্য একটি অ্যাকাউন্টে ব্যবহৃত হচ্ছে — অন্য ইমেইল দিন',
      'customerEmail',
    );
  }

  const existing =
    byEmail ??
    (await tx.user.findFirst({
      where: { role: Role.CUSTOMER, phone: lead.phone },
      select: { id: true, name: true, email: true, role: true, customer: { select: { id: true } } },
      orderBy: { createdAt: 'asc' },
    }));

  if (existing) {
    // পুরনো CUSTOMER ইউজারের Customer প্রোফাইল না থাকলে (হাতে তৈরি ডেটা) বানিয়ে নেওয়া
    const customerId =
      existing.customer?.id ??
      (await tx.customer.create({ data: { userId: existing.id }, select: { id: true } })).id;

    return {
      customerId,
      customerName: existing.name,
      created: false,
      placeholderEmail: false,
      email: existing.email,
    };
  }

  const finalEmail = email ?? `customer-${lead.id}@${CUSTOMER_EMAIL_DOMAIN}`;

  const user = await tx.user.create({
    data: {
      name: lead.name,
      phone: lead.phone,
      email: finalEmail,
      role: Role.CUSTOMER,
      passwordHash,
    },
    select: { id: true, name: true, email: true },
  });

  const customer = await tx.customer.create({ data: { userId: user.id }, select: { id: true } });

  return {
    customerId: customer.id,
    customerName: user.name,
    created: true,
    placeholderEmail: email === undefined,
    email: user.email,
  };
}

export type ConvertResult = {
  projectId: string;
  phaseCount: number;
  /** নতুন কাস্টমার অ্যাকাউন্ট হলে — Admin কে একবারই দেখানো হয় */
  credentials: { email: string; password: string } | null;
};

/**
 * PRD সেকশন ৫.৩ — লিড "Won" এ গেলে কনস্ট্রাকশন Project তৈরি।
 *
 * এক ট্রানজেকশনে: Customer (না থাকলে নতুন User role=CUSTOMER সহ) → Project →
 * গ্লোবাল `PhaseTemplate` থেকে কপি করে Phase গুলো (সব UPCOMING) → Lead স্টেজ WON
 * + টাইমলাইন এন্ট্রি। PaymentPlan এখানে তৈরি হয় না — Accounts/Admin পরে সেট করবেন
 * (PRD সেকশন ৫.৫)।
 */
export async function convertLeadToProject(input: {
  leadId: string;
  totalContractValue: string | number;
  ratePerSqft?: string;
  totalSqft?: string;
  startDate?: string;
  customerEmail?: string;
}): Promise<ActionResult<ConvertResult>> {
  const actor = await getAuthorizedUser('lead:convert');
  if (!actor) return FORBIDDEN;

  const parsed = convertLeadSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors = zodErrors(parsed.error);
    return {
      ok: false,
      message:
        fieldErrors.totalContractValue ??
        fieldErrors.ratePerSqft ??
        fieldErrors.totalSqft ??
        fieldErrors.customerEmail ??
        'ইনপুট সঠিক নয়',
      fieldErrors,
    };
  }
  const { leadId, totalContractValue, ratePerSqft, totalSqft, startDate, customerEmail } =
    parsed.data;

  // scope সহ — অন্যের লিড কনভার্ট করা যাবে না
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, ...leadScope(actor) },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      stage: true,
      assignedToId: true,
      projectLocation: true,
      buildingType: true,
      project: { select: { id: true } },
    },
  });
  if (!lead) return NOT_FOUND;

  if (lead.project) {
    return { ok: false, message: 'এই লিডের জন্য প্রজেক্ট আগেই তৈরি হয়েছে' };
  }

  // Lead → Project কনভার্শনে ফেজগুলো গ্লোবাল টেমপ্লেট থেকে কপি হয় (v2)
  const templates = await prisma.phaseTemplate.findMany({
    select: { name: true, order: true, defaultDurationDays: true },
    orderBy: { order: 'asc' },
  });
  const dates = planPhaseDates(templates, startDate);

  // bcrypt ইচ্ছাকৃতভাবে ধীর — ট্রানজেকশনের বাইরে হ্যাশ করা হয় যাতে লক বেশিক্ষণ না থাকে
  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 10);
  const title = buildProjectTitle(lead);
  const amountLabel = formatBDT(totalContractValue);

  try {
    const outcome = await prisma.$transaction(async (tx) => {
      const customer = await resolveCustomer(
        tx,
        lead,
        customerEmail ?? lead.email ?? undefined,
        passwordHash,
      );

      const project = await tx.project.create({
        data: {
          leadId: lead.id,
          customerId: customer.customerId,
          title,
          landLocation: lead.projectLocation,
          buildingType: lead.buildingType,
          totalSqft: totalSqft === null ? null : new Prisma.Decimal(totalSqft),
          ratePerSqft: ratePerSqft === null ? null : new Prisma.Decimal(ratePerSqft),
          totalContractValue: new Prisma.Decimal(totalContractValue),
          startDate,
          phases: {
            create: templates.map((template, index) => ({
              name: template.name,
              order: template.order,
              plannedStart: dates[index].plannedStart,
              plannedEnd: dates[index].plannedEnd,
            })),
          },
        },
        select: { id: true },
      });

      await tx.lead.update({
        where: { id: lead.id },
        // Lost থেকে সরাসরি Won এ এলে পুরনো কারণ আর প্রযোজ্য নয়
        data: { stage: LeadStage.WON, lostReason: null },
      });

      const timeline: { type: LeadActivityType; note: string }[] = [];

      if (lead.stage !== LeadStage.WON) {
        timeline.push({
          type: LeadActivityType.STAGE_CHANGED,
          note: `স্টেজ: ${STAGE_LABEL[lead.stage]} → ${STAGE_LABEL.WON}`,
        });
      }

      timeline.push({
        type: LeadActivityType.NOTE,
        note:
          `প্রজেক্ট তৈরি হয়েছে — ${title} · কন্ট্রাক্ট ভ্যালু ${amountLabel} · ` +
          `${templates.length} টি ফেজ যোগ হয়েছে · কাস্টমার: ${customer.customerName}` +
          (customer.created ? ' (নতুন কাস্টমার অ্যাকাউন্ট)' : ''),
      });

      await tx.leadActivity.createMany({
        data: timeline.map((t) => ({ ...t, leadId: lead.id, createdById: actor.id })),
      });

      return { projectId: project.id, customer };
    });

    const { projectId, customer } = outcome;

    // CLAUDE.md নিয়ম ৪ — critical action গুলোর audit trail
    await logActivity({
      entityType: 'Project',
      entityId: projectId,
      userId: actor.id,
      action: 'PROJECT_CREATED',
      metadata: {
        leadId: lead.id,
        customerId: customer.customerId,
        title,
        totalContractValue: String(totalContractValue),
        phaseCount: templates.length,
        customerCreated: customer.created,
      },
    });

    await logActivity({
      entityType: 'Lead',
      entityId: lead.id,
      userId: actor.id,
      action: 'LEAD_CONVERTED',
      metadata: { from: lead.stage, to: LeadStage.WON, projectId },
    });

    // Accounts ও Admin — পেমেন্ট প্ল্যান সেট করার জন্য (PRD সেকশন ৫.৫)
    const reviewers = await prisma.user.findMany({
      where: { active: true, role: { in: [Role.ACCOUNTS, Role.ADMIN] }, id: { not: actor.id } },
      select: { id: true },
    });
    await notifyMany({
      userIds: reviewers.map((r) => r.id),
      type: 'PROJECT_CREATED',
      message: `নতুন প্রজেক্ট — ${title} · ${amountLabel} · পেমেন্ট প্ল্যান সেট করুন`,
      link: `/accounts/schedule/${projectId}`,
    });

    revalidatePath('/sales/pipeline');
    revalidatePath('/sales');
    revalidatePath(`/sales/leads/${lead.id}`);
    revalidatePath('/accounts');
    revalidatePath('/admin/projects');

    const messageParts = [`${lead.name} — প্রজেক্ট তৈরি হয়েছে`];
    if (templates.length > 0) messageParts.push(`${templates.length} টি ফেজ যোগ হয়েছে`);
    else messageParts.push('ফেজ টেমপ্লেট খালি — Admin → ফেজ টেমপ্লেট থেকে সেট করুন');
    if (customer.placeholderEmail) messageParts.push('কাস্টমারের ইমেইল নেই, অস্থায়ী ইমেইল বসানো হয়েছে');

    return {
      ok: true,
      message: messageParts.join(' · '),
      data: {
        projectId,
        phaseCount: templates.length,
        // পাসওয়ার্ডটি শুধু নতুন অ্যাকাউন্টেই অর্থবহ — পুরনো কাস্টমারের পাসওয়ার্ড
        // বদলানো হয়নি, তাই সেখানে কিছু দেখানোরও নেই
        credentials: customer.created
          ? { email: customer.email, password: tempPassword }
          : null,
      },
    };
  } catch (error) {
    if (error instanceof ConvertError) return error.result;

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const target = String(error.meta?.target ?? '');
      if (target.includes('leadId')) {
        return { ok: false, message: 'এই লিডের জন্য প্রজেক্ট আগেই তৈরি হয়েছে' };
      }
      if (target.includes('email')) {
        return {
          ok: false,
          message: 'এই ইমেইলে ইতিমধ্যে একটি অ্যাকাউন্ট আছে',
          fieldErrors: { customerEmail: 'ইমেইলটি ব্যবহৃত হয়েছে' },
        };
      }
    }

    console.error('convertLeadToProject failed', error);
    return { ok: false, message: 'প্রজেক্ট তৈরি করা যায়নি' };
  }
}
