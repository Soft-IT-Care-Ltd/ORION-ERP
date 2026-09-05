'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProjectFormDialog, type EngineerOption } from './project-form-dialog';

export function NewProjectButton({ engineers }: { engineers: EngineerOption[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="mr-2 h-4 w-4" />
        নতুন প্রজেক্ট
      </Button>
      <ProjectFormDialog open={open} onOpenChange={setOpen} engineers={engineers} />
    </>
  );
}
