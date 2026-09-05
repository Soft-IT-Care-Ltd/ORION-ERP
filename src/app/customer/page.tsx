import Link from 'next/link';
import { HardHat } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata = { title: 'আমার ইউনিট' };

export default function Page() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">আমার ইউনিট</h1>
        <p className="text-sm text-muted-foreground">আপনার ইউনিটের অগ্রগতি ও পেমেন্ট</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">নির্মাণ অগ্রগতি</CardTitle>
          <CardDescription>
            আপনার ইউনিটের ধাপভিত্তিক টাইমলাইন, শতকরা অগ্রগতি ও সাইট ফটো দেখুন।
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/customer/progress">
              <HardHat className="mr-2 h-4 w-4" />
              অগ্রগতি দেখুন
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Phase 5 এ আসছে</CardTitle>
          <CardDescription>
            সাইডবারে <span className="font-medium">P5</span> চিহ্নিত মেনুগুলো (পেমেন্ট, ডকুমেন্ট)
            ওই ফেজে চালু হবে — বিস্তারিত <code>02_BUILD_PLAN.md</code> এ।
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
