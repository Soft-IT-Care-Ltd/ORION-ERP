'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CHART_COLOR, CHART_TOOLTIP_STYLE, type ProjectProgressRow } from '@/lib/reports';

/**
 * PRD সেকশন ৫.৭ — Project-wise progress overview।
 *
 * প্রতিটি বার একটি প্রজেক্ট, দৈর্ঘ্য তার ইউনিটগুলোর গড় % complete
 * (`lib/report-data.ts` → `loadProjectProgress`)। অক্ষ ০–১০০ তে স্থির, তাই
 * প্রজেক্টগুলো একে অপরের সাথে তুলনীয় থাকে।
 *
 * বিলম্বিত ফেজ আছে এমন প্রজেক্টের বার লাল — অ্যাডমিনের চোখ আগে সেখানেই পড়া উচিত।
 */
export function ProjectProgressChart({ rows }: { rows: ProjectProgressRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        এখনো কোনো প্রজেক্টে ফেজ টাইমলাইন বসানো হয়নি
      </p>
    );
  }

  // বার প্রতি ~৩৪px — কম প্রজেক্টে চার্টটা অযথা লম্বা হবে না
  const height = Math.max(180, rows.length * 34 + 40);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={rows}
        layout="vertical"
        margin={{ top: 4, right: 48, bottom: 4, left: 4 }}
        barCategoryGap="22%"
      >
        <CartesianGrid horizontal={false} stroke={CHART_COLOR.grid} />
        <XAxis
          type="number"
          domain={[0, 100]}
          ticks={[0, 25, 50, 75, 100]}
          tickFormatter={(value: number) => `${value}%`}
          tick={{ fontSize: 11, fill: CHART_COLOR.axis }}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={124}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: CHART_COLOR.axis }}
          // লম্বা প্রজেক্টের নাম বারের জায়গা খেয়ে ফেলে — পুরো নাম টুলটিপে আছে
          tickFormatter={(value: string) => (value.length > 18 ? `${value.slice(0, 17)}…` : value)}
        />
        <Tooltip
          cursor={{ fill: 'hsl(var(--muted))', fillOpacity: 0.5 }}
          contentStyle={CHART_TOOLTIP_STYLE}
          formatter={(value: number, _name, item) => {
            const row = item?.payload as ProjectProgressRow | undefined;
            const delayed = row?.delayedPhases ? ` · ${row.delayedPhases} টি ফেজ বিলম্বিত` : '';
            return [
              `${value}% সম্পন্ন · ${row?.unitCount ?? 0} টি ইউনিট (${row?.doneUnits ?? 0} টি শেষ)${delayed}`,
              row?.name ?? '',
            ];
          }}
        />
        <Bar dataKey="progress" radius={[0, 4, 4, 0]}>
          {rows.map((row) => (
            <Cell
              key={row.projectId}
              fill={row.delayedPhases > 0 ? CHART_COLOR.alert : CHART_COLOR.sky}
            />
          ))}
          <LabelList
            dataKey="progress"
            position="right"
            className="fill-foreground"
            style={{ fontSize: 11 }}
            formatter={(value: number) => `${value}%`}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
