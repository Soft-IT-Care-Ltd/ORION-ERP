'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import type { Role } from '@prisma/client';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ROLES, ROLE_LABEL } from '@/lib/rbac';
import { validateForm } from '@/lib/validations/form';
import { createUserSchema, updateUserSchema } from '@/lib/validations/user';
import { createUser, updateUser } from './actions';

export type EditableUser = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
};

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-destructive">{message}</p>;
}

export function UserFormDialog({
  open,
  onOpenChange,
  user,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** না দিলে নতুন ইউজার তৈরির মোড */
  user?: EditableUser;
}) {
  const router = useRouter();
  const isEdit = Boolean(user);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) setErrors({});
  }, [open]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    // সার্ভারে যাওয়ার আগে একই স্কিমা ব্রাউজারেই — ভুল ইনপুটে রাউন্ড-ট্রিপ বাঁচে
    const check = validateForm(isEdit ? updateUserSchema : createUserSchema, formData);
    if (!check.ok) {
      setErrors(check.fieldErrors);
      toast.error(check.message);
      return;
    }

    setPending(true);
    const result = isEdit ? await updateUser(formData) : await createUser(formData);
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
          <DialogTitle>{isEdit ? 'ইউজার এডিট' : 'নতুন ইউজার'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'তথ্য ও role পরিবর্তন করুন। role বদলালে ইউজারকে আবার লগইন করতে হবে।'
              : 'নাম, ইমেইল, role ও প্রাথমিক পাসওয়ার্ড দিন।'}
          </DialogDescription>
        </DialogHeader>

        {/* key: dialog আবার খুললে ফর্ম রিসেট হবে */}
        <form key={user?.id ?? 'new'} onSubmit={onSubmit} className="space-y-4">
          {user ? <input type="hidden" name="id" value={user.id} /> : null}

          <div className="space-y-2">
            <Label htmlFor="name">নাম</Label>
            <Input id="name" name="name" defaultValue={user?.name} required autoComplete="off" />
            <FieldError message={errors.name} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">ইমেইল</Label>
            <Input
              id="email"
              name="email"
              type="email"
              inputMode="email"
              defaultValue={user?.email}
              required
              autoComplete="off"
            />
            <FieldError message={errors.email} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">ফোন (ঐচ্ছিক)</Label>
            <Input
              id="phone"
              name="phone"
              inputMode="numeric"
              placeholder="01711223344"
              defaultValue={user?.phone ?? ''}
              autoComplete="off"
            />
            <FieldError message={errors.phone} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select name="role" defaultValue={user?.role ?? 'MARKETING'} required>
              <SelectTrigger id="role">
                <SelectValue placeholder="role নির্বাচন করুন" />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((role) => (
                  <SelectItem key={role} value={role}>
                    {ROLE_LABEL[role]} ({role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError message={errors.role} />
          </div>

          {!isEdit ? (
            <div className="space-y-2">
              <Label htmlFor="password">প্রাথমিক পাসওয়ার্ড</Label>
              <Input
                id="password"
                name="password"
                type="password"
                minLength={8}
                required
                autoComplete="new-password"
              />
              <p className="text-xs text-muted-foreground">
                কমপক্ষে ৮ অক্ষর। ইউজারকে জানিয়ে দিন — প্রথম লগইনের পর পরিবর্তন করতে বলুন।
              </p>
              <FieldError message={errors.password} />
            </div>
          ) : null}

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
