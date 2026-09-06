import { NextResponse } from 'next/server';
import { loadAgingReport, markOverdueInstallments } from '@/lib/payment-data';

/**
 * PRD সেকশন ৫.৩ — ওভারডিউ ডিটেকশন, সময়সূচি ধরে (cron)।
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
    const aging = await loadAgingReport(now);

    return NextResponse.json({
      ok: true,
      ranAt: now.toISOString(),
      sweep,
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
