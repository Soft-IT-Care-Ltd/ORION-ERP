import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AlertTriangle, Building2, Camera, CreditCard, FileText, HardHat } from 'lucide-react';
import { auth } from '@/lib/auth';
import { loadCustomerPortal } from '@/lib/customer-data';
import { formatBDT } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PhaseTimeline } from '@/components/phase-timeline';
import { PaymentHistory, PaymentScheduleTable, PaymentSummary } from '@/components/payment-schedule';
import { DocumentGroupList } from '@/components/documents';
import { UnitSummaryCard } from './unit-summary-card';

export const metadata = { title: 'আমার ইউনিট' };

/**
 * PRD সেকশন ৫.৪ — কাস্টমার পোর্টালের ড্যাশবোর্ড।
 *
 * এক পাতায় নিজের ইউনিটের সবটুকু: সারাংশ কার্ড, নির্মাণ টাইমলাইন, পেমেন্ট
 * শিডিউল, পরিশোধের ইতিহাস (প্রতিটির রসিদসহ) ও ডকুমেন্ট। পুরোটাই **read-only** —
 * টাইমলাইন ও শিডিউল কম্পোনেন্টে `actions` পাঠানো হয়নি, তাই কাস্টমার কিছু
 * বদলাতে পারেন না (PRD সেকশন ৪)।
 *
 * ওভারডিউ sweep (`markOverdueInstallments`) ইচ্ছে করেই এখানে চালানো হয় না —
 * দেখানোর স্ট্যাটাস প্রতিবারই আজকের তারিখ ধরে হিসাব হয় (`toInstallmentView`),
 * তাই কাস্টমারের পাতা খোলার সময় পুরো টেবিলে লেখালেখির দরকার নেই; ওটা cron ও
 * অ্যাকাউন্টস প্যানেলের কাজ।
 */
export default async function CustomerDashboardPage() {
  const session = await auth();
  if (!session?.user) redirect('/login?callbackUrl=/customer');

  const now = new Date();
  const units = await loadCustomerPortal(session.user.id, now);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">আমার ইউনিট</h1>
        <p className="text-sm text-muted-foreground">
          আপনার প্রজেক্টের অগ্রগতি, পেমেন্ট ও ডকুমেন্ট — সবকিছু এক জায়গায়
        </p>
      </div>

      {units.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <Building2 className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium">এখনো কোনো ইউনিট যুক্ত হয়নি</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              বুকিং সম্পন্ন হলে আপনার ইউনিটের সারাংশ, নির্মাণ অগ্রগতি ও পেমেন্ট শিডিউল এখানে
              দেখা যাবে। কোনো প্রশ্ন থাকলে অফিসে যোগাযোগ করুন।
            </p>
          </CardContent>
        </Card>
      ) : (
        units.map(({ unit, timeline, plan, payments, documents }) => (
          <section key={unit.saleId} aria-label={unit.label} className="space-y-3">
            <UnitSummaryCard
              unit={unit}
              constructionPercent={timeline.summary.progress}
              collectedPercent={plan.summary.collectedPercent}
            />

            {/* মোবাইলে পাতাটি লম্বা — নিচের সেকশনগুলোতে দ্রুত যাওয়ার লিংক */}
            <nav aria-label="এই ইউনিটের সেকশন" className="flex flex-wrap gap-1.5">
              <JumpLink href={`#progress-${unit.saleId}`} icon={<HardHat className="h-3.5 w-3.5" />}>
                নির্মাণ অগ্রগতি
              </JumpLink>
              <JumpLink
                href={`#payments-${unit.saleId}`}
                icon={<CreditCard className="h-3.5 w-3.5" />}
              >
                পেমেন্ট
              </JumpLink>
              <JumpLink
                href={`#documents-${unit.saleId}`}
                icon={<FileText className="h-3.5 w-3.5" />}
              >
                ডকুমেন্ট
              </JumpLink>
            </nav>

            {/* ------------------------------------------- নির্মাণ অগ্রগতি */}
            <Card id={`progress-${unit.saleId}`} className="scroll-mt-20">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">নির্মাণ অগ্রগতি</CardTitle>
                <CardDescription>
                  {timeline.summary.current
                    ? `আপনার প্রজেক্ট ${timeline.summary.progress}% সম্পন্ন — বর্তমানে ${
                        timeline.summary.current.nameBn ?? timeline.summary.current.name
                      } চলছে`
                    : timeline.summary.total > 0
                      ? 'সব ফেজ সম্পন্ন হয়েছে'
                      : 'নির্মাণ টাইমলাইন শীঘ্রই যোগ করা হবে'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <PhaseTimeline
                  phases={timeline.phases}
                  emptyMessage="নির্মাণ টাইমলাইন এখনো তৈরি হয়নি — শীঘ্রই যোগ করা হবে"
                />
                <SectionLink href="/customer/progress" icon={<Camera className="h-3.5 w-3.5" />}>
                  সাইট ফটো ও ইঞ্জিনিয়ারের আপডেট দেখুন
                  {timeline.updates.length > 0 ? ` (${timeline.updates.length})` : null}
                </SectionLink>
              </CardContent>
            </Card>

            {/* ------------------------------------------ পেমেন্ট শিডিউল */}
            <div id={`payments-${unit.saleId}`} className="scroll-mt-20 space-y-3">
              <PaymentSummary
                summary={plan.summary}
                title="পেমেন্ট শিডিউল"
                subtitle={`${unit.label} · মোট মূল্য ${formatBDT(unit.totalAmount)}`}
              />

              {plan.summary.overdueCount > 0 ? (
                <p className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  <span>
                    <span className="font-medium text-destructive">
                      {plan.summary.overdueCount} টি কিস্তি বকেয়া —{' '}
                      {formatBDT(plan.summary.overdueAmount)}
                    </span>
                    <span className="block text-muted-foreground">
                      পরিশোধের জন্য অ্যাকাউন্টস টিমের সঙ্গে যোগাযোগ করুন; এই পাতা থেকে সরাসরি
                      পেমেন্ট নেওয়া হয় না।
                    </span>
                  </span>
                </p>
              ) : null}

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">কিস্তির তালিকা</CardTitle>
                  <CardDescription>
                    কোন কিস্তি পরিশোধিত, কোনটি বাকি বা বকেয়া — রঙ দেখে বোঝা যাবে
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <PaymentScheduleTable
                    installments={plan.installments}
                    // রসিদগুলো নিচের "পরিশোধের ইতিহাস" অংশে আছে — এখানে দুবার নয়
                    showReceipts={false}
                    emptyMessage="আপনার পেমেন্ট শিডিউল এখনো তৈরি হয়নি — অ্যাকাউন্টস টিম শীঘ্রই সেট করবে"
                  />
                </CardContent>
              </Card>

              {/* ------------------------------------- পরিশোধের ইতিহাস */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">পরিশোধের ইতিহাস</CardTitle>
                  <CardDescription>
                    প্রতিটি পেমেন্টের পাশের বোতাম থেকে রসিদ প্রিন্ট বা PDF করে রাখতে পারবেন
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <PaymentHistory
                    payments={payments}
                    emptyMessage="এখনো কোনো পেমেন্ট জমা পড়েনি — প্রথম কিস্তি জমা হলে রসিদ এখানে দেখা যাবে"
                  />
                </CardContent>
              </Card>
            </div>

            {/* ------------------------------------------------ ডকুমেন্ট */}
            <Card id={`documents-${unit.saleId}`} className="scroll-mt-20">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">ডকুমেন্ট</CardTitle>
                <CardDescription>
                  বুকিং ফর্ম, সেল এগ্রিমেন্ট, অ্যালটমেন্ট লেটার ও পেমেন্ট রসিদ — টাইপ অনুযায়ী
                  সাজানো
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <DocumentGroupList
                  groups={documents}
                  emptyMessage="এখনো কোনো ডকুমেন্ট যোগ করা হয়নি — কাগজপত্র প্রস্তুত হলে এখানে দেখা যাবে"
                />
                <SectionLink
                  href="/customer/documents"
                  icon={<FileText className="h-3.5 w-3.5" />}
                >
                  সব ডকুমেন্ট দেখুন
                </SectionLink>
              </CardContent>
            </Card>
          </section>
        ))
      )}
    </div>
  );
}

/** পাতার ভেতরের সেকশনে যাওয়ার চিপ — মোবাইলে লম্বা স্ক্রল কমায় */
function JumpLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors hover:bg-muted"
    >
      {icon}
      {children}
    </a>
  );
}

/** কার্ডের নিচে "বিস্তারিত" ধরনের লিংক */
function SectionLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:underline"
    >
      {icon}
      {children}
    </Link>
  );
}
