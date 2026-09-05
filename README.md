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

আউটপুটটি `NEXTAUTH_SECRET` এ বসান।

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
│   ├── engineer/          # ENGINEER
│   ├── accounts/          # ACCOUNTS
│   ├── customer/          # CUSTOMER
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
│   ├── upload.ts          # ফাইল স্টোরেজ — public/uploads (পরে S3/R2)
│   ├── upload-limits.ts   # আপলোড সীমা ও অনুমোদিত টাইপ (client-safe)
│   ├── rbac.ts            # permission matrix (PRD সেকশন ৪)
│   ├── nav.ts             # panel-wise sidebar মেনু
│   ├── guards.ts          # server action এর permission গার্ড
│   ├── action-result.ts   # server action এর common return shape
│   ├── leads.ts           # stage/source/lost-reason কনস্ট্যান্ট ও লেবেল
│   ├── sales.ts           # sale status / unit status লেবেল ও ব্যাজ
│   ├── lead-access.ts     # লিড ownership scope (ADMIN সব / MARKETING নিজের)
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

## ৬. নতুন shadcn/ui কম্পোনেন্ট যোগ

```bash
npx shadcn@2.10.0 add dialog select textarea
```

---

## ৭. পরবর্তী ধাপ

Phase 3 — Project, Unit & Phase Timeline। প্রম্পট: `04_PROMPTS.md` এর Phase 3 সেকশন।

**Won → Sale কনভার্শন (কাজ করছে):** লিড Won এ নিলে একটি ডায়ালগ খোলে — ইউনিট ও
চূড়ান্ত মূল্য নিশ্চিত করলে এক ট্রানজেকশনে Customer (না থাকলে নতুন `role=CUSTOMER`
ইউজার, নাম-ফোন লিড থেকে), Sale (`status=DRAFT`) ও Unit → `SOLD` হয়। সেল কনফার্ম না
হওয়া পর্যন্ত লিডের স্টেজ আর ফেরানো যায় না। প্রজেক্ট/ইউনিট CRUD Phase 3 এ আসবে —
আপাতত `prisma/seed.ts` এ ২টি ডেমো প্রজেক্ট ও ৯টি ইউনিট আছে।

**Phase 4 এ গড়াবে:** ড্রাফট সেলের PaymentPlan সেট করে Accounts/Admin এর কনফার্মেশন
(`Sale.status` → `CONFIRMED`)। কনভার্শনের সময় Accounts ও Admin কে ইতিমধ্যে
`SALE_DRAFT_CREATED` নোটিফিকেশন পাঠানো হয়।

সাইডবারে **P3 / P4 / P6** ব্যাজ দেওয়া মেনুগুলো ওই ফেজে চালু হবে।
