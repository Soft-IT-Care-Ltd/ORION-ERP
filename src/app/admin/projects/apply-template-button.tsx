'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { CalendarRange, Loader2 } from 'lucide-react';
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
import { validate } from '@/lib/validations/form';
import { applyTemplateSchema } from '@/lib/validations/project';
import { applyTemplateToProject } from './actions';

/**
 * গ্লোবাল টেমপ্লেট থেকে টাইমলাইন তৈরি — শুধু যে প্রজেক্টে এখনো ফেজ নেই সেখানে।
 *
 * সাধারণত Lead → Won কনভার্শনেই ফেজগুলো তৈরি হয়ে যায়; এই বোতামটি সেই ক্ষেত্রের
 * জন্য যেখানে কনভার্শনের সময় টেমপ্লেট খালি ছিল। অগ্রগতি থাকা প্রজেক্ট ছোঁয়া হয়
 * না, তাই বোতামটি নিরাপদে চাপা যায়।
 */
export function ApplyTemplateButton({
  projectId,
  hasPhases,
  defaultStartDate,
  disabled,
}: {
  projectId: string;
  /** প্রজেক্টে আগেই ফেজ আছে কি না */
  hasPhases: boolean;
  /** প্রজেক্টের startDate — "yyyy-MM-dd" */
  defaultStartDate: string | null;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [startDate, setStartDate] = useState(defaultStartDate ?? '');
  const [pending, setPending] = useState(false);

  async function onApply() {
    const check = validate(applyTemplateSchema, { projectId, startDate });
    if (!check.ok) {
      toast.error(Object.values(check.fieldErrors)[0] ?? check.message);
      return;
    }

    setPending(true);
    const result = await applyTemplateToProject({ projectId, startDate });
    setPending(false);

    if (result.ok) {
      setOpen(false);
      toast.success(result.message);
      router.refresh();
    } else {
      toast.error(result.message);
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        disabled={disabled || hasPhases}
        onClick={() => setOpen(true)}
      >
        <CalendarRange className="mr-2 h-4 w-4" />
        {hasPhases ? 'টাইমলাইন আছে' : 'টেমপ্লেট থেকে টাইমলাইন তৈরি'}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>টাইমলাইন তৈরি করুন</DialogTitle>
            <DialogDescription>
              গ্লোবাল ফেজ টেমপ্লেট থেকে এই প্রজেক্টের ফেজগুলো তৈরি হবে। প্রতিটি ফেজ আগেরটির
              শেষের পরদিন শুরু ধরে পরিকল্পিত তারিখ বসবে।
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="apply-start">নির্মাণ শুরুর তারিখ</Label>
            <Input
              id="apply-start"
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              খালি রাখলে ফেজগুলো তারিখ ছাড়াই তৈরি হবে — পরে বসানো যাবে।
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              বাতিল
            </Button>
            <Button onClick={() => void onApply()} disabled={pending}>
              {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              তৈরি করুন
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
