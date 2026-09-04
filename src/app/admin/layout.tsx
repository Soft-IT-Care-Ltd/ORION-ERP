import type { ReactNode } from 'react';
import { PanelShell } from '@/components/layout/panel-shell';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <PanelShell basePath="/admin" title="অ্যাডমিন প্যানেল">
      {children}
    </PanelShell>
  );
}
