'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatBDT } from '@/lib/utils';
import { CHART_COLOR, CHART_TOOLTIP_STYLE, formatCompactBDT } from '@/lib/reports';
import type { LedgerMonth } from '@/lib/ledger-data';

/**
 * PRD সেকশন ৫.৬ — মাসিক Total Income vs Total Expense।
 *
 * `leadId` থাকুক বা না থাকুক, সব এন্ট্রি একসাথে (company-wide হিসাব)। Admin
 * ড্যাশবোর্ডের চার্টগুলোর মতোই মোবাইলে আড়াআড়ি স্ক্রল হয় — পাতা নয়, চার্টটিই।
 */
export function LedgerTrendChart({ months }: { months: LedgerMonth[] }) {
  const hasData = months.some((month) => month.income > 0 || month.expense > 0);

  if (!hasData) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        এই সময়সীমায় কোনো লেজার এন্ট্রি নেই
      </p>
    );
  }

  return (
    <div className="-mx-2 overflow-x-auto px-2">
      <div className="min-w-[420px]">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={months} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
            <CartesianGrid vertical={false} stroke={CHART_COLOR.grid} />
            <XAxis
              dataKey="label"
              tickLine={false}
              tick={{ fontSize: 11, fill: CHART_COLOR.axis }}
            />
            <YAxis
              width={62}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatCompactBDT}
              tick={{ fontSize: 11, fill: CHART_COLOR.axis }}
            />
            <Tooltip
              cursor={{ fill: 'hsl(var(--muted))', fillOpacity: 0.5 }}
              contentStyle={CHART_TOOLTIP_STYLE}
              formatter={(value: number, name: string) => [formatBDT(value), name]}
            />
            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
            <Bar dataKey="income" name="আয়" fill={CHART_COLOR.emerald} radius={[3, 3, 0, 0]} />
            <Bar dataKey="expense" name="খরচ" fill={CHART_COLOR.gold} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
