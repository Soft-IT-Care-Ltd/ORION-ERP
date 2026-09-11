# File Storage Migration — Local থেকে Cloudflare R2

Vercel এ deploy করলে serverless filesystem read-only, তাই `lib/upload.ts` এর বর্তমান local-disk সেভ কাজ করবে না। এই ডকুমেন্ট দুই ধাপে: (ক) আপনি নিজে Cloudflare R2 সেটআপ করবেন, (খ) Claude Code কে prompt দিয়ে কোড সুইচ করাবেন।

---

## ধাপ ১ — Cloudflare R2 সেটআপ (আপনি নিজে করবেন, ~১০ মিনিট)

১. [dash.cloudflare.com](https://dash.cloudflare.com) এ ফ্রি একাউন্ট খুলুন (বা আগে থেকে থাকলে লগইন করুন)।

২. বাম মেনু থেকে **R2 Object Storage** এ যান → "Create bucket" → নাম দিন: `orion-erp-files` (region: Automatic রাখুন)।

৩. বাকেট তৈরির পর **Settings** ট্যাবে গিয়ে "Public access" থেকে একটা public development URL চালু করুন, অথবা custom domain কানেক্ট করুন (যেমন `files.orionbuildersbd.com`) — যেটা সহজ মনে হয় প্রথমে development URL দিয়ে শুরু করতে পারেন, পরে বদলানো যাবে।

৪. R2 এর ড্যাশবোর্ডে ডানপাশে **"Manage R2 API Tokens"** → "Create API Token" → Permission: **Object Read & Write**, শুধু `orion-erp-files` বাকেটে সীমিত করুন → Create করলে ৩টা জিনিস পাবেন, সেভ করে রাখুন:
   - `Access Key ID`
   - `Secret Access Key`
   - `Account ID` (এটা R2 ড্যাশবোর্ডের ডানপাশে/URL এ পাওয়া যাবে)

৫. এই তথ্যগুলো দিয়ে `.env` এ (এবং Vercel এর Environment Variables এ, deploy এর সময়) যোগ করুন:
```
R2_ACCOUNT_ID=xxxxxxxxxxxx
R2_ACCESS_KEY_ID=xxxxxxxxxxxx
R2_SECRET_ACCESS_KEY=xxxxxxxxxxxx
R2_BUCKET_NAME=orion-erp-files
R2_PUBLIC_URL=https://pub-xxxxxxxx.r2.dev
```
(শেষ ভ্যারিয়েবলটা ধাপ ৩ থেকে পাওয়া public URL)

খরচ নিয়ে চিন্তা করার দরকার নেই আপাতত — R2 এর ফ্রি টায়ারে মাসে ১০GB storage + সব egress ফ্রি, একটা CRM এর ফ্লোর প্ল্যান/ছবির জন্য অনেকদিন যথেষ্ট হবে।

---

## ধাপ ২ — Claude Code Prompt (কোড সুইচ করার জন্য)

উপরের ৫টা env variable `.env` এ বসিয়ে রাখার পর Claude Code তে এই prompt দিন:

```
আমরা Vercel এ deploy করবো, তাই lib/upload.ts এর local disk storage (public/uploads/) কে Cloudflare R2 তে সুইচ করতে হবে — Vercel এর serverless filesystem read-only, তাই local write কাজ করবে না।

.env এ এই ৫টা variable যোগ করা আছে: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL। এগুলো .env.example এও (আসল ভ্যালু ছাড়া, শুধু placeholder) যোগ করো।

করণীয়:

1. @aws-sdk/client-s3 প্যাকেজ ইনস্টল করো (R2 S3-compatible API ব্যবহার করে, তাই আলাদা R2 SDK লাগে না)।

2. lib/upload.ts রিফ্যাক্টর করো — এখন যে ফাংশন local disk এ ফাইল লিখছে, সেটাকে S3Client দিয়ে R2 বাকেটে আপলোড করার মতো বদলাও:
   - endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
   - বাকেট: R2_BUCKET_NAME
   - ফাইলের key/path আগের মতোই গঠন রাখো (যেমন leads/{leadId}/{uuid}-{filename}), যাতে বাকি কোড (LeadDocument.fileUrl সেভ করা জায়গাগুলো) না বদলালেও চলে
   - আপলোড শেষে পূর্ণ পাবলিক URL রিটার্ন করো: `${R2_PUBLIC_URL}/${key}`
   - ফাইল সাইজ/টাইপ ভ্যালিডেশন (যা আগে ছিল) অক্ষুণ্ণ রাখো

3. যেসব জায়গায় lib/upload.ts এর ফাংশন কল হয় (Lead Document আপলোড, Phase Update ফটো আপলোড ইত্যাদি — Phase 2 ও Phase 3 এ বানানো) সেগুলো নতুন async ইন্টারফেসের সাথে সামঞ্জস্যপূর্ণ কিনা চেক করো, দরকার হলে ছোট adjustment করো।

4. delete/remove ফাংশন থাকলে সেটাও R2 তে DeleteObjectCommand দিয়ে আপডেট করো (যেমন কোনো document মুছে ফেললে R2 থেকেও মুছবে)।

5. .env.example এ নতুন ৫টা variable যোগ করো (placeholder value সহ, আসল secret নয়)। DEPLOYMENT.md এর শুরুর "জরুরি সীমাবদ্ধতা" নোটটা এখন resolve হয়ে গেছে বলে আপডেট করো এবং R2 env variable গুলো Vercel এ কীভাবে সেট করতে হবে তার নির্দেশনা যোগ করো।

6. একটা টেস্ট করো: একটা lead এ ফাইল আপলোড দিয়ে, R2 বাকেটে আসলেই ফাইল গেছে কিনা, আর ফেরত আসা URL দিয়ে ফাইলটা ব্রাউজারে খোলা/দেখা যাচ্ছে কিনা যাচাই করো।

কাজ শেষে lint/build চালিয়ে দেখাও, এবং কী কী ফাইল বদলেছে তার একটা সংক্ষিপ্ত লিস্ট দাও।
```

---

## যা মনে রাখবেন

- `.env` এর আসল R2 secret কখনো git এ কমিট হবে না (আগে থেকেই `.env` gitignored আছে) — শুধু `.env.example` এ placeholder থাকবে।
- Vercel এ deploy করার সময় Project Settings → Environment Variables এ গিয়ে এই ৫টা variable হুবহু বসিয়ে দিতে হবে, নইলে production এ আপলোড আবার ভাঙবে।
- R2 বাকেট public করার মানে যে কেউ URL জানলে ফাইল দেখতে পারবে (ঠিক S3 public bucket এর মতো) — ক্লায়েন্টের sensitive ডকুমেন্ট (NID, land document) থাকলে ভবিষ্যতে signed URL/private bucket এ আপগ্রেড করার কথা ভাবা যেতে পারে, কিন্তু MVP এর জন্য public bucket ঠিক আছে।
