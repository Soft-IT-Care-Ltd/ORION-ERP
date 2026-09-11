# Orion Builders CRM/ERP — বাকি থাকা Claude Code Prompts (শুধু Pending)

> এই ফাইল **শুধু যেসব ফেজ এখনো বাকি** তার prompt রাখে। সম্পন্ন হওয়া ফেজ (0, 1, 2, ব্র্যান্ড, প্রবাসী-correction, পুরনো Phase 7) এখানে আর নেই — সেগুলোর ইতিহাস `history/04_PROMPTS_DONE.md` ফাইলে রাখা আছে (শুধু রেফারেন্সের জন্য, Claude Code কে দেওয়ার দরকার নেই)।

**এখন পর্যন্ত অবস্থা (১০ সেপ্টেম্বর ২০২৬):**

| ফেজ | অবস্থা |
|---|---|
| 0 — Setup | ✅ সম্পন্ন |
| 1 — Auth/RBAC | ✅ সম্পন্ন |
| 2 — Lead/Pipeline (old model) | ✅ সম্পন্ন |
| ব্র্যান্ড ইন্টিগ্রেশন | ✅ সম্পন্ন |
| প্রবাসী correction (phone/local contact/lead docs) | ✅ সম্পন্ন |
| R2 storage migration | ❓ **অনিশ্চিত — আপনি কি এটা চালিয়েছেন?** |
| **2.5 — Business Model Migration** | ⏳ **পরের কাজ, এখনই লাগবে** |
| 3 — Project & Phase Timeline v2 | ⏳ বাকি |
| 4 — Payment Plan & Accounts Ledger v2 | ⏳ বাকি |
| 5 — Customer Portal v2 | ⏳ বাকি |
| 6 — Notifications, Reports & Dashboard v2 | ⏳ বাকি |
| 7 — Polish, Testing & Deployment (v2 rewrite) | ⏳ বাকি (পুরনো Phase 7 হয়েছিল কিন্তু old schema তে — v2 এর seed/testing Phase 2.5 এর prompt এর ৭ নং ধাপেই রিজেনারেট হবে) |

⚠️ **R2 storage migration নিশ্চিত করুন:** `08_R2_STORAGE_MIGRATION.md` চালিয়েছেন কিনা মনে করতে পারছি না — যদি না চালিয়ে থাকেন, Phase 3 এর আগে বা Phase 3 এর prompt এর মধ্যেই (নিচে নোট করা আছে) সেটা করিয়ে নেবেন।

একটার পর একটা ক্রমানুসারে ব্যবহার করুন — একবারে একটার বেশি ফেজের prompt দেবেন না। প্রতিটি ফেজ শেষে টেস্ট করে, git commit করে তারপর পরের prompt দিন।

---

## Phase 2.5 — Business Model Migration ⚠️ প্রথমে এটা করুন

`09_BUSINESS_MODEL_MIGRATION_PROMPT.md` ফাইলে সম্পূর্ণ prompt আছে — Phase 3 শুরু করার আগে এটা চালানো বাধ্যতামূলক (Unit/Sale মডেল সরানো, নতুন pipeline stages, LeadChecklistItem, LedgerEntry, Lead→Project conversion, Follow-up/Performance পেজ — সব একসাথে এই একটা prompt এ আছে)।

---

## Phase 3 — Project & Phase Timeline (v2 — Unit ছাড়া)

```
01_PRD.md এর সেকশন ৫.৪ (Project & Construction Phase Management) পড়ো। 03_schema.prisma (v2) এর Project, PhaseTemplate, Phase মডেল দেখো — Project সরাসরি Lead এর সাথে ১:১ (কোনো Unit নেই, এক ক্লায়েন্ট = এক প্রজেক্ট)।

Admin panel এ (app/admin/projects) Project লিস্ট/detail পেজ বানাও (Project গুলো Lead "Won" হলে তৈরি হয় — Phase 2.5 এ এই conversion লজিক বানানো হয়েছে)। প্রতিটি Project এ:
- সামারি: title, land location, building type, floors, total contract value, rate per sqft, start date
- একটা "Camera Stream URL" ফিল্ড এডিট করার অপশন (লাইভ CC ক্যামেরা — MVP তে শুধু URL সেভ হবে, admin manually বসাবে)

একটা global PhaseTemplate ম্যানেজমেন্ট পেজ বানাও (app/admin/settings/phase-template) — PRD সেকশন ৫.৪ এর ৭টা ডিফল্ট ফেজ (Site Mobilization, Foundation, Structure, Brick Work & Plaster, Electrical/Plumbing, Finishing, Handover) prefill করা থাকবে, edit/reorder করা যাবে। Project তৈরি হওয়ার সময় এই টেমপ্লেট থেকে কপি করে সেই Project এর জন্য Phase রেকর্ড অটো তৈরি হবে।

একটি reusable PhaseTimeline component বানাও (components/phase-timeline) — horizontal stepper/progress bar, প্রতিটি phase এর status, % complete, planned vs actual date। Admin, Engineer, Customer তিন জায়গাতেই ব্যবহার হবে (শুধু Engineer এডিট করতে পারবে)।

app/engineer এ "My Sites" page বানাও যেখানে অ্যাসাইন করা Project এর লিস্ট থাকবে। প্রতিটিতে ক্লিক করলে phase update ফর্ম: % complete (0/25/50/75/100), remarks, ফটো আপলোড (multiple files)। সাবমিট করলে PhaseUpdate রেকর্ড তৈরি হবে।

ফটো স্টোরেজ: `08_R2_STORAGE_MIGRATION.md` অনুযায়ী lib/upload.ts যদি ইতিমধ্যে R2 তে সুইচ করা থাকে সেটা reuse করো, না থাকলে আগে সেটা করে নাও (local disk এ ফটো সেভ করলে Vercel deploy এ কাজ করবে না)।
```

---

## Phase 4 — Payment Plan & Accounts Ledger Module (v2)

```
01_PRD.md এর সেকশন ৫.৫ (Payment Plan) ও ৫.৬ (Accounts & Ledger) পড়ো। 03_schema.prisma (v2) এর PaymentPlan, Installment (phaseId optional), LedgerEntry মডেল দেখো।

১. app/accounts এ Payment Plan Builder বানাও: একটা Project সিলেক্ট করে installment schedule তৈরি — প্রতিটা installment ঐচ্ছিকভাবে একটা Phase এর সাথে লিংক করা যাবে (label, due date, amount, phase)।

২. Payment Schedule টেবিল component (রঙ-কোডেড: Paid=green, Partial=yellow, Overdue=red, Scheduled=gray) — Admin, Accounts, Customer এ reuse হবে।

৩. app/accounts এ Payment Entry ফর্ম (Installment সিলেক্ট, amount, method, receipt no) → Payment রেকর্ড + status আপডেট + PDF receipt + "Send via WhatsApp" বাটন (wa.me deep-link, PRD সেকশন ৫.২ অনুযায়ী)।

৪. Overdue detection (cron/on-demand) + Aging report (0-15/16-30/30+ days)।

৫. **নতুন — Accounts Ledger module:**
   - app/accounts/ledger এ একটা পেজ বানাও যেখানে LedgerEntry তৈরি করা যাবে — type (Income/Expense), category (Site Visit/Digital Survey/Soil Test/Design/Govt Approval/Material Cost/Labor Cost/Office Overhead/Other), amount, note, এবং ঐচ্ছিকভাবে একটা Lead/Client সিলেক্ট করা (leadId — এতে Client-wise ও Company-wide দুই জায়গাতেই লিংক হয়ে যায়, PRD সেকশন ৫.৬ অনুযায়ী)
   - **CRITICAL VALIDATION:** type=EXPENSE হলে clientVisible সবসময় false থাকবে (server-side এ enforce করো, UI validation যথেষ্ট না) — কোনোভাবেই customer role expense entry দেখতে/query করতে পারবে না
   - type=INCOME এবং leadId সেট থাকলে receipt no auto-generate হবে + "Send via WhatsApp" অপশন থাকবে (Payment Entry এর মতোই)
   - Lead/Project detail পেজে একটা "Client Ledger" ট্যাব বানাও — সেই client এর সব LedgerEntry (income+expense) + মোট billed, মোট received, মোট internal cost, net profit/loss সামারি কার্ড
   - Main Accounts ড্যাশবোর্ডে (app/accounts/dashboard) মাসিক Total Income vs Total Expense সামারি (leadId থাকুক বা না থাকুক — সব এন্ট্রি নিয়ে)

কাজ শেষে টেস্ট করো: একটা lead এ একটা "Soil Test" income entry (৳৫,০০০) আর একটা internal cost entry (৳৩,৫০০) দিয়ে — client profile এ net profit ৳১,৫০০ দেখাচ্ছে কিনা, আর customer role দিয়ে লগইন করলে expense entry টা কোথাও দেখা যাচ্ছে না কিনা যাচাই করো।
```

---

## Phase 5 — Customer Portal (v2)

```
01_PRD.md এর সেকশন ৫.৭ (Customer Portal) পড়ো।

app/customer এ কাস্টমার ড্যাশবোর্ড বানাও, লগইন করা কাস্টমারের নিজের Project ডেটা দেখাবে:
- প্রজেক্ট সামারি কার্ড (title, location, building type, floors, start date, total contract value)
- PhaseTimeline component (read-only, Phase 3 এ বানানো)
- **Live Camera সেকশন:** Project.cameraStreamUrl সেট থাকলে embed করে দেখাও (iframe বা HLS player — hls.js লাগলে ব্যবহার করো), না থাকলে "এই মুহূর্তে লাইভ ক্যামেরা সংযুক্ত নেই" মেসেজ
- Payment Schedule টেবিল (read-only, Phase 4 এর component reuse) + pre-project service বিলগুলো (LedgerEntry যেখানে type=INCOME ও clientVisible=true) আলাদা সেকশনে
- Payment history লিস্ট + "Download Receipt" বাটন (PDF) — construction installment ও pre-project বিল দুটোরই
- Document list (Document model থেকে, type অনুযায়ী গ্রুপ করা)

**নিরাপত্তা — বাধ্যতামূলক:** এই সব API route/server action এ query-level এ নিশ্চিত করো যে কোনো LedgerEntry type=EXPENSE কখনো customer session এ রিটার্ন হচ্ছে না, clientVisible=false এমন কোনো income entry ও না। এটা টেস্ট করার জন্য customer লগইন করে network tab/response payload চেক করো।

সবকিছু মোবাইল-ফার্স্ট রেসপন্সিভ হতে হবে।
```

---

## Phase 6 — Notifications, Reports & Dashboard (v2)

```
01_PRD.md এর সেকশন ৫.৯ ও ৫.১০ পড়ো।

lib/notifications.ts এ notification হেল্পার — ইভেন্ট: Lead follow-up due, Installment due/overdue (৭ দিন আগে + overdue হলে), Phase status DONE।

In-app notification bell/dropdown (unread badge) সব role এর layout এ।

Admin dashboard এ (app/admin/dashboard) Recharts দিয়ে চার্ট:
1. Pre-project funnel — stage-wise lead count (PRD সেকশন ৫.১ এর নতুন stage list অনুযায়ী)
2. Project Progress Overview — active প্রজেক্টগুলোর average % complete
3. মাসিক Collected vs Receivable (construction installment)
4. **নতুন — Client-wise Profitability টেবিল:** প্রতিটা client এর total billed, total cost, net margin (Ledger থেকে aggregate), sortable by margin
5. **নতুন — Company Monthly Income vs Expense** (LedgerEntry থেকে, leadId থাকুক না থাকুক সব মিলিয়ে)

প্রতিটি চার্টের ডেটা Prisma aggregate query দিয়ে আনবে।
```

---

## Phase 7 — Polish, Testing & Deployment (v2 rewrite)

> নোট: এই ফেজ আগে একবার (old Sale/Unit মডেল ধরে) হয়েছিল, কিন্তু Phase 2.5 এর migration এ `seed.ts` ও `TESTING.md` ইতিমধ্যে v2-তে rewrite হয়ে যাবে। তাই এখানে যা বাকি থাকে তা মূলত Vercel deployment finalize করা ও শেষ QA pass।

```
পুরো অ্যাপে Zod দিয়ে form validation আছে কিনা রিভিউ করো (client + server side), যেখানে বাদ পড়েছে সেখানে যোগ করো — বিশেষত Phase 2.5-6 এ নতুন যোগ হওয়া ফর্মগুলো (checklist, ledger entry, project convert modal, follow-up log)।

TESTING.md (Phase 2.5 তে rewrite হয়েছে) অনুযায়ী পুরো end-to-end flow ম্যানুয়ালি টেস্ট করো।

মোবাইল ভিউতে (বিশেষত Engineer ও Customer panel) সব পেজ রেসপন্সিভনেস চেক করো, ছোট স্ক্রিনে ভাঙা লেআউট থাকলে ঠিক করো।

Vercel deployment এর জন্য প্রয়োজনীয় কনফিগারেশন (vercel.json, build script, R2 env vars) ঠিক করো এবং deploy করার স্টেপ-বাই-স্টেপ নির্দেশনা দাও।
```

---

## ব্যবহারের নিয়ম (Reminder)

1. একবারে **একটা prompt** দিন, ফেজ শেষ না হওয়া পর্যন্ত পরেরটা দেবেন না।
2. প্রতিটি ফেজ শেষে ব্রাউজারে টেস্ট করুন, বাগ থাকলে সেটা আলাদা prompt এ ফিক্স করান।
3. প্রতিটি ফেজ কাজ শেষে `git add . && git commit -m "feat: phase X complete"` করুন — যাতে কোনো ফেজে সমস্যা হলে আগের কাজে ফিরে যেতে পারেন।
4. কোনো ফেজের prompt এ Claude Code যদি কনফিউজড হয় বা ভুল দিক যায়, তাহলে সরাসরি PRD/Build Plan এর সেকশন নাম্বার উল্লেখ করে আবার জিজ্ঞেস করুন — এটা অনেক নির্ভুল রেজাল্ট দেয়।
