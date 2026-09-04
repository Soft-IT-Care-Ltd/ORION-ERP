import type { ReactNode } from 'react';
import { PanelShell } from '@/components/layout/panel-shell';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <PanelShell basePath="/accounts" title="অ্যাকাউন্টস প্যানেল">
      {children}
    </PanelShell>
  );
}
