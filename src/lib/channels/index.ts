import { DeliveryStatus, NotificationChannel } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { BRAND } from '@/lib/brand';
import type { NotificationType } from '@/lib/notifications';
import {
  isDeliverableEmail,
  isDeliverablePhone,
  sendEmail,
  sendSms,
  trimForSms,
  type TransportResult,
} from './transport';

/**
 * নোটিফিকেশনের বাইরের চ্যানেল — PRD সেকশন ৫.৬।
 *
 * ইন-অ্যাপ নোটিফিকেশন লেখা হয় `lib/notifications.ts` এ; এখানে সেগুলোর কোনটা
 * ইমেইল/SMS এও যাবে তা ঠিক হয়, সারিতে (`NotificationDelivery`) ঢোকে, তারপর
 * `/api/cron/overdue` থেকে পাঠানো হয়। দুই ধাপে ভাগ করার কারণ:
 *
 *  - নোটিফিকেশন লেখার পথটা (server action) দ্রুত থাকে — কেউ পেমেন্ট এন্ট্রি
 *    করার সময় SMS গেটওয়ের জন্য অপেক্ষা করতে হয় না;
 *  - গেটওয়ে ডাউন থাকলে সারিতেই থেকে যায়, পরের রানে আবার চেষ্টা হয়;
 *  - কী পাঠানো হয়েছে/হয়নি তার হিসাব DB তেই থাকে (বিল মেলানো ও নালিশের জবাব)।
 */

/* ------------------------------------------------------------- policy */

/**
 * কোন ধরনের খবর কোন চ্যানেলে যাবে।
 *
 * SMS শুধু টাকার ব্যাপারে — PRD সেকশন ৫.৩: "due date এর 7 দিন আগে ও overdue
 * হলে SMS/Email"। বাকি সবকিছু ইমেইলে, কারণ বাংলা SMS ইউনিকোডে যায় (৭০ অক্ষর
 * প্রতি সেগমেন্ট) আর প্রতিটি সেগমেন্টে টাকা লাগে।
 */
export const CHANNEL_POLICY: Record<NotificationType, NotificationChannel[]> = {
  PAYMENT_DUE: [NotificationChannel.EMAIL, NotificationChannel.SMS],
  PAYMENT_OVERDUE: [NotificationChannel.EMAIL, NotificationChannel.SMS],
  FOLLOW_UP_DUE: [NotificationChannel.EMAIL],
  PHASE_MILESTONE: [NotificationChannel.EMAIL],
  DOCUMENT_UPLOADED: [NotificationChannel.EMAIL],
  LEAD_ASSIGNED: [NotificationChannel.EMAIL],
  SALE_DRAFT_CREATED: [NotificationChannel.EMAIL],
};

/** ইমেইলের সাবজেক্ট — টাইপভেদে, যাতে ইনবক্সেই বোঝা যায় */
const SUBJECT: Record<NotificationType, string> = {
  PAYMENT_DUE: 'কিস্তির রিমাইন্ডার',
  PAYMENT_OVERDUE: 'বকেয়া কিস্তি',
  FOLLOW_UP_DUE: 'ফলো-আপ বাকি আছে',
  PHASE_MILESTONE: 'নির্মাণ অগ্রগতির আপডেট',
  DOCUMENT_UPLOADED: 'নতুন ডকুমেন্ট',
  LEAD_ASSIGNED: 'নতুন লিড অ্যাসাইন',
  SALE_DRAFT_CREATED: 'নতুন সেল — পেমেন্ট প্ল্যান বাকি',
};

/** একটি ডেলিভারি এতবার ব্যর্থ হলে আর চেষ্টা করা হয় না */
const MAX_ATTEMPTS = 3;

/** এক রানে সর্বোচ্চ কতগুলো পাঠানো হবে — গেটওয়ের rate limit ও cron টাইমআউট ধরে */
const DISPATCH_BATCH = 50;

/* -------------------------------------------------------------- queue */

/**
 * নতুন নোটিফিকেশনগুলোর জন্য ডেলিভারি সারি তৈরি।
 *
 * `channelsQueuedAt` null মানেই এখনো ঢোকানো হয়নি — তাই কুয়েরিটা ঠিক নতুনগুলোই
 * পায়, পুরনো টেবিল বারবার স্ক্যান করতে হয় না। ইন-অ্যাপ নোটিফিকেশন লেখার সাথে
 * সাথেই এটি চলে না; cron এর রানে চলে (মেইল/SMS তাৎক্ষণিক হওয়ার দরকার নেই)।
 */
export async function queuePendingDeliveries(now = new Date()) {
  const pending = await prisma.notification.findMany({
    where: { channelsQueuedAt: null },
    select: { id: true, type: true },
    orderBy: { createdAt: 'asc' },
    take: 500,
  });
  if (pending.length === 0) return { queued: 0, notifications: 0 };

  const rows = pending.flatMap((notification) =>
    (CHANNEL_POLICY[notification.type as NotificationType] ?? []).map((channel) => ({
      notificationId: notification.id,
      channel,
    })),
  );

  const created =
    rows.length > 0
      ? await prisma.notificationDelivery.createMany({ data: rows, skipDuplicates: true })
      : { count: 0 };

  // চ্যানেল-নীতিতে কিছু না থাকলেও সময় বসিয়ে দেওয়া হয় — নইলে সারিটি প্রতি রানে
  // আবার দেখা হতো
  await prisma.notification.updateMany({
    where: { id: { in: pending.map((n) => n.id) } },
    data: { channelsQueuedAt: now },
  });

  return { queued: created.count, notifications: pending.length };
}

/* ----------------------------------------------------------- dispatch */

export type DispatchResult = {
  attempted: number;
  sent: number;
  failed: number;
  skipped: number;
};

/**
 * সারিতে অপেক্ষমাণ ডেলিভারিগুলো পাঠানো।
 *
 * ব্যর্থ হলে `attempts` বাড়ে আর স্ট্যাটাস `FAILED` থাকে — পরের রানে আবার নেওয়া
 * হয়, তবে `MAX_ATTEMPTS` বার পর আর নয় (গেটওয়ের ভুল কনফিগে অনন্ত লুপ ঠেকাতে)।
 * ঠিকানা/নম্বর না থাকলে বা চ্যানেল কনফিগার করা না থাকলে `SKIPPED` — সেটি আর
 * ফিরে আসে না, কারণ পরের রানেও অবস্থা একই থাকবে।
 */
export async function dispatchPendingDeliveries(now = new Date()): Promise<DispatchResult> {
  const rows = await prisma.notificationDelivery.findMany({
    where: {
      OR: [
        { status: DeliveryStatus.PENDING },
        { status: DeliveryStatus.FAILED, attempts: { lt: MAX_ATTEMPTS } },
      ],
    },
    orderBy: { createdAt: 'asc' },
    take: DISPATCH_BATCH,
    select: {
      id: true,
      channel: true,
      attempts: true,
      notification: {
        select: {
          type: true,
          message: true,
          link: true,
          user: { select: { name: true, email: true, phone: true, active: true } },
        },
      },
    },
  });

  const result: DispatchResult = { attempted: rows.length, sent: 0, failed: 0, skipped: 0 };

  for (const row of rows) {
    const { user, type, message, link } = row.notification;
    const outcome = !user.active
      ? ({ status: 'SKIPPED', reason: 'অ্যাকাউন্ট নিষ্ক্রিয়' } satisfies TransportResult)
      : await deliver(row.channel, { name: user.name, email: user.email, phone: user.phone }, {
          type: type as NotificationType,
          message,
          link,
        });

    const destination =
      row.channel === NotificationChannel.EMAIL ? user.email : (user.phone ?? null);

    await prisma.notificationDelivery.update({
      where: { id: row.id },
      data: {
        status: DeliveryStatus[outcome.status],
        attempts: row.attempts + 1,
        destination,
        providerRef: outcome.status === 'SENT' ? (outcome.providerRef ?? null) : null,
        error:
          outcome.status === 'FAILED'
            ? outcome.error
            : outcome.status === 'SKIPPED'
              ? outcome.reason
              : null,
        sentAt: outcome.status === 'SENT' ? now : null,
      },
    });

    if (outcome.status === 'SENT') result.sent += 1;
    else if (outcome.status === 'FAILED') result.failed += 1;
    else result.skipped += 1;
  }

  return result;
}

/** একটি চ্যানেলে একটি নোটিফিকেশন — বার্তা সাজিয়ে transport কে দেওয়া */
async function deliver(
  channel: NotificationChannel,
  user: { name: string; email: string; phone: string | null },
  notification: { type: NotificationType; message: string; link: string | null },
): Promise<TransportResult> {
  if (channel === NotificationChannel.EMAIL) {
    if (!isDeliverableEmail(user.email)) {
      return { status: 'SKIPPED', reason: 'ব্যবহারযোগ্য ইমেইল ঠিকানা নেই' };
    }
    return sendEmail({
      to: user.email,
      subject: `${BRAND.name} — ${SUBJECT[notification.type]}`,
      text: emailBody(user.name, notification),
    });
  }

  if (!isDeliverablePhone(user.phone)) {
    return { status: 'SKIPPED', reason: 'ব্যবহারযোগ্য ফোন নম্বর নেই' };
  }
  return sendSms({
    to: user.phone,
    message: trimForSms(`${BRAND.nameBn}: ${notification.message}`),
  });
}

/**
 * প্লেইন-টেক্সট ইমেইল। HTML টেমপ্লেট ইচ্ছে করেই নয় — খবরগুলো এক লাইনের, আর
 * প্লেইন টেক্সট প্রতিটি ক্লায়েন্টে একইভাবে পড়া যায় ও স্প্যাম স্কোর কম।
 */
function emailBody(
  name: string,
  notification: { message: string; link: string | null },
): string {
  const base = process.env.NEXTAUTH_URL?.replace(/\/$/, '') ?? '';
  const url = notification.link ? `${base}${notification.link}` : base;

  return [
    `${name},`,
    '',
    notification.message,
    '',
    url ? `বিস্তারিত: ${url}` : '',
    '',
    '—',
    `${BRAND.name} · ${BRAND.tagline}`,
    'এটি একটি স্বয়ংক্রিয় বার্তা।',
  ]
    .filter((line, index, all) => !(line === '' && all[index - 1] === ''))
    .join('\n');
}

export { isDeliverableEmail, isDeliverablePhone } from './transport';
