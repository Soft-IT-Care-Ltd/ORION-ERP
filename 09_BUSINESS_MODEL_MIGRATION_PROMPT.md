# Business Model Migration — Phase 2.5 (Claude Code Prompt)

**কেন এই migration লাগছে:** সফটওয়্যার ভুলভাবে Orion Builders কে একজন রিয়েল এস্টেট ডেভেলপার (multi-unit ফ্ল্যাট বিক্রেতা) ধরে বানানো হচ্ছিল। বাস্তবে Orion **শুধু কনস্ট্রাকশন সার্ভিস** দেয় — ক্লায়েন্টের নিজের জমিতে বাড়ি বানিয়ে দেয়, কোনো ফ্ল্যাট/ইউনিট বিক্রি করে না। `01_PRD.md` ও `03_schema.prisma` v2 তে আপডেট হয়ে গেছে — এই prompt টা কোডবেসে সেই পরিবর্তনগুলো প্রয়োগ করবে।

Phase 0, 1, 2 (+ ব্র্যান্ড, প্রবাসী correction) ইতিমধ্যে হয়ে গেছে — Phase 3 শুরু করার **আগে** এই migration চালান।

Claude Code তে এই পুরো prompt টা একসাথে দিন:

```
আমরা business model ভুল বুঝে আগের schema/UI বানিয়েছিলাম — Orion Builders রিয়েল এস্টেট ডেভেলপার না (কোনো ফ্ল্যাট/ইউনিট বিক্রি করে না), এটা একটা কনস্ট্রাকশন সার্ভিস কোম্পানি — ক্লায়েন্টের নিজের জমিতে বাড়ি বানিয়ে দেয়। প্রতিটা "প্রজেক্ট" মানে এক ক্লায়েন্টের একটা কনস্ট্রাকশন জব, কোনো multi-unit ইনভেন্টরি না।

01_PRD.md (v2, পুরোটা পড়ো — বিশেষত সেকশন ২, ৫.১-৫.৭, ৬) এবং 03_schema.prisma (v2) পড়ো। নিচের migration কাজগুলো করো:

## ১. Database Schema Migration

03_schema.prisma (v2) এর সাথে বর্তমান prisma/schema.prisma তুলনা করে migrate করো:
- **সরাও:** Unit মডেল, Sale মডেল, UnitStatus enum — এগুলোর সব রেফারেন্স কোডবেস থেকে সরাও
- **Lead মডেল বদলাও:** LeadStage enum নতুন ভ্যালু (INQUIRY, DISCUSSION, SITE_VISIT_SCHEDULED, SITE_VISIT_DONE, DIGITAL_SURVEY, SOIL_TEST, DESIGN_IN_PROGRESS, DESIGN_APPROVED, QUOTATION_SENT, GOVT_APPROVAL, NEGOTIATION, WON, LOST) — পুরনো enum ভ্যালু (NEW, CONTACTED, BOOKING, SALE_AGREEMENT_SIGNED) মুছে ফেলো, প্রয়োজনে migration এ পুরনো ডেটার stage mapping করো (NEW→INQUIRY, CONTACTED→DISCUSSION, BOOKING→NEGOTIATION, SALE_AGREEMENT_SIGNED→WON — এটা ধরে নিয়ে)
- Lead এ নতুন ফিল্ড যোগ করো: landSize, buildingType (নতুন BuildingType enum)
- **নতুন মডেল:** LeadChecklistItem, LedgerEntry (LedgerType, LedgerCategory enum সহ)
- **Project মডেল rework:** এখন সরাসরি Lead এর সাথে ১:১ (leadId unique FK), Unit-এর বদলে directly title/landLocation/buildingType/floors/totalContractValue/ratePerSqft/startDate/cameraStreamUrl/status ফিল্ড
- PhaseTemplate থেকে projectId সরাও (এখন গ্লোবাল টেমপ্লেট)
- Phase এ unitId এর বদলে projectId
- PaymentPlan এ saleId এর বদলে projectId
- Installment এ ঐচ্ছিক phaseId যোগ করো
- Document এ saleId এর বদলে projectId (ঐচ্ছিক)

`npx prisma migrate dev --name business-model-v2` চালাও। **এটা ডেভেলপমেন্ট ডেটাবেস, তাই ডেটা লস হলেও সমস্যা নেই** — প্রয়োজনে migration reset করে fresh শুরু করতে পারো, শুধু seed.ts (নিচে ৫ নং) পরে আবার ঠিক করে চালিও।

## ২. Lead Pipeline UI আপডেট

app/sales/pipeline এর Kanban board এর column গুলো নতুন stage অনুযায়ী বদলাও (Inquiry → Discussion → Site Visit Scheduled → Site Visit Done → Digital Survey → Soil Test → Design In Progress → Design Approved → Quotation Sent → Govt Approval → Negotiation → Won / Lost)। Digital Survey ও Soil Test stage গুলো "conditional" — board এ থাকবে কিন্তু UI তে একটা ছোট নোট/badge দেখাও "শুধু প্রয়োজন হলে" যাতে ইউজার বুঝতে পারে সব লিডের জন্য বাধ্যতামূলক না, skip করা যায়।

Lead create/edit ফর্মে নতুন ফিল্ড যোগ করো: Land Size (text), Building Type (dropdown: Duplex/1-Story/2-Story/3-Story/4-Story/5+ Story/Other)।

## ৩. Lead Checklist

Lead detail page এ একটা "Checklist" সেকশন/ট্যাব বানাও — LeadChecklistItem এর CRUD: নতুন আইটেম যোগ (label লিখে), টিক দিয়ে Done মার্ক করা (doneBy/doneAt auto সেট হবে), optional note। কয়েকটা কমন আইটেম suggest হিসেবে quick-add বাটনে দাও: "সাইট ভিজিট সম্পন্ন", "জমির দলিলের কপি সংগ্রহ", "সয়েল টেস্ট রিপোর্ট পাওয়া গেছে", "ডিজাইন ক্লায়েন্টকে পাঠানো হয়েছে", "কোটেশন approve হয়েছে" — কিন্তু ইউজার custom আইটেমও লিখতে পারবে।

## ৪. Pre-Project Billing (LedgerEntry) — Lead পর্যায়ে

Lead detail page এ একটা "Billing / Ledger" ট্যাব বানাও (Won হওয়ার আগেও কাজ করবে):
- নতুন LedgerEntry তৈরির ফর্ম: type (Income/Expense), category (Site Visit/Digital Survey/Soil Test/Design/Govt Approval/Other), amount, note
- **শুধু ADMIN ও ACCOUNTS role এই ট্যাব দেখতে/ব্যবহার করতে পারবে** — MARKETING role শুধু existing entries দেখতে পারবে (read-only), তৈরি করতে পারবে না
- type=Income হলে receiptNo auto-generate হবে (ফরম্যাট: `RCT-{yymmdd}-{sequence}`), আর একটা "Send via WhatsApp" বাটন থাকবে যেটা `wa.me/{lead.phone}?text={prefilled receipt summary}` লিংক নতুন ট্যাবে খুলবে (lead.phone থেকে non-digit ক্যারেক্টার strip করে)
- type=Expense হলে clientVisible ফিল্ড সবসময় false — এই ফিল্ডটা ফর্মেই দেখানো হবে না (hardcoded false, UI তে কোনো toggle না)
- একটা সামারি কার্ড দেখাও: মোট billed (income sum), মোট cost (expense sum), net (billed − cost)

## ৫. Lead → Project Conversion (Won)

Lead pipeline এ কোনো lead "Won" stage এ move করলে একটা মোডাল/ফর্ম খুলবে:
- Total Contract Value, Rate per sqft (optional), Total sqft (optional), Start Date ইনপুট
- Confirm করলে: Customer রেকর্ড তৈরি (যদি না থাকে — নতুন User role=CUSTOMER, Lead এর নাম/ফোন থেকে prefill, একটা টেম্পোরারি পাসওয়ার্ড জেনারেট হবে যা Admin কে দেখানো হবে কপি করার জন্য), Project রেকর্ড তৈরি (leadId, customerId, উপরের ইনপুট থেকে ডেটা, title auto-generate "{lead.name} এর {buildingType} — {projectLocation}")
- global PhaseTemplate থেকে কপি করে সেই Project এর জন্য Phase রেকর্ড গুলো অটো তৈরি হবে (order অনুযায়ী, সব status=UPCOMING দিয়ে শুরু)
- Project তৈরি হওয়ার পর Lead detail page থেকে "View Project" লিংক দেখাবে

## ৬. Follow-up ও Performance পেজ (নতুন — এগুলো আগে থেকে nav এ ছিল কিন্তু কাজ করছিল না)

app/sales sidebar এ "ফলো-আপ" ও "পারফরম্যান্স" মেনু আইটেম আগে থেকেই আছে (nav এ P2/P6 badge দেখাচ্ছিল, কিন্তু রুট implement হয়নি) — এখন এই দুইটা পেজ বানাও:

**app/sales/follow-up:**
- লগইন করা marketing executive এর assigned সব Lead যাদের nextFollowUpAt আজকে বা তার আগে (overdue) অথবা আগামী ৭ দিনের মধ্যে — তিনটা গ্রুপে ভাগ করে দেখাও: "আজকে" / "বকেয়া (Overdue)" / "আসছে (৭ দিনের মধ্যে)"
- প্রতিটা কার্ডে: lead name, phone, current stage, last activity note, next follow-up date, আর একটা "Log Follow-up" quick action (একটা নতুন LeadActivity নোট যোগ করে + next follow-up date আপডেট করার ছোট ফর্ম, মোডালে)
- Admin এই পেজে সব marketing executive এর ফলো-আপ ফিল্টার করে দেখতে পারবে (dropdown দিয়ে executive সিলেক্ট)

**app/sales/performance:**
- লগইন করা marketing executive এর personal funnel: stage-wise lead count (bar chart, Recharts) + conversion rate stage থেকে stage
- সামারি কার্ড: মোট assigned lead, এই মাসে নতুন lead, এই মাসে Won, win rate %, average days lead-to-won
- Admin হলে একটা executive selector dropdown থাকবে (সবার পারফরম্যান্স দেখতে পারবে), অন্য role দেখলে শুধু নিজেরটা

Sidebar এ এই দুইটা মেনু আইটেম থেকে "P2"/"P6" badge/label সরিয়ে ফেলো (dev-time placeholder ছিল), এবং ক্লিক করলে এখন সরাসরি এই নতুন পেজে নিয়ে যাবে।

## ৭. Seed ও Testing ডেটা আপডেট

prisma/seed.ts এবং TESTING.md — এই দুইটা ফাইল আগের Sale/Unit মডেল ধরে বানানো হয়েছিল, এখন v2 schema তে আর কাজ করবে না। দুটোই নতুন মডেল অনুযায়ী rewrite করো:
- seed.ts: কয়েকটা Lead বিভিন্ন pre-project stage এ (কিছুতে checklist item ও LedgerEntry সহ), একটা Lead যেটা Won হয়ে Project এ convert হয়ে গেছে (Phase গুলো তৈরি, কিছু PhaseUpdate, একটা PaymentPlan কিছু Installment paid/partial/pending সহ)
- TESTING.md: নতুন pipeline stage অনুযায়ী E2E checklist (Lead তৈরি → checklist/billing → stage move → Won → Project convert → phase update → payment entry → customer portal এ verify, লাইভ ক্যামেরা URL সেট করে customer portal এ embed verify করা)

## যাচাই

কাজ শেষে:
1. migration চালিয়ে, নতুন seed দিয়ে পুরো flow ম্যানুয়ালি টেস্ট করো (একটা lead বানাও → checklist টিক দাও → soil test বিল করো (৳৫,০০০ income) → internal cost দাও (৳৩,৫০০) → Won করো → Project দেখো Phase গুলো অটো তৈরি হয়েছে কিনা)
2. Follow-up ও Performance পেজ দুটো ক্লিক করে কাজ করছে কিনা দেখো
3. customer role দিয়ে লগইন করে নিশ্চিত করো কোনো expense entry বা internal cost কোথাও দেখা যাচ্ছে না
4. lint/build চালাও, কী কী ফাইল বদলেছে/মুছেছে তার একটা সংক্ষিপ্ত লিস্ট দাও
```
