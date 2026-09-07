import Link from 'next/link';
import { Download, FileText, FolderOpen, Receipt } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DOCUMENT_TYPE_BADGE, type DocumentGroup, type DocumentItem } from '@/lib/documents';

/**
 * PRD সেকশন ৫.৪ — কাস্টমারের ডকুমেন্ট তালিকা, টাইপ অনুযায়ী গ্রুপ করা
 * (বুকিং ফর্ম, সেল এগ্রিমেন্ট, অ্যালটমেন্ট লেটার, রসিদ …)।
 *
 * `PhaseTimeline` / `PaymentScheduleTable` এর মতোই server component ও read-only —
 * আপলোড/মুছে ফেলার সুযোগ নেই (PRD সেকশন ৪: কাস্টমার শুধু দেখবে ও ডাউনলোড করবে)।
 * গ্রুপিং ও ক্রম `lib/documents.ts` এ।
 */
export function DocumentGroupList({
  groups,
  emptyMessage = 'এখনো কোনো ডকুমেন্ট যোগ করা হয়নি',
  className,
}: {
  groups: DocumentGroup[];
  emptyMessage?: string;
  className?: string;
}) {
  if (groups.length === 0) {
    return (
      <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
        <FolderOpen className="mr-1.5 inline h-4 w-4" />
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {groups.map((group) => (
        <section key={group.type} className="space-y-2">
          <h3 className="flex flex-wrap items-center gap-2 text-sm font-medium">
            <span
              className={cn(
                'rounded px-2 py-0.5 text-xs font-semibold',
                DOCUMENT_TYPE_BADGE[group.type],
              )}
            >
              {group.label}
            </span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {group.items.length} টি
            </span>
          </h3>

          <ul className="divide-y rounded-md border">
            {group.items.map((item) => (
              <DocumentRow key={item.id} item={item} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function DocumentRow({ item }: { item: DocumentItem }) {
  // সিস্টেমে তৈরি রসিদ (`href`) আর আপলোড করা ফাইল (`fileUrl`) — দুটোর আইকন আলাদা
  const Icon = item.href ? Receipt : FileText;

  return (
    <li className="flex items-start gap-3 p-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />

      <div className="min-w-0 flex-1">
        {item.href ? (
          <Link href={item.href} className="block truncate text-sm font-medium hover:underline">
            {item.title}
          </Link>
        ) : item.fileUrl ? (
          <a
            href={item.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block truncate text-sm font-medium hover:underline"
          >
            {item.title}
          </a>
        ) : (
          <p className="truncate text-sm font-medium">{item.title}</p>
        )}

        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
          {item.badge ? (
            <span className="rounded bg-muted px-1.5 py-0.5 font-medium">{item.badge}</span>
          ) : null}
          {item.meta ? <span>{item.meta}</span> : null}
        </div>
      </div>

      {item.href ? (
        <Link
          href={item.href}
          aria-label={`${item.title} — রসিদ খুলুন`}
          className="shrink-0 rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Download className="h-4 w-4" />
        </Link>
      ) : item.fileUrl ? (
        <a
          href={item.fileUrl}
          download={item.downloadName ?? undefined}
          aria-label={`${item.title} ডাউনলোড`}
          className="shrink-0 rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Download className="h-4 w-4" />
        </a>
      ) : null}
    </li>
  );
}
