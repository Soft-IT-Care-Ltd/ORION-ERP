# সম্পন্ন হওয়া ফেজের Prompt (ইতিহাস — শুধু রেফারেন্সের জন্য)

> এগুলো ইতিমধ্যে Claude Code দিয়ে সম্পন্ন হয়ে গেছে। এখান থেকে আর কিছু চালানোর দরকার নেই — এই ফাইলটা শুধু "কী prompt দিয়ে কী বানানো হয়েছিল" মনে রাখার জন্য। বাকি থাকা কাজের prompt `04_PROMPTS.md` তে আছে।

---

## Phase 0 — Project Setup ✅

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

## Phase 1 — Auth + RBAC + Base Layout ✅

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

## Phase 2 — Lead Management & Sales Pipeline ✅ (old business model — পরে Phase 2.5 এ migrate হয়েছে)

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

**এরপর প্রবাসী-correction করা হয়েছে** (`07_PHASE2_CORRECTIONS_PROMPT.md`) এবং **ব্র্যান্ড ইন্টিগ্রেশন** (`06_BRAND_INTEGRATION_PROMPT.md`) — দুটোই ✅ সম্পন্ন।

---

## Phase 2.1 — Lead → Project Auto-Conversion ❌ কখনো চালানো হয়নি (DEPRECATED)

এটা Unit/Sale মডেলের উপর ভিত্তি করে লেখা হয়েছিল, business model correction এর পর বাতিল হয়ে গেছে। এর জায়গায় Phase 2.5 (`09_BUSINESS_MODEL_MIGRATION_PROMPT.md`) নতুন Lead→Project conversion লজিক কভার করে।

---

## Phase 7 — Polish, Testing & Deployment ✅ (old business model এ করা হয়েছিল — v2 তে অংশত পুনরায় করা লাগবে)

```
পুরো অ্যাপে Zod দিয়ে form validation যোগ করো (client + server side)।

prisma/seed.ts বানাও যেখানে টেস্টের জন্য স্যাম্পল ডেটা থাকবে: ৫টা ইউজার (প্রতিটি role এর একজন করে), ১টা Project ৪-৫টা Unit সহ, কয়েকটা Lead বিভিন্ন stage এ, একটা সম্পূর্ণ Sale → PaymentPlan → কিছু Payment paid, কিছু Phase আপডেট।

একটি end-to-end manual test checklist বানাও (markdown ফাইল, TESTING.md): Lead তৈরি → pipeline এ move → Won → Project convert → Payment plan সেট → payment entry → phase update → customer portal এ verify — প্রতিটি ধাপ।

মোবাইল ভিউতে (বিশেষত Engineer ও Customer panel) সব পেজ রেসপন্সিভনেস চেক করো, ছোট স্ক্রিনে ভাঙা লেআউট থাকলে ঠিক করো।

Vercel deployment এর জন্য প্রয়োজনীয় কনফিগারেশন (vercel.json যদি লাগে, build script) ঠিক করো এবং deploy করার স্টেপ-বাই-স্টেপ নির্দেশনা দাও।
```

**নোট:** এই prompt টা old (Sale/Unit-based) schema ধরে চালানো হয়েছিল। v2 migration এর পর `seed.ts` ও `TESTING.md` আবার rewrite হবে (`09_BUSINESS_MODEL_MIGRATION_PROMPT.md` এর ৭ নং ধাপ), এবং `04_PROMPTS.md` এর নতুন Phase 7 এ শুধু বাকি থাকা deployment/QA polish কাজ আছে।
