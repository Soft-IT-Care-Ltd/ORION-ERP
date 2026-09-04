import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { canAccessRoute, homeForRole, ROLE_LABEL } from '@/lib/rbac';
import { Badge } from '@/components/ui/badge';
import { SignOutButton } from './sign-out-button';

/**
 * প্রতিটি role-panel এর common shell (header + auth guard)।
 * Middleware ছাড়াও সার্ভার-সাইডে আবার চেক করা হচ্ছে — defense in depth।
 * Phase 1 এ এখানে role-wise sidebar navigation যোগ হবে।
 */
export async function PanelShell({
  basePath,
  title,
  children,
}: {
  basePath: string;
  title: string;
  children: ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect(`/login?callbackUrl=${encodeURIComponent(basePath)}`);
  if (!canAccessRoute(session.user.role, basePath)) redirect(homeForRole(session.user.role));

  const { name, email, role } = session.user;

  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <header className="sticky top-0 z-10 border-b bg-background">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold">{title}</p>
            <p className="truncate text-xs text-muted-foreground">
              {name} · {email}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{ROLE_LABEL[role]}</Badge>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 p-4">{children}</main>
    </div>
  );
}
