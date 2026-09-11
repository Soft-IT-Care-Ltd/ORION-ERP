'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LeadFormDialog, type ExecutiveOption } from '../leads/lead-form-dialog';

export function NewLeadButton({
  executives,
  canAssign,
}: {
  executives: ExecutiveOption[];
  canAssign: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <UserPlus className="mr-2 h-4 w-4" />
        নতুন লিড
      </Button>
      <LeadFormDialog
        open={open}
        onOpenChange={setOpen}
        executives={executives}
        canAssign={canAssign}
        onCreated={(id) => router.push(`/sales/leads/${id}`)}
      />
    </>
  );
}
