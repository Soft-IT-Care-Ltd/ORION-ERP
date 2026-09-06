import { cn, formatBDT } from '@/lib/utils';
import type { PlanSummary } from '@/lib/payments';

/**
 * শিডিউলের উপরে বসা সারসংক্ষেপ — কত টাকার প্ল্যান, কত আদায় হয়েছে, কত বকেয়া।
 * `PhaseProgressSummary` এর পেমেন্ট-সংস্করণ; সব প্যানেলেই একই (server-safe)।
 */
export function PaymentSummary({
  summary,
  title,
  subtitle,
  className,
}: {
  summary: PlanSummary;
  title: string;
  subtitle?: string;
  className?: string;
}) {
  const { total, collected, outstanding, collectedPercent, overdueAmount, overdueCount, next } =
    summary;

  return (
    <div className={cn('rounded-lg border bg-background p-4', className)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium">{title}</p>
          {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold tabular-nums">{collectedPercent}%</p>
          <p className="text-xs text-muted-foreground">আদায় হয়েছে</p>
        </div>
      </div>

      <div
        className="mt-3 h-2 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={collectedPercent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="আদায়ের হার"
      >
        <div
          className="h-full rounded-full bg-emerald-600"
          style={{ width: `${Math.min(100, Math.max(0, collectedPercent))}%` }}
        />
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <Stat label="মোট মূল্য" value={formatBDT(total)} />
        <Stat
          label="আদায়কৃত"
          value={formatBDT(collected)}
          tone="text-emerald-700 dark:text-emerald-400"
        />
        <Stat label="বাকি" value={formatBDT(outstanding)} />
        <Stat
          label="বকেয়া"
          value={formatBDT(overdueAmount)}
          hint={overdueCount > 0 ? `${overdueCount} টি কিস্তি` : 'কোনো বকেয়া নেই'}
          tone={overdueAmount > 0 ? 'text-destructive' : 'text-muted-foreground'}
        />
      </dl>

      {next ? (
        <p className="mt-3 border-t pt-3 text-sm">
          <span className="text-muted-foreground">পরবর্তী কিস্তি — </span>
          <span className="font-medium">{next.label}</span>
          <span className="text-muted-foreground">
            {' '}
            · {next.dueDateLabel} · {formatBDT(next.remaining)}
          </span>
        </p>
      ) : summary.count > 0 ? (
        <p className="mt-3 border-t pt-3 text-sm font-medium text-emerald-700 dark:text-emerald-400">
          সব কিস্তি পরিশোধিত
        </p>
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn('truncate font-semibold tabular-nums', tone)}>{value}</dd>
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
