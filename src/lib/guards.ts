import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { can, type Permission } from '@/lib/rbac';

export type AuthorizedUser = {
  id: string;
  name: string;
  email: string;
  role: import('@prisma/client').Role;
};

/**
 * Server Action / Route Handler এর জন্য গার্ড।
 * JWT এর role stale হতে পারে, তাই সবসময় DB থেকে current role ও active status যাচাই।
 * অনুমতি না থাকলে null — কলার ইউজার-ফ্রেন্ডলি এরর রিটার্ন করবে।
 */
export async function getAuthorizedUser(permission: Permission): Promise<AuthorizedUser | null> {
  const session = await auth();
  if (!session?.user) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, role: true, active: true },
  });

  if (!user || !user.active || !can(user.role, permission)) return null;

  return { id: user.id, name: user.name, email: user.email, role: user.role };
}
