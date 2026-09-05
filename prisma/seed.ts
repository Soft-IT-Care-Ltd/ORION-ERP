import {
  LeadActivityType,
  LeadSource,
  LeadStage,
  PrismaClient,
  Role,
  UnitStatus,
} from '@prisma/client';
import bcrypt from 'bcryptjs';
import { computePhaseStatus, DEFAULT_PHASE_TEMPLATE, planPhaseDates } from '../src/lib/phases';

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

async function main() {
  const passwordHash = await bcrypt.hash(password, 10);
  let marketingId: string | undefined;
  let engineerId: string | undefined;

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

    console.log(`✔ ${u.role.padEnd(9)} ${u.email}`);
  }

  await seedProjects(engineerId);
  await seedPhases(engineerId);

  if (marketingId) await seedLeads(marketingId);

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
