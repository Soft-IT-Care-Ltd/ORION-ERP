'use server';

import { revalidatePath } from 'next/cache';
import { LedgerType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getAuthorizedUser } from '@/lib/guards';
import { type ActionResult, FORBIDDEN, NOT_FOUND } from '@/lib/action-result';
import { id as idSchema } from '@/lib/validations/common';

export type { ActionResult } from '@/lib/action-result';

/**
 * "WhatsApp এ পাঠানো হয়েছে" চিহ্ন — deep-link খোলার পর UI এটি ডাকে
 * (PRD সেকশন ৫.২ ও ৫.৫)।
 *
 * রসিদটি আসলে পাঠানো হলো কিনা সেটি ব্রাউজার থেকে জানার উপায় নেই — `wa.me`
 * লিংক নতুন ট্যাবে খোলার পর WhatsApp এ কী হলো তা আমাদের হাতে থাকে না। তাই
 * এখানে "পাঠানোর চেষ্টা হয়েছে" টুকুই লেখা হয়, যাতে তালিকা দেখে বোঝা যায়
 * কোনগুলো ইতিমধ্যে হাতে নেওয়া হয়েছে।
 */

function parseId(value: string): string | null {
  const parsed = idSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** LedgerEntry (pre-project সার্ভিস বিল) — শুধু INCOME এন্ট্রিতে রসিদ থাকে */
export async function markLedgerWhatsAppSent(input: { id: string }): Promise<ActionResult> {
  const actor = await getAuthorizedUser('ledger:manage');
  if (!actor) return FORBIDDEN;

  const entryId = parseId(input.id);
  if (!entryId) return { ok: false, message: 'ইনপুট সঠিক নয়' };

  const entry = await prisma.ledgerEntry.findUnique({
    where: { id: entryId },
    select: { id: true, leadId: true, type: true },
  });
  if (!entry || entry.type !== LedgerType.INCOME) return NOT_FOUND;

  await prisma.ledgerEntry.update({
    where: { id: entry.id },
    data: { whatsappSentAt: new Date() },
  });

  if (entry.leadId) revalidatePath(`/sales/leads/${entry.leadId}`);
  revalidatePath('/accounts');
  revalidatePath('/accounts/ledger');
  return { ok: true, message: 'WhatsApp এ পাঠানো হিসেবে চিহ্নিত' };
}

/** Payment (কনস্ট্রাকশন কিস্তির রসিদ) */
export async function markPaymentWhatsAppSent(input: { id: string }): Promise<ActionResult> {
  const actor = await getAuthorizedUser('receipt:generate');
  if (!actor) return FORBIDDEN;

  const paymentId = parseId(input.id);
  if (!paymentId) return { ok: false, message: 'ইনপুট সঠিক নয়' };

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: {
      id: true,
      installment: { select: { paymentPlan: { select: { projectId: true } } } },
    },
  });
  if (!payment) return NOT_FOUND;

  await prisma.payment.update({
    where: { id: payment.id },
    data: { whatsappSentAt: new Date() },
  });

  revalidatePath('/accounts/payments');
  revalidatePath(`/accounts/schedule/${payment.installment.paymentPlan.projectId}`);
  revalidatePath(`/receipts/${payment.id}`);
  return { ok: true, message: 'WhatsApp এ পাঠানো হিসেবে চিহ্নিত' };
}
