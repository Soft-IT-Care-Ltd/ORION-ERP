import type { ReactNode } from 'react';
import { PanelShell } from '@/components/layout/panel-shell';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <PanelShell basePath="/sales" title="সেলস / মার্কেটিং প্যানেল">
      {children}
    </PanelShell>
  );
}
