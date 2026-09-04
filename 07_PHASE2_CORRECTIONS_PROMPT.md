# Phase 2 Correction — প্রবাসী-কেন্দ্রিক Lead ফিল্ড + ফাইল আপলোড

Phase 2 (Lead Management & Sales Pipeline) কমপ্লিট হয়ে গেছে — এই prompt টা তার উপর একটা correction/addition, আপডেট করা `01_PRD.md` (সেকশন ৫.১) ও `03_schema.prisma` অনুযায়ী।

Claude Code তে এই prompt টা দিন:

```
এই ফোল্ডারে থাকা 01_PRD.md এর সেকশন ৫.১ (Lead Management & Sales Pipeline) আবার পড়ো — এতে "প্রবাসী-কেন্দ্রিক নোট" ও "Lead Documents" নামে নতুন অংশ যোগ হয়েছে। 03_schema.prisma ও আপডেট হয়েছে (Lead মডেলে নতুন ফিল্ড, নতুন LeadDocument মডেল, নতুন LeadFileType enum)।

আমাদের ক্লায়েন্টদের বড় অংশ প্রবাসী বাংলাদেশী (বিদেশ থেকে দেশের বাইরের নম্বর দেয়, এবং যোগাযোগের সুবিধার জন্য বাংলাদেশে থাকা পরিচিত কারো নম্বর দিয়ে যায়) — তাই Lead মডেল ও ফর্মে নিচের correction/addition গুলো করো:

1. prisma/schema.prisma এর Lead মডেলে (বর্তমান স্কিমার সাথে conflict না করে merge করে) এই ফিল্ডগুলো যোগ করো:
   - residenceCountry (String?, optional) — ক্লায়েন্ট বর্তমানে কোন দেশে থাকে
   - projectLocation (String?, optional) — ক্লায়েন্টের জমি/প্রজেক্টের প্রকৃত অবস্থান (জেলা/উপজেলা/এলাকা)
   - localContactName (String?, optional)
   - localContactPhone (String?, optional)
   - localContactRelation (String?, optional) — যেমন "ভাই", "বন্ধু", "আত্মীয়"

   phone ফিল্ড আগে থেকেই আছে — সেটাকে international format সাপোর্ট করাও (country code সহ ইনপুট নেওয়া, যেমন +971-50-XXXXXXX)। ফর্মে একটা country-code dropdown/picker (একটা লাইব্রেরি যেমন react-phone-number-input ব্যবহার করা যায়, অথবা একটা simple country-code select + local number input) ব্যবহার করো, যাতে ভুল ফরম্যাট এন্ট্রি আটকানো যায়।

2. নতুন LeadDocument মডেল বানাও (leadId, fileUrl, fileName, fileType enum [FLOOR_PLAN, THREE_D_DESIGN, PROPOSAL, LAND_DOCUMENT, OTHER], description অপশনাল, uploadedById, uploadedAt) — 03_schema.prisma এ পুরো definition দেওয়া আছে, হুবহু কপি করো। প্রয়োজনে `npx prisma migrate dev --name lead-diaspora-fields` চালাও।

3. Lead Create/Edit ফর্মে (app/sales এ) নতুন সেকশন যোগ করো:
   - "Residence Country" ফিল্ড (dropdown, common প্রবাসী destination গুলো prefill করা থাকতে পারে: UAE, Saudi Arabia, Qatar, Kuwait, Oman, UK, USA, Malaysia, Italy, Other)
   - "Project/Land Location" টেক্সট ফিল্ড
   - "Local Contact" সাব-সেকশন — Name, Phone, Relation তিনটা ইনপুট

4. Lead Detail page এ একটা নতুন "Documents" ট্যাব/সেকশন যোগ করো:
   - ফাইল আপলোড ফর্ম (drag & drop বা সাধারণ file input) — একসাথে একাধিক ফাইল সিলেক্ট করা যাবে
   - প্রতিটি আপলোডের সাথে একটা File Type dropdown (Floor Plan / 3D Design / Proposal / Land Document / Other) এবং optional description টেক্সট
   - আপলোড হওয়া ফাইলগুলোর লিস্ট (ফাইলের নাম, টাইপ ব্যাজ, uploaded by, date, download/view লিংক), টাইপ অনুযায়ী গ্রুপ/ফিল্টার করা যাবে
   - ফাইল স্টোরেজ Phase 3 এ বানানো lib/upload.ts হেল্পার reuse করো (local /public/uploads এ সেভ, পরে S3/R2 এ migrate করা যাবে) — যদি Phase 3 এখনো না হয়ে থাকে, একই approach এ নতুন করে বানাও যাতে পরে reuse হয়

5. Lead list/pipeline card এ ছোট আইকন/ব্যাজ দেখাও যদি lead এর residenceCountry সেট করা থাকে (প্রবাসী client বোঝার জন্য) এবং document count থাকলে একটা ছোট 📎 বা paperclip icon + সংখ্যা।

কাজ শেষে migration চালিয়ে, একটা টেস্ট lead বানিয়ে (residence country, local contact, একটা floor plan ফাইল আপলোড দিয়ে) verify করো, তারপর lint/build চালিয়ে দেখাও।
```
