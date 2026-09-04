# Orion Builders CRM/ERP — Build Plan (Claude Code দিয়ে ডেভেলপমেন্টের জন্য)

**Tech stack decided:** Next.js (App Router) + PostgreSQL + Prisma + Responsive Web (mobile browser দিয়েই engineer/customer প্যানেল চলবে, native app নয়)

---

## ১. Tech Stack (Final)

| Layer | Choice | কারণ |
|---|---|---|
| Frontend + Backend | **Next.js 14+ (App Router, TypeScript)** | একই কোডবেসে full-stack, Claude Code এ দ্রুত ইটারেট করা যায় |
| Database | **PostgreSQL** | Relational data (leads, projects, payments) এর জন্য সবচেয়ে উপযুক্ত |
| ORM | **Prisma** | Type-safe schema, migration সহজ |
| Auth | **NextAuth.js (Credentials + role-based session)** | Role-wise redirect/middleware সহজ |
| UI | **Tailwind CSS + shadcn/ui** | দ্রুত, professional, মোবাইল-ফ্রেন্ডলি responsive UI |
| File/Photo storage | **Cloudflare R2 / AWS S3 (বা প্রাথমিকভাবে local + পরে migrate)** | সাইট ফটো, ডকুমেন্ট |
| Notification | **Nodemailer (email) + BulkSMSBD/local SMS gateway (SMS)** | Bangladesh-friendly |
| Hosting | **Vercel (app) + Supabase/Neon বা VPS (Postgres)** | দ্রুত deploy, কম DevOps ওভারহেড |
| Charts/Dashboard | **Recharts** | Funnel, financial, progress চার্ট |

---

## ২. Repo Structure (প্রস্তাবিত)

```
orion-crm/
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── src/
│   ├── app/
│   │   ├── (auth)/login/
│   │   ├── admin/                # Admin panel routes
│   │   ├── sales/                # Marketing Executive panel
│   │   ├── engineer/             # Site Engineer panel
│   │   ├── customer/             # Customer portal
│   │   ├── api/                  # API routes (or use server actions)
│   ├── components/
│   │   ├── ui/                   # shadcn components
│   │   ├── pipeline/             # Kanban board components
│   │   ├── phase-timeline/
│   │   ├── payment-schedule/
│   ├── lib/
│   │   ├── auth.ts
│   │   ├── prisma.ts
│   │   ├── rbac.ts               # permission checks
│   │   ├── notifications.ts
│   ├── types/
├── CLAUDE.md                     # Claude Code এর জন্য project instructions
├── .env.example
└── package.json
```

---

## ৩. Development Phases (Milestone-wise)

> প্রতিটি ফেজ শেষে **working, testable feature** থাকবে — যাতে ধাপে ধাপে ভ্যালিডেট করে এগোনো যায়। প্রতিটি ফেজের নিচে Claude Code তে দেওয়ার মতো একটি **starter prompt** দেওয়া আছে।

### Phase 0 — Project Setup (১–২ দিন)

- Next.js + TypeScript + Tailwind + shadcn/ui init
- PostgreSQL DB সেটাপ (local বা Neon/Supabase free tier)
- Prisma init, `03_schema.prisma` থেকে schema বসানো, প্রথম migration
- NextAuth বেসিক সেটাপ (Credentials provider)
- `.env` কনফিগার, GitHub repo init

**Claude Code prompt:**
> "এই PRD (`01_PRD.md`) ও schema (`03_schema.prisma`) অনুযায়ী একটি Next.js 14 App Router + TypeScript + Tailwind + shadcn/ui + Prisma + PostgreSQL প্রজেক্ট সেটআপ করো। NextAuth দিয়ে email/password login সেটআপ করো role field সহ (admin/marketing/engineer/accounts/customer)।"

### Phase 1 — Auth + RBAC + Base Layout (২–৩ দিন)

- Role-based middleware (unauthorized role → redirect)
- প্রতিটি panel এর জন্য আলাদা layout + sidebar navigation
- User management (Admin: create/edit user, assign role)
- `lib/rbac.ts` এ permission matrix (PRD সেকশন ৪ অনুযায়ী) কোড আকারে ইমপ্লিমেন্ট

**Claude Code prompt:**
> "PRD সেকশন ৪ এর permission matrix অনুযায়ী `lib/rbac.ts` এ role-permission mapping বানাও এবং middleware.ts এ route protection যোগ করো। প্রতিটি role এর জন্য আলাদা dashboard layout ও sidebar বানাও।"

### Phase 2 — Lead Management & Sales Pipeline (৪–৬ দিন)

- Lead CRUD (create/edit/list/detail)
- Kanban pipeline board (drag-drop stage change) — PRD সেকশন ৫.১ এর stages অনুযায়ী
- Activity log/notes per lead
- Follow-up reminder logic
- Lead → "Won" হলে auto Project/Customer/Sale draft তৈরি
- Marketing executive dashboard (নিজের লিড, funnel সংখ্যা)

**Claude Code prompt:**
> "Lead model এর জন্য একটি Kanban-style pipeline board বানাও (stages: New Lead, Contacted, Site Visit Scheduled, Site Visit Done, Negotiation, Booking, Sale Agreement Signed, Won, Lost) — drag & drop দিয়ে stage change করা যাবে, প্রতিটি lead card এ name, phone, assigned executive, next follow-up date দেখাবে।"

### Phase 3 — Project, Unit & Phase Timeline (৫–৭ দিন)

- Project + Unit CRUD (Admin)
- Phase template তৈরি ও প্রজেক্টে অ্যাসাইন (default template + customizable)
- Site Engineer: phase update UI (% complete, photo upload, remarks)
- Visual timeline component (progress bar / stepper — Admin ও Customer উভয়ের জন্য reusable)

**Claude Code prompt:**
> "PRD সেকশন ৫.২ অনুযায়ী Phase timeline কম্পোনেন্ট বানাও — একটি horizontal stepper/progress bar যা প্রতিটি phase এর status (upcoming/in-progress/done), planned vs actual date, % complete দেখাবে। Site Engineer প্যানেলে একটি ফর্ম বানাও যেখান থেকে % complete আপডেট ও ফটো আপলোড করা যাবে।"

### Phase 4 — Payment Plan & Accounts Module (৫–৭ দিন)

- Payment plan template builder (Admin/Accounts)
- Installment schedule generation (auto, PRD সেকশন ৫.৩ অনুযায়ী)
- Payment receive entry + PDF receipt generation
- Overdue detection + aging report
- Financial dashboard (collected vs receivable, overdue)

**Claude Code prompt:**
> "PRD সেকশন ৫.৩ অনুযায়ী PaymentPlan ও Installment মডেলের ভিত্তিতে একটি payment schedule টেবিল UI বানাও (status: Paid/Partial/Overdue/Scheduled রঙ-কোডেড)। Accounts panel এ payment entry ফর্ম বানাও, entry দিলে auto receipt PDF generate হবে এবং installment status আপডেট হবে।"

### Phase 5 — Customer Portal (৩–৪ দিন)

- Customer login → নিজের project summary, timeline, payment history, documents
- Downloadable invoice/receipt
- Simple support ticket (optional stretch)

**Claude Code prompt:**
> "Customer panel বানাও যেখানে লগইন করা কাস্টমার তার নিজের ইউনিটের progress timeline, payment schedule (paid/due), এবং document list দেখতে পাবে (read-only)। Payment history থেকে receipt PDF download করা যাবে।"

### Phase 6 — Notifications, Reports & Dashboard (৪–৫ দিন)

- In-app + email notification system (payment due, phase milestone, follow-up due)
- Admin analytics dashboard (funnel chart, project progress overview, financial KPI) — PRD সেকশন ৫.৭
- Export reports (CSV/PDF)

**Claude Code prompt:**
> "Admin dashboard এ Recharts দিয়ে ৩টি চার্ট বানাও: (১) Sales funnel (stage-wise lead count), (২) Project-wise progress %, (৩) মাসিক Collected vs Receivable। প্রতিটি চার্টের ডেটা Prisma থেকে aggregate করে আনবে।"

### Phase 7 — Polish, Testing & Deployment (৩–৫ দিন)

- Mobile responsiveness QA (বিশেষত Engineer panel)
- Error handling, form validation (Zod)
- Seed data দিয়ে end-to-end টেস্ট (লিড → বুকিং → পেমেন্ট → হ্যান্ডওভার)
- Vercel + Neon/Supabase এ deploy
- Basic user manual (each role এর জন্য)

---

## ৪. মোট আনুমানিক সময়

| Phase | দিন (estimate) |
|---|---|
| 0 — Setup | ১–২ |
| 1 — Auth/RBAC | ২–৩ |
| 2 — Lead/Pipeline | ৪–৬ |
| 3 — Project/Phase | ৫–৭ |
| 4 — Payment | ৫–৭ |
| 5 — Customer Portal | ৩–৪ |
| 6 — Reports/Notification | ৪–৫ |
| 7 — Polish/Deploy | ৩–৫ |
| **মোট** | **~২৭–৩৯ কর্মদিবস** (একজন solo developer + Claude Code দিয়ে, ফুল-টাইম কাজ ধরে ~৬–৮ সপ্তাহ) |

---

## ৫. কীভাবে Claude Code এ ব্যবহার করবেন

1. এই ৩টি ফাইল (`01_PRD.md`, `02_BUILD_PLAN.md`, `03_schema.prisma`) আপনার প্রজেক্ট রুটে রাখুন।
2. `CLAUDE.md` ফাইলটি (দেওয়া আছে) প্রজেক্ট রুটে রাখুন — এটি Claude Code কে প্রতিটি সেশনে প্রজেক্ট context মনে করিয়ে দেবে।
3. Phase 0 থেকে শুরু করে প্রতিটি ফেজের prompt টি ব্যবহার করে ধাপে ধাপে Claude Code কে কাজ দিন। একবারে পুরো সিস্টেম না চেয়ে **ফেজ-বাই-ফেজ** এগোলে output অনেক বেশি নির্ভুল হয়।
4. প্রতিটি ফেজ শেষে সেটি টেস্ট করে, git commit করে তারপর পরের ফেজে যান।

---

*পরবর্তী ফাইল: `03_schema.prisma` (সরাসরি ব্যবহারযোগ্য Prisma schema) এবং `CLAUDE.md` (Claude Code project instructions)।*
