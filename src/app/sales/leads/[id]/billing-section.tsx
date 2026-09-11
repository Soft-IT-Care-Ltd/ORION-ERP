'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Lock, MessageCircle, Plus, Trash2 } from 'lucide-react';
import { LedgerType } from '@prisma/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { cn, formatBDT } from '@/lib/utils';
import {
  LEDGER_CATEGORY_LABEL,
  LEDGER_TYPE_BADGE,
  LEDGER_TYPE_LABEL,
  LEDGER_TYPE_SHORT,
  PRE_PROJECT_CATEGORIES,
  type LedgerSummary,
} from '@/lib/ledger';
import type { LedgerEntryView } from '@/lib/ledger-data';
import { validate } from '@/lib/validations/form';
import { ledgerEntrySchema } from '@/lib/validations/ledger';
import { createLedgerEntry, deleteLedgerEntry, markLedgerWhatsAppSent } from './ledger-actions';

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-destructive">{message}</p>;
}

/** `yyyy-MM-dd` — `<input type=date>` এর ডিফল্ট (আজ) */
function todayValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate(),
  ).padStart(2, '0')}`;
}

function SummaryTile({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'positive' | 'negative';
}) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          'mt-0.5 text-lg font-semibold tabular-nums',
          tone === 'positive' && 'text-emerald-600 dark:text-emerald-500',
          tone === 'negative' && 'text-destructive',
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/**
 * PRD সেকশন ৫.২ — লিড পর্যায়ের বিলিং ও ইন্টারনাল কস্ট (Won হওয়ার আগেও চলে)।
 *
 * **নিরাপত্তা নীতি:** `canManage` false হলে (MARKETING) ফর্মটাই রেন্ডার হয় না,
 * আর server action ও `ledger:manage` চায় — অর্থাৎ read-only টা শুধু UI এর সাজানো
 * নয়, দুই স্তরেই enforce করা।
 *
 * `clientVisible` ফর্মে নেই: INCOME এন্ট্রি ক্লায়েন্ট দেখেন, EXPENSE কখনো নয় —
 * মানটি server এ `type` থেকেই ঠিক হয়, তাই ভুল করে খরচ ক্লায়েন্টকে দেখানোর
 * সুযোগই থাকে না (PRD সেকশন ৪)।
 */
export function BillingSection({
  leadId,
  entries,
  summary,
  canManage,
}: {
  leadId: string;
  entries: LedgerEntryView[];
  summary: LedgerSummary;
  canManage: boolean;
}) {
  const router = useRouter();
  const [type, setType] = useState<LedgerType>(LedgerType.INCOME);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const input = {
      leadId,
      type,
      category: String(formData.get('category') ?? ''),
      amount: String(formData.get('amount') ?? ''),
      date: String(formData.get('date') ?? ''),
      note: String(formData.get('note') ?? ''),
    };

    const check = validate(ledgerEntrySchema, input);
    if (!check.ok) {
      setErrors(check.fieldErrors);
      toast.error(check.message);
      return;
    }

    startTransition(async () => {
      const result = await createLedgerEntry(input);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.message);
        return;
      }
      setErrors({});
      toast.success(result.message);
      form.reset();
      router.refresh();
    });
  }

  function remove(entry: LedgerEntryView) {
    setBusyId(entry.id);
    startTransition(async () => {
      const result = await deleteLedgerEntry({ id: entry.id });
      setBusyId(null);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      router.refresh();
    });
  }

  /**
   * MVP — `wa.me` deep-link নতুন ট্যাবে খোলে (prefilled মেসেজ, রিসিট ম্যানুয়ালি
   * অ্যাটাচ)। খোলার পর এন্ট্রিটি "পাঠানো হয়েছে" চিহ্নিত হয়, যাতে কোনটা পাঠানো
   * হয়েছে সেটা তালিকা দেখেই বোঝা যায়।
   */
  function sendWhatsApp(entry: LedgerEntryView) {
    if (!entry.whatsAppUrl) return;
    window.open(entry.whatsAppUrl, '_blank', 'noopener,noreferrer');
    startTransition(async () => {
      await markLedgerWhatsAppSent({ id: entry.id });
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryTile
          label="মোট বিল (ক্লায়েন্টকে)"
          value={formatBDT(summary.billed)}
          hint={`${summary.incomeCount} টি এন্ট্রি`}
        />
        <SummaryTile
          label="মোট ইন্টারনাল কস্ট"
          value={formatBDT(summary.cost)}
          hint={`${summary.expenseCount} টি এন্ট্রি`}
        />
        <SummaryTile
          label="নিট (বিল − কস্ট)"
          value={formatBDT(summary.net)}
          tone={summary.net >= 0 ? 'positive' : 'negative'}
        />
      </div>

      {canManage ? (
        <form onSubmit={onSubmit} className="space-y-3 rounded-md border bg-muted/30 p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ledger-type">ধরন</Label>
              <NativeSelect
                id="ledger-type"
                name="type"
                value={type}
                onChange={(event) => setType(event.target.value as LedgerType)}
              >
                {(Object.keys(LEDGER_TYPE_LABEL) as LedgerType[]).map((value) => (
                  <option key={value} value={value}>
                    {LEDGER_TYPE_LABEL[value]}
                  </option>
                ))}
              </NativeSelect>
              <FieldError message={errors.type} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ledger-category">ক্যাটেগরি</Label>
              <NativeSelect id="ledger-category" name="category" defaultValue="SOIL_TEST">
                {PRE_PROJECT_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {LEDGER_CATEGORY_LABEL[category]}
                  </option>
                ))}
              </NativeSelect>
              <FieldError message={errors.category} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ledger-amount">অঙ্ক (৳)</Label>
              <Input
                id="ledger-amount"
                name="amount"
                inputMode="numeric"
                placeholder="5000"
                required
                autoComplete="off"
              />
              <FieldError message={errors.amount} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ledger-date">তারিখ</Label>
              <Input id="ledger-date" name="date" type="date" defaultValue={todayValue()} required />
              <FieldError message={errors.date} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ledger-note">নোট (ঐচ্ছিক)</Label>
            <Textarea
              id="ledger-note"
              name="note"
              rows={2}
              placeholder="যেমন: সয়েল টেস্ট ভেন্ডর — ৩ পয়েন্ট"
            />
            <FieldError message={errors.note} />
          </div>

          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {type === LedgerType.INCOME
              ? 'আয় এন্ট্রিতে রসিদ নম্বর অটো তৈরি হবে এবং ক্লায়েন্ট নিজের পোর্টালে এটি দেখতে পাবেন।'
              : 'খরচ এন্ট্রি শুধু Admin ও Accounts দেখবেন — ক্লায়েন্টের কোথাও কখনো দেখানো হয় না।'}
          </p>

          <Button type="submit" disabled={pending}>
            {pending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            এন্ট্রি যোগ করুন
          </Button>
        </form>
      ) : (
        <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
          বিলিং এন্ট্রি তৈরি করতে পারেন শুধু Admin ও Accounts (PRD সেকশন ৪) — আপনি তালিকাটি
          দেখতে পাচ্ছেন, কিন্তু নতুন এন্ট্রি যোগ করতে অ্যাকাউন্টসকে অনুরোধ করুন।
        </p>
      )}

      {entries.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          এখনো কোনো বিলিং বা খরচের এন্ট্রি নেই।
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="pb-2 pr-3 font-medium">তারিখ</th>
                <th className="pb-2 pr-3 font-medium">ধরন</th>
                <th className="pb-2 pr-3 font-medium">ক্যাটেগরি</th>
                <th className="pb-2 pr-3 text-right font-medium">অঙ্ক</th>
                <th className="pb-2 pr-3 font-medium">রসিদ</th>
                <th className="pb-2 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {entries.map((entry) => (
                <tr key={entry.id} className="align-top">
                  <td className="whitespace-nowrap py-2 pr-3 text-xs text-muted-foreground">
                    {entry.dateLabel}
                  </td>
                  <td className="py-2 pr-3">
                    <span
                      className={cn(
                        'rounded px-1.5 py-0.5 text-[11px] font-medium',
                        LEDGER_TYPE_BADGE[entry.type],
                      )}
                    >
                      {LEDGER_TYPE_SHORT[entry.type]}
                    </span>
                  </td>
                  <td className="py-2 pr-3">
                    {entry.categoryLabel}
                    {entry.note ? (
                      <span className="block text-xs text-muted-foreground">{entry.note}</span>
                    ) : null}
                    <span className="block text-xs text-muted-foreground">
                      {entry.createdByName}
                    </span>
                  </td>
                  <td className="whitespace-nowrap py-2 pr-3 text-right font-medium tabular-nums">
                    {entry.amountLabel}
                  </td>
                  <td className="whitespace-nowrap py-2 pr-3 font-mono text-xs">
                    {entry.receiptNo ?? <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="py-2">
                    <div className="flex items-center justify-end gap-1">
                      {entry.whatsAppUrl ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={pending}
                          onClick={() => sendWhatsApp(entry)}
                        >
                          <MessageCircle className="mr-1.5 h-3.5 w-3.5" />
                          WhatsApp
                        </Button>
                      ) : null}
                      {canManage ? (
                        <button
                          type="button"
                          disabled={busyId === entry.id}
                          onClick={() => remove(entry)}
                          aria-label="এন্ট্রি মুছে ফেলুন"
                          className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                        >
                          {busyId === entry.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
