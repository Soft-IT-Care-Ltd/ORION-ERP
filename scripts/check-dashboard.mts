/**
 * নোটিফিকেশন ও Admin ড্যাশবোর্ডের যাচাই — `npm run test:dashboard`
 *
 * দুটো জিনিস পরীক্ষা হয়:
 *
 *  ১. **নোটিফিকেশন (PRD সেকশন ৫.৯)** — ফলো-আপের তারিখ পেরোলে assigned
 *     এক্সিকিউটিভ খবর পান; কিস্তির ৭ দিন আগে ও বকেয়া হলে কাস্টমার + Accounts
 *     পান; ফেজ ১০০% হলে কাস্টমার পান। আর sweep দ্বিতীয়বার চললে একই খবর
 *     দ্বিতীয়বার লেখা হয় না (dedupe key)।
 *
 *  ২. **ড্যাশবোর্ডের নতুন দুটি রিপোর্ট (PRD সেকশন ৫.১০)** — client-wise
 *     profitability (billed − cost = margin, মার্জিন অনুযায়ী sortable) ও
 *     company-wide মাসিক income vs expense (ক্লায়েন্টে ট্যাগ করা ও ট্যাগহীন,
 *     দুই ধরনের এন্ট্রিই)।
 *
 * `check-ledger.mts` এর মতোই টেস্ট ফ্রেমওয়ার্ক ছাড়া (tsx + node:assert) এবং
 * **আসল ডাটাবেসে** — কারণ এখানে পরীক্ষার বিষয়টাই Prisma কুয়েরিগুলোর ফলাফল।
 * শেষে নিজের তৈরি সব রেকর্ড মুছে দেয়।
 *
 * ফাইলটি `.mts` — `.env` লোড করার পরেই মডিউলগুলো import করতে top-level await লাগে।
 */

import assert from 'node:assert/strict';

// `lib/prisma` মডিউল-লোডেই DATABASE_URL পড়ে, তাই import এর *আগে* .env
process.loadEnvFile('.env');

const { PrismaClient, LedgerType } = await import('@prisma/client');
const { addDays, format, startOfMonth, subDays, subMonths } = await import('date-fns');
const notifications = await import('../src/lib/notifications');
const reportData = await import('../src/lib/report-data');
const ledgerData = await import('../src/lib/ledger-data');
const { sortClientProfit } = await import('../src/lib/reports');
const { LEAD_STAGES } = await import('../src/lib/leads');

const prisma = new PrismaClient();

let passed = 0;
const failures: string[] = [];

async function test(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failures.push(`${name}\n    ${(error as Error).message.split('\n')[0]}`);
    console.log(`  ✗ ${name}`);
  }
}

/* ------------------------------------------------------------ fixtures */

const TAG = `dash-test-${Date.now()}`;
const SERVICE_BILL = 60_000; // সয়েল টেস্ট + ডিজাইন (pre-project income)
const INTERNAL_COST = 25_000; // ইন্টারনাল খরচ
const GENERAL_EXPENSE = 40_000; // অফিস ওভারহেড — কোনো ক্লায়েন্টে ট্যাগ করা নয়
const INSTALLMENT_AMOUNT = 500_000;
const PAID_AMOUNT = 200_000;
const CONTRACT_VALUE = 1_000_000;

/** মোট বিল = সার্ভিস + দুই কিস্তি; মার্জিন = মোট বিল − ইন্টারনাল কস্ট */
const EXPECTED_BILLED = SERVICE_BILL + INSTALLMENT_AMOUNT * 2;
const EXPECTED_RECEIVED = SERVICE_BILL + PAID_AMOUNT;
const EXPECTED_MARGIN = EXPECTED_BILLED - INTERNAL_COST;

const created = {
  userIds: [] as string[],
  leadId: '',
  projectId: '',
  customerId: '',
  planId: '',
  phaseId: '',
  dueSoonInstallmentId: '',
  overdueInstallmentId: '',
};

const now = new Date();

/**
 * sweep পুরো DB স্ক্যান করে, তাই সিডের অন্য ইউজারদের জন্যও খবর লিখতে পারে।
 * এই টেস্ট চলার সময় লেখা সবগুলোই শেষে মুছে ফেলা হয় — dedupe key আছে বলে
 * পরের sweep আসলগুলো আবার লিখে নেবে, কিছু হারায় না।
 */
const startedAt = new Date();

async function setup() {
  // এন্ট্রিগুলোর `createdBy`/`receivedBy` লাগে — সিডের অ্যাডমিন থাকলে সেটিই
  const seedAdmin = await prisma.user.findFirst({
    where: { role: 'ADMIN', active: true },
    select: { id: true },
  });

  const passwordHash = 'x'.repeat(60); // লগইন করা হবে না, শুধু NOT NULL মেটাতে

  const marketing = await prisma.user.create({
    data: {
      name: `${TAG} এক্সিকিউটিভ`,
      email: `${TAG}-marketing@test.local`,
      passwordHash,
      role: 'MARKETING',
    },
    select: { id: true },
  });
  created.userIds.push(marketing.id);

  const customerUser = await prisma.user.create({
    data: {
      name: `${TAG} ক্লায়েন্ট`,
      email: `${TAG}-customer@test.local`,
      passwordHash,
      role: 'CUSTOMER',
    },
    select: { id: true },
  });
  created.userIds.push(customerUser.id);

  const adminId = seedAdmin?.id ?? marketing.id;

  // ---------------------------------------------------------------- lead
  // ফলো-আপের তারিখ কাল ছিল, লিড এখনো খোলা → রিমাইন্ডার পাওয়ার কথা
  const lead = await prisma.lead.create({
    data: {
      name: `${TAG} লিড`,
      phone: '+8801700000000',
      source: 'WALK_IN',
      stage: 'NEGOTIATION',
      assignedToId: marketing.id,
      nextFollowUpAt: subDays(now, 1),
    },
    select: { id: true },
  });
  created.leadId = lead.id;

  await prisma.ledgerEntry.createMany({
    data: [
      {
        leadId: lead.id,
        type: LedgerType.INCOME,
        category: 'SOIL_TEST',
        amount: SERVICE_BILL,
        clientVisible: true,
        createdById: adminId,
        date: now,
      },
      {
        leadId: lead.id,
        type: LedgerType.EXPENSE,
        category: 'OTHER',
        amount: INTERNAL_COST,
        createdById: adminId,
        date: now,
      },
      // ক্লায়েন্টে ট্যাগ করা নয় — company-wide চার্টে গোনা হবে, profitability তে নয়
      {
        leadId: null,
        type: LedgerType.EXPENSE,
        category: 'OFFICE_OVERHEAD',
        amount: GENERAL_EXPENSE,
        createdById: adminId,
        date: now,
      },
    ],
  });

  // ------------------------------------------------------------- project
  const customer = await prisma.customer.create({
    data: { userId: customerUser.id },
    select: { id: true },
  });
  created.customerId = customer.id;

  const project = await prisma.project.create({
    data: {
      leadId: lead.id,
      customerId: customer.id,
      title: `${TAG} প্রজেক্ট`,
      totalContractValue: CONTRACT_VALUE,
    },
    select: { id: true },
  });
  created.projectId = project.id;

  // ফেজটি ১০০% — কাস্টমারের "ফেজ সম্পন্ন" খবর পাওয়ার কথা
  const phase = await prisma.phase.create({
    data: {
      projectId: project.id,
      name: `${TAG} ফাউন্ডেশন`,
      order: 1,
      percentComplete: 100,
      status: 'DONE',
      actualEnd: subDays(now, 2),
    },
    select: { id: true },
  });
  created.phaseId = phase.id;

  const plan = await prisma.paymentPlan.create({
    data: { projectId: project.id },
    select: { id: true },
  });
  created.planId = plan.id;

  // একটি কিস্তি ৩ দিন পরে due (৭ দিনের জানালায়), একটি ২০ দিন আগেই পেরিয়ে গেছে
  const dueSoon = await prisma.installment.create({
    data: {
      paymentPlanId: plan.id,
      label: `${TAG} কিস্তি ১`,
      order: 1,
      dueDate: addDays(now, 3),
      amount: INSTALLMENT_AMOUNT,
    },
    select: { id: true },
  });
  created.dueSoonInstallmentId = dueSoon.id;

  const overdue = await prisma.installment.create({
    data: {
      paymentPlanId: plan.id,
      label: `${TAG} কিস্তি ২`,
      order: 2,
      dueDate: subDays(now, 20),
      amount: INSTALLMENT_AMOUNT,
      status: 'OVERDUE',
    },
    select: { id: true },
  });
  created.overdueInstallmentId = overdue.id;

  // বকেয়া কিস্তিতে আংশিক আদায় — রিমাইন্ডারে বাকিটাই বলা উচিত
  await prisma.payment.create({
    data: {
      installmentId: overdue.id,
      amountReceived: PAID_AMOUNT,
      method: 'BANK_TRANSFER',
      receiptNo: `${TAG}-RCP-1`,
      receivedById: adminId,
      paidAt: subDays(now, 10),
    },
  });
}

async function cleanup() {
  // সম্পর্কের উল্টো ক্রমে — FK ভাঙা এড়াতে
  await prisma.notification.deleteMany({ where: { createdAt: { gte: startedAt } } });
  if (created.planId) {
    await prisma.payment.deleteMany({
      where: { installment: { paymentPlanId: created.planId } },
    });
    await prisma.installment.deleteMany({ where: { paymentPlanId: created.planId } });
    await prisma.paymentPlan.delete({ where: { id: created.planId } }).catch(() => {});
  }
  if (created.projectId) {
    await prisma.phase.deleteMany({ where: { projectId: created.projectId } });
    await prisma.project.delete({ where: { id: created.projectId } }).catch(() => {});
  }
  if (created.customerId) {
    await prisma.customer.delete({ where: { id: created.customerId } }).catch(() => {});
  }
  if (created.leadId) {
    await prisma.ledgerEntry.deleteMany({ where: { leadId: created.leadId } });
    await prisma.leadActivity.deleteMany({ where: { leadId: created.leadId } });
    await prisma.lead.delete({ where: { id: created.leadId } }).catch(() => {});
  }
  // ট্যাগহীন general এন্ট্রিটি leadId দিয়ে খুঁজে পাওয়া যায় না — createdBy + অঙ্ক দিয়ে
  await prisma.ledgerEntry.deleteMany({
    where: { leadId: null, category: 'OFFICE_OVERHEAD', amount: GENERAL_EXPENSE, note: null },
  });
  if (created.userIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: created.userIds } } });
  }
}

/* ---------------------------------------------------------------- runs */

/** টেস্টে তৈরি করা ইউজারদের নোটিফিকেশন — টাইপ অনুযায়ী */
async function notificationsOf(userId: string, type?: string) {
  return prisma.notification.findMany({
    where: { userId, ...(type ? { type } : {}) },
    select: { id: true, type: true, message: true, link: true, key: true },
  });
}

try {
  await setup();

  const [marketingId, customerUserId] = created.userIds;

  /* ------------------------------------------ ১. নোটিফিকেশন (সেকশন ৫.৯) */
  console.log('\nনোটিফিকেশন sweep (PRD সেকশন ৫.৯):');

  const first = await notifications.runNotificationSweep(now);

  await test('ফলো-আপ পেরোনো লিডে assigned এক্সিকিউটিভ খবর পান', async () => {
    const rows = await notificationsOf(marketingId, 'FOLLOW_UP_DUE');
    assert.equal(rows.length, 1, 'ঠিক একটি ফলো-আপ রিমাইন্ডার আসার কথা');
    assert.ok(rows[0].message.includes(`${TAG} লিড`), 'মেসেজে লিডের নাম নেই');
    assert.equal(rows[0].link, `/sales/leads/${created.leadId}`);
  });

  await test('৭ দিনের ভেতরের কিস্তিতে কাস্টমার আসন্ন-কিস্তির খবর পান', async () => {
    const rows = await notificationsOf(customerUserId, 'PAYMENT_DUE');
    assert.equal(rows.length, 1, 'ঠিক একটি আসন্ন-কিস্তির খবর আসার কথা');
    assert.equal(rows[0].key, `due-soon:${created.dueSoonInstallmentId}`);
    assert.equal(rows[0].link, '/customer/payments');
  });

  await test('বকেয়া কিস্তিতে কাস্টমার ওভারডিউ খবর পান, বাকি অঙ্কসহ', async () => {
    const rows = await notificationsOf(customerUserId, 'PAYMENT_OVERDUE');
    assert.equal(rows.length, 1, 'ঠিক একটি ওভারডিউ খবর আসার কথা');
    // আংশিক আদায় বাদ দিয়ে বাকিটাই বলা উচিত — পুরো কিস্তির অঙ্ক নয়
    const remaining = INSTALLMENT_AMOUNT - PAID_AMOUNT;
    assert.ok(
      rows[0].message.includes(remaining.toLocaleString('en-IN')),
      `বাকি ৳${remaining} মেসেজে নেই: ${rows[0].message}`,
    );
  });

  await test('ওভারডিউ কী তে aging বালতি আছে — পুরনো হলে আবার মনে করানো যায়', async () => {
    const rows = await notificationsOf(customerUserId, 'PAYMENT_OVERDUE');
    // ২০ দিন → ১৬–৩০ দিনের বালতি
    assert.equal(rows[0].key, `overdue:${created.overdueInstallmentId}:16-30`);
  });

  await test('১০০% হওয়া ফেজে কাস্টমার "ফেজ সম্পন্ন" খবর পান', async () => {
    const rows = await notificationsOf(customerUserId, 'PHASE_MILESTONE');
    assert.equal(rows.length, 1);
    assert.equal(rows[0].key, `phase-done:${created.phaseId}`);
    assert.equal(rows[0].link, '/customer/progress');
  });

  await test('sweep নতুন খবর লিখেছে', () => {
    assert.ok(first.created > 0, 'প্রথম sweep কিছুই লেখেনি');
  });

  await test('দ্বিতীয় sweep একই খবর দ্বিতীয়বার লেখে না (idempotent)', async () => {
    const before = await prisma.notification.count({
      where: { userId: { in: created.userIds } },
    });
    await notifications.runNotificationSweep(now);
    const after = await prisma.notification.count({
      where: { userId: { in: created.userIds } },
    });
    assert.equal(after, before, 'sweep দ্বিতীয়বার চলে ডুপ্লিকেট লিখেছে');
  });

  await test('বেলের ফিডে অপঠিত সংখ্যা ও সাম্প্রতিক তালিকা আসে', async () => {
    const feed = await notifications.loadNotifications(customerUserId);
    assert.equal(feed.items.length, 3, 'কাস্টমারের তিনটি খবর থাকার কথা');
    assert.equal(feed.unreadCount, 3, 'সবগুলোই অপঠিত থাকার কথা');
    assert.ok(feed.items[0].createdAtLabel.length > 0, 'তারিখ server এ ফরম্যাট হয়নি');
  });

  await test('সব পড়া হয়েছে দিলে unread badge শূন্য হয়', async () => {
    await notifications.markAllAsRead(customerUserId);
    const feed = await notifications.loadNotifications(customerUserId);
    assert.equal(feed.unreadCount, 0);
  });

  /* ------------------------- ২. Client-wise profitability (সেকশন ৫.১০) */
  console.log('\nClient-wise profitability (PRD সেকশন ৫.১০):');

  const profit = await reportData.loadClientProfitability();
  const mine = profit.rows.find((row) => row.leadId === created.leadId);

  await test('লেজার বা প্রজেক্ট আছে এমন ক্লায়েন্ট রিপোর্টে আসে', () => {
    assert.ok(mine, 'টেস্টের ক্লায়েন্ট রিপোর্টে নেই');
  });

  await test('মোট বিল = সার্ভিস বিল + কিস্তির মোট', () => {
    assert.equal(mine!.serviceBilled, SERVICE_BILL);
    assert.equal(mine!.contractBilled, INSTALLMENT_AMOUNT * 2);
    assert.equal(mine!.totalBilled, EXPECTED_BILLED);
  });

  await test('মোট আদায় = সার্ভিস রসিদ + কিস্তিতে আসা টাকা', () => {
    assert.equal(mine!.totalReceived, EXPECTED_RECEIVED);
  });

  await test('নিট মার্জিন = মোট বিল − ইন্টারনাল কস্ট', () => {
    assert.equal(mine!.totalCost, INTERNAL_COST);
    assert.equal(mine!.netMargin, EXPECTED_MARGIN);
  });

  await test('মার্জিন % বিলের অনুপাতে', () => {
    assert.equal(mine!.marginRate, Math.round((EXPECTED_MARGIN / EXPECTED_BILLED) * 100));
  });

  await test('ক্লায়েন্টে ট্যাগ না করা খরচ কোনো ক্লায়েন্টের কস্টে যোগ হয় না', () => {
    const total = profit.rows.reduce((sum, row) => sum + row.totalCost, 0);
    assert.equal(total, profit.totalCost);
    assert.ok(
      mine!.totalCost < GENERAL_EXPENSE + INTERNAL_COST,
      'অফিস ওভারহেড ক্লায়েন্টের কস্টে ঢুকে গেছে',
    );
  });

  await test('ডিফল্টে মার্জিন অনুযায়ী descending সাজানো', () => {
    const margins = profit.rows.map((row) => row.netMargin);
    const sorted = [...margins].sort((a, b) => b - a);
    assert.deepEqual(margins, sorted, 'ডিফল্ট ক্রম মার্জিন-descending নয়');
  });

  await test('sortClientProfit দিয়ে অন্য কলামে ও উল্টো দিকে সাজানো যায়', () => {
    const ascending = sortClientProfit(profit.rows, 'margin', 'asc');
    assert.deepEqual(
      ascending.map((row) => row.netMargin),
      [...profit.rows.map((row) => row.netMargin)].sort((a, b) => a - b),
    );

    const byCost = sortClientProfit(profit.rows, 'cost', 'desc');
    assert.deepEqual(
      byCost.map((row) => row.totalCost),
      [...profit.rows.map((row) => row.totalCost)].sort((a, b) => b - a),
    );

    // বিশুদ্ধ ফাংশন — মূল অ্যারে বদলায় না
    assert.notEqual(ascending, profit.rows);
  });

  await test('CSV রিপোর্ট ও ড্যাশবোর্ড একই সংখ্যা দেখায়', async () => {
    const dataset = await reportData.loadReportDataset('client-profitability', 'all', now);
    const row = dataset.rows.find((cells) => String(cells[0]).includes(`${TAG} লিড`));
    assert.ok(row, 'CSV তে টেস্টের ক্লায়েন্ট নেই');
    // কলাম: … মোট বিল(7), মোট আদায়(8), কস্ট(9), নিট মার্জিন(10)
    assert.equal(row![7], EXPECTED_BILLED);
    assert.equal(row![8], EXPECTED_RECEIVED);
    assert.equal(row![9], INTERNAL_COST);
    assert.equal(row![10], EXPECTED_MARGIN);
  });

  /* -------------------- ৩. Company monthly income vs expense (৫.৬/৫.১০) */
  console.log('\nকোম্পানির মাসিক আয় ও খরচ (PRD সেকশন ৫.৬/৫.১০):');

  const trend = await ledgerData.loadMonthlyLedgerTrend(now, 12);

  await test('১২টি মাসের বালতি ফেরত আসে, খালি মাসও বাদ পড়ে না', () => {
    assert.equal(trend.length, 12);
    assert.equal(trend[0].key, format(startOfMonth(subMonths(now, 11)), 'yyyy-MM'));
    assert.equal(trend[11].key, format(startOfMonth(now), 'yyyy-MM'));
  });

  await test('ক্লায়েন্ট-ট্যাগ করা ও ট্যাগহীন — দুই ধরনের এন্ট্রিই গোনা হয়', () => {
    const current = trend[11];
    assert.ok(current.income >= SERVICE_BILL, 'ক্লায়েন্টের সার্ভিস বিল গোনা হয়নি');
    assert.ok(
      current.expense >= INTERNAL_COST + GENERAL_EXPENSE,
      'ট্যাগহীন অফিস ওভারহেড company-wide খরচে গোনা হয়নি',
    );
  });

  await test('প্রতিটি মাসের নিট = আয় − খরচ', () => {
    for (const month of trend) {
      assert.equal(month.net, month.income - month.expense, `${month.key} এ নিট মেলেনি`);
    }
  });

  /* ---------------------------- ৪. ফানেলের stage তালিকা (সেকশন ৫.১) */
  console.log('\nPre-project funnel (PRD সেকশন ৫.১):');

  await test('ফানেলের ধাপগুলো PRD এর নতুন stage তালিকা অনুযায়ী', async () => {
    const funnel = await reportData.loadSalesFunnel('all', now);
    // LOST বাদে PRD সেকশন ৫.১ এর ক্রম — Inquiry … Negotiation → Won
    const expected = LEAD_STAGES.filter((stage) => stage !== 'LOST');
    assert.deepEqual(
      funnel.rows.map((row) => row.stage),
      expected,
    );
    assert.equal(funnel.rows[0].stage, 'INQUIRY');
    assert.equal(funnel.rows[funnel.rows.length - 1].stage, 'WON');
  });

  await test('টেস্টের লিডটি যতদূর পৌঁছেছে সব ধাপেই গোনা হয়েছে', async () => {
    const funnel = await reportData.loadSalesFunnel('all', now);
    const inquiry = funnel.rows.find((row) => row.stage === 'INQUIRY')!;
    const negotiation = funnel.rows.find((row) => row.stage === 'NEGOTIATION')!;
    assert.ok(inquiry.count >= negotiation.count, 'সঞ্চিত সংখ্যা ধাপে ধাপে কমার কথা');
    assert.ok(negotiation.count >= 1, 'NEGOTIATION এ থাকা লিডটি গোনা হয়নি');
  });
} finally {
  await cleanup();
  await prisma.$disconnect();
}

/* ------------------------------------------------------------- report */

console.log(`\n${passed} টি পাস${failures.length > 0 ? `, ${failures.length} টি ব্যর্থ` : ''}`);

if (failures.length > 0) {
  console.error(`\n ব্যর্থ:\n  - ${failures.join('\n  - ')}\n`);
  process.exit(1);
}

console.log('সব যাচাই সফল\n');
