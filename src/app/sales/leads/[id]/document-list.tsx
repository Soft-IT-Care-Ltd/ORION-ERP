'use client';

import { useMemo, useState } from 'react';
import { Download, FileText, ImageIcon, Paperclip } from 'lucide-react';
import type { LeadFileType } from '@prisma/client';
import { cn } from '@/lib/utils';
import { FILE_TYPE_BADGE, FILE_TYPE_LABEL, LEAD_FILE_TYPES } from '@/lib/leads';

export type LeadDocumentItem = {
  id: string;
  fileUrl: string;
  fileName: string;
  fileType: LeadFileType;
  description: string | null;
  uploadedByName: string;
  /** server এ ফরম্যাট করা — client এ করলে TZ ভেদে hydration mismatch হতো */
  uploadedAtLabel: string;
};

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.heic'];

function isImage(fileName: string) {
  const lower = fileName.toLowerCase();
  return IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function DocumentList({ documents }: { documents: LeadDocumentItem[] }) {
  const [filter, setFilter] = useState<LeadFileType | 'ALL'>('ALL');

  const counts = useMemo(() => {
    const map = new Map<LeadFileType, number>();
    for (const doc of documents) map.set(doc.fileType, (map.get(doc.fileType) ?? 0) + 1);
    return map;
  }, [documents]);

  const visible = filter === 'ALL' ? documents : documents.filter((d) => d.fileType === filter);

  if (documents.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        এখনো কোনো ফাইল যোগ করা হয়নি।
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {/* টাইপ অনুযায়ী ফিল্টার — যে টাইপে ফাইল নেই সেটি দেখানোই হয় না */}
      <div className="flex flex-wrap gap-1.5">
        <FilterChip
          active={filter === 'ALL'}
          count={documents.length}
          label="সব"
          onClick={() => setFilter('ALL')}
        />
        {LEAD_FILE_TYPES.filter((type) => counts.has(type)).map((type) => (
          <FilterChip
            key={type}
            active={filter === type}
            count={counts.get(type) ?? 0}
            label={FILE_TYPE_LABEL[type]}
            onClick={() => setFilter(type)}
          />
        ))}
      </div>

      <ul className="divide-y rounded-md border">
        {visible.map((doc) => {
          const Icon = isImage(doc.fileName) ? ImageIcon : FileText;
          return (
            <li key={doc.id} className="flex items-start gap-3 p-3">
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />

              <div className="min-w-0 flex-1">
                <a
                  href={doc.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block truncate text-sm font-medium hover:underline"
                >
                  {doc.fileName}
                </a>

                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span
                    className={cn(
                      'rounded px-1.5 py-0.5 text-[10px] font-medium',
                      FILE_TYPE_BADGE[doc.fileType],
                    )}
                  >
                    {FILE_TYPE_LABEL[doc.fileType]}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {doc.uploadedByName} · {doc.uploadedAtLabel}
                  </span>
                </div>

                {doc.description ? (
                  <p className="mt-1 text-xs text-muted-foreground">{doc.description}</p>
                ) : null}
              </div>

              <a
                href={doc.fileUrl}
                download={doc.fileName}
                aria-label={`${doc.fileName} ডাউনলোড`}
                className="shrink-0 rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Download className="h-4 w-4" />
              </a>
            </li>
          );
        })}
      </ul>

      {visible.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          <Paperclip className="mr-1 inline h-3.5 w-3.5" />
          এই ধরনের কোনো ফাইল নেই।
        </p>
      ) : null}
    </div>
  );
}

function FilterChip({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-full border px-2.5 py-1 text-xs transition-colors',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-input hover:bg-muted',
      )}
    >
      {label}
      <span className={cn('ml-1.5 tabular-nums', active ? 'opacity-80' : 'text-muted-foreground')}>
        {count}
      </span>
    </button>
  );
}
