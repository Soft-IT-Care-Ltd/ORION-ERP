import { redirect } from 'next/navigation';
import { ArrowDownRight, ArrowUpRight, BookOpen, Scale } from 'lucide-react';
import { LedgerCategory, LedgerType } from '@prisma/client';
import { getAuthorizedUser } from '@/lib/guards';
import { can } from '@/lib/rbac';
import { listLedgerLeadOptions, loadCompanyLedger } from '@/lib/ledger-data';
import { cn, formatBDT } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LedgerEntryForm, LedgerTable } from '@/components/ledger';
import { LedgerFilter } from './ledger-filter';
import { monthOptions, monthRange } from './months';

export const metadata = { title: 'অ্যাকাউন্টস লেজার' };

export const dynamic = 'force-dynamic';

/** এক পাতায় সর্বোচ্চ কতগুলো এন্ট্রি দেখানো হবে (সামারি পুরো ফিল্টারের) */
const LIST_LIMIT = 100;

/**
 * **Main Company Ledger** — PRD সেকশন ৫.৬ (২)।
 *
 * দৈনিক/মাসিক আয় ও খরচ এখান থেকেই ইনপুট হয়। প্রতিটি এন্ট্রি ঐচ্ছিকভাবে একটা
 * ক্লায়েন্টে (lead) ট্যাগ করা যায় — ট্যাগ করলে সেটি ক্লায়েন্টের প্রোফাইলেও
 * (Client Ledger) এবং এখানেও দেখায়; ট্যাগ না করলে (office rent, salary) শুধু
 * এখানেই থাকে।
 *
 * **নিরাপত্তা:** পাতাটি `ledger:view` চায় এবং `/accounts` route টি শুধু ADMIN ও
 * ACCOUNTS এর (`lib/rbac.ts` → `ROUTE_ROLES`) — অর্থাৎ EXPENSE এন্ট্রি কখনো
 * customer role এর নাগালে আসে না।
 */
export default async function LedgerPage({
  searchParams,
}: {
  searchParams: {
    month?: string;
    type?: string;
    category?: string;
    lead?: string;
  };
}) {
  const user = await getAuthorizedUser('ledger:view');
  if (!user) redirect('/');

  const now = new Date();
  const range = monthRange(searchParams.month, now);

  // ক্লায়েন্ট ফিল্টারটি তিন রকম হতে পারে: শুধু ট্যাগহীন, শুধু ট্যাগ করা, বা
  // একটি নির্দিষ্ট লিড
  const leadParam = searchParams.lead ?? '';
  const tagged =
    leadParam === 'general' ? 'general' : leadParam === 'client' ? 'client' : undefined;
  const leadId = tagged === undefined && leadParam !== '' ? leadParam : undefined;

  const type = isLedgerType(searchParams.type) ? searchParams.type : '';
  const category = isLedgerCategory(searchParams.category) ? searchParams.category : '';

  const [ledger, leads] = await Promise.all([
    loadCompanyLedger({
      from: range.from,
      to: range.to,
      type: type || undefined,
      category: category || undefined,
      leadId,
      tagged,
      take: LIST_LIMIT,
    }),
    listLedgerLeadOptions(),
  ]);

  const canManage = can(user.role, 'ledger:manage');
  const { summary } = ledger;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">অ্যাকাউন্টস লেজার</h1>
        <p className="text-sm text-muted-foreground">
          কোম্পানির আয় ও খরচ — ক্লায়েন্টে ট্যাগ করা ও সাধারণ, দুই ধরনের এন্ট্রিই (PRD সেকশন ৫.৬)
        </p>
      </div>

      {/* ------------------------------------------------------- সামারি */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi
          icon={ArrowUpRight}
          label={`মোট আয় · ${range.label}`}
          value={formatBDT(summary.billed)}
          hint={`${summary.incomeCount} টি এন্ট্রি`}
          tone="text-emerald-700 dark:text-emerald-400"
        />
        <Kpi
          icon={ArrowDownRight}
          label={`মোট খরচ · ${range.label}`}
          value={formatBDT(summary.cost)}
          hint={`${summary.expenseCount} টি এন্ট্রি`}
          tone="text-amber-700 dark:text-amber-500"
        />
        <Kpi
          icon={Scale}
          label="নিট (আয় − খরচ)"
          value={formatBDT(summary.net)}
          hint={`${summary.generalCount} টি ক্লায়েন্ট-ট্যাগ ছাড়া এন্ট্রি`}
          tone={summary.net >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-destructive'}
        />
      </div>

      {/* --------------------------------------------------- নতুন এন্ট্রি */}
      {canManage ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">নতুন এন্ট্রি</CardTitle>
            <CardDescription>
              ক্লায়েন্ট বাছা ঐচ্ছিক — বাছলে এন্ট্রিটি তার প্রোফাইলেও যাবে, না বাছলে শুধু কোম্পানি
              লেজারে থাকবে।
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LedgerEntryForm
              leads={leads}
              notePlaceholder="যেমন: সেপ্টেম্বরের অফিস ভাড়া"
              amountPlaceholder="5000"
            />
          </CardContent>
        </Card>
      ) : null}

      {/* -------------------------------------------------------- তালিকা */}
      <Card>
        <CardHeader className="gap-3 pb-3">
          <div>
            <CardTitle className="text-base">এন্ট্রি তালিকা</CardTitle>
            <CardDescription>
              {ledger.totalCount} টি এন্ট্রি
              {ledger.totalCount > ledger.entries.length
                ? ` — সাম্প্রতিক ${ledger.entries.length} টি দেখানো হচ্ছে (সামারি পুরোটার)`
                : null}
            </CardDescription>
          </div>
          <LedgerFilter
            months={monthOptions(now)}
            leads={leads}
            selected={{ month: range.value, type, category, lead: leadParam }}
          />
        </CardHeader>
        <CardContent>
          {ledger.entries.length === 0 ? (
            <p className="flex flex-col items-center gap-2 rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
              <BookOpen className="h-6 w-6" />
              এই ফিল্টারে কোনো এন্ট্রি নেই — উপরের ফর্ম থেকে প্রথম এন্ট্রিটি যোগ করুন।
            </p>
          ) : (
            <LedgerTable entries={ledger.entries} canManage={canManage} showLead />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function isLedgerType(value: string | undefined): value is LedgerType {
  return value === LedgerType.INCOME || value === LedgerType.EXPENSE;
}

function isLedgerCategory(value: string | undefined): value is LedgerCategory {
  return Object.values(LedgerCategory).some((category) => category === value);
}

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
  tone?: string;
}) {
  return (
    <Card>
      <CardContent className="space-y-1 p-4">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Icon className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{label}</span>
        </p>
        <p className={cn('truncate text-xl font-semibold tabular-nums', tone)}>{value}</p>
        {hint ? <p className="truncate text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}
