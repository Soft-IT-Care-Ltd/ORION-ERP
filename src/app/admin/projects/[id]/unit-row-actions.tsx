'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { ListChecks, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { deleteUnit } from '../actions';
import { UnitFormDialog, type EditableUnit } from './unit-form-dialog';

export function UnitRowActions({
  unit,
  projectId,
  phaseCount,
}: {
  unit: EditableUnit;
  projectId: string;
  phaseCount: number;
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function onDelete() {
    setPending(true);
    const result = await deleteUnit({ id: unit.id });
    setPending(false);

    if (result.ok) {
      setConfirmOpen(false);
      toast.success(result.message);
      router.refresh();
    } else {
      toast.error(result.message);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`${unit.unitNo} এর অপশন`}>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/admin/projects/${projectId}/units/${unit.id}`}>
              <ListChecks className="mr-2 h-4 w-4" />
              ফেজ টাইমলাইন
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setEditOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            এডিট
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={() => setConfirmOpen(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            মুছে ফেলুন
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <UnitFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        projectId={projectId}
        phaseCount={phaseCount}
        unit={unit}
      />

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ইউনিট {unit.unitNo} মুছে ফেলবেন?</AlertDialogTitle>
            <AlertDialogDescription>
              ইউনিটের ফেজ টাইমলাইন, ইঞ্জিনিয়ারের আপডেট ও ছবিও মুছে যাবে। বিক্রিত বা লিডের সঙ্গে
              যুক্ত ইউনিট মোছা যাবে না। এই কাজটি ফেরানো যাবে না।
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>বাতিল</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={(event) => {
                event.preventDefault();
                void onDelete();
              }}
            >
              মুছে ফেলুন
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
