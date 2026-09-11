import { redirect } from 'next/navigation';
import { ListChecks } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { getAuthorizedUser } from '@/lib/guards';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PhaseTemplateEditor } from './phase-template-editor';

export const metadata = { title: 'ফেজ টেমপ্লেট' };

export const dynamic = 'force-dynamic';

/**
 * গ্লোবাল ফেজ টেমপ্লেট — PRD সেকশন ৫.৪।
 *
 * v2 তে টেমপ্লেট একটিই (প্রজেক্ট-প্রতি নয়): Lead → Won কনভার্শনের সময় এখান থেকেই
 * প্রতিটি নতুন প্রজেক্টের ফেজগুলো কপি হয়।
 */
export default async function PhaseTemplatesPage() {
  const admin = await getAuthorizedUser('project:manage');
  if (!admin) redirect('/');

  const [templates, projectsWithoutPhases] = await Promise.all([
    prisma.phaseTemplate.findMany({
      select: { id: true, name: true, defaultDurationDays: true },
      orderBy: { order: 'asc' },
    }),
    prisma.project.count({ where: { phases: { none: {} } } }),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">ফেজ টেমপ্লেট</h1>
        <p className="text-sm text-muted-foreground">
          কনস্ট্রাকশন কাজের ধাপগুলোর গ্লোবাল তালিকা — নতুন প্রজেক্ট এখান থেকেই তার টাইমলাইন পায়
        </p>
      </div>

      <Card>
        <CardHeader className="p-4 pb-3 sm:p-6 sm:pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ListChecks className="h-4 w-4 text-muted-foreground" />
            ধাপের তালিকা
          </CardTitle>
          <CardDescription>
            PRD সেকশন ৫.৪ এর ডিফল্ট ধাপগুলো — নাম, ক্রম ও সময়কাল বদলানো যায়। লিড Won হয়ে
            প্রজেক্ট তৈরি হওয়ার মুহূর্তে এই তালিকা থেকেই ফেজগুলো কপি হয় (সব{' '}
            <span className="font-medium">আসন্ন</span> অবস্থায়); আগে তৈরি হওয়া প্রজেক্টের
            টাইমলাইন অপরিবর্তিত থাকে।
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 p-4 pt-0 sm:p-6 sm:pt-0">
          <PhaseTemplateEditor
            initial={templates.map((t) => ({
              name: t.name,
              defaultDurationDays: t.defaultDurationDays ? String(t.defaultDurationDays) : '',
            }))}
          />
          {projectsWithoutPhases > 0 ? (
            <p className="border-t pt-3 text-xs text-muted-foreground">
              {projectsWithoutPhases} টি প্রজেক্টে এখনো ফেজ টাইমলাইন নেই — সেই প্রজেক্টের পাতা
              থেকে &ldquo;টেমপ্লেট থেকে টাইমলাইন তৈরি&rdquo; চাপুন।
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
