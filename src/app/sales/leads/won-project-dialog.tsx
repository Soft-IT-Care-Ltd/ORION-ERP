'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Check, CheckCircle2, Copy, HardHat, Info, Loader2, UserRound } from 'lucide-react';
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
import { estimateContractValue } from '@/lib/projects';
import { formatBDT } from '@/lib/utils';
import { validate } from '@/lib/validations/form';
import { convertLeadSchema } from '@/lib/validations/convert';
import { convertLeadToProject, type ConvertResult } from './convert-actions';

/** ডায়ালগে যতটুকু লিড তথ্য লাগে */
export type ConvertibleLead = {
  id: string;
  name: string;
  email: string | null;
};

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

/**
 * নতুন কাস্টমার অ্যাকাউন্টের অস্থায়ী পাসওয়ার্ড — একবারই দেখানো হয়, তাই কপি
 * করার সুবিধা দেওয়া দরকার। `navigator.clipboard` না থাকলে (পুরনো ব্রাউজার,
 * insecure origin) ইনপুটটি select করে দেওয়া হয়, যাতে হাতে কপি করা যায়।
 */
function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('কপি করা যায়নি — হাতে নির্বাচন করে কপি করুন');
    }
  }

  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="flex items-center gap-2">
        <code
          className="min-w-0 flex-1 truncate rounded bg-background px-2 py-1.5 font-mono text-sm"
          onClick={(event) => {
            const selection = window.getSelection();
            const range = document.createRange();
            range.selectNodeContents(event.currentTarget);
            selection?.removeAllRanges();
            selection?.addRange(range);
          }}
        >
          {value}
        </code>
        <Button type="button" size="sm" variant="outline" onClick={copy}>
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          <span className="sr-only">কপি করুন</span>
        </Button>
      </div>
    </div>
  );
}

/**
 * PRD সেকশন ৫.৩ — লিড "Won" এ নেওয়ার সময় কনস্ট্রাকশন কন্ট্রাক্টের তথ্য নেওয়ার ফর্ম।
 *
 * কনফার্ম করলে server এ Customer (না থাকলে নতুন অ্যাকাউন্ট) + Project তৈরি হয়,
 * আর গ্লোবাল ফেজ টেমপ্লেট থেকে ফেজগুলো কপি হয়। নতুন অ্যাকাউন্ট হলে অস্থায়ী
 * পাসওয়ার্ডটি এখানেই একবার দেখানো হয় — Admin কপি করে কাস্টমারকে দেবেন।
 */
export function WonProjectDialog({
  open,
  onOpenChange,
  lead,
  onConverted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: ConvertibleLead | null;
  /** সফল হলে — বোর্ড/ডিটেইল পেজ নিজের স্টেট মিলিয়ে নেয় */
  onConverted?: () => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [rate, setRate] = useState('');
  const [sqft, setSqft] = useState('');
  const [amount, setAmount] = useState('');
  const [done, setDone] = useState<ConvertResult | null>(null);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setRate('');
    setSqft('');
    setAmount('');
    setDone(null);
  }, [open]);

  // রেট ও আয়তন দুটোই থাকলে কন্ট্রাক্ট ভ্যালু প্রস্তাব করা হয় — ইউজার চাইলে
  // দরদামের পর অন্য অঙ্ক বসাতে পারেন, তাই কেবল খালি ঘরেই বসে
  const estimate = estimateContractValue(Number(rate) || null, Number(sqft) || null);

  function applyEstimate(nextRate: string, nextSqft: string) {
    const next = estimateContractValue(Number(nextRate) || null, Number(nextSqft) || null);
    if (next !== null) setAmount(String(next));
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!lead) return;

    const formData = new FormData(event.currentTarget);
    const input = {
      leadId: lead.id,
      totalContractValue: amount,
      ratePerSqft: rate,
      totalSqft: sqft,
      startDate: String(formData.get('startDate') ?? ''),
      customerEmail: String(formData.get('customerEmail') ?? ''),
    };

    const check = validate(convertLeadSchema, input);
    if (!check.ok) {
      setErrors(check.fieldErrors);
      toast.error(check.message);
      return;
    }

    setPending(true);
    const result = await convertLeadToProject(input);
    setPending(false);

    if (!result.ok) {
      setErrors(result.fieldErrors ?? {});
      toast.error(result.message);
      return;
    }

    setErrors({});
    toast.success(result.message);
    router.refresh();

    // নতুন অ্যাকাউন্টের পাসওয়ার্ড থাকলে ডায়ালগটি খোলা রেখে সেটি দেখানো হয় —
    // বন্ধ হয়ে গেলে পাসওয়ার্ডটি আর কোথাও পাওয়া যেত না
    if (result.data?.credentials) {
      setDone(result.data);
      return;
    }

    onOpenChange(false);
    onConverted?.();
  }

  if (done?.credentials) {
    return (
      <Dialog open={open} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              প্রজেক্ট তৈরি হয়েছে
            </DialogTitle>
            <DialogDescription>
              {done.phaseCount > 0
                ? `${done.phaseCount} টি ফেজ টেমপ্লেট থেকে তৈরি হয়েছে।`
                : 'ফেজ টেমপ্লেট খালি — Admin → ফেজ টেমপ্লেট থেকে সেট করে নিন।'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/40">
            <p className="flex items-start gap-2 text-xs">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              কাস্টমার পোর্টালের অস্থায়ী লগইন — <span className="font-medium">এখনই কপি করুন</span>,
              এই পাসওয়ার্ড আর দেখানো হবে না।
            </p>
            <CopyField label="ইমেইল" value={done.credentials.email} />
            <CopyField label="অস্থায়ী পাসওয়ার্ড" value={done.credentials.password} />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                onConverted?.();
              }}
            >
              বন্ধ করুন
            </Button>
            <Button
              type="button"
              onClick={() => {
                onOpenChange(false);
                onConverted?.();
                router.push(`/admin/projects/${done.projectId}`);
              }}
            >
              প্রজেক্ট দেখুন
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (pending ? null : onOpenChange(next))}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>প্রজেক্ট তৈরি করুন (Won)</DialogTitle>
          <DialogDescription>
            <span className="font-medium text-foreground">{lead?.name}</span> এর কন্ট্রাক্ট সাইন ও
            প্রথম পেমেন্ট পাওয়া গেছে — কন্ট্রাক্টের তথ্য দিন।
          </DialogDescription>
        </DialogHeader>

        <form key={lead?.id ?? 'none'} onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="convert-rate">রেট প্রতি sqft (৳, ঐচ্ছিক)</Label>
              <Input
                id="convert-rate"
                name="ratePerSqft"
                inputMode="numeric"
                placeholder="2200"
                value={rate}
                onChange={(event) => {
                  setRate(event.target.value);
                  applyEstimate(event.target.value, sqft);
                }}
                autoComplete="off"
              />
              <FieldError message={errors.ratePerSqft} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="convert-sqft">মোট sqft (ঐচ্ছিক)</Label>
              <Input
                id="convert-sqft"
                name="totalSqft"
                inputMode="numeric"
                placeholder="2400"
                value={sqft}
                onChange={(event) => {
                  setSqft(event.target.value);
                  applyEstimate(rate, event.target.value);
                }}
                autoComplete="off"
              />
              <FieldError message={errors.totalSqft} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="convert-amount">মোট কন্ট্রাক্ট ভ্যালু (৳)</Label>
            <Input
              id="convert-amount"
              name="totalContractValue"
              inputMode="numeric"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              required
              autoFocus
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              {estimate !== null
                ? `রেট × sqft = ${formatBDT(estimate)} — দরদামের পর চূড়ান্ত অঙ্ক বসান।`
                : 'রেট ও sqft দিলে অঙ্কটি নিজে থেকেই বসে যাবে।'}
            </p>
            <FieldError message={errors.totalContractValue} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="convert-start">নির্মাণ শুরুর তারিখ (ঐচ্ছিক)</Label>
            <Input id="convert-start" name="startDate" type="date" defaultValue={todayValue()} />
            <p className="text-xs text-muted-foreground">
              এই তারিখ ধরেই ফেজগুলোর পরিকল্পিত সময়সূচি তৈরি হবে।
            </p>
            <FieldError message={errors.startDate} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="convert-customer-email">কাস্টমারের ইমেইল (ঐচ্ছিক)</Label>
            <Input
              id="convert-customer-email"
              name="customerEmail"
              type="email"
              defaultValue={lead?.email ?? ''}
              placeholder="customer@example.com"
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              কাস্টমার পোর্টালের লগইন এই ইমেইলে হবে। না দিলে অস্থায়ী ইমেইল বসবে — Admin পরে ঠিক
              করে দিতে পারবেন।
            </p>
            <FieldError message={errors.customerEmail} />
          </div>

          {/* কনফার্ম করলে ঠিক কী কী হবে — ভুল করে ক্লিক ঠেকাতে */}
          <div className="space-y-1.5 rounded-md border bg-muted/40 p-3 text-xs">
            <p className="flex items-start gap-2">
              <UserRound className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              কাস্টমার প্রোফাইল তৈরি হবে (না থাকলে নতুন অ্যাকাউন্ট — নাম ও ফোন লিড থেকে,
              অস্থায়ী পাসওয়ার্ড দেখানো হবে)
            </p>
            <p className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
              প্রজেক্ট রেকর্ড তৈরি হবে — লিডের জমি ও বাড়ির ধরন সহ
            </p>
            <p className="flex items-start gap-2">
              <HardHat className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              গ্লোবাল ফেজ টেমপ্লেট থেকে ফেজগুলো তৈরি হবে (সব <span className="font-medium">আসন্ন</span>)
            </p>
            <p className="flex items-start gap-2 text-muted-foreground">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              পেমেন্ট প্ল্যান Accounts/Admin পরে সেট করবেন।
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              বাতিল
            </Button>
            <Button type="submit" disabled={pending || !amount}>
              {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              প্রজেক্ট তৈরি করুন
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
