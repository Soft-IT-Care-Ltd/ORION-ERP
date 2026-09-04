import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { homeForRole } from '@/lib/rbac';

export default async function RootPage() {
  const session = await auth();
  redirect(session?.user ? homeForRole(session.user.role) : '/login');
}
