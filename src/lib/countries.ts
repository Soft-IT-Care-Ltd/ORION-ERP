/**
 * দেশের তালিকা — ফোনের country code picker ও "Residence Country" ড্রপডাউন
 * দুটোতেই ব্যবহৃত (PRD সেকশন ৫.১, প্রবাসী-কেন্দ্রিক নোট)।
 *
 * `code` = ISO 3166-1 alpha-2 — DB তে এই কোডটিই সেভ হয় (`Lead.residenceCountry`),
 * লেবেল/ফ্ল্যাগ শুধু UI এর জন্য। কোড রাখায় ভবিষ্যতে রিপোর্ট/ফিল্টার স্থিতিশীল থাকে।
 *
 * এই ফাইলটি client component থেকেও import হয় — তাই কোনো ভারী নির্ভরতা নেই।
 */

export type Country = {
  code: string;
  /** international dialing prefix, `+` ছাড়া */
  dial: string;
  en: string;
  bn: string;
  flag: string;
};

/** প্রবাসী বাংলাদেশিদের প্রধান গন্তব্য — ড্রপডাউনের উপরে আলাদা গ্রুপে দেখানো হয় */
export const COMMON_COUNTRY_CODES = [
  'BD',
  'AE',
  'SA',
  'QA',
  'KW',
  'OM',
  'GB',
  'US',
  'MY',
  'IT',
] as const;

export const COUNTRIES: Country[] = [
  { code: 'BD', dial: '880', en: 'Bangladesh', bn: 'বাংলাদেশ', flag: '🇧🇩' },
  { code: 'AE', dial: '971', en: 'UAE', bn: 'সংযুক্ত আরব আমিরাত', flag: '🇦🇪' },
  { code: 'SA', dial: '966', en: 'Saudi Arabia', bn: 'সৌদি আরব', flag: '🇸🇦' },
  { code: 'QA', dial: '974', en: 'Qatar', bn: 'কাতার', flag: '🇶🇦' },
  { code: 'KW', dial: '965', en: 'Kuwait', bn: 'কুয়েত', flag: '🇰🇼' },
  { code: 'OM', dial: '968', en: 'Oman', bn: 'ওমান', flag: '🇴🇲' },
  { code: 'GB', dial: '44', en: 'UK', bn: 'যুক্তরাজ্য', flag: '🇬🇧' },
  { code: 'US', dial: '1', en: 'USA', bn: 'যুক্তরাষ্ট্র', flag: '🇺🇸' },
  { code: 'MY', dial: '60', en: 'Malaysia', bn: 'মালয়েশিয়া', flag: '🇲🇾' },
  { code: 'IT', dial: '39', en: 'Italy', bn: 'ইতালি', flag: '🇮🇹' },

  { code: 'AU', dial: '61', en: 'Australia', bn: 'অস্ট্রেলিয়া', flag: '🇦🇺' },
  { code: 'BH', dial: '973', en: 'Bahrain', bn: 'বাহরাইন', flag: '🇧🇭' },
  { code: 'BN', dial: '673', en: 'Brunei', bn: 'ব্রুনাই', flag: '🇧🇳' },
  { code: 'CA', dial: '1', en: 'Canada', bn: 'কানাডা', flag: '🇨🇦' },
  { code: 'CN', dial: '86', en: 'China', bn: 'চীন', flag: '🇨🇳' },
  { code: 'CY', dial: '357', en: 'Cyprus', bn: 'সাইপ্রাস', flag: '🇨🇾' },
  { code: 'DE', dial: '49', en: 'Germany', bn: 'জার্মানি', flag: '🇩🇪' },
  { code: 'EG', dial: '20', en: 'Egypt', bn: 'মিশর', flag: '🇪🇬' },
  { code: 'ES', dial: '34', en: 'Spain', bn: 'স্পেন', flag: '🇪🇸' },
  { code: 'FR', dial: '33', en: 'France', bn: 'ফ্রান্স', flag: '🇫🇷' },
  { code: 'GR', dial: '30', en: 'Greece', bn: 'গ্রিস', flag: '🇬🇷' },
  { code: 'HK', dial: '852', en: 'Hong Kong', bn: 'হংকং', flag: '🇭🇰' },
  { code: 'ID', dial: '62', en: 'Indonesia', bn: 'ইন্দোনেশিয়া', flag: '🇮🇩' },
  { code: 'IE', dial: '353', en: 'Ireland', bn: 'আয়ারল্যান্ড', flag: '🇮🇪' },
  { code: 'IN', dial: '91', en: 'India', bn: 'ভারত', flag: '🇮🇳' },
  { code: 'IQ', dial: '964', en: 'Iraq', bn: 'ইরাক', flag: '🇮🇶' },
  { code: 'JO', dial: '962', en: 'Jordan', bn: 'জর্ডান', flag: '🇯🇴' },
  { code: 'JP', dial: '81', en: 'Japan', bn: 'জাপান', flag: '🇯🇵' },
  { code: 'KR', dial: '82', en: 'South Korea', bn: 'দক্ষিণ কোরিয়া', flag: '🇰🇷' },
  { code: 'LB', dial: '961', en: 'Lebanon', bn: 'লেবানন', flag: '🇱🇧' },
  { code: 'LY', dial: '218', en: 'Libya', bn: 'লিবিয়া', flag: '🇱🇾' },
  { code: 'MV', dial: '960', en: 'Maldives', bn: 'মালদ্বীপ', flag: '🇲🇻' },
  { code: 'NL', dial: '31', en: 'Netherlands', bn: 'নেদারল্যান্ডস', flag: '🇳🇱' },
  { code: 'NP', dial: '977', en: 'Nepal', bn: 'নেপাল', flag: '🇳🇵' },
  { code: 'NZ', dial: '64', en: 'New Zealand', bn: 'নিউজিল্যান্ড', flag: '🇳🇿' },
  { code: 'PK', dial: '92', en: 'Pakistan', bn: 'পাকিস্তান', flag: '🇵🇰' },
  { code: 'PL', dial: '48', en: 'Poland', bn: 'পোল্যান্ড', flag: '🇵🇱' },
  { code: 'PT', dial: '351', en: 'Portugal', bn: 'পর্তুগাল', flag: '🇵🇹' },
  { code: 'RO', dial: '40', en: 'Romania', bn: 'রোমানিয়া', flag: '🇷🇴' },
  { code: 'RU', dial: '7', en: 'Russia', bn: 'রাশিয়া', flag: '🇷🇺' },
  { code: 'SE', dial: '46', en: 'Sweden', bn: 'সুইডেন', flag: '🇸🇪' },
  { code: 'SG', dial: '65', en: 'Singapore', bn: 'সিঙ্গাপুর', flag: '🇸🇬' },
  { code: 'TH', dial: '66', en: 'Thailand', bn: 'থাইল্যান্ড', flag: '🇹🇭' },
  { code: 'TR', dial: '90', en: 'Turkey', bn: 'তুরস্ক', flag: '🇹🇷' },
  { code: 'ZA', dial: '27', en: 'South Africa', bn: 'দক্ষিণ আফ্রিকা', flag: '🇿🇦' },
];

/** তালিকায় নেই এমন দেশ — `residenceCountry` এ এই sentinel টি সেভ হয় */
export const OTHER_COUNTRY = 'OTHER';

const BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c]));

export function findCountry(code: string | null | undefined): Country | undefined {
  return code ? BY_CODE.get(code) : undefined;
}

/** ড্রপডাউন ও ব্যাজে দেখানোর লেবেল — অজানা কোড হলে কোডটাই ফেরত */
export function countryLabel(code: string | null | undefined): string | null {
  if (!code) return null;
  if (code === OTHER_COUNTRY) return 'অন্যান্য দেশ';
  const country = findCountry(code);
  return country ? `${country.bn} (${country.en})` : code;
}

export function countryFlag(code: string | null | undefined): string {
  if (!code || code === OTHER_COUNTRY) return '🌍';
  return findCountry(code)?.flag ?? '🌍';
}

/** ড্রপডাউনের দুই গ্রুপ — প্রচলিত গন্তব্য আগে, বাকিগুলো বর্ণানুক্রমে */
export const COMMON_COUNTRIES = COMMON_COUNTRY_CODES.map((code) => BY_CODE.get(code)!);
export const OTHER_COUNTRIES = COUNTRIES.filter(
  (c) => !(COMMON_COUNTRY_CODES as readonly string[]).includes(c.code),
).sort((a, b) => a.en.localeCompare(b.en));

/** ডিফল্ট country code — বেশিরভাগ লিড দেশ থেকেই আসে */
export const DEFAULT_PHONE_COUNTRY = 'BD';
