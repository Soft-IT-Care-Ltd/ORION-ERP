import { endOfMonth, format, startOfMonth, subMonths } from 'date-fns';

/**
 * লেজার ফিল্টারের মাস-তালিকা ও `?month=` প্যারামিটার পড়া।
 *
 * পেজ ও ফিল্টার — দুই জায়গাতেই লাগে, তাই আলাদা ফাইলে (ফিল্টারটি server
 * component, তাই এখানে কোনো `'use client'` নেই)।
 */

export type MonthOption = { value: string; label: string };

/** `all` — সব সময়ের এন্ট্রি (ফিল্টার বন্ধ) */
export const ALL_TIME = 'all';

/** ফিল্টারে কত মাস পেছন পর্যন্ত দেখানো হবে */
const MONTH_CHOICES = 12;

export function monthOptions(now: Date): MonthOption[] {
  return Array.from({ length: MONTH_CHOICES }, (_, index) => {
    const month = subMonths(now, index);
    return { value: format(month, 'yyyy-MM'), label: format(month, 'MMMM yyyy') };
  });
}

/**
 * `?month=2026-09` → ওই মাসের শুরু ও শেষ। `all` হলে কার্যত সীমাহীন রেঞ্জ;
 * ভুল/অনুপস্থিত মান হলে চলতি মাস।
 */
export function monthRange(
  value: string | undefined,
  now: Date,
): { from: Date; to: Date; label: string; value: string } {
  if (value === ALL_TIME) {
    return {
      from: new Date(2000, 0, 1),
      to: new Date(2100, 0, 1),
      label: 'সব সময়',
      value: ALL_TIME,
    };
  }

  const match = value && /^\d{4}-\d{2}$/.test(value) ? value : format(now, 'yyyy-MM');
  const [year, month] = match.split('-').map(Number);
  const start = startOfMonth(new Date(year, month - 1, 1));

  return {
    from: start,
    to: endOfMonth(start),
    label: format(start, 'MMMM yyyy'),
    value: match,
  };
}
