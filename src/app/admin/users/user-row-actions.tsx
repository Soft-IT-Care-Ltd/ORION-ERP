'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { KeyRound, MoreHorizontal, Pencil, UserCheck, UserX } from 'lucide-react';
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
import { setUserActive } from './actions';
import { UserFormDialog, type EditableUser } from './user-form-dialog';
import { ResetPasswordDialog } from './reset-password-dialog';

/**
 * Radix এ Dialog সরাসরি DropdownMenuItem এর ভেতরে রাখলে menu বন্ধ হওয়ার সময়
 * dialog ও বন্ধ হয়ে যায় — তাই dialog গুলো sibling হিসেবে রেখে state দিয়ে খোলা হচ্ছে।
 */
export function UserRowActions({
  user,
  active,
  isSelf,
}: {
  user: EditableUser;
  active: boolean;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function toggleActive() {
    setPending(true);
    const result = await setUserActive({ id: user.id, active: !active });
    setPending(false);
    setConfirmOpen(false);

    if (result.ok) {
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
          <Button variant="ghost" size="icon" aria-label={`${user.name} এর অপশন`}>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEditOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            এডিট
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setResetOpen(true)}>
            <KeyRound className="mr-2 h-4 w-4" />
            পাসওয়ার্ড রিসেট
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={isSelf && active}
            onSelect={() => (active ? setConfirmOpen(true) : void toggleActive())}
          >
            {active ? (
              <>
                <UserX className="mr-2 h-4 w-4" />
                নিষ্ক্রিয় করুন
              </>
            ) : (
              <>
                <UserCheck className="mr-2 h-4 w-4" />
                সক্রিয় করুন
              </>
            )}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <UserFormDialog open={editOpen} onOpenChange={setEditOpen} user={user} />
      <ResetPasswordDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        userId={user.id}
        userName={user.name}
      />

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{user.name} কে নিষ্ক্রিয় করবেন?</AlertDialogTitle>
            <AlertDialogDescription>
              নিষ্ক্রিয় ইউজার আর লগইন করতে পারবে না এবং চালু সেশনও সাথে সাথে বন্ধ হয়ে যাবে।
              পরে আবার সক্রিয় করা যাবে।
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>বাতিল</AlertDialogCancel>
            <AlertDialogAction disabled={pending} onClick={(e) => { e.preventDefault(); void toggleActive(); }}>
              নিষ্ক্রিয় করুন
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
