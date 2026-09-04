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
  ListChecks,
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
      { label: 'লিড ও পাইপলাইন', href: '/admin/leads', icon: KanbanSquare, upcomingPhase: 2 },
      { label: 'প্রজেক্ট ও ইউনিট', href: '/admin/projects', icon: Building2, upcomingPhase: 3 },
      { label: 'পেমেন্ট', href: '/admin/payments', icon: Wallet, upcomingPhase: 4 },
      { label: 'রিপোর্ট', href: '/admin/reports', icon: BarChart3, upcomingPhase: 6 },
    ],
  },
  '/sales': {
    basePath: '/sales',
    title: 'সেলস / মার্কেটিং প্যানেল',
    items: [
      { label: 'ড্যাশবোর্ড', href: '/sales', icon: Home },
      { label: 'পাইপলাইন', href: '/sales/pipeline', icon: KanbanSquare, upcomingPhase: 2 },
      { label: 'আমার লিড', href: '/sales/leads', icon: ListChecks, upcomingPhase: 2 },
      { label: 'ফলো-আপ', href: '/sales/follow-ups', icon: CalendarClock, upcomingPhase: 2 },
      { label: 'পারফরম্যান্স', href: '/sales/performance', icon: TrendingUp, upcomingPhase: 6 },
    ],
  },
  '/engineer': {
    basePath: '/engineer',
    title: 'সাইট ইঞ্জিনিয়ার প্যানেল',
    items: [
      { label: 'ড্যাশবোর্ড', href: '/engineer', icon: Home },
      { label: 'আমার সাইট', href: '/engineer/sites', icon: HardHat, upcomingPhase: 3 },
      { label: 'ফেজ আপডেট', href: '/engineer/updates', icon: ListChecks, upcomingPhase: 3 },
    ],
  },
  '/accounts': {
    basePath: '/accounts',
    title: 'অ্যাকাউন্টস প্যানেল',
    items: [
      { label: 'ড্যাশবোর্ড', href: '/accounts', icon: Home },
      { label: 'পেমেন্ট শিডিউল', href: '/accounts/schedule', icon: CalendarClock, upcomingPhase: 4 },
      { label: 'পেমেন্ট এন্ট্রি', href: '/accounts/payments', icon: Banknote, upcomingPhase: 4 },
      { label: 'ওভারডিউ রিপোর্ট', href: '/accounts/overdue', icon: Receipt, upcomingPhase: 4 },
    ],
  },
  '/customer': {
    basePath: '/customer',
    title: 'কাস্টমার পোর্টাল',
    items: [
      { label: 'আমার ইউনিট', href: '/customer', icon: Home },
      { label: 'নির্মাণ অগ্রগতি', href: '/customer/progress', icon: HardHat, upcomingPhase: 5 },
      { label: 'পেমেন্ট', href: '/customer/payments', icon: CreditCard, upcomingPhase: 5 },
      { label: 'ডকুমেন্ট', href: '/customer/documents', icon: FileText, upcomingPhase: 5 },
    ],
  },
};

export function getPanel(basePath: string): Panel {
  const panel = PANELS[basePath];
  if (!panel) throw new Error(`Unknown panel basePath: ${basePath}`);
  return panel;
}
