import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * ৳ ফরম্যাটে টাকা — বাংলাদেশে প্রচলিত লাখ/কোটি গ্রুপিং (৪৫,০০,০০০), PRD সেকশন ৫.৩।
 * `en-IN` grouping ব্যবহার হয়েছে কারণ `en-BD` পশ্চিমা হাজার-গ্রুপিং দেয়,
 * আর `style: 'currency'` "BDT" লিখত — কার্ডে ৳ চিহ্নই বেশি পাঠযোগ্য।
 */
export function formatBDT(amount: number | string | null | undefined) {
  const value = Number(amount ?? 0);
  return `৳${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(value)}`;
}
