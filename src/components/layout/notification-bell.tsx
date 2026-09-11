'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Bell,
  CalendarClock,
  CheckCheck,
  FileText,
  HardHat,
  Loader2,
  UserPlus,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import type { NotificationFeed, NotificationType } from '@/lib/notifications';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  fetchNotifications,
  readAllNotifications,
  readNotification,
} from './notification-actions';

/**
 * হেডারের নোটিফিকেশন বেল — PRD সেকশন ৫.৬ (In-app চ্যানেল)।
 *
 * `PanelShell` server-side তালিকাটি একবার রেন্ডার করে দেয় (badge টা প্রথম
 * পেইন্টেই ঠিক থাকে), তারপর এই কম্পোনেন্ট ড্রপডাউন খোলার সময় ও প্রতি মিনিটে
 * server action দিয়ে রিফ্রেশ করে। WebSocket/SSE লাগেনি — খবরগুলো সময়-নির্ভর,
 * সেকেন্ডের হিসেবে জরুরি নয়।
 */

const POLL_INTERVAL_MS = 60_000;

/** টাইপভেদে আইকন — অচেনা টাইপে সাধারণ বেল */
const TYPE_ICON: Record<NotificationType, LucideIcon> = {
  FOLLOW_UP_DUE: CalendarClock,
  PAYMENT_DUE: Wallet,
  PAYMENT_OVERDUE: AlertTriangle,
  PHASE_MILESTONE: HardHat,
  DOCUMENT_UPLOADED: FileText,
  LEAD_ASSIGNED: UserPlus,
  PROJECT_CREATED: HardHat,
};

/** জরুরি খবরগুলো রঙে আলাদা — বকেয়া লাল, ফলো-আপ অ্যাম্বার */
const TYPE_TONE: Record<NotificationType, string> = {
  FOLLOW_UP_DUE: 'text-amber-600 dark:text-amber-500',
  PAYMENT_DUE: 'text-sky-600 dark:text-sky-400',
  PAYMENT_OVERDUE: 'text-destructive',
  PHASE_MILESTONE: 'text-emerald-600 dark:text-emerald-500',
  DOCUMENT_UPLOADED: 'text-muted-foreground',
  LEAD_ASSIGNED: 'text-violet-600 dark:text-violet-400',
  PROJECT_CREATED: 'text-muted-foreground',
};

export function NotificationBell({ initial }: { initial: NotificationFeed }) {
  const router = useRouter();
  const [feed, setFeed] = useState(initial);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  // server render থেকে নতুন তালিকা এলে (router.refresh / নেভিগেশন) সেটিই সত্য
  useEffect(() => setFeed(initial), [initial]);

  const refresh = useCallback(() => {
    startTransition(async () => {
      setFeed(await fetchNotifications());
    });
  }, []);

  // ড্রপডাউন বন্ধ থাকলেও badge টা তাজা রাখা
  useEffect(() => {
    const timer = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) refresh();
  }

  function onItemClick(item: NotificationFeed['items'][number]) {
    setOpen(false);
    // পড়া-চিহ্নিত করা ব্যাকগ্রাউন্ডে — নেভিগেশনের জন্য অপেক্ষা করানোর দরকার নেই
    startTransition(async () => {
      setFeed(await readNotification(item.id));
    });
    if (item.link) router.push(item.link);
  }

  function onReadAll() {
    startTransition(async () => {
      setFeed(await readAllNotifications());
    });
  }

  const { items, unreadCount } = feed;
  const badge = unreadCount > 9 ? '9+' : String(unreadCount);

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={
            unreadCount > 0 ? `নোটিফিকেশন — ${unreadCount} টি অপঠিত` : 'নোটিফিকেশন'
          }
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 ? (
            <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground">
              {badge}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>

      {/* মোবাইলে প্রায় পুরো স্ক্রিন-চওড়া, ডেস্কটপে স্থির প্রস্থ */}
      <DropdownMenuContent align="end" className="w-[calc(100vw-2rem)] p-0 sm:w-96">
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <p className="text-sm font-semibold">
            নোটিফিকেশন
            {unreadCount > 0 ? (
              <span className="ml-1 font-normal text-muted-foreground">
                ({unreadCount} টি অপঠিত)
              </span>
            ) : null}
          </p>
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /> : null}
          {unreadCount > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={onReadAll}
              disabled={pending}
            >
              <CheckCheck className="mr-1 h-3.5 w-3.5" />
              সব পড়া হয়েছে
            </Button>
          ) : null}
        </div>
        <DropdownMenuSeparator className="my-0" />

        {items.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">
            এখনো কোনো নোটিফিকেশন নেই
          </p>
        ) : (
          <ul className="max-h-[60vh] overflow-y-auto">
            {items.map((item) => {
              const Icon = TYPE_ICON[item.type] ?? Bell;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onItemClick(item)}
                    className={cn(
                      'flex w-full items-start gap-2.5 border-b px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-muted/60',
                      !item.readStatus && 'bg-secondary/50',
                    )}
                  >
                    <Icon
                      className={cn('mt-0.5 h-4 w-4 shrink-0', TYPE_TONE[item.type])}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          'block text-sm leading-snug',
                          !item.readStatus && 'font-medium',
                        )}
                      >
                        {item.message}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {item.createdAtLabel}
                      </span>
                    </span>
                    {!item.readStatus ? (
                      <span
                        className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-destructive"
                        aria-label="অপঠিত"
                      />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
