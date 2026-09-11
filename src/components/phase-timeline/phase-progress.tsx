import { cn } from '@/lib/utils';
import { PHASE_STATUS_BADGE, PHASE_STATUS_LABEL, type PhaseSummary } from '@/lib/phases';

/**
 * টাইমলাইনের সঙ্গী দুটি ছোট কম্পোনেন্ট — `PhaseTimeline` এর মতোই server-safe।
 */

/**
 * লিস্টের সারিতে সরু প্রগ্রেস বার (My Sites, Admin প্রজেক্ট তালিকা)।
 * পুরো টাইমলাইন না দেখিয়েই "কতদূর" বোঝানোর জন্য।
 */
export function PhaseProgressBar({
  progress,
  className,
  showLabel = true,
}: {
  progress: number;
  className?: string;
  showLabel?: boolean;
}) {
  const value = Math.min(100, Math.max(0, Math.round(progress)));

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        className="h-1.5 min-w-16 flex-1 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={cn(
            'h-full rounded-full',
            value >= 100 ? 'bg-emerald-600' : 'bg-orion-gold',
          )}
          style={{ width: `${value}%` }}
        />
      </div>
      {showLabel ? (
        <span className="w-10 shrink-0 text-right text-xs font-semibold tabular-nums">
          {value}%
        </span>
      ) : null}
    </div>
  );
}

/**
 * PRD সেকশন ৫.২ — "আপনার প্রজেক্ট ৬৫% সম্পন্ন — বর্তমানে Finishing Phase চলছে"।
 * কাস্টমার পোর্টাল ও ইঞ্জিনিয়ারের সাইট পেজে টাইমলাইনের উপরে বসে।
 */
export function PhaseProgressSummary({
  summary,
  title,
  subtitle,
  className,
}: {
  summary: PhaseSummary;
  title: string;
  subtitle?: string;
  className?: string;
}) {
  const { progress, current, doneCount, total, delayedCount } = summary;

  return (
    <div className={cn('rounded-lg border bg-background p-4', className)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium">{title}</p>
          {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
        <p className="text-2xl font-semibold tabular-nums">{progress}%</p>
      </div>

      <PhaseProgressBar progress={progress} showLabel={false} className="mt-3" />

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
        {current ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="text-muted-foreground">বর্তমানে</span>
            <span className="font-medium">{current.nameBn ?? current.name}</span>
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                PHASE_STATUS_BADGE[current.status],
              )}
            >
              {PHASE_STATUS_LABEL[current.status]}
            </span>
          </span>
        ) : total > 0 ? (
          <span className="font-medium text-emerald-700 dark:text-emerald-400">
            সব ফেজ সম্পন্ন — হ্যান্ডওভারের জন্য প্রস্তুত
          </span>
        ) : (
          <span className="text-muted-foreground">এখনো ফেজ টাইমলাইন সেট করা হয়নি</span>
        )}

        {total > 0 ? (
          <span className="text-xs text-muted-foreground">
            {doneCount}/{total} ফেজ সম্পন্ন
            {delayedCount > 0 ? (
              <span className="font-medium text-destructive"> · {delayedCount} টি বিলম্বিত</span>
            ) : null}
          </span>
        ) : null}
      </div>
    </div>
  );
}
