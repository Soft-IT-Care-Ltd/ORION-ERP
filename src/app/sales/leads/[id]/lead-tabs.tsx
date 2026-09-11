import Link from 'next/link';
import { cn } from '@/lib/utils';

/**
 * লিড ডিটেইলের ট্যাব — URL এর `?tab=` দিয়ে (client state নয়)।
 *
 * এতে ট্যাবগুলো shareable/bookmarkable থাকে, রিফ্রেশেও একই ট্যাব খোলা থাকে, আর
 * প্রতিটি প্যানেল server component হিসেবেই রেন্ডার হয় — বিলিং তালিকা তাই কখনো
 * ব্রাউজারে যায় না যদি ইউজারের সেটি দেখার অনুমতি না থাকে।
 */
export type LeadTab = 'overview' | 'checklist' | 'ledger';

export const DEFAULT_LEAD_TAB: LeadTab = 'overview';

/**
 * URL এর `?tab=` → ট্যাব। `billing` ছিল লেজার ট্যাবের আগের নাম — পুরনো
 * লিংক/বুকমার্ক যেন ভেঙে না যায়, তাই সেটিও এখানে মেনে নেওয়া হয়।
 */
export function toLeadTab(value: string | undefined): LeadTab {
  if (value === 'checklist') return 'checklist';
  if (value === 'ledger' || value === 'billing') return 'ledger';
  return DEFAULT_LEAD_TAB;
}

export function LeadTabs({
  leadId,
  active,
  tabs,
}: {
  leadId: string;
  active: LeadTab;
  tabs: { id: LeadTab; label: string; count?: number }[];
}) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      <nav aria-label="লিড সেকশন" className="flex w-max min-w-full gap-1 border-b">
        {tabs.map((tab) => {
          const isActive = tab.id === active;
          return (
            <Link
              key={tab.id}
              href={`/sales/leads/${leadId}?tab=${tab.id}`}
              scroll={false}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground',
              )}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 ? (
                <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-[11px] tabular-nums text-muted-foreground">
                  {tab.count}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
