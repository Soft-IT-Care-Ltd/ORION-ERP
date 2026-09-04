'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import type { LeadSource } from '@prisma/client';
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
import { LEAD_SOURCES, SOURCE_LABEL } from '@/lib/leads';
import { createLead, updateLead } from './actions';

/** ফর্মের defaultValue হিসেবে বসানোর মতো (সব string) লিড রূপ */
export type EditableLead = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  source: LeadSource;
  unitId: string | null;
  budgetMin: string | null;
  budgetMax: string | null;
  assignedToId: string | null;
  /** yyyy-MM-dd */
  nextFollowUpAt: string | null;
};

export type ExecutiveOption = { id: string; name: string; role: string };
export type UnitOption = { id: string; label: string };

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-destructive">{message}</p>;
}

export function LeadFormDialog({
  open,
  onOpenChange,
  lead,
  executives,
  units,
  /** ADMIN হলে true — নইলে লিড নিজের নামেই তৈরি/থাকবে */
  canAssign,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** না দিলে নতুন লিড তৈরির মোড */
  lead?: EditableLead;
  executives: ExecutiveOption[];
  units: UnitOption[];
  canAssign: boolean;
  onCreated?: (leadId: string) => void;
}) {
  const router = useRouter();
  const isEdit = Boolean(lead);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) setErrors({});
  }, [open]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    setPending(true);
    const result = isEdit ? await updateLead(formData) : await createLead(formData);
    setPending(false);

    if (result.ok) {
      toast.success(result.message);
      setErrors({});
      onOpenChange(false);
      router.refresh();
      const createdId = (result.data as { id?: string } | undefined)?.id;
      if (createdId) onCreated?.(createdId);
      return;
    }

    setErrors(result.fieldErrors ?? {});
    toast.error(result.message);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'লিড এডিট' : 'নতুন লিড'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'লিডের তথ্য হালনাগাদ করুন। স্টেজ পরিবর্তন বোর্ড বা ডিটেইল পেজ থেকে করুন।'
              : 'নাম ও ফোন বাধ্যতামূলক — বাকিগুলো পরে যোগ করা যাবে।'}
          </DialogDescription>
        </DialogHeader>

        {/* key: dialog আবার খুললে ফর্ম রিসেট হবে */}
        <form key={lead?.id ?? 'new'} onSubmit={onSubmit} className="space-y-4">
          {lead ? <input type="hidden" name="id" value={lead.id} /> : null}

          <div className="space-y-2">
            <Label htmlFor="lead-name">নাম</Label>
            <Input
              id="lead-name"
              name="name"
              defaultValue={lead?.name}
              required
              autoComplete="off"
            />
            <FieldError message={errors.name} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="lead-phone">ফোন</Label>
              <Input
                id="lead-phone"
                name="phone"
                type="tel"
                inputMode="numeric"
                placeholder="01711223344"
                defaultValue={lead?.phone}
                required
                autoComplete="off"
              />
              <FieldError message={errors.phone} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lead-email">ইমেইল (ঐচ্ছিক)</Label>
              <Input
                id="lead-email"
                name="email"
                type="email"
                inputMode="email"
                defaultValue={lead?.email ?? ''}
                autoComplete="off"
              />
              <FieldError message={errors.email} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="lead-source">সোর্স</Label>
              <NativeSelect
                id="lead-source"
                name="source"
                defaultValue={lead?.source ?? 'FACEBOOK_ADS'}
                required
              >
                {LEAD_SOURCES.map((source) => (
                  <option key={source} value={source}>
                    {SOURCE_LABEL[source]}
                  </option>
                ))}
              </NativeSelect>
              <FieldError message={errors.source} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lead-unit">আগ্রহী ইউনিট (ঐচ্ছিক)</Label>
              <NativeSelect
                id="lead-unit"
                name="unitId"
                defaultValue={lead?.unitId ?? ''}
                disabled={units.length === 0}
              >
                <option value="">— নির্ধারিত নয় —</option>
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.label}
                  </option>
                ))}
              </NativeSelect>
              {units.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  এখনো কোনো ইউনিট যোগ হয়নি — প্রজেক্ট/ইউনিট মডিউল Phase 3 এ আসছে।
                </p>
              ) : null}
              <FieldError message={errors.unitId} />
            </div>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium leading-none">বাজেট রেঞ্জ (৳, ঐচ্ছিক)</legend>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="lead-budget-min" className="text-xs text-muted-foreground">
                  সর্বনিম্ন
                </Label>
                <Input
                  id="lead-budget-min"
                  name="budgetMin"
                  inputMode="numeric"
                  placeholder="4500000"
                  defaultValue={lead?.budgetMin ?? ''}
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="lead-budget-max" className="text-xs text-muted-foreground">
                  সর্বোচ্চ
                </Label>
                <Input
                  id="lead-budget-max"
                  name="budgetMax"
                  inputMode="numeric"
                  placeholder="5500000"
                  defaultValue={lead?.budgetMax ?? ''}
                  autoComplete="off"
                />
              </div>
            </div>
            <FieldError message={errors.budgetMin} />
            <FieldError message={errors.budgetMax} />
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            {canAssign ? (
              <div className="space-y-2">
                <Label htmlFor="lead-assigned">মার্কেটিং এক্সিকিউটিভ</Label>
                <NativeSelect
                  id="lead-assigned"
                  name="assignedToId"
                  defaultValue={lead?.assignedToId ?? ''}
                >
                  <option value="">— অ্যাসাইন করা হয়নি —</option>
                  {executives.map((exec) => (
                    <option key={exec.id} value={exec.id}>
                      {exec.name}
                      {exec.role === 'ADMIN' ? ' (অ্যাডমিন)' : ''}
                    </option>
                  ))}
                </NativeSelect>
                <FieldError message={errors.assignedToId} />
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="lead-followup">পরবর্তী ফলো-আপ (ঐচ্ছিক)</Label>
              <Input
                id="lead-followup"
                name="nextFollowUpAt"
                type="date"
                defaultValue={lead?.nextFollowUpAt ?? ''}
              />
              <FieldError message={errors.nextFollowUpAt} />
            </div>
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
              {isEdit ? 'সেভ করুন' : 'তৈরি করুন'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
