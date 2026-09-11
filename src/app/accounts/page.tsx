import Link from 'next/link';
import { redirect } from 'next/navigation';
import { endOfMonth, format, startOfMonth } from 'date-fns';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Scale,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { getAuthorizedUser } from '@/lib/guards';
import {
  loadAgingReport,
  loadCollectionKpi,
  markOverdueInstallments,
} from '@/lib/payment-data';
import { loadCompanyLedgerSummary, loadMonthlyLedgerTrend } from '@/lib/ledger-data';
import { cn, formatBDT } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AgingSummary, OverdueTable } from '@/components/payment-schedule';
import { LedgerTrendChart } from './ledger-trend-chart';
import { OverdueSweepButton } from './payments/overdue-sweep-button';

export const metadata = { title: 'অ্যাকাউন্টস ড্যাশবোর্ড' };

/** ড্যাশবোর্ডে সবচেয়ে পুরনো কতগুলো বকেয়া দেখানো হবে (পুরো তালিকা ওভারডিউ পেজে) */
const OVERDUE_PREVIEW = 8;

/** লেজার চার্টে কত মাসের প্রবণতা */
const TREND_MONTHS = 6;

/**
 * PRD সেকশন ৫.৫ — Accounts ড্যাশবোর্ড: Total Receivable / Collected / Overdue
 * এর KPI ও aging report (0-15 / 16-30 / 30+ দিন)।
 *
 * সঙ্গে PRD সেকশন ৫.৬ এর company-wide মাসিক Income vs Expense সামারি — লেজারের
 * সব এন্ট্রি নিয়ে (ক্লায়েন্টে ট্যাগ করা থাকুক বা না থাকুক)।
 */
export default async function AccountsDashboard() {
  const accounts = await getAuthorizedUser('report:financial');
  if (!accounts) redirect('/');

  const now = new Date();
  // ড্যাশবোর্ড খোলার সময়েই ওভারডিউ ডিটেকশন চলে — cron না থাকলেও সংখ্যা সঠিক
  await markOverdueInstallments(now);

  const [kpi, aging, ledgerMonth, ledgerTrend] = await Promise.all([
    loadCollectionKpi(now),
    loadAgingReport(now),
    loadCompanyLedgerSummary(startOfMonth(now), endOfMonth(now)),
    loadMonthlyLedgerTrend(now, TREND_MONTHS),
  ]);

  const monthLabel = format(now, 'MMMM yyyy');
  const collectedPercent =
    kpi.planTotal > 0 ? Math.round((kpi.planCollected / kpi.planTotal) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">অ্যাকাউন্টস ড্যাশবোর্ড</h1>
          <p className="text-sm text-muted-foreground">কালেকশন ও ওভারডিউ সারসংক্ষেপ</p>
        </div>
        <OverdueSweepButton />
      </div>

      {/* ------------------------------------------------------------ KPI */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          icon={CalendarClock}
          label={`এই মাসে due (${monthLabel})`}
          value={formatBDT(kpi.monthReceivable)}
          hint={`${kpi.monthReceivableCount} টি কিস্তি`}
        />
        <Kpi
          icon={TrendingUp}
          label="এই মাসে আদায়"
          value={formatBDT(kpi.monthCollected)}
          hint={`${kpi.monthCollectedCount} টি পেমেন্ট`}
          tone="text-emerald-700 dark:text-emerald-400"
        />
        <Kpi
          icon={AlertTriangle}
          label="মোট বকেয়া"
          value={formatBDT(aging.totalAmount)}
          hint={`${aging.totalCount} কিস্তি · ${aging.totalAccounts} অ্যাকাউন্ট`}
          tone={aging.totalAmount > 0 ? 'text-destructive' : undefined}
        />
        <Kpi
          icon={Wallet}
          label="সব প্ল্যান মিলিয়ে অনাদায়ী"
          value={formatBDT(kpi.outstanding)}
          hint={`${formatBDT(kpi.planCollected)} / ${formatBDT(kpi.planTotal)} আদায় (${collectedPercent}%)`}
        />
      </div>

      {kpi.plansPending > 0 ? (
        <Card className="border-amber-500/40 bg-amber-50/60 dark:bg-amber-950/20">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <p className="flex items-center gap-2 text-sm">
              <CalendarClock className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-500" />
              <span>
                <span className="font-medium">{kpi.plansPending} টি প্রজেক্টে</span> এখনো পেমেন্ট
                প্ল্যান সেট করা হয়নি — কিস্তির শিডিউল দিয়ে শুরু করুন।
              </span>
            </p>
            <Button asChild size="sm" variant="outline">
              <Link href="/accounts/schedule">
                শিডিউল সেট করুন
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {/* ------------------------------------- মাসিক আয় বনাম খরচ (লেজার) */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">মাসিক আয় ও খরচ</CardTitle>
              <CardDescription>
                কোম্পানির পুরো লেজার — ক্লায়েন্টে ট্যাগ করা ও সাধারণ, সব এন্ট্রি মিলিয়ে
                (PRD সেকশন ৫.৬)
              </CardDescription>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link href="/accounts/ledger">
                লেজার খুলুন
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Kpi
              icon={ArrowUpRight}
              label={`এই মাসে আয় (${monthLabel})`}
              value={formatBDT(ledgerMonth.billed)}
              hint={`${ledgerMonth.incomeCount} টি এন্ট্রি`}
              tone="text-emerald-700 dark:text-emerald-400"
            />
            <Kpi
              icon={ArrowDownRight}
              label="এই মাসে খরচ"
              value={formatBDT(ledgerMonth.cost)}
              hint={`${ledgerMonth.expenseCount} টি এন্ট্রি`}
              tone="text-amber-700 dark:text-amber-500"
            />
            <Kpi
              icon={Scale}
              label="নিট (আয় − খরচ)"
              value={formatBDT(ledgerMonth.net)}
              hint={`${ledgerMonth.generalCount} টি ক্লায়েন্ট-ট্যাগ ছাড়া এন্ট্রি`}
              tone={
                ledgerMonth.net >= 0
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : 'text-destructive'
              }
            />
          </div>
          <LedgerTrendChart months={ledgerTrend} />
        </CardContent>
      </Card>

      {/* --------------------------------------------------- Aging report */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">ওভারডিউ Aging রিপোর্ট</CardTitle>
              <CardDescription>০–১৫ / ১৬–৩০ / ৩০+ দিন — অনাদায়ী অঙ্ক ও কিস্তি সংখ্যা</CardDescription>
            </div>
            {aging.totalCount > 0 ? (
              <Button asChild size="sm" variant="outline">
                <Link href="/accounts/overdue">
                  বিস্তারিত
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {aging.totalCount === 0 ? (
            <p className="flex items-center justify-center gap-2 rounded-md border border-dashed p-6 text-sm text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
              কোনো কিস্তি বকেয়া নেই — সব সময়মতো আদায় হয়েছে
            </p>
          ) : (
            <>
              <AgingSummary
                buckets={aging.buckets}
                totalAmount={aging.totalAmount}
                totalCount={aging.totalCount}
                totalAccounts={aging.totalAccounts}
              />
              <div>
                <p className="mb-2 text-sm font-medium">
                  সবচেয়ে পুরনো বকেয়া
                  {aging.rows.length > OVERDUE_PREVIEW ? (
                    <span className="font-normal text-muted-foreground">
                      {' '}
                      (প্রথম {OVERDUE_PREVIEW} টি)
                    </span>
                  ) : null}
                </p>
                <OverdueTable rows={aging.rows.slice(0, OVERDUE_PREVIEW)} />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ------------------------------------------------------ quick links */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <QuickLink
          href="/accounts/schedule"
          icon={CalendarClock}
          title="পেমেন্ট শিডিউল"
          description="প্রজেক্ট বেছে ইনস্টলমেন্ট প্ল্যান তৈরি বা এডিট করুন"
        />
        <QuickLink
          href="/accounts/payments"
          icon={Banknote}
          title="পেমেন্ট এন্ট্রি"
          description="টাকা জমা নিন ও রসিদ প্রিন্ট করুন"
        />
        <QuickLink
          href="/accounts/ledger"
          icon={BookOpen}
          title="লেজার"
          description="আয়/খরচ এন্ট্রি — ক্লায়েন্ট-ভিত্তিক বা কোম্পানির সাধারণ"
        />
        <QuickLink
          href="/accounts/overdue"
          icon={AlertTriangle}
          title="ওভারডিউ রিপোর্ট"
          description="বয়স-ভিত্তিক বকেয়ার পূর্ণ তালিকা"
        />
      </div>
    </div>
  );
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

function QuickLink({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-start gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/50"
    >
      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </Link>
  );
}
