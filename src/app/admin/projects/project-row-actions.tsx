'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
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
import { deleteProject } from './actions';
import { ProjectFormDialog, type EditableProject, type EngineerOption } from './project-form-dialog';

/**
 * Radix Dialog সরাসরি DropdownMenuItem এর ভেতরে রাখলে menu বন্ধ হওয়ার সময় dialog ও
 * বন্ধ হয়ে যায় — তাই dialog গুলো sibling হিসেবে রেখে state দিয়ে খোলা হয়।
 */
export function ProjectRowActions({
  project,
  engineers,
  unitCount,
}: {
  project: EditableProject;
  engineers: EngineerOption[];
  unitCount: number;
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function onDelete() {
    setPending(true);
    const result = await deleteProject({ id: project.id });
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
          <Button variant="ghost" size="icon" aria-label={`${project.name} এর অপশন`}>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
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

      <ProjectFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        project={project}
        engineers={engineers}
      />

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{project.name} মুছে ফেলবেন?</AlertDialogTitle>
            <AlertDialogDescription>
              এর {unitCount} টি ইউনিট ও সেগুলোর ফেজ টাইমলাইনও মুছে যাবে। বিক্রিত বা লিডের সঙ্গে
              যুক্ত ইউনিট থাকলে মোছা যাবে না। এই কাজটি ফেরানো যাবে না।
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
