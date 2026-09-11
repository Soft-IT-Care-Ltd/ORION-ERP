import { BRAND } from '@/lib/brand';

/**
 * `wa.me` deep-link তৈরি — PRD সেকশন ৫.২ ও ৫.৯।
 *
 * MVP তে রসিদ WhatsApp এ পাঠানো হয় deep-link দিয়ে: prefilled মেসেজসহ চ্যাট খোলে,
 * PDF টি ব্যবহারকারী ম্যানুয়ালি অ্যাটাচ করেন। পরের ফেজে 360dialog WhatsApp
 * Business API দিয়ে auto-send যোগ হবে — তখন শুধু এই ফাইলের পাঠানোর অংশটুকু
 * বদলাবে, কলিং কোড নয়।
 *
 * ফাইলটি ইচ্ছে করেই বিশুদ্ধ (কোনো Prisma/`node:` import নেই) — লেজার টেবিল ও
 * পেমেন্ট টেবিল দুটোই client component, লিংকটি server এ তৈরি হয়ে সেখানে যায়।
 */

/** `wa.me` শুধু অঙ্ক নেয় — `+`, স্পেস, ড্যাশ সব বাদ দিতে হয় */
export function whatsAppDigits(phone: string | null | undefined): string | null {
  const digits = (phone ?? '').replace(/\D/g, '');
  return digits.length >= 8 ? digits : null;
}

/** মেসেজের লাইনগুলো → wa.me লিংক; ফোন নম্বর কাজের মতো না হলে null */
function link(phone: string | null | undefined, lines: (string | null)[]): string | null {
  const digits = whatsAppDigits(phone);
  if (!digits) return null;

  const text = lines.filter((line) => line !== null).join('\n');
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

/**
 * Pre-project সার্ভিস বিলের রসিদ (LedgerEntry) — PRD সেকশন ৫.২।
 * লিড পর্যায়েই পাঠানো হয়, তাই এখানে প্রজেক্ট/কিস্তির কথা নেই।
 */
export function whatsAppReceiptLink(params: {
  phone: string | null | undefined;
  clientName: string;
  receiptNo: string;
  categoryLabel: string;
  amountLabel: string;
  dateLabel: string;
  companyName?: string;
}): string | null {
  const company = params.companyName ?? BRAND.name;

  return link(params.phone, [
    `আসসালামু আলাইকুম ${params.clientName},`,
    `${company} — পেমেন্ট রসিদ`,
    `রসিদ নম্বর: ${params.receiptNo}`,
    `সার্ভিস: ${params.categoryLabel}`,
    `পরিমাণ: ${params.amountLabel}`,
    `তারিখ: ${params.dateLabel}`,
    '',
    'ধন্যবাদ।',
  ]);
}

/**
 * কনস্ট্রাকশন কিস্তির পেমেন্ট রসিদ (Payment) — PRD সেকশন ৫.৫।
 *
 * রসিদের প্রিন্ট পেজের লিংকটিও মেসেজে যায় (`receiptUrl`) — কাস্টমার লগইন করে
 * নিজেই PDF নামাতে পারেন, তাতে অ্যাটাচমেন্ট ভুলে গেলেও রসিদ হাতছাড়া হয় না।
 */
export function whatsAppPaymentReceiptLink(params: {
  phone: string | null | undefined;
  clientName: string;
  receiptNo: string;
  installmentLabel: string;
  amountLabel: string;
  dateLabel: string;
  projectTitle?: string | null;
  remainingLabel?: string | null;
  receiptUrl?: string | null;
  companyName?: string;
}): string | null {
  const company = params.companyName ?? BRAND.name;

  return link(params.phone, [
    `আসসালামু আলাইকুম ${params.clientName},`,
    `${company} — পেমেন্ট রসিদ`,
    `রসিদ নম্বর: ${params.receiptNo}`,
    params.projectTitle ? `প্রজেক্ট: ${params.projectTitle}` : null,
    `কিস্তি: ${params.installmentLabel}`,
    `প্রাপ্ত: ${params.amountLabel}`,
    `তারিখ: ${params.dateLabel}`,
    params.remainingLabel ? `এই কিস্তিতে বাকি: ${params.remainingLabel}` : null,
    params.receiptUrl ? '' : null,
    params.receiptUrl ? `রসিদ: ${params.receiptUrl}` : null,
    '',
    'ধন্যবাদ।',
  ]);
}
