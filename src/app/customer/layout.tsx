import type { ReactNode } from 'react';
import { PanelShell } from '@/components/layout/panel-shell';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <PanelShell basePath="/customer" title="কাস্টমার পোর্টাল">
      {children}
    </PanelShell>
  );
}
