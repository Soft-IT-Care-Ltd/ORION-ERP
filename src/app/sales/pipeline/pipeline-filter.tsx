import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { LEAD_SOURCES, SOURCE_LABEL } from '@/lib/leads';
import type { ExecutiveOption } from '../leads/lead-form-dialog';

/** JS ছাড়াই কাজ করে — সাধারণ GET ফর্ম, ফিল্টার searchParams এ যায় */
export function PipelineFilter({
  q,
  source,
  assignee,
  executives,
  showAssigneeFilter,
}: {
  q?: string;
  source?: string;
  assignee?: string;
  executives: ExecutiveOption[];
  showAssigneeFilter: boolean;
}) {
  return (
    <form method="GET" className="flex flex-col gap-2 sm:flex-row">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          name="q"
          defaultValue={q ?? ''}
          placeholder="নাম বা ফোন দিয়ে খুঁজুন"
          className="pl-9"
          aria-label="লিড খুঁজুন"
        />
      </div>

      <NativeSelect
        name="source"
        defaultValue={source ?? ''}
        aria-label="সোর্স ফিল্টার"
        className="sm:w-44"
      >
        <option value="">সব সোর্স</option>
        {LEAD_SOURCES.map((s) => (
          <option key={s} value={s}>
            {SOURCE_LABEL[s]}
          </option>
        ))}
      </NativeSelect>

      {showAssigneeFilter ? (
        <NativeSelect
          name="assignee"
          defaultValue={assignee ?? ''}
          aria-label="এক্সিকিউটিভ ফিল্টার"
          className="sm:w-48"
        >
          <option value="">সব এক্সিকিউটিভ</option>
          <option value="unassigned">— অ্যাসাইন করা হয়নি —</option>
          {executives.map((exec) => (
            <option key={exec.id} value={exec.id}>
              {exec.name}
            </option>
          ))}
        </NativeSelect>
      ) : null}

      <Button type="submit" variant="secondary">
        ফিল্টার
      </Button>
    </form>
  );
}
