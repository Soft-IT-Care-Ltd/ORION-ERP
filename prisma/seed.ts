import {
  BuildingType,
  ChecklistStatus,
  InstallmentStatus,
  LeadActivityType,
  LeadSource,
  LeadStage,
  LedgerCategory,
  LedgerType,
  PaymentMethod,
  Prisma,
  PrismaClient,
  Role,
} from '@prisma/client';
import bcrypt from 'bcryptjs';
import { computePhaseStatus, DEFAULT_PHASE_TEMPLATE, planPhaseDates } from '../src/lib/phases';
import { formatLedgerReceiptNo } from '../src/lib/ledger';
import { buildProjectTitle } from '../src/lib/projects';
import { computeInstallmentStatus, formatReceiptNo } from '../src/lib/payments';

/**
 * ডেমো ডেটা — v2 (কনস্ট্রাকশন সার্ভিস মডেল)।
 *
 * যা তৈরি হয়:
 *   ১. পাঁচ রোলের ইউজার
 *   ২. গ্লোবাল ফেজ টেমপ্লেট (PRD সেকশন ৫.৪ এর ৭ ধাপ)
 *   ৩. বিভিন্ন প্রি-প্রজেক্ট স্টেজে লিড — কিছুতে চেকলিস্ট ও LedgerEntry সহ
 *   ৪. একটি Won লিড → Project (ফেজ + সাইট আপডেট + PaymentPlan + কিছু Payment)
 *
 * সিডটি বারবার চালানো নিরাপদ: প্রতিটি ধাপ আগে দেখে নেয় ডেটা আছে কি না।
 */

const prisma = new PrismaClient();

const password = process.env.SEED_PASSWORD ?? 'Orion@1234';

const users: { name: string; email: string; phone: string; role: Role }[] = [
  { name: 'Neshad Al Kafian', email: 'admin@orionbuilders.com', phone: '01700000001', role: Role.ADMIN },
  { name: 'Sohel Rana', email: 'sales@orionbuilders.com', phone: '01700000002', role: Role.MARKETING },
  { name: 'Engr. Tanvir Hasan', email: 'engineer@orionbuilders.com', phone: '01700000003', role: Role.ENGINEER },
  { name: 'Farhana Akter', email: 'accounts@orionbuilders.com', phone: '01700000004', role: Role.ACCOUNTS },
  { name: 'মোঃ রফিকুল ইসলাম', email: 'customer@example.com', phone: '01700000005', role: Role.CUSTOMER },
];

/** আজ থেকে `days` দিন পরে/আগে (ঋণাত্মক = অতীত) — ফলো-আপ ডেমো ডেটার জন্য */
function daysFromNow(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(12, 0, 0, 0);
  return d;
}

/* ────────────────────────────────────────────────────────── লিড ডেটা */

type ChecklistSeed = { label: string; done?: boolean; note?: string };
type LedgerSeed = {
  type: LedgerType;
  category: LedgerCategory;
  amount: number;
  daysAgo: number;
  note?: string;
};

type LeadSeed = {
  name: string;
  phone: string;
  residenceCountry?: string;
  email?: string;
  source: LeadSource;
  stage: LeadStage;
  projectLocation?: string;
  landSize?: string;
  buildingType?: BuildingType;
  budgetMin?: number;
  budgetMax?: number;
  followUpInDays?: number;
  lostReason?: string;
  localContactName?: string;
  localContactPhone?: string;
  localContactRelation?: string;
  checklist?: ChecklistSeed[];
  ledger?: LedgerSeed[];
  /** এই লিডটিই Won হয়ে প্রজেক্টে রূপ নেবে (একটিই) */
  convert?: {
    totalContractValue: number;
    ratePerSqft: number;
    totalSqft: number;
    /** কত দিন আগে নির্মাণ শুরু হয়েছে */
    startedDaysAgo: number;
    floors: number;
    cameraStreamUrl: string;
  };
};

/**
 * ডেমো লিড — বোর্ডের প্রতিটি স্তম্ভে অন্তত একটি করে, যাতে পাইপলাইন ফাঁকা না লাগে।
 * phone সবসময় E.164 (PRD সেকশন ৫.১ — প্রবাসী ক্লায়েন্ট নিজের দেশের নম্বর দেন)।
 */
const demoLeads: LeadSeed[] = [
  {
    name: 'সালমা বেগম',
    phone: '+8801711111102',
    residenceCountry: 'BD',
    source: LeadSource.WEBSITE,
    stage: LeadStage.INQUIRY,
    projectLocation: 'বয়রা, খুলনা — নিজস্ব জমি',
    landSize: '৩ কাঠা',
    buildingType: BuildingType.ONE_STORY,
    budgetMin: 3500000,
    budgetMax: 4200000,
    followUpInDays: 3,
  },
  {
    name: 'আবদুল করিম',
    phone: '+966551234503',
    residenceCountry: 'SA',
    email: 'karim@example.com',
    source: LeadSource.REFERRAL,
    stage: LeadStage.DISCUSSION,
    projectLocation: 'দৌলতপুর, খুলনা',
    landSize: '৫ কাঠা',
    buildingType: BuildingType.DUPLEX,
    budgetMin: 6000000,
    budgetMax: 7500000,
    followUpInDays: -2,
    localContactName: 'আনোয়ার হোসেন',
    localContactPhone: '+8801711111203',
    localContactRelation: 'বন্ধু',
    checklist: [{ label: 'জমির দলিলের কপি সংগ্রহ' }],
  },
  {
    name: 'নুসরাত জাহান',
    phone: '+447700900505',
    residenceCountry: 'GB',
    email: 'nusrat@example.com',
    source: LeadSource.EXHIBITION,
    stage: LeadStage.SITE_VISIT_SCHEDULED,
    projectLocation: 'খালিশপুর, খুলনা',
    landSize: '৪ কাঠা',
    buildingType: BuildingType.TWO_STORY,
    budgetMin: 5000000,
    budgetMax: 6000000,
    followUpInDays: 2,
    localContactName: 'রেহানা পারভীন',
    localContactPhone: '+8801711111205',
    localContactRelation: 'বোন',
  },
  {
    name: 'মাহবুব হোসেন',
    phone: '+60123456506',
    residenceCountry: 'MY',
    source: LeadSource.COLD_CALL,
    stage: LeadStage.SITE_VISIT_DONE,
    projectLocation: 'রূপসা, খুলনা',
    landSize: '৬ কাঠা',
    buildingType: BuildingType.THREE_STORY,
    budgetMin: 4800000,
    followUpInDays: 5,
    localContactName: 'শফিক মিয়া',
    localContactPhone: '+8801711111206',
    localContactRelation: 'আত্মীয়',
    checklist: [
      { label: 'সাইট ভিজিট সম্পন্ন', done: true, note: 'জমি সমতল, রাস্তা ভালো' },
      { label: 'জমির দলিলের কপি সংগ্রহ' },
    ],
    // দূরবর্তী সাইট — ভিজিট বিলযোগ্য করা হয়েছে (PRD সেকশন ৫.২)
    ledger: [
      {
        type: LedgerType.INCOME,
        category: LedgerCategory.SITE_VISIT,
        amount: 3000,
        daysAgo: 12,
        note: 'দূরবর্তী সাইট ভিজিট চার্জ',
      },
      {
        type: LedgerType.EXPENSE,
        category: LedgerCategory.SITE_VISIT,
        amount: 1800,
        daysAgo: 12,
        note: 'যাতায়াত ও সার্ভেয়ার খরচ',
      },
    ],
  },
  {
    name: 'ইঞ্জি. সাইফুল ইসলাম',
    phone: '+97455123508',
    residenceCountry: 'QA',
    email: 'saiful@example.com',
    source: LeadSource.REFERRAL,
    stage: LeadStage.SOIL_TEST,
    projectLocation: 'গল্লামারী, খুলনা',
    landSize: '৮ কাঠা',
    buildingType: BuildingType.FIVE_PLUS_STORY,
    budgetMin: 7000000,
    budgetMax: 8000000,
    followUpInDays: 7,
    localContactName: 'নাসির উদ্দিন',
    localContactPhone: '+8801711111208',
    localContactRelation: 'ভাই',
    checklist: [
      { label: 'সাইট ভিজিট সম্পন্ন', done: true },
      { label: 'ডিজিটাল সার্ভে সম্পন্ন', done: true, note: 'বড় জমি — সার্ভে দরকার ছিল' },
      { label: 'সয়েল টেস্ট রিপোর্ট পাওয়া গেছে' },
    ],
    // বহুতল ভবন — সয়েল টেস্ট বাধ্যতামূলক ও চার্জযোগ্য
    ledger: [
      {
        type: LedgerType.INCOME,
        category: LedgerCategory.SOIL_TEST,
        amount: 25000,
        daysAgo: 6,
        note: '৩ পয়েন্ট সয়েল টেস্ট',
      },
      {
        type: LedgerType.EXPENSE,
        category: LedgerCategory.SOIL_TEST,
        amount: 17500,
        daysAgo: 5,
        note: 'ভেন্ডর ল্যাব বিল',
      },
    ],
  },
  {
    name: 'ফারুক হাসান',
    phone: '+393331234509',
    residenceCountry: 'IT',
    source: LeadSource.WEBSITE,
    stage: LeadStage.DESIGN_IN_PROGRESS,
    projectLocation: 'নিরালা, খুলনা',
    landSize: '৫ কাঠা',
    buildingType: BuildingType.THREE_STORY,
    budgetMin: 6500000,
    followUpInDays: 4,
    localContactName: 'জাহানারা বেগম',
    localContactPhone: '+8801711111209',
    localContactRelation: 'মা',
    checklist: [
      { label: 'সাইট ভিজিট সম্পন্ন', done: true },
      { label: 'জমির দলিলের কপি সংগ্রহ', done: true },
      { label: 'ডিজাইন ক্লায়েন্টকে পাঠানো হয়েছে' },
    ],
    ledger: [
      {
        type: LedgerType.INCOME,
        category: LedgerCategory.DESIGN,
        amount: 40000,
        daysAgo: 20,
        note: 'আর্কিটেকচারাল ডিজাইন ফি (প্রথম কিস্তি)',
      },
      {
        type: LedgerType.EXPENSE,
        category: LedgerCategory.DESIGN,
        amount: 22000,
        daysAgo: 18,
        note: 'ফ্রিল্যান্স আর্কিটেক্ট পেমেন্ট',
      },
    ],
  },
  {
    name: 'শারমিন আক্তার',
    phone: '+8801711111107',
    residenceCountry: 'BD',
    source: LeadSource.FACEBOOK_ADS,
    stage: LeadStage.DESIGN_APPROVED,
    projectLocation: 'সোনাডাঙ্গা, খুলনা',
    landSize: '৪ কাঠা',
    buildingType: BuildingType.DUPLEX,
    budgetMin: 5200000,
    budgetMax: 5800000,
    followUpInDays: -1,
    checklist: [
      { label: 'সাইট ভিজিট সম্পন্ন', done: true },
      { label: 'ডিজাইন ক্লায়েন্টকে পাঠানো হয়েছে', done: true },
      { label: 'কোটেশন approve হয়েছে' },
    ],
  },
  {
    name: 'তানভীর আহমেদ',
    phone: '+8801711111104',
    residenceCountry: 'BD',
    source: LeadSource.WALK_IN,
    stage: LeadStage.QUOTATION_SENT,
    projectLocation: 'মুজগুন্নী, খুলনা',
    landSize: '৩.৫ কাঠা',
    buildingType: BuildingType.TWO_STORY,
    budgetMin: 4400000,
    budgetMax: 5000000,
    followUpInDays: 0,
  },
  {
    name: 'কামরুল ইসলাম',
    phone: '+971501234513',
    residenceCountry: 'AE',
    email: 'kamrul@example.com',
    source: LeadSource.FACEBOOK_ADS,
    stage: LeadStage.GOVT_APPROVAL,
    projectLocation: 'শিববাড়ি, খুলনা',
    landSize: '৭ কাঠা',
    buildingType: BuildingType.FOUR_STORY,
    budgetMin: 9000000,
    budgetMax: 11000000,
    followUpInDays: 6,
    localContactName: 'মোঃ সেলিম',
    localContactPhone: '+8801711111213',
    localContactRelation: 'ভাই',
    checklist: [
      { label: 'সাইট ভিজিট সম্পন্ন', done: true },
      { label: 'সয়েল টেস্ট রিপোর্ট পাওয়া গেছে', done: true },
      { label: 'কোটেশন approve হয়েছে', done: true },
      { label: 'KCC অনুমোদনের ফাইল জমা' },
    ],
    ledger: [
      {
        type: LedgerType.INCOME,
        category: LedgerCategory.GOVT_APPROVAL,
        amount: 60000,
        daysAgo: 10,
        note: 'KCC নকশা অনুমোদন প্রসেসিং ফি',
      },
      {
        type: LedgerType.EXPENSE,
        category: LedgerCategory.GOVT_APPROVAL,
        amount: 41000,
        daysAgo: 9,
        note: 'সরকারি ফি ও কনসালট্যান্ট',
      },
    ],
  },
  {
    name: 'রোকেয়া সুলতানা',
    phone: '+8801711111110',
    residenceCountry: 'BD',
    source: LeadSource.WALK_IN,
    stage: LeadStage.NEGOTIATION,
    projectLocation: 'বসুপাড়া, খুলনা',
    landSize: '৪ কাঠা',
    buildingType: BuildingType.TWO_STORY,
    budgetMin: 5500000,
    budgetMax: 6200000,
    followUpInDays: 1,
  },
  {
    name: 'জাহিদ হাসান',
    phone: '+96550123511',
    residenceCountry: 'KW',
    source: LeadSource.COLD_CALL,
    stage: LeadStage.LOST,
    projectLocation: 'ফুলবাড়ীগেট, খুলনা',
    landSize: '২.৫ কাঠা',
    buildingType: BuildingType.ONE_STORY,
    budgetMin: 3000000,
    lostReason: 'Price too high',
  },
  {
    name: 'মিতু রহমান',
    phone: '+8801711111112',
    residenceCountry: 'BD',
    source: LeadSource.FACEBOOK_ADS,
    stage: LeadStage.LOST,
    lostReason: 'No response',
  },
  // ── Won → Project (নিচের `seedProject` এই লিডটিকেই কনভার্ট করে) ─────────
  {
    name: 'মোঃ রফিকুল ইসলাম',
    phone: '+971501234501',
    residenceCountry: 'AE',
    email: 'customer@example.com',
    source: LeadSource.FACEBOOK_ADS,
    stage: LeadStage.WON,
    projectLocation: 'সোনাডাঙ্গা, খুলনা — নিজস্ব জমি',
    landSize: '৪.৫ কাঠা',
    buildingType: BuildingType.THREE_STORY,
    budgetMin: 4500000,
    budgetMax: 5500000,
    localContactName: 'মোঃ করিম',
    localContactPhone: '+8801711111201',
    localContactRelation: 'ভাই',
    checklist: [
      { label: 'সাইট ভিজিট সম্পন্ন', done: true },
      { label: 'জমির দলিলের কপি সংগ্রহ', done: true },
      { label: 'সয়েল টেস্ট রিপোর্ট পাওয়া গেছে', done: true },
      { label: 'ডিজাইন ক্লায়েন্টকে পাঠানো হয়েছে', done: true },
      { label: 'কোটেশন approve হয়েছে', done: true },
    ],
    ledger: [
      {
        type: LedgerType.INCOME,
        category: LedgerCategory.SOIL_TEST,
        amount: 20000,
        daysAgo: 220,
        note: 'সয়েল টেস্ট — ২ পয়েন্ট',
      },
      {
        type: LedgerType.EXPENSE,
        category: LedgerCategory.SOIL_TEST,
        amount: 14000,
        daysAgo: 219,
        note: 'ল্যাব ভেন্ডর বিল',
      },
      {
        type: LedgerType.INCOME,
        category: LedgerCategory.DESIGN,
        amount: 55000,
        daysAgo: 205,
        note: 'ডিজাইন ও ৩D রেন্ডার',
      },
      {
        type: LedgerType.EXPENSE,
        category: LedgerCategory.DESIGN,
        amount: 30000,
        daysAgo: 203,
        note: 'আর্কিটেক্ট ফি',
      },
      {
        type: LedgerType.INCOME,
        category: LedgerCategory.GOVT_APPROVAL,
        amount: 75000,
        daysAgo: 190,
        note: 'KCC অনুমোদন',
      },
      {
        type: LedgerType.EXPENSE,
        category: LedgerCategory.GOVT_APPROVAL,
        amount: 52000,
        daysAgo: 188,
        note: 'সরকারি ফি',
      },
    ],
    convert: {
      totalContractValue: 6_000_000,
      ratePerSqft: 2200,
      totalSqft: 2700,
      startedDaysAgo: 260,
      floors: 3,
      // ডেমো embed — অ্যাডমিন আসল ভেন্ডর লিংক বসাবেন (PRD সেকশন ৫.৪)
      cameraStreamUrl: 'https://www.youtube.com/embed/videoseries?list=PLxxxxxxxx',
    },
  },
];

/** কনস্ট্রাকশন কিস্তির ডেমো শিডিউল — PRD সেকশন ৫.৫ এর ফেজ-ভিত্তিক টেবিল */
const installmentPlan: {
  label: string;
  /** কোন ফেজের সাথে বাঁধা (টেমপ্লেটের নাম) — signup money কোনোটির নয় */
  phaseName?: string;
  amount: number;
  /** নির্মাণ শুরুর কত দিন পরে due */
  dueAfterDays: number;
}[] = [
  { label: 'Signup Money', amount: 500000, dueAfterDays: 0 },
  { label: 'Foundation Complete', phaseName: 'Foundation Work', amount: 800000, dueAfterDays: 55 },
  {
    label: '1st Floor Structure',
    phaseName: 'Structure (Column/Beam/Slab)',
    amount: 900000,
    dueAfterDays: 130,
  },
  {
    label: '2nd Floor Structure',
    phaseName: 'Structure (Column/Beam/Slab)',
    amount: 900000,
    dueAfterDays: 200,
  },
  {
    label: '3rd Floor Structure',
    phaseName: 'Structure (Column/Beam/Slab)',
    amount: 900000,
    dueAfterDays: 270,
  },
  {
    label: 'Brick & Plaster Complete',
    phaseName: 'Brick Work & Plaster',
    amount: 700000,
    dueAfterDays: 350,
  },
  {
    label: 'Electrical / Plumbing Complete',
    phaseName: 'Electrical, Plumbing & Sanitary',
    amount: 500000,
    dueAfterDays: 400,
  },
  {
    label: 'Finishing 50%',
    phaseName: 'Finishing (Tiles, Paint, Fittings)',
    amount: 500000,
    dueAfterDays: 460,
  },
  {
    label: 'On Handover',
    phaseName: 'Final Inspection & Handover',
    amount: 300000,
    dueAfterDays: 520,
  },
];

/* ────────────────────────────────────────────────────── seed helpers */

/** গ্লোবাল ফেজ টেমপ্লেট — Lead → Project কনভার্শনে এখান থেকেই ফেজ কপি হয় */
async function seedPhaseTemplate() {
  const existing = await prisma.phaseTemplate.count();
  if (existing > 0) {
    console.log(`\nℹ ফেজ টেমপ্লেট আগে থেকেই আছে (${existing} টি ধাপ) — স্কিপ`);
    return;
  }

  await prisma.phaseTemplate.createMany({
    data: DEFAULT_PHASE_TEMPLATE.map((t, index) => ({
      name: t.name,
      order: index + 1,
      defaultDurationDays: t.defaultDurationDays,
    })),
  });

  console.log(`\n✔ গ্লোবাল ফেজ টেমপ্লেট — ${DEFAULT_PHASE_TEMPLATE.length} টি ধাপ`);
}

/** লিড + তার চেকলিস্ট ও লেজার এন্ট্রি */
async function seedLeads(marketingId: string, accountsId: string) {
  const existing = await prisma.lead.count();
  if (existing > 0) {
    console.log(`\nℹ ${existing} টি লিড আগে থেকেই আছে — ডেমো লিড স্কিপ করা হলো`);
    return;
  }

  let receiptSeq = 0;
  let checklistCount = 0;
  let ledgerCount = 0;

  for (const l of demoLeads) {
    const lead = await prisma.lead.create({
      data: {
        name: l.name,
        phone: l.phone,
        residenceCountry: l.residenceCountry ?? null,
        email: l.email ?? null,
        source: l.source,
        stage: l.stage,
        lostReason: l.lostReason ?? null,
        projectLocation: l.projectLocation ?? null,
        landSize: l.landSize ?? null,
        buildingType: l.buildingType ?? null,
        budgetMin: l.budgetMin ?? null,
        budgetMax: l.budgetMax ?? null,
        localContactName: l.localContactName ?? null,
        localContactPhone: l.localContactPhone ?? null,
        localContactRelation: l.localContactRelation ?? null,
        assignedToId: marketingId,
        nextFollowUpAt:
          l.followUpInDays === undefined ? null : daysFromNow(l.followUpInDays),
      },
    });

    await prisma.leadActivity.create({
      data: {
        leadId: lead.id,
        type: LeadActivityType.CREATED,
        note: 'লিড তৈরি করা হয়েছে (ডেমো ডেটা)',
        createdById: marketingId,
      },
    });

    if (l.stage !== LeadStage.INQUIRY) {
      await prisma.leadActivity.create({
        data: {
          leadId: lead.id,
          type: LeadActivityType.STAGE_CHANGED,
          note: `স্টেজ: INQUIRY → ${l.stage}`,
          createdById: marketingId,
        },
      });
    }

    for (const item of l.checklist ?? []) {
      await prisma.leadChecklistItem.create({
        data: {
          leadId: lead.id,
          label: item.label,
          note: item.note ?? null,
          status: item.done ? ChecklistStatus.DONE : ChecklistStatus.PENDING,
          doneById: item.done ? marketingId : null,
          doneAt: item.done ? daysFromNow(-5) : null,
        },
      });
      checklistCount += 1;
    }

    for (const entry of l.ledger ?? []) {
      const date = daysFromNow(-entry.daysAgo);
      const isIncome = entry.type === LedgerType.INCOME;
      await prisma.ledgerEntry.create({
        data: {
          leadId: lead.id,
          type: entry.type,
          category: entry.category,
          amount: new Prisma.Decimal(entry.amount),
          date,
          note: entry.note ?? null,
          // PRD সেকশন ৫.২ — শুধু client-facing income entry তে রসিদ নম্বর
          receiptNo: isIncome ? formatLedgerReceiptNo(date, (receiptSeq += 1)) : null,
          // PRD সেকশন ৪ — খরচ ক্লায়েন্ট কখনো দেখবে না
          clientVisible: isIncome,
          createdById: accountsId,
        },
      });
      ledgerCount += 1;
    }
  }

  console.log(
    `\n✔ ${demoLeads.length} টি ডেমো লিড · ${checklistCount} টি চেকলিস্ট আইটেম` +
      ` · ${ledgerCount} টি লেজার এন্ট্রি`,
  );
}

/**
 * Won লিডটিকে সম্পূর্ণ প্রজেক্টে রূপ দেওয়া — PRD সেকশন ৫.৩ থেকে ৫.৫ পর্যন্ত পুরো
 * চেইন: Customer → Project → Phase (টেমপ্লেট থেকে, কিছুতে অগ্রগতি) → PhaseUpdate
 * → PaymentPlan → Installment (কিছু paid, একটি partial, বাকি pending/overdue)।
 *
 * উদ্দেশ্য টেস্ট করার মতো একটি *বাস্তব* অ্যাকাউন্ট: Accounts প্যানেলে শিডিউল ও
 * aging রিপোর্ট, কাস্টমার পোর্টালে "কত দিয়েছি / কত বাকি" ও লাইভ ক্যামেরা, আর
 * রসিদ প্রিন্ট — সব কটাই ডেটা ছাড়া ফাঁকা দেখাত।
 */
async function seedProject(marketingId: string, accountsId: string, engineerId: string) {
  const existing = await prisma.project.count();
  if (existing > 0) {
    console.log(`\nℹ ${existing} টি প্রজেক্ট আগে থেকেই আছে — ডেমো প্রজেক্ট স্কিপ করা হলো`);
    return;
  }

  const seed = demoLeads.find((l) => l.convert);
  if (!seed?.convert) return;

  const lead = await prisma.lead.findFirst({
    where: { phone: seed.phone },
    select: { id: true, name: true, phone: true, email: true, projectLocation: true, buildingType: true },
  });
  if (!lead) return;

  // কাস্টমার ইউজারটি `users` তালিকা থেকেই তৈরি হয়ে আছে — তার Customer প্রোফাইল নেওয়া
  const customerUser = await prisma.user.findUnique({
    where: { email: 'customer@example.com' },
    select: { id: true, name: true, customer: { select: { id: true } } },
  });
  if (!customerUser?.customer) return;

  const startDate = daysFromNow(-seed.convert.startedDaysAgo);
  const templates = await prisma.phaseTemplate.findMany({
    select: { name: true, order: true, defaultDurationDays: true },
    orderBy: { order: 'asc' },
  });
  const dates = planPhaseDates(templates, startDate);

  const project = await prisma.project.create({
    data: {
      leadId: lead.id,
      customerId: customerUser.customer.id,
      title: buildProjectTitle(lead),
      landLocation: lead.projectLocation,
      buildingType: lead.buildingType,
      floors: seed.convert.floors,
      totalSqft: new Prisma.Decimal(seed.convert.totalSqft),
      ratePerSqft: new Prisma.Decimal(seed.convert.ratePerSqft),
      totalContractValue: new Prisma.Decimal(seed.convert.totalContractValue),
      startDate,
      cameraStreamUrl: seed.convert.cameraStreamUrl,
      engineerId,
      phases: {
        create: templates.map((t, index) => ({
          name: t.name,
          order: t.order,
          plannedStart: dates[index].plannedStart,
          plannedEnd: dates[index].plannedEnd,
        })),
      },
    },
    select: { id: true, title: true },
  });

  await prisma.leadActivity.create({
    data: {
      leadId: lead.id,
      type: LeadActivityType.NOTE,
      note: `প্রজেক্ট তৈরি হয়েছে — ${project.title} (ডেমো ডেটা)`,
      createdById: marketingId,
    },
  });

  /* ------------------------------------------------------ ফেজ অগ্রগতি */

  const now = new Date();
  const phases = await prisma.phase.findMany({
    where: { projectId: project.id },
    select: { id: true, name: true, order: true, plannedStart: true, plannedEnd: true },
    orderBy: { order: 'asc' },
  });

  // প্রথম দুটি ফেজ শেষ, তৃতীয়টি অর্ধেক — বাকিগুলো আসন্ন
  const progressByOrder: Record<number, number> = { 1: 100, 2: 100, 3: 50 };
  const updateNotes = [
    'কাজ শুরু হয়েছে — মালামাল সাইটে পৌঁছেছে',
    'অর্ধেক সম্পন্ন, মান যাচাই করা হয়েছে',
    'কাজ শেষ — পরবর্তী ফেজের প্রস্তুতি চলছে',
  ];

  let updateCount = 0;
  for (const phase of phases) {
    const percent = progressByOrder[phase.order] ?? 0;
    if (percent === 0) continue;

    await prisma.phase.update({
      where: { id: phase.id },
      data: {
        percentComplete: percent,
        status: computePhaseStatus({ percentComplete: percent, plannedEnd: phase.plannedEnd }, now),
        actualStart: phase.plannedStart,
        actualEnd: percent >= 100 ? phase.plannedEnd : null,
      },
    });

    const steps = percent >= 100 ? [25, 75, 100] : [25, percent];
    for (const [index, step] of steps.entries()) {
      await prisma.phaseUpdate.create({
        data: {
          phaseId: phase.id,
          updatedById: engineerId,
          percentComplete: step,
          note: `${phase.name}: ${updateNotes[Math.min(index, updateNotes.length - 1)]} (ডেমো ডেটা)`,
          photoUrls: [],
          createdAt: daysFromNow(-30 * (steps.length - index)),
        },
      });
      updateCount += 1;
    }
  }

  /* ---------------------------------------------------- পেমেন্ট প্ল্যান */

  const phaseIdByName = new Map(phases.map((p) => [p.name, p.id]));
  const totalContract = seed.convert.totalContractValue;

  const plan = await prisma.paymentPlan.create({
    data: { projectId: project.id },
    select: { id: true },
  });

  const installments = [];
  for (const [index, row] of installmentPlan.entries()) {
    const dueDate = new Date(startDate);
    dueDate.setDate(dueDate.getDate() + row.dueAfterDays);

    installments.push(
      await prisma.installment.create({
        data: {
          paymentPlanId: plan.id,
          phaseId: row.phaseName ? (phaseIdByName.get(row.phaseName) ?? null) : null,
          label: row.label,
          order: index + 1,
          dueDate,
          amount: new Prisma.Decimal(row.amount),
          percentage: new Prisma.Decimal(
            Math.round((row.amount / totalContract) * 10000) / 100,
          ),
        },
        select: { id: true, label: true, amount: true, dueDate: true },
      }),
    );
  }

  // প্রথম তিনটি পুরো পরিশোধিত, চতুর্থটি আংশিক — বাকিগুলো pending/overdue
  const paidPlan: { index: number; ratio: number }[] = [
    { index: 0, ratio: 1 },
    { index: 1, ratio: 1 },
    { index: 2, ratio: 1 },
    { index: 3, ratio: 0.5 },
  ];
  const methods = [PaymentMethod.BANK_TRANSFER, PaymentMethod.CASH, PaymentMethod.BKASH, PaymentMethod.CHEQUE];

  let collected = 0;
  for (const [n, { index, ratio }] of paidPlan.entries()) {
    const installment = installments[index];
    if (!installment) continue;

    const amount = Math.round(Number(installment.amount) * ratio);
    const paidAt = new Date(installment.dueDate);
    paidAt.setDate(paidAt.getDate() - 2);

    await prisma.payment.create({
      data: {
        installmentId: installment.id,
        amountReceived: new Prisma.Decimal(amount),
        method: methods[n % methods.length],
        receiptNo: formatReceiptNo(paidAt.getFullYear(), n + 1),
        note: ratio < 1 ? 'আংশিক পরিশোধ — বাকিটা পরের মাসে' : null,
        receivedById: accountsId,
        paidAt,
      },
    });
    collected += amount;

    await prisma.installment.update({
      where: { id: installment.id },
      data: {
        status: computeInstallmentStatus(
          { amount: Number(installment.amount), dueDate: installment.dueDate },
          amount,
          now,
        ),
      },
    });
  }

  // বাকিগুলোর স্ট্যাটাস আজকের তারিখ ধরে (কিছু OVERDUE হয়ে যাবে)
  for (const installment of installments.slice(paidPlan.length)) {
    await prisma.installment.update({
      where: { id: installment.id },
      data: {
        status: computeInstallmentStatus(
          { amount: Number(installment.amount), dueDate: installment.dueDate },
          0,
          now,
        ),
      },
    });
  }

  const overdue = await prisma.installment.count({
    where: { paymentPlanId: plan.id, status: InstallmentStatus.OVERDUE },
  });

  // কাস্টমারের বেলে কিছু খবর — পোর্টাল খালি না দেখানোর জন্য
  await prisma.notification.createMany({
    data: [
      {
        userId: customerUser.id,
        type: 'PAYMENT_DUE',
        message: `${overdue} টি কিস্তি বকেয়া — অনুগ্রহ করে পরিশোধ করুন`,
        link: '/customer/payments',
        key: `seed-overdue:${project.id}`,
      },
      {
        userId: customerUser.id,
        type: 'PHASE_MILESTONE',
        message: `"Foundation Work" ফেজ সম্পন্ন হয়েছে — ${project.title}`,
        link: '/customer/progress',
        key: `seed-phase:${project.id}`,
      },
    ],
    skipDuplicates: true,
  });

  console.log(
    `\n✔ প্রজেক্ট তৈরি হয়েছে — ${project.title}` +
      `\n  ${phases.length} টি ফেজ · ${updateCount} টি সাইট আপডেট` +
      `\n  ${installments.length} টি কিস্তি · ${paidPlan.length} টি পেমেন্ট জমা · ${overdue} টি বকেয়া` +
      `\n  মোট ৳${totalContract.toLocaleString('en-IN')} এর মধ্যে ৳${collected.toLocaleString('en-IN')} আদায়`,
  );
}

/* ─────────────────────────────────────────────────────────────── main */

async function main() {
  const passwordHash = await bcrypt.hash(password, 10);
  let marketingId: string | undefined;
  let engineerId: string | undefined;
  let accountsId: string | undefined;

  for (const u of users) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, phone: u.phone, role: u.role, active: true },
      create: { ...u, passwordHash },
    });

    // CUSTOMER role এর জন্য Customer profile ও দরকার (Project এর FK)
    if (u.role === Role.CUSTOMER) {
      await prisma.customer.upsert({
        where: { userId: user.id },
        update: {},
        create: { userId: user.id, address: 'Khulna, Bangladesh' },
      });
    }

    if (u.role === Role.MARKETING) marketingId = user.id;
    if (u.role === Role.ENGINEER) engineerId = user.id;
    if (u.role === Role.ACCOUNTS) accountsId = user.id;

    console.log(`✔ ${u.role.padEnd(9)} ${u.email}`);
  }

  if (!marketingId || !engineerId || !accountsId) {
    throw new Error('ডেমো স্টাফ ইউজার তৈরি হয়নি — সিড থামানো হলো');
  }

  await seedPhaseTemplate();
  await seedLeads(marketingId, accountsId);
  // লিড তৈরির পরেই — Won লিডটিই প্রজেক্টে রূপ নেয়
  await seedProject(marketingId, accountsId, engineerId);

  console.log(`\nসব ডেমো অ্যাকাউন্টের পাসওয়ার্ড: ${password}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
