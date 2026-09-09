import type { TypeOf, ZodTypeAny } from 'zod';
import { zodErrors } from '@/lib/action-result';

/**
 * ক্লায়েন্ট-সাইড ফর্ম যাচাই — server action এ পাঠানোর *আগে* ঠিক একই Zod স্কিমা
 * ব্রাউজারেই একবার চালানো হয়।
 *
 * এটি সার্ভারের যাচাইয়ের বিকল্প **নয়**: server action একটি পাবলিক endpoint, তাই
 * সেখানে স্কিমাটি সবসময় আবার চলে (`actions.ts` এর `safeParse`)। এখানে চালানোর
 * লাভ দুটো — (১) ভুল ইনপুটে অকারণে নেটওয়ার্ক রাউন্ড-ট্রিপ হয় না, খারাপ
 * ইন্টারনেটেও ভুলটা সঙ্গে সঙ্গে দেখা যায় (PRD এর প্রবাসী ব্যবহারকারীদের কথা ভেবে),
 * আর (২) মেসেজ দুই দিকে হুবহু এক, কারণ উৎস একটাই।
 *
 * ফলাফলের আকার `ActionResult` এর মতোই রাখা হয়েছে, তাই ফর্মগুলো সার্ভারের
 * উত্তর আর ক্লায়েন্টের যাচাই একই কোডপথে সামলাতে পারে।
 */

export type ClientInvalid = {
  ok: false;
  message: string;
  fieldErrors: Record<string, string>;
};

export type ClientValidation<T> = { ok: true; data: T } | ClientInvalid;

/** সার্ভার ভুল ইনপুটে যে মেসেজটি দেয় — ক্লায়েন্টেও একই কথা */
export const INVALID_INPUT = 'ইনপুট সঠিক নয়';

export function validate<S extends ZodTypeAny>(
  schema: S,
  input: unknown,
): ClientValidation<TypeOf<S>> {
  const parsed = schema.safeParse(input);
  if (parsed.success) return { ok: true, data: parsed.data };
  return { ok: false, message: INVALID_INPUT, fieldErrors: zodErrors(parsed.error) };
}

/**
 * `FormData` → সাধারণ অবজেক্ট, যাতে স্কিমা দিয়ে যাচাই করা যায়।
 *
 * ফাইল এন্ট্রি বাদ যায় — ফাইল আলাদাভাবে যাচাই হয় (`lib/upload-limits.ts` এ সাইজ
 * ও এক্সটেনশন, সার্ভারে `lib/upload.ts` এ MIME)। অনুপস্থিত ফিল্ড অবজেক্টেও
 * থাকে না, ফলে zod সেটিকে `undefined` দেখে — `.optional()` যেমন প্রত্যাশা করে।
 */
export function formValues(formData: FormData): Record<string, string | string[]> {
  const values: Record<string, string | string[]> = {};

  for (const [key, value] of formData.entries()) {
    if (typeof value !== 'string') continue;

    const existing = values[key];
    if (existing === undefined) values[key] = value;
    else if (Array.isArray(existing)) existing.push(value);
    else values[key] = [existing, value];
  }

  return values;
}

/** `formValues` + `validate` — সবচেয়ে সাধারণ ব্যবহার */
export function validateForm<S extends ZodTypeAny>(
  schema: S,
  formData: FormData,
  extra?: Record<string, unknown>,
): ClientValidation<TypeOf<S>> {
  return validate(schema, { ...formValues(formData), ...extra });
}
