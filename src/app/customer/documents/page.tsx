import { redirect } from 'next/navigation';
import { FileText, Info, MapPin } from 'lucide-react';
import { auth } from '@/lib/auth';
import { loadCustomerDocuments } from '@/lib/customer-data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DocumentGroupList } from '@/components/documents';

export const metadata = { title: 'ডকুমেন্ট' };

/**
 * PRD সেকশন ৫.৪ — "ডকুমেন্ট (booking form, allotment letter, sale deed — download)"।
 *
 * ড্যাশবোর্ডের ডকুমেন্ট অংশটিরই পূর্ণ পাতা — একাধিক ইউনিট থাকলে প্রতিটির কাগজ
 * আলাদা কার্ডে। read-only: আপলোড/মুছে ফেলা কাস্টমারের হাতে নেই (PRD সেকশন ৪)।
 */
export default async function CustomerDocumentsPage() {
  const session = await auth();
  if (!session?.user) redirect('/login?callbackUrl=/customer/documents');

  const units = await loadCustomerDocuments(session.user.id, new Date());

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">ডকুমেন্ট</h1>
        <p className="text-sm text-muted-foreground">
          আপনার ইউনিটের কাগজপত্র ও পেমেন্ট রসিদ — টাইপ অনুযায়ী সাজানো
        </p>
      </div>

      {units.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <FileText className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium">এখনো কোনো ইউনিট যুক্ত হয়নি</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              বুকিং সম্পন্ন হলে আপনার ডকুমেন্টগুলো এখানে দেখা যাবে।
            </p>
          </CardContent>
        </Card>
      ) : (
        units.map(({ unit, documents }) => (
          <Card key={unit.saleId}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{unit.label}</CardTitle>
              <CardDescription className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                {unit.projectLocation} · বুকিং {unit.bookingDateLabel}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DocumentGroupList
                groups={documents}
                emptyMessage="এখনো কোনো ডকুমেন্ট যোগ করা হয়নি — কাগজপত্র প্রস্তুত হলে এখানে দেখা যাবে"
              />
            </CardContent>
          </Card>
        ))
      )}

      {units.length > 0 ? (
        <p className="flex items-start gap-2 rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          কোনো কাগজ খুঁজে না পেলে বা সংশোধন দরকার হলে অফিসে যোগাযোগ করুন — ডকুমেন্ট আপলোড করেন
          Orion Builders এর টিম।
        </p>
      ) : null}
    </div>
  );
}
