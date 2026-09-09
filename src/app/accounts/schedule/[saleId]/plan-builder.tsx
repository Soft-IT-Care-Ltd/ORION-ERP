'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { AlertTriangle, Lock, Loader2, Plus, Trash2, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  balancePercent,
  defaultPlanDates,
  generateSchedule,
  DEFAULT_PLAN_TEMPLATE,
  type InstallmentView,
} from '@/lib/payments';
import { cn, formatBDT } from '@/lib/utils';
import { validate, type ClientInvalid } from '@/lib/validations/form';
import { generatePlanSchema, saveScheduleSchema } from '@/lib/validations/payment';
import { generatePlanFromTemplate, saveSchedule } from '../actions';

/** ফর্মে আলাদা field error দেখানোর জায়গা নেই — প্রথম মেসেজটিই toast এ যায় */
function firstMessage(invalid: ClientInvalid) {
  return Object.values(invalid.fieldErrors)[0] ?? invalid.message;
}

/**
 * PRD সেকশন ৫.৩ — Payment Plan Builder।
 *
 * দুটি উপায়: (১) PRD এর স্যাম্পল টেমপ্লেট থেকে auto-generate, (২) হাতে কিস্তি
 * যোগ/এডিট (label, due date, amount)। দুটোই একই সেভ-পথে যায়, তাই ফলাফলের
 * শিডিউল দেখতে ও আচরণে এক।
 *
 * যে কিস্তিতে টাকা জমা পড়েছে সেটি এখানে তালা-দেওয়া — মোছা যায় না (server ও
 * একই নিয়ম মানে, `accounts/schedule/actions.ts`)।
 */

type Mode = 'template' | 'custom';

/** হাতে-এডিট করা সারি — নতুন সারিতে `id` থাকে না */
type Row = { key: string; id?: string; label: string; dueDate: string; amount: string };

const dateValue = (date: Date) => format(date, 'yyyy-MM-dd');

/** "2027-01-05" → local midnight Date (UTC ধরলে দেশভেদে একদিন পিছিয়ে যেত) */
function parseDate(value: string): Date | null {
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

let rowSeq = 0;
const nextKey = () => `row-${(rowSeq += 1)}`;

function toRows(installments: InstallmentView[]): Row[] {
  return [...installments]
    .sort((a, b) => a.order - b.order)
    .map((i) => ({
      key: nextKey(),
      id: i.id,
      label: i.label,
      dueDate: i.dueDateValue,
      amount: String(i.amount),
    }));
}

export function PlanBuilder({
  saleId,
  totalAmount,
  saleDate,
  installments,
  lockedIds,
}: {
  saleId: string;
  totalAmount: number;
  /** সেলের তারিখ — টেমপ্লেটে বুকিং তারিখের ডিফল্ট ("yyyy-MM-dd") */
  saleDate: string;
  installments: InstallmentView[];
  /** যেসব কিস্তিতে টাকা জমা পড়েছে — মোছা যাবে না */
  lockedIds: string[];
}) {
  const router = useRouter();
  const hasPlan = installments.length > 0;
  const locked = useMemo(() => new Set(lockedIds), [lockedIds]);

  const [mode, setMode] = useState<Mode>(hasPlan ? 'custom' : 'template');
  const [pending, setPending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  /* --------------------------------------------------- টেমপ্লেট ফর্ম state */
  const initialDates = defaultPlanDates(parseDate(saleDate) ?? new Date());
  const [tpl, setTpl] = useState({
    bookingDate: saleDate,
    bookingPercent: String(DEFAULT_PLAN_TEMPLATE.bookingPercent),
    downPaymentPercent: String(DEFAULT_PLAN_TEMPLATE.downPaymentPercent),
    downPaymentDays: String(DEFAULT_PLAN_TEMPLATE.downPaymentDays),
    agreementPercent: String(DEFAULT_PLAN_TEMPLATE.agreementPercent),
    agreementDate: dateValue(initialDates.agreementDate),
    monthlyCount: String(DEFAULT_PLAN_TEMPLATE.monthlyCount),
    monthlyPercent: String(DEFAULT_PLAN_TEMPLATE.monthlyPercent),
    firstInstallmentDate: dateValue(initialDates.firstInstallmentDate),
    handoverDate: dateValue(initialDates.handoverDate),
  });

  const num = (value: string) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  /** বুকিং তারিখ বা কিস্তি-সংখ্যা বদলালে বাকি তারিখগুলো আবার হিসাব করে বসে */
  function syncDates(patch: Partial<typeof tpl>) {
    setTpl((prev) => {
      const next = { ...prev, ...patch };
      const booking = parseDate(next.bookingDate);
      if (!booking) return next;
      const derived = defaultPlanDates(booking, num(next.monthlyCount));
      return {
        ...next,
        agreementDate: dateValue(derived.agreementDate),
        firstInstallmentDate: dateValue(derived.firstInstallmentDate),
        handoverDate: dateValue(derived.handoverDate),
      };
    });
  }

  const handoverPercent = balancePercent({
    bookingPercent: num(tpl.bookingPercent),
    downPaymentPercent: num(tpl.downPaymentPercent),
    agreementPercent: num(tpl.agreementPercent),
    monthlyCount: num(tpl.monthlyCount),
    monthlyPercent: num(tpl.monthlyPercent),
  });

  // লাইভ প্রিভিউ — সেভের আগেই কী তৈরি হবে দেখা যায়
  const preview = useMemo(() => {
    const bookingDate = parseDate(tpl.bookingDate);
    const agreementDate = parseDate(tpl.agreementDate);
    const firstInstallmentDate = parseDate(tpl.firstInstallmentDate);
    const handoverDate = parseDate(tpl.handoverDate);
    if (!bookingDate || !agreementDate || !firstInstallmentDate || !handoverDate) return [];

    return generateSchedule({
      totalAmount,
      bookingDate,
      bookingPercent: num(tpl.bookingPercent),
      downPaymentPercent: num(tpl.downPaymentPercent),
      downPaymentDays: num(tpl.downPaymentDays),
      agreementPercent: num(tpl.agreementPercent),
      agreementDate,
      monthlyCount: num(tpl.monthlyCount),
      monthlyPercent: num(tpl.monthlyPercent),
      firstInstallmentDate,
      handoverDate,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tpl, totalAmount]);

  const previewTotal = preview.reduce((sum, row) => sum + row.amount, 0);

  /* ------------------------------------------------------ কাস্টম সারি state */
  const [rows, setRows] = useState<Row[]>(() => toRows(installments));

  /**
   * টেমপ্লেট চালানোর পর (বা অন্য কেউ শিডিউল বদলালে) server থেকে নতুন কিস্তি আসে —
   * তখন হাতে-এডিটের সারিগুলোও নতুন করে বসাতে হয়, নইলে কাস্টম ট্যাব পুরনো (বা
   * খালি) তালিকা দেখাত। React এর "props বদলালে state মেলানো" প্যাটার্ন — render
   * এর মধ্যেই, effect ছাড়া, যাতে বাসি তালিকা এক ফ্রেমের জন্যও দেখা না যায়।
   */
  const signature = installments
    .map((i) => `${i.id}:${i.label}:${i.dueDateValue}:${i.amount}`)
    .join('|');
  const [syncedFrom, setSyncedFrom] = useState(signature);
  if (signature !== syncedFrom) {
    setSyncedFrom(signature);
    setRows(toRows(installments));
  }

  const customTotal = rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
  const difference = customTotal - totalAmount;

  function updateRow(key: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function addRow() {
    setRows((prev) => {
      const last = prev[prev.length - 1];
      const base = last ? parseDate(last.dueDate) : parseDate(saleDate);
      const due = base ? new Date(base.getFullYear(), base.getMonth() + 1, base.getDate()) : new Date();
      return [
        ...prev,
        {
          key: nextKey(),
          label: `Installment ${prev.length + 1}`,
          dueDate: dateValue(due),
          amount: '',
        },
      ];
    });
  }

  function removeRow(key: string) {
    setRows((prev) => prev.filter((row) => row.key !== key));
  }

  /* --------------------------------------------------------------- submit */

  async function onGenerate() {
    const input = { saleId, ...tpl };

    const check = validate(generatePlanSchema, input);
    if (!check.ok) {
      setConfirmOpen(false);
      toast.error(firstMessage(check));
      return;
    }

    setPending(true);
    const result = await generatePlanFromTemplate(input);
    setPending(false);
    setConfirmOpen(false);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(result.message);
    setMode('custom');
    router.refresh();
  }

  async function onSaveCustom() {
    const input = {
      saleId,
      installments: rows.map((row) => ({
        id: row.id,
        label: row.label,
        dueDate: row.dueDate,
        amount: row.amount,
      })),
    };

    const check = validate(saveScheduleSchema, input);
    if (!check.ok) {
      toast.error(firstMessage(check));
      return;
    }

    setPending(true);
    const result = await saveSchedule(input);
    setPending(false);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(result.message);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">পেমেন্ট প্ল্যান বিল্ডার</CardTitle>
            <CardDescription>
              সেল ভ্যালু {formatBDT(totalAmount)} — টেমপ্লেট থেকে তৈরি করুন বা হাতে সাজান
            </CardDescription>
          </div>
          <div className="inline-flex rounded-md border p-0.5">
            <ModeButton active={mode === 'template'} onClick={() => setMode('template')}>
              টেমপ্লেট
            </ModeButton>
            <ModeButton active={mode === 'custom'} onClick={() => setMode('custom')}>
              কাস্টম কিস্তি
            </ModeButton>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {mode === 'template' ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Field
                id="tpl-booking-date"
                label="বুকিং তারিখ"
                type="date"
                value={tpl.bookingDate}
                onChange={(v) => syncDates({ bookingDate: v })}
              />
              <Field
                id="tpl-booking-pct"
                label="বুকিং মানি (%)"
                type="number"
                step="0.1"
                value={tpl.bookingPercent}
                onChange={(v) => setTpl((p) => ({ ...p, bookingPercent: v }))}
              />
              <Field
                id="tpl-down-pct"
                label="ডাউন পেমেন্ট (%)"
                type="number"
                step="0.1"
                value={tpl.downPaymentPercent}
                onChange={(v) => setTpl((p) => ({ ...p, downPaymentPercent: v }))}
                hint={`বুকিংয়ের ${tpl.downPaymentDays} দিন পরে`}
              />
              <Field
                id="tpl-down-days"
                label="ডাউন পেমেন্ট কত দিনে"
                type="number"
                value={tpl.downPaymentDays}
                onChange={(v) => setTpl((p) => ({ ...p, downPaymentDays: v }))}
              />
              <Field
                id="tpl-agreement-pct"
                label="সেল এগ্রিমেন্ট (%)"
                type="number"
                step="0.1"
                value={tpl.agreementPercent}
                onChange={(v) => setTpl((p) => ({ ...p, agreementPercent: v }))}
              />
              <Field
                id="tpl-agreement-date"
                label="এগ্রিমেন্টের তারিখ"
                type="date"
                value={tpl.agreementDate}
                onChange={(v) => setTpl((p) => ({ ...p, agreementDate: v }))}
              />
              <Field
                id="tpl-monthly-count"
                label="মাসিক কিস্তির সংখ্যা"
                type="number"
                value={tpl.monthlyCount}
                onChange={(v) => syncDates({ monthlyCount: v })}
              />
              <Field
                id="tpl-monthly-pct"
                label="প্রতি কিস্তি (%)"
                type="number"
                step="0.1"
                value={tpl.monthlyPercent}
                onChange={(v) => setTpl((p) => ({ ...p, monthlyPercent: v }))}
                hint={`মোট ${Math.round(num(tpl.monthlyCount) * num(tpl.monthlyPercent) * 100) / 100}%`}
              />
              <Field
                id="tpl-first-date"
                label="প্রথম মাসিক কিস্তি"
                type="date"
                value={tpl.firstInstallmentDate}
                onChange={(v) => setTpl((p) => ({ ...p, firstInstallmentDate: v }))}
              />
              <Field
                id="tpl-handover-date"
                label="হ্যান্ডওভারের তারিখ"
                type="date"
                value={tpl.handoverDate}
                onChange={(v) => setTpl((p) => ({ ...p, handoverDate: v }))}
                hint={`বাকি ${handoverPercent}% এখানে বসবে`}
              />
            </div>

            {handoverPercent <= 0 ? (
              <p className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                শতাংশের যোগফল ১০০% ছুঁয়ে ফেলেছে — হ্যান্ডওভারের জন্য কিছু বাকি রাখুন।
              </p>
            ) : (
              <div className="rounded-md border bg-muted/40 p-3 text-sm">
                <p className="font-medium">
                  {preview.length} টি কিস্তি · মোট {formatBDT(previewTotal)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  হ্যান্ডওভারে বসবে {handoverPercent}% ({formatBDT(preview.at(-1)?.amount ?? 0)}) —
                  PRD এর স্যাম্পল টেবিলের শতাংশগুলো যোগ করলে ৯০% হয়, তাই শেষ কিস্তিটি সবসময়{' '}
                  <span className="font-medium">অবশিষ্ট</span> ধরা হয় যাতে যোগফল ঠিক সেল ভ্যালুর
                  সমান থাকে।
                </p>
                {preview.length > 0 ? (
                  <ul className="mt-2 max-h-40 space-y-0.5 overflow-y-auto text-xs">
                    {preview.map((row) => (
                      <li key={row.order} className="flex justify-between gap-3 tabular-nums">
                        <span className="truncate">
                          {row.order}. {row.label}
                        </span>
                        <span className="shrink-0 text-muted-foreground">
                          {format(row.dueDate, 'dd MMM yyyy')} · {formatBDT(row.amount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            )}

            {hasPlan ? (
              <p className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                এই সেলে আগেই {installments.length} টি কিস্তির শিডিউল আছে — টেমপ্লেট চালালে সেটি মুছে
                নতুন শিডিউল বসবে।
              </p>
            ) : null}

            <Button
              onClick={() => (hasPlan ? setConfirmOpen(true) : onGenerate())}
              disabled={pending || preview.length === 0 || handoverPercent <= 0}
            >
              {pending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Wand2 className="mr-2 h-4 w-4" />
              )}
              শিডিউল তৈরি করুন
            </Button>
          </>
        ) : (
          <>
            <div className="space-y-2">
              {rows.length === 0 ? (
                <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                  কোনো কিস্তি নেই — নিচের বোতাম দিয়ে যোগ করুন, অথবা টেমপ্লেট থেকে তৈরি করুন।
                </p>
              ) : null}

              {rows.map((row, index) => {
                const isLocked = Boolean(row.id && locked.has(row.id));
                return (
                  <div
                    key={row.key}
                    className="grid grid-cols-1 gap-2 rounded-md border p-2 sm:grid-cols-[2rem_1fr_10rem_9rem_2.5rem] sm:items-end"
                  >
                    <span className="hidden pb-2.5 text-center text-xs text-muted-foreground tabular-nums sm:block">
                      {index + 1}
                    </span>
                    <div className="space-y-1">
                      <Label htmlFor={`${row.key}-label`} className="text-xs sm:sr-only">
                        কিস্তির নাম
                      </Label>
                      <Input
                        id={`${row.key}-label`}
                        value={row.label}
                        placeholder="যেমন: Booking Money"
                        onChange={(e) => updateRow(row.key, { label: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`${row.key}-due`} className="text-xs sm:sr-only">
                        শেষ তারিখ
                      </Label>
                      <Input
                        id={`${row.key}-due`}
                        type="date"
                        value={row.dueDate}
                        onChange={(e) => updateRow(row.key, { dueDate: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`${row.key}-amount`} className="text-xs sm:sr-only">
                        অঙ্ক (৳)
                      </Label>
                      <Input
                        id={`${row.key}-amount`}
                        type="number"
                        inputMode="numeric"
                        min="1"
                        step="1"
                        value={row.amount}
                        placeholder="0"
                        onChange={(e) => updateRow(row.key, { amount: e.target.value })}
                      />
                    </div>
                    {isLocked ? (
                      <span
                        className="flex h-10 items-center justify-center text-muted-foreground"
                        title="এই কিস্তিতে টাকা জমা পড়েছে — মোছা যাবে না"
                      >
                        <Lock className="h-4 w-4" />
                      </span>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeRow(row.key)}
                        aria-label={`${row.label || index + 1} নম্বর কিস্তি মুছুন`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
              <Button type="button" variant="outline" onClick={addRow} disabled={pending}>
                <Plus className="mr-2 h-4 w-4" />
                কিস্তি যোগ করুন
              </Button>
              <div className="text-right text-sm">
                <p className="font-medium tabular-nums">
                  মোট {formatBDT(customTotal)} / {formatBDT(totalAmount)}
                </p>
                {difference !== 0 ? (
                  <p className="text-xs font-medium text-destructive tabular-nums">
                    {difference > 0
                      ? `সেল ভ্যালুর চেয়ে ${formatBDT(difference)} বেশি`
                      : `${formatBDT(-difference)} কম`}
                  </p>
                ) : (
                  <p className="text-xs text-emerald-700 dark:text-emerald-400">
                    সেল ভ্যালুর সঙ্গে মিলেছে
                  </p>
                )}
              </div>
            </div>

            <Button onClick={onSaveCustom} disabled={pending || rows.length === 0}>
              {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              শিডিউল সেভ করুন
            </Button>
          </>
        )}
      </CardContent>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>বিদ্যমান শিডিউল বদলে ফেলবেন?</AlertDialogTitle>
            <AlertDialogDescription>
              এখনকার {installments.length} টি কিস্তি মুছে টেমপ্লেট থেকে {preview.length} টি নতুন
              কিস্তি তৈরি হবে। যে কিস্তিতে টাকা জমা পড়েছে সেটি থাকলে কাজটি আটকে যাবে।
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>বাতিল</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={(event) => {
                event.preventDefault();
                void onGenerate();
              }}
            >
              {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              হ্যাঁ, নতুন করে বানান
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded px-3 py-1.5 text-sm font-medium transition-colors',
        active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}

function Field({
  id,
  label,
  hint,
  value,
  onChange,
  ...props
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
} & Omit<React.ComponentProps<'input'>, 'id' | 'value' | 'onChange'>) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} {...props} />
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
