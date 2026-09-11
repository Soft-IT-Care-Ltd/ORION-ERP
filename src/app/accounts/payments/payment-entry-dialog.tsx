'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Banknote, CheckCircle2, Loader2, Printer } from 'lucide-react';
import { PaymentMethod } from '@prisma/client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import {
  INSTALLMENT_STATUS_LABEL,
  METHOD_NOTE_HINT,
  PAYMENT_METHOD_LABEL,
} from '@/lib/payments';
import { formatBDT } from '@/lib/utils';
import { validate } from '@/lib/validations/form';
import { paymentEntrySchema } from '@/lib/validations/payment';
import { listPayableInstallments, recordPayment, type PayableInstallment } from './actions';

/**
 * PRD সেকশন ৫.৩ — পেমেন্ট এন্ট্রি ফর্ম।
 *
 * কিস্তি বেছে, প্রাপ্ত টাকা, মাধ্যম (Cash/Bank/bKash/Nagad/Cheque) ও রসিদ নম্বর
 * দিয়ে সাবমিট করলে Payment রেকর্ড তৈরি হয়, কিস্তির স্ট্যাটাস আপডেট হয় এবং
 * প্রিন্টযোগ্য রসিদের লিংক আসে।
 *
 * দুই জায়গা থেকে খোলে — শিডিউল পেজে নির্দিষ্ট কিস্তির বিপরীতে (তখন প্রজেক্ট ও
 * কিস্তি আগেই বাছা), আর পেমেন্ট পেজে যেকোনো প্রজেক্ট বেছে নিয়ে।
 */

export type ProjectOption = { id: string; label: string; customerName: string };

export function PaymentEntryDialog({
  open,
  onOpenChange,
  projects,
  /** শুরুতেই বাছা প্রজেক্ট (শিডিউল পেজ থেকে খুললে) */
  initialProjectId,
  /** শুরুতেই বাছা কিস্তি */
  initialInstallmentId,
  /** initialProjectId এর কিস্তিগুলো — থাকলে প্রথমবার আর server call লাগে না */
  initialInstallments,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: ProjectOption[];
  initialProjectId?: string;
  initialInstallmentId?: string;
  initialInstallments?: PayableInstallment[];
}) {
  const router = useRouter();
  const [projectId, setProjectId] = useState(initialProjectId ?? projects[0]?.id ?? '');
  const [installments, setInstallments] = useState<PayableInstallment[]>(
    initialInstallments ?? [],
  );
  const [installmentId, setInstallmentId] = useState(initialInstallmentId ?? '');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [receiptNo, setReceiptNo] = useState('');
  const [note, setNote] = useState('');
  const [paidAt, setPaidAt] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [loading, startLoading] = useTransition();
  const [done, setDone] = useState<{ paymentId: string; receiptNo: string } | null>(null);
  /** কোন প্রজেক্টের কিস্তি তালিকা ইতিমধ্যে আনা হয়েছে — একই কল বারবার ঠেকাতে */
  const [fetchedFor, setFetchedFor] = useState<string | null>(
    initialInstallments ? (initialProjectId ?? null) : null,
  );
  /** সফল এন্ট্রি হয়েছে — ডায়ালগ বন্ধ করার সময় পেজটি রিফ্রেশ করতে হবে */
  const [needsRefresh, setNeedsRefresh] = useState(false);

  const selected = installments.find((i) => i.id === installmentId) ?? null;

  /**
   * ডায়ালগ খোলার মুহূর্তে ফর্ম পরিষ্কার।
   *
   * ইচ্ছে করেই effect নয়। `initialInstallments`/`projects` প্রতিবার নতুন array হিসেবে
   * আসে, তাই parent যেকোনো কারণে রি-রেন্ডার হলেই effect আবার চলত এবং সফলতার
   * প্যানেলটি (রসিদের লিংকসহ) মুছে যেত। `open` এর transition ধরে render-এর
   * মধ্যেই রিসেট করলে ঠিক খোলার সময়ই — এবং কেবল তখনই — ফর্ম পরিষ্কার হয়।
   */
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      const startRows = initialInstallments ?? [];
      const preset = initialInstallmentId
        ? startRows.find((row) => row.id === initialInstallmentId)
        : undefined;

      setErrors({});
      setDone(null);
      setMethod(PaymentMethod.CASH);
      setReceiptNo('');
      setNote('');
      setPaidAt(format(new Date(), 'yyyy-MM-dd'));
      setProjectId(initialProjectId ?? projects[0]?.id ?? '');
      setInstallments(startRows);
      setInstallmentId(initialInstallmentId ?? '');
      // প্রি-সিলেক্ট করা কিস্তির পুরো বাকি টাকা ডিফল্টে বসে
      setAmount(preset ? String(preset.remaining) : '');
      setFetchedFor(initialInstallments ? (initialProjectId ?? null) : null);
      setNeedsRefresh(false);
    }
  }

  /** একটি প্রজেক্টের পরিশোধযোগ্য কিস্তি এনে ড্রপডাউনে বসানো */
  const fetchInstallments = useCallback((nextProjectId: string, preferId?: string) => {
    setFetchedFor(nextProjectId);
    startLoading(async () => {
      const result = await listPayableInstallments(nextProjectId);
      if (!result.ok) {
        toast.error(result.message);
        setInstallments([]);
        return;
      }
      const rows = result.data?.installments ?? [];
      setInstallments(rows);
      // চাওয়া কিস্তি → নইলে বকেয়াটি → নইলে ক্রমের প্রথমটি
      const preferred =
        (preferId ? rows.find((row) => row.id === preferId) : undefined) ??
        rows.find((row) => row.status === 'OVERDUE') ??
        rows[0];
      if (preferred) {
        setInstallmentId(preferred.id);
        setAmount(String(preferred.remaining));
      }
    });
  }, []);

  /**
   * প্রজেক্ট আগেই বাছা কিন্তু কিস্তির তালিকা সঙ্গে আসেনি — পেমেন্ট পেজের সারি
   * থেকে খুললে এমনই হয় (সব প্রজেক্টের কিস্তি আগেভাগে পাঠানো অপচয় হতো)। তখন খোলার পর
   * তালিকাটি আনা হয়।
   */
  useEffect(() => {
    if (!open || !projectId || fetchedFor === projectId) return;
    fetchInstallments(projectId, initialInstallmentId);
  }, [open, projectId, fetchedFor, initialInstallmentId, fetchInstallments]);

  /** ব্যবহারকারী ড্রপডাউনে প্রজেক্ট বদলালে */
  function loadInstallments(nextProjectId: string) {
    setProjectId(nextProjectId);
    setInstallmentId('');
    setAmount('');
    if (!nextProjectId) {
      setInstallments([]);
      setFetchedFor(null);
      return;
    }
    fetchInstallments(nextProjectId);
  }

  function onInstallmentChange(nextId: string) {
    setInstallmentId(nextId);
    // ডিফল্টে পুরো বাকি টাকা — আংশিক নিলে ব্যবহারকারী কমিয়ে নেবেন
    const row = installments.find((i) => i.id === nextId);
    setAmount(row ? String(row.remaining) : '');
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const input = { installmentId, amountReceived: amount, method, receiptNo, note, paidAt };
    const check = validate(paymentEntrySchema, input);
    if (!check.ok) {
      setErrors(check.fieldErrors);
      toast.error(check.message);
      return;
    }

    setPending(true);
    const result = await recordPayment(input);
    setPending(false);

    if (!result.ok) {
      setErrors(result.fieldErrors ?? {});
      toast.error(result.message);
      return;
    }

    setErrors({});
    toast.success(result.message);
    setDone(result.data ?? null);
    // এখানে `router.refresh()` করা যাবে না — কিস্তিটি পরিশোধিত হয়ে গেলে সারির
    // "জমা নিন" বোতামটি server render থেকে সরে যায়, আর তার সঙ্গে এই ডায়ালগটিও
    // unmount হয়ে যেত — রসিদের লিংক দেখার আগেই। বন্ধ করার সময় রিফ্রেশ হবে।
    setNeedsRefresh(true);
  }

  /** বন্ধ হওয়ার সময় (এবং তখনই) বাসি ডেটা রিফ্রেশ */
  function handleOpenChange(next: boolean) {
    if (pending) return;
    onOpenChange(next);
    if (!next && needsRefresh) {
      setNeedsRefresh(false);
      router.refresh();
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{done ? 'পেমেন্ট জমা হয়েছে' : 'পেমেন্ট এন্ট্রি'}</DialogTitle>
          <DialogDescription>
            {done
              ? `রসিদ নম্বর ${done.receiptNo} — নিচের বোতাম থেকে প্রিন্ট বা PDF করে নিন।`
              : 'কিস্তি বেছে প্রাপ্ত টাকা, মাধ্যম ও রসিদ নম্বর দিন।'}
          </DialogDescription>
        </DialogHeader>

        {done ? (
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-md border bg-emerald-50 p-3 text-sm dark:bg-emerald-950/30">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <p>
                পেমেন্টটি রেকর্ড হয়েছে, কিস্তির স্ট্যাটাস আপডেট হয়েছে এবং কাস্টমার নোটিফিকেশন
                পেয়েছেন।
              </p>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                বন্ধ করুন
              </Button>
              <Button asChild>
                <Link href={`/receipts/${done.paymentId}`} target="_blank">
                  <Printer className="mr-2 h-4 w-4" />
                  রসিদ দেখুন
                </Link>
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            {projects.length > 1 || !initialProjectId ? (
              <div className="space-y-2">
                <Label htmlFor="pay-project">প্রজেক্ট</Label>
                <NativeSelect
                  id="pay-project"
                  value={projectId}
                  onChange={(e) => loadInstallments(e.target.value)}
                  required
                >
                  <option value="" disabled>
                    — প্রজেক্ট নির্বাচন করুন —
                  </option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.customerName} — {project.label}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="pay-installment">কিস্তি</Label>
              <NativeSelect
                id="pay-installment"
                value={installmentId}
                onChange={(e) => onInstallmentChange(e.target.value)}
                required
                disabled={loading || installments.length === 0}
              >
                <option value="" disabled>
                  {loading
                    ? 'লোড হচ্ছে…'
                    : installments.length === 0
                      ? 'পরিশোধযোগ্য কিস্তি নেই'
                      : '— কিস্তি নির্বাচন করুন —'}
                </option>
                {installments.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.label} · {row.dueDateLabel} · বাকি {formatBDT(row.remaining)} ·{' '}
                    {INSTALLMENT_STATUS_LABEL[row.status]}
                  </option>
                ))}
              </NativeSelect>
              <FieldError message={errors.installmentId} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="pay-amount">প্রাপ্ত টাকা (৳)</Label>
                <Input
                  id="pay-amount"
                  type="number"
                  inputMode="numeric"
                  min="1"
                  step="1"
                  max={selected?.remaining}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
                {selected ? (
                  <p className="text-xs text-muted-foreground">
                    এই কিস্তিতে বাকি {formatBDT(selected.remaining)} — কম দিলে আংশিক (Partial) হবে।
                  </p>
                ) : null}
                <FieldError message={errors.amountReceived} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pay-date">তারিখ</Label>
                <Input
                  id="pay-date"
                  type="date"
                  value={paidAt}
                  onChange={(e) => setPaidAt(e.target.value)}
                  required
                />
                <FieldError message={errors.paidAt} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pay-method">মাধ্যম</Label>
              <NativeSelect
                id="pay-method"
                value={method}
                onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                required
              >
                {Object.values(PaymentMethod).map((value) => (
                  <option key={value} value={value}>
                    {PAYMENT_METHOD_LABEL[value]}
                  </option>
                ))}
              </NativeSelect>
              <FieldError message={errors.method} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pay-note">
                রেফারেন্স {METHOD_NOTE_HINT[method] ? `(${METHOD_NOTE_HINT[method]})` : '(ঐচ্ছিক)'}
              </Label>
              <Input
                id="pay-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={METHOD_NOTE_HINT[method] ?? 'অতিরিক্ত তথ্য'}
              />
              <FieldError message={errors.note} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pay-receipt">রসিদ নম্বর (ঐচ্ছিক)</Label>
              <Input
                id="pay-receipt"
                value={receiptNo}
                onChange={(e) => setReceiptNo(e.target.value)}
                placeholder="খালি রাখলে ORB-YYYY-000001 ধরনে তৈরি হবে"
                autoComplete="off"
              />
              <FieldError message={errors.receiptNo} />
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={pending}
              >
                বাতিল
              </Button>
              <Button type="submit" disabled={pending || !installmentId || !amount}>
                {pending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Banknote className="mr-2 h-4 w-4" />
                )}
                জমা নিন
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-destructive">{message}</p>;
}

/** ডায়ালগ খোলার বোতাম — শিডিউল টেবিলের সারিতে ও পেজ হেডারে বসে */
export function PaymentEntryButton({
  projects,
  initialProjectId,
  initialInstallmentId,
  initialInstallments,
  label = 'পেমেন্ট এন্ট্রি',
  size = 'default',
  variant = 'default',
  className,
}: {
  projects: ProjectOption[];
  initialProjectId?: string;
  initialInstallmentId?: string;
  initialInstallments?: PayableInstallment[];
  label?: string;
  size?: 'default' | 'sm' | 'lg' | 'icon';
  variant?: 'default' | 'outline' | 'secondary' | 'ghost';
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size={size} variant={variant} className={className} onClick={() => setOpen(true)}>
        <Banknote className="mr-2 h-4 w-4" />
        {label}
      </Button>
      <PaymentEntryDialog
        open={open}
        onOpenChange={setOpen}
        projects={projects}
        initialProjectId={initialProjectId}
        initialInstallmentId={initialInstallmentId}
        initialInstallments={initialInstallments}
      />
    </>
  );
}
