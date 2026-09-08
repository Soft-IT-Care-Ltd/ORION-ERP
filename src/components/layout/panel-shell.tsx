import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canAccessRoute, homeForRole, ROLE_LABEL } from '@/lib/rbac';
import { getPanel } from '@/lib/nav';
import { loadNotifications, sweepIfStale } from '@/lib/notifications';
import { Badge } from '@/components/ui/badge';
import { OrionLockup } from '@/components/brand/orion-logo';
import { NavLinks } from './nav-links';
import { MobileNav } from './mobile-nav';
import { UserMenu } from './user-menu';
import { PanelSwitcher } from './panel-switcher';
import { NotificationBell } from './notification-bell';
import { AccountDisabled } from './account-disabled';

/**
 * প্রতিটি role-panel এর common shell: sidebar (ডেস্কটপ) / drawer (মোবাইল) + header।
 *
 * Middleware JWT token এর role দেখে — কিন্তু token ৭ দিন বাঁচে, তাই admin কারো role
 * বদলালে বা account নিষ্ক্রিয় করলে সেটি সাথে সাথে কার্যকর করতে এখানে DB থেকে
 * ইউজারের current status আবার যাচাই করা হয়।
 */
export async function PanelShell({
  basePath,
  children,
}: {
  basePath: string;
  children: ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect(`/login?callbackUrl=${encodeURIComponent(basePath)}`);

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, role: true, active: true },
  });

  // অ্যাকাউন্ট মুছে ফেলা বা নিষ্ক্রিয় করা হয়েছে → লগআউট স্ক্রিন
  // (redirect করলে /login আবার এখানে ফেরত পাঠাত — infinite loop)
  if (!user || !user.active) return <AccountDisabled />;

  // DB এর role অনুযায়ী অ্যাক্সেস — token এর stale role নয়
  if (!canAccessRoute(user.role, basePath)) redirect(homeForRole(user.role));

  const panel = getPanel(basePath);
  const isAdmin = user.role === 'ADMIN';

  // সময়-নির্ভর রিমাইন্ডারগুলো (ফলো-আপ ওভারডিউ, কিস্তির due/overdue, ফেজ সম্পন্ন)
  // মূলত `/api/cron/overdue` লেখে; cron সেট করা না থাকলেও যাতে হারিয়ে না যায়,
  // এখানে ঘণ্টায় একবার ফলব্যাক sweep চলে — বিস্তারিত `lib/notifications.ts` এ।
  await sweepIfStale();
  const notifications = await loadNotifications(user.id);

  return (
    <div className="flex min-h-screen bg-muted/30">
      {/* ডেস্কটপ sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r bg-background md:flex">
        {/* ব্র্যান্ড লোগো — ক্লিক করলে এই প্যানেলের ড্যাশবোর্ড হোমে */}
        <div className="flex items-center border-b px-4 py-4">
          <OrionLockup href={basePath} size={26} />
        </div>
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-3">
          <NavLinks basePath={basePath} />
          {isAdmin ? <PanelSwitcher currentBasePath={basePath} /> : null}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 border-b bg-background">
          <div className="flex items-center gap-2 px-3 py-2 md:px-6 md:py-3">
            <MobileNav basePath={basePath} title={panel.title} showSwitcher={isAdmin} />
            <OrionLockup href={basePath} size={24} showWordmark={false} className="md:hidden" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold md:text-base">{panel.title}</p>
            </div>
            <Badge variant="secondary" className="hidden sm:inline-flex">
              {ROLE_LABEL[user.role]}
            </Badge>
            <NotificationBell initial={notifications} />
            <UserMenu
              name={user.name}
              email={user.email}
              roleLabel={ROLE_LABEL[user.role]}
            />
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
