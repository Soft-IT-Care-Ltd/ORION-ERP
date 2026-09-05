import Image from 'next/image';
import { Camera, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PhaseUpdateItem } from '@/lib/phases';

/**
 * ইঞ্জিনিয়ারের ফেজ আপডেটের ইতিহাস — PRD সেকশন ৫.২ (site photos + remarks) ও
 * ৫.৪ (কাস্টমারের "photo gallery")। Admin, Engineer ও Customer — তিন প্যানেলেই
 * টাইমলাইনের নিচে এই একই তালিকা বসে।
 */

export function PhaseUpdateLog({
  updates,
  className,
  emptyMessage = 'এখনো কোনো সাইট আপডেট দেওয়া হয়নি',
}: {
  updates: PhaseUpdateItem[];
  className?: string;
  emptyMessage?: string;
}) {
  if (updates.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <ol className={cn('space-y-3', className)}>
      {updates.map((update) => (
        <li key={update.id} className="rounded-md border p-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <p className="text-sm font-medium">{update.phaseName}</p>
            <p className="text-xs text-muted-foreground">
              {update.authorName} · {update.createdAtLabel}
            </p>
          </div>

          {update.percentComplete !== null ? (
            <p className="mt-1 text-xs text-muted-foreground">
              অগ্রগতি সেট করা হয়েছে{' '}
              <span className="font-semibold text-foreground tabular-nums">
                {update.percentComplete}%
              </span>
            </p>
          ) : null}

          {update.note ? (
            <p className="mt-2 flex gap-1.5 text-sm">
              <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="whitespace-pre-wrap">{update.note}</span>
            </p>
          ) : null}

          {update.photoUrls.length > 0 ? (
            <>
              <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                <Camera className="h-3.5 w-3.5" />
                {update.photoUrls.length} টি সাইট ফটো
              </p>
              <ul className="mt-1.5 grid grid-cols-3 gap-1.5 sm:grid-cols-4 md:grid-cols-6">
                {update.photoUrls.map((url) => (
                  <li key={url}>
                    {/* নতুন ট্যাবে খুললে পূর্ণ আকারে দেখা যায় (আলাদা lightbox ছাড়াই) */}
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="relative block aspect-square overflow-hidden rounded border bg-muted"
                    >
                      <Image
                        src={url}
                        alt={`${update.phaseName} — সাইট ফটো`}
                        fill
                        sizes="(min-width: 768px) 120px, 30vw"
                        className="object-cover transition-transform hover:scale-105"
                      />
                    </a>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
