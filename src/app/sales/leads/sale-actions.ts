'use server';

import { randomBytes } from 'crypto';
import { revalidatePath } from 'next/cache';
import { LeadActivityType, LeadStage, Prisma, Role, SaleStatus, UnitStatus } from '@prisma/client';
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
import { unitLabel } from '@/lib/sales';
import { formatBDT } from '@/lib/utils';
import { convertLeadSchema } from '@/lib/validations/sale';

export type { ActionResult } from '@/lib/action-result';

/**
 * লিডে ইমেইল না থাকলে কাস্টমার অ্যাকাউন্টের placeholder ইমেইল এই ডোমেইনে তৈরি হয়।
 * `.invalid` RFC 2606 এ সংরক্ষিত — এখানে ভুল করেও মেইল চলে যাবে না। Admin পরে
 * ইউজার এডিট করে আসল ইমেইল বসাবেন (তার আগে কাস্টমার পোর্টালে লগইন করতে পারবেন না)।
 */
const CUSTOMER_EMAIL_DOMAIN = 'orion.invalid';

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
 * নতুন অ্যাকাউন্টের পাসওয়ার্ড random (কেউ জানে না); Admin "পাসওয়ার্ড রিসেট" দিয়ে
 * কাস্টমারকে পোর্টালের অ্যাক্সেস দেবেন (Phase 5)।
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

/**
 * PRD সেকশন ৫.১ — লিড "Won" এ গেলে অটোমেটিক কনভার্শন।
 *
 * এক ট্রানজেকশনে: Customer (না থাকলে নতুন User role=CUSTOMER সহ) → Sale (DRAFT) →
 * Unit স্ট্যাটাস SOLD → Lead স্টেজ WON + টাইমলাইন এন্ট্রি।
 * PaymentPlan এখানে তৈরি হয় না — Accounts/Admin সেট করে সেলটি কনফার্ম করবেন (Phase 4)।
 */
export async function convertLeadToSale(input: {
  leadId: string;
  unitId: string;
  totalAmount: string | number;
  customerEmail?: string;
}): Promise<ActionResult<{ saleId: string }>> {
  const actor = await getAuthorizedUser('lead:convert');
  if (!actor) return FORBIDDEN;

  const parsed = convertLeadSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors = zodErrors(parsed.error);
    return {
      ok: false,
      message:
        fieldErrors.unitId ??
        fieldErrors.totalAmount ??
        fieldErrors.customerEmail ??
        'ইনপুট সঠিক নয়',
      fieldErrors,
    };
  }
  const { leadId, unitId, totalAmount, customerEmail } = parsed.data;

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
      sale: { select: { id: true } },
    },
  });
  if (!lead) return NOT_FOUND;

  if (lead.sale) {
    return { ok: false, message: 'এই লিডের জন্য সেল আগেই তৈরি হয়েছে' };
  }

  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    select: {
      id: true,
      unitNo: true,
      status: true,
      project: { select: { id: true, name: true } },
      sale: { select: { id: true } },
    },
  });
  if (!unit) {
    return {
      ok: false,
      message: 'ইউনিটটি খুঁজে পাওয়া যায়নি',
      fieldErrors: { unitId: 'ইউনিটটি নেই' },
    };
  }
  if (unit.sale || unit.status === UnitStatus.SOLD) {
    const message = `${unitLabel(unit)} ইতিমধ্যে বিক্রিত — অন্য ইউনিট নির্বাচন করুন`;
    return { ok: false, message, fieldErrors: { unitId: message } };
  }

  // bcrypt ইচ্ছাকৃতভাবে ধীর — ট্রানজেকশনের বাইরে হ্যাশ করা হয় যাতে লক বেশিক্ষণ না থাকে
  const passwordHash = await bcrypt.hash(randomBytes(24).toString('hex'), 10);
  const amountLabel = formatBDT(totalAmount);
  const unitName = unitLabel(unit);

  try {
    const outcome = await prisma.$transaction(async (tx) => {
      const customer = await resolveCustomer(
        tx,
        lead,
        customerEmail ?? lead.email ?? undefined,
        passwordHash,
      );

      const sale = await tx.sale.create({
        data: {
          leadId: lead.id,
          unitId: unit.id,
          customerId: customer.customerId,
          totalAmount: new Prisma.Decimal(totalAmount),
          status: SaleStatus.DRAFT,
        },
        select: { id: true },
      });

      await tx.unit.update({ where: { id: unit.id }, data: { status: UnitStatus.SOLD } });

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
          `সেল তৈরি হয়েছে (ড্রাফট) — ${unitName} · ${amountLabel} · কাস্টমার: ${customer.customerName}` +
          (customer.created ? ' (নতুন কাস্টমার অ্যাকাউন্ট)' : '') +
          ' · পেমেন্ট প্ল্যান Accounts/Admin কনফার্ম করবেন',
      });

      await tx.leadActivity.createMany({
        data: timeline.map((t) => ({ ...t, leadId: lead.id, createdById: actor.id })),
      });

      return { saleId: sale.id, customer };
    });

    const { saleId, customer } = outcome;

    // CLAUDE.md নিয়ম ৪ — critical action গুলোর audit trail
    await logActivity({
      entityType: 'Sale',
      entityId: saleId,
      userId: actor.id,
      action: 'SALE_CREATED',
      metadata: {
        leadId: lead.id,
        unitId: unit.id,
        projectId: unit.project.id,
        customerId: customer.customerId,
        totalAmount: String(totalAmount),
        status: SaleStatus.DRAFT,
        customerCreated: customer.created,
      },
    });

    await logActivity({
      entityType: 'Lead',
      entityId: lead.id,
      userId: actor.id,
      action: 'LEAD_CONVERTED',
      metadata: { from: lead.stage, to: LeadStage.WON, saleId, unitId: unit.id },
    });

    // Accounts ও Admin — পেমেন্ট প্ল্যান সেট করার জন্য (PRD সেকশন ৫.১: draft mode)
    const reviewers = await prisma.user.findMany({
      where: { active: true, role: { in: [Role.ACCOUNTS, Role.ADMIN] }, id: { not: actor.id } },
      select: { id: true },
    });
    await notifyMany({
      userIds: reviewers.map((r) => r.id),
      type: 'SALE_DRAFT_CREATED',
      message: `নতুন সেল (ড্রাফট) — ${lead.name} · ${unitName} · ${amountLabel} · পেমেন্ট প্ল্যান সেট করুন`,
      link: `/accounts/schedule/${saleId}`,
    });

    revalidatePath('/sales/pipeline');
    revalidatePath('/sales');
    revalidatePath(`/sales/leads/${lead.id}`);
    revalidatePath('/accounts');

    return {
      ok: true,
      message: customer.placeholderEmail
        ? `${lead.name} — সেল তৈরি হয়েছে (ড্রাফট)। কাস্টমারের ইমেইল নেই, তাই অস্থায়ী ইমেইল বসানো হয়েছে।`
        : `${lead.name} — সেল তৈরি হয়েছে (ড্রাফট)। পেমেন্ট প্ল্যান বাকি।`,
      data: { saleId },
    };
  } catch (error) {
    if (error instanceof ConvertError) return error.result;

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const target = String(error.meta?.target ?? '');
      if (target.includes('unitId')) {
        return {
          ok: false,
          message: `${unitName} ইতিমধ্যে বিক্রিত — অন্য ইউনিট নির্বাচন করুন`,
          fieldErrors: { unitId: 'ইউনিটটি আর খালি নেই' },
        };
      }
      if (target.includes('leadId')) {
        return { ok: false, message: 'এই লিডের জন্য সেল আগেই তৈরি হয়েছে' };
      }
      if (target.includes('email')) {
        return {
          ok: false,
          message: 'এই ইমেইলে ইতিমধ্যে একটি অ্যাকাউন্ট আছে',
          fieldErrors: { customerEmail: 'ইমেইলটি ব্যবহৃত হয়েছে' },
        };
      }
    }

    console.error('convertLeadToSale failed', error);
    return { ok: false, message: 'সেল তৈরি করা যায়নি' };
  }
}
