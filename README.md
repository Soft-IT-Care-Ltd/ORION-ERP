# Orion Builders CRM/ERP

Next.js 14 (App Router) + TypeScript + Tailwind + shadcn/ui + Prisma + PostgreSQL + NextAuth.

স্পেসিফিকেশন: [`01_PRD.md`](01_PRD.md) · প্ল্যান: [`02_BUILD_PLAN.md`](02_BUILD_PLAN.md) · স্কিমা: [`03_schema.prisma`](03_schema.prisma) · Claude Code instructions: [`CLAUDE.md`](CLAUDE.md)

**বর্তমান অবস্থা: Phase 2 (Lead Management & Sales Pipeline) সম্পন্ন** — প্রবাসী-কেন্দ্রিক
লিড ফিল্ড (international ফোন, residence country, লোকাল কন্টাক্ট), Lead Documents, ও
**Won → Sale কনভার্শন** (ইউনিট সিলেক্ট করে ড্রাফট সেল তৈরি) সহ।

---

## ১. লোকাল সেটআপ

### ধাপ ১ — ডিপেন্ডেন্সি

```bash
npm install
```

### ধাপ ২ — PostgreSQL ডাটাবেস

যেকোনো একটি বেছে নিন:

**(ক) লোকাল Postgres (Homebrew)**

```bash
brew services start postgresql@16
createdb orion_crm
```

`.env` এ:

```
DATABASE_URL="postgresql://<your-mac-username>@localhost:5432/orion_crm?schema=public"
```

> Homebrew Postgres এ সাধারণত পাসওয়ার্ড লাগে না (trust auth), ইউজারনেম = আপনার macOS ইউজারনেম (`whoami`)।
> পাসওয়ার্ড থাকলে: `postgresql://user:password@localhost:5432/orion_crm?schema=public`

**(খ) Docker**

```bash
docker run --name orion-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=orion_crm -p 5432:5432 -d postgres:16
```

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/orion_crm?schema=public"
```

**(গ) Neon / Supabase (free tier)** — ড্যাশবোর্ড থেকে connection string কপি করে `DATABASE_URL` এ বসান (`?sslmode=require` সহ)।

### ধাপ ৩ — এনভায়রনমেন্ট ফাইল

```bash
cp .env.example .env
```

`.env` এ `DATABASE_URL` বসান এবং সিক্রেট জেনারেট করুন:

```bash
openssl rand -base64 32
```

আউটপুটটি `NEXTAUTH_SECRET` এ বসান। প্রোডাকশনে আরেকটি সিক্রেট বানিয়ে `CRON_SECRET` এ
বসান — ওভারডিউ ডিটেকশন cron (`/api/cron/overdue`) এটি দিয়েই সুরক্ষিত হয়। লোকাল dev এ
খালি রাখলেও চলে।

### ধাপ ৪ — মাইগ্রেশন ও সিড

```bash
npx prisma migrate dev --name init
npm run db:seed
```

### ধাপ ৫ — অ্যাপ চালান

```bash
npm run dev
```

→ http://localhost:3000

---

## ২. ডেমো অ্যাকাউন্ট (seed)

সবগুলোর পাসওয়ার্ড: `Orion@1234` (`.env` এ `SEED_PASSWORD` দিয়ে পরিবর্তনযোগ্য)

| Role | Email | Panel |
|---|---|---|
| ADMIN | admin@orionbuilders.com | `/admin` |
| MARKETING | sales@orionbuilders.com | `/sales` |
| ENGINEER | engineer@orionbuilders.com | `/engineer` |
| ACCOUNTS | accounts@orionbuilders.com | `/accounts` |
| CUSTOMER | customer@example.com | `/customer` |

> ⚠️ প্রোডাকশনে ডিপ্লয়ের আগে এই ডেমো অ্যাকাউন্টগুলো মুছে ফেলুন বা পাসওয়ার্ড বদলান।

---

## ৩. npm scripts

| কমান্ড | কাজ |
|---|---|
| `npm run dev` | ডেভ সার্ভার |
| `npm run build` | prisma generate + প্রোডাকশন বিল্ড |
| `npm run lint` | ESLint |
| `npm run db:migrate` | `prisma migrate dev` |
| `npm run db:studio` | Prisma Studio (ডেটা ব্রাউজার) |
| `npm run db:seed` | ডেমো ইউজার সিড |
| `npm run test:validations` | Zod স্কিমার যাচাই (DB লাগে না) |
| `npm run test:ledger` | লেজারের হিসাব ও "ক্লায়েন্ট খরচ দেখবে না" নিয়ম (DB লাগে) |
| `npm run test:portal` | কাস্টমার পোর্টালের payload ও রসিদের স্কোপ (DB লাগে) |
| `npm run test:dashboard` | নোটিফিকেশন sweep ও অ্যাডমিন ড্যাশবোর্ডের রিপোর্ট-কুয়েরি (DB লাগে) |

---

## ৪. প্রজেক্ট স্ট্রাকচার

```
prisma/
├── schema.prisma          # 03_schema.prisma এর কপি (দুটো sync রাখুন)
├── migrations/
└── seed.ts                # প্রতি role এ একজন ডেমো ইউজার + ডেমো লিড/প্রজেক্ট/ইউনিট
src/
├── app/
│   ├── (auth)/login/      # লগইন পেজ + ফর্ম
│   ├── admin/             # ADMIN
│   │   └── users/         # ইউজার ম্যানেজমেন্ট (list + server actions)
│   ├── sales/             # MARKETING
│   │   ├── page.tsx       # ফানেল ড্যাশবোর্ড (stage-wise count, scope অনুযায়ী)
│   │   ├── pipeline/      # Kanban বোর্ড (dnd-kit drag & drop)
│   │   └── leads/         # lead server actions, ফর্ম, detail + timeline + ডকুমেন্ট
│   │                      # + sale-actions.ts / won-sale-dialog.tsx (Won → Sale)
│   ├── engineer/          # ENGINEER — আমার সাইট, ফেজ আপডেট
│   ├── accounts/          # ACCOUNTS
│   │   ├── page.tsx       # কালেকশন KPI + aging রিপোর্ট
│   │   ├── schedule/      # সেল তালিকা + [saleId] প্ল্যান বিল্ডার ও শিডিউল
│   │   ├── payments/      # পেমেন্ট এন্ট্রি ডায়ালগ, সাম্প্রতিক রসিদ, sweep বোতাম
│   │   └── overdue/       # পূর্ণ aging রিপোর্ট (০–১৫ / ১৬–৩০ / ৩০+)
│   ├── customer/          # CUSTOMER — progress ও payments (read-only)
│   ├── receipts/[id]/     # প্রিন্টযোগ্য রসিদ (Admin/Accounts/নিজের কাস্টমার)
│   ├── api/cron/overdue/  # ওভারডিউ sweep — cron বা on-demand
│   └── api/auth/[...nextauth]/
├── components/
│   ├── ui/                # shadcn/ui
│   ├── form/              # PhoneInput (country code picker + লোকাল নম্বর)
│   ├── layout/            # PanelShell, sidebar, mobile drawer, user menu
│   ├── phase-timeline/    # Phase 3
│   └── payment-schedule/  # Phase 4
├── lib/
│   ├── auth.ts            # NextAuth config (Credentials + JWT + role)
│   ├── prisma.ts
│   ├── countries.ts       # দেশ + dial code (প্রবাসী residence ও ফোন picker)
│   ├── phone.ts           # E.164 parse/format (libphonenumber, server-only)
│   ├── upload.ts          # ফাইল স্টোরেজ — R2, কনফিগ না থাকলে dev এ public/uploads
│   ├── storage.ts         # Cloudflare R2 ক্লায়েন্ট (S3-compatible, server-only)
│   ├── upload-limits.ts   # আপলোড সীমা ও অনুমোদিত টাইপ (client-safe)
│   ├── rbac.ts            # permission matrix (PRD সেকশন ৪)
│   ├── nav.ts             # panel-wise sidebar মেনু
│   ├── guards.ts          # server action এর permission গার্ড
│   ├── action-result.ts   # server action এর common return shape
│   ├── leads.ts           # stage/source/lost-reason কনস্ট্যান্ট ও লেবেল
│   ├── sales.ts           # sale status / unit status লেবেল ও ব্যাজ
│   ├── phases.ts          # ফেজ টেমপ্লেট, স্ট্যাটাস হিসাব ও লেবেল (client-safe)
│   ├── payments.ts        # কিস্তি টেমপ্লেট, স্ট্যাটাস, aging, রসিদ (client-safe)
│   ├── payment-data.ts    # প্ল্যান লোড, ওভারডিউ sweep, aging কুয়েরি (server-only)
│   ├── lead-access.ts     # লিড ownership scope (ADMIN সব / MARKETING নিজের)
│   ├── project-access.ts  # প্রজেক্ট/ইউনিট scope (ENGINEER শুধু assigned)
│   ├── activity-log.ts    # audit trail helper
│   ├── notifications.ts
│   ├── utils.ts
│   └── validations/       # Zod schema (client-safe)
├── types/next-auth.d.ts   # session.user.role টাইপ
└── middleware.ts          # role-based route protection
```

## ৫. Auth ও RBAC কীভাবে কাজ করে

- **Credentials provider** (`src/lib/auth.ts`) — ইমেইল/পাসওয়ার্ড, bcrypt hash যাচাই, `active: false` ইউজার ব্লকড।
- **JWT session** — `role` ও `id` টোকেনে থাকে, তাই middleware এ ডাটাবেস কল ছাড়াই role চেক হয়।
- **`middleware.ts`** — প্যানেল route গুলো প্রোটেক্টেড। লগইন না থাকলে `/login`, ভুল role হলে নিজের প্যানেলে redirect।
- **`PanelShell`** — প্রতিটি পেজ লোডে DB থেকে ইউজারের current role ও `active` আবার যাচাই করে।
  তাই অ্যাডমিন কাউকে **নিষ্ক্রিয় করলে তার চালু সেশনও সাথে সাথে বন্ধ** হয় (JWT এর মেয়াদ শেষ হওয়ার অপেক্ষা করতে হয় না)।
- **`lib/guards.ts`** — server action এ `getAuthorizedUser(permission)` দিয়ে একই যাচাই।
- **`lib/rbac.ts`** — permission matrix; নতুন role যোগ করলে শুধু এখানে ম্যাপিং বাড়াতে হবে।

### Route → role

| Route | কারা ঢুকতে পারবে |
|---|---|
| `/admin/**` | ADMIN |
| `/sales/**` | ADMIN, MARKETING |
| `/engineer/**` | ADMIN, ENGINEER |
| `/accounts/**` | ADMIN, ACCOUNTS |
| `/customer/**` | CUSTOMER (পোর্টালটি লগইন করা ইউজারের নিজের `Customer` রেকর্ডের উপর নির্ভরশীল) |

## ৫ক. ইউজার ম্যানেজমেন্ট (`/admin/users`)

শুধু ADMIN। নাম/ইমেইল/ফোন দিয়ে সার্চ, role ফিল্টার, এবং:

- **নতুন ইউজার** — role assign সহ; `CUSTOMER` হলে সাথে `Customer` প্রোফাইলও তৈরি হয়
- **এডিট** — নাম, ইমেইল, ফোন, role
- **পাসওয়ার্ড রিসেট** (কমপক্ষে ৮ অক্ষর)
- **সক্রিয়/নিষ্ক্রিয়** টগল

সেফটি রুল:

- নিজের role নিজে বদলানো বা নিজেকে নিষ্ক্রিয় করা যায় না
- সিস্টেমে অন্তত একজন সক্রিয় ADMIN থাকতেই হবে
- প্রতিটি অ্যাকশন `ActivityLog` এ লগ হয় (`USER_CREATED`, `USER_ROLE_CHANGED`, `USER_DEACTIVATED`, …)

> **নোট:** role বদলালে ইউজারের JWT তে পুরনো role থেকে যায়। `PanelShell` DB এর role অনুযায়ী তাকে সঠিক প্যানেলে পাঠায়, তবে সাইডবার/নেভিগেশন পুরোপুরি আপডেট হতে তাকে **আবার লগইন** করতে হবে।

## ৫খ. পেমেন্ট মডিউল (Phase 4 — PRD সেকশন ৫.৩)

**প্ল্যান বিল্ডার** (`/accounts/schedule/[saleId]`) — দুইভাবে শিডিউল বানানো যায়:

- **টেমপ্লেট** — PRD এর স্যাম্পল প্ল্যান (Booking ৫%, Down payment ১৫%, Agreement ১০%,
  ২০টি মাসিক কিস্তি প্রতিটি ২.৫%, হ্যান্ডওভারে বাকিটা)। প্রতিটি হার ও তারিখ এডিটযোগ্য,
  আর নিচে লাইভ প্রিভিউ দেখায় ঠিক কী তৈরি হবে।
- **কাস্টম কিস্তি** — হাতে সারি যোগ/এডিট/মুছে ফেলা (label, due date, amount)।

> **PRD এর টেবিল সম্পর্কে:** সেখানকার শতাংশ যোগ করলে ৯০% হয় (5+15+10+50+10)। তাই
> হ্যান্ডওভারের কিস্তিটি **অবশিষ্ট** ধরা হয় — যোগফল সবসময় ঠিক সেল ভ্যালুর সমান থাকে,
> রাউন্ডিংয়ের খুচরো টাকাও হারায় না। ডিফল্ট মানে হ্যান্ডওভারে পড়ে ২০%; হার বদলে ১০%ও
> করা যায় (যেমন মাসিক ৩%)।

প্ল্যান সেট হলে ড্রাফট সেলটি **CONFIRMED** হয় (PRD সেকশন ৫.১)।

**শিডিউল টেবিল** (`components/payment-schedule/`) — রঙ-কোডেড: পরিশোধিত=সবুজ,
আংশিক=হলুদ, বকেয়া=লাল, নির্ধারিত=ধূসর। `PhaseTimeline` এর মতোই Admin, Accounts ও
Customer — তিন প্যানেলেই একই কম্পোনেন্ট; এডিটের বোতাম আসে `actions` prop দিয়ে, তাই
Customer এর কাছে এটি সম্পূর্ণ read-only। মোবাইলে কার্ড, md থেকে টেবিল।

**পেমেন্ট এন্ট্রি** (`/accounts/payments`) — কিস্তি বেছে প্রাপ্ত টাকা, মাধ্যম
(Cash/Bank/bKash/Nagad/Cheque), রেফারেন্স ও রসিদ নম্বর দিলে Payment তৈরি হয়, কিস্তির
স্ট্যাটাস নতুন করে হিসাব হয় এবং প্রিন্টযোগ্য রসিদ (`/receipts/[id]`) খোলা যায়।

- রসিদ নম্বর খালি রাখলে বছরভিত্তিক ক্রমিক — `ORB-2026-000123`
- বাকির চেয়ে বেশি টাকা এক কিস্তিতে নেওয়া যায় না (অগ্রিম হলে পরের কিস্তিতে আলাদা এন্ট্রি)
- টাকা জমা পড়া কিস্তি আর মোছা যায় না — বিল্ডারে তালা দেওয়া থাকে, server ও একই নিয়ম মানে
- PDF আলাদা লাইব্রেরি দিয়ে নয়, ব্রাউজারের **Print → Save as PDF** — jsPDF/pdf-lib এর
  বিল্ট-ইন ফন্টে বাংলা গ্লিফ নেই, কাস্টমারের নাম ভেঙে যেত

**ওভারডিউ ডিটেকশন ও aging** — `markOverdueInstallments()` due date পেরোনো অথচ অপরিশোধিত
কিস্তিকে `OVERDUE` লেখে (তারিখ পিছিয়ে দিলে বা টাকা এলে আবার ঠিকও করে)। চলে তিনভাবে:
cron (`/api/cron/overdue`, `CRON_SECRET` বেয়ারার টোকেন), অ্যাকাউন্টসের প্রতিটি পেজ লোডে,
আর "ওভারডিউ যাচাই" বোতামে। Aging রিপোর্ট ০–১৫ / ১৬–৩০ / ৩০+ দিনে ভাগ করে অনাদায়ী অঙ্ক,
কিস্তি সংখ্যা ও অ্যাকাউন্ট সংখ্যা দেখায় (`/accounts/overdue`, ড্যাশবোর্ড, `/admin/payments`)।

```bash
# রোজ রাত ১টায়
0 1 * * *  curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://<app>/api/cron/overdue
```

> `Installment.status` DB তে একটি **স্ন্যাপশট** (aging কুয়েরি ইনডেক্স ব্যবহার করতে পারে
> বলে)। দেখানোর সময় UI সবসময় আজকের তারিখ ধরে `computeInstallmentStatus()` দিয়ে আবার
> হিসাব করে — `lib/phases.ts` এর ফেজ স্ট্যাটাসের মতোই। লেখা আর পড়া, দুই জায়গায় একই
> ফাংশন, তাই cron না চললেও UI ভুল দেখায় না।

**রসিদ WhatsApp এ পাঠানো** (PRD সেকশন ৫.২) — পেমেন্ট এন্ট্রির সফলতা প্যানেল, রসিদের
পাতা ও সাম্প্রতিক পেমেন্ট তালিকা — তিন জায়গাতেই "WhatsApp এ পাঠান"। MVP তে এটি
`wa.me` deep-link: prefilled বাংলা মেসেজ (রসিদ নম্বর, কিস্তি, অঙ্ক, তারিখ ও রসিদের
লিংক) নিয়ে চ্যাট খোলে, PDF ম্যানুয়ালি অ্যাটাচ করতে হয়। লিংকটি server এ তৈরি হয়
(`lib/whatsapp.ts`) — ফোন নম্বর না থাকলে বা অচল হলে `null`, তখন বোতামটি রেন্ডারই হয় না।
পাঠানোর পর `Payment.whatsappSentAt` / `LedgerEntry.whatsappSentAt` এ চিহ্ন থাকে, তাই
কোন রসিদ ইতিমধ্যে হাতে নেওয়া হয়েছে তা তালিকা দেখেই বোঝা যায়। পরের ফেজে 360dialog
WhatsApp Business API দিয়ে auto-send যোগ হলে শুধু এই ফাইলটিই বদলাবে।

প্রতিটি পেমেন্ট ও প্ল্যান পরিবর্তন `ActivityLog` এ যায় (`PAYMENT_RECEIVED`,
`PAYMENT_PLAN_GENERATED`, `PAYMENT_PLAN_SAVED`, `OVERDUE_SWEEP`) — CLAUDE.md নিয়ম ৪।

## ৫গ. অ্যাকাউন্টস লেজার (PRD সেকশন ৫.৬)

একটাই `LedgerEntry` টেবিল দুই কাজে — `leadId` সেট থাকলে **client-wise**, না থাকলে
**company-wide** সাধারণ এন্ট্রি (অফিস ভাড়া, বেতন)।

**Client Ledger** — লিড ডিটেইলের **ক্লায়েন্ট লেজার** ট্যাব ও প্রজেক্ট ডিটেইল, দুই
জায়গায় একই কম্পোনেন্ট (`components/ledger/client-ledger.tsx`), কারণ হিসাবটা লিড থেকে
প্রজেক্ট পর্যন্ত একই `leadId` ধরে চলে। সামারি কার্ড চারটি: মোট **billed** (সার্ভিস বিল
+ কন্ট্রাক্টের কিস্তি), মোট **received** (সার্ভিস রসিদ + আদায় হওয়া কিস্তি), মোট
**internal cost**, আর **net profit/loss** (billed − cost)।

**Main Company Ledger** (`/accounts/ledger`) — আয়/খরচ এন্ট্রি, ক্লায়েন্ট ট্যাগ ঐচ্ছিক;
মাস, ধরন, ক্যাটেগরি ও ক্লায়েন্ট ধরে ফিল্টার (সাধারণ GET ফর্ম, JS ছাড়াই চলে)। অ্যাকাউন্টস
ড্যাশবোর্ডে চলতি মাসের Income vs Expense সামারি ও ৬ মাসের বার চার্ট — ট্যাগ করা ও
ট্যাগহীন, সব এন্ট্রি নিয়ে।

**🔒 ক্রিটিক্যাল নিয়ম — ক্লায়েন্ট কখনো খরচ দেখবে না** (PRD সেকশন ৪ ও ৭)। তিন স্তরে:

1. `clientVisible` ফর্ম/ইনপুটে **নেই** — মানটি server এ `resolveClientVisible(type, leadId)`
   থেকেই আসে (`lib/ledger.ts`), তাই সরাসরি অ্যাকশন ডেকেও `true` পাঠানো যায় না।
   EXPENSE এ সবসময় `false`; `leadId` ছাড়া এন্ট্রিতেও `false`।
2. কাস্টমারের কুয়েরি (`loadClientVisibleEntries`) DB লেভেলেই `type = INCOME` **এবং**
   `clientVisible = true` — দুটোই চায়, অর্থাৎ ভুল ডেটা থাকলেও খরচ বেরোয় না।
3. `/accounts/**` ও `ledger:view`/`ledger:manage` permission — CUSTOMER ও ENGINEER এর
   কোনোটাই নেই (`lib/rbac.ts`)।

তিনটিই `npm run test:ledger` এ যাচাই হয় (আসল DB তে, ২৪টি অ্যাসারশন)।

প্রতিটি এন্ট্রি `ActivityLog` এ যায় (`LEDGER_INCOME_ADDED`, `LEDGER_EXPENSE_ADDED`,
`LEDGER_ENTRY_DELETED`) — CLAUDE.md নিয়ম ৪।

## ৫ঘ. নোটিফিকেশন ও অ্যাডমিন ড্যাশবোর্ড (PRD সেকশন ৫.৯ ও ৫.১০)

**নোটিফিকেশন** (`lib/notifications.ts`) দুই স্তরে লেখা হয়:

- **তাৎক্ষণিক** — ইউজারের অ্যাকশনের সাথে সাথে (লিড অ্যাসাইন, ডকুমেন্ট আপলোড,
  প্রজেক্ট তৈরি)। কল-সাইট server action এ।
- **সময়-নির্ভর sweep** — কেউ কিছু না করলেও নিছক তারিখ পেরোলেই যেগুলো ঘটে:
  ফলো-আপ ওভারডিউ, কিস্তির **৭ দিন আগের** রিমাইন্ডার, **বকেয়া** কিস্তি, আর
  ফেজ **DONE** (১০০%) হলে কাস্টমারকে খবর। রোজ `/api/cron/overdue` থেকে; cron
  সেট না থাকলেও বেল রেন্ডারের সময় ঘণ্টায় একবার ফলব্যাক (`sweepIfStale`)।

প্রতিটি sweep-নোটিফিকেশনে একটি স্থিতিশীল `key` (`@@unique([userId, key])`) —
তাই sweep যতবারই চলুক, একই খবর দ্বিতীয়বার লেখা হয় না। বকেয়ার key তে aging
বালতিটিও থাকে, তাই বকেয়া পুরনো হলে (১৫ → ৩০ → ৩০+ দিন) নতুন, জোরালো রিমাইন্ডার যায়।

বেল + অপঠিত badge পাঁচটি role এর প্রতিটিতেই আছে — `PanelShell` এ একবার বসানো
(`components/layout/notification-bell.tsx`), সার্ভার-রেন্ডার করা তালিকা নিয়ে শুরু
হয় ও প্রতি মিনিটে server action দিয়ে রিফ্রেশ হয়।

**অ্যাডমিন ড্যাশবোর্ড** (`/admin`) এ পাঁচটি চার্ট/টেবিল, প্রতিটির ডেটা Prisma
aggregate/groupBy কুয়েরি থেকে (`lib/report-data.ts`):

| # | কার্ড | উৎস |
|---|---|---|
| ১ | Pre-project funnel — stage-wise lead count | `Lead` + `LeadActivity` (Lost লিড যতদূর পৌঁছেছিল সেই ধাপ পর্যন্ত গোনা) |
| ২ | Project Progress Overview — গড় % complete | `Phase` (সময়-ভারিত গড়) |
| ৩ | মাসিক Collected vs Receivable | `Installment` + `Payment` |
| ৪ | **Client-wise Profitability** — billed, cost, net margin | `LedgerEntry.groupBy` + `Payment.groupBy` |
| ৫ | **Company Monthly Income vs Expense** | `LedgerEntry` — `leadId` থাকুক না থাকুক, সব |

৪ নং টেবিলটি **sortable** — যেকোনো কলামের নামে ক্লিক করলে ক্রম বদলায় (ডিফল্ট
মার্জিন descending)। সংখ্যাগুলো `lib/ledger.ts` এর `computeClientProfit` থেকে,
অর্থাৎ ক্লায়েন্ট প্রোফাইলের সামারি কার্ড ও `client-profitability` CSV — তিন
জায়গায় একই হিসাব।

`npm run test:dashboard` এ এগুলো আসল DB তে যাচাই হয় (২৩টি অ্যাসারশন)।

---

## ৬. নতুন shadcn/ui কম্পোনেন্ট যোগ

```bash
npx shadcn@2.10.0 add dialog select textarea
```

---

## ৭. পরবর্তী ধাপ

Phase 5 — Customer Portal (ডকুমেন্ট ও সাপোর্ট টিকিট)। প্রম্পট: `04_PROMPTS.md` এর
Phase 5 সেকশন।

কাস্টমার পোর্টালের **progress** ও **payments** পাতা দুটি ইতিমধ্যে চালু — নিজের ইউনিটের
ফেজ টাইমলাইন, ছবি, কিস্তির তালিকা ও রসিদ (সব read-only)। Phase 5 এ যোগ হবে ডকুমেন্ট
রিপোজিটরি ও সাপোর্ট টিকিট।

সাইডবারে **P5 / P6** ব্যাজ দেওয়া মেনুগুলো ওই ফেজে চালু হবে।
