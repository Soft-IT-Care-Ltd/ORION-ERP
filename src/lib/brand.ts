/**
 * Orion Builders ব্র্যান্ড কনস্ট্যান্ট — source of truth: `05_BRAND_GUIDE.md`
 *
 * রঙগুলো UI-তে সরাসরি hex হিসেবে নয়, Tailwind টোকেন (`orion-navy`, `orion-gold` …)
 * বা shadcn semantic টোকেন (`primary`, `accent` …) দিয়ে ব্যবহার করা হয়।
 * এখানকার hex মানগুলো সেই জায়গার জন্য যেখানে Tailwind ক্লাস চলে না —
 * যেমন PDF/receipt জেনারেশন, chart series, বা `<meta name="theme-color">`।
 */

export const BRAND = {
  name: 'Orion Builders',
  nameBn: 'ওরিয়ন বিল্ডার্স',
  tagline: 'Built on Trust',
  taglineBn: 'বিশ্বাসের ভিতে গড়া',

  colors: {
    navy: '#0B1F3A',
    gold: '#C9A227',
    slate: '#5A6573',
    sky: '#E8EDF4',
    white: '#FFFFFF',
  },

  logo: {
    /** ডিফল্ট — light ব্যাকগ্রাউন্ডে (login, sidebar, header) */
    mark: '/brand/svg/orion-logo-mark.svg',
    /** dark ব্যাকগ্রাউন্ড / dark mode */
    markReversed: '/brand/svg/orion-logo-mark-reversed.svg',
    /** সলিড সাদা */
    markWhite: '/brand/svg/orion-logo-mark-white.svg',
    /** সাদা fill + পাতলা বর্ডার — যেকোনো রঙ/ছবির উপরে বসে (empty state, loading) */
    markOutline: '/brand/svg/orion-logo-mark-white-outline.svg',
    /** মনোক্রোম */
    markBlack: '/brand/svg/orion-logo-mark-black.svg',
    /** PDF রিসিট/ইনভয়েসের হেডার — monochrome, প্রিন্ট-ফ্রেন্ডলি (Phase 4+) */
    print: '/brand/png/orion-logo-black.png',
    /** stacked lockup (icon over wordmark) */
    stacked: '/brand/png/orion-logo-stacked.png',
  },
} as const;

/** লোগো মার্কের ন্যাটিভ aspect ratio (SVG viewBox 50×45) */
export const MARK_ASPECT = 45 / 50;

/** `size` = width (px); height ন্যাটিভ ratio ধরে হিসাব হয় */
export function markSize(width: number) {
  return { width, height: Math.round(width * MARK_ASPECT) };
}
