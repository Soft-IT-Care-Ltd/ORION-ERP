import Link from 'next/link';
import { Building2, CalendarClock, KanbanSquare, Users, Wallet } from 'lucide-react';
import { loadDashboardStats } from '@/lib/report-data';
import { parseFunnelRange } from '@/lib/reports';
import { StatCard } from '@/components/stat-card';
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
      tone: 'text-destructive',
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">ড্যাশবোর্ড</h1>
        <p className="text-sm text-muted-foreground">সিস্টেমের সারসংক্ষেপ ও রিপোর্ট</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((card) => (
          <StatCard key={card.label} {...card} />
        ))}
      </div>

      {/* PRD সেকশন ৫.৭ — Sales funnel, project progress ও collected vs receivable */}
      <DashboardCharts funnelRange={funnelRange} />
    </div>
  );
}
