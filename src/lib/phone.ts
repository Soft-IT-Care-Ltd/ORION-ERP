import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';
import { findCountry } from '@/lib/countries';

/**
 * ফোন নম্বর — PRD সেকশন ৫.১ অনুযায়ী international format সাপোর্ট করতে হবে,
 * কারণ প্রবাসী ক্লায়েন্টরা নিজের দেশের নম্বর দেন (e.g. +971 50 123 4567)।
 *
 * DB তে সবসময় **E.164** (`+971501234567`) সেভ হয় — একক ফরম্যাট রাখলে
 * ডুপ্লিকেট খোঁজা, `tel:` লিংক ও ভবিষ্যতের SMS ইন্টিগ্রেশন সহজ থাকে।
 * দেখানোর সময় `formatPhone*` দিয়ে পাঠযোগ্য রূপে বদলে নেওয়া হয়।
 *
 * libphonenumber ভারী — তাই এই ফাইলটি শুধু server side এ ব্যবহৃত হয়;
 * client শুধু আগে থেকে ফরম্যাট করা string পায়।
 */

export type ParsedPhone = { ok: true; e164: string } | { ok: false; reason: string };

/**
 * country picker এর ISO কোড + লোকাল নম্বর → E.164।
 * ইউজার লোকাল নম্বরেই country code লিখে ফেললে (`+971…` বা `00971…`) সেটিও
 * ধরা হয় — তখন লেখা কোডটিই প্রাধান্য পায়।
 */
export function toE164(rawNumber: string, countryCode: string): ParsedPhone {
  const input = rawNumber.trim();
  if (!input) return { ok: false, reason: 'ফোন নম্বর দিন' };

  const country = findCountry(countryCode);
  if (!country) return { ok: false, reason: 'দেশ নির্বাচন করুন' };

  // "00971..." → "+971..." (অনেকে IDD প্রিফিক্স সহ লেখেন)
  const normalized = input.replace(/^00/, '+');
  const hasOwnCountryCode = normalized.startsWith('+');

  const parsed = parsePhoneNumberFromString(
    normalized,
    hasOwnCountryCode ? undefined : (country.code as CountryCode),
  );

  if (!parsed) return { ok: false, reason: 'নম্বরটি পড়া গেল না — country code সহ চেষ্টা করুন' };
  if (!parsed.isValid()) {
    return { ok: false, reason: `${country.en} এর জন্য নম্বরটি সঠিক নয়` };
  }

  return { ok: true, e164: parsed.number };
}

/** শুধু বাংলাদেশি নম্বর — লোকাল কন্টাক্টের জন্য (PRD: বাংলাদেশে থাকা পরিচিত ব্যক্তি) */
export function toBangladeshiE164(rawNumber: string): ParsedPhone {
  const input = rawNumber.trim();
  if (!input) return { ok: false, reason: 'ফোন নম্বর দিন' };

  const parsed = parsePhoneNumberFromString(input.replace(/^00/, '+'), 'BD');
  if (!parsed || !parsed.isValid() || parsed.country !== 'BD') {
    return { ok: false, reason: 'সঠিক বাংলাদেশি নম্বর দিন (যেমন 01711223344)' };
  }
  return { ok: true, e164: parsed.number };
}

/** `+971 50 123 4567` — কার্ড ও ডিটেইলে দেখানোর জন্য */
export function formatPhoneInternational(e164: string | null | undefined): string {
  if (!e164) return '';
  return parsePhoneNumberFromString(e164)?.formatInternational() ?? e164;
}

/** `01711-223344` — বাংলাদেশি নম্বর দেশীয় রূপে (অন্য দেশ হলে international) */
export function formatPhoneNational(e164: string | null | undefined): string {
  if (!e164) return '';
  const parsed = parsePhoneNumberFromString(e164);
  if (!parsed) return e164;
  return parsed.country === 'BD' ? parsed.formatNational() : parsed.formatInternational();
}

/** ফর্মে আবার বসানোর জন্য E.164 কে country + লোকাল নম্বরে ভাঙা */
export function splitPhone(e164: string | null | undefined): {
  country: string | null;
  national: string;
} {
  if (!e164) return { country: null, national: '' };
  const parsed = parsePhoneNumberFromString(e164);
  if (!parsed?.country) return { country: null, national: e164 };
  return { country: parsed.country, national: parsed.nationalNumber };
}
