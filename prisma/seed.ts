import {
  InstallmentStatus,
  LeadActivityType,
  LeadSource,
  LeadStage,
  PaymentMethod,
  Prisma,
  PrismaClient,
  Role,
  SaleStatus,
  UnitStatus,
} from '@prisma/client';
import bcrypt from 'bcryptjs';
import { computePhaseStatus, DEFAULT_PHASE_TEMPLATE, planPhaseDates } from '../src/lib/phases';
import {
  computeInstallmentStatus,
  DEFAULT_PLAN_TEMPLATE,
  defaultPlanDates,
  formatReceiptNo,
  generateSchedule,
} from '../src/lib/payments';

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

/**
 * Phase 2 ডেমো লিড — পাইপলাইন বোর্ড খালি না থাকার জন্য।
 * phone সবসময় E.164 (PRD সেকশন ৫.১ — প্রবাসী ক্লায়েন্ট নিজের দেশের নম্বর দেন)।
 */
const demoLeads: {
  name: string;
  phone: string;
  residenceCountry?: string;
  email?: string;
  source: LeadSource;
  stage: LeadStage;
  projectLocation?: string;
  budgetMin?: number;
  budgetMax?: number;
  followUpInDays?: number;
  lostReason?: string;
  localContactName?: string;
  localContactPhone?: string;
  localContactRelation?: string;
}[] = [
  { name: 'মোঃ রফিকুল ইসলাম', phone: '+971501234501', residenceCountry: 'AE', email: 'rafiqul@example.com', source: LeadSource.FACEBOOK_ADS, stage: LeadStage.NEW, projectLocation: 'সোনাডাঙ্গা, খুলনা — নিজস্ব জমি', budgetMin: 4500000, budgetMax: 5500000, followUpInDays: 1, localContactName: 'মোঃ করিম', localContactPhone: '+8801711111201', localContactRelation: 'ভাই' },
  { name: 'সালমা বেগম', phone: '+8801711111102', residenceCountry: 'BD', source: LeadSource.WEBSITE, stage: LeadStage.NEW, projectLocation: 'বয়রা, খুলনা', budgetMin: 3500000, budgetMax: 4200000, followUpInDays: 3 },
  { name: 'আবদুল করিম', phone: '+966551234503', residenceCountry: 'SA', email: 'karim@example.com', source: LeadSource.REFERRAL, stage: LeadStage.CONTACTED, projectLocation: 'দৌলতপুর, খুলনা', budgetMin: 6000000, budgetMax: 7500000, followUpInDays: -2, localContactName: 'আনোয়ার হোসেন', localContactPhone: '+8801711111203', localContactRelation: 'বন্ধু' },
  { name: 'তানভীর আহমেদ', phone: '+8801711111104', residenceCountry: 'BD', source: LeadSource.WALK_IN, stage: LeadStage.CONTACTED, followUpInDays: 0 },
  { name: 'নুসরাত জাহান', phone: '+447700900505', residenceCountry: 'GB', email: 'nusrat@example.com', source: LeadSource.EXHIBITION, stage: LeadStage.SITE_VISIT_SCHEDULED, projectLocation: 'খালিশপুর, খুলনা', budgetMin: 5000000, budgetMax: 6000000, followUpInDays: 2, localContactName: 'রেহানা পারভীন', localContactPhone: '+8801711111205', localContactRelation: 'বোন' },
  { name: 'মাহবুব হোসেন', phone: '+60123456506', residenceCountry: 'MY', source: LeadSource.COLD_CALL, stage: LeadStage.SITE_VISIT_DONE, budgetMin: 4800000, followUpInDays: 5, localContactName: 'শফিক মিয়া', localContactPhone: '+8801711111206', localContactRelation: 'আত্মীয়' },
  { name: 'শারমিন আক্তার', phone: '+8801711111107', residenceCountry: 'BD', source: LeadSource.FACEBOOK_ADS, stage: LeadStage.NEGOTIATION, projectLocation: 'রূপসা, খুলনা', budgetMin: 5200000, budgetMax: 5800000, followUpInDays: -1 },
  { name: 'ইঞ্জি. সাইফুল ইসলাম', phone: '+97455123508', residenceCountry: 'QA', email: 'saiful@example.com', source: LeadSource.REFERRAL, stage: LeadStage.BOOKING, projectLocation: 'গল্লামারী, খুলনা', budgetMin: 7000000, budgetMax: 8000000, followUpInDays: 7, localContactName: 'নাসির উদ্দিন', localContactPhone: '+8801711111208', localContactRelation: 'ভাই' },
  { name: 'ফারুক হাসান', phone: '+393331234509', residenceCountry: 'IT', source: LeadSource.WEBSITE, stage: LeadStage.SALE_AGREEMENT_SIGNED, projectLocation: 'নিরালা, খুলনা', budgetMin: 6500000, localContactName: 'জাহানারা বেগম', localContactPhone: '+8801711111209', localContactRelation: 'মা' },
  { name: 'রোকেয়া সুলতানা', phone: '+8801711111110', residenceCountry: 'BD', source: LeadSource.WALK_IN, stage: LeadStage.WON, budgetMin: 5500000, budgetMax: 5500000 },
  { name: 'জাহিদ হাসান', phone: '+96550123511', residenceCountry: 'KW', source: LeadSource.COLD_CALL, stage: LeadStage.LOST, budgetMin: 3000000, lostReason: 'Price too high' },
  { name: 'মিতু রহমান', phone: '+8801711111112', residenceCountry: 'BD', source: LeadSource.FACEBOOK_ADS, stage: LeadStage.LOST, lostReason: 'No response' },
];

/**
 * ডেমো প্রজেক্ট ও ইউনিট — Won → Sale কনভার্শনে ইউনিট বেছে নেওয়া লাগে।
 * পূর্ণ প্রজেক্ট/ইউনিট মডিউল Phase 3 এ আসবে (02_BUILD_PLAN.md)।
 */
const demoProjects: {
  name: string;
  location: string;
  description: string;
  /** নির্মাণ শুরুর তারিখ — ফেজের planned date এখান থেকে হিসাব হয় */
  startDate: Date;
  units: { unitNo: string; sizeSqft: number; price: number; status?: UnitStatus }[];
}[] = [
  {
    name: 'Orion Green',
    location: 'সোনাডাঙ্গা, খুলনা',
    description: '৮ তলা আবাসিক ভবন — ৩ ও ৪ বেডরুম অ্যাপার্টমেন্ট',
    // প্রায় দেড় বছর আগে শুরু — কিছু ফেজ শেষ, কিছু পিছিয়ে
    startDate: daysFromNow(-540),
    units: [
      { unitNo: 'A-1', sizeSqft: 1250, price: 4500000 },
      { unitNo: 'A-2', sizeSqft: 1250, price: 4600000 },
      { unitNo: 'A-3', sizeSqft: 1450, price: 5400000 },
      { unitNo: 'A-4', sizeSqft: 1450, price: 5500000, status: UnitStatus.BOOKED },
      { unitNo: 'B-4', sizeSqft: 1650, price: 6300000 },
    ],
  },
  {
    name: 'Orion Heights',
    location: 'খালিশপুর, খুলনা',
    description: '১০ তলা আবাসিক ভবন — ডুপ্লেক্স সহ',
    startDate: daysFromNow(-240),
    units: [
      { unitNo: 'C-1', sizeSqft: 1550, price: 5900000 },
      { unitNo: 'C-2', sizeSqft: 1550, price: 6000000 },
      { unitNo: 'C-3', sizeSqft: 2100, price: 8200000, status: UnitStatus.ON_HOLD },
      { unitNo: 'D-1', sizeSqft: 2400, price: 9500000 },
    ],
  },
];

async function seedProjects(engineerId: string | undefined) {
  const existing = await prisma.project.count();
  if (existing > 0) {
    console.log(`\nℹ ${existing} টি প্রজেক্ট আগে থেকেই আছে — ডেমো প্রজেক্ট স্কিপ করা হলো`);
    return;
  }

  let unitCount = 0;
  for (const p of demoProjects) {
    await prisma.project.create({
      data: {
        name: p.name,
        location: p.location,
        description: p.description,
        startDate: p.startDate,
        engineerId,
        // PRD সেকশন ৫.২ এর ডিফল্ট ৮-ফেজ টেমপ্লেট
        phaseTemplates: {
          create: DEFAULT_PHASE_TEMPLATE.map((t, index) => ({
            name: t.name,
            order: index + 1,
            defaultDurationDays: t.defaultDurationDays,
          })),
        },
        units: {
          create: p.units.map((u) => ({
            unitNo: u.unitNo,
            sizeSqft: u.sizeSqft,
            price: u.price,
            status: u.status ?? UnitStatus.AVAILABLE,
          })),
        },
      },
    });
    unitCount += p.units.length;
  }

  console.log(`\n✔ ${demoProjects.length} টি প্রজেক্ট ও ${unitCount} টি ইউনিট তৈরি হয়েছে`);
}

/**
 * Phase 3 ডেমো — ফেজ টেমপ্লেট ও টাইমলাইন।
 *
 * Phase 2 এর পুরনো ডাটাবেসেও চলে: যে প্রজেক্টে টেমপ্লেট/শুরুর তারিখ/ইঞ্জিনিয়ার
 * নেই সেখানে ফাঁকা জায়গাগুলো ভরে দেয় (আগের মান কখনো মুছে দেয় না), তারপর যেসব
 * ইউনিটে এখনো ফেজ নেই সেগুলোতে টাইমলাইন বসিয়ে কিছু অগ্রগতিও দেয় — যাতে
 * টাইমলাইন খালি না দেখায়। Admin প্যানেলের "টেমপ্লেট প্রয়োগ" বাটনটিও এই কাজই করে।
 */
async function seedPhases(engineerId: string | undefined) {
  const projects = await prisma.project.findMany({
    select: {
      id: true,
      name: true,
      startDate: true,
      engineerId: true,
      _count: { select: { phaseTemplates: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  let backfilled = 0;

  for (const [index, project] of projects.entries()) {
    const data: { startDate?: Date; engineerId?: string } = {};
    // পুরনো ডেমো প্রজেক্টে শুরুর তারিখ ছিল না — প্রথমটি দেড় বছর, পরেরগুলো ৮ মাস আগে
    if (!project.startDate) data.startDate = daysFromNow(index === 0 ? -540 : -240);
    if (!project.engineerId && engineerId) data.engineerId = engineerId;

    if (Object.keys(data).length > 0) {
      await prisma.project.update({ where: { id: project.id }, data });
    }

    if (project._count.phaseTemplates === 0) {
      await prisma.phaseTemplate.createMany({
        data: DEFAULT_PHASE_TEMPLATE.map((t, order) => ({
          projectId: project.id,
          name: t.name,
          order: order + 1,
          defaultDurationDays: t.defaultDurationDays,
        })),
      });
      backfilled += 1;
    }
  }

  if (backfilled > 0) {
    console.log(`\n✔ ${backfilled} টি প্রজেক্টে ডিফল্ট ৮-ফেজ টেমপ্লেট যোগ করা হয়েছে`);
  }

  const ready = await prisma.project.findMany({
    select: {
      id: true,
      startDate: true,
      phaseTemplates: {
        select: { name: true, order: true, defaultDurationDays: true },
        orderBy: { order: 'asc' },
      },
      units: { select: { id: true, _count: { select: { phases: true } } } },
    },
  });

  const now = new Date();
  let created = 0;
  let skipped = 0;

  for (const project of ready) {
    if (project.phaseTemplates.length === 0) continue;

    const dates = planPhaseDates(project.phaseTemplates, project.startDate);

    for (const [unitIndex, unit] of project.units.entries()) {
      if (unit._count.phases > 0) {
        skipped += 1;
        continue;
      }

      // ইউনিটভেদে আলাদা অগ্রগতি — কয়েকটি ফেজ শেষ, একটি চলমান, বাকিগুলো আসন্ন
      const completed = 2 + (unitIndex % 3);

      for (const [index, template] of project.phaseTemplates.entries()) {
        const percentComplete = index < completed ? 100 : index === completed ? 50 : 0;
        const planned = dates[index];

        await prisma.phase.create({
          data: {
            unitId: unit.id,
            name: template.name,
            order: template.order,
            plannedStart: planned.plannedStart,
            plannedEnd: planned.plannedEnd,
            actualStart: percentComplete > 0 ? planned.plannedStart : null,
            actualEnd: percentComplete >= 100 ? planned.plannedEnd : null,
            percentComplete,
            status: computePhaseStatus({ percentComplete, plannedEnd: planned.plannedEnd }, now),
          },
        });
        created += 1;
      }

      // চলমান ফেজে একটি ডেমো সাইট আপডেট (ছবি ছাড়া)
      if (engineerId) {
        const activePhase = await prisma.phase.findFirst({
          where: { unitId: unit.id, order: completed + 1 },
          select: { id: true },
        });
        if (activePhase) {
          await prisma.phaseUpdate.create({
            data: {
              phaseId: activePhase.id,
              updatedById: engineerId,
              percentComplete: 50,
              note: 'কাজ চলমান — অর্ধেক সম্পন্ন (ডেমো ডেটা)',
              photoUrls: [],
            },
          });
        }
      }
    }
  }

  if (created > 0) console.log(`\n✔ ${created} টি ফেজ তৈরি হয়েছে (ডেমো অগ্রগতি সহ)`);
  else console.log(`\nℹ ${skipped} টি ইউনিটে আগে থেকেই ফেজ আছে — ডেমো ফেজ স্কিপ করা হলো`);
}

async function seedLeads(assignedToId: string) {
  const existing = await prisma.lead.count();
  if (existing > 0) {
    console.log(`\nℹ ${existing} টি লিড আগে থেকেই আছে — ডেমো লিড স্কিপ করা হলো`);
    return;
  }

  for (const l of demoLeads) {
    const lead = await prisma.lead.create({
      data: {
        name: l.name,
        phone: l.phone,
        email: l.email ?? null,
        residenceCountry: l.residenceCountry ?? null,
        source: l.source,
        stage: l.stage,
        projectLocation: l.projectLocation ?? null,
        lostReason: l.lostReason ?? null,
        budgetMin: l.budgetMin ?? null,
        budgetMax: l.budgetMax ?? null,
        localContactName: l.localContactName ?? null,
        localContactPhone: l.localContactPhone ?? null,
        localContactRelation: l.localContactRelation ?? null,
        assignedToId,
        nextFollowUpAt:
          l.followUpInDays === undefined ? null : daysFromNow(l.followUpInDays),
      },
    });

    await prisma.leadActivity.create({
      data: {
        leadId: lead.id,
        type: LeadActivityType.CREATED,
        note: 'লিড তৈরি করা হয়েছে (ডেমো ডেটা)',
        createdById: assignedToId,
      },
    });

    if (l.stage !== LeadStage.NEW) {
      await prisma.leadActivity.create({
        data: {
          leadId: lead.id,
          type: LeadActivityType.STAGE_CHANGED,
          note: `স্টেজ: নতুন লিড → ${l.stage}`,
          createdById: assignedToId,
        },
      });
    }
  }

  console.log(`\n✔ ${demoLeads.length} টি ডেমো লিড তৈরি হয়েছে`);
}

/**
 * Phase 4/5 ডেমো — একটি সম্পূর্ণ বিক্রয় চেইন: Won লিড → Sale → PaymentPlan →
 * কিছু Payment জমা → কিছু কিস্তি বকেয়া।
 *
 * উদ্দেশ্য টেস্ট করার মতো একটি *বাস্তব* অ্যাকাউন্ট তৈরি করা — Accounts প্যানেলে
 * শিডিউল ও aging রিপোর্ট, কাস্টমার পোর্টালে "কত দিয়েছি / কত বাকি", আর রসিদ
 * প্রিন্ট — সব কটাই ডেটা ছাড়া ফাঁকা দেখাত।
 *
 * শিডিউলটি অ্যাপের কোড দিয়েই তৈরি হয় (`lib/payments.ts` এর `generateSchedule`),
 * তাই সিডের হিসাব আর প্ল্যান বিল্ডারের হিসাব কখনো আলাদা হয়ে যায় না।
 */
async function seedSale(marketingId: string | undefined, accountsId: string | undefined) {
  const existing = await prisma.sale.count();
  if (existing > 0) {
    console.log(`\nℹ ${existing} টি সেল আগে থেকেই আছে — ডেমো সেল স্কিপ করা হলো`);
    return;
  }

  const customer = await prisma.customer.findFirst({
    where: { user: { role: Role.CUSTOMER } },
    select: { id: true, userId: true, user: { select: { name: true } } },
  });
  if (!customer) {
    console.log('\nℹ CUSTOMER প্রোফাইল নেই — ডেমো সেল স্কিপ করা হলো');
    return;
  }

  // ডেমো লিডগুলোর মধ্যে যেটি Won, সেটিই সেলে রূপ নেবে (অ্যাপের ফ্লো এটাই)
  const wonLead = await prisma.lead.findFirst({
    where: { stage: LeadStage.WON, sale: null },
    select: { id: true, name: true },
    orderBy: { createdAt: 'asc' },
  });

  // বুকিং হয়ে থাকা ইউনিটটিই — নইলে যেকোনো খালি ইউনিট
  const unit =
    (await prisma.unit.findFirst({
      where: { status: UnitStatus.BOOKED, sale: null },
      select: { id: true, unitNo: true, price: true, project: { select: { name: true } } },
    })) ??
    (await prisma.unit.findFirst({
      where: { status: UnitStatus.AVAILABLE, sale: null },
      select: { id: true, unitNo: true, price: true, project: { select: { name: true } } },
    }));

  if (!unit) {
    console.log('\nℹ বিক্রির মতো খালি ইউনিট নেই — ডেমো সেল স্কিপ করা হলো');
    return;
  }

  const totalAmount = Number(unit.price);
  // ১০ মাস আগে বুকিং — তাতে কয়েকটি কিস্তির তারিখ পেরিয়ে গেছে (পরিশোধিত ও বকেয়া
  // দুরকমই দেখা যাবে), আর বাকিগুলো ভবিষ্যতে
  const bookingDate = daysFromNow(-300);
  const dates = defaultPlanDates(bookingDate);

  const schedule = generateSchedule({
    totalAmount,
    bookingDate,
    bookingPercent: DEFAULT_PLAN_TEMPLATE.bookingPercent,
    downPaymentPercent: DEFAULT_PLAN_TEMPLATE.downPaymentPercent,
    downPaymentDays: DEFAULT_PLAN_TEMPLATE.downPaymentDays,
    agreementPercent: DEFAULT_PLAN_TEMPLATE.agreementPercent,
    agreementDate: dates.agreementDate,
    monthlyCount: DEFAULT_PLAN_TEMPLATE.monthlyCount,
    monthlyPercent: DEFAULT_PLAN_TEMPLATE.monthlyPercent,
    firstInstallmentDate: dates.firstInstallmentDate,
    handoverDate: dates.handoverDate,
  });

  const sale = await prisma.sale.create({
    data: {
      leadId: wonLead?.id ?? null,
      unitId: unit.id,
      customerId: customer.id,
      totalAmount: new Prisma.Decimal(totalAmount),
      saleDate: bookingDate,
      // পেমেন্ট প্ল্যান বসে গেছে, তাই ড্রাফট নয় — কনফার্মড
      status: SaleStatus.CONFIRMED,
      paymentPlan: {
        create: {
          installments: {
            create: schedule.map((row) => ({
              label: row.label,
              order: row.order,
              dueDate: row.dueDate,
              amount: new Prisma.Decimal(row.amount),
              percentage: new Prisma.Decimal(row.percentage),
            })),
          },
        },
      },
    },
    select: { id: true },
  });

  await prisma.unit.update({ where: { id: unit.id }, data: { status: UnitStatus.SOLD } });

  if (wonLead) {
    await prisma.leadActivity.create({
      data: {
        leadId: wonLead.id,
        type: LeadActivityType.STAGE_CHANGED,
        note: `সেল কনফার্ম — ${unit.project.name} / ${unit.unitNo} (ডেমো ডেটা)`,
        createdById: marketingId ?? null,
      },
    });
  }

  /* ------------------------------------------------------- কিস্তি আদায় */

  const installments = await prisma.installment.findMany({
    where: { paymentPlan: { saleId: sale.id } },
    select: { id: true, label: true, dueDate: true, amount: true },
    orderBy: { order: 'asc' },
  });

  const now = new Date();
  const duePast = installments.filter((i) => i.dueDate.getTime() < now.getTime());

  /**
   * তারিখ পেরিয়ে যাওয়া কিস্তিগুলোর মধ্যে শেষ তিনটি ইচ্ছে করে বাকি রাখা হয় —
   * একটি আংশিক, দুটি সম্পূর্ণ বকেয়া। ফলে aging রিপোর্টে ভিন্ন ভিন্ন বয়সের
   * বকেয়া থাকে আর "পেমেন্ট এন্ট্রি" টেস্ট করার মতো কিস্তিও হাতে থাকে।
   */
  const unpaidTail = duePast.slice(-3);
  const partial = unpaidTail[0];
  const paidRows = duePast.slice(0, Math.max(0, duePast.length - 3));

  const methods = [
    PaymentMethod.BANK_TRANSFER,
    PaymentMethod.CASH,
    PaymentMethod.BKASH,
    PaymentMethod.CHEQUE,
    PaymentMethod.NAGAD,
  ];
  const noteFor: Partial<Record<PaymentMethod, string>> = {
    BANK_TRANSFER: 'City Bank · TRX-8842190',
    BKASH: 'TrxID 8N7A2KDQ91',
    NAGAD: 'TrxID NGD5512087',
    CHEQUE: 'চেক নং 445120 · IFIC Bank',
  };

  /** রসিদ নম্বর বছরভিত্তিক ক্রমিক — অ্যাপের `nextReceiptNo` এর মতোই */
  const serials = new Map<number, number>();
  function nextReceipt(paidAt: Date) {
    const year = paidAt.getFullYear();
    const serial = (serials.get(year) ?? 0) + 1;
    serials.set(year, serial);
    return formatReceiptNo(year, serial);
  }

  type Entry = { row: (typeof installments)[number]; amount: number };
  const entries: Entry[] = [
    ...paidRows.map((row) => ({ row, amount: Number(row.amount) })),
    // আংশিক — কিস্তির ৬০% জমা পড়েছে
    ...(partial ? [{ row: partial, amount: Math.round(Number(partial.amount) * 0.6) }] : []),
  ];

  let collected = 0;

  for (const [index, entry] of entries.entries()) {
    const amount = entry.amount;
    // টাকা সাধারণত শেষ তারিখের আশেপাশেই জমা পড়ে — দু-এক দিন আগে/পরে
    const paidAt = new Date(entry.row.dueDate);
    paidAt.setDate(paidAt.getDate() + (index % 3) - 1);
    paidAt.setHours(11, 30, 0, 0);

    const method = methods[index % methods.length];
    const payment = await prisma.payment.create({
      data: {
        installmentId: entry.row.id,
        amountReceived: new Prisma.Decimal(amount),
        method,
        receiptNo: nextReceipt(paidAt),
        note: noteFor[method] ?? null,
        receivedById: accountsId ?? customer.userId,
        paidAt,
      },
      select: { id: true, receiptNo: true },
    });

    await prisma.installment.update({
      where: { id: entry.row.id },
      data: {
        status: computeInstallmentStatus(
          { amount: Number(entry.row.amount), dueDate: entry.row.dueDate },
          amount,
          now,
        ),
      },
    });

    // CLAUDE.md নিয়ম ৪ — প্রতিটি পেমেন্ট ActivityLog এ
    if (accountsId) {
      await prisma.activityLog.create({
        data: {
          entityType: 'Payment',
          entityId: payment.id,
          userId: accountsId,
          action: 'PAYMENT_RECEIVED',
          metadata: {
            saleId: sale.id,
            installmentId: entry.row.id,
            installmentLabel: entry.row.label,
            amountReceived: String(amount),
            method,
            receiptNo: payment.receiptNo,
            seed: true,
          },
        },
      });
    }

    collected += amount;
  }

  // বাকি বকেয়া কিস্তিগুলোর স্ট্যাটাস — ওভারডিউ sweep যা করত
  const overdueIds = unpaidTail.filter((row) => row.id !== partial?.id).map((row) => row.id);
  if (overdueIds.length > 0) {
    await prisma.installment.updateMany({
      where: { id: { in: overdueIds } },
      data: { status: InstallmentStatus.OVERDUE },
    });
  }

  // কাস্টমারের বেলে কিছু খবর — পোর্টাল খালি না দেখানোর জন্য
  const nextDue = installments.find((row) => row.dueDate.getTime() >= now.getTime());
  await prisma.notification.createMany({
    data: [
      {
        userId: customer.userId,
        type: 'PAYMENT_DUE',
        message: `${unpaidTail.length} টি কিস্তি বকেয়া — অনুগ্রহ করে পরিশোধ করুন`,
        link: '/customer/payments',
        key: `seed-overdue:${sale.id}`,
      },
      ...(nextDue
        ? [
            {
              userId: customer.userId,
              type: 'PAYMENT_DUE',
              message: `পরবর্তী কিস্তি "${nextDue.label}" আসছে`,
              link: '/customer/payments',
              key: `seed-upcoming:${sale.id}`,
            },
          ]
        : []),
    ],
    skipDuplicates: true,
  });

  console.log(
    `\n✔ সেল তৈরি হয়েছে — ${unit.project.name} / ${unit.unitNo}` +
      ` · ${customer.user.name}` +
      `\n  ${schedule.length} টি কিস্তি · ${entries.length} টি পেমেন্ট জমা` +
      ` · ${unpaidTail.length} টি বকেয়া` +
      `\n  মোট ৳${totalAmount.toLocaleString('en-IN')} এর মধ্যে ৳${collected.toLocaleString('en-IN')} আদায়`,
  );
}

/**
 * বিক্রীত ইউনিটের চলমান ফেজে কয়েকটি সাইট আপডেট — কাস্টমার পোর্টালের
 * "নির্মাণ অগ্রগতি" ও ইঞ্জিনিয়ার প্যানেলের টাইমলাইন ইতিহাস ফাঁকা না রাখতে।
 */
async function seedPhaseUpdates(engineerId: string | undefined) {
  if (!engineerId) return;

  const sale = await prisma.sale.findFirst({
    select: { unitId: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!sale) return;

  const phases = await prisma.phase.findMany({
    where: { unitId: sale.unitId, percentComplete: { gt: 0 } },
    select: { id: true, name: true, percentComplete: true, _count: { select: { updates: true } } },
    orderBy: { order: 'asc' },
  });

  const notes = [
    'কাজ শুরু হয়েছে — মালামাল সাইটে পৌঁছেছে',
    'অর্ধেক সম্পন্ন, মান যাচাই করা হয়েছে',
    'কাজ শেষ — পরবর্তী ফেজের প্রস্তুতি চলছে',
  ];

  let created = 0;
  for (const phase of phases) {
    // যে ফেজে আগেই আপডেট আছে সেটি ছোঁয়া হয় না (সিড বারবার চালানো নিরাপদ)
    if (phase._count.updates > 0) continue;

    // ০ → বর্তমান % পর্যন্ত ধাপে ধাপে, যাতে ইতিহাসটা বিশ্বাসযোগ্য দেখায়
    const steps = phase.percentComplete >= 100 ? [25, 75, 100] : [25, phase.percentComplete];

    for (const [index, percent] of steps.entries()) {
      await prisma.phaseUpdate.create({
        data: {
          phaseId: phase.id,
          updatedById: engineerId,
          percentComplete: percent,
          note: `${phase.name}: ${notes[Math.min(index, notes.length - 1)]} (ডেমো ডেটা)`,
          photoUrls: [],
          createdAt: daysFromNow(-30 * (steps.length - index)),
        },
      });
      created += 1;
    }
  }

  if (created > 0) console.log(`\n✔ ${created} টি সাইট আপডেট যোগ করা হয়েছে`);
}

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

    // CUSTOMER role এর জন্য Customer profile ও দরকার
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

  await seedProjects(engineerId);
  await seedPhases(engineerId);

  if (marketingId) await seedLeads(marketingId);

  // লিড তৈরির পরেই — Won লিডটিই সেলে রূপ নেয়
  await seedSale(marketingId, accountsId);
  await seedPhaseUpdates(engineerId);

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
