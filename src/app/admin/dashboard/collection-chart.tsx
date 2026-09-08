'use client';

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatBDT } from '@/lib/utils';
import {
  CHART_COLOR,
  CHART_TOOLTIP_STYLE,
  formatCompactBDT,
  type CollectionReport,
} from '@/lib/reports';

/**
 * PRD সেকশন ৫.৩ ও ৫.৭ — মাসভিত্তিক Collected vs Receivable।
 *
 * দুটি বার (মাসের due ও তার বিপরীতে আদায়) + একটি লাইন (আদায়ের হার %, ডান
 * অক্ষে)। লাইনটাই PRD এর KPI টেবিলের "৳38,00,000 (89%)" — টাকার অঙ্ক দুটির
 * পার্থক্য বড় হলেও শতাংশে প্রবণতা এক নজরে বোঝা যায়।
 *
 * ১২টি মাস মোবাইলের প্রস্থে ধরে না, তাই পাতা নয় — চার্টটিই আড়াআড়ি স্ক্রল হয়
 * (কনটেইনার `overflow-x-auto`, ভেতরে ন্যূনতম প্রস্থ)।
 */
export function CollectionChart({ report }: { report: CollectionReport }) {
  if (report.totalDue === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        এই সময়সীমায় কোনো কিস্তির তারিখ নেই
      </p>
    );
  }

  return (
    <div className="-mx-2 overflow-x-auto px-2">
      <div className="min-w-[560px]">
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={report.months} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
            <CartesianGrid vertical={false} stroke={CHART_COLOR.grid} />
            <XAxis
              dataKey="label"
              tickLine={false}
              tick={{ fontSize: 11, fill: CHART_COLOR.axis }}
            />
            <YAxis
              yAxisId="taka"
              width={62}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatCompactBDT}
              tick={{ fontSize: 11, fill: CHART_COLOR.axis }}
            />
            <YAxis
              yAxisId="rate"
              orientation="right"
              width={44}
              domain={[0, 100]}
              ticks={[0, 50, 100]}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value: number) => `${value}%`}
              tick={{ fontSize: 11, fill: CHART_COLOR.axis }}
            />
            <Tooltip
              cursor={{ fill: 'hsl(var(--muted))', fillOpacity: 0.5 }}
              contentStyle={CHART_TOOLTIP_STYLE}
              formatter={(value: number, name: string) =>
                name === 'আদায়ের হার' ? [`${value}%`, name] : [formatBDT(value), name]
              }
            />
            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
            <Bar
              yAxisId="taka"
              dataKey="due"
              name="মাসের পাওনা"
              fill={CHART_COLOR.navy}
              radius={[3, 3, 0, 0]}
            />
            <Bar
              yAxisId="taka"
              dataKey="collected"
              name="আদায়"
              fill={CHART_COLOR.gold}
              radius={[3, 3, 0, 0]}
            />
            <Line
              yAxisId="rate"
              type="monotone"
              dataKey="rate"
              name="আদায়ের হার"
              stroke={CHART_COLOR.emerald}
              strokeWidth={2}
              dot={{ r: 2.5 }}
              // যেসব মাসে কিছু due ছিল না সেখানে হার অনির্ধারিত — লাইনটি জোড়া লাগবে না
              connectNulls={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
