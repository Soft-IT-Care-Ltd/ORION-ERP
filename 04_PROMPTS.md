# Orion Builders CRM/ERP — সব Claude Code Prompts (ফেজ-বাই-ফেজ)

এই ফাইলে প্রতিটি ফেজের জন্য **সম্পূর্ণ, কপি-পেস্ট রেডি prompt** দেওয়া আছে। একটার পর একটা ক্রমানুসারে ব্যবহার করুন — একবারে একটার বেশি ফেজের prompt দেবেন না। প্রতিটি ফেজ শেষে টেস্ট করে, git commit করে তারপর পরের prompt দিন।

> ফোল্ডারে ইতিমধ্যে আছে: `01_PRD.md`, `02_BUILD_PLAN.md`, `03_schema.prisma`, `CLAUDE.md` — Claude Code এই ফাইলগুলো পড়ে কাজ করবে, তাই প্রতিটি prompt এ এগুলোর রেফারেন্স দেওয়া আছে।

---

## Phase 0 — Project Setup

```
এই ফোল্ডারে থাকা 01_PRD.md, 02_BUILD_PLAN.md, 03_schema.prisma, এবং CLAUDE.md ফাইলগুলো পড়ো।

এখন একটি Next.js 14 (App Router, TypeScript) প্রজেক্ট সেটআপ করো নিচের স্ট্যাক দিয়ে:
- Tailwind CSS + shadcn/ui
- Prisma ORM + PostgreSQL (schema হিসেবে 03_schema.prisma ব্যবহার করো, prisma/schema.prisma এ কপি করে বসাও)
- NextAuth.js দিয়ে Credentials-based login সেটআপ করো, যেখানে প্রতিটি ইউজারের একটি role থাকবে (ADMIN, MARKETING, ENGINEER, ACCOUNTS, CUSTOMER — schema.prisma এর Role enum অনুযায়ী)

একটি .env.example ফাইল বানাও DATABASE_URL ও NEXTAUTH_SECRET সহ। প্রজেক্ট স্ট্রাকচার 02_BUILD_PLAN.md এর সেকশন ২ অনুযায়ী রাখো।

শেষে বলো কীভাবে আমি লোকালি DB কানেক্ট করে `npx prisma migrate dev` চালাবো।
```

---

## Phase 1 — Auth + RBAC + Base Layout

```
01_PRD.md এর সেকশন ৪ (User Roles & Permission Matrix) পড়ো।

lib/rbac.ts ফাইলে একটি permission mapping বানাও যেখানে প্রতিটি role (admin, marketing, engineer, accounts, customer) এর জন্য কোন কোন module/action allowed তা define করা থাকবে, PRD এর টেবিল অনুযায়ী।

middleware.ts এ route protection যোগ করো:
- /admin/** শুধু ADMIN role
- /sales/** শুধু MARKETING (এবং ADMIN)
- /engineer/** শুধু ENGINEER (এবং ADMIN)
- /customer/** শুধু CUSTOMER
- অন্য role এর ইউজার ভুল route এ গেলে তাদের নিজের ড্যাশবোর্ডে redirect করো

প্রতিটি role এর জন্য আলাদা layout বানাও (app/admin/layout.tsx, app/sales/layout.tsx ইত্যাদি) — sidebar নেভিগেশনসহ, role অনুযায়ী মেনু আইটেম আলাদা হবে।

Admin panel এ একটি User Management page বানাও যেখান থেকে নতুন ইউজার তৈরি ও role assign করা যাবে।
```

---

## Phase 2 — Lead Management & Sales Pipeline

```
01_PRD.md এর সেকশন ৫.১ (Lead Management & Sales Pipeline) পড়ো।

Lead model ব্যবহার করে (03_schema.prisma এর Lead, LeadActivity) একটি Kanban-style pipeline board বানাও app/sales/pipeline এ, নিচের stage গুলো column হিসেবে:
New Lead → Contacted → Site Visit Scheduled → Site Visit Done → Negotiation → Booking → Sale Agreement Signed → Won / Lost

প্রতিটি lead card এ দেখাবে: নাম, ফোন, source, next follow-up date, assigned executive। Drag & drop দিয়ে stage change করা যাবে (stage change হলে LeadActivity তে auto note যোগ হবে)।

একটি Lead Create/Edit ফর্ম বানাও (নাম, ফোন, ইমেইল, source, interested unit, budget range, assigned marketing executive)।

Lead detail page বানাও যেখানে activity log/notes টাইমলাইন আকারে দেখা যাবে এবং নতুন নোট যোগ করা যাবে।

"Lost" stage এ move করলে একটি reason dropdown বাধ্যতামূলক করো (PRD অনুযায়ী: Price too high, Chose competitor, Location mismatch, Financing issue, No response, Other)।

Marketing executive এর নিজের ড্যাশবোর্ডে একটি সাধারণ funnel সংখ্যা (stage-wise lead count) দেখাও, কিন্তু শুধু তার নিজের assigned lead গুলোর জন্য। Admin সবগুলো দেখতে পাবে।
```

---

## Phase 2.1 — Lead → Project Auto-Conversion

```
Lead pipeline এ "Won" stage এ move করলে একটি ফর্ম/মোডাল খুলবে যেখানে Admin/Marketing ইউনিট সিলেক্ট করে sale confirm করবে।

Confirm করলে backend এ (server action বা API route) নিচেরগুলো auto তৈরি হবে (03_schema.prisma অনুযায়ী):
- Customer রেকর্ড (যদি না থাকে, নতুন User role=CUSTOMER সহ তৈরি হবে, নাম-ফোন Lead থেকে কপি হবে)
- Sale রেকর্ড (leadId, unitId, customerId, totalAmount লিংক করে)
- Unit status "SOLD" এ আপডেট হবে

এই পুরো প্রসেসটা draft/pending অবস্থায় থাকবে যতক্ষণ না Accounts/Admin PaymentPlan সেট করে confirm করছে (Phase 4 এ কভার হবে)।
```

---

## Phase 3 — Project, Unit & Phase Timeline

```
01_PRD.md এর সেকশন ৫.২ (Project & Construction Phase Management) পড়ো।

Admin panel এ Project ও Unit এর CRUD পেজ বানাও (app/admin/projects)। প্রতিটি প্রজেক্টে একটি PhaseTemplate সেট করা যাবে (default 8 phase: Land Acquisition, Design & Approval, Foundation, Structure, Brick Work & Plaster, Electrical/Plumbing, Finishing, Handover — PRD এর টেবিল অনুযায়ী, order ও default duration সহ)।

একটি reusable PhaseTimeline component বানাও (components/phase-timeline) — horizontal stepper বা progress bar, প্রতিটি phase এর status (upcoming/in-progress/done/delayed), % complete, planned vs actual date দেখাবে। এটা Admin, Engineer, ও Customer তিন জায়গাতেই ব্যবহার হবে (শুধু Engineer এ এডিট করা যাবে)।

app/engineer এ একটি "My Sites" page বানাও যেখানে অ্যাসাইন করা ইউনিট/প্রজেক্টের লিস্ট থাকবে। প্রতিটিতে ক্লিক করলে phase update ফর্ম খুলবে: % complete (0/25/50/75/100 dropdown বা slider), remarks টেক্সট, এবং ফটো আপলোড (multiple files)। সাবমিট করলে PhaseUpdate রেকর্ড তৈরি হবে এবং Phase এর percentComplete/status আপডেট হবে।

ফটো স্টোরেজের জন্য আপাতত local /public/uploads এ সেভ করো (পরে S3/R2 এ migrate করা যাবে) — একটি lib/upload.ts হেল্পার বানাও যাতে পরে সহজে সোর্স বদলানো যায়।
```

---

## Phase 4 — Payment Plan & Accounts Module

```
01_PRD.md এর সেকশন ৫.৩ (Payment Plan & Schedule) পড়ো।

app/accounts এ একটি Payment Plan Builder বানাও: একটি Sale সিলেক্ট করে installment schedule তৈরি করা যাবে — হয় PRD এর স্যাম্পল টেমপ্লেট (Booking 5%, Down payment 15%, Agreement 10%, ২০টি মাসিক কিস্তি প্রতিটি ২.৫%, Handover এ বাকি ১০%) থেকে auto-generate, অথবা ম্যানুয়ালি কাস্টম installment যোগ/এডিট করা যাবে (label, due date, amount)।

একটি Payment Schedule টেবিল component বানাও যা status অনুযায়ী রঙ-কোডেড হবে (Paid=green, Partial=yellow, Overdue=red, Scheduled=gray)। এই component Admin, Accounts, ও Customer সবার প্যানেলে reuse হবে (Customer শুধু দেখবে, এডিট করতে পারবে না)।

app/accounts এ Payment Entry ফর্ম বানাও: একটি Installment সিলেক্ট করে amount received, method (Cash/Bank/bKash/Nagad/Cheque), receipt no লিখে সাবমিট করলে Payment রেকর্ড তৈরি হবে, Installment status আপডেট হবে (partial হলে remaining amount ক্যালকুলেট করবে), এবং একটি প্রিন্টযোগ্য/PDF receipt জেনারেট হবে।

একটি Overdue detection লজিক বানাও (cron বা on-demand query): due date পার হয়ে গেছে কিন্তু status Paid না এমন installment গুলোকে Overdue মার্ক করবে। Accounts ড্যাশবোর্ডে একটি Aging report দেখাও (0-15 days, 16-30 days, 30+ days overdue, মোট amount ও count সহ)।
```

---

## Phase 5 — Customer Portal

```
01_PRD.md এর সেকশন ৫.৪ (Customer Portal) পড়ো।

app/customer এ কাস্টমার ড্যাশবোর্ড বানাও, লগইন করা কাস্টমারের নিজের Sale/Unit ডেটা দেখাবে:
- প্রজেক্ট সামারি কার্ড (project name, location, unit no, size, booking date, total amount)
- PhaseTimeline component (read-only, Phase 3 এ বানানো)
- Payment Schedule টেবিল (read-only, Phase 4 এ বানানো component reuse করো)
- Payment history লিস্ট, প্রতিটি entry এর পাশে "Download Receipt" বাটন (PDF)
- Document list (Document model থেকে, type অনুযায়ী গ্রুপ করা: Booking Form, Sale Agreement, Allotment Letter, Receipts)

সবকিছু মোবাইল-ফার্স্ট রেসপন্সিভ হতে হবে, কারণ কাস্টমাররা মূলত মোবাইল থেকে দেখবে।
```

---

## Phase 6 — Notifications, Reports & Dashboard

```
01_PRD.md এর সেকশন ৫.৬ ও ৫.৭ পড়ো।

lib/notifications.ts এ একটি নোটিফিকেশন হেল্পার বানাও যা Notification মডেলে এন্ট্রি তৈরি করবে এই ইভেন্টগুলোতে:
- Lead এর nextFollowUpAt পার হয়ে গেলে (assigned marketing executive কে)
- Installment due date এর ৭ দিন আগে ও overdue হলে (customer + accounts কে)
- Phase status "DONE" হলে (customer কে)

একটি in-app notification bell/dropdown বানাও header এ (unread count badge সহ), সব role এর layout এ।

Admin dashboard এ (app/admin/dashboard) Recharts দিয়ে ৩টি চার্ট বানাও:
1. Sales Funnel — bar chart, stage-wise lead count (PRD সেকশন ৫.১ এর স্যাম্পল টেবিলের মতো)
2. Project Progress Overview — প্রতিটি active প্রজেক্ট/ইউনিটের average % complete
3. Collected vs Receivable — মাসিক ভিত্তিতে line/bar chart, PRD সেকশন ৫.৩ এর KPI অনুযায়ী

প্রতিটি চার্টের ডেটা Prisma aggregate query দিয়ে নিয়ে আসবে, hardcoded ডেটা নয়।
```

---

## Phase 7 — Polish, Testing & Deployment

```
পুরো অ্যাপে Zod দিয়ে form validation যোগ করো (client + server side)।

prisma/seed.ts বানাও যেখানে টেস্টের জন্য স্যাম্পল ডেটা থাকবে: ৫টা ইউজার (প্রতিটি role এর একজন করে), ১টা Project ৪-৫টা Unit সহ, কয়েকটা Lead বিভিন্ন stage এ, একটা সম্পূর্ণ Sale → PaymentPlan → কিছু Payment paid, কিছু Phase আপডেট।

একটি end-to-end manual test checklist বানাও (markdown ফাইল, TESTING.md): Lead তৈরি → pipeline এ move → Won → Project convert → Payment plan সেট → payment entry → phase update → customer portal এ verify — প্রতিটি ধাপ।

মোবাইল ভিউতে (বিশেষত Engineer ও Customer panel) সব পেজ রেসপন্সিভনেস চেক করো, ছোট স্ক্রিনে ভাঙা লেআউট থাকলে ঠিক করো।

Vercel deployment এর জন্য প্রয়োজনীয় কনফিগারেশন (vercel.json যদি লাগে, build script) ঠিক করো এবং deploy করার স্টেপ-বাই-স্টেপ নির্দেশনা দাও।
```

---

## ব্যবহারের নিয়ম (Reminder)

1. একবারে **একটা prompt** দিন, ফেজ শেষ না হওয়া পর্যন্ত পরেরটা দেবেন না।
2. প্রতিটি ফেজ শেষে ব্রাউজারে টেস্ট করুন, বাগ থাকলে সেটা আলাদা prompt এ ফিক্স করান।
3. প্রতিটি ফেজ কাজ শেষে `git add . && git commit -m "feat: phase X complete"` করুন — যাতে কোনো ফেজে সমস্যা হলে আগের কাজে ফিরে যেতে পারেন।
4. কোনো ফেজের prompt এ Claude Code যদি কনফিউজড হয় বা ভুল দিক যায়, তাহলে সরাসরি PRD/Build Plan এর সেকশন নাম্বার উল্লেখ করে আবার জিজ্ঞেস করুন — এটা অনেক নির্ভুল রেজাল্ট দেয়।
