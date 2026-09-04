import { redirect } from 'next/navigation';
import type { LeadSource, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getAuthorizedUser } from '@/lib/guards';
import { can } from '@/lib/rbac';
import { findAssignableExecutives, leadScope } from '@/lib/lead-access';
import { LEAD_SOURCES } from '@/lib/leads';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { leadCardSelect, startOfToday, toPipelineLead } from '../leads/serialize';
import { NewLeadButton } from './new-lead-button';
import { PipelineBoard } from './pipeline-board';
import { PipelineFilter } from './pipeline-filter';

export const metadata = { title: 'সেলস পাইপলাইন' };

// লগইন করা ইউজারভেদে আলাদা ডেটা
export const dynamic = 'force-dynamic';

/** এক বোর্ডে সর্বোচ্চ কত লিড আনা হবে — এর বেশি হলে ফিল্টার ব্যবহার করতে বলা হয় */
const BOARD_LIMIT = 400;

function isSource(value: string | undefined): value is LeadSource {
  return Boolean(value) && (LEAD_SOURCES as string[]).includes(value as string);
}

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: { q?: string; source?: string; assignee?: string };
}) {
  const user = await getAuthorizedUser('lead:viewOwn');
  if (!user) redirect('/');

  const viewAll = can(user.role, 'lead:viewAll');
  const canEdit = can(user.role, 'lead:changeStage');

  const q = searchParams.q?.trim() || undefined;
  const source = isSource(searchParams.source) ? searchParams.source : undefined;
  const assignee = viewAll ? searchParams.assignee?.trim() || undefined : undefined;

  const where: Prisma.LeadWhereInput = {
    ...leadScope(user),
    ...(source ? { source } : {}),
    ...(assignee
      ? assignee === 'unassigned'
        ? { assignedToId: null }
        : { assignedToId: assignee }
      : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { phone: { contains: q } },
            { email: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [rows, totalInScope, executives, units] = await Promise.all([
    prisma.lead.findMany({
      where,
      select: leadCardSelect,
      // যেটির ফলো-আপ আগে, সেটি কলামের উপরে; তারিখহীনগুলো নিচে
      orderBy: [{ nextFollowUpAt: { sort: 'asc', nulls: 'last' } }, { updatedAt: 'desc' }],
      take: BOARD_LIMIT,
    }),
    prisma.lead.count({ where: leadScope(user) }),
    findAssignableExecutives(),
    prisma.unit.findMany({
      select: { id: true, unitNo: true, project: { select: { name: true } } },
      orderBy: [{ project: { name: 'asc' } }, { unitNo: 'asc' }],
      take: 200,
    }),
  ]);

  const today = startOfToday();
  const leads = rows.map((row) => toPipelineLead(row, today));
  const unitOptions = units.map((u) => ({ id: u.id, label: `${u.project.name} — ${u.unitNo}` }));
  const filtered = Boolean(q || source || assignee);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">সেলস পাইপলাইন</h1>
          <p className="text-sm text-muted-foreground">
            {viewAll ? 'সব লিড' : 'আপনার assigned লিড'} · {leads.length} টি দেখানো হচ্ছে
            {filtered ? ` (মোট ${totalInScope})` : ''}
          </p>
        </div>
        {can(user.role, 'lead:create') ? (
          <NewLeadButton executives={executives} units={unitOptions} canAssign={viewAll} />
        ) : null}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="sr-only">ফিল্টার</CardTitle>
          <PipelineFilter
            q={q}
            source={source}
            assignee={searchParams.assignee}
            executives={executives}
            showAssigneeFilter={viewAll}
          />
        </CardHeader>
        <CardContent className="px-3 sm:px-6">
          {leads.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {filtered
                ? 'এই ফিল্টারে কোনো লিড নেই।'
                : 'এখনো কোনো লিড নেই — "নতুন লিড" দিয়ে শুরু করুন।'}
            </p>
          ) : (
            <>
              <PipelineBoard
                leads={leads}
                canEdit={canEdit}
                canAssign={viewAll}
                executives={executives}
                units={unitOptions}
              />
              <p className="text-xs text-muted-foreground">
                কার্ডের বাঁ পাশের হ্যান্ডেল ধরে অন্য কলামে টেনে নিলে স্টেজ বদলাবে। মোবাইলে
                কার্ডের <span className="font-medium">⋮</span> মেনু থেকেও স্টেজ পরিবর্তন করা যায়।
                {rows.length === BOARD_LIMIT ? ' (সর্বোচ্চ ৪০০টি দেখানো হয় — বাকিগুলো ফিল্টার করে দেখুন)' : ''}
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
