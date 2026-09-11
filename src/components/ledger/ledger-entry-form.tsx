'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Lock, Plus } from 'lucide-react';
import { LedgerType, type LedgerCategory } from '@prisma/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import {
  LEDGER_CATEGORY_LABEL,
  LEDGER_FORM_CATEGORIES,
  LEDGER_TYPE_LABEL,
} from '@/lib/ledger';
import type { LedgerLeadOption } from '@/lib/ledger-data';
import { validate } from '@/lib/validations/form';
import { ledgerEntrySchema } from '@/lib/validations/ledger';
import { createLedgerEntry } from './actions';

/**
 * LedgerEntry তৈরির ফর্ম — PRD সেকশন ৫.২ ও ৫.৬।
 *
 * দুই ভঙ্গিতে চলে:
 *  ১. **লিড/প্রজেক্ট ডিটেইলে** — `leadId` আগেই বাঁধা, ক্লায়েন্ট পিকার থাকে না।
 *  ২. **`/accounts/ledger` এ** — `leads` দেওয়া হয়, ক্লায়েন্ট বাছা *ঐচ্ছিক*;
 *     না বাছলে এন্ট্রিটি কোম্পানি-ওয়াইড general entry (office rent, salary …)।
 *
 * **`clientVisible` ফর্মে নেই।** EXPENSE এ সেটি কখনো true হতে পারবে না (PRD
 * সেকশন ৪), তাই মানটি server action এ `type` থেকেই ঠিক হয় — ইনপুটে না রাখায়
 * সরাসরি অ্যাকশন ডেকেও true পাঠানো যায় না।
 */
export function LedgerEntryForm({
  leadId,
  leads,
  categories = LEDGER_FORM_CATEGORIES,
  defaultCategory,
  amountPlaceholder = '5000',
  notePlaceholder = 'যেমন: সয়েল টেস্ট ভেন্ডর — ৩ পয়েন্ট',
}: {
  /** আগে থেকেই বাঁধা ক্লায়েন্ট (লিড/প্রজেক্ট ডিটেইল) */
  leadId?: string;
  /** ক্লায়েন্ট পিকারের অপশন (`/accounts/ledger`) — না দিলে পিকার আসে না */
  leads?: LedgerLeadOption[];
  categories?: readonly LedgerCategory[];
  defaultCategory?: LedgerCategory;
  amountPlaceholder?: string;
  notePlaceholder?: string;
}) {
  const router = useRouter();
  const [type, setType] = useState<LedgerType>(LedgerType.INCOME);
  const [selectedLeadId, setSelectedLeadId] = useState(leadId ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  const showLeadPicker = leads !== undefined && leadId === undefined;
  const effectiveLeadId = leadId ?? (showLeadPicker ? selectedLeadId : '');
  const isIncome = type === LedgerType.INCOME;

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const input = {
      leadId: effectiveLeadId,
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
      // ধরন ও ক্লায়েন্ট বাছাই React state এ, তাই `reset()` এ মোছে না — একই
      // ক্লায়েন্টে পরপর কয়েকটি এন্ট্রি দেওয়াই স্বাভাবিক
      form.reset();
      router.refresh();
    });
  }

  return (
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
          <NativeSelect
            id="ledger-category"
            name="category"
            defaultValue={defaultCategory ?? categories[0]}
          >
            {categories.map((category) => (
              <option key={category} value={category}>
                {LEDGER_CATEGORY_LABEL[category]}
              </option>
            ))}
          </NativeSelect>
          <FieldError message={errors.category} />
        </div>
      </div>

      {showLeadPicker ? (
        <div className="space-y-2">
          <Label htmlFor="ledger-lead">ক্লায়েন্ট / লিড (ঐচ্ছিক)</Label>
          <NativeSelect
            id="ledger-lead"
            value={selectedLeadId}
            onChange={(event) => setSelectedLeadId(event.target.value)}
          >
            <option value="">— কোম্পানির সাধারণ এন্ট্রি (কোনো ক্লায়েন্ট নয়) —</option>
            {leads?.map((lead) => (
              <option key={lead.id} value={lead.id}>
                {lead.name}
                {lead.hint ? ` — ${lead.hint}` : ''}
                {lead.hasProject ? ' (প্রজেক্ট)' : ''}
              </option>
            ))}
          </NativeSelect>
          <p className="text-xs text-muted-foreground">
            ক্লায়েন্ট বাছলে এন্ট্রিটি তার প্রোফাইলেও যোগ হবে; না বাছলে শুধু কোম্পানি লেজারে
            থাকবে (যেমন অফিস ভাড়া, বেতন)।
          </p>
          <FieldError message={errors.leadId} />
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="ledger-amount">অঙ্ক (৳)</Label>
          <Input
            id="ledger-amount"
            name="amount"
            inputMode="numeric"
            placeholder={amountPlaceholder}
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
        <Textarea id="ledger-note" name="note" rows={2} placeholder={notePlaceholder} />
        <FieldError message={errors.note} />
      </div>

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        {isIncome
          ? effectiveLeadId
            ? 'আয় এন্ট্রিতে রসিদ নম্বর অটো তৈরি হবে এবং ক্লায়েন্ট নিজের পোর্টালে এটি দেখতে পাবেন — WhatsApp এ পাঠানোর অপশনও থাকবে।'
            : 'ক্লায়েন্ট ছাড়া আয় এন্ট্রি শুধু কোম্পানি লেজারে থাকবে — রসিদ নম্বর তৈরি হবে না।'
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
  );
}

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
