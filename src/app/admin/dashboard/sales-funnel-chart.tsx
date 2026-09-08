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
import { CHART_COLOR, CHART_TOOLTIP_STYLE, type FunnelReport } from '@/lib/reports';

/**
 * PRD সেকশন ৫.১ — Sales funnel (stage-wise lead count + conversion)।
 *
 * অনুভূমিক বার, কারণ স্টেজের নামগুলো লম্বা ("Sale Agreement Signed") — খাড়া
 * অক্ষে সেগুলো কাত করে লিখতে হতো, মোবাইলে যা পড়া যেত না।
 *
 * ডেটা আসে `lib/report-data.ts` → `loadSalesFunnel` থেকে (Prisma groupBy),
 * এখানে শুধু আঁকা হয়।
 */
export function SalesFunnelChart({ report }: { report: FunnelReport }) {
  if (report.total === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        এই সময়সীমায় কোনো লিড নেই
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart
        data={report.rows}
        layout="vertical"
        margin={{ top: 4, right: 44, bottom: 4, left: 4 }}
        barCategoryGap="18%"
      >
        <CartesianGrid horizontal={false} stroke={CHART_COLOR.grid} />
        <XAxis type="number" tick={{ fontSize: 11, fill: CHART_COLOR.axis }} allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="label"
          width={132}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: CHART_COLOR.axis }}
        />
        <Tooltip
          cursor={{ fill: 'hsl(var(--muted))', fillOpacity: 0.5 }}
          contentStyle={CHART_TOOLTIP_STYLE}
          formatter={(value: number, _name, item) => {
            const row = item?.payload as FunnelReport['rows'][number] | undefined;
            const conversion =
              row?.conversion === null || row?.conversion === undefined
                ? ''
                : ` · পরের ধাপে ${row.conversion}%`;
            return [`${value} টি লিড${conversion}`, row?.labelBn ?? ''];
          }}
        />
        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
          {report.rows.map((row) => (
            <Cell
              key={row.stage}
              // Won ধাপটি সবুজ — ফানেলের লক্ষ্য, বাকিগুলো ব্র্যান্ড রঙে
              fill={row.stage === 'WON' ? CHART_COLOR.emerald : CHART_COLOR.navy}
            />
          ))}
          <LabelList
            dataKey="count"
            position="right"
            className="fill-foreground"
            style={{ fontSize: 11 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
