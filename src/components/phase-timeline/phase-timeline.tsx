import type { ReactNode } from 'react';
import { AlertTriangle, Camera, Check, Hammer } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  PHASE_STATUS_BADGE,
  PHASE_STATUS_DOT,
  PHASE_STATUS_FILL,
  PHASE_STATUS_LABEL,
  type PhaseView,
} from '@/lib/phases';

/**
 * PRD সেকশন ৫.২ — নির্মাণ ফেজের ভিজ্যুয়াল টাইমলাইন।
 *
 * Admin, Engineer ও Customer — তিন প্যানেলেই এই একই কম্পোনেন্ট ব্যবহার হয়।
 * এটি ইচ্ছে করেই server component (কোনো hook/handler নেই): শুধু ডেটা দেখায়।
 * এডিট করার সুযোগ আসে `actions` prop দিয়ে — ইঞ্জিনিয়ার প্যানেল প্রতিটি ফেজের
 * বিপরীতে আপডেট বাটন পাঠায়, Admin/Customer কিছু পাঠায় না (তাই read-only)।
 *
 * লেআউট: মোবাইলে খাড়া স্টেপার (ইঞ্জিনিয়ার ও কাস্টমার মোবাইল ব্রাউজারে দেখেন —
 * CLAUDE.md নিয়ম ৩), md থেকে আড়াআড়ি স্টেপার।
 */
export function PhaseTimeline({
  phases,
  actions,
  showDates = true,
  emptyMessage = 'এই প্রজেক্টে এখনো কোনো ফেজ যোগ করা হয়নি',
  className,
}: {
  phases: PhaseView[];
  /** phase id → অতিরিক্ত কনটেন্ট (যেমন "আপডেট" বাটন); না দিলে টাইমলাইন read-only */
  actions?: Record<string, ReactNode>;
  /** planned vs actual তারিখ দেখাবে কিনা — কাস্টমারের জন্য বন্ধ রাখা যায় */
  showDates?: boolean;
  emptyMessage?: string;
  className?: string;
}) {
  if (phases.length === 0) {
    return (
      <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </p>
    );
  }

  const ordered = [...phases].sort((a, b) => a.order - b.order);

  return (
    <ol className={cn('flex flex-col md:flex-row md:overflow-x-auto md:pb-1', className)}>
      {ordered.map((phase, index) => {
        const isLast = index === ordered.length - 1;
        const action = actions?.[phase.id];

        return (
          <li
            key={phase.id}
            className="flex gap-3 md:min-w-[12rem] md:flex-1 md:flex-col md:gap-2 md:pr-4"
          >
            {/* রেল: মোবাইলে বাঁ পাশে খাড়া, md থেকে উপরে আড়াআড়ি */}
            <div
              className="flex flex-col items-center md:w-full md:flex-row"
              aria-hidden="true"
            >
              <span
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                  PHASE_STATUS_DOT[phase.status],
                )}
              >
                <StatusIcon status={phase.status} order={phase.order} />
              </span>
              {isLast ? null : (
                <span className="w-px flex-1 bg-border md:h-px md:w-auto md:flex-auto" />
              )}
            </div>

            <div className={cn('min-w-0 flex-1 space-y-1.5', isLast ? 'pb-0' : 'pb-6', 'md:pb-0')}>
              <div>
                <p className="text-sm font-medium leading-tight">{phase.name}</p>
                {phase.nameBn ? (
                  <p className="text-xs text-muted-foreground">{phase.nameBn}</p>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                    PHASE_STATUS_BADGE[phase.status],
                  )}
                >
                  {PHASE_STATUS_LABEL[phase.status]}
                </span>
                <span className="text-xs font-semibold tabular-nums">{phase.percentComplete}%</span>
                {phase.photoCount > 0 ? (
                  <span className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground">
                    <Camera className="h-3 w-3" />
                    {phase.photoCount}
                  </span>
                ) : null}
              </div>

              <div
                className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-valuenow={phase.percentComplete}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${phase.name} — ${phase.percentComplete}% সম্পন্ন`}
              >
                <div
                  className={cn('h-full rounded-full', PHASE_STATUS_FILL[phase.status])}
                  style={{ width: `${phase.percentComplete}%` }}
                />
              </div>

              {showDates ? (
                <dl className="space-y-0.5 text-[11px] leading-snug text-muted-foreground">
                  <DateRow label="পরিকল্পিত" start={phase.plannedStart} end={phase.plannedEnd} />
                  <DateRow label="প্রকৃত" start={phase.actualStart} end={phase.actualEnd} />
                </dl>
              ) : null}

              {phase.delayDays ? (
                <p className="text-[11px] font-medium text-destructive">
                  {phase.delayDays} দিন পিছিয়ে
                  {phase.delayReason ? (
                    <span className="font-normal"> — {phase.delayReason}</span>
                  ) : null}
                </p>
              ) : null}

              {action ? <div className="pt-1">{action}</div> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function StatusIcon({ status, order }: { status: PhaseView['status']; order: number }) {
  if (status === 'DONE') return <Check className="h-4 w-4" />;
  if (status === 'DELAYED') return <AlertTriangle className="h-3.5 w-3.5" />;
  if (status === 'IN_PROGRESS') return <Hammer className="h-3.5 w-3.5" />;
  return <>{order}</>;
}

/** "পরিকল্পিত  05 Jan 2026 – 20 Feb 2026" — কিছু না থাকলে সারিটি দেখানোই হয় না */
function DateRow({
  label,
  start,
  end,
}: {
  label: string;
  start: string | null;
  end: string | null;
}) {
  if (!start && !end) return null;

  return (
    <div className="flex gap-1.5">
      <dt className="shrink-0">{label}</dt>
      <dd className="min-w-0 tabular-nums">
        {start ?? '—'} <span className="text-muted-foreground/60">→</span> {end ?? 'চলমান'}
      </dd>
    </div>
  );
}
