import Link from 'next/link';
import Image from 'next/image';
import { notFound, redirect } from 'next/navigation';
import { format } from 'date-fns';
import { ArrowLeft } from 'lucide-react';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { can, homeForRole } from '@/lib/rbac';
import { BRAND } from '@/lib/brand';
import {
  amountInWords,
  INSTALLMENT_STATUS_LABEL,
  PAYMENT_METHOD_LABEL,
  computeInstallmentStatus,
} from '@/lib/payments';
import { paymentReceiptWhatsAppLink } from '@/lib/payment-data';
import { buildingTypeLabel } from '@/lib/leads';
import { formatBDT } from '@/lib/utils';
import { PrintButton } from '@/components/print-button';
import { WhatsAppSendButton } from '@/components/whatsapp';

export const metadata = { title: 'পেমেন্ট রসিদ' };

/**
 * PRD সেকশন ৫.৩ ও ৫.৪ — প্রিন্টযোগ্য / PDF পেমেন্ট রসিদ।
 *
 * Admin ও Accounts যেকোনো রসিদ দেখতে পারেন; Customer শুধু নিজের (নিচের
 * ownership যাচাই)। PDF আলাদা লাইব্রেরি দিয়ে বানানো হয়নি — ব্রাউজারের
 * "Print → Save as PDF" ব্যবহার হয়, কারণ jsPDF/pdf-lib এর বিল্ট-ইন ফন্টে বাংলা
 * গ্লিফ নেই (কাস্টমারের নাম ভেঙে যেত)। প্রিন্ট স্টাইল `globals.css` এ।
 */
export default async function ReceiptPage({ params }: { params: { paymentId: string } }) {
  const session = await auth();
  if (!session?.user) redirect(`/login?callbackUrl=/receipts/${params.paymentId}`);

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, active: true },
  });
  if (!user?.active) redirect('/login');

  // রসিদ দেখার অধিকার: Accounts/Admin এর `receipt:generate`, কাস্টমারের `receipt:download`
  if (!can(user.role, 'receipt:generate') && !can(user.role, 'receipt:download')) {
    redirect(homeForRole(user.role));
  }

  const payment = await prisma.payment.findUnique({
    where: { id: params.paymentId },
    select: {
      id: true,
      receiptNo: true,
      amountReceived: true,
      method: true,
      note: true,
      paidAt: true,
      whatsappSentAt: true,
      receivedBy: { select: { name: true } },
      installment: {
        select: {
          id: true,
          label: true,
          amount: true,
          dueDate: true,
          payments: { select: { amountReceived: true } },
          paymentPlan: {
            select: {
              installments: {
                select: { amount: true, payments: { select: { amountReceived: true } } },
              },
              project: {
                select: {
                  id: true,
                  title: true,
                  landLocation: true,
                  buildingType: true,
                  totalSqft: true,
                  totalContractValue: true,
                  customer: {
                    select: {
                      address: true,
                      userId: true,
                      user: { select: { name: true, phone: true, email: true } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!payment) notFound();

  const project = payment.installment.paymentPlan.project;

  // কাস্টমার শুধু নিজের রসিদ — অন্যের payment id গেস করেও দেখা যাবে না
  const isOwner = project.customer.userId === user.id;
  if (!can(user.role, 'receipt:generate') && !isOwner) notFound();

  const now = new Date();
  const amount = Number(payment.amountReceived);
  const installmentAmount = Number(payment.installment.amount);
  const installmentPaid = payment.installment.payments.reduce(
    (sum, p) => sum + Number(p.amountReceived),
    0,
  );
  const installmentStatus = computeInstallmentStatus(
    { amount: installmentAmount, dueDate: payment.installment.dueDate },
    installmentPaid,
    now,
  );

  // পুরো প্ল্যানের অবস্থা — রসিদের নিচে "আজ পর্যন্ত হিসাব"
  const planInstallments = payment.installment.paymentPlan.installments;
  const planTotal = planInstallments.reduce((sum, i) => sum + Number(i.amount), 0);
  const planCollected = planInstallments.reduce(
    (sum, i) => sum + i.payments.reduce((s, p) => s + Number(p.amountReceived), 0),
    0,
  );

  const backHref = can(user.role, 'receipt:generate')
    ? `/accounts/schedule/${project.id}`
    : '/customer/payments';

  // PRD সেকশন ৫.২ — রসিদটি ক্লায়েন্টকে WhatsApp এ পাঠানো (deep-link)। এটি
  // Accounts/Admin এর কাজ, তাই কাস্টমারের নিজের রসিদে বোতামটি আসে না
  const whatsAppUrl = can(user.role, 'receipt:generate')
    ? paymentReceiptWhatsAppLink({
        paymentId: payment.id,
        receiptNo: payment.receiptNo,
        clientName: project.customer.user.name,
        clientPhone: project.customer.user.phone,
        projectTitle: project.title,
        installmentLabel: payment.installment.label,
        amount,
        paidAt: payment.paidAt,
        remaining: Math.max(0, installmentAmount - installmentPaid),
      })
    : null;

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
        <div className="flex items-center gap-2">
          <WhatsAppSendButton
            url={whatsAppUrl}
            entity="payment"
            id={payment.id}
            label="WhatsApp এ পাঠান"
            size="default"
            variant="outline"
            sentLabel={payment.whatsappSentAt ? format(payment.whatsappSentAt, 'dd MMM yyyy') : null}
          />
          <PrintButton />
        </div>
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
            <p className="text-sm font-semibold uppercase tracking-wide">Money Receipt</p>
            <p className="text-xs text-muted-foreground">পেমেন্ট রসিদ</p>
            <p className="mt-1 font-mono text-sm font-semibold">{payment.receiptNo}</p>
            <p className="text-xs text-muted-foreground">
              {format(payment.paidAt, 'dd MMM yyyy')}
            </p>
          </div>
        </header>

        {/* ---------------------------------------------- কাস্টমার/প্রজেক্ট */}
        <section className="grid gap-4 border-b py-4 sm:grid-cols-2">
          <Block title="গ্রাহক (Received From)">
            <p className="font-medium">{project.customer.user.name}</p>
            {project.customer.user.phone ? <p>{project.customer.user.phone}</p> : null}
            <p className="text-muted-foreground">{project.customer.user.email}</p>
            {project.customer.address ? (
              <p className="text-muted-foreground">{project.customer.address}</p>
            ) : null}
          </Block>

          <Block title="প্রজেক্ট (Construction Job)">
            <p className="font-medium">{project.title}</p>
            {project.landLocation ? (
              <p className="text-muted-foreground">{project.landLocation}</p>
            ) : null}
            {buildingTypeLabel(project.buildingType) ? (
              <p className="text-muted-foreground">{buildingTypeLabel(project.buildingType)}</p>
            ) : null}
            {project.totalSqft ? (
              <p className="text-muted-foreground">{Number(project.totalSqft)} sqft</p>
            ) : null}
            <p className="text-muted-foreground">
              কন্ট্রাক্ট ভ্যালু {formatBDT(Number(project.totalContractValue))}
            </p>
          </Block>
        </section>

        {/* --------------------------------------------------- পেমেন্ট বিবরণ */}
        <section className="py-4">
          <table className="w-full text-sm">
            <tbody className="[&>tr>*]:py-1.5 [&>tr>th]:pr-4 [&>tr>th]:text-left [&>tr>th]:font-normal [&>tr>th]:text-muted-foreground">
              <tr>
                <th scope="row">কিস্তি (Installment)</th>
                <td className="font-medium">{payment.installment.label}</td>
              </tr>
              <tr>
                <th scope="row">কিস্তির শেষ তারিখ</th>
                <td className="tabular-nums">
                  {format(payment.installment.dueDate, 'dd MMM yyyy')}
                </td>
              </tr>
              <tr>
                <th scope="row">কিস্তির অঙ্ক</th>
                <td className="tabular-nums">{formatBDT(installmentAmount)}</td>
              </tr>
              <tr>
                <th scope="row">মাধ্যম (Method)</th>
                <td>
                  {PAYMENT_METHOD_LABEL[payment.method]}
                  {payment.note ? (
                    <span className="text-muted-foreground"> · {payment.note}</span>
                  ) : null}
                </td>
              </tr>
              <tr>
                <th scope="row">কিস্তির বর্তমান অবস্থা</th>
                <td>
                  {INSTALLMENT_STATUS_LABEL[installmentStatus]}
                  {installmentPaid < installmentAmount ? (
                    <span className="text-muted-foreground">
                      {' '}
                      · বাকি {formatBDT(installmentAmount - installmentPaid)}
                    </span>
                  ) : null}
                </td>
              </tr>
            </tbody>
          </table>

          <div className="print-keep-color mt-4 rounded-md border-2 border-foreground/80 p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-sm text-muted-foreground">প্রাপ্ত টাকা (Amount Received)</span>
              <span className="text-2xl font-bold tabular-nums">{formatBDT(amount)}</span>
            </div>
            <p className="mt-1 text-xs italic text-muted-foreground">{amountInWords(amount)}</p>
          </div>
        </section>

        {/* ------------------------------------------------- আজ পর্যন্ত হিসাব */}
        <section className="grid gap-2 border-y py-3 text-sm sm:grid-cols-3">
          <Figure label="প্ল্যানের মোট" value={formatBDT(planTotal)} />
          <Figure label="আজ পর্যন্ত আদায়" value={formatBDT(planCollected)} />
          <Figure label="অবশিষ্ট" value={formatBDT(Math.max(0, planTotal - planCollected))} />
        </section>

        {/* ------------------------------------------------------- স্বাক্ষর */}
        <footer className="mt-8 flex items-end justify-between gap-6 text-xs">
          <div className="min-w-0">
            <p className="text-muted-foreground">
              এটি কম্পিউটারে তৈরি রসিদ — গ্রহণকারী: {payment.receivedBy.name}
            </p>
            <p className="text-muted-foreground">
              তৈরি: {format(now, 'dd MMM yyyy, h:mm a')}
            </p>
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

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold tabular-nums">{value}</p>
    </div>
  );
}
