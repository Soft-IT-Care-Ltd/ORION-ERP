'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { runOverdueSweep } from './actions';

/**
 * PRD সেকশন ৫.৩ — ওভারডিউ ডিটেকশন on-demand।
 * cron ছাড়াও অ্যাকাউন্টস যেকোনো সময় স্ট্যাটাসগুলো মিলিয়ে নিতে পারেন
 * (`/api/cron/overdue` একই কাজ সময়মতো করে)।
 */
export function OverdueSweepButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onClick() {
    setPending(true);
    const result = await runOverdueSweep();
    setPending(false);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(result.message);
    router.refresh();
  }

  return (
    <Button variant="outline" onClick={onClick} disabled={pending}>
      {pending ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <RefreshCw className="mr-2 h-4 w-4" />
      )}
      ওভারডিউ যাচাই
    </Button>
  );
}
