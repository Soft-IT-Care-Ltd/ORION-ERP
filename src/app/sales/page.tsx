import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata = { title: 'সেলস ড্যাশবোর্ড' };

export default function Page() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">সেলস ড্যাশবোর্ড</h1>
        <p className="text-sm text-muted-foreground">আপনার লিড ও ফলো-আপের সারসংক্ষেপ</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Phase 2 এ আসছে</CardTitle>
          <CardDescription>
            সাইডবারে <span className="font-medium">P2</span> চিহ্নিত মেনুগুলো ওই ফেজে চালু হবে —
            বিস্তারিত <code>02_BUILD_PLAN.md</code> এ।
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          এখন লগইন, role-based অ্যাক্সেস ও নেভিগেশন কাজ করছে।
        </CardContent>
      </Card>
    </div>
  );
}
