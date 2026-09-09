'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { UnitStatus } from '@prisma/client';
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
import { validateForm } from '@/lib/validations/form';
import { unitSchema, updateUnitSchema } from '@/lib/validations/project';
import { createUnit, updateUnit } from '../actions';

export type EditableUnit = {
  id: string;
  unitNo: string;
  sizeSqft: string | null;
  price: string;
  status: UnitStatus;
  /** বিক্রি হয়ে গেছে — স্ট্যাটাস আর বদলানো যাবে না */
  locked: boolean;
};

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-destructive">{message}</p>;
}

export function UnitFormDialog({
  open,
  onOpenChange,
  projectId,
  phaseCount,
  unit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  /** প্রজেক্টের টেমপ্লেটে কয়টি ফেজ আছে — নতুন ইউনিটে এতগুলো ফেজ তৈরি হবে */
  phaseCount: number;
  /** না দিলে নতুন ইউনিট তৈরির মোড */
  unit?: EditableUnit;
}) {
  const router = useRouter();
  const isEdit = Boolean(unit);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) setErrors({});
  }, [open]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    const check = validateForm(isEdit ? updateUnitSchema : unitSchema, formData);
    if (!check.ok) {
      setErrors(check.fieldErrors);
      toast.error(check.message);
      return;
    }

    setPending(true);
    const result = isEdit ? await updateUnit(formData) : await createUnit(formData);
    setPending(false);

    if (result.ok) {
      toast.success(result.message);
      setErrors({});
      onOpenChange(false);
      router.refresh();
      return;
    }

    setErrors(result.fieldErrors ?? {});
    toast.error(result.message);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? `ইউনিট এডিট — ${unit?.unitNo}` : 'নতুন ইউনিট'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'ইউনিটের তথ্য পরিবর্তন করুন। ফেজ টাইমলাইন অপরিবর্তিত থাকবে।'
              : phaseCount > 0
                ? `প্রজেক্টের টেমপ্লেট অনুযায়ী ${phaseCount} টি ফেজ স্বয়ংক্রিয়ভাবে তৈরি হবে।`
                : 'প্রজেক্টে ফেজ টেমপ্লেট নেই — ইউনিটটি টাইমলাইন ছাড়াই তৈরি হবে।'}
          </DialogDescription>
        </DialogHeader>

        <form key={unit?.id ?? 'new'} onSubmit={onSubmit} className="space-y-4">
          <input type="hidden" name="projectId" value={projectId} />
          {unit ? <input type="hidden" name="id" value={unit.id} /> : null}

          <div className="space-y-2">
            <Label htmlFor="unit-no">ইউনিট নম্বর</Label>
            <Input
              id="unit-no"
              name="unitNo"
              defaultValue={unit?.unitNo}
              placeholder="যেমন: A-1"
              required
              autoComplete="off"
            />
            <FieldError message={errors.unitNo} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="unit-size">আয়তন (বর্গফুট, ঐচ্ছিক)</Label>
              <Input
                id="unit-size"
                name="sizeSqft"
                inputMode="numeric"
                defaultValue={unit?.sizeSqft ?? ''}
                placeholder="1250"
                autoComplete="off"
              />
              <FieldError message={errors.sizeSqft} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="unit-price">মূল্য (৳)</Label>
              <Input
                id="unit-price"
                name="price"
                inputMode="numeric"
                defaultValue={unit?.price ?? ''}
                placeholder="4500000"
                required
                autoComplete="off"
              />
              <FieldError message={errors.price} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="unit-status">স্ট্যাটাস</Label>
            <NativeSelect
              id="unit-status"
              name="status"
              defaultValue={unit?.status ?? UnitStatus.AVAILABLE}
              disabled={unit?.locked}
            >
              {Object.values(UnitStatus).map((status) => (
                <option key={status} value={status}>
                  {UNIT_STATUS_LABEL[status]}
                </option>
              ))}
            </NativeSelect>
            {unit?.locked ? (
              <>
                {/* disabled select FormData তে যায় না — মানটি hidden ফিল্ডে পাঠানো হচ্ছে */}
                <input type="hidden" name="status" value={UnitStatus.SOLD} />
                <p className="text-xs text-muted-foreground">
                  ইউনিটটি বিক্রি হয়ে গেছে — স্ট্যাটাস পরিবর্তন করা যাবে না।
                </p>
              </>
            ) : null}
            <FieldError message={errors.status} />
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
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isEdit ? 'সেভ করুন' : 'যোগ করুন'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
