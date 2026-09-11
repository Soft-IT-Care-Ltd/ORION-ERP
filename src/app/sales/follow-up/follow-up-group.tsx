'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CalendarClock, MessageSquarePlus, Phone, User2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { LogFollowUpDialog } from './log-follow-up-dialog';

export type FollowUpLead = {
  id: string;
  name: string;
  /** পাঠযোগ্য রূপ — e.g. `+971 50 123 4567` */
  phone: string;
  /** `tel:` লিংকের জন্য */
  phoneE164: string;
  stageLabel: string;
  assignedToName: string | null;
  /** `yyyy-MM-dd` — মোডালের date ইনপুটে বসে */
  followUpDate: string;
  followUpLabel: string;
  lastNote: string | null;
  lastNoteLabel: string | null;
};

type Tone = 'overdue' | 'today' | 'upcoming';

const TONE_CLASS: Record<Tone, string> = {
  overdue: 'text-destructive',
  today: 'text-amber-600 dark:text-amber-500',
  upcoming: 'text-muted-foreground',
};

const TONE_ACCENT: Record<Tone, string> = {
  overdue: 'border-l-destructive',
  today: 'border-l-amber-500',
  upcoming: 'border-l-muted-foreground/30',
};

/**
 * ফলো-আপ তালিকার একটি গ্রুপ (বকেয়া / আজকে / আসছে) — PRD সেকশন ৫.১।
 *
 * খালি গ্রুপ রেন্ডার হয় না, যাতে "সব ঠিক আছে" অবস্থায় পাতাটি ফাঁকা কার্ডে
 * ভরে না যায়।
 */
export function FollowUpGroup({
  title,
  tone,
  leads,
  canLog,
  showAssignee,
}: {
  title: string;
  tone: Tone;
  leads: FollowUpLead[];
  canLog: boolean;
  showAssignee: boolean;
}) {
  const [active, setActive] = useState<FollowUpLead | null>(null);

  if (leads.length === 0) return null;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <span className={TONE_CLASS[tone]}>{title}</span>
            <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-normal tabular-nums text-muted-foreground">
              {leads.length}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {leads.map((lead) => (
            <div
              key={lead.id}
              className={cn('rounded-md border border-l-4 bg-card p-3', TONE_ACCENT[tone])}
            >
              <div className="flex items-start justify-between gap-2">
                <Link
                  href={`/sales/leads/${lead.id}`}
                  className="min-w-0 flex-1 text-sm font-semibold leading-tight hover:underline"
                >
                  {lead.name}
                </Link>
                <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {lead.stageLabel}
                </span>
              </div>

              <a
                href={`tel:${lead.phoneE164}`}
                className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <Phone className="h-3 w-3 shrink-0" />
                <span className="truncate">{lead.phone}</span>
              </a>

              <p
                className={cn(
                  'mt-1 flex items-center gap-1.5 text-xs font-medium',
                  TONE_CLASS[tone],
                )}
              >
                <CalendarClock className="h-3 w-3 shrink-0" />
                {lead.followUpLabel}
              </p>

              {showAssignee ? (
                <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <User2 className="h-3 w-3 shrink-0" />
                  <span className="truncate">{lead.assignedToName ?? 'অ্যাসাইন করা হয়নি'}</span>
                </p>
              ) : null}

              {lead.lastNote ? (
                <p className="mt-2 line-clamp-2 rounded bg-muted/60 px-2 py-1 text-xs text-muted-foreground">
                  {lead.lastNote}
                  {lead.lastNoteLabel ? (
                    <span className="ml-1 opacity-70">· {lead.lastNoteLabel}</span>
                  ) : null}
                </p>
              ) : null}

              {canLog ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="mt-2 w-full"
                  onClick={() => setActive(lead)}
                >
                  <MessageSquarePlus className="mr-1.5 h-3.5 w-3.5" />
                  ফলো-আপ লগ করুন
                </Button>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>

      <LogFollowUpDialog
        open={active !== null}
        onOpenChange={(open) => {
          if (!open) setActive(null);
        }}
        lead={active}
        onLogged={() => setActive(null)}
      />
    </>
  );
}
