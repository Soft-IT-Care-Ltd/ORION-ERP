import { NextResponse } from 'next/server';
import { loadAgingReport, markOverdueInstallments } from '@/lib/payment-data';
import { runNotificationSweep } from '@/lib/notifications';
import { dispatchPendingDeliveries, queuePendingDeliveries } from '@/lib/channels';

/**
 * PRD সেকশন ৫.৩ ও ৫.৬ — দৈনিক sweep: ওভারডিউ ডিটেকশন + সময়-নির্ভর নোটিফিকেশন
 * + Email/SMS ডিসপ্যাচ।
 *
 * ক্রমটা জরুরি — আগে কিস্তির স্ট্যাটাস তাজা করা হয়, তারপর সেই অবস্থা ধরে
 * রিমাইন্ডার লেখা হয় (ফলো-আপ ওভারডিউ, due এর ৭ দিন আগে, বকেয়া, ফেজ সম্পন্ন),
 * সবশেষে সেগুলোর মধ্যে যেগুলো ইমেইল/SMS এও যাওয়ার কথা সেগুলো পাঠানো হয়।
 *
 * দিনে একবার চালানোই যথেষ্ট, কারণ "বকেয়া" তারিখ বদলালেই বদলায়:
 *
 *   0 1 * * *  curl -fsS -H "Authorization: Bearer $CRON_SECRET" \
 *                https://<app>/api/cron/overdue
 *
 * (Vercel এ `vercel.json` এর `crons` দিয়েও একই এন্ডপয়েন্ট চালানো যায়।)
 *
 * cron না চললেও UI ভুল দেখাবে না — অ্যাকাউন্টসের প্রতিটি পেজ লোডের সময় একই
 * sweep চলে, আর টেবিল যেভাবেই হোক আজকের তারিখ ধরে স্ট্যাটাস হিসাব করে
 * (`lib/payments.ts` → `computeInstallmentStatus`)। cron টা DB এর `status`
 * কলামকে তাজা রাখে, যাতে রিপোর্ট-কুয়েরিগুলো ইনডেক্স ব্যবহার করতে পারে।
 * নোটিফিকেশনেরও একই ফলব্যাক আছে — বেল লোডের সময় ঘণ্টায় একবার
 * (`lib/notifications.ts` → `sweepIfStale`)। দুটোই idempotent, তাই একই খবর
 * দুবার লেখা হয় না।
 *
 * তবে **Email/SMS এর কোনো ফলব্যাক নেই** — সেগুলো শুধু এখান থেকেই যায়। পেজ
 * রেন্ডারের সময় বাইরে বার্তা পাঠানো ঠিক নয় (লেটেন্সি, আর একটি পেজ খোলা কখনো
 * SMS পাঠানোর কারণ হওয়া উচিত নয়)। অর্থাৎ চ্যানেল চালু রাখতে cron আবশ্যক;
 * না চললে খবরগুলো সারিতে জমা থাকবে আর পরের রানে চলে যাবে।
 */

// প্রতিবার আসল DB দেখে — এই রুট কখনো ক্যাশ হবে না
export const dynamic = 'force-dynamic';

/**
 * `CRON_SECRET` সেট করা থাকলে বেয়ারার টোকেন লাগবে। সেট না থাকলে (লোকাল dev)
 * রুটটি খোলা — প্রোডাকশনে অবশ্যই সেট করুন, নইলে যে কেউ sweep চালাতে পারবে।
 */
function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== 'production';
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date();
    const sweep = await markOverdueInstallments(now);
    // স্ট্যাটাস তাজা হওয়ার পরেই রিমাইন্ডার — নইলে সদ্য বকেয়া কিস্তিগুলো বাদ পড়ত
    const notifications = await runNotificationSweep(now);

    // এই রানের নতুন নোটিফিকেশনগুলোসহ অপেক্ষমাণ সব ডেলিভারি (PRD সেকশন ৫.৬)।
    // পাঠানোটা আলাদা ধাপ — গেটওয়ে ডাউন থাকলে সারিতে থেকে যায়, উপরের কাজগুলো
    // ততক্ষণে হয়ে গেছে
    const queued = await queuePendingDeliveries(now);
    const dispatched = await dispatchPendingDeliveries(now);

    const aging = await loadAgingReport(now);

    return NextResponse.json({
      ok: true,
      ranAt: now.toISOString(),
      sweep,
      notifications,
      channels: { ...queued, ...dispatched },
      aging: {
        totalAmount: aging.totalAmount,
        totalCount: aging.totalCount,
        totalAccounts: aging.totalAccounts,
        buckets: aging.buckets,
      },
    });
  } catch (error) {
    console.error('overdue cron failed', error);
    return NextResponse.json({ ok: false, message: 'Sweep failed' }, { status: 500 });
  }
}

/** cron সার্ভিসগুলো প্রায়ই POST পাঠায় — একই কাজ */
export const POST = GET;
