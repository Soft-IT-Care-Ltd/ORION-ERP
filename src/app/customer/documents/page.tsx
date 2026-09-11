import { redirect } from 'next/navigation';
import { FileText, Info, MapPin } from 'lucide-react';
import { auth } from '@/lib/auth';
import { loadCustomerDocuments } from '@/lib/customer-data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DocumentGroupList } from '@/components/documents';

export const metadata = { title: 'ডকুমেন্ট' };

export const dynamic = 'force-dynamic';

/**
 * PRD সেকশন ৫.৭ — "ডকুমেন্ট (প্রপোজাল, কন্ট্রাক্ট, গভঃ অনুমোদন কপি, রসিদ — download)"।
 *
 * ড্যাশবোর্ডের ডকুমেন্ট অংশটিরই পূর্ণ পাতা — একাধিক প্রজেক্ট থাকলে প্রতিটির কাগজ
 * আলাদা কার্ডে। read-only: আপলোড/মুছে ফেলা কাস্টমারের হাতে নেই (PRD সেকশন ৪)।
 */
export default async function CustomerDocumentsPage() {
  const session = await auth();
  if (!session?.user) redirect('/login?callbackUrl=/customer/documents');

  const projects = await loadCustomerDocuments(session.user.id, new Date());

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">ডকুমেন্ট</h1>
        <p className="text-sm text-muted-foreground">
          আপনার প্রজেক্টের কাগজপত্র ও পেমেন্ট রসিদ — টাইপ অনুযায়ী সাজানো
        </p>
      </div>

      {projects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <FileText className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium">এখনো কোনো প্রজেক্ট যুক্ত হয়নি</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              কন্ট্রাক্ট সাইন হলে আপনার ডকুমেন্টগুলো এখানে দেখা যাবে।
            </p>
          </CardContent>
        </Card>
      ) : (
        projects.map(({ project, documents }) => (
          <Card key={project.projectId}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{project.title}</CardTitle>
              <CardDescription className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                {project.landLocation ?? 'অবস্থান নির্ধারিত নয়'}
                {project.startDateLabel ? ` · শুরু ${project.startDateLabel}` : ''}
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

      {projects.length > 0 ? (
        <p className="flex items-start gap-2 rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          কোনো কাগজ খুঁজে না পেলে বা সংশোধন দরকার হলে অফিসে যোগাযোগ করুন — ডকুমেন্ট আপলোড করেন
          Orion Builders এর টিম।
        </p>
      ) : null}
    </div>
  );
}
