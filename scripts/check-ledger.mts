/**
 * Accounts Ledger এর যাচাই — `npm run test:ledger`
 *
 * PRD সেকশন ৫.৬ এর দুটি দাবি এখানে পরীক্ষা হয়:
 *
 *  ১. **হিসাব ঠিক আছে** — এক লিডে ৳৫,০০০ সয়েল টেস্ট (আয়) ও ৳৩,৫০০ ইন্টারনাল
 *     কস্ট (খরচ) দিলে ক্লায়েন্ট প্রোফাইলে নিট ৳১,৫০০ লাভ দেখায়।
 *  ২. **খরচ ক্লায়েন্ট কখনো দেখেন না** — কাস্টমার role এর কোনো কুয়েরিতে EXPENSE
 *     এন্ট্রি আসে না। এমনকি DB তে ভুল করে `clientVisible=true` লেখা একটি খরচও
 *     না (কুয়েরিটি `type=INCOME` ও `clientVisible=true` — দুটোই চায়)।
 *
 * `check-validations.mts` এর মতোই টেস্ট ফ্রেমওয়ার্ক ছাড়া (tsx + node:assert),
 * তবে এটি **আসল ডাটাবেসে** চলে — কারণ এখানে পরীক্ষার বিষয়টাই query-level
 * enforcement (PRD সেকশন ৭ — "client কখনো internal cost/expense দেখবে না
 * (query-level enforced)")। শেষে নিজের তৈরি সব রেকর্ড মুছে দেয়।
 *
 * ফাইলটি `.mts` — `.env` লোড করার পরেই মডিউলগুলো import করতে top-level await লাগে।
 */

import assert from 'node:assert/strict';

// `lib/prisma` মডিউল-লোডেই DATABASE_URL পড়ে, তাই import এর *আগে* .env
process.loadEnvFile('.env');

const { PrismaClient, LedgerType } = await import('@prisma/client');
const { resolveClientVisible, summarizeClientLedger } = await import('../src/lib/ledger');
const { can, canAccessRoute } = await import('../src/lib/rbac');
const ledgerData = await import('../src/lib/ledger-data');
const customerData = await import('../src/lib/customer-data');

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

const TAG = `ledger-test-${Date.now()}`;
const SOIL_TEST_INCOME = 5000;
const INTERNAL_COST = 3500;
const EXPECTED_NET = SOIL_TEST_INCOME - INTERNAL_COST; // ৳১,৫০০

/** টেস্টে তৈরি হওয়া সব id — শেষে মুছে ফেলতে */
const created = { entries: [] as string[], leadId: '', userId: '' };

async function setup() {
  // এন্ট্রিগুলোর `createdBy` লাগে — সিডের অ্যাডমিন থাকলে সেটিই, নইলে অস্থায়ী
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' }, select: { id: true } });
  if (admin) {
    created.userId = admin.id;
  } else {
    const temp = await prisma.user.create({
      data: {
        name: `${TAG}-user`,
        email: `${TAG}@example.test`,
        passwordHash: 'x',
        role: 'ACCOUNTS',
      },
      select: { id: true },
    });
    created.userId = temp.id;
  }

  const lead = await prisma.lead.create({
    data: {
      name: `${TAG} — টেস্ট ক্লায়েন্ট`,
      phone: '+8801700000000',
      source: 'WALK_IN',
      stage: 'SOIL_TEST',
    },
    select: { id: true },
  });
  created.leadId = lead.id;
}

/** অ্যাকশনের মতো করেই এন্ট্রি লেখা — `clientVisible` সেই একই নিয়ম থেকে */
async function addEntry(params: {
  type: 'INCOME' | 'EXPENSE';
  category: 'SOIL_TEST' | 'MATERIAL_COST';
  amount: number;
  note: string;
  leadId?: string | null;
  /** ইচ্ছাকৃত ভুল ডেটা — defence in depth পরীক্ষার জন্য */
  forceClientVisible?: boolean;
}) {
  const leadId = params.leadId === undefined ? created.leadId : params.leadId;
  const isIncome = params.type === 'INCOME';

  const entry = await prisma.ledgerEntry.create({
    data: {
      leadId,
      type: params.type,
      category: params.category,
      amount: params.amount,
      note: params.note,
      receiptNo: isIncome && leadId ? await ledgerData.nextLedgerReceiptNo() : null,
      clientVisible: params.forceClientVisible ?? resolveClientVisible(params.type, leadId),
      createdById: created.userId,
    },
    select: { id: true, receiptNo: true, clientVisible: true },
  });

  created.entries.push(entry.id);
  return entry;
}

async function cleanup() {
  if (created.entries.length > 0) {
    await prisma.ledgerEntry.deleteMany({ where: { id: { in: created.entries } } });
  }
  if (created.leadId) await prisma.lead.delete({ where: { id: created.leadId } }).catch(() => {});
  const temp = await prisma.user.findFirst({ where: { email: `${TAG}@example.test` } });
  if (temp) await prisma.user.delete({ where: { id: temp.id } }).catch(() => {});
}

/* --------------------------------------------------------------- run */

console.log('\nAccounts Ledger — যাচাই\n');

await setup();

try {
  /* --------------------------------------------- ১. clientVisible নিয়ম */

  console.log('clientVisible নিয়ম (PRD সেকশন ৪):');

  await test('ক্লায়েন্টে ট্যাগ করা আয় → ক্লায়েন্ট দেখতে পান', () => {
    assert.equal(resolveClientVisible(LedgerType.INCOME, 'lead-1'), true);
  });

  await test('খরচ → ক্লায়েন্ট কখনো দেখতে পান না (ট্যাগ করা থাকলেও)', () => {
    assert.equal(resolveClientVisible(LedgerType.EXPENSE, 'lead-1'), false);
  });

  await test('ক্লায়েন্ট ছাড়া general এন্ট্রি → কারো পোর্টালে যায় না', () => {
    assert.equal(resolveClientVisible(LedgerType.INCOME, null), false);
    assert.equal(resolveClientVisible(LedgerType.EXPENSE, null), false);
  });

  /* ------------------------------------------------ ২. এন্ট্রি তৈরি */

  console.log('\nএন্ট্রি তৈরি:');

  const income = await addEntry({
    type: 'INCOME',
    category: 'SOIL_TEST',
    amount: SOIL_TEST_INCOME,
    note: `${TAG} — সয়েল টেস্ট বিল`,
  });

  const expense = await addEntry({
    type: 'EXPENSE',
    category: 'MATERIAL_COST',
    amount: INTERNAL_COST,
    note: `${TAG} — সয়েল টেস্ট ভেন্ডর পেমেন্ট`,
  });

  await test('আয় এন্ট্রিতে রসিদ নম্বর অটো তৈরি হয়েছে', () => {
    assert.match(income.receiptNo ?? '', /^RCT-\d{6}-\d{4}$/);
  });

  await test('আয় এন্ট্রি clientVisible = true', () => {
    assert.equal(income.clientVisible, true);
  });

  await test('খরচ এন্ট্রিতে রসিদ নম্বর নেই ও clientVisible = false', () => {
    assert.equal(expense.receiptNo, null);
    assert.equal(expense.clientVisible, false);
  });

  /* ------------------------------------------------- ৩. নিট লাভ/ক্ষতি */

  console.log('\nক্লায়েন্ট প্রোফাইলের হিসাব (PRD সেকশন ৫.৬):');

  const clientLedger = await ledgerData.loadClientLedger(created.leadId);

  await test(`মোট বিল ৳${SOIL_TEST_INCOME}`, () => {
    assert.equal(clientLedger.summary.totalBilled, SOIL_TEST_INCOME);
  });

  await test(`মোট আদায় ৳${SOIL_TEST_INCOME}`, () => {
    assert.equal(clientLedger.summary.totalReceived, SOIL_TEST_INCOME);
  });

  await test(`ইন্টারনাল কস্ট ৳${INTERNAL_COST}`, () => {
    assert.equal(clientLedger.summary.cost, INTERNAL_COST);
  });

  await test(`নিট লাভ ৳${EXPECTED_NET}`, () => {
    assert.equal(clientLedger.summary.netProfit, EXPECTED_NET);
  });

  await test('দুটি এন্ট্রিই তালিকায় আছে (Admin/Accounts ভিউ)', () => {
    assert.equal(clientLedger.entries.length, 2);
    assert.equal(clientLedger.entries.filter((e) => e.type === 'EXPENSE').length, 1);
  });

  await test('কন্ট্রাক্ট না থাকলে কিস্তির অংশ শূন্য', () => {
    assert.equal(clientLedger.summary.contractBilled, 0);
    assert.equal(clientLedger.summary.contractCollected, 0);
    assert.equal(clientLedger.project, null);
  });

  await test('কন্ট্রাক্ট থাকলে billed/received এ কিস্তিও যোগ হয়', () => {
    // বিশুদ্ধ ফাংশনেই পরীক্ষা — ৳৫০ লাখের প্ল্যানে ৳১০ লাখ আদায় হয়েছে ধরে
    const withContract = summarizeClientLedger(
      [
        { type: LedgerType.INCOME, amount: SOIL_TEST_INCOME },
        { type: LedgerType.EXPENSE, amount: INTERNAL_COST },
      ],
      { total: 5_000_000, collected: 1_000_000 },
    );
    assert.equal(withContract.totalBilled, 5_000_000 + SOIL_TEST_INCOME);
    assert.equal(withContract.totalReceived, 1_000_000 + SOIL_TEST_INCOME);
    assert.equal(withContract.outstanding, 4_000_000);
    assert.equal(withContract.netProfit, 5_000_000 + SOIL_TEST_INCOME - INTERNAL_COST);
  });

  /* ------------------------------------- ৪. কাস্টমার খরচ দেখতে পান না */

  console.log('\nকাস্টমার role এর দৃশ্যমানতা (PRD সেকশন ৪, ৫.৭ ও ৭):');

  const visible = await ledgerData.loadClientVisibleEntries(created.leadId);

  await test('কাস্টমারের কুয়েরিতে শুধু আয় এন্ট্রিটি আসে', () => {
    assert.equal(visible.length, 1);
    assert.equal(visible[0].type, LedgerType.INCOME);
    assert.equal(visible[0].amount, SOIL_TEST_INCOME);
  });

  await test('কাস্টমারের কুয়েরিতে খরচের কোনো চিহ্ন নেই', () => {
    const dump = JSON.stringify(visible);
    assert.equal(dump.includes(String(INTERNAL_COST)), false, 'খরচের অঙ্ক ফাঁস হয়েছে');
    assert.equal(dump.includes('ভেন্ডর'), false, 'খরচের নোট ফাঁস হয়েছে');
    assert.equal(
      visible.some((entry) => entry.type === LedgerType.EXPENSE),
      false,
    );
  });

  // defence in depth — DB তে ভুল ডেটা থাকলেও কুয়েরিটি তা আটকায়
  const badRow = await addEntry({
    type: 'EXPENSE',
    category: 'MATERIAL_COST',
    amount: 9999,
    note: `${TAG} — ভুল করে clientVisible লেখা খরচ`,
    forceClientVisible: true,
  });

  await test('DB তে clientVisible=true লেখা খরচও কাস্টমার দেখেন না', async () => {
    assert.equal(badRow.clientVisible, true, 'টেস্ট ফিক্সচারটিই ভুল হয়েছে');
    const afterBadRow = await ledgerData.loadClientVisibleEntries(created.leadId);
    assert.equal(afterBadRow.length, 1);
    assert.equal(
      afterBadRow.some((entry) => entry.type === LedgerType.EXPENSE),
      false,
      'খরচ এন্ট্রি কাস্টমারের তালিকায় ঢুকে পড়েছে',
    );
  });

  await test('কাস্টমার পোর্টালের পুরো ডেটাতেও খরচ নেই', async () => {
    // লিডটির কোনো প্রজেক্ট নেই, তাই এখানে পোর্টালের লোডারটি সব কাস্টমারের
    // ডেটা নিয়ে চলে — কোথাও এই টেস্টের খরচের অঙ্ক/নোট থাকা চলবে না
    const customers = await prisma.customer.findMany({ select: { userId: true }, take: 20 });
    for (const customer of customers) {
      const portal = await customerData.loadCustomerPortal(customer.userId, new Date());
      const dump = JSON.stringify(portal);
      assert.equal(dump.includes(TAG) && dump.includes('ভেন্ডর'), false);
    }
  });

  await test('CUSTOMER/ENGINEER এর লেজার permission নেই (PRD সেকশন ৪)', () => {
    for (const role of ['CUSTOMER', 'ENGINEER'] as const) {
      assert.equal(can(role, 'ledger:view'), false, `${role} লেজার দেখতে পাচ্ছে`);
      assert.equal(can(role, 'ledger:manage'), false, `${role} লেজার লিখতে পাচ্ছে`);
    }
    // দেখার/লেখার অধিকার যাদের আছে
    assert.equal(can('ACCOUNTS', 'ledger:manage'), true);
    assert.equal(can('ADMIN', 'ledger:manage'), true);
    // MARKETING দেখে, কিন্তু লিখতে পারে না (PRD সেকশন ৪)
    assert.equal(can('MARKETING', 'ledger:view'), true);
    assert.equal(can('MARKETING', 'ledger:manage'), false);
  });

  await test('CUSTOMER `/accounts/ledger` route এ ঢুকতেই পারে না', () => {
    assert.equal(canAccessRoute('CUSTOMER', '/accounts/ledger'), false);
    assert.equal(canAccessRoute('ENGINEER', '/accounts/ledger'), false);
    assert.equal(canAccessRoute('ACCOUNTS', '/accounts/ledger'), true);
    assert.equal(canAccessRoute('ADMIN', '/accounts/ledger'), true);
  });

  /* --------------------------------------------- ৫. কোম্পানি লেজার */

  console.log('\nকোম্পানি লেজার (PRD সেকশন ৫.৬):');

  const from = new Date(Date.now() - 86_400_000);
  const to = new Date(Date.now() + 86_400_000);

  await test('কোম্পানি সামারিতে আয় ও খরচ দুটোই গোনা হয়', async () => {
    const summary = await ledgerData.loadCompanyLedgerSummary(from, to);
    assert.ok(summary.billed >= SOIL_TEST_INCOME, 'আয় গোনা হয়নি');
    assert.ok(summary.cost >= INTERNAL_COST, 'খরচ গোনা হয়নি');
  });

  await test('ক্লায়েন্ট ফিল্টারে শুধু সেই লিডের এন্ট্রিগুলো আসে', async () => {
    const ledger = await ledgerData.loadCompanyLedger({ from, to, leadId: created.leadId });
    assert.equal(ledger.totalCount, 3); // আয় + খরচ + ভুল ডেটার সারি
    assert.equal(
      ledger.entries.every((entry) => entry.leadId === created.leadId),
      true,
    );
  });

  await test('শুধু খরচ ফিল্টারে আয় এন্ট্রি বাদ পড়ে', async () => {
    const ledger = await ledgerData.loadCompanyLedger({
      from,
      to,
      leadId: created.leadId,
      type: LedgerType.EXPENSE,
    });
    assert.equal(ledger.summary.billed, 0);
    assert.equal(ledger.summary.cost, INTERNAL_COST + 9999);
  });

  await test('ট্যাগহীন general এন্ট্রি কোম্পানি লেজারে আসে, ক্লায়েন্টে নয়', async () => {
    const general = await addEntry({
      type: 'EXPENSE',
      category: 'MATERIAL_COST',
      amount: 1200,
      note: `${TAG} — অফিস ভাড়া`,
      leadId: null,
    });
    assert.equal(general.clientVisible, false);

    const companyGeneral = await ledgerData.loadCompanyLedger({ from, to, tagged: 'general' });
    assert.equal(
      companyGeneral.entries.some((entry) => entry.id === general.id),
      true,
      'general এন্ট্রিটি কোম্পানি লেজারে নেই',
    );

    const clientOnly = await ledgerData.loadCompanyLedger({ from, to, leadId: created.leadId });
    assert.equal(
      clientOnly.entries.some((entry) => entry.id === general.id),
      false,
      'ট্যাগহীন এন্ট্রি ক্লায়েন্টের তালিকায় ঢুকেছে',
    );
  });

  await test('মাসিক ট্রেন্ডে চলতি মাসের আয় ও খরচ আছে', async () => {
    const trend = await ledgerData.loadMonthlyLedgerTrend(new Date(), 6);
    assert.equal(trend.length, 6);
    const current = trend[trend.length - 1];
    assert.ok(current.income >= SOIL_TEST_INCOME, 'চলতি মাসের আয় গোনা হয়নি');
    assert.ok(current.expense >= INTERNAL_COST, 'চলতি মাসের খরচ গোনা হয়নি');
    assert.equal(current.net, current.income - current.expense);
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
