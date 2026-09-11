import { redirect } from 'next/navigation';
import { CreditCard, Info, Receipt } from 'lucide-react';
import { auth } from '@/lib/auth';
import { loadCustomerPayments } from '@/lib/customer-data';
import { markOverdueInstallments } from '@/lib/payment-data';
import { formatBDT } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PaymentHistory, PaymentScheduleTable, PaymentSummary } from '@/components/payment-schedule';
// সরাসরি ফাইল থেকে — ব্যারেলে Admin/Accounts এর ফর্ম ও EXPENSE-সহ টেবিল আছে
import { PreProjectBills } from '@/components/ledger/pre-project-bills';

export const metadata = { title: 'পেমেন্ট' };

export const dynamic = 'force-dynamic';

/**
 * PRD সেকশন ৫.৭ — কাস্টমার নিজের payment schedule ও payment history দেখেন,
 * সঙ্গে প্রতিটি পেমেন্টের ডাউনলোডযোগ্য রসিদ — কনস্ট্রাকশন কিস্তি ও প্রি-প্রজেক্ট
 * সার্ভিস বিল, দুটোরই।
 *
 * `customer/progress/page.tsx` এর মতোই এখানে `PaymentScheduleTable` কে `actions`
 * ছাড়া ব্যবহার করা হয়েছে, তাই এটি সম্পূর্ণ read-only — কাস্টমার কিছু বদলাতে
 * পারেন না (PRD সেকশন ৪)। ডেটা ড্যাশবোর্ডের মতোই `lib/customer-data.ts` থেকে
 * আসে, যাতে স্কোপ (নিজের প্রজেক্ট) ও সার্ভিস বিলের ফিল্টার (`type=INCOME` +
 * `clientVisible=true`) এক জায়গাতেই ঠিক হয়।
 */
export default async function CustomerPaymentsPage() {
  const session = await auth();
  if (!session?.user) redirect('/login?callbackUrl=/customer/payments');

  const now = new Date();
  await markOverdueInstallments(now);

  const views = await loadCustomerPayments(session.user.id, now);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">পেমেন্ট</h1>
        <p className="text-sm text-muted-foreground">
          আপনার কিস্তির তালিকা, পরিশোধের ইতিহাস ও রসিদ
        </p>
      </div>

      {views.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <CreditCard className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium">এখনো কোনো প্রজেক্ট যুক্ত হয়নি</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              কন্ট্রাক্ট সাইন হলে আপনার পেমেন্ট শিডিউল এখানে দেখা যাবে।
            </p>
          </CardContent>
        </Card>
      ) : (
        views.map(({ project, plan, payments, preProjectBills }) => (
          <div key={project.projectId} className="space-y-3">
            <PaymentSummary
              summary={plan.summary}
              title={project.title}
              subtitle={[
                project.landLocation,
                project.startDateLabel ? `শুরু ${project.startDateLabel}` : null,
                formatBDT(project.totalContractValue),
              ]
                .filter(Boolean)
                .join(' · ')}
            />

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">কিস্তির তালিকা</CardTitle>
                <CardDescription>
                  প্রতিটি কিস্তির নিচে &quot;রসিদ&quot; খুলে পরিশোধের রসিদ প্রিন্ট বা PDF করা যাবে
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PaymentScheduleTable
                  installments={plan.installments}
                  emptyMessage="আপনার পেমেন্ট শিডিউল এখনো তৈরি হয়নি — অ্যাকাউন্টস টিম শীঘ্রই সেট করবে"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">পরিশোধের ইতিহাস</CardTitle>
                <CardDescription>
                  কবে কত টাকা জমা হয়েছে — প্রতিটির পাশে রসিদ ডাউনলোডের বোতাম
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PaymentHistory
                  payments={payments}
                  emptyMessage="এখনো কোনো পেমেন্ট জমা পড়েনি — প্রথম কিস্তি জমা হলে রসিদ এখানে দেখা যাবে"
                />
              </CardContent>
            </Card>

            {/* PRD সেকশন ৫.২ — কনস্ট্রাকশন শুরুর আগের সার্ভিস বিল, আলাদা সেকশনে */}
            {preProjectBills.length > 0 ? (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Receipt className="h-4 w-4 text-muted-foreground" />
                    প্রি-প্রজেক্ট সার্ভিস বিল
                  </CardTitle>
                  <CardDescription>
                    সাইট ভিজিট, সয়েল টেস্ট, ডিজাইন ও অনুমোদনের বিল — কিস্তির বাইরে
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <PreProjectBills bills={preProjectBills} />
                </CardContent>
              </Card>
            ) : null}
          </div>
        ))
      )}

      {views.some(({ plan }) => plan.summary.overdueCount > 0) ? (
        <p className="flex items-start gap-2 rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          বকেয়া কিস্তি নিয়ে কোনো প্রশ্ন থাকলে অ্যাকাউন্টস টিমের সঙ্গে যোগাযোগ করুন — এই পাতা থেকে
          সরাসরি পেমেন্ট নেওয়া হয় না।
        </p>
      ) : null}
    </div>
  );
}
