import { redirect } from 'next/navigation';
import { format } from 'date-fns';
import type { Prisma, Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getAuthorizedUser } from '@/lib/guards';
import { ROLES, ROLE_LABEL } from '@/lib/rbac';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { NewUserButton } from './new-user-button';
import { UsersFilter } from './users-filter';
import { UserRowActions } from './user-row-actions';

export const metadata = { title: 'ইউজার ম্যানেজমেন্ট' };

function isRole(value: string | undefined): value is Role {
  return Boolean(value) && (ROLES as readonly string[]).includes(value as string);
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams: { q?: string; role?: string };
}) {
  const admin = await getAuthorizedUser('user:manage');
  if (!admin) redirect('/');

  const q = searchParams.q?.trim() || undefined;
  const roleFilter = isRole(searchParams.role) ? searchParams.role : undefined;

  const where: Prisma.UserWhereInput = {
    ...(roleFilter ? { role: roleFilter } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
            { phone: { contains: q } },
          ],
        }
      : {}),
  };

  const [users, totalCount, activeCount] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        active: true,
        createdAt: true,
      },
      orderBy: [{ active: 'desc' }, { createdAt: 'desc' }],
      take: 100,
    }),
    prisma.user.count(),
    prisma.user.count({ where: { active: true } }),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">ইউজার ম্যানেজমেন্ট</h1>
          <p className="text-sm text-muted-foreground">
            মোট {totalCount} জন · সক্রিয় {activeCount} জন
          </p>
        </div>
        <NewUserButton />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="sr-only">ফিল্টার</CardTitle>
          <UsersFilter q={q} role={roleFilter} />
        </CardHeader>
        <CardContent className="px-0 sm:px-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[180px]">নাম</TableHead>
                  <TableHead className="hidden sm:table-cell">ফোন</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>স্ট্যাটাস</TableHead>
                  <TableHead className="hidden md:table-cell">যোগদান</TableHead>
                  <TableHead className="w-12 text-right">
                    <span className="sr-only">অপশন</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      কোনো ইউজার পাওয়া যায়নি
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
                    <TableRow key={user.id} className={user.active ? undefined : 'opacity-60'}>
                      <TableCell>
                        <p className="font-medium">
                          {user.name}
                          {user.id === admin.id ? (
                            <span className="ml-2 text-xs text-muted-foreground">(আপনি)</span>
                          ) : null}
                        </p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm">
                        {user.phone ?? '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="whitespace-nowrap">
                          {ROLE_LABEL[user.role]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={user.active ? 'default' : 'outline'}
                          className="whitespace-nowrap"
                        >
                          {user.active ? 'সক্রিয়' : 'নিষ্ক্রিয়'}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {format(user.createdAt, 'dd MMM yyyy')}
                      </TableCell>
                      <TableCell className="text-right">
                        <UserRowActions
                          user={{
                            id: user.id,
                            name: user.name,
                            email: user.email,
                            phone: user.phone,
                            role: user.role,
                          }}
                          active={user.active}
                          isSelf={user.id === admin.id}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
