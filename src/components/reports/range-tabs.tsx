import Link from 'next/link';
import { cn } from '@/lib/utils';
import { FUNNEL_RANGES, FUNNEL_RANGE_LABEL, type FunnelRange } from '@/lib/reports';

/**
 * সময়সীমার টগল — মাস / কোয়ার্টার / সব (PRD সেকশন ৫.১: "মাসিক/quarterly")।
 *
 * ক্লায়েন্ট state নয়, নিছক লিংক — সার্ভারেই নতুন করে কুয়েরি হয়, তাই ফলাফল
 * বুকমার্ক ও শেয়ার করা যায় এবং কোনো JS ছাড়াই কাজ করে।
 */
export function RangeTabs({
  basePath,
  param,
  current,
  label = 'সময়সীমা',
  extraParams,
}: {
  basePath: string;
  /** কোন searchParam এ রেঞ্জটি যাবে — ড্যাশবোর্ডে `funnel`, রিপোর্টে `range` */
  param: string;
  current: FunnelRange;
  label?: string;
  /**
   * পাতার অন্য ফিল্টারগুলো — রেঞ্জ বদলালেও যেন হারিয়ে না যায় (যেমন সেলস
   * পারফরম্যান্স পাতার `executive`)। খালি/undefined মান বাদ পড়ে।
   */
  extraParams?: Record<string, string | undefined>;
}) {
  const hrefFor = (range: FunnelRange) => {
    const query = new URLSearchParams();
    // ডিফল্ট রেঞ্জে প্যারামিটার বাদ — URL পরিষ্কার থাকে
    if (range !== 'month') query.set(param, range);
    for (const [key, value] of Object.entries(extraParams ?? {})) {
      if (value) query.set(key, value);
    }
    const search = query.toString();
    return search ? `${basePath}?${search}` : basePath;
  };

  return (
    <nav className="flex shrink-0 gap-1 rounded-md bg-muted p-1 print:hidden" aria-label={label}>
      {FUNNEL_RANGES.map((range) => (
        <Link
          key={range}
          href={hrefFor(range)}
          scroll={false}
          aria-current={range === current ? 'page' : undefined}
          className={cn(
            'rounded px-2.5 py-1 text-xs font-medium transition-colors',
            range === current
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {FUNNEL_RANGE_LABEL[range]}
        </Link>
      ))}
    </nav>
  );
}
