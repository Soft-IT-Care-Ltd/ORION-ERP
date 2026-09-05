'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UnitFormDialog } from './unit-form-dialog';

export function NewUnitButton({
  projectId,
  phaseCount,
}: {
  projectId: string;
  phaseCount: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="mr-2 h-4 w-4" />
        ইউনিট যোগ
      </Button>
      <UnitFormDialog
        open={open}
        onOpenChange={setOpen}
        projectId={projectId}
        phaseCount={phaseCount}
      />
    </>
  );
}
