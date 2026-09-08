import { NextResponse } from 'next/server';
import { getAuthorizedUser } from '@/lib/guards';
import { contentDisposition, matrixToCsv } from '@/lib/csv';
import { loadReportDataset } from '@/lib/report-data';
import { isReportId, parseFunnelRange, reportFilename, REPORTS } from '@/lib/reports';

/**
 * CSV এক্সপোর্ট — PRD সেকশন ৫.৭ ("Export reports")।
 *
 *   GET /api/reports/payments?range=quarter
 *
 * Server action নয়, Route Handler — কারণ ফাইল ডাউনলোডের জন্য আসল
 * `Content-Disposition` হেডার দরকার, আর তাতে সাধারণ `<a download>` লিংকেই
 * কাজ চলে (কোনো ক্লায়েন্ট JS লাগে না, মোবাইল ব্রাউজারেও নির্ভরযোগ্য)।
 *
 * প্রতিটি রিপোর্টের নিজস্ব permission আছে (`lib/reports.ts` এর `REPORTS`),
 * তাই ACCOUNTS আর্থিক রিপোর্ট নামাতে পারে কিন্তু লিড ডেটা নয়।
 */
export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { report: string } },
): Promise<Response> {
  if (!isReportId(params.report)) {
    return NextResponse.json({ ok: false, message: 'অজানা রিপোর্ট' }, { status: 404 });
  }

  const definition = REPORTS[params.report];
  const user = await getAuthorizedUser(definition.permission);
  if (!user) {
    return NextResponse.json({ ok: false, message: 'অনুমতি নেই' }, { status: 403 });
  }

  const now = new Date();
  const range = parseFunnelRange(
    definition.timeScoped
      ? (new URL(request.url).searchParams.get('range') ?? undefined)
      : 'all',
  );

  try {
    const dataset = await loadReportDataset(params.report, range, now);
    const csv = matrixToCsv(
      dataset.columns.map((column) => column.header),
      dataset.rows,
    );

    return new Response(csv, {
      headers: {
        // charset=utf-8 + ফাইলের BOM — দুটো মিলে Excel এ বাংলা ঠিক দেখায়
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': contentDisposition(reportFilename(params.report, now)),
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error(`report export failed: ${params.report}`, error);
    return NextResponse.json({ ok: false, message: 'রিপোর্ট তৈরি করা যায়নি' }, { status: 500 });
  }
}
