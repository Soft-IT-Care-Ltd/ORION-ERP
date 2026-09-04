# Orion Builders CRM/ERP — Product Requirements Document (PRD)

**Prepared for:** M.H. Neshad Al Kafian, Orion Builders
**Document version:** 1.0
**Date:** 4 September 2026

---

## ১. এক নজরে (Executive Summary)

Orion Builders (রিয়েল এস্টেট / কনস্ট্রাকশন কোম্পানি) এর জন্য একটি **end-to-end CRM + ERP সিস্টেম**, যা লিড জেনারেশন থেকে শুরু করে প্রজেক্ট ডেলিভারি পর্যন্ত পুরো business cycle একটি সিঙ্গেল প্ল্যাটফর্মে চালাবে।

**Core idea:** একটি লিড → পাইপলাইনে মুভ করবে → সেলস কনভার্ট হলে অটোমেটিক্যালি একটি **Project + Customer + Payment Schedule** তৈরি হবে → প্রজেক্ট তার কনস্ট্রাকশন ফেজ অনুযায়ী এগোবে → কাস্টমার নিজের পোর্টালে payment ও progress দেখতে পাবে।

মোট ৪টি role-based panel:

| Panel | ব্যবহারকারী | মূল কাজ |
|---|---|---|
| **Admin/Management Panel** | Neshad / management | পুরো সিস্টেম কনফিগার, সব ডেটা দেখা, রিপোর্ট, ইউজার/রোল ম্যানেজমেন্ট |
| **Sales/Marketing Panel** | Marketing Executive | লিড অ্যাড, পাইপলাইন ম্যানেজ, ফলো-আপ, কনভার্সন |
| **Engineer/Site Panel** | Site Engineer | ফেজ আপডেট, সাইট ফটো/প্রোগ্রেস আপলোড, ম্যাটেরিয়াল/মাইলস্টোন রিপোর্ট |
| **Customer Panel** | ক্রেতা/গ্রাহক | নিজের প্রজেক্টের progress, payment history, ডকুমেন্ট, ইনভয়েস দেখা |

---

## ২. Business Context

Orion Builders মূলত real estate development / construction business — জমি বা প্রজেক্ট নিয়ে ফ্ল্যাট/প্লট/ভবন তৈরি করে বিক্রি ও ডেলিভারি দেয়। এই ধরনের ব্যবসার জন্য সাধারণ operational চাহিদাগুলো:

- **Lead → Sale funnel**: prospective buyer থেকে booking/agreement পর্যন্ত ট্র্যাকিং
- **Multi-phase construction timeline**: জমি অধিগ্রহণ থেকে হ্যান্ডওভার পর্যন্ত ধাপ-ভিত্তিক অগ্রগতি
- **Installment-based payment plan**: booking money, down payment, monthly/quarterly installment, on-completion payment
- **Multi-stakeholder visibility**: management, sales team, site engineer, এবং customer — প্রত্যেকের আলাদা view দরকার
- **Document-heavy operations**: booking form, sale deed, allotment letter, payment receipt, progress photo

---

## ৩. Goals & Success Metrics

| Goal | Metric (উদাহরণ, ডেটা-ভিত্তিক) |
|---|---|
| লিড লিকেজ কমানো | Lead → Site Visit conversion rate ট্র্যাক (target: বর্তমান ~15-20% থেকে 30%+) |
| সেলস সাইকেল দ্রুত করা | Lead creation থেকে Booking পর্যন্ত average days (target: baseline vs পরবর্তী ৩ মাস তুলনা) |
| Payment collection সময়মতো করা | Overdue installment % (target: <10% accounts 15+ দিন overdue) |
| প্রজেক্ট ডিলে কমানো | Phase-wise planned vs actual completion date variance (দিন হিসেবে) |
| কাস্টমার satisfaction | Customer portal login/engagement rate, complaint resolution TAT |

---

## ৪. User Roles & Permission Matrix

| Module | Admin | Marketing Exec (Sales) | Site Engineer | Accounts/Finance | Customer |
|---|---|---|---|---|---|
| Lead create/edit | ✅ Full | ✅ নিজের লিড | ❌ | ❌ | ❌ |
| সব লিড দেখা | ✅ | ❌ (শুধু assigned) | ❌ | ❌ | ❌ |
| Pipeline stage change | ✅ | ✅ (নিজের) | ❌ | ❌ | ❌ |
| Project তৈরি (lead→project convert) | ✅ | ✅ (approval সহ, optional) | ❌ | ❌ | ❌ |
| Phase/milestone আপডেট | ✅ | ❌ | ✅ (assigned project) | ❌ | ❌ (শুধু দেখা) |
| Payment plan সেট/এডিট | ✅ | ❌ | ❌ | ✅ | ❌ (শুধু দেখা) |
| Payment received entry | ✅ | ❌ | ❌ | ✅ | ❌ |
| ইনভয়েস/রিসিট জেনারেট | ✅ | ❌ | ❌ | ✅ | ✅ (download) |
| ডকুমেন্ট আপলোড/দেখা | ✅ | Lead-related | Site-related | Payment-related | নিজের সব ডকুমেন্ট |
| রিপোর্ট/অ্যানালিটিক্স | ✅ Full | নিজের performance | নিজের site progress | Financial reports | ❌ |
| ইউজার/রোল ম্যানেজমেন্ট | ✅ | ❌ | ❌ | ❌ | ❌ |

> **Note:** RBAC (Role-Based Access Control) database-level এ implement হবে, যাতে ভবিষ্যতে নতুন role (যেমন: Site Supervisor, Legal Officer) সহজে যোগ করা যায়।

---

## ৫. Core Modules — বিস্তারিত

### ৫.১ Lead Management & Sales Pipeline

**Lead source (উদাহরণ):** Facebook Ads, Website form, Walk-in, Referral, Cold call, Property fair/exhibition

**Lead fields (data model):**

| Field | Type | উদাহরণ |
|---|---|---|
| Name | text | মোঃ রফিকুল ইসলাম |
| Phone | text | 01711-XXXXXX |
| Email | text | rafiqul@example.com |
| Source | enum | Facebook Ads |
| Interested Project/Unit | FK | "Orion Green, Khulna — Flat B-4" |
| Budget Range | number | ৳45–55 লাখ |
| Assigned To | FK (user) | Marketing Executive — Sohel |
| Stage | enum | নিচে দেখুন |
| Next Follow-up Date | date | 10 Sep 2026 |
| Notes/Activity log | text[] | timestamped notes |

**Pipeline stages (Kanban-style board):**

```
New Lead → Contacted → Site Visit Scheduled → Site Visit Done
   → Negotiation → Booking (Advance Paid) → Sale Agreement Signed → Won (Converted to Project)
                                                                  ↘ Lost (with reason)
```

**Lost reason (mandatory dropdown):** Price too high, Chose competitor, Location mismatch, Financing issue, No response, Other

**Automation rules (উদাহরণ):**
- ৭ দিন কোনো follow-up না হলে → assigned marketing executive কে reminder notification
- "Won" stage এ move করলে → system automatically একটি **Project + Customer profile + default Payment Schedule** তৈরি করবে (draft mode, admin/accounts কনফার্ম করবে)

**Sales funnel example (ডেটা-উদাহরণ, মাসিক):**

| Stage | Lead Count | Conversion থেকে পরের স্টেজ |
|---|---|---|
| New Lead | 200 | 60% |
| Contacted | 120 | 65% |
| Site Visit Done | 78 | 45% |
| Negotiation | 35 | 40% |
| Booking | 14 | 85% |
| Won (Converted) | 12 | — |

এই ধরনের funnel report Admin dashboard এ মাসিক/quarterly ভিত্তিতে দেখা যাবে।

### ৫.২ Project & Construction Phase Management

প্রতিটি প্রজেক্ট (বা প্রজেক্টের একটি ইউনিট/ফ্ল্যাট) একটি **phase-based timeline** অনুসরণ করবে। Default phase template (customizable):

| # | Phase | Typical Duration (উদাহরণ) | Owner |
|---|---|---|---|
| 1 | Land Acquisition / Approval | 30–60 দিন | Admin/Legal |
| 2 | Design & Municipal Approval (RAJUK/KDA) | 45–90 দিন | Admin |
| 3 | Foundation Work | 30–45 দিন | Site Engineer |
| 4 | Structure (Column/Beam/Slab, floor-by-floor) | 6–12 মাস | Site Engineer |
| 5 | Brick Work & Plaster | 2–3 মাস | Site Engineer |
| 6 | Electrical, Plumbing, Sanitary | 1–2 মাস | Site Engineer |
| 7 | Finishing (Tiles, Paint, Fittings) | 2–3 মাস | Site Engineer |
| 8 | Final Inspection & Handover | 15–30 দিন | Admin + Engineer |

প্রতিটি phase এ থাকবে: **Planned Start/End Date, Actual Start/End Date, % Complete, Site Photos, Remarks, Delay Reason (যদি থাকে)।**

Site Engineer প্যানেল থেকে মোবাইল ব্রাউজারে সরাসরি:
- % complete আপডেট (slider/dropdown: 0/25/50/75/100%)
- সাইট ফটো আপলোড (geo-tagged/timestamp optional)
- Material request / issue log

**Customer এর প্যানেলে** এই একই timeline একটি visual progress bar আকারে দেখাবে (যেমন: "আপনার প্রজেক্ট ৬৫% সম্পন্ন — বর্তমানে Finishing Phase চলছে")।

### ৫.৩ Payment Plan & Schedule

**Payment plan structure (উদাহরণ — ৳50 লাখ ফ্ল্যাটের জন্য):**

| Installment | % | Amount (৳) | Due Date | Status |
|---|---|---|---|---|
| Booking Money | 5% | 2,50,000 | Booking date | Paid |
| Down Payment (30 দিনের মধ্যে) | 15% | 7,50,000 | Booking + 30 days | Paid |
| Sale Agreement Signing | 10% | 5,00,000 | Agreement date | Pending |
| Installment 1–20 (মাসিক) | প্রতিটি 2.5% | 1,25,000 x 20 | Monthly | Scheduled |
| On Handover | 10% (balance) | 5,00,000 | Handover date | Scheduled |

**Payment module features:**
- Custom payment plan template তৈরি (প্রজেক্ট-ভেদে ভিন্ন হতে পারে)
- প্রতিটি installment এ due date, amount, status (Paid/Partial/Overdue/Scheduled)
- Auto-reminder: due date এর 7 দিন আগে ও overdue হলে SMS/Email/WhatsApp notification (customer + accounts কে)
- Payment receive entry (cash/bank/mobile banking — bKash, Nagad উল্লেখসহ) → auto invoice/receipt generate
- Overdue aging report (0-15 days, 16-30, 30+)

**Dashboard KPI (উদাহরণ):**

| Metric | Value (sample) |
|---|---|
| Total Receivable (এই মাসে due) | ৳42,50,000 |
| Collected | ৳38,00,000 (89%) |
| Overdue (15+ দিন) | ৳4,50,000 (7 accounts) |

### ৫.৪ Customer Portal

কাস্টমার লগইন করে দেখবে:
- নিজের প্রজেক্ট/ইউনিটের সারাংশ (location, unit no, size, booking date)
- Construction progress (phase-wise timeline + photo gallery)
- Payment schedule + payment history + downloadable invoice/receipt (PDF)
- ডকুমেন্ট (booking form, allotment letter, sale deed — download)
- সাপোর্ট/কমপ্লেইন্ট রেইজ করার অপশন (ticket system, সহজ version)
- নোটিফিকেশন সেন্টার (payment due, phase milestone reached)

### ৫.৫ Document Management

সব role-এর জন্য centralized document repository — লিড ডকুমেন্ট (NID, ছবি), sale documents, site photos, drawings/blueprints, payment receipts। Access role অনুযায়ী নিয়ন্ত্রিত।

### ৫.৬ Notifications & Reminders

চ্যানেল: In-app + Email + SMS (ভবিষ্যতে WhatsApp — MediaMint/existing ad-related infra এর সাথে integrate করা যেতে পারে)। ইভেন্ট: follow-up due, payment due/overdue, phase milestone completed, document uploaded, new lead assigned।

### ৫.৭ Reporting & Analytics (Admin Dashboard)

- Sales funnel & conversion report (marketing executive-wise performance)
- Project-wise progress vs timeline (Gantt-style view)
- Financial report: total sales value, collected vs receivable, overdue aging
- Lead source ROI (কোন source থেকে বেশি conversion হচ্ছে)

---

## ৬. Data Model (High-level Entities)

```
User (role: admin/marketing/engineer/accounts/customer)
Lead (source, stage, assigned_to, project_interest)
Project (name, location, total_units, phase_template)
Unit (project_id, unit_no, size, price, status: available/booked/sold)
Customer (linked to User, linked to Unit via Sale)
Sale (lead_id, unit_id, customer_id, sale_date, total_amount)
PaymentPlan (sale_id, installments[])
Installment (payment_plan_id, due_date, amount, status)
Payment (installment_id, amount_received, date, method, receipt_no)
Phase (project_id or unit_id, name, order, planned_start, planned_end, actual_start, actual_end, percent_complete)
PhaseUpdate (phase_id, updated_by, date, note, photos[])
Document (owner_type, owner_id, file_url, type, uploaded_by)
Notification (user_id, type, message, read_status)
ActivityLog (entity_type, entity_id, user_id, action, timestamp)
```

(সম্পূর্ণ Prisma schema `03_schema.prisma` ফাইলে দেওয়া আছে — সরাসরি ব্যবহারযোগ্য।)

---

## ৭. Non-Functional Requirements

| ক্যাটাগরি | চাহিদা |
|---|---|
| Security | Role-based access control, password hashing, HTTPS, sensitive doc access log |
| Multi-project support | একাধিক প্রজেক্ট/সাইট একই সিস্টেমে ম্যানেজ করা যাবে (ভবিষ্যতে Elegant Looks-এর multi-branch মডেলের মতো scalable) |
| Audit trail | প্রতিটি critical action (payment entry, stage change, phase update) log হবে — কে, কখন, কী পরিবর্তন করেছে |
| Backup | Daily automated DB backup |
| Performance | Mobile-first responsive UI (site engineer মূলত মোবাইল থেকে ব্যবহার করবে) |
| Localization | বাংলা + English উভয় UI সাপোর্ট (Phase 2 এ Bangla UI যোগ করা যেতে পারে) |
| Offline resilience (future) | সাইটে দুর্বল নেটওয়ার্কে ফর্ম সাবমিট retry/queue (v2 এ বিবেচনা) |

---

## ৮. Assumptions & Open Questions

- প্রাথমিকভাবে single company (Orion Builders) এর জন্য বানানো হচ্ছে; multi-tenant না (ভবিষ্যতে দরকার হলে architecture তা সাপোর্ট করবে)
- Payment collection সিস্টেমের সাথে সরাসরি bKash/Nagad API integration MVP তে নেই — manual entry দিয়ে শুরু, পরে gateway integrate করা যাবে
- SMS/WhatsApp gateway (যেমন: BulkSMSBD, 360dialog — যা আপনার WhatsApp SaAS প্রজেক্টে ব্যবহৃত হচ্ছে) পরবর্তী ফেজে integrate করা যাবে
- একজন engineer একাধিক প্রজেক্টে assign হতে পারবে

---

*পরবর্তী ডকুমেন্ট: `02_BUILD_PLAN.md` — ধাপে ধাপে ডেভেলপমেন্ট প্ল্যান (Claude Code দিয়ে বানানোর জন্য)।*
