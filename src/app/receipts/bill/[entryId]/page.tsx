import Link from 'next/link';
import Image from 'next/image';
import { notFound, redirect } from 'next/navigation';
import { format } from 'date-fns';
import { ArrowLeft } from 'lucide-react';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { can, homeForRole } from '@/lib/rbac';
import { BRAND } from '@/lib/brand';
import { amountInWords } from '@/lib/payments';
import { loadServiceBillReceipt } from '@/lib/ledger-data';
import { formatBDT } from '@/lib/utils';
import { PrintButton } from '@/components/print-button';

export const metadata = { title: 'সার্ভিস বিলের রসিদ' };

export const dynamic = 'force-dynamic';

/**
 * PRD সেকশন ৫.২ ও ৫.৭ — প্রি-প্রজেক্ট সার্ভিস বিলের (সয়েল টেস্ট, ডিজাইন,
 * সরকারি অনুমোদন …) প্রিন্টযোগ্য / PDF রসিদ।
 *
 * কনস্ট্রাকশন কিস্তির রসিদের (`app/receipts/[paymentId]/page.tsx`) যমজ — একই
 * ব্র্যান্ড হেডার, একই প্রিন্ট স্টাইল, PDF ও একইভাবে ব্রাউজারের "Print → Save
 * as PDF" দিয়ে (কারণ PDF লাইব্রেরির বিল্ট-ইন ফন্টে বাংলা গ্লিফ নেই)। আলাদা
 * রুট, কারণ উৎস আলাদা: ওটা `Payment`, এটা `LedgerEntry`।
 *
 * **নিরাপত্তা:** কোন এন্ট্রি ছাপা যাবে সেই পুরো সিদ্ধান্তটাই DB কুয়েরিতে
 * (`loadServiceBillReceipt`) — `type=INCOME` + `clientVisible=true` + কাস্টমার
 * হলে নিজের প্রজেক্টের লিড। এখানে UI তে কিছু লুকানো হয় না; না পেলে 404।
 */
export default async function ServiceBillReceiptPage({
  params,
}: {
  params: { entryId: string };
}) {
  const session = await auth();
  if (!session?.user) redirect(`/login?callbackUrl=/receipts/bill/${params.entryId}`);

  // JWT এর role বাসি হতে পারে — রসিদের মতো পাতায় সবসময় DB থেকেই যাচাই
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, active: true },
  });
  if (!user?.active) redirect('/login');

  if (!can(user.role, 'receipt:generate') && !can(user.role, 'receipt:download')) {
    redirect(homeForRole(user.role));
  }

  const bill = await loadServiceBillReceipt(params.entryId, user);
  if (!bill) notFound();

  const now = new Date();
  const backHref = can(user.role, 'receipt:generate') ? '/accounts/ledger' : '/customer';

  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <div className="print-hide flex items-center justify-between gap-3">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          ফিরে যান
        </Link>
        <PrintButton />
      </div>

      <article className="print-sheet rounded-lg border bg-background p-6 shadow-sm sm:p-8">
        {/* ------------------------------------------------------- হেডার */}
        <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-4">
          <div className="flex items-center gap-3">
            <Image
              src={BRAND.logo.print}
              alt=""
              width={48}
              height={43}
              className="h-11 w-auto"
              unoptimized
            />
            <div>
              <p className="text-lg font-semibold">{BRAND.name}</p>
              <p className="text-xs text-muted-foreground">
                {BRAND.nameBn} · {BRAND.tagline}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold uppercase tracking-wide">Service Bill Receipt</p>
            <p className="text-xs text-muted-foreground">সার্ভিস বিলের রসিদ</p>
            <p className="mt-1 font-mono text-sm font-semibold">{bill.receiptNo}</p>
            <p className="text-xs text-muted-foreground">{format(bill.date, 'dd MMM yyyy')}</p>
          </div>
        </header>

        {/* ---------------------------------------------- ক্লায়েন্ট/প্রজেক্ট */}
        <section className="grid gap-4 border-b py-4 sm:grid-cols-2">
          <Block title="গ্রাহক (Received From)">
            <p className="font-medium">{bill.client.name}</p>
            {bill.client.phone ? <p>{bill.client.phone}</p> : null}
            {bill.client.email ? (
              <p className="text-muted-foreground">{bill.client.email}</p>
            ) : null}
            {bill.client.address ? (
              <p className="text-muted-foreground">{bill.client.address}</p>
            ) : null}
          </Block>

          <Block title="সার্ভিস (Service)">
            <p className="font-medium">{bill.categoryLabel}</p>
            {bill.project ? (
              <>
                <p className="text-muted-foreground">{bill.project.title}</p>
                {bill.project.landLocation ? (
                  <p className="text-muted-foreground">{bill.project.landLocation}</p>
                ) : null}
              </>
            ) : (
              <p className="text-muted-foreground">কনস্ট্রাকশন শুরুর আগের সার্ভিস</p>
            )}
          </Block>
        </section>

        {/* --------------------------------------------------- বিলের বিবরণ */}
        <section className="py-4">
          <table className="w-full text-sm">
            <tbody className="[&>tr>*]:py-1.5 [&>tr>th]:pr-4 [&>tr>th]:text-left [&>tr>th]:font-normal [&>tr>th]:text-muted-foreground">
              <tr>
                <th scope="row">সার্ভিসের ধরন</th>
                <td className="font-medium">{bill.categoryLabel}</td>
              </tr>
              <tr>
                <th scope="row">তারিখ</th>
                <td className="tabular-nums">{format(bill.date, 'dd MMM yyyy')}</td>
              </tr>
              {bill.note ? (
                <tr>
                  <th scope="row">বিবরণ</th>
                  <td>{bill.note}</td>
                </tr>
              ) : null}
            </tbody>
          </table>

          <div className="print-keep-color mt-4 rounded-md border-2 border-foreground/80 p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-sm text-muted-foreground">প্রাপ্ত টাকা (Amount Received)</span>
              <span className="text-2xl font-bold tabular-nums">{formatBDT(bill.amount)}</span>
            </div>
            <p className="mt-1 text-xs italic text-muted-foreground">
              {amountInWords(bill.amount)}
            </p>
          </div>
        </section>

        {/* ------------------------------------------------------- স্বাক্ষর */}
        <footer className="mt-8 flex items-end justify-between gap-6 border-t pt-4 text-xs">
          <div className="min-w-0">
            <p className="text-muted-foreground">
              এটি কম্পিউটারে তৈরি রসিদ — গ্রহণকারী: {bill.issuedByName}
            </p>
            <p className="text-muted-foreground">তৈরি: {format(now, 'dd MMM yyyy, h:mm a')}</p>
          </div>
          <div className="w-44 shrink-0 border-t pt-1 text-center">
            <p>Authorized Signature</p>
            <p className="text-muted-foreground">{BRAND.name}</p>
          </div>
        </footer>
      </article>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5 text-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}
