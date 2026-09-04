# Brand Integration — Claude Code Prompt

লোগো ও অ্যাসেট ইতিমধ্যে `public/brand/svg/` ও `public/brand/png/` এ রাখা হয়েছে (দেখুন `05_BRAND_GUIDE.md`)। এই prompt টা Phase 1 এর পরে (বা যেকোনো সময়) Claude Code তে দিন — এটা পুরো সফটওয়্যারে ব্র্যান্ডিং বসিয়ে দেবে।

```
এই ফোল্ডারে থাকা 05_BRAND_GUIDE.md পড়ো — Orion Builders এর brand color, font, এবং public/brand/ এ রাখা লোগো অ্যাসেট সম্পর্কে সব তথ্য আছে সেখানে।

নিচেরগুলো করো:

1. tailwind.config.ts (বা globals.css এ CSS variables) এ brand color token যোগ করো:
   orion-navy (#0B1F3A), orion-gold (#C9A227), orion-slate (#5A6573), orion-sky (#E8EDF4)।
   প্রাইমারি বাটন, লিংক, active state ইত্যাদিতে orion-navy/orion-gold ব্যবহার করো ধীরে ধীরে যেখানে এখন generic Tailwind রঙ (blue-600 ইত্যাদি) আছে।

2. next/font/google দিয়ে Montserrat (headings/wordmark), Open Sans (English body), এবং Noto Sans Bengali (Bangla body) ফন্ট যোগ করো root layout এ, CSS variable হিসেবে এক্সপোজ করো (--font-heading, --font-body, --font-bengali) এবং globals.css এ ব্যবহার করো।

3. app/icon.png বা app/favicon.ico বানাও public/brand/png/orion-logo-primary.png থেকে (favicon এর জন্য উপযুক্ত সাইজে resize/crop করো, স্কোয়ার আইকন হিসেবে)।

4. Login page এ (app/(auth)/login) উপরে সেন্টার্ড করে public/brand/svg/orion-logo-mark.svg বসাও, তার নিচে "Orion Builders" এবং tagline "Built on Trust" / "বিশ্বাসের ভিতে গড়া"।

5. প্রতিটি role এর layout/sidebar এ (admin, sales, engineer, accounts, customer) header/sidebar টপে ছোট সাইজে orion-logo-mark.svg (বা stacked ভার্সন narrow sidebar এ) বসাও, ক্লিক করলে সংশ্লিষ্ট role এর ড্যাশবোর্ড হোমে যাবে।

6. যদি কোথাও PDF/receipt জেনারেশন থাকে (Phase 4 এর পরে), সেখানকার হেডারে public/brand/png/orion-logo-black.png ব্যবহার করো (মনোক্রোম, প্রিন্ট-ফ্রেন্ডলি)।

7. মোবাইল ভিউতে (৩৭৫px) সব জায়গায় লোগো/হেডার ঠিকভাবে দেখাচ্ছে কিনা চেক করো, বড় স্ক্রিনের জন্য ডিজাইন করা লোগো যেন ছোট স্ক্রিনে ভেঙে না যায়।

কাজ শেষে build/lint চালিয়ে ভেরিফাই করো এবং কোথায় কোথায় লোগো বসালে তার একটা ছোট সামারি দাও।
```
