import type { ReactNode } from 'react';
import { PanelShell } from '@/components/layout/panel-shell';

// লগইন করা ইউজারভেদে আলাদা কনটেন্ট — build এ prerender করার চেষ্টা করা যাবে না
export const dynamic = 'force-dynamic';

export default function Layout({ children }: { children: ReactNode }) {
  return <PanelShell basePath="/admin">{children}</PanelShell>;
}
