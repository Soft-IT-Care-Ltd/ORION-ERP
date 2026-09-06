import type { Role } from '@prisma/client';

/**
 * Role-Based Access Control — PRD সেকশন ৪ (Permission Matrix)
 *
 * Phase 0 এ base mapping দেওয়া আছে (route access + permission matrix)।
 * Phase 1 এ প্রতিটি module এর fine-grained ownership rule (যেমন MARKETING শুধু
 * নিজের assigned lead দেখবে) এই ফাইলেই এক্সটেন্ড হবে।
 */

export const ROLES = ['ADMIN', 'MARKETING', 'ENGINEER', 'ACCOUNTS', 'CUSTOMER'] as const;

/** প্রতিটি role লগইনের পর যে panel এ ল্যান্ড করবে */
export const ROLE_HOME: Record<Role, string> = {
  ADMIN: '/admin',
  MARKETING: '/sales',
  ENGINEER: '/engineer',
  ACCOUNTS: '/accounts',
  CUSTOMER: '/customer',
};

/**
 * কোন route prefix কোন role রা অ্যাক্সেস করতে পারবে।
 * ADMIN operational প্যানেলগুলো দেখতে পারে (PRD সেকশন ৪ — full visibility), কিন্তু
 * `/customer` শুধু CUSTOMER এর — ওই পোর্টাল লগইন করা ইউজারের নিজের Customer
 * রেকর্ডের উপর নির্ভরশীল, যা অন্য role এর থাকে না।
 */
export const ROUTE_ROLES: Record<string, Role[]> = {
  '/admin': ['ADMIN'],
  '/sales': ['ADMIN', 'MARKETING'],
  '/engineer': ['ADMIN', 'ENGINEER'],
  '/accounts': ['ADMIN', 'ACCOUNTS'],
  '/customer': ['CUSTOMER'],
  // পেমেন্ট রসিদ কোনো একটি প্যানেলের নয় — Accounts যেটি তৈরি করে, Customer সেটিই
  // ডাউনলোড করেন (PRD সেকশন ৫.৩ ও ৫.৪)। রসিদটি নিজের কি না, সেই ownership যাচাই
  // পেজেই হয় (`app/receipts/[paymentId]/page.tsx`)।
  '/receipts': ['ADMIN', 'ACCOUNTS', 'CUSTOMER'],
};

/** সব permission key — PRD সেকশন ৪ এর row গুলোর কোড-রূপ */
export type Permission =
  | 'lead:create'
  | 'lead:edit'
  | 'lead:viewAll'
  | 'lead:viewOwn'
  | 'lead:changeStage'
  | 'lead:convert'
  | 'project:manage'
  | 'phase:update'
  | 'phase:view'
  | 'paymentPlan:manage'
  | 'paymentPlan:view'
  | 'payment:create'
  | 'receipt:generate'
  | 'receipt:download'
  | 'document:upload'
  | 'document:viewOwn'
  | 'document:viewAll'
  | 'report:full'
  | 'report:ownPerformance'
  | 'report:siteProgress'
  | 'report:financial'
  | 'user:manage';

const ALL_PERMISSIONS: Permission[] = [
  'lead:create',
  'lead:edit',
  'lead:viewAll',
  'lead:viewOwn',
  'lead:changeStage',
  'lead:convert',
  'project:manage',
  'phase:update',
  'phase:view',
  'paymentPlan:manage',
  'paymentPlan:view',
  'payment:create',
  'receipt:generate',
  'receipt:download',
  'document:upload',
  'document:viewOwn',
  'document:viewAll',
  'report:full',
  'report:ownPerformance',
  'report:siteProgress',
  'report:financial',
  'user:manage',
];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  // Admin — সব কিছু
  ADMIN: ALL_PERMISSIONS,

  // Marketing Executive — শুধু নিজের লিড
  MARKETING: [
    'lead:create',
    'lead:edit',
    'lead:viewOwn',
    'lead:changeStage',
    'lead:convert',
    'document:upload',
    'report:ownPerformance',
  ],

  // Site Engineer — assigned project এর phase update
  ENGINEER: ['phase:update', 'phase:view', 'document:upload', 'report:siteProgress'],

  // Accounts — payment plan ও collection
  ACCOUNTS: [
    'paymentPlan:manage',
    'paymentPlan:view',
    'payment:create',
    'receipt:generate',
    'document:upload',
    'report:financial',
  ],

  // Customer — শুধু নিজের ডেটা, read-only
  CUSTOMER: ['phase:view', 'paymentPlan:view', 'receipt:download', 'document:viewOwn'],
};

/** এই role টির কি এই permission আছে? */
export function can(role: Role | undefined | null, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/** এই role টি কি এই path টিতে ঢুকতে পারবে? (protected prefix না হলে true) */
export function canAccessRoute(role: Role | undefined | null, pathname: string): boolean {
  const prefix = Object.keys(ROUTE_ROLES).find(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  if (!prefix) return true; // public / non-panel route
  if (!role) return false;
  return ROUTE_ROLES[prefix].includes(role);
}

/** লগইনের পর role অনুযায়ী ল্যান্ডিং পেজ */
export function homeForRole(role: Role | undefined | null): string {
  return role ? ROLE_HOME[role] : '/login';
}

/** UI তে দেখানোর জন্য বাংলা লেবেল */
export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: 'অ্যাডমিন',
  MARKETING: 'মার্কেটিং (সেলস)',
  ENGINEER: 'সাইট ইঞ্জিনিয়ার',
  ACCOUNTS: 'অ্যাকাউন্টস',
  CUSTOMER: 'কাস্টমার',
};
