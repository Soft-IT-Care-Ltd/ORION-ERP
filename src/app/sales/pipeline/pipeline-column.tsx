'use client';

import { useDroppable } from '@dnd-kit/core';
import type { LeadStage } from '@prisma/client';
import { cn } from '@/lib/utils';
import { STAGE_ACCENT, STAGE_LABEL } from '@/lib/leads';

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

  return (
    <section
      aria-label={`${STAGE_LABEL[stage]} — ${count} টি লিড`}
      className="flex w-[272px] shrink-0 flex-col rounded-lg bg-muted/50 md:w-[264px]"
    >
      <header className="flex items-center gap-2 border-b px-3 py-2">
        <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', STAGE_ACCENT[stage])} />
        <h2 className="min-w-0 flex-1 truncate text-xs font-semibold uppercase tracking-wide">
          {STAGE_LABEL[stage]}
        </h2>
        <span className="shrink-0 rounded bg-background px-1.5 py-0.5 text-[11px] font-medium tabular-nums">
          {count}
        </span>
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
            {isOver ? 'এখানে ছাড়ুন' : 'কোনো লিড নেই'}
          </p>
        ) : (
          children
        )}
      </div>
    </section>
  );
}
