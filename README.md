# Orion Builders CRM/ERP

Next.js 14 (App Router) + TypeScript + Tailwind + shadcn/ui + Prisma + PostgreSQL + NextAuth.

স্পেসিফিকেশন: [`01_PRD.md`](01_PRD.md) · প্ল্যান: [`02_BUILD_PLAN.md`](02_BUILD_PLAN.md) · স্কিমা: [`03_schema.prisma`](03_schema.prisma) · Claude Code instructions: [`CLAUDE.md`](CLAUDE.md)

**বর্তমান অবস্থা: Phase 1 (Auth + RBAC + Base Layout) সম্পন্ন।**

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
└── seed.ts                # প্রতি role এ একজন ডেমো ইউজার
src/
├── app/
│   ├── (auth)/login/      # লগইন পেজ + ফর্ম
│   ├── admin/             # ADMIN
│   │   └── users/         # ইউজার ম্যানেজমেন্ট (list + server actions)
│   ├── sales/             # MARKETING
│   ├── engineer/          # ENGINEER
│   ├── accounts/          # ACCOUNTS
│   ├── customer/          # CUSTOMER
│   └── api/auth/[...nextauth]/
├── components/
│   ├── ui/                # shadcn/ui
│   ├── layout/            # PanelShell, sidebar, mobile drawer, user menu
│   ├── pipeline/          # Phase 2
│   ├── phase-timeline/    # Phase 3
│   └── payment-schedule/  # Phase 4
├── lib/
│   ├── auth.ts            # NextAuth config (Credentials + JWT + role)
│   ├── prisma.ts
│   ├── rbac.ts            # permission matrix (PRD সেকশন ৪)
│   ├── nav.ts             # panel-wise sidebar মেনু
│   ├── guards.ts          # server action এর permission গার্ড
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

Phase 2 — Lead Management & Sales Pipeline (Kanban board, lead CRUD, follow-up)। প্রম্পট: `04_PROMPTS.md` এর Phase 2 সেকশন।

সাইডবারে **P2 / P3 / P4 / P6** ব্যাজ দেওয়া মেনুগুলো ওই ফেজে চালু হবে।
