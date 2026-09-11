'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { CHECKLIST_SUGGESTIONS, checklistProgress } from '@/lib/checklist';
import { validate } from '@/lib/validations/form';
import { addChecklistItemSchema } from '@/lib/validations/checklist';
import { addChecklistItem, deleteChecklistItem, toggleChecklistItem } from './checklist-actions';

/** server এ ফরম্যাট করা চেকলিস্ট সারি (তারিখ string, Date নয়) */
export type ChecklistItemView = {
  id: string;
  label: string;
  done: boolean;
  note: string | null;
  doneByName: string | null;
  doneAtLabel: string | null;
};

/**
 * PRD সেকশন ৫.১ — লিডের চেকলিস্ট।
 *
 * তালিকা fixed নয়: ইউজার নিজের মতো আইটেম লিখতে পারেন, আর সবচেয়ে সাধারণ
 * কাজগুলো quick-add বোতাম থেকে এক ক্লিকে যোগ হয়। যেসব সাজেশন আগেই যোগ করা
 * হয়েছে সেগুলো বোতাম-সারি থেকে সরে যায় — নইলে ডুপ্লিকেট আইটেম জমত।
 */
export function ChecklistSection({
  leadId,
  items,
  canManage,
}: {
  leadId: string;
  items: ChecklistItemView[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [label, setLabel] = useState('');
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  const progress = checklistProgress(items.map((item) => ({ status: item.done ? 'DONE' : 'PENDING' })));
  const existing = new Set(items.map((item) => item.label.trim().toLowerCase()));
  const suggestions = CHECKLIST_SUGGESTIONS.filter((s) => !existing.has(s.toLowerCase()));

  function add(nextLabel: string) {
    const check = validate(addChecklistItemSchema, { leadId, label: nextLabel });
    if (!check.ok) {
      toast.error(Object.values(check.fieldErrors)[0] ?? check.message);
      return;
    }

    startTransition(async () => {
      const result = await addChecklistItem({ leadId, label: nextLabel });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      setLabel('');
      router.refresh();
    });
  }

  function toggle(item: ChecklistItemView) {
    setBusyId(item.id);
    startTransition(async () => {
      const result = await toggleChecklistItem({ id: item.id, done: !item.done });
      setBusyId(null);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      router.refresh();
    });
  }

  function remove(item: ChecklistItemView) {
    setBusyId(item.id);
    startTransition(async () => {
      const result = await deleteChecklistItem({ id: item.id });
      setBusyId(null);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {items.length > 0 ? (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {progress.done}/{progress.total} সম্পন্ন
            </span>
            <span className="tabular-nums">{progress.percent}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-emerald-600 transition-all"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        </div>
      ) : null}

      {canManage ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            add(label);
          }}
          className="space-y-2"
        >
          <Label htmlFor="checklist-label" className="sr-only">
            নতুন চেকলিস্ট আইটেম
          </Label>
          <div className="flex gap-2">
            <Input
              id="checklist-label"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="নতুন কাজ লিখুন — যেমন: নকশা রিভিশন পাঠানো"
              autoComplete="off"
            />
            <Button type="submit" disabled={pending || label.trim().length < 2}>
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              <span className="sr-only">যোগ করুন</span>
            </Button>
          </div>

          {suggestions.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  disabled={pending}
                  onClick={() => add(suggestion)}
                  className="rounded-full border border-dashed px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-solid hover:bg-muted hover:text-foreground disabled:opacity-50"
                >
                  + {suggestion}
                </button>
              ))}
            </div>
          ) : null}
        </form>
      ) : null}

      {items.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          এখনো কোনো চেকলিস্ট আইটেম নেই
          {canManage ? ' — উপরের সাজেশন থেকে যোগ করুন।' : '।'}
        </p>
      ) : (
        <ul className="divide-y rounded-md border">
          {items.map((item) => (
            <li key={item.id} className="flex items-start gap-3 p-3">
              <input
                type="checkbox"
                checked={item.done}
                disabled={!canManage || busyId === item.id}
                onChange={() => toggle(item)}
                aria-label={item.label}
                className="mt-0.5 h-4 w-4 shrink-0 accent-emerald-600 disabled:opacity-50"
              />

              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    'text-sm',
                    item.done && 'text-muted-foreground line-through decoration-muted-foreground/60',
                  )}
                >
                  {item.label}
                </p>
                {item.note ? (
                  <p className="mt-0.5 text-xs text-muted-foreground">{item.note}</p>
                ) : null}
                {item.done && item.doneAtLabel ? (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {item.doneByName ?? 'সিস্টেম'} · {item.doneAtLabel}
                  </p>
                ) : null}
              </div>

              {canManage ? (
                <button
                  type="button"
                  disabled={busyId === item.id}
                  onClick={() => remove(item)}
                  aria-label={`${item.label} — মুছে ফেলুন`}
                  className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                >
                  {busyId === item.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
