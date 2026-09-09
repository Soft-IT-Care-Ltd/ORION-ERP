'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, MessageSquarePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { validate } from '@/lib/validations/form';
import { addNoteSchema } from '@/lib/validations/lead-base';
import { addLeadNote } from '../actions';

export function AddNoteForm({ leadId }: { leadId: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const note = String(new FormData(event.currentTarget).get('note') ?? '');

    const check = validate(addNoteSchema, { id: leadId, note });
    if (!check.ok) {
      setError(check.fieldErrors.note ?? check.message);
      toast.error(check.message);
      return;
    }

    setPending(true);
    const result = await addLeadNote({ id: leadId, note });
    setPending(false);

    if (!result.ok) {
      setError(result.fieldErrors?.note ?? result.message);
      toast.error(result.message);
      return;
    }

    setError(undefined);
    formRef.current?.reset();
    toast.success(result.message);
    router.refresh();
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-2">
      <Label htmlFor="new-note">নতুন নোট</Label>
      <Textarea
        id="new-note"
        name="note"
        rows={3}
        required
        placeholder="যেমন: ফোনে কথা হয়েছে, শনিবার সাইট ভিজিটে আসবেন"
      />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <MessageSquarePlus className="mr-2 h-4 w-4" />
          )}
          নোট যোগ করুন
        </Button>
      </div>
    </form>
  );
}
