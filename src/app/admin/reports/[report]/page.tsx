import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { format } from 'date-fns';
import { ArrowLeft, Download } from 'lucide-react';
import { getAuthorizedUser } from '@/lib/guards';
import { BRAND } from '@/lib/brand';
import { formatBDT, cn } from '@/lib/utils';
import { loadReportDataset, funnelRangeStart } from '@/lib/report-data';
import {
  formatReportCell,
  isReportId,
  parseFunnelRange,
  REPORTS,
  FUNNEL_RANGE_LABEL,
} from '@/lib/reports';
import { Button } from '@/components/ui/button';
import { PrintButton } from '@/components/print-button';
import { RangeTabs } from '@/components/reports/range-tabs';

/**
 * একটি রিপোর্টের টেবিল-ভিউ — PRD সেকশন ৫.৭।
 *
 * পাতাটিই PDF: উপরের বোতামগুলো `print:hidden`, আর টেবিলটি `globals.css` এর
 * `@media print` নিয়মে A4 তে বসে। CSV এর জন্য একই ডেটা
 * `/api/reports/<id>` থেকে আসে — দুই জায়গায় একটিই লোডার
 * (`loadReportDataset`), তাই কাগজ আর স্প্রেডশিটের সংখ্যা কখনো আলাদা হয় না।
 */

/** পর্দায়/কাগজে এতগুলোর বেশি সারি দেখানো হয় না — পুরোটা CSV তে থাকে */
const MAX_ROWS = 500;

export async function generateMetadata({ params }: { params: { report: string } }) {
  return {
    title: isReportId(params.report) ? REPORTS[params.report].label : 'রিপোর্ট',
  };
}

export default async function ReportPage({
  params,
  searchParams,
}: {
  params: { report: string };
  searchParams: { range?: string };
}) {
  if (!isReportId(params.report)) notFound();

  const definition = REPORTS[params.report];
  // রুটটি এমনিতেই ADMIN-only (`lib/rbac.ts` এর ROUTE_ROLES), এটি দ্বিতীয় স্তরের
  // যাচাই — রিপোর্ট-ভেদে permission আলাদা। না থাকলে প্যানেল শেল নিজের রোলের
  // হোমে পাঠিয়ে দেবে
  const user = await getAuthorizedUser(definition.permission);
  if (!user) redirect('/admin');

  const now = new Date();
  const range = parseFunnelRange(definition.timeScoped ? searchParams.range : 'all');
  const rangeQuery = definition.timeScoped && range !== 'month' ? `?range=${range}` : '';

  const dataset = await loadReportDataset(params.report, range, now);
  const rows = dataset.rows.slice(0, MAX_ROWS);
  const rangeStart = funnelRangeStart(range, now);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/reports">
            <ArrowLeft className="mr-2 h-4 w-4" />
            সব রিপোর্ট
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          {definition.timeScoped ? (
            <RangeTabs
              basePath={`/admin/reports/${params.report}`}
              param="range"
              current={range}
            />
          ) : null}
          <Button asChild size="sm" variant="outline">
            <a href={`/api/reports/${params.report}${rangeQuery}`} download>
              <Download className="mr-2 h-4 w-4" />
              CSV
            </a>
          </Button>
          <PrintButton />
        </div>
      </div>

      <article className="print-sheet rounded-lg border bg-background p-4 shadow-sm sm:p-6">
        {/* কাগজের হেডার — প্রিন্ট করা পাতায় প্রতিষ্ঠান ও সময় বোঝা যেতে হবে */}
        <header className="mb-4 border-b pb-3">
          <p className="text-xs text-muted-foreground">
            {BRAND.name} · {BRAND.tagline}
          </p>
          <h1 className="mt-1 text-lg font-semibold">{definition.label}</h1>
          <p className="text-sm text-muted-foreground">{definition.description}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {definition.timeScoped
              ? `সময়সীমা: ${FUNNEL_RANGE_LABEL[range]}${
                  rangeStart ? ` (${format(rangeStart, 'dd MMM yyyy')} থেকে)` : ''
                } · `
              : ''}
            তৈরি: {format(now, 'dd MMM yyyy, h:mm a')} · {dataset.rows.length} টি সারি
          </p>
        </header>

        {rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            এই সময়সীমায় কোনো ডেটা নেই
          </p>
        ) : (
          /*
           * পর্দায় টেবিলটি নিজের ভেতরে আড়াআড়ি স্ক্রল করে (`min-w-max`), তাই
           * চওড়া রিপোর্টেও পাতা স্ক্রল করে না। কাগজে উল্টোটা দরকার — স্ক্রল
           * বলে কিছু নেই, তাই সেখানে `min-w-0` করে ঘরগুলোকে ভাঁজ হতে দেওয়া হয়,
           * নইলে ডান দিকের কলামগুলো (টাকার অঙ্ক!) কেটে যেত।
           */
          <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0 print:overflow-visible">
            <table className="w-full min-w-max border-collapse text-sm print:min-w-0 print:text-[9px]">
              <thead>
                <tr className="border-b text-left">
                  {dataset.columns.map((column) => (
                    <th
                      key={column.header}
                      scope="col"
                      className={cn(
                        'whitespace-nowrap px-2 py-2 font-medium text-muted-foreground print:whitespace-normal print:px-1',
                        column.kind && column.kind !== 'text' && 'text-right',
                      )}
                    >
                      {column.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={index} className="border-b last:border-b-0">
                    {row.map((cell, cellIndex) => {
                      const kind = dataset.columns[cellIndex]?.kind;
                      return (
                        <td
                          key={cellIndex}
                          className={cn(
                            'px-2 py-1.5 align-top print:px-1 print:py-1',
                            kind && kind !== 'text'
                              ? 'whitespace-nowrap text-right tabular-nums'
                              : 'max-w-[22rem] print:max-w-none',
                          )}
                        >
                          {formatReportCell(cell, kind, formatBDT)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {dataset.rows.length > rows.length ? (
          <p className="mt-3 text-xs text-muted-foreground">
            প্রথম {MAX_ROWS} টি সারি দেখানো হচ্ছে — পুরো {dataset.rows.length} টি সারি CSV
            ফাইলে আছে।
          </p>
        ) : null}
      </article>
    </div>
  );
}
