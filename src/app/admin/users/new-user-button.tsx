'use client';

import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UserFormDialog } from './user-form-dialog';

export function NewUserButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <UserPlus className="mr-2 h-4 w-4" />
        নতুন ইউজার
      </Button>
      <UserFormDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
