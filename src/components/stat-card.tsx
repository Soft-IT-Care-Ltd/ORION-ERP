import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * ড্যাশবোর্ডের KPI কার্ড — Admin, Sales ও Engineer তিন প্যানেলেই এটি।
 *
 * আলাদা আলাদা কপি ছিল, আর মোবাইলে (দুই কলামের গ্রিডে কার্ড ~১৭০px) লম্বা বাংলা
 * লেবেল আইকনের উপর উঠে যেত — "অ্যাসাইন করা প্রজেক্ট" এর মতো। তাই:
 *   • `gap-2` + আইকনে `shrink-0` — লেবেল আর আইকন কখনো একে অপরকে ছোঁয় না
 *   • লেবেল দু-লাইনে মুড়ে যায় (`leading-snug`), আইকন প্রথম লাইনের সঙ্গে বসে
 *   • মোবাইলে কম প্যাডিং (`p-4`), বড় স্ক্রিনে আগের মতোই (`sm:p-6`)
 */
export function StatCard({
  label,
  value,
  icon: Icon,
  tone,
  href,
}: {
  label: string;
  value: number | string;
  icon: LucideIcon;
  /**
   * সংখ্যাটি শূন্য না হলে সংখ্যা ও আইকনে বসানো রঙ (যেমন বকেয়ায় `text-destructive`)।
   * শূন্য হলে নিরপেক্ষ রঙ — "০টি বিলম্বিত ফেজ" লাল দেখানোর মানে হয় না।
   */
  tone?: string;
  /** দিলে পুরো কার্ডটি ক্লিকযোগ্য */
  href?: string;
}) {
  const active = Boolean(tone) && value !== 0 && value !== '0';

  const card = (
    <Card className={cn('h-full', href && 'transition-colors hover:bg-muted/50')}>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 p-4 pb-2 sm:p-6 sm:pb-2">
        <CardTitle className="text-xs font-medium leading-snug text-muted-foreground sm:text-sm">
          {label}
        </CardTitle>
        <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', active ? tone : 'text-muted-foreground')} />
      </CardHeader>
      <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
        <p className={cn('text-2xl font-semibold tabular-nums', active && tone)}>{value}</p>
      </CardContent>
    </Card>
  );

  return href ? (
    <Link href={href} className="block">
      {card}
    </Link>
  ) : (
    card
  );
}
