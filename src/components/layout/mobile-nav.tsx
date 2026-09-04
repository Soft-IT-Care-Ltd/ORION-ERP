'use client';

import { useState } from 'react';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { NavLinks } from './nav-links';
import { PanelSwitcher } from './panel-switcher';

/** মোবাইলে sidebar → drawer (site engineer/customer মূলত মোবাইল ব্যবহারকারী) */
export function MobileNav({
  basePath,
  title,
  showSwitcher,
}: {
  basePath: string;
  title: string;
  showSwitcher: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label="মেনু খুলুন">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0">
        <SheetHeader className="border-b px-4 py-4 text-left">
          <SheetTitle className="text-base">{title}</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-3 p-3">
          <NavLinks basePath={basePath} onNavigate={() => setOpen(false)} />
          {showSwitcher ? <PanelSwitcher currentBasePath={basePath} /> : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
