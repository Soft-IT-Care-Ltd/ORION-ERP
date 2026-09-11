'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import type { BuildingType, LeadSource } from '@prisma/client';
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
  BUILDING_TYPE_LABEL,
  BUILDING_TYPES,
  LEAD_SOURCES,
  LOCAL_CONTACT_RELATIONS,
  SOURCE_LABEL,
} from '@/lib/leads';
import { COMMON_COUNTRIES, OTHER_COUNTRIES, OTHER_COUNTRY } from '@/lib/countries';
import { PhoneInput } from '@/components/form/phone-input';
import { validateForm } from '@/lib/validations/form';
import { leadFormSchema, updateLeadFormSchema } from '@/lib/validations/lead-base';
import { createLead, updateLead } from './actions';

/** ফর্মের defaultValue হিসেবে বসানোর মতো (সব string) লিড রূপ */
export type EditableLead = {
  id: string;
  name: string;
  /** ISO alpha-2 — ফোনের country picker */
  phoneCountry: string;
  /** country code ছাড়া লোকাল নম্বর */
  phoneNumber: string;
  /** ISO alpha-2 বা `OTHER` */
  residenceCountry: string | null;
  email: string | null;
  source: LeadSource;
  projectLocation: string | null;
  /** জমির আয়তন — free text ("৪ কাঠা", "৫ শতক") */
  landSize: string | null;
  buildingType: BuildingType | null;
  budgetMin: string | null;
  budgetMax: string | null;
  assignedToId: string | null;
  /** yyyy-MM-dd */
  nextFollowUpAt: string | null;
  localContactName: string | null;
  localContactPhone: string | null;
  localContactRelation: string | null;
};

export type ExecutiveOption = { id: string; name: string; role: string };

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-destructive">{message}</p>;
}

export function LeadFormDialog({
  open,
  onOpenChange,
  lead,
  executives,
  /** ADMIN হলে true — নইলে লিড নিজের নামেই তৈরি/থাকবে */
  canAssign,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** না দিলে নতুন লিড তৈরির মোড */
  lead?: EditableLead;
  executives: ExecutiveOption[];
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

    // `lead-base` স্কিমা — ফোনের দেশভিত্তিক যাচাই (libphonenumber) সার্ভারে হয়,
    // সেই ভারী লাইব্রেরিটি ক্লায়েন্ট bundle এ আনা হয় না
    const check = validateForm(isEdit ? updateLeadFormSchema : leadFormSchema, formData);
    if (!check.ok) {
      setErrors(check.fieldErrors);
      toast.error(check.message);
      return;
    }

    setPending(true);
    const result = isEdit ? await updateLead(formData) : await createLead(formData);
    setPending(false);

    if (result.ok) {
      toast.success(result.message);
      setErrors({});
      onOpenChange(false);

      const createdId = (result.data as { id?: string } | undefined)?.id;
      if (createdId && onCreated) {
        // caller নতুন পেজে navigate করবে — সেখানকার ডেটা এমনিতেই server থেকে আসে।
        // সাথে `refresh()` ডাকলে দুটো নেভিগেশন একসাথে চলে, আর refresh জিতে গেলে
        // push বাতিল হয়ে যায় (ইউজার ভুল পেজে গিয়ে পড়ে)।
        onCreated(createdId);
      } else {
        router.refresh();
      }
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

          <div className="space-y-2">
            <Label htmlFor="lead-phone">ফোন</Label>
            {/* key: dialog আবার খুললে country picker ও রিসেট হবে */}
            <PhoneInput
              key={`phone-${lead?.id ?? 'new'}`}
              id="lead-phone"
              name="phone"
              defaultCountry={lead?.phoneCountry}
              defaultNumber={lead?.phoneNumber}
              required
            />
            <p className="text-xs text-muted-foreground">
              প্রবাসী ক্লায়েন্ট হলে তার নিজের দেশের নম্বর দিন — country code বেছে নিন।
            </p>
            <FieldError message={errors.phoneNumber} />
            <FieldError message={errors.phoneCountry} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="lead-residence">বর্তমান বসবাসের দেশ</Label>
              <NativeSelect
                id="lead-residence"
                name="residenceCountry"
                defaultValue={lead?.residenceCountry ?? ''}
              >
                <option value="">— নির্ধারিত নয় —</option>
                <optgroup label="প্রচলিত">
                  {COMMON_COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.bn} ({c.en})
                    </option>
                  ))}
                </optgroup>
                <optgroup label="অন্যান্য দেশ">
                  {OTHER_COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.bn} ({c.en})
                    </option>
                  ))}
                  <option value={OTHER_COUNTRY}>🌍 অন্যান্য দেশ</option>
                </optgroup>
              </NativeSelect>
              <FieldError message={errors.residenceCountry} />
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

            {/* PRD সেকশন ৫.১ — ক্লায়েন্ট কী ধরনের বাড়ি চান */}
            <div className="space-y-2">
              <Label htmlFor="lead-building-type">বাড়ির ধরন (ঐচ্ছিক)</Label>
              <NativeSelect
                id="lead-building-type"
                name="buildingType"
                defaultValue={lead?.buildingType ?? ''}
              >
                <option value="">— নির্ধারিত নয় —</option>
                {BUILDING_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {BUILDING_TYPE_LABEL[type]}
                  </option>
                ))}
              </NativeSelect>
              <FieldError message={errors.buildingType} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="lead-project-location">জমির অবস্থান (ঐচ্ছিক)</Label>
              <Input
                id="lead-project-location"
                name="projectLocation"
                placeholder="যেমন: সোনাডাঙ্গা, খুলনা — নিজস্ব জমি"
                defaultValue={lead?.projectLocation ?? ''}
                autoComplete="off"
              />
              <FieldError message={errors.projectLocation} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lead-land-size">জমির আয়তন (ঐচ্ছিক)</Label>
              <Input
                id="lead-land-size"
                name="landSize"
                placeholder="যেমন: ৪ কাঠা / ৫ শতক"
                defaultValue={lead?.landSize ?? ''}
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">
                একক যেভাবে বলা হয়েছে সেভাবেই লিখুন — কাঠা, শতক, বিঘা সবই চলবে।
              </p>
              <FieldError message={errors.landSize} />
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

          {/* PRD সেকশন ৫.১ — প্রবাসী ক্লায়েন্টের বাংলাদেশে থাকা যোগাযোগকারী */}
          <fieldset className="space-y-3 rounded-md border bg-muted/30 p-3">
            <legend className="px-1 text-sm font-medium leading-none">
              লোকাল কন্টাক্ট (বাংলাদেশে)
            </legend>
            <p className="text-xs text-muted-foreground">
              প্রবাসী ক্লায়েন্টের পক্ষে দেশে যার সাথে যোগাযোগ করা যাবে — ঐচ্ছিক।
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="lead-lc-name">নাম</Label>
                <Input
                  id="lead-lc-name"
                  name="localContactName"
                  placeholder="যেমন: মোঃ করিম"
                  defaultValue={lead?.localContactName ?? ''}
                  autoComplete="off"
                />
                <FieldError message={errors.localContactName} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lead-lc-relation">সম্পর্ক</Label>
                <Input
                  id="lead-lc-relation"
                  name="localContactRelation"
                  list="local-contact-relations"
                  placeholder="ভাই / বন্ধু / আত্মীয়"
                  defaultValue={lead?.localContactRelation ?? ''}
                  autoComplete="off"
                />
                <datalist id="local-contact-relations">
                  {LOCAL_CONTACT_RELATIONS.map((relation) => (
                    <option key={relation} value={relation} />
                  ))}
                </datalist>
                <FieldError message={errors.localContactRelation} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="lead-lc-phone">ফোন (বাংলাদেশি নম্বর)</Label>
              <Input
                id="lead-lc-phone"
                name="localContactPhone"
                type="tel"
                inputMode="numeric"
                placeholder="01711223344"
                defaultValue={lead?.localContactPhone ?? ''}
                autoComplete="off"
              />
              <FieldError message={errors.localContactPhone} />
            </div>
          </fieldset>

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
