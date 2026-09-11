import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import type { ExecutiveOption } from '../leads/lead-form-dialog';

/**
 * Admin এর জন্য এক্সিকিউটিভ সিলেক্টর — JS ছাড়াই কাজ করে (সাধারণ GET ফর্ম,
 * `pipeline-filter.tsx` এর মতোই)। অন্য role এ পাতাটি এটি রেন্ডারই করে না।
 */
export function ExecutiveFilter({
  executives,
  selected,
  label = 'এক্সিকিউটিভ ফিল্টার',
}: {
  executives: ExecutiveOption[];
  selected?: string;
  label?: string;
}) {
  return (
    <form method="GET" className="flex items-end gap-2">
      <NativeSelect
        name="executive"
        defaultValue={selected ?? ''}
        aria-label={label}
        className="w-48"
      >
        <option value="">সব এক্সিকিউটিভ</option>
        <option value="unassigned">— অ্যাসাইন করা হয়নি —</option>
        {executives.map((exec) => (
          <option key={exec.id} value={exec.id}>
            {exec.name}
            {exec.role === 'ADMIN' ? ' (অ্যাডমিন)' : ''}
          </option>
        ))}
      </NativeSelect>
      <Button type="submit" variant="secondary">
        দেখুন
      </Button>
    </form>
  );
}
