'use client';

import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * ব্রাউজারের প্রিন্ট ডায়ালগ — সেখান থেকেই "Save as PDF" করা যায়।
 * প্রিন্ট CSS (`globals.css` এর `@media print`) বোতামটিসহ স্ক্রিন-only অংশ লুকায়।
 */
export function PrintButton() {
  return (
    <Button onClick={() => window.print()} size="sm">
      <Printer className="mr-2 h-4 w-4" />
      প্রিন্ট / PDF
    </Button>
  );
}
