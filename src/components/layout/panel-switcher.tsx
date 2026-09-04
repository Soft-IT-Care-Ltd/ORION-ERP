'use client';

import Link from 'next/link';
import { ArrowLeftRight } from 'lucide-react';
import { PANELS } from '@/lib/nav';

/** ADMIN এর জন্য — অন্য প্যানেলে দ্রুত যাওয়ার লিংক */
export function PanelSwitcher({ currentBasePath }: { currentBasePath: string }) {
  const others = Object.values(PANELS).filter(
    (p) => p.basePath !== currentBasePath && p.basePath !== '/customer',
  );

  return (
    <div className="border-t pt-3">
      <p className="flex items-center gap-2 px-3 pb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <ArrowLeftRight className="h-3 w-3" />
        অন্য প্যানেল
      </p>
      <div className="flex flex-col gap-1">
        {others.map((p) => (
          <Link
            key={p.basePath}
            href={p.basePath}
            className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {p.title}
          </Link>
        ))}
      </div>
    </div>
  );
}
