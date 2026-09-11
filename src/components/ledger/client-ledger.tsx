import { Lock } from 'lucide-react';
import type { ClientLedgerSummary } from '@/lib/ledger';
import { PRE_PROJECT_CATEGORIES } from '@/lib/ledger';
import type { LedgerEntryView } from '@/lib/ledger-data';
import { cn, formatBDT } from '@/lib/utils';
import { LedgerEntryForm } from './ledger-entry-form';
import { LedgerTable } from './ledger-table';

/**
 * **Client Ledger** — PRD সেকশন ৫.৬ (১)।
 *
 * এক ক্লায়েন্টের (লিড → প্রজেক্ট, একই `leadId` ধরে) সব হিসাব এক জায়গায়:
 * মোট billed, মোট received, মোট internal cost ও net profit/loss — সঙ্গে
 * প্রতিটি এন্ট্রির তালিকা ও নতুন এন্ট্রির ফর্ম।
 *
 * লিড ডিটেইল ও প্রজেক্ট ডিটেইল — দুই জায়গাতেই এই একই কম্পোনেন্ট (PRD এর
 * "Lead থেকে শুরু করে, Project হয়ে গেলেও একই লিংকে")।
 *
 * **কাস্টমার এই কম্পোনেন্টটি কখনো পায় না** — এখানে EXPENSE ও মার্জিন থাকে।
 * পেজগুলো `ledger:view` যাচাই করেই এটি রেন্ডার করে, আর ডেটাও তখনই লোড হয়।
 */
export function ClientLedger({
  leadId,
  entries,
  summary,
  canManage,
}: {
  leadId: string;
  entries: LedgerEntryView[];
  summary: ClientLedgerSummary;
  /** ADMIN/ACCOUNTS — নতুন এন্ট্রি ও মোছা; MARKETING read-only */
  canManage: boolean;
}) {
  const hasContract = summary.contractBilled > 0;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryTile
          label="মোট বিল (billed)"
          value={formatBDT(summary.totalBilled)}
          hint={
            hasContract
              ? `সার্ভিস ${formatBDT(summary.serviceBilled)} + কন্ট্রাক্ট ${formatBDT(summary.contractBilled)}`
              : `${summary.incomeCount} টি সার্ভিস বিল`
          }
        />
        <SummaryTile
          label="মোট আদায় (received)"
          value={formatBDT(summary.totalReceived)}
          hint={
            summary.outstanding > 0 ? `বাকি ${formatBDT(summary.outstanding)}` : 'সব আদায় হয়েছে'
          }
          tone={summary.outstanding > 0 ? undefined : 'positive'}
        />
        <SummaryTile
          label="ইন্টারনাল কস্ট"
          value={formatBDT(summary.cost)}
          hint={`${summary.expenseCount} টি এন্ট্রি · ক্লায়েন্ট দেখেন না`}
        />
        <SummaryTile
          label="নিট লাভ/ক্ষতি"
          value={formatBDT(summary.netProfit)}
          hint="মোট বিল − ইন্টারনাল কস্ট"
          tone={summary.netProfit >= 0 ? 'positive' : 'negative'}
        />
      </div>

      {canManage ? (
        <LedgerEntryForm
          leadId={leadId}
          categories={PRE_PROJECT_CATEGORIES}
          defaultCategory="SOIL_TEST"
        />
      ) : (
        <p className="flex items-start gap-2 rounded-md border border-dashed p-3 text-xs text-muted-foreground">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          লেজার এন্ট্রি তৈরি করতে পারেন শুধু Admin ও Accounts (PRD সেকশন ৪) — আপনি তালিকাটি
          দেখতে পাচ্ছেন, নতুন এন্ট্রির জন্য অ্যাকাউন্টসকে অনুরোধ করুন।
        </p>
      )}

      <LedgerTable
        entries={entries}
        canManage={canManage}
        emptyMessage="এখনো কোনো বিল বা খরচের এন্ট্রি নেই।"
      />

      {hasContract ? (
        <p className="text-xs text-muted-foreground">
          কনস্ট্রাকশন কিস্তির টাকা এই তালিকায় আলাদা সারি হিসেবে আসে না — সেগুলো পেমেন্ট
          শিডিউলে ওঠে এবং উপরের সামারিতে যোগ হয়েছে (PRD সেকশন ৫.৫)।
        </p>
      ) : null}
    </div>
  );
}

function SummaryTile({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'positive' | 'negative';
}) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          'mt-0.5 text-lg font-semibold tabular-nums',
          tone === 'positive' && 'text-emerald-600 dark:text-emerald-500',
          tone === 'negative' && 'text-destructive',
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
