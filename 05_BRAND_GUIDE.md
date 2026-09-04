# Orion Builders — Brand Guide (Claude Design থেকে সংগ্রহ করা)

সোর্স: Claude Design প্রজেক্ট ("Orion Builders Design System") + `Orion_Builders_Brand_Brief.docx`।
অ্যাসেট ইতিমধ্যে প্রজেক্টের `public/brand/` ফোল্ডারে রাখা হয়েছে (svg ও png সাবফোল্ডারে)।

## Brand Identity

- **Company:** Orion Builders — Construction & Real Estate, Bangladesh
- **Tagline:** Built on Trust / বিশ্বাসের ভিতে গড়া
- **Symbol meaning:** Orion's Belt (৩টি তারা) = Trust, Quality, Transparency

## Color Palette (source of truth — brand brief)

| নাম | Hex | ব্যবহার |
|---|---|---|
| Deep Navy | `#0B1F3A` | Primary — লোগো, হেডার, টেক্সট |
| Star Gold | `#C9A227` | Accent — তারা, হাইলাইট, ট্যাগলাইন, CTA বাটন |
| Pure White | `#FFFFFF` | ব্যাকগ্রাউন্ড, নেগেটিভ স্পেস |
| Slate Gray | `#5A6573` | সেকেন্ডারি টেক্সট |
| Light Sky | `#E8EDF4` | সেকশন ব্যাকগ্রাউন্ড, সফট ফিল |

> নোট: চূড়ান্ত এক্সপোর্ট করা লোগো ফাইলগুলোতে (PNG/SVG) গাঢ় brown-charcoal ব্যাকগ্রাউন্ডে গোল্ড/ক্রিম টোন ব্যবহার হয়েছে (dark surface variant) — সেটাও ব্যবহার করা যাবে dark-mode/hero সেকশনে, কিন্তু app UI-এর জন্য primary token হিসেবে উপরের brand brief এর hex codes ব্যবহার করাই সবচেয়ে নিরাপদ (এটাই ডকুমেন্টেড sourceof truth)।

## Typography

| ব্যবহার | Font | Google Fonts? |
|---|---|---|
| Logo wordmark / Headings | Montserrat (Bold/SemiBold) | হ্যাঁ |
| Body text (English) | Open Sans বা Lato | হ্যাঁ |
| Body text (Bangla) | Noto Sans Bengali বা Hind Siliguri | হ্যাঁ |
| Tagline | Montserrat (Light Italic) | হ্যাঁ |

সবগুলো Google Fonts এ ফ্রি পাওয়া যায় — `next/font/google` দিয়ে সরাসরি ইমপোর্ট করা যাবে, কোনো ফন্ট ফাইল ম্যানুয়ালি ডাউনলোড করার দরকার নেই।

## Logo Assets (already in `public/brand/`)

```
public/brand/svg/
  orion-logo-mark.svg              ← full color mark (primary, light bg)
  orion-logo-mark-reversed.svg     ← for dark backgrounds
  orion-logo-mark-white.svg        ← solid white
  orion-logo-mark-white-outline.svg← white fill + thin black border (works on any color/photo)
  orion-logo-mark-black.svg        ← solid black (monochrome)

public/brand/png/
  orion-logo-primary.png
  orion-logo-reversed.png
  orion-logo-white.png
  orion-logo-black.png
  orion-logo-white-outline.png
  orion-logo-stacked.png              ← stacked (icon over wordmark) layout
  orion-logo-stacked-reversed.png
  orion-logo-white-outline-stacked.png
  orion-fb-profile.png / orion-fb-profile-mark.png / orion-fb-cover.png  ← social media only, app-এ লাগবে না
```

## যেখানে যেভাবে ব্যবহার হবে (CRM/ERP-এ)

| জায়গা | কোন লোগো | নোট |
|---|---|---|
| Login page (সব role) | `orion-logo-mark.svg` (light bg) | সেন্টার্ড, উপরে |
| Sidebar/header (light layout) | `orion-logo-mark.svg` অথবা stacked ছোট সাইজে | সব panel এ কমন |
| Sidebar/header (dark mode, যদি থাকে) | `orion-logo-mark-reversed.svg` | |
| Browser favicon | `orion-logo-mark.svg` থেকে বানানো `icon.png`/`favicon.ico` | Next.js App Router এ `app/icon.png` রাখলেই যথেষ্ট |
| PDF রিসিট/ইনভয়েসের হেডার | `orion-logo-black.png` (monochrome, প্রিন্ট-ফ্রেন্ডলি) | |
| Customer portal empty states/loading | `orion-logo-mark-white-outline.svg` | যেকোনো ব্যাকগ্রাউন্ডে বসে |

## Tailwind token suggestion

```js
// tailwind.config.ts এ extend.colors এ যোগ করুন
colors: {
  'orion-navy': '#0B1F3A',
  'orion-gold': '#C9A227',
  'orion-slate': '#5A6573',
  'orion-sky': '#E8EDF4',
}
```
