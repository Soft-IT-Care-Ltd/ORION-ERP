import Link from 'next/link';
import { Download, FileSpreadsheet } from 'lucide-react';
import { can } from '@/lib/rbac';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  parseFunnelRange,
  REPORTS,
  REPORT_GROUP_LABEL,
  REPORT_IDS,
  type ReportGroup,
  type ReportId,
} from '@/lib/reports';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RangeTabs } from '@/components/reports/range-tabs';

export const metadata = { title: 'রিপোর্ট ও এক্সপোর্ট' };

/**
 * PRD সেকশন ৫.৭ — রিপোর্ট এক্সপোর্ট (CSV/PDF)।
 *
 * ড্যাশবোর্ডের চার্টগুলো "এক নজরে কেমন চলছে" দেখায়; এই পাতাটি সেই একই ডেটা
 * কাগজে/স্প্রেডশিটে নামানোর জন্য — বোর্ড মিটিং, ব্যাংক বা অডিটের কাগজপত্র।
 *
 * প্রতিটি রিপোর্টের নিজস্ব permission আছে, তাই তালিকায় শুধু সেগুলোই দেখা যায়
 * যেগুলো এই ইউজার আসলেই নামাতে পারবেন।
 */
export default async function ReportsPage({
  searchParams,
}: {
  searchParams: { range?: string };
}) {
  const session = await auth();
  const user = session?.user
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true },
      })
    : null;

  const range = parseFunnelRange(searchParams.range);
  const rangeQuery = range === 'month' ? '' : `?range=${range}`;

  const visible = REPORT_IDS.filter((id) => can(user?.role, REPORTS[id].permission));
  const groups = ['sales', 'projects', 'finance'] as const satisfies readonly ReportGroup[];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">রিপোর্ট ও এক্সপোর্ট</h1>
          <p className="text-sm text-muted-foreground">
            CSV নামিয়ে Excel এ কাজ করুন, বা রিপোর্ট খুলে প্রিন্ট/PDF করুন
          </p>
        </div>
        {/* সময়সীমাটি শুধু সময়-নির্ভর রিপোর্টগুলোতে প্রযোজ্য (কার্ডে চিহ্নিত) */}
        <RangeTabs basePath="/admin/reports" param="range" current={range} />
      </div>

      {groups.map((group) => {
        const ids = visible.filter((id) => REPORTS[id].group === group);
        if (ids.length === 0) return null;

        return (
          <section key={group} className="space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground">
              {REPORT_GROUP_LABEL[group]}
            </h2>
            <div className="grid gap-3 md:grid-cols-2">
              {ids.map((id) => (
                <ReportCard key={id} id={id} rangeQuery={rangeQuery} />
              ))}
            </div>
          </section>
        );
      })}

      {visible.length === 0 ? (
        <Card>
          <CardHeader>
            <CardDescription>আপনার রোলের জন্য কোনো রিপোর্ট নেই।</CardDescription>
          </CardHeader>
        </Card>
      ) : null}
    </div>
  );
}

function ReportCard({ id, rangeQuery }: { id: ReportId; rangeQuery: string }) {
  const report = REPORTS[id];
  // সময়-নির্ভর নয় এমন রিপোর্টে রেঞ্জ পাঠানো হয় না — লিংকটা বিভ্রান্তিকর হতো
  const query = report.timeScoped ? rangeQuery : '';

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="flex-1 space-y-1 pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">{report.label}</CardTitle>
          {report.timeScoped ? (
            <Badge variant="secondary" className="shrink-0 text-[10px]">
              সময়সীমা প্রযোজ্য
            </Badge>
          ) : null}
        </div>
        <CardDescription>{report.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2 pt-0">
        <Button asChild size="sm" variant="outline">
          <Link href={`/admin/reports/${id}${query}`}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            দেখুন / প্রিন্ট
          </Link>
        </Button>
        <Button asChild size="sm" variant="ghost">
          {/* Route Handler এর `Content-Disposition` ডাউনলোড করায় — তাই সাধারণ লিংক */}
          <a href={`/api/reports/${id}${query}`} download>
            <Download className="mr-2 h-4 w-4" />
            CSV
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}
