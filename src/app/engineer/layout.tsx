import type { ReactNode } from 'react';
import { PanelShell } from '@/components/layout/panel-shell';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <PanelShell basePath="/engineer" title="সাইট ইঞ্জিনিয়ার প্যানেল">
      {children}
    </PanelShell>
  );
}
