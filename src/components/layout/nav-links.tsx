'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { getPanel } from '@/lib/nav';

/**
 * Sidebar এর লিংক লিস্ট — ডেস্কটপ sidebar ও মোবাইল drawer দুই জায়গাতেই ব্যবহৃত।
 *
 * nav item গুলো এখানেই (client এ) `PANELS` থেকে পড়া হয়, server থেকে prop হিসেবে
 * পাঠানো হয় না — কারণ প্রতিটি item এ lucide আইকন **কম্পোনেন্ট** থাকে, আর server →
 * client বাউন্ডারিতে ফাংশন serialize করা যায় না।
 *
 * `upcomingPhase` দেওয়া আইটেম এখনো তৈরি হয়নি → disabled দেখানো হয় (dead link এড়াতে)।
 */
export function NavLinks({
  basePath,
  onNavigate,
}: {
  basePath: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const items = getPanel(basePath).items;

  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const Icon = item.icon;
        const active =
          pathname === item.href ||
          (item.matchPrefixes?.some((prefix) => pathname.startsWith(prefix)) ?? false);

        if (item.upcomingPhase) {
          return (
            <span
              key={item.href}
              aria-disabled="true"
              title={`Phase ${item.upcomingPhase} এ আসছে`}
              className="flex cursor-not-allowed items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground/50"
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
              <span className="ml-auto shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium">
                P{item.upcomingPhase}
              </span>
            </span>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
              active ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted',
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
