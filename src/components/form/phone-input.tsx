'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import {
  COMMON_COUNTRIES,
  DEFAULT_PHONE_COUNTRY,
  findCountry,
  OTHER_COUNTRIES,
} from '@/lib/countries';

/**
 * country code picker + লোকাল নম্বর — PRD সেকশন ৫.১ (প্রবাসী ক্লায়েন্ট নিজের
 * দেশের নম্বর দেন, যেমন +971 50 123 4567)।
 *
 * দুটি আলাদা ফিল্ড হিসেবেই সাবমিট হয় (`{name}Country` ও `{name}Number`);
 * server এ libphonenumber দিয়ে যাচাই করে E.164 তে জোড়া লাগানো হয় — তাই
 * ভারী লাইব্রেরিটি client bundle এ ঢোকে না।
 */
export function PhoneInput({
  name,
  id,
  defaultCountry,
  defaultNumber,
  required,
  autoComplete = 'tel-national',
}: {
  /** ফিল্ডের base নাম — `phone` দিলে `phoneCountry` ও `phoneNumber` যায় */
  name: string;
  id: string;
  defaultCountry?: string | null;
  defaultNumber?: string | null;
  required?: boolean;
  autoComplete?: string;
}) {
  const [country, setCountry] = useState(defaultCountry || DEFAULT_PHONE_COUNTRY);
  const dial = findCountry(country)?.dial;

  return (
    <div className="flex gap-2">
      <NativeSelect
        name={`${name}Country`}
        aria-label="দেশের কোড"
        value={country}
        onChange={(event) => setCountry(event.target.value)}
        className="w-[7.5rem] shrink-0 px-2 pr-7"
      >
        <optgroup label="প্রচলিত">
          {COMMON_COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.flag} +{c.dial}
            </option>
          ))}
        </optgroup>
        <optgroup label="অন্যান্য দেশ">
          {OTHER_COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.flag} +{c.dial} · {c.en}
            </option>
          ))}
        </optgroup>
      </NativeSelect>

      <div className="relative min-w-0 flex-1">
        {dial ? (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            +{dial}
          </span>
        ) : null}
        <Input
          id={id}
          name={`${name}Number`}
          type="tel"
          inputMode="tel"
          defaultValue={defaultNumber ?? ''}
          required={required}
          autoComplete={autoComplete}
          placeholder={country === 'BD' ? '1711223344' : '501234567'}
          // prefix টেক্সটের প্রস্থ dial code ভেদে বদলায় (+1 বনাম +880)
          style={dial ? { paddingLeft: `calc(${dial.length + 1}ch + 1.5rem)` } : undefined}
        />
      </div>
    </div>
  );
}
