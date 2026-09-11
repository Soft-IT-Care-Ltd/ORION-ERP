'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Video } from 'lucide-react';
import type { BuildingType, ProjectStatus } from '@prisma/client';
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
import { ROLE_LABEL } from '@/lib/rbac';
import { BUILDING_TYPE_LABEL, BUILDING_TYPES } from '@/lib/leads';
import { PROJECT_STATUS_HINT, PROJECT_STATUS_LABEL, PROJECT_STATUSES } from '@/lib/projects';
import { validateForm } from '@/lib/validations/form';
import { updateProjectSchema } from '@/lib/validations/project';
import { updateProject } from './actions';

export type EngineerOption = { id: string; name: string; role: 'ENGINEER' | 'ADMIN' };

export type EditableProject = {
  id: string;
  title: string;
  landLocation: string | null;
  buildingType: BuildingType | null;
  floors: string | null;
  totalSqft: string | null;
  ratePerSqft: string | null;
  totalContractValue: string;
  /** "yyyy-MM-dd" — `<input type=date>` এর ফরম্যাট */
  startDate: string | null;
  cameraStreamUrl: string | null;
  status: ProjectStatus;
  engineerId: string | null;
};

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-destructive">{message}</p>;
}

/**
 * প্রজেক্ট এডিট — v2 তে প্রজেক্ট **তৈরি** হয় শুধু Lead → Won কনভার্শনে, তাই
 * এখানে "নতুন" মোড নেই। লাইভ ক্যামেরার URL এখানেই বসে (PRD সেকশন ৫.৪ — শুধু
 * Admin সেট করেন, কাস্টমার পোর্টালে embed হয়ে দেখা যায়)।
 */
export function ProjectEditDialog({
  open,
  onOpenChange,
  project,
  engineers,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: EditableProject;
  engineers: EngineerOption[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) setErrors({});
  }, [open]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    const check = validateForm(updateProjectSchema, formData);
    if (!check.ok) {
      setErrors(check.fieldErrors);
      toast.error(check.message);
      return;
    }

    setPending(true);
    const result = await updateProject(formData);
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>প্রজেক্ট এডিট</DialogTitle>
          <DialogDescription>
            কন্ট্রাক্টের তথ্য, দায়িত্বপ্রাপ্ত ইঞ্জিনিয়ার ও লাইভ ক্যামেরার লিংক পরিবর্তন করুন।
          </DialogDescription>
        </DialogHeader>

        {/* key: dialog আবার খুললে ফর্ম রিসেট হবে */}
        <form key={project.id} onSubmit={onSubmit} className="space-y-4">
          <input type="hidden" name="id" value={project.id} />

          <div className="space-y-2">
            <Label htmlFor="project-title">প্রজেক্টের নাম</Label>
            <Input
              id="project-title"
              name="title"
              defaultValue={project.title}
              required
              autoComplete="off"
            />
            <FieldError message={errors.title} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-location">জমির অবস্থান (ঐচ্ছিক)</Label>
            <Input
              id="project-location"
              name="landLocation"
              defaultValue={project.landLocation ?? ''}
              placeholder="যেমন: সোনাডাঙ্গা, খুলনা"
              autoComplete="off"
            />
            <FieldError message={errors.landLocation} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="project-building-type">বাড়ির ধরন</Label>
              <NativeSelect
                id="project-building-type"
                name="buildingType"
                defaultValue={project.buildingType ?? ''}
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

            <div className="space-y-2">
              <Label htmlFor="project-floors">তলার সংখ্যা (ঐচ্ছিক)</Label>
              <Input
                id="project-floors"
                name="floors"
                inputMode="numeric"
                defaultValue={project.floors ?? ''}
                placeholder="3"
                autoComplete="off"
              />
              <FieldError message={errors.floors} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="project-sqft">মোট sqft (ঐচ্ছিক)</Label>
              <Input
                id="project-sqft"
                name="totalSqft"
                inputMode="numeric"
                defaultValue={project.totalSqft ?? ''}
                autoComplete="off"
              />
              <FieldError message={errors.totalSqft} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="project-rate">রেট প্রতি sqft (৳, ঐচ্ছিক)</Label>
              <Input
                id="project-rate"
                name="ratePerSqft"
                inputMode="numeric"
                defaultValue={project.ratePerSqft ?? ''}
                autoComplete="off"
              />
              <FieldError message={errors.ratePerSqft} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="project-value">মোট কন্ট্রাক্ট ভ্যালু (৳)</Label>
              <Input
                id="project-value"
                name="totalContractValue"
                inputMode="numeric"
                defaultValue={project.totalContractValue}
                required
                autoComplete="off"
              />
              <FieldError message={errors.totalContractValue} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="project-start">নির্মাণ শুরুর তারিখ (ঐচ্ছিক)</Label>
              <Input
                id="project-start"
                name="startDate"
                type="date"
                defaultValue={project.startDate ?? ''}
              />
              <FieldError message={errors.startDate} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="project-status">স্ট্যাটাস</Label>
              <NativeSelect id="project-status" name="status" defaultValue={project.status}>
                {PROJECT_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {PROJECT_STATUS_LABEL[status]} — {PROJECT_STATUS_HINT[status]}
                  </option>
                ))}
              </NativeSelect>
              <FieldError message={errors.status} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="project-engineer">সাইট ইঞ্জিনিয়ার (ঐচ্ছিক)</Label>
              <NativeSelect
                id="project-engineer"
                name="engineerId"
                defaultValue={project.engineerId ?? ''}
              >
                <option value="">— কেউ নয় —</option>
                {engineers.map((engineer) => (
                  <option key={engineer.id} value={engineer.id}>
                    {engineer.name} ({ROLE_LABEL[engineer.role]})
                  </option>
                ))}
              </NativeSelect>
              <p className="text-xs text-muted-foreground">
                অ্যাসাইন করা ইঞ্জিনিয়ার এটি &ldquo;আমার সাইট&rdquo; এ দেখবেন।
              </p>
              <FieldError message={errors.engineerId} />
            </div>
          </div>

          {/* PRD সেকশন ৫.৪ — লাইভ CC ক্যামেরা, শুধু Admin বসান */}
          <div className="space-y-2">
            <Label htmlFor="project-camera" className="flex items-center gap-1.5">
              <Video className="h-3.5 w-3.5" />
              লাইভ ক্যামেরার লিংক (ঐচ্ছিক)
            </Label>
            <Input
              id="project-camera"
              name="cameraStreamUrl"
              type="url"
              defaultValue={project.cameraStreamUrl ?? ''}
              placeholder="https://…"
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              ভেন্ডরের শেয়ার লিংক বা HLS/embed URL — কাস্টমার পোর্টালে এটিই embed হয়ে দেখা
              যাবে। শুধু http/https লিংক গ্রহণ করা হয়।
            </p>
            <FieldError message={errors.cameraStreamUrl} />
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
              সেভ করুন
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
