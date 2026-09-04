import type { Metadata, Viewport } from 'next';
import { Montserrat, Noto_Sans_Bengali, Open_Sans } from 'next/font/google';
import { Providers } from '@/components/providers';
import { Toaster } from '@/components/ui/sonner';
import { BRAND } from '@/lib/brand';
import { cn } from '@/lib/utils';
import './globals.css';

/**
 * ব্র্যান্ড টাইপোগ্রাফি — 05_BRAND_GUIDE.md
 * CSS variable হিসেবে এক্সপোজ করা হয়, ব্যবহার হয় globals.css + tailwind.config.ts এ।
 * সবগুলোই variable font, তাই `weight` না দিলে পুরো wght axis পাওয়া যায়।
 */
const montserrat = Montserrat({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-heading',
});

const openSans = Open_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-body',
});

const notoSansBengali = Noto_Sans_Bengali({
  subsets: ['bengali', 'latin'],
  display: 'swap',
  variable: '--font-bengali',
});

export const metadata: Metadata = {
  title: {
    default: 'Orion Builders CRM',
    template: '%s · Orion Builders CRM',
  },
  description: 'Orion Builders — লিড থেকে প্রজেক্ট ডেলিভারি পর্যন্ত CRM/ERP সিস্টেম',
  applicationName: 'Orion Builders CRM',
};

// Mobile-first: engineer/customer প্যানেল মূলত মোবাইল ব্রাউজারে চলবে
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: BRAND.colors.navy,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="bn"
      suppressHydrationWarning
      className={cn(montserrat.variable, openSans.variable, notoSansBengali.variable)}
    >
      <body className="min-h-screen bg-background font-sans antialiased">
        <Providers>{children}</Providers>
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
