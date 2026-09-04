'use client';

import { useEffect, useState } from 'react';
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
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { LOST_REASONS, LOST_REASON_LABEL } from '@/lib/leads';

/**
 * PRD সেকশন ৫.১ — "Lost" এ নেওয়ার সময় কারণ বাধ্যতামূলক।
 * বোর্ডের drag-drop ও ডিটেইল পেজের স্টেজ মেনু — দুই জায়গা থেকেই এটি ব্যবহৃত হয়।
 * বাতিল করলে parent স্টেজ পরিবর্তনটি ফিরিয়ে নেবে।
 */
export function LostReasonDialog({
  open,
  onOpenChange,
  leadName,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadName: string;
  pending: boolean;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState<string>('');

  // প্রতিবার নতুন করে খুললে আগের সিলেকশন থাকবে না — ভুল কারণ সেভ হওয়া ঠেকাতে
  useEffect(() => {
    if (open) setReason('');
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(next) => (pending ? null : onOpenChange(next))}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Lost করার কারণ</DialogTitle>
          <DialogDescription>
            <span className="font-medium text-foreground">{leadName}</span> কে Lost হিসেবে চিহ্নিত
            করতে একটি কারণ নির্বাচন করুন। এটি রিপোর্টে ব্যবহৃত হবে।
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (reason) onConfirm(reason);
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="lost-reason">কারণ</Label>
            <NativeSelect
              id="lost-reason"
              name="lostReason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              required
              autoFocus
            >
              <option value="" disabled>
                — কারণ নির্বাচন করুন —
              </option>
              {LOST_REASONS.map((value) => (
                <option key={value} value={value}>
                  {LOST_REASON_LABEL[value]}
                </option>
              ))}
            </NativeSelect>
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
            <Button type="submit" variant="destructive" disabled={pending || !reason}>
              {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Lost হিসেবে সেভ করুন
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
