import { LeadActivityType, LeadSource, LeadStage, PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

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

/** Phase 2 ডেমো লিড — পাইপলাইন বোর্ড খালি না থাকার জন্য */
const demoLeads: {
  name: string;
  phone: string;
  email?: string;
  source: LeadSource;
  stage: LeadStage;
  budgetMin?: number;
  budgetMax?: number;
  followUpInDays?: number;
  lostReason?: string;
}[] = [
  { name: 'মোঃ রফিকুল ইসলাম', phone: '01711111101', email: 'rafiqul@example.com', source: LeadSource.FACEBOOK_ADS, stage: LeadStage.NEW, budgetMin: 4500000, budgetMax: 5500000, followUpInDays: 1 },
  { name: 'সালমা বেগম', phone: '01711111102', source: LeadSource.WEBSITE, stage: LeadStage.NEW, budgetMin: 3500000, budgetMax: 4200000, followUpInDays: 3 },
  { name: 'আবদুল করিম', phone: '01711111103', email: 'karim@example.com', source: LeadSource.REFERRAL, stage: LeadStage.CONTACTED, budgetMin: 6000000, budgetMax: 7500000, followUpInDays: -2 },
  { name: 'তানভীর আহমেদ', phone: '01711111104', source: LeadSource.WALK_IN, stage: LeadStage.CONTACTED, followUpInDays: 0 },
  { name: 'নুসরাত জাহান', phone: '01711111105', email: 'nusrat@example.com', source: LeadSource.EXHIBITION, stage: LeadStage.SITE_VISIT_SCHEDULED, budgetMin: 5000000, budgetMax: 6000000, followUpInDays: 2 },
  { name: 'মাহবুব হোসেন', phone: '01711111106', source: LeadSource.COLD_CALL, stage: LeadStage.SITE_VISIT_DONE, budgetMin: 4800000, followUpInDays: 5 },
  { name: 'শারমিন আক্তার', phone: '01711111107', source: LeadSource.FACEBOOK_ADS, stage: LeadStage.NEGOTIATION, budgetMin: 5200000, budgetMax: 5800000, followUpInDays: -1 },
  { name: 'ইঞ্জি. সাইফুল ইসলাম', phone: '01711111108', email: 'saiful@example.com', source: LeadSource.REFERRAL, stage: LeadStage.BOOKING, budgetMin: 7000000, budgetMax: 8000000, followUpInDays: 7 },
  { name: 'ফারুক হাসান', phone: '01711111109', source: LeadSource.WEBSITE, stage: LeadStage.SALE_AGREEMENT_SIGNED, budgetMin: 6500000 },
  { name: 'রোকেয়া সুলতানা', phone: '01711111110', source: LeadSource.WALK_IN, stage: LeadStage.WON, budgetMin: 5500000, budgetMax: 5500000 },
  { name: 'জাহিদ হাসান', phone: '01711111111', source: LeadSource.COLD_CALL, stage: LeadStage.LOST, budgetMin: 3000000, lostReason: 'Price too high' },
  { name: 'মিতু রহমান', phone: '01711111112', source: LeadSource.FACEBOOK_ADS, stage: LeadStage.LOST, lostReason: 'No response' },
];

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
        source: l.source,
        stage: l.stage,
        lostReason: l.lostReason ?? null,
        budgetMin: l.budgetMin ?? null,
        budgetMax: l.budgetMax ?? null,
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

    console.log(`✔ ${u.role.padEnd(9)} ${u.email}`);
  }

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
