import type { ZodError } from 'zod';

/**
 * Server Action এর common return shape — ফর্মগুলো `ok` দেখে toast/field error দেখায়।
 * থ্রো না করে রিটার্ন করা হয়, যাতে ইউজার বাংলা মেসেজ পায় আর Next এর generic
 * "An error occurred in the Server Components render" স্ক্রিন না আসে।
 */
export type ActionOk<TData = unknown> = { ok: true; message: string; data?: TData };
export type ActionError = {
  ok: false;
  message: string;
  fieldErrors?: Record<string, string>;
};
export type ActionResult<TData = unknown> = ActionOk<TData> | ActionError;

export const FORBIDDEN: ActionError = {
  ok: false,
  message: 'এই কাজটি করার অনুমতি আপনার নেই',
};

export const NOT_FOUND: ActionError = {
  ok: false,
  message: 'রেকর্ডটি খুঁজে পাওয়া যায়নি',
};

/** Zod issue → `{ fieldName: message }` (ফর্মের নিচে দেখানোর জন্য) */
export function zodErrors(error: ZodError): Record<string, string> {
  return Object.fromEntries(
    error.issues.map((issue) => [String(issue.path[0] ?? '_'), issue.message]),
  );
}
