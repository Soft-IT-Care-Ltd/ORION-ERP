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
import { Textarea } from '@/components/ui/textarea';
import { validate } from '@/lib/validations/form';
import { logFollowUpSchema } from '@/lib/validations/follow-up';
import { logFollowUp } from '../leads/actions';
import type { FollowUpLead } from './follow-up-group';

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-destructive">{message}</p>;
}

/** আজ থেকে `days` দিন পরের তারিখ — `yyyy-MM-dd` */
function addDaysValue(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

/** এক ক্লিকে পরের ফলো-আপ — সবচেয়ে বেশি ব্যবহৃত ব্যবধানগুলো */
const QUICK_DAYS = [
  { label: 'আগামীকাল', days: 1 },
  { label: '৩ দিন পর', days: 3 },
  { label: '১ সপ্তাহ পর', days: 7 },
  { label: '১৫ দিন পর', days: 15 },
];

/**
 * PRD সেকশন ৫.১ — এক জায়গা থেকেই "কী কথা হলো" লেখা আর "পরের বার কবে" ঠিক করা।
 * তারিখ খালি রাখলে লিডটি ফলো-আপ তালিকা থেকে সরে যায়।
 */
export function LogFollowUpDialog({
  open,
  onOpenChange,
  lead,
  onLogged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: FollowUpLead | null;
  onLogged?: () => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [nextDate, setNextDate] = useState('');

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setNextDate(addDaysValue(7));
  }, [open]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!lead) return;

    const formData = new FormData(event.currentTarget);
    const input = {
      leadId: lead.id,
      note: String(formData.get('note') ?? ''),
      nextFollowUpAt: nextDate,
    };

    const check = validate(logFollowUpSchema, input);
    if (!check.ok) {
      setErrors(check.fieldErrors);
      toast.error(check.message);
      return;
    }

    setPending(true);
    const result = await logFollowUp(input);
    setPending(false);

    if (!result.ok) {
      setErrors(result.fieldErrors ?? {});
      toast.error(result.message);
      return;
    }

    setErrors({});
    toast.success(result.message);
    onOpenChange(false);
    onLogged?.();
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (pending ? null : onOpenChange(next))}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>ফলো-আপ লগ করুন</DialogTitle>
          <DialogDescription>
            <span className="font-medium text-foreground">{lead?.name}</span> —{' '}
            {lead?.stageLabel} · সর্বশেষ নির্ধারিত {lead?.followUpLabel}
          </DialogDescription>
        </DialogHeader>

        <form key={lead?.id ?? 'none'} onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="follow-up-note">কী কথা হলো</Label>
            <Textarea
              id="follow-up-note"
              name="note"
              rows={3}
              required
              autoFocus
              placeholder="যেমন: ফোনে কথা হয়েছে, ডিজাইন রিভিশন চেয়েছেন — আগামী সপ্তাহে দেখা করবেন"
            />
            <FieldError message={errors.note} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="follow-up-next">পরবর্তী ফলো-আপ</Label>
            <Input
              id="follow-up-next"
              type="date"
              value={nextDate}
              onChange={(event) => setNextDate(event.target.value)}
            />
            <div className="flex flex-wrap gap-1.5">
              {QUICK_DAYS.map((quick) => (
                <button
                  key={quick.days}
                  type="button"
                  onClick={() => setNextDate(addDaysValue(quick.days))}
                  className="rounded-full border border-dashed px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-solid hover:bg-muted hover:text-foreground"
                >
                  {quick.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setNextDate('')}
                className="rounded-full border border-dashed px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-solid hover:bg-muted hover:text-foreground"
              >
                আর ফলো-আপ নেই
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              খালি রাখলে লিডটি ফলো-আপ তালিকা থেকে সরে যাবে।
            </p>
            <FieldError message={errors.nextFollowUpAt} />
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
