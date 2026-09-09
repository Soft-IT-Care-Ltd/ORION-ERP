'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowDown, ArrowUp, Loader2, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DEFAULT_PHASE_TEMPLATE, PHASE_NAME_BN } from '@/lib/phases';
import { validate } from '@/lib/validations/form';
import { savePhaseTemplateSchema } from '@/lib/validations/project';
import { savePhaseTemplate } from '../actions';

export type TemplateRow = { name: string; defaultDurationDays: string };

/**
 * PRD সেকশন ৫.২ — প্রজেক্টের ফেজ টেমপ্লেট (customizable)।
 *
 * টেমপ্লেট একটি *ব্লুপ্রিন্ট*: নতুন ইউনিট তৈরির সময় (বা "টেমপ্লেট প্রয়োগ" চাপলে)
 * এখান থেকে ইউনিটের নিজের Phase গুলো তৈরি হয়। আগে তৈরি হওয়া ইউনিটের টাইমলাইন
 * এতে বদলায় না — সেখানে ইঞ্জিনিয়ারের অগ্রগতি ও ছবি জমে আছে।
 */
export function PhaseTemplateEditor({
  projectId,
  initial,
}: {
  projectId: string;
  initial: TemplateRow[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState<TemplateRow[]>(
    initial.length > 0 ? initial : defaultRows(),
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  function update(index: number, patch: Partial<TemplateRow>) {
    setError(undefined);
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= rows.length) return;
    setRows((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function onSave() {
    const check = validate(savePhaseTemplateSchema, { projectId, phases: rows });
    if (!check.ok) {
      const message = Object.values(check.fieldErrors)[0] ?? check.message;
      setError(message);
      toast.error(message);
      return;
    }

    setPending(true);
    const result = await savePhaseTemplate({ projectId, phases: rows });
    setPending(false);

    if (result.ok) {
      setError(undefined);
      toast.success(result.message);
      router.refresh();
    } else {
      setError(result.message);
      toast.error(result.message);
    }
  }

  const totalDays = rows.reduce((sum, row) => sum + (Number(row.defaultDurationDays) || 0), 0);

  return (
    <div className="space-y-3">
      <ol className="space-y-2">
        {rows.map((row, index) => (
          <li key={index} className="flex flex-wrap items-end gap-2 rounded-md border p-2 sm:flex-nowrap">
            {/* ক্রম + নাম একসঙ্গে — মোবাইলে এরা পুরো সারি নেয়, নইলে নামের ঘরটি
                ~১৫০px এ নেমে "Land Acquisi" এর মতো কাটা দেখাত */}
            <div className="flex w-full min-w-0 items-end gap-2 sm:w-auto sm:flex-1">
              <span className="flex h-10 w-7 shrink-0 items-center justify-center text-sm font-semibold text-muted-foreground">
                {index + 1}
              </span>

              <div className="min-w-0 flex-1 space-y-1">
                <Label htmlFor={`phase-name-${index}`} className="sr-only">
                  ফেজ {index + 1} এর নাম
                </Label>
                <Input
                  id={`phase-name-${index}`}
                  value={row.name}
                  onChange={(event) => update(index, { name: event.target.value })}
                  placeholder="ফেজের নাম"
                  autoComplete="off"
                />
                {PHASE_NAME_BN[row.name] ? (
                  <p className="text-xs text-muted-foreground">{PHASE_NAME_BN[row.name]}</p>
                ) : null}
              </div>
            </div>

            <div className="w-28 shrink-0 space-y-1">
              <Label htmlFor={`phase-days-${index}`} className="sr-only">
                ফেজ {index + 1} এর সময়কাল (দিন)
              </Label>
              <div className="relative">
                <Input
                  id={`phase-days-${index}`}
                  value={row.defaultDurationDays}
                  onChange={(event) =>
                    update(index, { defaultDurationDays: event.target.value.replace(/\D/g, '') })
                  }
                  inputMode="numeric"
                  placeholder="দিন"
                  className="pr-9"
                  autoComplete="off"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  দিন
                </span>
              </div>
            </div>

            <div className="ml-auto flex shrink-0 gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`ফেজ ${index + 1} উপরে নিন`}
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`ফেজ ${index + 1} নিচে নিন`}
                disabled={index === rows.length - 1}
                onClick={() => move(index, 1)}
              >
                <ArrowDown className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`ফেজ ${index + 1} সরান`}
                disabled={rows.length === 1}
                onClick={() => setRows((current) => current.filter((_, i) => i !== index))}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </li>
        ))}
      </ol>

      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setRows((current) => [...current, { name: '', defaultDurationDays: '' }])}
        >
          <Plus className="mr-2 h-4 w-4" />
          ফেজ যোগ
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setRows(defaultRows())}>
          <RotateCcw className="mr-2 h-4 w-4" />
          ডিফল্ট ৮ ফেজ
        </Button>

        <p className="ml-auto text-xs text-muted-foreground">
          মোট {rows.length} ফেজ · আনুমানিক {totalDays} দিন (~{Math.round(totalDays / 30)} মাস)
        </p>

        <Button type="button" size="sm" onClick={() => void onSave()} disabled={pending}>
          {pending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          টেমপ্লেট সেভ
        </Button>
      </div>
    </div>
  );
}

function defaultRows(): TemplateRow[] {
  return DEFAULT_PHASE_TEMPLATE.map((phase) => ({
    name: phase.name,
    defaultDurationDays: String(phase.defaultDurationDays),
  }));
}
