import Link from 'next/link';
import { Building2, KanbanSquare, Users, Wallet } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata = { title: 'অ্যাডমিন ড্যাশবোর্ড' };

export default async function AdminDashboard() {
  const [activeUsers, leads, projects, units] = await Promise.all([
    prisma.user.count({ where: { active: true } }),
    prisma.lead.count(),
    prisma.project.count(),
    prisma.unit.count(),
  ]);

  const stats = [
    { label: 'সক্রিয় ইউজার', value: activeUsers, icon: Users, href: '/admin/users' },
    { label: 'মোট লিড', value: leads, icon: KanbanSquare },
    { label: 'প্রজেক্ট', value: projects, icon: Building2 },
    { label: 'ইউনিট', value: units, icon: Wallet },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">ড্যাশবোর্ড</h1>
        <p className="text-sm text-muted-foreground">সিস্টেমের সারসংক্ষেপ</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, href }) => {
          const card = (
            <Card className={href ? 'transition-colors hover:bg-muted/50' : undefined}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{value}</p>
              </CardContent>
            </Card>
          );
          return href ? (
            <Link key={label} href={href}>
              {card}
            </Link>
          ) : (
            <div key={label}>{card}</div>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">পরবর্তী ধাপ</CardTitle>
          <CardDescription>
            Phase 1 সম্পন্ন — role-wise navigation ও ইউজার ম্যানেজমেন্ট কাজ করছে।
            লিড, প্রজেক্ট ও পেমেন্ট মডিউল Phase 2–4 এ যোগ হবে (<code>02_BUILD_PLAN.md</code>)।
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
