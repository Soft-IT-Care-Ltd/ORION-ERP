import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata = { title: 'সেলস / মার্কেটিং প্যানেল' };

export default function Page() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>সেলস / মার্কেটিং প্যানেল</CardTitle>
        <CardDescription>
          Phase 0 সম্পন্ন — auth ও role routing কাজ করছে।
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        এই প্যানেলের ফিচারগুলো Phase 2 এ যোগ হবে (দেখুন <code>02_BUILD_PLAN.md</code>)।
      </CardContent>
    </Card>
  );
}
