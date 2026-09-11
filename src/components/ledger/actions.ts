'use server';

import { revalidatePath } from 'next/cache';
import { LedgerType, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getAuthorizedUser } from '@/lib/guards';
import { logActivity } from '@/lib/activity-log';
import { type ActionResult, FORBIDDEN, NOT_FOUND, zodErrors } from '@/lib/action-result';
import { LEDGER_CATEGORY_LABEL, LEDGER_TYPE_SHORT, resolveClientVisible } from '@/lib/ledger';
import { nextLedgerReceiptNo } from '@/lib/ledger-data';
import { formatBDT } from '@/lib/utils';
import { ledgerEntryIdSchema, ledgerEntrySchema } from '@/lib/validations/ledger';

export type { ActionResult } from '@/lib/action-result';

/**
 * LedgerEntry তৈরি/মোছা — PRD সেকশন ৫.২ (pre-project billing ও internal cost)
 * এবং ৫.৬ (company-wide ledger)।
 *
 * অ্যাকশনগুলো তিন জায়গা থেকে ডাকা হয় — লিড ডিটেইলের Client Ledger ট্যাব,
 * প্রজেক্ট ডিটেইল ও `/accounts/ledger` — তাই কম্পোনেন্টের পাশেই (route folder
 * এ নয়), `components/layout/notification-actions.ts` এর মতো।
 *
 * **শুধু `ledger:manage` (ADMIN ও ACCOUNTS)** এগুলো চালাতে পারে। MARKETING এর
 * কাছে `ledger:view` আছে, তাই সে তালিকা দেখে কিন্তু লিখতে পারে না — UI তে
 * ফর্মটাই দেখানো হয় না, আর অ্যাকশনটি সরাসরি ডাকলেও এখানে আটকে যায়।
 */

/** রসিদ নম্বরের সংঘর্ষ হলে (একই দিনে দুটি এন্ট্রি একসাথে) কতবার আবার চেষ্টা হবে */
const RECEIPT_RETRIES = 3;

async function revalidateLedger(leadId: string | null) {
  if (leadId) {
    revalidatePath(`/sales/leads/${leadId}`);
    // Won হয়ে থাকলে প্রজেক্ট ডিটেইলের Client Ledger কার্ডটিও বাসি হয়ে যায়
    const project = await prisma.project.findUnique({
      where: { leadId },
      select: { id: true },
    });
    if (project) revalidatePath(`/admin/projects/${project.id}`);
  }
  revalidatePath('/accounts');
  revalidatePath('/accounts/ledger');
  revalidatePath('/admin');
}

export async function createLedgerEntry(input: {
  leadId?: string | null;
  type: string;
  category: string;
  amount: string | number;
  date: string;
  note?: string;
}): Promise<ActionResult<{ id: string; receiptNo: string | null }>> {
  const actor = await getAuthorizedUser('ledger:manage');
  if (!actor) return FORBIDDEN;

  const parsed = ledgerEntrySchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors = zodErrors(parsed.error);
    return {
      ok: false,
      message: fieldErrors.amount ?? fieldErrors.date ?? 'ইনপুট সঠিক নয়',
      fieldErrors,
    };
  }
  const { leadId, type, category, amount, date, note } = parsed.data;

  // ক্লায়েন্ট-ট্যাগ করা এন্ট্রি হলে লিডটি সত্যিই আছে কিনা
  const lead = leadId
    ? await prisma.lead.findUnique({ where: { id: leadId }, select: { id: true, name: true } })
    : null;
  if (leadId && !lead) return NOT_FOUND;

  const isIncome = type === LedgerType.INCOME;

  for (let attempt = 0; attempt < RECEIPT_RETRIES; attempt += 1) {
    // PRD সেকশন ৫.২ ও ৫.৬ — রসিদ নম্বর তখনই, যখন এন্ট্রিটি ক্লায়েন্টের কাছ
    // থেকে পাওয়া আয় (INCOME + leadId)। ট্যাগহীন general income (যেমন ব্যাংক
    // সুদ) কোনো ক্লায়েন্টকে দেওয়ার মতো রসিদ নয়
    const receiptNo = isIncome && leadId ? await nextLedgerReceiptNo(date) : null;

    try {
      const entry = await prisma.ledgerEntry.create({
        data: {
          leadId,
          type,
          category,
          amount: new Prisma.Decimal(amount),
          date,
          note: note ?? null,
          receiptNo,
          // PRD সেকশন ৪ — EXPENSE কখনোই ক্লায়েন্ট দেখবে না, আর leadId ছাড়া
          // (company-wide) এন্ট্রি কোনো ক্লায়েন্টের পোর্টালে দেখানোরই উপায় নেই।
          // নিয়মটি `lib/ledger.ts` এ এক জায়গায় — ইনপুট থেকে কখনো আসে না
          clientVisible: resolveClientVisible(type, leadId),
          createdById: actor.id,
        },
        select: { id: true, receiptNo: true },
      });

      await logActivity({
        entityType: 'LedgerEntry',
        entityId: entry.id,
        userId: actor.id,
        action: isIncome ? 'LEDGER_INCOME_ADDED' : 'LEDGER_EXPENSE_ADDED',
        metadata: {
          leadId,
          type,
          category,
          amount: String(amount),
          receiptNo: entry.receiptNo,
        },
      });

      await revalidateLedger(leadId);

      const what = `${LEDGER_TYPE_SHORT[type]} · ${LEDGER_CATEGORY_LABEL[category]} · ${formatBDT(amount)}`;
      return {
        ok: true,
        message: entry.receiptNo ? `${what} — রসিদ ${entry.receiptNo}` : `${what} যোগ হয়েছে`,
        data: { id: entry.id, receiptNo: entry.receiptNo },
      };
    } catch (error) {
      // receiptNo unique — একই মুহূর্তে দুটি এন্ট্রি এলে একটি ব্যর্থ হয়, তখন
      // পরের ক্রমিক নিয়ে আবার চেষ্টা
      const collision =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        String(error.meta?.target ?? '').includes('receiptNo');
      if (collision && attempt < RECEIPT_RETRIES - 1) continue;

      console.error('createLedgerEntry failed', error);
      return { ok: false, message: 'এন্ট্রি যোগ করা যায়নি' };
    }
  }

  return { ok: false, message: 'রসিদ নম্বর তৈরি করা যায়নি — আবার চেষ্টা করুন' };
}

/**
 * ভুল এন্ট্রি মুছে ফেলা। রসিদ নম্বর পুনর্ব্যবহার হয় না (unique constraint
 * থাকলেও সিরিজে ফাঁক থেকে যায়) — হিসাবের খাতায় ফাঁক থাকা ভুল অঙ্ক থাকার
 * চেয়ে ভালো, আর মুছে ফেলার ঘটনাটি `ActivityLog` এ থেকে যায়।
 */
export async function deleteLedgerEntry(input: { id: string }): Promise<ActionResult> {
  const actor = await getAuthorizedUser('ledger:manage');
  if (!actor) return FORBIDDEN;

  const parsed = ledgerEntryIdSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: 'ইনপুট সঠিক নয়', fieldErrors: zodErrors(parsed.error) };
  }

  const entry = await prisma.ledgerEntry.findUnique({
    where: { id: parsed.data.id },
    select: { id: true, leadId: true, type: true, category: true, amount: true, receiptNo: true },
  });
  if (!entry) return NOT_FOUND;

  try {
    await prisma.ledgerEntry.delete({ where: { id: entry.id } });

    await logActivity({
      entityType: 'LedgerEntry',
      entityId: entry.id,
      userId: actor.id,
      action: 'LEDGER_ENTRY_DELETED',
      metadata: {
        leadId: entry.leadId,
        type: entry.type,
        category: entry.category,
        amount: String(entry.amount),
        receiptNo: entry.receiptNo,
      },
    });

    await revalidateLedger(entry.leadId);
    return { ok: true, message: 'এন্ট্রি মুছে ফেলা হয়েছে' };
  } catch (error) {
    console.error('deleteLedgerEntry failed', error);
    return { ok: false, message: 'এন্ট্রি মোছা যায়নি' };
  }
}
