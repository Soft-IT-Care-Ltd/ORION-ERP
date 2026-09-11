'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Trash2 } from 'lucide-react';
import { LEDGER_TYPE_BADGE, LEDGER_TYPE_SHORT } from '@/lib/ledger';
import type { LedgerEntryView } from '@/lib/ledger-data';
import { cn } from '@/lib/utils';
import { WhatsAppSendButton } from '@/components/whatsapp';
import { deleteLedgerEntry } from './actions';

/**
 * লেজার এন্ট্রির তালিকা — PRD সেকশন ৫.২ ও ৫.৬।
 *
 * তিন জায়গায় একই টেবিল: লিড ডিটেইলের Client Ledger ট্যাব, প্রজেক্ট ডিটেইল ও
 * `/accounts/ledger`। কোম্পানি লেজারে কোন ক্লায়েন্টের এন্ট্রি সেটি দরকার, তাই
 * সেখানে `showLead` দিয়ে বাড়তি কলামটি আসে।
 *
 * রঙ: আয় সবুজ, খরচ অ্যাম্বার (`LEDGER_TYPE_BADGE`) — পেমেন্ট শিডিউলের রঙ-কোডের
 * সঙ্গে মিলিয়ে।
 *
 * লেআউট: মোবাইলে কার্ড, md থেকে টেবিল (CLAUDE.md নিয়ম ৩)।
 */
export function LedgerTable({
  entries,
  canManage,
  showLead = false,
  emptyMessage = 'এখনো কোনো এন্ট্রি নেই।',
}: {
  entries: LedgerEntryView[];
  /** ADMIN/ACCOUNTS — মুছতে পারে ও WhatsApp এ পাঠাতে পারে */
  canManage: boolean;
  /** কোম্পানি লেজারে ক্লায়েন্টের নাম দেখানো হয় */
  showLead?: boolean;
  emptyMessage?: string;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function remove(entry: LedgerEntryView) {
    setBusyId(entry.id);
    startTransition(async () => {
      const result = await deleteLedgerEntry({ id: entry.id });
      setBusyId(null);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      router.refresh();
    });
  }

  if (entries.length === 0) {
    return (
      <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div>
      {/* ---------------------------------------------------- মোবাইল কার্ড */}
      <ul className="space-y-2 md:hidden">
        {entries.map((entry) => (
          <li key={entry.id} className="space-y-2 rounded-lg border p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium">{entry.categoryLabel}</p>
                <p className="text-xs text-muted-foreground">
                  {entry.dateLabel} · {entry.createdByName}
                </p>
              </div>
              <div className="text-right">
                <TypeBadge entry={entry} />
                <p className="mt-1 font-semibold tabular-nums">{entry.amountLabel}</p>
              </div>
            </div>

            {showLead ? <LeadCell entry={entry} /> : null}
            {entry.note ? <p className="text-sm text-muted-foreground">{entry.note}</p> : null}

            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-xs text-muted-foreground">
                {entry.receiptNo ?? '—'}
              </span>
              <RowActions
                entry={entry}
                canManage={canManage}
                busy={busyId === entry.id}
                onRemove={remove}
              />
            </div>
          </li>
        ))}
      </ul>

      {/* ------------------------------------------------------ টেবিল (md+) */}
      <div className="hidden overflow-x-auto rounded-lg border md:block">
        <table className="w-full caption-bottom text-sm">
          <thead className="border-b bg-muted/50">
            <tr className="text-left [&>th]:px-3 [&>th]:py-2 [&>th]:font-medium">
              <th className="whitespace-nowrap">তারিখ</th>
              <th>ধরন</th>
              {showLead ? <th>ক্লায়েন্ট</th> : null}
              <th>ক্যাটেগরি</th>
              <th className="text-right">অঙ্ক</th>
              <th>রসিদ</th>
              <th className="w-px" />
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr
                key={entry.id}
                className="border-b align-top last:border-0 [&>td]:px-3 [&>td]:py-2"
              >
                <td className="whitespace-nowrap text-xs text-muted-foreground">
                  {entry.dateLabel}
                </td>
                <td>
                  <TypeBadge entry={entry} />
                </td>
                {showLead ? (
                  <td>
                    <LeadCell entry={entry} />
                  </td>
                ) : null}
                <td>
                  {entry.categoryLabel}
                  {entry.note ? (
                    <span className="block text-xs text-muted-foreground">{entry.note}</span>
                  ) : null}
                  <span className="block text-xs text-muted-foreground">{entry.createdByName}</span>
                </td>
                <td className="whitespace-nowrap text-right font-medium tabular-nums">
                  {entry.amountLabel}
                </td>
                <td className="whitespace-nowrap font-mono text-xs">
                  {entry.receiptNo ?? <span className="text-muted-foreground">—</span>}
                  {entry.whatsAppSentLabel ? (
                    <span className="block text-[11px] text-emerald-700 dark:text-emerald-400">
                      WhatsApp · {entry.whatsAppSentLabel}
                    </span>
                  ) : null}
                </td>
                <td>
                  <RowActions
                    entry={entry}
                    canManage={canManage}
                    busy={busyId === entry.id}
                    onRemove={remove}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TypeBadge({ entry }: { entry: LedgerEntryView }) {
  return (
    <span
      className={cn(
        'inline-block whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-medium',
        LEDGER_TYPE_BADGE[entry.type],
      )}
    >
      {LEDGER_TYPE_SHORT[entry.type]}
    </span>
  );
}

/** ক্লায়েন্ট-ট্যাগ করা এন্ট্রিতে লিডের নাম (লিংকসহ), নইলে "সাধারণ" */
function LeadCell({ entry }: { entry: LedgerEntryView }) {
  if (!entry.leadId) {
    return <span className="text-xs text-muted-foreground">কোম্পানির সাধারণ এন্ট্রি</span>;
  }

  return (
    <Link href={`/sales/leads/${entry.leadId}?tab=ledger`} className="text-sm hover:underline">
      {entry.leadName}
    </Link>
  );
}

function RowActions({
  entry,
  canManage,
  busy,
  onRemove,
}: {
  entry: LedgerEntryView;
  canManage: boolean;
  busy: boolean;
  onRemove: (entry: LedgerEntryView) => void;
}) {
  return (
    <div className="flex items-center justify-end gap-1">
      {canManage ? (
        <WhatsAppSendButton
          url={entry.whatsAppUrl}
          entity="ledger"
          id={entry.id}
          sentLabel={entry.whatsAppSentLabel}
        />
      ) : null}
      {canManage ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => onRemove(entry)}
          aria-label="এন্ট্রি মুছে ফেলুন"
          className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        </button>
      ) : null}
    </div>
  );
}
