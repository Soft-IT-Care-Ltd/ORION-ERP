import type { Metadata, Viewport } from 'next';
import { Providers } from '@/components/providers';
import { Toaster } from '@/components/ui/sonner';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Orion Builders CRM',
    template: '%s · Orion Builders CRM',
  },
  description: 'Orion Builders — লিড থেকে প্রজেক্ট ডেলিভারি পর্যন্ত CRM/ERP সিস্টেম',
};

// Mobile-first: engineer/customer প্যানেল মূলত মোবাইল ব্রাউজারে চলবে
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bn" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        <Providers>{children}</Providers>
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
