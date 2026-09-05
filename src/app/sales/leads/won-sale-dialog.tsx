'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Building2, CheckCircle2, Info, Loader2 } from 'lucide-react';
import type { UnitStatus } from '@prisma/client';
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
import { UNIT_STATUS_LABEL } from '@/lib/sales';
import { convertLeadToSale } from './sale-actions';

/** সেল কনফার্ম ডায়ালগের ইউনিট অপশন — দাম ও স্ট্যাটাস সহ (server এ ফরম্যাট করা) */
export type SaleUnitOption = {
  id: string;
  projectName: string;
  unitNo: string;
  /** `<input type="number">` এ বসানোর মতো plain সংখ্যা */
  price: string;
  /** "৳45,00,000" */
  priceLabel: string;
  status: UnitStatus;
  /** আগেই বিক্রি হয়ে গেছে — নির্বাচন করা যাবে না */
  taken: boolean;
};

/** ডায়ালগে যতটুকু লিড তথ্য লাগে */
export type ConvertibleLead = {
  id: string;
  name: string;
  email: string | null;
  /** লিডে আগ্রহ দেখানো ইউনিট — থাকলে ড্রপডাউনে প্রি-সিলেক্ট হয় */
  unitId: string | null;
};

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-destructive">{message}</p>;
}

/**
 * PRD সেকশন ৫.১ — লিড "Won" এ নেওয়ার সময় ইউনিট ও চূড়ান্ত মূল্য নিশ্চিত করার ফর্ম।
 * কনফার্ম করলে server এ Customer + Sale (ড্রাফট) তৈরি হয় ও ইউনিট SOLD হয়;
 * পেমেন্ট প্ল্যান Accounts/Admin পরে সেট করে সেলটি কনফার্ম করবেন (Phase 4)।
 */
export function WonSaleDialog({
  open,
  onOpenChange,
  lead,
  units,
  onConverted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: ConvertibleLead | null;
  units: SaleUnitOption[];
  /** সফল হলে — বোর্ড/ডিটেইল পেজ নিজের স্টেট মিলিয়ে নেয় */
  onConverted?: () => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [unitId, setUnitId] = useState('');
  const [amount, setAmount] = useState('');

  const available = useMemo(() => units.filter((u) => !u.taken), [units]);

  // প্রজেক্ট অনুযায়ী গ্রুপ — ড্রপডাউনে `<optgroup>`
  const groups = useMemo(() => {
    const map = new Map<string, SaleUnitOption[]>();
    for (const unit of available) {
      const list = map.get(unit.projectName);
      if (list) list.push(unit);
      else map.set(unit.projectName, [unit]);
    }
    return [...map.entries()];
  }, [available]);

  // প্রতিবার খোলার সময় লিডের আগ্রহী ইউনিট (খালি থাকলে) প্রি-সিলেক্ট
  useEffect(() => {
    if (!open) return;
    setErrors({});
    const preset = available.find((u) => u.id === lead?.unitId) ?? null;
    setUnitId(preset?.id ?? '');
    setAmount(preset?.price ?? '');
  }, [open, lead?.unitId, available]);

  const selected = available.find((u) => u.id === unitId) ?? null;

  function onUnitChange(nextId: string) {
    setUnitId(nextId);
    // দাম সবসময় ইউনিটের তালিকা-মূল্য থেকে শুরু হয় — দরদামের পর বদলানো যায়
    const unit = available.find((u) => u.id === nextId);
    setAmount(unit?.price ?? '');
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!lead) return;

    const formData = new FormData(event.currentTarget);
    setPending(true);
    const result = await convertLeadToSale({
      leadId: lead.id,
      unitId,
      totalAmount: amount,
      customerEmail: String(formData.get('customerEmail') ?? ''),
    });
    setPending(false);

    if (!result.ok) {
      setErrors(result.fieldErrors ?? {});
      toast.error(result.message);
      return;
    }

    setErrors({});
    toast.success(result.message);
    onOpenChange(false);
    onConverted?.();
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (pending ? null : onOpenChange(next))}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>সেল কনফার্ম করুন</DialogTitle>
          <DialogDescription>
            <span className="font-medium text-foreground">{lead?.name}</span> কে Won এ নিতে ইউনিট ও
            চূড়ান্ত মূল্য নিশ্চিত করুন।
          </DialogDescription>
        </DialogHeader>

        {available.length === 0 ? (
          <div className="space-y-4">
            <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              বিক্রির জন্য খালি কোনো ইউনিট নেই। প্রজেক্ট ও ইউনিট যোগ করার পর আবার চেষ্টা করুন (Phase
              3 — প্রজেক্ট/ইউনিট মডিউল)।
            </p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                বন্ধ করুন
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form key={lead?.id ?? 'none'} onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sale-unit">ইউনিট</Label>
              <NativeSelect
                id="sale-unit"
                value={unitId}
                onChange={(event) => onUnitChange(event.target.value)}
                required
                autoFocus
              >
                <option value="" disabled>
                  — ইউনিট নির্বাচন করুন —
                </option>
                {groups.map(([projectName, projectUnits]) => (
                  <optgroup key={projectName} label={projectName}>
                    {projectUnits.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.unitNo} · {unit.priceLabel} · {UNIT_STATUS_LABEL[unit.status]}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </NativeSelect>
              <FieldError message={errors.unitId} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sale-amount">মোট মূল্য (৳)</Label>
              <Input
                id="sale-amount"
                name="totalAmount"
                type="number"
                inputMode="numeric"
                min="1"
                step="1"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                {selected
                  ? `ইউনিটের তালিকা-মূল্য ${selected.priceLabel} — দরদামের পর চূড়ান্ত মূল্য বসান।`
                  : 'ইউনিট নির্বাচন করলে তালিকা-মূল্য বসে যাবে।'}
              </p>
              <FieldError message={errors.totalAmount} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sale-customer-email">কাস্টমারের ইমেইল (ঐচ্ছিক)</Label>
              <Input
                id="sale-customer-email"
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
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                কাস্টমার প্রোফাইল তৈরি হবে (না থাকলে নতুন অ্যাকাউন্ট — নাম ও ফোন লিড থেকে)
              </p>
              <p className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                সেল রেকর্ড তৈরি হবে — <span className="font-medium">ড্রাফট</span> অবস্থায়
              </p>
              <p className="flex items-start gap-2">
                <Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                ইউনিটের স্ট্যাটাস <span className="font-medium">বিক্রিত (SOLD)</span> হবে
              </p>
              <p className="flex items-start gap-2 text-muted-foreground">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                পেমেন্ট প্ল্যান Accounts/Admin সেট করে সেলটি কনফার্ম করবেন — ততক্ষণ ড্রাফট থাকবে।
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
              <Button type="submit" disabled={pending || !unitId || !amount}>
                {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                সেল কনফার্ম করুন
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
