'use server';

import { revalidatePath } from 'next/cache';
import { Prisma, SaleStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getAuthorizedUser } from '@/lib/guards';
import { logActivity } from '@/lib/activity-log';
import { notify } from '@/lib/notifications';
import { type ActionResult, FORBIDDEN, NOT_FOUND, zodErrors } from '@/lib/action-result';
import { generateSchedule } from '@/lib/payments';
import { markOverdueInstallments } from '@/lib/payment-data';
import { formatBDT } from '@/lib/utils';
import { generatePlanSchema, saleIdSchema, saveScheduleSchema } from '@/lib/validations/payment';

export type { ActionResult } from '@/lib/action-result';

/** পেমেন্ট প্ল্যান বদলালে যেসব প্যানেলের ডেটা বাসি হয় */
function revalidatePlan(saleId?: string) {
  revalidatePath('/accounts');
  revalidatePath('/accounts/schedule');
  if (saleId) revalidatePath(`/accounts/schedule/${saleId}`);
  revalidatePath('/accounts/payments');
  revalidatePath('/accounts/overdue');
  revalidatePath('/admin');
  revalidatePath('/admin/payments');
  revalidatePath('/customer');
  revalidatePath('/customer/payments');
}

/** প্ল্যান সেট/বদলের জন্য দরকারি সেল তথ্য */
async function loadSaleForPlan(saleId: string) {
  return prisma.sale.findUnique({
    where: { id: saleId },
    select: {
      id: true,
      totalAmount: true,
      saleDate: true,
      status: true,
      customer: { select: { userId: true, user: { select: { name: true } } } },
      unit: { select: { unitNo: true, project: { select: { name: true } } } },
      paymentPlan: {
        select: {
          id: true,
          installments: {
            select: { id: true, label: true, _count: { select: { payments: true } } },
          },
        },
      },
    },
  });
}

type SaleForPlan = NonNullable<Awaited<ReturnType<typeof loadSaleForPlan>>>;

/**
 * টাকা জমা পড়ে যাওয়া কিস্তি মুছে ফেললে সেই পেমেন্টগুলো অনাথ হয়ে যেত —
 * তাই শিডিউল নতুন করে বানানোর আগে এই পাহারা।
 */
function paidInstallments(sale: SaleForPlan) {
  return (sale.paymentPlan?.installments ?? []).filter((i) => i._count.payments > 0);
}

/** প্ল্যান সেট হলে ড্রাফট সেলটি কনফার্মড হয় — PRD সেকশন ৫.১ ("draft mode") */
async function confirmSaleIfDraft(tx: Prisma.TransactionClient, sale: SaleForPlan) {
  if (sale.status !== SaleStatus.DRAFT) return false;
  await tx.sale.update({ where: { id: sale.id }, data: { status: SaleStatus.CONFIRMED } });
  return true;
}

/** কাস্টমারকে জানানো — নিজের পোর্টালে শিডিউল দেখতে পাবেন (PRD সেকশন ৫.৪) */
async function notifyCustomer(sale: SaleForPlan, message: string, actorId: string) {
  if (sale.customer.userId === actorId) return;
  await notify({
    userId: sale.customer.userId,
    type: 'PAYMENT_DUE',
    message,
    link: '/customer/payments',
  });
}

/* --------------------------------------------------- template generate */

/**
 * PRD সেকশন ৫.৩ এর স্যাম্পল টেমপ্লেট থেকে পুরো শিডিউল auto-generate।
 * আগের প্ল্যান থাকলে (এবং কোনো টাকা জমা না পড়লে) সেটি বদলে নতুনটি বসে।
 */
export async function generatePlanFromTemplate(input: unknown): Promise<ActionResult> {
  const accounts = await getAuthorizedUser('paymentPlan:manage');
  if (!accounts) return FORBIDDEN;

  const parsed = generatePlanSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: 'ইনপুট সঠিক নয়', fieldErrors: zodErrors(parsed.error) };
  }

  const data = parsed.data;
  const sale = await loadSaleForPlan(data.saleId);
  if (!sale) return NOT_FOUND;

  const paid = paidInstallments(sale);
  if (paid.length > 0) {
    return {
      ok: false,
      message: `${paid.length} টি কিস্তিতে টাকা জমা পড়েছে — টেমপ্লেট দিয়ে নতুন শিডিউল বানানো যাবে না। কিস্তিগুলো হাতে এডিট করুন।`,
    };
  }

  const totalAmount = Number(sale.totalAmount);
  const rows = generateSchedule({
    totalAmount,
    bookingDate: data.bookingDate,
    bookingPercent: data.bookingPercent,
    downPaymentPercent: data.downPaymentPercent,
    downPaymentDays: data.downPaymentDays,
    agreementPercent: data.agreementPercent,
    agreementDate: data.agreementDate,
    monthlyCount: data.monthlyCount,
    monthlyPercent: data.monthlyPercent,
    firstInstallmentDate: data.firstInstallmentDate,
    handoverDate: data.handoverDate,
  });

  if (rows.length === 0) {
    return { ok: false, message: 'শতাংশগুলো দিয়ে কোনো কিস্তি তৈরি হয়নি — মান যাচাই করুন' };
  }

  try {
    const confirmed = await prisma.$transaction(async (tx) => {
      // Installment → PaymentPlan cascade, তাই পুরনো প্ল্যান মুছলেই কিস্তিও যায়
      if (sale.paymentPlan) {
        await tx.paymentPlan.delete({ where: { id: sale.paymentPlan.id } });
      }
      await tx.paymentPlan.create({
        data: {
          saleId: sale.id,
          installments: {
            create: rows.map((row) => ({
              label: row.label,
              order: row.order,
              dueDate: row.dueDate,
              amount: new Prisma.Decimal(row.amount),
              percentage: new Prisma.Decimal(row.percentage),
            })),
          },
        },
      });
      return confirmSaleIfDraft(tx, sale);
    });

    // তারিখ পেরিয়ে যাওয়া কিস্তি (যেমন পুরনো বুকিং মানি) সঙ্গে সঙ্গেই বকেয়া হবে
    await markOverdueInstallments();

    await logActivity({
      entityType: 'PaymentPlan',
      entityId: sale.id,
      userId: accounts.id,
      action: 'PAYMENT_PLAN_GENERATED',
      metadata: {
        installmentCount: rows.length,
        totalAmount: String(totalAmount),
        template: {
          bookingPercent: data.bookingPercent,
          downPaymentPercent: data.downPaymentPercent,
          agreementPercent: data.agreementPercent,
          monthlyCount: data.monthlyCount,
          monthlyPercent: data.monthlyPercent,
        },
        saleConfirmed: confirmed,
      },
    });

    await notifyCustomer(
      sale,
      `${sale.unit.project.name} — ${sale.unit.unitNo} এর পেমেন্ট শিডিউল তৈরি হয়েছে (${rows.length} টি কিস্তি)`,
      accounts.id,
    );

    revalidatePlan(sale.id);
    return {
      ok: true,
      message: `${rows.length} টি কিস্তির শিডিউল তৈরি হয়েছে${confirmed ? ' — সেলটি কনফার্মড হলো' : ''}`,
    };
  } catch (error) {
    console.error('generatePlanFromTemplate failed', error);
    return { ok: false, message: 'শিডিউল তৈরি করা যায়নি' };
  }
}

/* ---------------------------------------------------- manual schedule */

/**
 * পুরো শিডিউল একবারে সেভ — যোগ, এডিট ও মুছে ফেলা, তিনটিই এখানে।
 * ক্রম = তালিকার ক্রম। টাকা জমা পড়া কিস্তি মোছা যায় না।
 */
export async function saveSchedule(input: unknown): Promise<ActionResult> {
  const accounts = await getAuthorizedUser('paymentPlan:manage');
  if (!accounts) return FORBIDDEN;

  const parsed = saveScheduleSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      message: issue?.message ?? 'ইনপুট সঠিক নয়',
      fieldErrors: zodErrors(parsed.error),
    };
  }

  const { saleId, installments } = parsed.data;
  const sale = await loadSaleForPlan(saleId);
  if (!sale) return NOT_FOUND;

  const keptIds = new Set(installments.map((row) => row.id).filter(Boolean) as string[]);
  const removedWithPayments = paidInstallments(sale).filter((i) => !keptIds.has(i.id));
  if (removedWithPayments.length > 0) {
    return {
      ok: false,
      message: `"${removedWithPayments[0].label}" এ টাকা জমা পড়েছে — কিস্তিটি মোছা যাবে না`,
    };
  }

  const totalAmount = Number(sale.totalAmount);
  const scheduleTotal = installments.reduce((sum, row) => sum + row.amount, 0);
  const difference = scheduleTotal - totalAmount;

  try {
    const confirmed = await prisma.$transaction(async (tx) => {
      const plan =
        sale.paymentPlan ??
        (await tx.paymentPlan.create({ data: { saleId }, select: { id: true } }));

      // তালিকা থেকে বাদ পড়া কিস্তিগুলো (উপরে যাচাই — কোনোটিতে পেমেন্ট নেই)
      await tx.installment.deleteMany({
        where: { paymentPlanId: plan.id, id: { notIn: [...keptIds] } },
      });

      for (const [index, row] of installments.entries()) {
        const data = {
          label: row.label,
          order: index + 1,
          dueDate: row.dueDate,
          amount: new Prisma.Decimal(row.amount),
          // হাতে বদলানোর পর শতাংশ আবার সেল ভ্যালু থেকে হিসাব — কলামটি যেন মিথ্যা না বলে
          percentage:
            totalAmount > 0
              ? new Prisma.Decimal(Math.round((row.amount / totalAmount) * 10000) / 100)
              : null,
        };

        if (row.id && keptIds.has(row.id)) {
          await tx.installment.updateMany({
            where: { id: row.id, paymentPlanId: plan.id },
            data,
          });
        } else {
          await tx.installment.create({ data: { ...data, paymentPlanId: plan.id } });
        }
      }

      // প্ল্যান বদলালে তার updatedAt ও নড়ে (এডিটের ইতিহাস বোঝার জন্য)
      await tx.paymentPlan.update({ where: { id: plan.id }, data: { updatedAt: new Date() } });

      return confirmSaleIfDraft(tx, sale);
    });

    await markOverdueInstallments();

    await logActivity({
      entityType: 'PaymentPlan',
      entityId: sale.id,
      userId: accounts.id,
      action: 'PAYMENT_PLAN_SAVED',
      metadata: {
        installmentCount: installments.length,
        scheduleTotal: String(scheduleTotal),
        saleTotal: String(totalAmount),
        saleConfirmed: confirmed,
      },
    });

    await notifyCustomer(
      sale,
      `${sale.unit.project.name} — ${sale.unit.unitNo} এর পেমেন্ট শিডিউল আপডেট হয়েছে`,
      accounts.id,
    );

    revalidatePlan(sale.id);

    // যোগফল সেল ভ্যালুর সমান না হলে সেভ আটকানো হয় না (ছাড়/সমন্বয় বাস্তবে হয়),
    // কিন্তু অ্যাকাউন্টস যেন খেয়াল না হারায় তাই মেসেজেই পার্থক্যটা বলা থাকে
    const warning =
      difference === 0
        ? ''
        : difference > 0
          ? ` — সতর্কতা: শিডিউল সেল ভ্যালুর চেয়ে ${formatBDT(difference)} বেশি`
          : ` — সতর্কতা: ${formatBDT(-difference)} কম`;

    return {
      ok: true,
      message: `${installments.length} টি কিস্তি সেভ হয়েছে${confirmed ? ' — সেলটি কনফার্মড হলো' : ''}${warning}`,
    };
  } catch (error) {
    console.error('saveSchedule failed', error);
    return { ok: false, message: 'শিডিউল সেভ করা যায়নি' };
  }
}

/* -------------------------------------------------------- delete plan */

/** পুরো প্ল্যান বাতিল — কোনো টাকা জমা না পড়ে থাকলেই কেবল */
export async function deletePlan(input: { saleId: string }): Promise<ActionResult> {
  const accounts = await getAuthorizedUser('paymentPlan:manage');
  if (!accounts) return FORBIDDEN;

  const parsed = saleIdSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: 'ইনপুট সঠিক নয়', fieldErrors: zodErrors(parsed.error) };
  }

  const sale = await loadSaleForPlan(parsed.data.saleId);
  if (!sale?.paymentPlan) return NOT_FOUND;

  const paid = paidInstallments(sale);
  if (paid.length > 0) {
    return {
      ok: false,
      message: `${paid.length} টি কিস্তিতে টাকা জমা পড়েছে — প্ল্যান মোছা যাবে না`,
    };
  }

  try {
    await prisma.paymentPlan.delete({ where: { id: sale.paymentPlan.id } });

    await logActivity({
      entityType: 'PaymentPlan',
      entityId: sale.id,
      userId: accounts.id,
      action: 'PAYMENT_PLAN_DELETED',
      metadata: { installmentCount: sale.paymentPlan.installments.length },
    });

    revalidatePlan(sale.id);
    return { ok: true, message: 'পেমেন্ট প্ল্যান মুছে ফেলা হয়েছে' };
  } catch (error) {
    console.error('deletePlan failed', error);
    return { ok: false, message: 'প্ল্যান মোছা যায়নি' };
  }
}
