import { redirect } from 'next/navigation';
import { format } from 'date-fns';
import { CreditCard, Info } from 'lucide-react';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { loadSalePlan, markOverdueInstallments } from '@/lib/payment-data';
import { formatBDT } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PaymentScheduleTable, PaymentSummary } from '@/components/payment-schedule';

export const metadata = { title: 'পেমেন্ট' };

/**
 * PRD সেকশন ৫.৪ — কাস্টমার নিজের payment schedule ও payment history দেখেন,
 * সঙ্গে প্রতিটি পেমেন্টের ডাউনলোডযোগ্য রসিদ।
 *
 * `customer/progress/page.tsx` এর মতোই এখানে `PaymentScheduleTable` কে `actions`
 * ছাড়া ব্যবহার করা হয়েছে, তাই এটি সম্পূর্ণ read-only — কাস্টমার কিছু বদলাতে
 * পারেন না (PRD সেকশন ৪)।
 */
export default async function CustomerPaymentsPage() {
  const session = await auth();
  if (!session?.user) redirect('/login?callbackUrl=/customer/payments');

  const now = new Date();
  await markOverdueInstallments(now);

  const customer = await prisma.customer.findUnique({
    where: { userId: session.user.id },
    select: {
      sales: {
        select: {
          id: true,
          totalAmount: true,
          saleDate: true,
          unit: {
            select: {
              unitNo: true,
              sizeSqft: true,
              project: { select: { name: true, location: true } },
            },
          },
        },
        orderBy: { saleDate: 'desc' },
      },
    },
  });

  const sales = customer?.sales ?? [];
  const plans = await Promise.all(
    sales.map(async (sale) => ({ sale, plan: await loadSalePlan(sale.id, now) })),
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">পেমেন্ট</h1>
        <p className="text-sm text-muted-foreground">
          আপনার কিস্তির তালিকা, পরিশোধের ইতিহাস ও রসিদ
        </p>
      </div>

      {plans.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <CreditCard className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium">এখনো কোনো ইউনিট যুক্ত হয়নি</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              বুকিং সম্পন্ন হলে আপনার পেমেন্ট শিডিউল এখানে দেখা যাবে।
            </p>
          </CardContent>
        </Card>
      ) : (
        plans.map(({ sale, plan }) => (
          <div key={sale.id} className="space-y-3">
            <PaymentSummary
              summary={plan.summary}
              title={`${sale.unit.project.name} — ${sale.unit.unitNo}`}
              subtitle={`${sale.unit.project.location} · সেল ${format(sale.saleDate, 'dd MMM yyyy')} · ${formatBDT(Number(sale.totalAmount))}`}
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
          </div>
        ))
      )}

      {plans.some(({ plan }) => plan.summary.overdueCount > 0) ? (
        <p className="flex items-start gap-2 rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          বকেয়া কিস্তি নিয়ে কোনো প্রশ্ন থাকলে অ্যাকাউন্টস টিমের সঙ্গে যোগাযোগ করুন — এই পাতা থেকে
          সরাসরি পেমেন্ট নেওয়া হয় না।
        </p>
      ) : null}
    </div>
  );
}
