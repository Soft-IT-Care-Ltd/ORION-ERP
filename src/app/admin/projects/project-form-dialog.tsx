'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { ROLE_LABEL } from '@/lib/rbac';
import { createProject, updateProject } from './actions';

export type EngineerOption = { id: string; name: string; role: 'ENGINEER' | 'ADMIN' };

export type EditableProject = {
  id: string;
  name: string;
  location: string;
  description: string | null;
  /** "yyyy-MM-dd" — `<input type=date>` এর ফরম্যাট */
  startDate: string | null;
  engineerId: string | null;
};

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-destructive">{message}</p>;
}

export function ProjectFormDialog({
  open,
  onOpenChange,
  project,
  engineers,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** না দিলে নতুন প্রজেক্ট তৈরির মোড */
  project?: EditableProject;
  engineers: EngineerOption[];
}) {
  const router = useRouter();
  const isEdit = Boolean(project);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) setErrors({});
  }, [open]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    setPending(true);
    const result = isEdit ? await updateProject(formData) : await createProject(formData);
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
          <DialogTitle>{isEdit ? 'প্রজেক্ট এডিট' : 'নতুন প্রজেক্ট'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'প্রজেক্টের তথ্য ও দায়িত্বপ্রাপ্ত ইঞ্জিনিয়ার পরিবর্তন করুন।'
              : 'নতুন প্রজেক্ট PRD এর ডিফল্ট ৮টি ফেজ টেমপ্লেট নিয়েই তৈরি হবে — পরে বদলানো যাবে।'}
          </DialogDescription>
        </DialogHeader>

        {/* key: dialog আবার খুললে ফর্ম রিসেট হবে */}
        <form key={project?.id ?? 'new'} onSubmit={onSubmit} className="space-y-4">
          {project ? <input type="hidden" name="id" value={project.id} /> : null}

          <div className="space-y-2">
            <Label htmlFor="project-name">প্রজেক্টের নাম</Label>
            <Input
              id="project-name"
              name="name"
              defaultValue={project?.name}
              placeholder="যেমন: Orion Green"
              required
              autoComplete="off"
            />
            <FieldError message={errors.name} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-location">অবস্থান</Label>
            <Input
              id="project-location"
              name="location"
              defaultValue={project?.location}
              placeholder="যেমন: সোনাডাঙ্গা, খুলনা"
              required
              autoComplete="off"
            />
            <FieldError message={errors.location} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="project-start">নির্মাণ শুরুর তারিখ (ঐচ্ছিক)</Label>
              <Input
                id="project-start"
                name="startDate"
                type="date"
                defaultValue={project?.startDate ?? ''}
              />
              <p className="text-xs text-muted-foreground">
                ফেজের পরিকল্পিত তারিখ এখান থেকেই হিসাব হয়।
              </p>
              <FieldError message={errors.startDate} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="project-engineer">সাইট ইঞ্জিনিয়ার (ঐচ্ছিক)</Label>
              <NativeSelect
                id="project-engineer"
                name="engineerId"
                defaultValue={project?.engineerId ?? ''}
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

          <div className="space-y-2">
            <Label htmlFor="project-description">বিবরণ (ঐচ্ছিক)</Label>
            <Textarea
              id="project-description"
              name="description"
              rows={3}
              defaultValue={project?.description ?? ''}
              placeholder="যেমন: ৮ তলা আবাসিক ভবন — ৩ ও ৪ বেডরুম অ্যাপার্টমেন্ট"
            />
            <FieldError message={errors.description} />
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
