/**
 * Email/SMS পাঠানোর transport — PRD সেকশন ৫.৬ (In-app + Email + SMS)।
 *
 * কোনো SDK যোগ করা হয়নি, শুধু `fetch` — প্রোভাইডাররা সবাই সাধারণ HTTP API দেয়,
 * আর নির্ভরতা কম রাখলে ভবিষ্যতে গেটওয়ে বদলানো সহজ (বাংলাদেশে SMS গেটওয়ে
 * বদলানো খুবই স্বাভাবিক ঘটনা)।
 *
 * env সেট করা না থাকলে কিছুই পাঠানো হয় না — dev এ কনসোলে ছাপা হয় আর ডেলিভারি
 * `SKIPPED` লেখা থাকে। অর্থাৎ কনফিগার না করেও পুরো পাইপলাইন চালু থাকে ও
 * পরীক্ষা করা যায়।
 */

export type TransportResult =
  | { status: 'SENT'; providerRef?: string }
  | { status: 'SKIPPED'; reason: string }
  | { status: 'FAILED'; error: string };

/** প্রোভাইডারের উত্তর লগে/DB তে রাখার জন্য ছোট করে */
function clip(value: string, max = 300): string {
  const text = value.replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/**
 * অটো-তৈরি কাস্টমার অ্যাকাউন্টের ইমেইল `…@orion.invalid` হয় (লিড "Won" হলে
 * অ্যাকাউন্ট বানানো হয়, তখন আসল ঠিকানা না-ও থাকতে পারে)। `.invalid` RFC 2606
 * অনুযায়ী সংরক্ষিত — সেখানে পাঠানোর চেষ্টা করলে শুধু bounce বাড়ত।
 */
export function isDeliverableEmail(email: string | null | undefined): email is string {
  if (!email) return false;
  const at = email.lastIndexOf('@');
  if (at < 1 || at === email.length - 1) return false;
  const domain = email.slice(at + 1).toLowerCase();
  return !domain.endsWith('.invalid') && !domain.endsWith('.local') && domain.includes('.');
}

/** DB তে নম্বর সবসময় E.164 (`lib/phone.ts`) — গেটওয়েতে সেটিই যায় */
export function isDeliverablePhone(phone: string | null | undefined): phone is string {
  return !!phone && /^\+[1-9]\d{7,14}$/.test(phone);
}

/* -------------------------------------------------------------- email */

/**
 * Resend এর HTTP API (`RESEND_API_KEY` + `EMAIL_FROM`)।
 *
 * অন্য প্রোভাইডারে যেতে হলে শুধু এই ফাংশনটাই বদলাতে হবে — কলিং কোড
 * `TransportResult` ছাড়া আর কিছু জানে না।
 */
export async function sendEmail(params: {
  to: string;
  subject: string;
  text: string;
}): Promise<TransportResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    if (process.env.NODE_ENV !== 'production') {
      console.info(`[email:dev] → ${params.to} · ${params.subject}\n${params.text}`);
    }
    return { status: 'SKIPPED', reason: 'RESEND_API_KEY / EMAIL_FROM সেট করা নেই' };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [params.to],
        subject: params.subject,
        text: params.text,
      }),
    });

    const body = await response.text();
    if (!response.ok) return { status: 'FAILED', error: clip(`HTTP ${response.status} — ${body}`) };

    // উত্তরটা JSON না হলেও পাঠানো সফল ধরা হয় — id টা শুধু হিসাব মেলানোর জন্য
    let providerRef: string | undefined;
    try {
      const parsed = JSON.parse(body) as { id?: string };
      providerRef = parsed.id;
    } catch {
      providerRef = undefined;
    }
    return { status: 'SENT', providerRef };
  } catch (error) {
    return { status: 'FAILED', error: clip(error instanceof Error ? error.message : String(error)) };
  }
}

/* ---------------------------------------------------------------- SMS */

/**
 * বাংলা টেক্সট SMS এ Unicode হিসেবে যায় — এক সেগমেন্টে মাত্র ৭০ অক্ষর, অর্থাৎ
 * লম্বা মেসেজে বিল কয়েকগুণ। তাই গেটওয়েতে পাঠানোর আগে ছেঁটে দেওয়া হয়;
 * পুরো বিবরণ ইন-অ্যাপ নোটিফিকেশন ও ইমেইলে থাকে।
 */
export const SMS_MAX_LENGTH = 280;

export function trimForSms(message: string): string {
  const text = message.replace(/\s+/g, ' ').trim();
  return text.length > SMS_MAX_LENGTH ? `${text.slice(0, SMS_MAX_LENGTH - 1)}…` : text;
}

/**
 * গেটওয়ে-নিরপেক্ষ HTTP SMS — `SMS_API_URL` একটি টেমপ্লেট, তাতে
 * `{key}` `{to}` `{msg}` `{sender}` প্লেসহোল্ডার বসে (মান URL-encode হয়)।
 *
 *   SMS_API_URL="https://api.example-bd.com/sendsms?api_key={key}&to={to}&msg={msg}&sender_id={sender}"
 *
 * বাংলাদেশি প্রায় সব গেটওয়েই এই আকারের query-string API দেয়, তাই একটিমাত্র
 * env ভ্যারিয়েবলেই প্রোভাইডার বদলানো যায়। `SMS_API_METHOD=POST` দিলে একই
 * প্যারামিটারগুলো form-body তে যাবে।
 */
export async function sendSms(params: { to: string; message: string }): Promise<TransportResult> {
  const template = process.env.SMS_API_URL;
  const apiKey = process.env.SMS_API_KEY ?? '';
  const sender = process.env.SMS_SENDER_ID ?? '';

  if (!template) {
    if (process.env.NODE_ENV !== 'production') {
      console.info(`[sms:dev] → ${params.to}\n${params.message}`);
    }
    return { status: 'SKIPPED', reason: 'SMS_API_URL সেট করা নেই' };
  }

  const values: Record<string, string> = {
    key: apiKey,
    to: params.to,
    msg: params.message,
    sender,
  };
  const fill = (input: string) =>
    input.replace(/\{(key|to|msg|sender)\}/g, (_, name: string) =>
      encodeURIComponent(values[name] ?? ''),
    );

  try {
    const method = (process.env.SMS_API_METHOD ?? 'GET').toUpperCase();
    let response: Response;

    if (method === 'POST') {
      // টেমপ্লেটের query অংশটাই form body হয়ে যায় — গেটওয়ের প্যারামিটারের নাম
      // যা-ই হোক, একই টেমপ্লেট দুই মেথডেই কাজ করে
      const [base, query = ''] = fill(template).split('?');
      response = await fetch(base, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: query,
      });
    } else {
      response = await fetch(fill(template), { method: 'GET' });
    }

    const body = await response.text();
    if (!response.ok) return { status: 'FAILED', error: clip(`HTTP ${response.status} — ${body}`) };

    // গেটওয়েগুলো প্রায়ই HTTP 200 দিয়েও শরীরে ত্রুটি লেখে — সাধারণ শব্দগুলো ধরা হয়
    if (/\b(error|failed|invalid|insufficient|unauthorized)\b/i.test(body)) {
      return { status: 'FAILED', error: clip(body) };
    }
    return { status: 'SENT', providerRef: clip(body, 120) || undefined };
  } catch (error) {
    return { status: 'FAILED', error: clip(error instanceof Error ? error.message : String(error)) };
  }
}
