'use client';

import { signOut } from 'next-auth/react';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/** অ্যাকাউন্ট নিষ্ক্রিয়/মুছে ফেলা হলে দেখানো হয় */
export function AccountDisabled() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm text-center">
        <CardHeader className="space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-lg">অ্যাকাউন্ট নিষ্ক্রিয়</CardTitle>
            <CardDescription>
              আপনার অ্যাকাউন্টটি নিষ্ক্রিয় করা হয়েছে। অ্যাডমিনের সাথে যোগাযোগ করুন।
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Button className="w-full" onClick={() => signOut({ callbackUrl: '/login' })}>
            লগআউট
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
