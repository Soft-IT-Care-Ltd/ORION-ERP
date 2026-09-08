'use client';

import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * ব্রাউজারের প্রিন্ট ডায়ালগ — সেখান থেকেই "Save as PDF" করা যায়।
 * প্রিন্ট CSS (`globals.css` এর `@media print`) বোতামটিসহ স্ক্রিন-only অংশ লুকায়।
 *
 * PDF আলাদা লাইব্রেরি দিয়ে বানানো হয় না — jsPDF/pdf-lib এর বিল্ট-ইন ফন্টে বাংলা
 * গ্লিফ নেই, তাই কাস্টমারের নাম ও লেবেলগুলো ভেঙে যেত। রসিদ ও রিপোর্ট, দুই
 * জায়গাতেই এই একই পথ।
 */
export function PrintButton({
  label = 'প্রিন্ট / PDF',
  size = 'sm',
}: {
  label?: string;
  size?: 'sm' | 'default';
}) {
  return (
    <Button onClick={() => window.print()} size={size}>
      <Printer className="mr-2 h-4 w-4" />
      {label}
    </Button>
  );
}
