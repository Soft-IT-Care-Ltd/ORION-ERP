'use server';

import { revalidatePath } from 'next/cache';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getAuthorizedUser } from '@/lib/guards';
import { logActivity } from '@/lib/activity-log';
import { notify } from '@/lib/notifications';
import { type ActionResult, FORBIDDEN, NOT_FOUND, zodErrors } from '@/lib/action-result';
import { computeInstallmentStatus } from '@/lib/payments';
import { markOverdueInstallments, nextReceiptNo } from '@/lib/payment-data';
import { formatBDT } from '@/lib/utils';
import { paymentEntrySchema, saleIdSchema } from '@/lib/validations/payment';

export type { ActionResult } from '@/lib/action-result';

/** একই সেকেন্ডে দুটি এন্ট্রি এলে রসিদ নম্বর সংঘর্ষ হতে পারে — কয়েকবার চেষ্টা */
const RECEIPT_RETRIES = 3;

function revalidatePayments(saleId?: string) {
  revalidatePath('/accounts');
  revalidatePath('/accounts/payments');
  revalidatePath('/accounts/schedule');
  revalidatePath('/accounts/overdue');
  if (saleId) revalidatePath(`/accounts/schedule/${saleId}`);
  revalidatePath('/admin');
  revalidatePath('/admin/payments');
  revalidatePath('/customer');
  revalidatePath('/customer/payments');
}

/**
 * PRD সেকশন ৫.৩ — পেমেন্ট এন্ট্রি।
 *
 * একটি কিস্তির বিপরীতে টাকা জমা নিলে: Payment রেকর্ড তৈরি হয়, কিস্তির স্ট্যাটাস
 * (Paid/Partial/Overdue) নতুন করে হিসাব হয়, ActivityLog এ লেখা হয় (CLAUDE.md নিয়ম ৪),
 * কাস্টমার নোটিফিকেশন পান এবং রসিদ নম্বর ফেরত আসে — UI সেটি দিয়ে প্রিন্টযোগ্য
 * রসিদ খোলে (`/receipts/[id]`)।
 */
export async function recordPayment(
  input: unknown,
): Promise<ActionResult<{ paymentId: string; receiptNo: string }>> {
  const accounts = await getAuthorizedUser('payment:create');
  if (!accounts) return FORBIDDEN;

  const parsed = paymentEntrySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: 'ইনপুট সঠিক নয়', fieldErrors: zodErrors(parsed.error) };
  }

  const { installmentId, amountReceived, method, receiptNo, note, paidAt } = parsed.data;

  const installment = await prisma.installment.findUnique({
    where: { id: installmentId },
    select: {
      id: true,
      label: true,
      amount: true,
      dueDate: true,
      payments: { select: { amountReceived: true } },
      paymentPlan: {
        select: {
          sale: {
            select: {
              id: true,
              customer: { select: { userId: true } },
              unit: { select: { unitNo: true, project: { select: { name: true } } } },
            },
          },
        },
      },
    },
  });
  if (!installment) return NOT_FOUND;

  const amount = Number(installment.amount);
  const alreadyPaid = installment.payments.reduce((sum, p) => sum + Number(p.amountReceived), 0);
  const remaining = amount - alreadyPaid;

  if (remaining <= 0) {
    return { ok: false, message: `"${installment.label}" আগেই সম্পূর্ণ পরিশোধিত` };
  }

  // অতিরিক্ত টাকা এই কিস্তিতে বসালে পরের কিস্তির হিসাব গোলমাল হতো — অগ্রিম
  // পেমেন্ট আলাদা এন্ট্রি হিসেবে পরের কিস্তিতে নিতে হবে
  if (amountReceived > remaining) {
    return {
      ok: false,
      message: `এই কিস্তিতে বাকি ${formatBDT(remaining)} — বেশি টাকা নিলে পরের কিস্তিতে আলাদা এন্ট্রি দিন`,
      fieldErrors: { amountReceived: `সর্বোচ্চ ${formatBDT(remaining)}` },
    };
  }

  const sale = installment.paymentPlan.sale;
  const totalPaid = alreadyPaid + amountReceived;
  const nextStatus = computeInstallmentStatus(
    { amount, dueDate: installment.dueDate },
    totalPaid,
    new Date(),
  );

  let lastError: unknown = null;

  for (let attempt = 0; attempt < RECEIPT_RETRIES; attempt += 1) {
    // ব্যবহারকারী নিজের রসিদ নম্বর দিলে সেটিই — নইলে বছরভিত্তিক ক্রমিক
    const receipt = receiptNo ?? (await nextReceiptNo(paidAt));

    try {
      const payment = await prisma.$transaction(async (tx) => {
        const created = await tx.payment.create({
          data: {
            installmentId,
            amountReceived: new Prisma.Decimal(amountReceived),
            method,
            receiptNo: receipt,
            note: note ?? null,
            receivedById: accounts.id,
            paidAt,
          },
          select: { id: true, receiptNo: true },
        });

        await tx.installment.update({
          where: { id: installmentId },
          data: { status: nextStatus },
        });

        return created;
      });

      await logActivity({
        entityType: 'Payment',
        entityId: payment.id,
        userId: accounts.id,
        action: 'PAYMENT_RECEIVED',
        metadata: {
          saleId: sale.id,
          installmentId,
          installmentLabel: installment.label,
          amountReceived: String(amountReceived),
          method,
          receiptNo: payment.receiptNo,
          installmentStatus: nextStatus,
          remainingAfter: String(Math.max(0, remaining - amountReceived)),
        },
      });

      await notify({
        userId: sale.customer.userId,
        type: 'PAYMENT_DUE',
        message: `${formatBDT(amountReceived)} জমা হয়েছে (${installment.label}) — রসিদ ${payment.receiptNo}`,
        link: `/receipts/${payment.id}`,
      });

      revalidatePayments(sale.id);

      const left = remaining - amountReceived;
      return {
        ok: true,
        message:
          left > 0
            ? `${formatBDT(amountReceived)} জমা হলো — এই কিস্তিতে আরও ${formatBDT(left)} বাকি`
            : `${formatBDT(amountReceived)} জমা হলো — কিস্তিটি সম্পূর্ণ পরিশোধিত`,
        data: { paymentId: payment.id, receiptNo: payment.receiptNo },
      };
    } catch (error) {
      lastError = error;
      const duplicate =
        error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
      if (!duplicate) break;
      // ব্যবহারকারীর দেওয়া নম্বরটাই ডুপ্লিকেট — আবার চেষ্টা করে লাভ নেই
      if (receiptNo) {
        return {
          ok: false,
          message: `রসিদ নম্বর "${receiptNo}" আগেই ব্যবহৃত`,
          fieldErrors: { receiptNo: 'এই নম্বরে রসিদ আছে' },
        };
      }
    }
  }

  console.error('recordPayment failed', lastError);
  return { ok: false, message: 'পেমেন্ট এন্ট্রি করা যায়নি' };
}

/**
 * PRD সেকশন ৫.৩ — ওভারডিউ ডিটেকশন, on-demand।
 * cron ছাড়াও অ্যাকাউন্টস চাইলে বোতাম চেপে এখনই চালাতে পারেন।
 */
export async function runOverdueSweep(): Promise<ActionResult> {
  const accounts = await getAuthorizedUser('paymentPlan:manage');
  if (!accounts) return FORBIDDEN;

  try {
    const result = await markOverdueInstallments();

    if (result.updated > 0) {
      await logActivity({
        entityType: 'Installment',
        entityId: 'sweep',
        userId: accounts.id,
        action: 'OVERDUE_SWEEP',
        metadata: result,
      });
    }

    revalidatePayments();
    return {
      ok: true,
      message:
        result.updated === 0
          ? `${result.scanned} টি কিস্তি যাচাই হয়েছে — সব স্ট্যাটাস ঠিক আছে`
          : `${result.updated} টি কিস্তির স্ট্যাটাস আপডেট হলো (${result.newlyOverdue} টি নতুন বকেয়া)`,
    };
  } catch (error) {
    console.error('runOverdueSweep failed', error);
    return { ok: false, message: 'ওভারডিউ যাচাই করা যায়নি' };
  }
}

/**
 * এই মুহূর্তে বকেয়া/আসন্ন কিস্তির তালিকা — পেমেন্ট এন্ট্রি ডায়ালগের ড্রপডাউন
 * সেল বদলালে এটি ডেকে কিস্তিগুলো আনে।
 */
export async function listPayableInstallments(
  saleId: string,
): Promise<ActionResult<{ installments: PayableInstallment[] }>> {
  const accounts = await getAuthorizedUser('payment:create');
  if (!accounts) return FORBIDDEN;

  // `saleId` ক্লায়েন্ট থেকে আসা কাঁচা string — Prisma তে বসানোর আগে যাচাই
  const parsed = saleIdSchema.safeParse({ saleId });
  if (!parsed.success) return { ok: false, message: 'সেলটি শনাক্ত করা যায়নি' };

  const rows = await prisma.installment.findMany({
    where: { paymentPlan: { saleId: parsed.data.saleId } },
    select: {
      id: true,
      label: true,
      dueDate: true,
      amount: true,
      status: true,
      payments: { select: { amountReceived: true } },
    },
    orderBy: [{ order: 'asc' }, { dueDate: 'asc' }],
  });

  const installments = rows
    .map((row) => {
      const amount = Number(row.amount);
      const paid = row.payments.reduce((sum, p) => sum + Number(p.amountReceived), 0);
      return {
        id: row.id,
        label: row.label,
        dueDateLabel: row.dueDate.toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }),
        remaining: Math.max(0, amount - paid),
        status: computeInstallmentStatus({ amount, dueDate: row.dueDate }, paid, new Date()),
      };
    })
    // পরিশোধিত কিস্তিতে আর টাকা নেওয়ার কিছু নেই
    .filter((row) => row.remaining > 0);

  return { ok: true, message: `${installments.length} টি কিস্তি`, data: { installments } };
}

export type PayableInstallment = {
  id: string;
  label: string;
  dueDateLabel: string;
  remaining: number;
  status: import('@prisma/client').InstallmentStatus;
};
