import type { ReactNode } from 'react';

/**
 * রসিদের নিজস্ব লেআউট — প্যানেল শেল (সাইডবার/হেডার) ছাড়া, কারণ পেজটি সরাসরি
 * প্রিন্ট/PDF হয়। Admin, Accounts ও Customer — তিন রোলই এই একই পেজ ব্যবহার করে,
 * তাই কোনো একটি প্যানেলের ভেতরে রাখা হয়নি (অ্যাক্সেস `lib/rbac.ts` এ)।
 */
export const dynamic = 'force-dynamic';

export default function Layout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-muted/30 p-4 print:bg-white print:p-0">{children}</div>;
}
