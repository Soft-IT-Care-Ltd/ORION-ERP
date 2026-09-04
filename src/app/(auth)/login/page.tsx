import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { OrionMark } from '@/components/brand/orion-logo';
import { auth } from '@/lib/auth';
import { BRAND } from '@/lib/brand';
import { homeForRole } from '@/lib/rbac';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'লগইন' };

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect(homeForRole(session.user.role));

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm">
        {/* ব্র্যান্ড হেডার — লোগো মার্ক + wordmark + ট্যাগলাইন */}
        <div className="mb-6 flex flex-col items-center text-center">
          <OrionMark size={64} priority className="w-14 sm:w-16" />
          <h1 className="mt-4 font-heading text-2xl font-bold tracking-tight sm:text-3xl">
            {BRAND.name}
          </h1>
          <span aria-hidden className="mt-2 h-0.5 w-10 rounded-full bg-orion-gold" />
          <p className="mt-2 font-heading text-sm font-light italic text-muted-foreground">
            {BRAND.tagline}
          </p>
          <p className="text-sm text-muted-foreground">{BRAND.taglineBn}</p>
        </div>

        <Card>
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-lg">Orion Builders CRM</CardTitle>
            <CardDescription>অ্যাকাউন্টে লগইন করুন</CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={null}>
              <LoginForm />
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
