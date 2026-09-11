# DEPLOYMENT.md — Vercel এ ডিপ্লয়

ধাপে ধাপে নির্দেশনা। প্রথমবার ~২০ মিনিট, এরপর প্রতিটি ডিপ্লয় স্বয়ংক্রিয়
(`master` এ push করলেই)।

---

## ⚠️ শুরুর আগে একটি জরুরি সীমাবদ্ধতা পড়ুন

**ফাইল আপলোড Vercel এ কাজ করবে না।** `src/lib/upload.ts` ফাইলগুলো
`public/uploads/` এ লেখে, কিন্তু Vercel এর serverless ফাইলসিস্টেম **read-only**
(শুধু `/tmp` লেখা যায়, আর সেটিও রিকোয়েস্টের পরে মুছে যায়)।

ফলে এই তিনটি ফিচার প্রোডাকশনে চলবে না:

- লিড ডকুমেন্ট আপলোড (`/sales/leads/<id>`)
- সেল ডকুমেন্ট আপলোড (`/accounts/schedule/<saleId>`)
- ইঞ্জিনিয়ারের সাইট ফটো (`/engineer/sites/<unitId>`)

আপলোড **ক্র্যাশ করবে না** — "ফাইল সেভ করা যায়নি" মেসেজ দিয়ে থেমে যাবে। বাকি
পুরো অ্যাপ (লিড, পাইপলাইন, সেল, পেমেন্ট, রসিদ, ফেজ, রিপোর্ট) ঠিকঠাক চলবে।

**সমাধান** — অবজেক্ট স্টোরেজে সরানো। `saveUploadedFile()` এর ভেতরটুকু বদলালেই
হবে, কলাররা `{ url, fileName, size }` ছাড়া আর কিছু জানে না:

| বিকল্প | মন্তব্য |
|---|---|
| **Vercel Blob** | সবচেয়ে কম ঝামেলা — `@vercel/blob`, ড্যাশবোর্ড থেকেই টোকেন |
| **Cloudflare R2** | সস্তা, egress ফ্রি; S3-সামঞ্জস্যপূর্ণ API |
| **AWS S3** | পরিচিত, কিন্তু egress খরচ আছে |

ডকুমেন্ট আপলোড এখনই দরকার হলে **আগে এই কাজটি করুন**, নইলে VPS/Railway/Render
এর মতো persistent ডিস্কওয়ালা হোস্টে ডিপ্লয় করুন।

---

## ১. ডাটাবেস তৈরি

Vercel এর serverless ফাংশন প্রতি রিকোয়েস্টে নতুন কানেকশন খোলে, তাই
**connection pooling আছে এমন** Postgres দরকার:

| প্রোভাইডার | পুলড URL | ডাইরেক্ট URL |
|---|---|---|
| **Neon** (সুপারিশ) | `...-pooler.<region>.aws.neon.tech/...?sslmode=require` | `...` (pooler ছাড়া) |
| **Supabase** | পোর্ট `6543` (`?pgbouncer=true`) | পোর্ট `5432` |
| **Vercel Postgres** | `POSTGRES_PRISMA_URL` | `POSTGRES_URL_NON_POOLING` |

দুটো স্ট্রিংই সংগ্রহ করে রাখুন:

- **পুলড** → Vercel এ `DATABASE_URL` হিসেবে বসবে (অ্যাপ চালানোর জন্য)
- **ডাইরেক্ট** → শুধু মাইগ্রেশন চালাতে, আপনার নিজের মেশিন থেকে

> মাইগ্রেশনে ডাইরেক্ট কানেকশন লাগে কারণ PgBouncer এর transaction mode এ
> Prisma এর advisory lock কাজ করে না।

---

## ২. সিক্রেট তৈরি

```bash
openssl rand -base64 32   # NEXTAUTH_SECRET এর জন্য
openssl rand -base64 32   # CRON_SECRET এর জন্য
```

---

## ৩. স্কিমা ও ডেমো ডেটা বসানো

আপনার নিজের মেশিন থেকে, **ডাইরেক্ট** URL দিয়ে:

```bash
DATABASE_URL="<ডাইরেক্ট-url>" npm run db:deploy
```

`prisma migrate deploy` শুধু `prisma/migrations/` এর মাইগ্রেশনগুলো প্রয়োগ করে —
নতুন মাইগ্রেশন বানায় না, ডেটাও মোছে না। প্রোডাকশনে এটিই ব্যবহার করবেন
(`migrate dev` কখনো নয়)।

প্রথম অ্যাডমিন অ্যাকাউন্ট ও ফেজ টেমপ্লেট বসাতে সিড চালান — **প্রোডাকশনে
সবসময় `SEED_DEMO=false` দিয়ে**:

```bash
DATABASE_URL="<ডাইরেক্ট-url>" \
  SEED_DEMO=false \
  SEED_PASSWORD="<শক্ত-পাসওয়ার্ড>" \
  ADMIN_EMAIL="<আপনার-ইমেইল>" \
  ADMIN_NAME="<আপনার-নাম>" \
  npm run db:seed
```

`SEED_DEMO=false` এ যা তৈরি হয়:

| তৈরি হয় | হয় না |
|---|---|
| একজন ADMIN (`ADMIN_EMAIL`/`ADMIN_NAME` দিয়ে) | ডেমো স্টাফ ও কাস্টমার অ্যাকাউন্ট |
| গ্লোবাল ফেজ টেমপ্লেট (৭ ধাপ) | ১৩টি ডেমো লিড, চেকলিস্ট, লেজার এন্ট্রি |
| | ডেমো প্রজেক্ট, ফেজ আপডেট, কিস্তি ও পেমেন্ট |

ফেজ টেমপ্লেটটি ডেমো ডেটা নয় — **অপারেশনাল কনফিগ**। লিড "Won" হয়ে প্রজেক্ট
তৈরি হওয়ার সময় ওখান থেকেই ফেজগুলো কপি হয়, তাই এটি বাদ দিলে কনভার্ট হওয়া
প্রজেক্টে কোনো টাইমলাইন থাকবে না। পরে `/admin/phase-templates` থেকে ধাপগুলোর
নাম ও সময়কাল বদলানো যায়।

> ⚠️ **`SEED_DEMO=false` ছাড়া প্রোডাকশনে সিড চালাবেন না** — তাহলে ১৩টি বানানো
> লিড, একটি নমুনা প্রজেক্ট ও চারটি স্টাফ অ্যাকাউন্ট (সবার এক জানা পাসওয়ার্ড)
> লাইভ ডেটাবেসে ঢুকে যাবে।
>
> সিড দুর্বল পাসওয়ার্ড নিজেই আটকায়: `SEED_DEMO=false` এ ডেমো পাসওয়ার্ড
> (`Orion@1234`) বা ১২ অক্ষরের কম কিছু দিলে কিছু না লিখেই থেমে যায়। খেয়াল
> রাখবেন `@prisma/client` নিজে থেকেই `.env` লোড করে — তাই লোকাল `.env` এর
> `SEED_PASSWORD` নীরবে ঢুকে পড়তে পারে; কমান্ডে স্পষ্ট করে দিলে সেটিই জেতে।
>
> সিড **idempotent** — আবার চালালে অ্যাডমিন ও টেমপ্লেট দুবার তৈরি হয় না।
>
> সিড করা পাসওয়ার্ড প্রথম লগইনের পরই বদলে নিন (`/admin/users` → পাসওয়ার্ড রিসেট)।

---

## ৪. Vercel এ প্রজেক্ট তৈরি

1. কোডটি GitHub এ push করুন (`master` ব্রাঞ্চ)
2. [vercel.com/new](https://vercel.com/new) → রিপোজিটরি import করুন
3. Framework **Next.js** নিজে থেকেই ধরা পড়বে — বিল্ড সেটিংস বদলাবেন না
   (`package.json` এর `build` স্ক্রিপ্টেই `prisma generate` আছে)
4. **Deploy চাপার আগে** নিচের env variable গুলো বসান

---

## ৫. Environment Variables

Vercel → Project → **Settings → Environment Variables**। Production,
Preview ও Development — তিনটিতেই যোগ করুন (Preview এ আলাদা ডাটাবেস দিলে ভালো)।

### আবশ্যক

| নাম | মান |
|---|---|
| `DATABASE_URL` | **পুলড** Postgres connection string |
| `NEXTAUTH_SECRET` | ধাপ ২ এর প্রথম সিক্রেট |
| `NEXTAUTH_URL` | অ্যাপের public URL — `https://<project>.vercel.app` বা কাস্টম ডোমেইন |
| `CRON_SECRET` | ধাপ ২ এর দ্বিতীয় সিক্রেট |

> `CRON_SECRET` সেট থাকলে Vercel Cron নিজে থেকেই
> `Authorization: Bearer <CRON_SECRET>` হেডার পাঠায় — রুটটি ঠিক এটিই আশা করে
> (`src/app/api/cron/overdue/route.ts`)। সেট না করলে প্রোডাকশনে এন্ডপয়েন্টটি
> ৪০১ দেবে এবং **কোনো Email/SMS যাবে না**।

### ঐচ্ছিক — Email / SMS (PRD সেকশন ৫.৬)

| নাম | মান |
|---|---|
| `RESEND_API_KEY` | [resend.com](https://resend.com) এর API key |
| `EMAIL_FROM` | `Orion Builders <no-reply@yourdomain.com>` — ডোমেইনটি Resend এ verify করা থাকতে হবে |
| `SMS_API_URL` | গেটওয়ের URL টেমপ্লেট — প্লেসহোল্ডার `{key}` `{to}` `{msg}` `{sender}` |
| `SMS_API_KEY` | গেটওয়ের key |
| `SMS_SENDER_ID` | অনুমোদিত sender ID |
| `SMS_API_METHOD` | `GET` (ডিফল্ট) বা `POST` |

কোনোটি না দিলে শুধু ইন-অ্যাপ নোটিফিকেশন যাবে, ডেলিভারিগুলো `SKIPPED` লেখা
থাকবে — কিছু ভাঙবে না।

`SEED_PASSWORD` Vercel এ **দরকার নেই** (সিড লোকাল থেকে চলে)।

---

## ৬. Deploy

**Deploy** চাপুন। বিল্ড লগে যা দেখার কথা:

```
Running "npm install"
> prisma generate          ← postinstall
Running "npm run build"
> prisma generate && next build
✓ Compiled successfully
```

কাস্টম ডোমেইন যোগ করলে **`NEXTAUTH_URL` সেই ডোমেইনে বদলে আবার redeploy করুন**
— নইলে লগইনের পর ভুল ঠিকানায় রিডাইরেক্ট হবে।

---

## ৭. Cron যাচাই

`vercel.json` এ ইতিমধ্যেই কনফিগার করা:

```json
"crons": [{ "path": "/api/cron/overdue", "schedule": "0 19 * * *" }]
```

`0 19 * * *` **UTC** — অর্থাৎ বাংলাদেশ সময় রাত **১:০০ টা** (UTC+6)। Vercel এর
cron সবসময় UTC ধরে, তাই ঘণ্টাটা ৬ কমিয়ে লেখা হয়েছে।

দিনে একবারই যথেষ্ট: "বকেয়া" তারিখ বদলালেই বদলায়, আর sweep গুলো idempotent।
(Vercel এর Hobby প্ল্যানে দিনে একবারই সর্বোচ্চ।)

Deploy এর পর **Project → Cron Jobs** এ জবটি তালিকায় আসার কথা। হাতে পরীক্ষা:

```bash
curl -fsS -H "Authorization: Bearer $CRON_SECRET" \
  https://<your-app>.vercel.app/api/cron/overdue
```

✅ `{"ok":true,...}` — কতগুলো কিস্তি ওভারডিউ হলো, কতগুলো নোটিফিকেশন ও
ডেলিভারি গেল তার হিসাবসহ।

> cron না চললেও UI ভুল দেখাবে না — অ্যাকাউন্টস পেজ লোডে একই sweep চলে, আর
> স্ট্যাটাস সবসময় আজকের তারিখ ধরে হিসাব হয়। কিন্তু **Email/SMS এর কোনো
> ফলব্যাক নেই**, সেগুলো শুধু cron থেকেই যায়।

---

## ৮. ডিপ্লয়ের পর চেকলিস্ট

| # | যাচাই | ✅ |
|---|---|---|
| 8.1 | `https://<app>/login` খোলে, লোগো ও স্টাইল ঠিক | ☐ |
| 8.2 | ADMIN দিয়ে লগইন হয়, `/admin` এ ল্যান্ড করে | ☐ |
| 8.3 | ড্যাশবোর্ডের চার্ট ও KPI ডেটা দেখাচ্ছে (DB সংযোগ ঠিক) | ☐ |
| 8.4 | নতুন লিড তৈরি করা যায় (write path ঠিক) | ☐ |
| 8.5 | মোবাইল ব্রাউজার থেকে `/engineer` ও `/customer` ঠিক দেখায় | ☐ |
| 8.6 | `/admin/reports` থেকে একটি CSV নামে | ☐ |
| 8.7 | cron এন্ডপয়েন্ট ২০০ দেয় (ধাপ ৭) | ☐ |
| 8.8 | Vercel → Logs এ কোনো unhandled error নেই | ☐ |
| 8.9 | `/sales/pipeline` এ কোনো ডেমো লিড নেই (বোর্ড খালি) | ☐ |
| 8.10 | `/admin/phase-templates` এ ৭টি ধাপ বসানো আছে | ☐ |
| 8.11 | অ্যাডমিনের সিড-পাসওয়ার্ড বদলানো হয়েছে | ☐ |

---

## ৯. পরবর্তী মাইগ্রেশন

স্কিমা বদলালে:

```bash
# ১) লোকালে মাইগ্রেশন বানান ও পরীক্ষা করুন
npm run db:migrate -- --name add_something

# ২) কমিট করে push করুন — Vercel নতুন বিল্ড করবে
git add prisma/migrations prisma/schema.prisma && git commit -m "feat(db): ..."

# ৩) প্রোডাকশন ডাটাবেসে প্রয়োগ করুন (ডাইরেক্ট URL দিয়ে)
DATABASE_URL="<ডাইরেক্ট-url>" npm run db:deploy
```

ক্রমটা জরুরি — **কোড ডিপ্লয় হওয়ার আগে** মাইগ্রেশন চালালে পুরনো কোড নতুন
কলামের কথা জানে না; **পরে** চালালে নতুন কোড অনুপস্থিত কলাম খুঁজবে। কলাম যোগ
করার মতো backward-compatible পরিবর্তনে আগে মাইগ্রেশন চালানোই নিরাপদ।

> মাইগ্রেশন বিল্ডের অংশ করতে চাইলে `build` স্ক্রিপ্টটি
> `prisma generate && prisma migrate deploy && next build` করা যায়, তবে তখন
> `DATABASE_URL` টি ডাইরেক্ট হতে হবে — আর একটি ব্যর্থ মাইগ্রেশন পুরো ডিপ্লয়
> আটকে দেবে। ছোট টিমে হাতে চালানোই বেশি নিয়ন্ত্রণ দেয়।

---

## ১০. সমস্যা হলে

| উপসর্গ | কারণ ও সমাধান |
|---|---|
| বিল্ডে `@prisma/client did not initialize` | `postinstall` স্ক্রিপ্টটি আছে কিনা দেখুন; Vercel এ build cache clear করে redeploy করুন |
| `Can't reach database server` | `DATABASE_URL` এ `?sslmode=require` আছে কিনা, আর প্রোভাইডারে IP allowlist খোলা কিনা দেখুন |
| `Too many connections` | পুলড (pooler/6543) URL ব্যবহার করছেন কিনা নিশ্চিত করুন — ডাইরেক্ট URL নয় |
| লগইনের পর ভুল ডোমেইনে রিডাইরেক্ট | `NEXTAUTH_URL` আসল ডোমেইনে সেট করে redeploy |
| `[next-auth][error] NO_SECRET` | `NEXTAUTH_SECRET` সেট করা নেই |
| Cron এ ৪০১ | `CRON_SECRET` env এ সেট নেই, বা সেট করার পর redeploy করা হয়নি |
| আপলোডে "ফাইল সেভ করা যায়নি" | প্রত্যাশিত — উপরের সীমাবদ্ধতা অংশটি দেখুন |
| পেজ টাইমআউট | `maxDuration` বাড়ান (`vercel.json`), অথবা DB region অ্যাপের region (`bom1`) এর কাছে নিন |

---

## রেফারেন্স

- ফিচার-ভিত্তিক ম্যানুয়াল টেস্ট: `TESTING.md`
- প্রোডাক্ট স্পেসিফিকেশন: `01_PRD.md`
- ডেভেলপমেন্ট প্ল্যান: `02_BUILD_PLAN.md`
- env এর পূর্ণ তালিকা ও ব্যাখ্যা: `.env.example`
