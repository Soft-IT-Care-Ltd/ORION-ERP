import { LedgerType, type LedgerCategory } from '@prisma/client';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { LEDGER_CATEGORY_LABEL, LEDGER_FORM_CATEGORIES, LEDGER_TYPE_SHORT } from '@/lib/ledger';
import type { LedgerLeadOption } from '@/lib/ledger-data';
import type { MonthOption } from './months';

/**
 * কোম্পানি লেজারের ফিল্টার — মাস, ধরন, ক্যাটেগরি ও ক্লায়েন্ট।
 *
 * `executive-filter.tsx` এর মতোই সাধারণ GET ফর্ম: JS ছাড়াই চলে, ফলাফল
 * বুকমার্ক/শেয়ার করা যায় এবং কুয়েরিটা সার্ভারেই হয় (কোনো ক্লায়েন্ট state নেই)।
 */
export function LedgerFilter({
  months,
  leads,
  selected,
}: {
  months: MonthOption[];
  leads: LedgerLeadOption[];
  selected: {
    month: string;
    type: LedgerType | '';
    category: LedgerCategory | '';
    lead: string;
  };
}) {
  return (
    <form method="GET" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
      <NativeSelect name="month" defaultValue={selected.month} aria-label="মাস">
        {months.map((month) => (
          <option key={month.value} value={month.value}>
            {month.label}
          </option>
        ))}
        <option value="all">সব সময়</option>
      </NativeSelect>

      <NativeSelect name="type" defaultValue={selected.type} aria-label="ধরন">
        <option value="">আয় ও খরচ দুটোই</option>
        {Object.values(LedgerType).map((value) => (
          <option key={value} value={value}>
            শুধু {LEDGER_TYPE_SHORT[value]}
          </option>
        ))}
      </NativeSelect>

      <NativeSelect name="category" defaultValue={selected.category} aria-label="ক্যাটেগরি">
        <option value="">সব ক্যাটেগরি</option>
        {LEDGER_FORM_CATEGORIES.map((category) => (
          <option key={category} value={category}>
            {LEDGER_CATEGORY_LABEL[category]}
          </option>
        ))}
      </NativeSelect>

      <NativeSelect name="lead" defaultValue={selected.lead} aria-label="ক্লায়েন্ট">
        <option value="">সব এন্ট্রি</option>
        <option value="general">শুধু কোম্পানির সাধারণ (ক্লায়েন্ট ছাড়া)</option>
        <option value="client">শুধু ক্লায়েন্ট-ট্যাগ করা</option>
        {leads.map((lead) => (
          <option key={lead.id} value={lead.id}>
            {lead.name}
            {lead.hint ? ` — ${lead.hint}` : ''}
          </option>
        ))}
      </NativeSelect>

      <Button type="submit" variant="secondary">
        দেখুন
      </Button>
    </form>
  );
}
