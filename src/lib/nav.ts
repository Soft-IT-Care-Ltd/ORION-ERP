import type { LucideIcon } from 'lucide-react';
import {
  Banknote,
  BarChart3,
  Building2,
  CalendarClock,
  CreditCard,
  FileText,
  HardHat,
  Home,
  KanbanSquare,
  Receipt,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** পেজটি এখনো তৈরি হয়নি — কোন ফেজে আসবে (sidebar এ disabled দেখাবে) */
  upcomingPhase?: number;
  /** এই prefix গুলোতে থাকলেও আইটেমটি active দেখাবে (যেমন লিড ডিটেইল পেজ) */
  matchPrefixes?: string[];
};

export type Panel = {
  basePath: string;
  title: string;
  items: NavItem[];
};

/**
 * Panel-wise sidebar navigation। Nav নির্ধারিত হয় basePath দিয়ে (role দিয়ে নয়),
 * কারণ ADMIN অন্য প্যানেলগুলোও দেখতে পারে — তখন সেই প্যানেলের মেনুই দেখা উচিত।
 */
export const PANELS: Record<string, Panel> = {
  '/admin': {
    basePath: '/admin',
    title: 'অ্যাডমিন প্যানেল',
    items: [
      { label: 'ড্যাশবোর্ড', href: '/admin', icon: Home },
      { label: 'ইউজার ম্যানেজমেন্ট', href: '/admin/users', icon: Users },
      // ADMIN সব লিড দেখে — সেলস প্যানেলের বোর্ডটিই ব্যবহার হয় (ROUTE_ROLES এ অনুমোদিত)
      { label: 'লিড ও পাইপলাইন', href: '/sales/pipeline', icon: KanbanSquare },
      { label: 'প্রজেক্ট ও ইউনিট', href: '/admin/projects', icon: Building2 },
      { label: 'পেমেন্ট', href: '/admin/payments', icon: Wallet },
      { label: 'রিপোর্ট', href: '/admin/reports', icon: BarChart3, upcomingPhase: 6 },
    ],
  },
  '/sales': {
    basePath: '/sales',
    title: 'সেলস / মার্কেটিং প্যানেল',
    items: [
      { label: 'ড্যাশবোর্ড', href: '/sales', icon: Home },
      {
        label: 'পাইপলাইন',
        href: '/sales/pipeline',
        icon: KanbanSquare,
        matchPrefixes: ['/sales/leads'],
      },
      { label: 'ফলো-আপ', href: '/sales/follow-ups', icon: CalendarClock, upcomingPhase: 2 },
      { label: 'পারফরম্যান্স', href: '/sales/performance', icon: TrendingUp, upcomingPhase: 6 },
    ],
  },
  '/engineer': {
    basePath: '/engineer',
    title: 'সাইট ইঞ্জিনিয়ার প্যানেল',
    items: [
      { label: 'ড্যাশবোর্ড', href: '/engineer', icon: Home },
      // ফেজ আপডেট সাইটের ভেতরেই হয় — তাই আলাদা মেনু নেই
      {
        label: 'আমার সাইট',
        href: '/engineer/sites',
        icon: HardHat,
        matchPrefixes: ['/engineer/sites'],
      },
    ],
  },
  '/accounts': {
    basePath: '/accounts',
    title: 'অ্যাকাউন্টস প্যানেল',
    items: [
      { label: 'ড্যাশবোর্ড', href: '/accounts', icon: Home },
      {
        label: 'পেমেন্ট শিডিউল',
        href: '/accounts/schedule',
        icon: CalendarClock,
        matchPrefixes: ['/accounts/schedule'],
      },
      { label: 'পেমেন্ট এন্ট্রি', href: '/accounts/payments', icon: Banknote },
      { label: 'ওভারডিউ রিপোর্ট', href: '/accounts/overdue', icon: Receipt },
    ],
  },
  '/customer': {
    basePath: '/customer',
    title: 'কাস্টমার পোর্টাল',
    items: [
      { label: 'আমার ইউনিট', href: '/customer', icon: Home },
      { label: 'নির্মাণ অগ্রগতি', href: '/customer/progress', icon: HardHat },
      { label: 'পেমেন্ট', href: '/customer/payments', icon: CreditCard },
      { label: 'ডকুমেন্ট', href: '/customer/documents', icon: FileText, upcomingPhase: 5 },
    ],
  },
};

export function getPanel(basePath: string): Panel {
  const panel = PANELS[basePath];
  if (!panel) throw new Error(`Unknown panel basePath: ${basePath}`);
  return panel;
}
