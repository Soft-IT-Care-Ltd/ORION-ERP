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
import { applyTemplateToUnits } from '../actions';

/**
 * টেমপ্লেট থেকে টাইমলাইন তৈরি — শুধু যেসব ইউনিটে এখনো ফেজ নেই সেগুলোতে।
 * অগ্রগতি থাকা ইউনিট ছোঁয়া হয় না, তাই বাটনটি নিরাপদে বারবার চাপা যায়।
 */
export function ApplyTemplateButton({
  projectId,
  pendingUnits,
  defaultStartDate,
  disabled,
}: {
  projectId: string;
  /** যত ইউনিটে এখনো টাইমলাইন নেই */
  pendingUnits: number;
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
    const result = await applyTemplateToUnits({ projectId, startDate });
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
        disabled={disabled || pendingUnits === 0}
        onClick={() => setOpen(true)}
      >
        <CalendarRange className="mr-2 h-4 w-4" />
        {pendingUnits > 0 ? `${pendingUnits} ইউনিটে টাইমলাইন তৈরি` : 'সব ইউনিটে টাইমলাইন আছে'}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>টাইমলাইন তৈরি করুন</DialogTitle>
            <DialogDescription>
              টেমপ্লেট থেকে {pendingUnits} টি ইউনিটে ফেজ তৈরি হবে। প্রতিটি ফেজ আগেরটির শেষের
              পরদিন শুরু ধরে পরিকল্পিত তারিখ বসবে। যেসব ইউনিটে আগে থেকেই টাইমলাইন আছে সেগুলো
              অপরিবর্তিত থাকবে।
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
