# Orion Builders CRM/ERP — Product Requirements Document (PRD)

**Prepared for:** M.H. Neshad Al Kafian, Orion Builders
**Document version:** 2.0 (business model correction + pre-project pipeline + accounts ledger + live camera)
**Date:** 9 September 2026

---

## ১. এক নজরে (Executive Summary)

Orion Builders একটি **কনস্ট্রাকশন সার্ভিস কোম্পানি** — ক্লায়েন্টের নিজের জমিতে বাড়ি (ডুপ্লেক্স, ১-তলা থেকে ৫+ তলা) নির্মাণ করে দেয়। Orion কোনো ফ্ল্যাট/জমি বিক্রি করে না (ভবিষ্যতে cash flow ভালো হলে land-share/flat-sale মডেলে যাওয়ার পরিকল্পনা আছে, কিন্তু **এখনকার সফটওয়্যার শুধু কনস্ট্রাকশন সার্ভিস মডেলের জন্য**)।

এই CRM/ERP ক্লায়েন্টের প্রথম যোগাযোগ থেকে শুরু করে বাড়ি হস্তান্তর পর্যন্ত পুরো process একটি সিঙ্গেল প্ল্যাটফর্মে চালাবে।

**Core flow:**

```
Lead (ইনকোয়ারি) → Pre-Project Pipeline (সাইট ভিজিট → সার্ভে → সয়েল টেস্ট →
ডিজাইন → অনুমোদন → কোটেশন → গভঃ অনুমোদন) → Won (প্রথম কনস্ট্রাকশন পেমেন্ট পাওয়া)
   → Project তৈরি (ফেজ-ভিত্তিক টাইমলাইন + পেমেন্ট শিডিউল)
   → কনস্ট্রাকশন চলাকালীন সাইট ফটো + লাইভ CC ক্যামেরা
   → হ্যান্ডওভার
```

প্রতিটি ধাপে **client-wise accounting** চলবে (কোন ক্লায়েন্টের জন্য কত খরচ করলাম, কত পেলাম, লাভ/ক্ষতি কত) — এটা Lead পর্যায় থেকেই শুরু হয় (site visit, survey, soil test, design, govt approval এর বিলিং), Project শুরু হওয়ার পরেও চলতে থাকে।

মোট ৫টি role-based panel:

| Panel | ব্যবহারকারী | মূল কাজ |
|---|---|---|
| **Admin/Management Panel** | Neshad / management | পুরো সিস্টেম কনফিগার, সব ডেটা দেখা, রিপোর্ট, ইউজার/রোল ম্যানেজমেন্ট |
| **Sales/Marketing Panel** | Marketing Executive | লিড অ্যাড, প্রি-প্রজেক্ট পাইপলাইন ম্যানেজ, ফলো-আপ, কনভার্সন |
| **Engineer/Site Panel** | Site Engineer | ফেজ আপডেট, সাইট ফটো/প্রোগ্রেস আপলোড |
| **Accounts Panel** | Accounts/Finance | ক্লায়েন্ট-ভিত্তিক ও কোম্পানি-ভিত্তিক লেজার, বিলিং, রিসিট |
| **Customer Panel** | ক্লায়েন্ট | নিজের প্রজেক্টের progress, লাইভ ক্যামেরা, payment history, ডকুমেন্ট |

---

## ২. Business Context (সংশোধিত)

**⚠️ গুরুত্বপূর্ণ সংশোধন:** Orion Builders রিয়েল এস্টেট ডেভেলপার না — কোনো ফ্ল্যাট/ইউনিট "বিক্রির জন্য" ইনভেন্টরি নেই। প্রতিটি ক্লায়েন্টের **নিজস্ব জমি** থাকে, Orion সেই জমিতে তার চাহিদামতো বাড়ি (ডুপ্লেক্স / ১-তলা / ৩-তলা / ৫-তলা ইত্যাদি) **নির্মাণ করে দেওয়ার সার্ভিস** বিক্রি করে — per-sq-ft রেট + সংশ্লিষ্ট খরচ ধরে একটা কনস্ট্রাকশন কন্ট্রাক্ট। (ভবিষ্যতে cash flow ভালো হলে নিজেরা জমি/ফ্ল্যাট কিনে বিক্রি বা land-share মডেলে যাওয়ার পরিকল্পনা আছে — কিন্তু এটা আলাদা ভবিষ্যৎ ফেজ, বর্তমান সফটওয়্যারে এই মডেল বিল্ড হচ্ছে না)।

তাই প্রতিটি "প্রজেক্ট" মানে **একজন নির্দিষ্ট ক্লায়েন্টের একটা কনস্ট্রাকশন জব** — কোনো multi-unit ইনভেন্টরি না, এক ক্লায়েন্ট = এক প্রজেক্ট।

**সাধারণ operational চাহিদা:**

- **Lead → Won funnel**: ইনকোয়ারি থেকে শুরু করে কন্ট্রাক্ট সাইন/প্রথম কনস্ট্রাকশন পেমেন্ট পর্যন্ত — মাঝে অনেকগুলো ধাপ (সাইট ভিজিট, সার্ভে, সয়েল টেস্ট, ডিজাইন, অনুমোদন, কোটেশন, গভঃ পারমিশন) — প্রতিটাই আলাদা করে ট্র্যাক ও বিল করা লাগে
- **Pre-project billing**: Won হওয়ার আগেই কিছু সার্ভিসের জন্য (সয়েল টেস্ট, ডিজাইন, গভঃ অনুমোদন) ক্লায়েন্ট থেকে চার্জ নেওয়া হয় — এগুলো client-wise ও company-wide দুই জায়গাতেই হিসাবে থাকা লাগবে
- **Client-wise profit/loss**: প্রতিটা ক্লায়েন্টের জন্য কত খরচ হলো (internal cost, ক্লায়েন্ট দেখবে না) বনাম কত টাকা নেওয়া হলো (client-facing bill) — এর থেকে লাভ/ক্ষতি
- **Multi-phase construction timeline**: ফাউন্ডেশন থেকে হ্যান্ডওভার পর্যন্ত ধাপ-ভিত্তিক অগ্রগতি, প্রতি ফেজের সাথে পেমেন্ট ও তারিখ বাঁধা
- **Live site visibility**: সাইট ফটো আপডেট + ভবিষ্যতে লাইভ CC ক্যামেরা ফিড ক্লায়েন্ট পোর্টালে
- **Multi-stakeholder visibility**: management, sales, site engineer, accounts, customer — প্রত্যেকের আলাদা view
- **Document-heavy operations**: ফ্লোর প্ল্যান, ৩D ডিজাইন, প্রপোজাল, জমির দলিল, কন্ট্রাক্ট, গভঃ অনুমোদন কপি, রিসিট

---

## ৩. Goals & Success Metrics

| Goal | Metric (উদাহরণ, ডেটা-ভিত্তিক) |
|---|---|
| লিড লিকেজ কমানো | Lead → Site Visit conversion rate ট্র্যাক (target: বর্তমান ~15-20% থেকে 30%+) |
| সেলস সাইকেল দ্রুত করা | Lead creation থেকে Won (প্রথম পেমেন্ট) পর্যন্ত average days |
| Pre-project stage bottleneck চেনা | কোন stage এ (সয়েল টেস্ট/ডিজাইন approval/কোটেশন) সবচেয়ে বেশি সময় লাগছে/লিড আটকে থাকছে |
| Payment collection সময়মতো করা | Overdue installment % (target: <10% accounts 15+ দিন overdue) |
| প্রজেক্ট ডিলে কমানো | Phase-wise planned vs actual completion date variance (দিন হিসেবে) |
| Client-wise profitability | প্রতি ক্লায়েন্টের actual margin % (billed − internal cost) ট্র্যাক |
| কাস্টমার satisfaction | Customer portal login/engagement rate, লাইভ ক্যামেরা ব্যবহারের হার |

---

## ৪. User Roles & Permission Matrix

| Module | Admin | Marketing Exec (Sales) | Site Engineer | Accounts/Finance | Customer |
|---|---|---|---|---|---|
| Lead create/edit | ✅ Full | ✅ নিজের লিড | ❌ | ❌ | ❌ |
| সব লিড দেখা | ✅ | ❌ (শুধু assigned) | ❌ | ❌ | ❌ |
| Pipeline stage change | ✅ | ✅ (নিজের) | ❌ | ❌ | ❌ |
| Pre-project service billing (site visit/survey/soil test/design/govt approval) | ✅ | ❌ (শুধু অনুরোধ করতে পারবে) | ❌ | ✅ | ❌ |
| Lead/Client cost এন্ট্রি (internal, client-invisible) | ✅ | ❌ | ❌ | ✅ | ❌ |
| Project তৈরি (Lead→Project convert) | ✅ | ✅ (approval সহ, optional) | ❌ | ❌ | ❌ |
| Phase/milestone আপডেট | ✅ | ❌ | ✅ (assigned project) | ❌ | ❌ (শুধু দেখা) |
| Live camera URL সেট | ✅ | ❌ | ❌ | ❌ | ❌ (শুধু দেখা) |
| Payment plan সেট/এডিট | ✅ | ❌ | ❌ | ✅ | ❌ (শুধু দেখা) |
| Payment received entry | ✅ | ❌ | ❌ | ✅ | ❌ |
| ইনভয়েস/রিসিট জেনারেট + WhatsApp সেন্ড | ✅ | ❌ | ❌ | ✅ | ✅ (download only) |
| Main Accounts / Company Ledger | ✅ Full | ❌ | ❌ | ✅ Full | ❌ |
| Client-wise profit/loss রিপোর্ট | ✅ | ❌ | ❌ | ✅ | ❌ (কখনোই cost দেখবে না) |
| ডকুমেন্ট আপলোড/দেখা | ✅ | Lead-related | Site-related | Billing-related | নিজের সব ডকুমেন্ট (cost বাদে) |
| রিপোর্ট/অ্যানালিটিক্স | ✅ Full | নিজের performance | নিজের site progress | Financial reports | ❌ |
| ইউজার/রোল ম্যানেজমেন্ট | ✅ | ❌ | ❌ | ❌ | ❌ |

> **নিরাপত্তা নীতি (গুরুত্বপূর্ণ):** internal cost/expense কখনোই customer role এর কোনো API/UI তে expose হবে না — client শুধু তাকে দেওয়া বিল (income entries) ও রিসিট দেখবে, কখনো Orion এর খরচ না। এটা backend এ query-level এ enforce করতে হবে (শুধু UI hide না)।

> **Note:** RBAC (Role-Based Access Control) database-level এ implement হবে।

---

## ৫. Core Modules — বিস্তারিত

### ৫.১ Lead Management & Pre-Project Pipeline

**Lead source (উদাহরণ):** Facebook Ads, Website form, Walk-in, Referral, Cold call, Property fair/exhibition

**Lead fields (data model):**

| Field | Type | উদাহরণ |
|---|---|---|
| Name | text | মোঃ রফিকুল ইসলাম |
| Phone (country code সহ) | text | +971-50-XXXXXXX |
| Residence Country | enum/text | UAE |
| Email | text | rafiqul@example.com |
| Source | enum | Facebook Ads |
| Project/Land Location | text | "সোনাডাঙ্গা, খুলনা — নিজস্ব জমি" |
| Land Size | text/number | ৪ কাঠা |
| Building Type | enum | Duplex / 1-Story / 2-Story / 3-Story / 4-Story / 5+ Story / Other |
| Estimated Budget Range | number | ৳45–55 লাখ |
| Assigned To | FK (user) | Marketing Executive — Sohel |
| Stage | enum | নিচে দেখুন |
| Next Follow-up Date | date | 10 Sep 2026 |
| Notes/Activity log | text[] | timestamped notes |
| Local Contact Name/Phone/Relation | text | প্রবাসী ক্লায়েন্টের বাংলাদেশে থাকা যোগাযোগের ব্যক্তি |

**Pipeline stages (Kanban-style board) — কনস্ট্রাকশন সার্ভিসের বাস্তব ওয়ার্কফ্লো অনুযায়ী:**

```
Inquiry (নতুন ইনকোয়ারি)
   → Discussion (কথা চলছে, প্রাথমিক আলোচনা)
   → Site Visit Scheduled → Site Visit Done
   → Digital Survey (বড় জমি হলে — conditional)
   → Soil Test (বহুতল ভবন হলে — conditional, বিলযোগ্য)
   → Design In Progress
   → Design Approved (ক্লায়েন্ট অনুমোদন দিয়েছে)
   → Quotation Sent (per-sq-ft রেট + costing পাঠানো হয়েছে)
   → Govt Approval (RAJUK/City Corporation/Pourashava — conditional, বিলযোগ্য)
   → Negotiation
   → Won (কন্ট্রাক্ট সাইন + প্রথম কনস্ট্রাকশন পেমেন্ট পাওয়া গেছে → Project তৈরি হবে)
                                                              ↘ Lost (যেকোনো stage থেকে, reason সহ)
```

> **নোট:** সব ক্লায়েন্টের জন্য সব stage প্রযোজ্য নাও হতে পারে (ছোট জমি হলে Digital Survey লাগবে না, ১-তলা হলে Soil Test নাও লাগতে পারে) — তাই stage flow strictly linear না, টিম প্রয়োজন অনুযায়ী skip করতে পারবে, কিন্তু বোর্ডে stage-এর ক্রম উপরের অর্ডার অনুযায়ী দেখানো হবে।

**Checklist / Task tracking (প্রতিটি লিডের সাথে):**

প্রতিটি লিডের ভেতরে একটা checklist থাকবে — কোন কাজ শেষ হয়েছে, কোনটা বাকি, এবং কোন ডকুমেন্ট ক্লায়েন্ট থেকে নেওয়া হয়েছে/আরও কী নেওয়া লাগবে। প্রতিটি checklist item এ: লেবেল (text), status (Pending/Done), optional note, done by + done at।

উদাহরণ আইটেম: "সাইট ভিজিট সম্পন্ন", "জমির দলিলের কপি সংগ্রহ", "সয়েল টেস্ট রিপোর্ট পাওয়া গেছে", "ডিজাইন ক্লায়েন্টকে পাঠানো হয়েছে", "কোটেশন approve হয়েছে" — এগুলো টিম নিজেরাই যোগ/টিক করতে পারবে (fixed list না, flexible)।

**Lead Documents (ফাইল আপলোড):**

প্রতিটি লিডের সাথে একাধিক ফাইল — Floor Plan, 3D Design/Render, Proposal, Land Document, বা অন্য যেকোনো নথি। প্রতিটির সাথে টাইপ/লেবেল।

| Field | Type | উদাহরণ |
|---|---|---|
| File | upload | floor-plan-v1.pdf |
| File Type | enum | Floor Plan / 3D Design / Proposal / Land Document / Other |
| Description | text (optional) | "৩ বেড ফ্লোর প্ল্যান, প্রথম ড্রাফট" |
| Uploaded By | FK (user) | Marketing Executive — Sohel |

**Lost reason (mandatory dropdown):** Price too high, Chose competitor, Location mismatch, Financing issue, No response, Other

**Automation rules:**
- ৭ দিন কোনো follow-up না হলে → assigned marketing executive কে reminder notification
- "Won" stage এ move করলে → Project তৈরি করার ফর্ম খুলবে (নিচে ৫.৩ দেখুন)

**Sales funnel example (ডেটা-উদাহরণ, মাসিক):**

| Stage | Lead Count | পরের স্টেজে conversion |
|---|---|---|
| Inquiry | 200 | 60% |
| Site Visit Done | 120 | 55% |
| Design Approved | 66 | 50% |
| Quotation Sent | 33 | 45% |
| Won | 15 | — |

### ৫.২ Pre-Project Services & Client Billing (Won হওয়ার আগে)

Lead এখনো "Project" না হলেও, কিছু সার্ভিসের জন্য ক্লায়েন্ট থেকে টাকা নেওয়া হয় — এগুলো লিডের সাথেই client-wise হিসাবে থাকবে।

**সার্ভিস টাইপ ও সাধারণ বিলিং নীতি (এডজাস্টেবল, ডিফল্ট না বাধ্যতামূলক):**

| Service | ডিফল্ট | নোট |
|---|---|---|
| Site Visit | সাধারণত Free | মাঝেমধ্যে বিল করা যায় (দূরবর্তী স্থান হলে) |
| Digital Survey | সাধারণত Free | বড় জমির ক্ষেত্রে মাঝেমধ্যে বিল করা যায় |
| Soil Test | চার্জযোগ্য | বহুতল ভবনে বাধ্যতামূলক |
| Design | চার্জযোগ্য | |
| Govt Approval (RAJUK/City Corp/Pourashava) | চার্জযোগ্য | |
| Other | কেস-বাই-কেস | |

**প্রতিটি বিলিং এন্ট্রিতে:**
- Service type, amount charged (client কে যা বিল করা হলো), তারিখ, রিসিট নম্বর (auto-generate)
- রিসিট PDF জেনারেট হবে এবং **"Send via WhatsApp"** বাটনে ক্লিক করলে (MVP: `wa.me` deep-link দিয়ে prefilled মেসেজ + ম্যানুয়ালি রিসিট অ্যাটাচ — পরে ফেজে চাইলে 360dialog WhatsApp Business API দিয়ে সরাসরি auto-send integrate করা যাবে)

**প্রতিটি ইন্টারনাল cost এন্ট্রি (client দেখবে না):**
- একই সার্ভিসের বিপরীতে Orion এর প্রকৃত খরচ (যেমন সয়েল টেস্ট ভেন্ডরকে দেওয়া টাকা) — এটা শুধু Admin/Accounts দেখবে

এই দুই ধরনের এন্ট্রি (client-facing income + internal cost) মিলিয়ে প্রতিটি Lead/Client এর জন্য একটা **profit/loss summary** তৈরি হবে — লিড এখনো Won না হলেও।

### ৫.৩ Lead → Project Conversion (Won)

Lead "Won" হয় যখন ক্লায়েন্টের সাথে কন্ট্রাক্ট সাইন হয় এবং কনস্ট্রাকশনের প্রথম পেমেন্ট (সাইনআপ মানি) পাওয়া যায় — তখনই একটা **Project** তৈরি হয়।

Project তৈরির ফর্মে থাকবে:
- Total Contract Value, Rate per sq ft, Total sq ft, Start Date
- Customer profile তৈরি/লিংক (Lead এর তথ্য থেকে prefill)
- Default Phase template থেকে Phase গুলো তৈরি হবে (নিচে ৫.৪)
- Payment Plan/Installment শিডিউল সেট করা যাবে (৫.৫)

Project তৈরি হওয়ার পর থেকে Lead এর সব আগের হিসাব (pre-project billing, cost) এবং নতুন Project এর হিসাব — সব একই ক্লায়েন্টের প্রোফাইলে (leadId ধরে) একসাথে দেখা যাবে।

### ৫.৪ Project & Construction Phase Management

Project তৈরি হওয়ার পর একটা **phase-based timeline** অনুসরণ করবে। যেহেতু জমি অধিগ্রহণ/ডিজাইন/গভঃ অনুমোদন এখন Pre-Project Pipeline এ হয়ে যায় (৫.১-৫.৩), Project এর ফেজ শুরু হয় নির্মাণ কাজ থেকে:

| # | Phase | Typical Duration (উদাহরণ) | Owner |
|---|---|---|---|
| 1 | Site Mobilization / Set-up | ৫–১০ দিন | Site Engineer |
| 2 | Foundation Work | ৩০–৪৫ দিন | Site Engineer |
| 3 | Structure (Column/Beam/Slab, floor-by-floor) | ৬–১২ মাস (তলা সংখ্যা অনুযায়ী) | Site Engineer |
| 4 | Brick Work & Plaster | ২–৩ মাস | Site Engineer |
| 5 | Electrical, Plumbing, Sanitary | ১–২ মাস | Site Engineer |
| 6 | Finishing (Tiles, Paint, Fittings) | ২–৩ মাস | Site Engineer |
| 7 | Final Inspection & Handover | ১৫–৩০ দিন | Admin + Engineer |

প্রতিটি phase এ: **Planned Start/End Date, Actual Start/End Date, % Complete, Site Photos, Remarks, Delay Reason, এবং ঐ ফেজে বাঁধা Payment Amount (যদি থাকে)।**

Site Engineer প্যানেল থেকে মোবাইল ব্রাউজারে সরাসরি: % complete আপডেট, সাইট ফটো আপলোড, Material request/issue log।

**Live CC Camera (নতুন ফিচার):** প্রতিটি Project এ একটা Camera Stream URL ফিল্ড থাকবে (Admin সেট করবে — ভেন্ডরের শেয়ার লিংক বা HLS/RTMP স্ট্রিম URL)। Customer পোর্টালে এই লাইভ ফিড embed করে দেখানো হবে (MVP: iframe embed বা HLS player — hardware/camera vendor integration এই সফটওয়্যারের স্কোপের বাইরে, শুধু admin manually stream URL বসাবে)।

**Customer এর প্যানেলে:** phase timeline visual progress bar + সাইট ফটো গ্যালারি + লাইভ ক্যামেরা (যদি URL সেট করা থাকে)।

### ৫.৫ Payment Plan & Schedule (Project-ভিত্তিক)

**Payment plan structure (উদাহরণ — একটা ৩-তলা বাড়ির কনস্ট্রাকশন কন্ট্রাক্টের জন্য):**

| Installment | ফেজ | Amount (৳) | Due Date | Status |
|---|---|---|---|---|
| Signup Money (কন্ট্রাক্ট সাইনিং) | — | ৫,০০,০০০ | সাইনিং তারিখ | Paid |
| Foundation Complete | Foundation Work | ৮,০০,০০০ | ফেজ শুরুর ৪৫ দিন পর | Pending |
| 1st Floor Structure | Structure | ৬,০০,০০০ | | Scheduled |
| 2nd Floor Structure | Structure | ৬,০০,০০০ | | Scheduled |
| Brick & Plaster Complete | Brick Work & Plaster | ৫,০০,০০০ | | Scheduled |
| Electrical/Plumbing Complete | Electrical, Plumbing | ৪,০০,০০০ | | Scheduled |
| Finishing 50% | Finishing | ৫,০০,০০০ | | Scheduled |
| On Handover | Handover | ৩,০০,০০০ (বাকি) | | Scheduled |

প্রতিটি Installment ঐচ্ছিকভাবে একটা নির্দিষ্ট Phase এর সাথে লিংক করা যাবে (যাতে "এই ফেজ শেষ হলে এত টাকা দিতে হবে" — timeline এ একসাথে দেখা যায়)।

**Payment module features:**
- Custom payment plan তৈরি (প্রজেক্ট-ভেদে ভিন্ন হতে পারে, phase-linked)
- প্রতিটি installment এ due date, amount, status (Paid/Partial/Overdue/Scheduled)
- Auto-reminder: due date এর 7 দিন আগে ও overdue হলে notification
- Payment receive entry (Cash/Bank/bKash/Nagad/Cheque) → auto invoice/receipt generate + WhatsApp send অপশন
- Overdue aging report (0-15 days, 16-30, 30+)

### ৫.৬ Accounts & Ledger (নতুন মডিউল)

দুই স্তরে হিসাব:

**১. Client-wise Ledger** — প্রতিটি ক্লায়েন্টের (Lead থেকে শুরু করে, Project হয়ে গেলেও একই লিংকে) জন্য:
   - Income entries: pre-project service বিল (৫.২) + construction installment payments (৫.৫) — সব ক্লায়েন্টকে দেখানো হবে (তার পোর্টালে)
   - Expense/Cost entries: Orion এর ইন্টারনাল খরচ (ভেন্ডর পেমেন্ট, ম্যাটেরিয়াল কস্ট ইত্যাদি) — **ক্লায়েন্ট কখনো দেখবে না**, শুধু Admin/Accounts
   - Client profile page এ: মোট billed, মোট received, মোট internal cost, net profit/loss — এক নজরে

**২. Main Company Ledger** — Orion Builders এর সামগ্রিক হিসাব:
   - দৈনিক/মাসিক income ও expense এন্ট্রি — Accounts প্যানেল থেকে সরাসরি ইনপুট করা যাবে
   - প্রতিটি এন্ট্রি ঐচ্ছিকভাবে একটা Client/Project এ ট্যাগ করা যাবে — ট্যাগ করলে সেটা ক্লায়েন্টের প্রোফাইলেও (যদি expense হয়, শুধু internal রিপোর্টে) এবং Main Ledger এও দেখাবে
   - ট্যাগ ছাড়া entries (office rent, salary, ইত্যাদি general overhead) শুধু Main Ledger এ থাকবে, কোনো ক্লায়েন্টের সাথে যুক্ত না
   - মাসিক সামারি: Total Income, Total Expense, Net — ড্যাশবোর্ডে চার্ট আকারে

**ডেটা মডেল ধারণা:** একটাই `LedgerEntry` টেবিল ব্যবহার হবে দুই কাজের জন্যই (leadId ঐচ্ছিক — সেট থাকলে client-linked, না থাকলে general company entry), সাথে `type` (INCOME/EXPENSE) এবং `clientVisible` ফ্ল্যাগ (customer পোর্টালে দেখানোর জন্য — expense এন্ট্রিতে এটা সবসময় false থাকবে, কোনোভাবেই override করা যাবে না)।

### ৫.৭ Customer Portal

কাস্টমার লগইন করে দেখবে:
- নিজের প্রজেক্টের সামারি (location, building type, floors, start date, total contract value)
- Construction progress (phase-wise timeline + photo gallery)
- **Live CC camera feed** (যদি সেট করা থাকে)
- Payment schedule + payment history + downloadable invoice/receipt (PDF) — pre-project বিল ও construction installment দুটোই
- ডকুমেন্ট (প্রপোজাল, কন্ট্রাক্ট, গভঃ অনুমোদন কপি, রিসিট — download)
- সাপোর্ট/কমপ্লেইন্ট রেইজ করার অপশন
- নোটিফিকেশন সেন্টার (payment due, phase milestone reached)

> কখনোই client এর কোনো ভিউতে Orion এর internal cost/expense/profit margin দেখানো হবে না।

### ৫.৮ Document Management

সব role-এর জন্য centralized document repository — লিড ডকুমেন্ট, কন্ট্রাক্ট, সাইট ফটো, ড্রয়িং/ব্লুপ্রিন্ট, পেমেন্ট রিসিট। Access role অনুযায়ী নিয়ন্ত্রিত। Document type: Floor Plan, 3D Design, Proposal, Land Document, Contract, Govt Approval Copy, Receipt, Handover Certificate, Other।

### ৫.৯ Notifications & Reminders

চ্যানেল: In-app + Email + WhatsApp (রিসিটের জন্য `wa.me` deep-link MVP তে, পরে 360dialog API দিয়ে auto-send)। ইভেন্ট: follow-up due, payment due/overdue, phase milestone completed, document uploaded, new lead assigned।

### ৫.১০ Reporting & Analytics (Admin Dashboard)

- Pre-project funnel & conversion report (stage-wise, marketing executive-wise)
- Project-wise progress vs timeline
- Financial report: total billed, collected vs receivable, overdue aging
- **Client-wise profitability report** (billed − cost = margin, sortable)
- Company-wide monthly income/expense summary
- Lead source ROI

---

## ৬. Data Model (High-level Entities — সংশোধিত)

```
User (role: admin/marketing/engineer/accounts/customer)
Lead (source, stage, assigned_to, land_location, building_type, floors, local_contact)
LeadChecklistItem (lead_id, label, status, note)
LeadDocument (lead_id, file_url, file_type, description)
LedgerEntry (lead_id [nullable], type: INCOME/EXPENSE, category, amount, date, receipt_no,
             whatsapp_sent_at, client_visible, created_by)
   — ব্যবহার হয়: pre-project billing (income), internal cost (expense),
     এবং company-wide general entries (leadId null)
Customer (linked to User, linked to Project)
Project (lead_id [unique], customer_id, total_contract_value, rate_per_sqft, start_date,
         camera_stream_url, status)
PaymentPlan (project_id, installments[])
Installment (payment_plan_id, phase_id [optional], due_date, amount, status)
Payment (installment_id, amount_received, date, method, receipt_no)
Phase (project_id, name, order, planned_start, planned_end, actual_start, actual_end, percent_complete)
PhaseUpdate (phase_id, updated_by, date, note, photos[])
Document (project_id [optional], type, file_url, uploaded_by)
Notification (user_id, type, message, read_status)
ActivityLog (entity_type, entity_id, user_id, action, timestamp)
```

> **বড় পরিবর্তন:** আগের ভার্সনে ছিল multi-unit "Project → Unit[] → Sale" (রিয়েল এস্টেট ডেভেলপার মডেল) — এটা সরিয়ে সরাসরি "Lead → Project" (এক ক্লায়েন্ট = এক কনস্ট্রাকশন জব) মডেলে আনা হয়েছে। সম্পূর্ণ Prisma schema `03_schema.prisma` তে (v2)।

---

## ৭. Non-Functional Requirements

| ক্যাটাগরি | চাহিদা |
|---|---|
| Security | RBAC, password hashing, HTTPS, **client কখনো internal cost/expense দেখবে না (query-level enforced)** |
| Audit trail | প্রতিটি critical action (payment entry, stage change, phase update, ledger entry) log হবে |
| Backup | Daily automated DB backup |
| Performance | Mobile-first responsive UI (site engineer ও customer মূলত মোবাইল থেকে ব্যবহার করবে) |
| Localization | বাংলা + English উভয় UI সাপোর্ট |
| File storage | Cloud storage (Cloudflare R2) — Vercel serverless এ local disk write সম্ভব না (দেখুন `08_R2_STORAGE_MIGRATION.md`) |
| Live camera | Software শুধু stream URL embed করবে — camera hardware/vendor integration স্কোপের বাইরে |

---

## ৮. Assumptions & Open Questions

- প্রাথমিকভাবে single company (Orion Builders), multi-tenant না
- Payment collection এ সরাসরি bKash/Nagad API integration MVP তে নেই — manual entry
- WhatsApp রিসিট MVP তে `wa.me` deep-link (ম্যানুয়াল অ্যাটাচ) — auto-send (360dialog API) ভবিষ্যৎ ফেজে
- একজন engineer একাধিক প্রজেক্টে assign হতে পারবে
- ভবিষ্যতে land-share/flat-sale মডেল যোগ হলে এই স্কিমার উপর আলাদা মডিউল হিসেবে যোগ হবে, বর্তমান কনস্ট্রাকশন-সার্ভিস মডেল ভাঙবে না

---

*পরবর্তী ডকুমেন্ট: `02_BUILD_PLAN.md` (v2 অনুযায়ী আপডেট হবে) ও `09_BUSINESS_MODEL_MIGRATION_PROMPT.md` — এখন যা Claude Code তে চালাতে হবে।*
