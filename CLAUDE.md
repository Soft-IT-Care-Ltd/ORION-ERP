# Orion Builders CRM/ERP — Claude Code Project Instructions

এই ফাইলটি প্রজেক্ট রুটে রাখুন। Claude Code প্রতিটি সেশনে এই ফাইল পড়ে প্রজেক্ট context বুঝবে।

## প্রজেক্ট সারাংশ

Orion Builders (রিয়েল এস্টেট/কনস্ট্রাকশন কোম্পানি) এর জন্য একটি CRM/ERP সিস্টেম — লিড থেকে প্রজেক্ট ডেলিভারি পর্যন্ত পুরো ফ্লো ম্যানেজ করবে। বিস্তারিত: `01_PRD.md`। ডেভেলপমেন্ট প্ল্যান: `02_BUILD_PLAN.md`। DB schema: `03_schema.prisma`।

## Tech Stack

- Next.js 14+ (App Router, TypeScript)
- PostgreSQL + Prisma ORM
- NextAuth.js (role-based auth)
- Tailwind CSS + shadcn/ui
- Recharts (dashboard charts)
- Zod (validation)

## Roles (5 types)

`ADMIN`, `MARKETING` (Sales Executive), `ENGINEER` (Site), `ACCOUNTS`, `CUSTOMER` — প্রতিটির আলাদা route group ও permission (`lib/rbac.ts` দেখুন, PRD সেকশন ৪)।

## কাজ করার নিয়ম

1. **ফেজ-বাই-ফেজ এগোবে** — `02_BUILD_PLAN.md` এ দেওয়া Phase 0 → Phase 7 অর্ডার অনুসরণ করবে। একসাথে সব ফিচার বানানোর চেষ্টা করবে না।
2. প্রতিটি নতুন মডেল/ফিচার বানানোর আগে `03_schema.prisma` এবং `01_PRD.md` এর সংশ্লিষ্ট সেকশন চেক করবে যাতে ডেটা মডেল সামঞ্জস্যপূর্ণ থাকে।
3. Mobile-first responsive UI — বিশেষত Engineer ও Customer প্যানেলে (এরা মূলত মোবাইল ব্রাউজার থেকে ব্যবহার করবে)।
4. প্রতিটি critical action (payment entry, stage change, phase update) `ActivityLog` এ লগ করতে হবে।
5. Prisma migration ছাড়া সরাসরি DB তে পরিবর্তন করবে না — সবসময় `prisma migrate dev` ব্যবহার করবে।
6. UI টেক্সট বাংলা/ইংরেজি মিশ্র রাখা যাবে (labels বাংলায়, technical/system text ইংরেজিতে) — future এ পুরো bilingual টগল যোগ হবে।
7. নতুন ফিচার শেষে সংক্ষিপ্ত টেস্ট (manual বা script) করে তারপর commit করবে।

## Commit convention

`feat(module): description` — যেমন: `feat(pipeline): add kanban drag-drop for lead stages`
