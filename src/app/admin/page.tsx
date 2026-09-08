import Link from 'next/link';
import { Building2, CalendarClock, KanbanSquare, Users, Wallet } from 'lucide-react';
import { loadDashboardStats } from '@/lib/report-data';
import { parseFunnelRange } from '@/lib/reports';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DashboardCharts } from './dashboard';

export const metadata = { title: 'অ্যাডমিন ড্যাশবোর্ড' };

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: { funnel?: string };
}) {
  const stats = await loadDashboardStats(new Date());
  const funnelRange = parseFunnelRange(searchParams.funnel);

  const cards = [
    { label: 'সক্রিয় ইউজার', value: stats.activeUsers, icon: Users, href: '/admin/users' },
    { label: 'মোট লিড', value: stats.leads, icon: KanbanSquare, href: '/sales/pipeline' },
    { label: 'প্রজেক্ট', value: stats.projects, icon: Building2, href: '/admin/projects' },
    { label: 'ইউনিট', value: stats.units, icon: Wallet, href: '/admin/projects' },
    {
      label: 'ফলো-আপ পেরিয়েছে',
      value: stats.overdueFollowUps,
      icon: CalendarClock,
      href: '/sales/pipeline',
      // শূন্য না হলে সংখ্যাটা লাল — এগুলোতেই আজ হাত দিতে হবে (PRD সেকশন ৫.৬)
      alert: stats.overdueFollowUps > 0,
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">ড্যাশবোর্ড</h1>
        <p className="text-sm text-muted-foreground">সিস্টেমের সারসংক্ষেপ ও রিপোর্ট</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map(({ label, value, icon: Icon, href, alert }) => (
          <Link key={label} href={href}>
            <Card className="h-full transition-colors hover:bg-muted/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className={`text-2xl font-semibold ${alert ? 'text-destructive' : ''}`}>
                  {value}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* PRD সেকশন ৫.৭ — Sales funnel, project progress ও collected vs receivable */}
      <DashboardCharts funnelRange={funnelRange} />
    </div>
  );
}
