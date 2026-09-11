'use client';

import { useDroppable } from '@dnd-kit/core';
import type { LeadStage } from '@prisma/client';
import { cn } from '@/lib/utils';
import {
  CONDITIONAL_STAGE_HINT,
  isConditionalStage,
  STAGE_ACCENT,
  STAGE_LABEL,
} from '@/lib/leads';

export function PipelineColumn({
  stage,
  count,
  children,
}: {
  stage: LeadStage;
  count: number;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  // PRD সেকশন ৫.১ — ডিজিটাল সার্ভে ও সয়েল টেস্ট সব লিডে লাগে না; কলামটি থাকে,
  // কিন্তু ব্যাজ দেখিয়ে বোঝানো হয় যে ধাপটি skip করা যায়
  const conditional = isConditionalStage(stage);

  return (
    <section
      aria-label={`${STAGE_LABEL[stage]}${conditional ? ` (${CONDITIONAL_STAGE_HINT})` : ''} — ${count} টি লিড`}
      className="flex w-[272px] shrink-0 flex-col rounded-lg bg-muted/50 md:w-[264px]"
    >
      <header className="border-b px-3 py-2">
        <div className="flex items-center gap-2">
          <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', STAGE_ACCENT[stage])} />
          <h2 className="min-w-0 flex-1 truncate text-xs font-semibold uppercase tracking-wide">
            {STAGE_LABEL[stage]}
          </h2>
          <span className="shrink-0 rounded bg-background px-1.5 py-0.5 text-[11px] font-medium tabular-nums">
            {count}
          </span>
        </div>
        {conditional ? (
          <p className="mt-1 inline-flex items-center rounded-full border border-dashed border-muted-foreground/40 px-1.5 py-px text-[10px] font-medium text-muted-foreground">
            {CONDITIONAL_STAGE_HINT}
          </p>
        ) : null}
      </header>

      <div
        ref={setNodeRef}
        className={cn(
          'flex min-h-[120px] flex-1 flex-col gap-2 rounded-b-lg p-2 transition-colors',
          isOver && 'bg-primary/10 ring-2 ring-inset ring-primary/40',
        )}
      >
        {count === 0 ? (
          <p className="px-1 py-6 text-center text-xs text-muted-foreground">
            {isOver ? 'এখানে ছাড়ুন' : conditional ? 'প্রযোজ্য হলে এখানে আসবে' : 'কোনো লিড নেই'}
          </p>
        ) : (
          children
        )}
      </div>
    </section>
  );
}
