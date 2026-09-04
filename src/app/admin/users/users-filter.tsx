import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ROLES, ROLE_LABEL } from '@/lib/rbac';

/** JS ছাড়াই কাজ করে — সাধারণ GET ফর্ম, ফিল্টার searchParams এ যায় */
export function UsersFilter({ q, role }: { q?: string; role?: string }) {
  return (
    <form method="GET" className="flex flex-col gap-2 sm:flex-row">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          name="q"
          defaultValue={q ?? ''}
          placeholder="নাম, ইমেইল বা ফোন দিয়ে খুঁজুন"
          className="pl-9"
          aria-label="ইউজার খুঁজুন"
        />
      </div>
      <select
        name="role"
        defaultValue={role ?? ''}
        aria-label="Role ফিল্টার"
        className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 sm:w-52"
      >
        <option value="">সব role</option>
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {ROLE_LABEL[r]}
          </option>
        ))}
      </select>
      <Button type="submit" variant="secondary">
        ফিল্টার
      </Button>
    </form>
  );
}
