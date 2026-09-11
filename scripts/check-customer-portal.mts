/**
 * কাস্টমার পোর্টালের যাচাই — `npm run test:portal`
 *
 * PRD সেকশন ৫.৭ এর **বাধ্যতামূলক নিরাপত্তা শর্তটি** এখানে পরীক্ষা হয়:
 *
 * > কখনোই client এর কোনো ভিউতে Orion এর internal cost/expense/profit margin
 * > দেখানো হবে না।
 *
 * অর্থাৎ কাস্টমার সেশনে যা যা যায় — পোর্টালের পুরো payload, পেমেন্ট পাতার
 * payload, ডকুমেন্ট তালিকা ও রসিদ — তার কোথাও কোনো `type=EXPENSE` এন্ট্রি বা
 * `clientVisible=false` income এন্ট্রি থাকতে পারবে না। UI তে লুকানো যথেষ্ট নয়,
 * তাই এখানে **ডেটা লেয়ারেই** (যা RSC payload এ সিরিয়ালাইজ হয়ে ব্রাউজারে যায়)
 * পরীক্ষা করা হয়।
 *
 * `check-ledger.mts` একই নিয়মটি লেজারের দিক থেকে দেখে (`loadClientVisibleEntries`);
 * এই ফাইলটি দেখে **কাস্টমারের দিক থেকে** — একজন সত্যিকারের কাস্টমার, তার
 * প্রজেক্ট ও তার লিডে বসানো টোপ-এন্ট্রি (bait) দিয়ে।
 *
 * `check-ledger.mts` এর মতোই টেস্ট ফ্রেমওয়ার্ক ছাড়া (tsx + node:assert) ও
 * **আসল ডাটাবেসে** — কারণ পরীক্ষার বিষয়টাই query-level enforcement। শেষে নিজের
 * তৈরি সব রেকর্ড মুছে দেয়।
 */

import assert from 'node:assert/strict';

// `lib/prisma` মডিউল-লোডেই DATABASE_URL পড়ে, তাই import এর *আগে* .env
process.loadEnvFile('.env');

const { PrismaClient } = await import('@prisma/client');
const customerData = await import('../src/lib/customer-data');
const ledgerData = await import('../src/lib/ledger-data');
const { cameraStreamKind, isEmbeddableStreamUrl } = await import('../src/lib/projects');
const { canAccessRoute } = await import('../src/lib/rbac');

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

const TAG = `portal-test-${Date.now()}`;

/** টোপ (bait) — এই অঙ্ক বা লেখা কাস্টমারের payload এ পাওয়া মানেই ফাঁস */
const BAIT = {
  /** সাধারণ ইন্টারনাল খরচ */
  expenseAmount: 771_133,
  expenseNote: `${TAG}-INTERNAL-VENDOR-COST`,
  /** DB তে ভুল করে clientVisible=true লেখা খরচ — defence in depth */
  leakedExpenseAmount: 772_244,
  leakedExpenseNote: `${TAG}-LEAKED-EXPENSE`,
  /** এখনো ক্লায়েন্টকে দেখানোর মতো নয় এমন আয় */
  hiddenIncomeAmount: 773_355,
  hiddenIncomeNote: `${TAG}-HIDDEN-INCOME`,
};

/** ক্লায়েন্ট সত্যিই যেটি দেখবেন */
const VISIBLE_BILL = { amount: 5_000, note: `${TAG}-SOIL-TEST-BILL` };

const ids = {
  userId: '',
  customerId: '',
  leadId: '',
  projectId: '',
  adminId: '',
  entries: [] as string[],
  /** অন্য কাস্টমারের বিল — ownership পরীক্ষার জন্য */
  otherUserId: '',
  otherCustomerId: '',
  otherLeadId: '',
  otherProjectId: '',
  otherBillId: '',
};

async function makeCustomerWithProject(suffix: string) {
  const user = await prisma.user.create({
    data: {
      name: `${TAG}-${suffix} কাস্টমার`,
      email: `${TAG}-${suffix}@example.test`,
      passwordHash: 'x',
      role: 'CUSTOMER',
    },
    select: { id: true },
  });

  const customer = await prisma.customer.create({
    data: { userId: user.id, address: 'টেস্ট ঠিকানা' },
    select: { id: true },
  });

  const lead = await prisma.lead.create({
    data: {
      name: `${TAG}-${suffix} — টেস্ট ক্লায়েন্ট`,
      phone: '+8801700000000',
      source: 'WALK_IN',
      stage: 'WON',
    },
    select: { id: true },
  });

  const project = await prisma.project.create({
    data: {
      leadId: lead.id,
      customerId: customer.id,
      title: `${TAG}-${suffix} টেস্ট প্রজেক্ট`,
      totalContractValue: 5_000_000,
      // অ্যাডমিন ভুল স্কিম বসালে কী হয় — নিচে আলাদা টেস্টে
      cameraStreamUrl: 'https://cctv.example.test/live/site-1.m3u8',
    },
    select: { id: true },
  });

  return { userId: user.id, customerId: customer.id, leadId: lead.id, projectId: project.id };
}

/** অ্যাকশনের নিয়ম না মেনে সরাসরি এন্ট্রি — ইচ্ছাকৃত ভুল ডেটাও বসানো যায় */
async function addEntry(params: {
  leadId: string;
  type: 'INCOME' | 'EXPENSE';
  category: 'SOIL_TEST' | 'MATERIAL_COST';
  amount: number;
  note: string;
  clientVisible: boolean;
  withReceipt?: boolean;
}) {
  const entry = await prisma.ledgerEntry.create({
    data: {
      leadId: params.leadId,
      type: params.type,
      category: params.category,
      amount: params.amount,
      note: params.note,
      receiptNo: params.withReceipt ? await ledgerData.nextLedgerReceiptNo() : null,
      clientVisible: params.clientVisible,
      createdById: ids.adminId,
    },
    select: { id: true, receiptNo: true },
  });

  ids.entries.push(entry.id);
  return entry;
}

async function setup() {
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' }, select: { id: true } });
  if (!admin) throw new Error('সিডে কোনো ADMIN নেই — আগে `npm run db:seed` চালান');
  ids.adminId = admin.id;

  const mine = await makeCustomerWithProject('a');
  Object.assign(ids, mine);

  const other = await makeCustomerWithProject('b');
  ids.otherUserId = other.userId;
  ids.otherCustomerId = other.customerId;
  ids.otherLeadId = other.leadId;
  ids.otherProjectId = other.projectId;
}

async function cleanup() {
  await prisma.ledgerEntry.deleteMany({ where: { id: { in: ids.entries } } });
  for (const projectId of [ids.projectId, ids.otherProjectId]) {
    if (projectId) await prisma.project.delete({ where: { id: projectId } }).catch(() => {});
  }
  for (const leadId of [ids.leadId, ids.otherLeadId]) {
    if (leadId) await prisma.lead.delete({ where: { id: leadId } }).catch(() => {});
  }
  for (const customerId of [ids.customerId, ids.otherCustomerId]) {
    if (customerId) await prisma.customer.delete({ where: { id: customerId } }).catch(() => {});
  }
  for (const userId of [ids.userId, ids.otherUserId]) {
    if (userId) await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  }
}

/**
 * কাস্টমার সেশনে যা যা যায় — সব লোডারের ফলাফল একসাথে।
 *
 * পেজগুলো ঠিক এই ফাংশনগুলোই ডাকে, আর সেগুলোর রিটার্ন RSC payload হয়ে
 * ব্রাউজারে যায়; তাই এখানকার JSON টাই কার্যত network tab এর response।
 */
async function customerSessionPayload(userId: string) {
  const now = new Date();
  const [portal, payments, documents] = await Promise.all([
    customerData.loadCustomerPortal(userId, now),
    customerData.loadCustomerPayments(userId, now),
    customerData.loadCustomerDocuments(userId, now),
  ]);

  return JSON.stringify({ portal, payments, documents });
}

/* --------------------------------------------------------------- run */

console.log('\nকাস্টমার পোর্টাল — যাচাই (PRD সেকশন ৫.৭)\n');

await setup();

try {
  /* ------------------------------------------------ ১. টোপ বসানো */

  console.log('লিডে চার ধরনের এন্ট্রি বসানো হলো:');

  const visibleBill = await addEntry({
    leadId: ids.leadId,
    type: 'INCOME',
    category: 'SOIL_TEST',
    amount: VISIBLE_BILL.amount,
    note: VISIBLE_BILL.note,
    clientVisible: true,
    withReceipt: true,
  });

  const expense = await addEntry({
    leadId: ids.leadId,
    type: 'EXPENSE',
    category: 'MATERIAL_COST',
    amount: BAIT.expenseAmount,
    note: BAIT.expenseNote,
    clientVisible: false,
  });

  const leakedExpense = await addEntry({
    leadId: ids.leadId,
    type: 'EXPENSE',
    category: 'MATERIAL_COST',
    amount: BAIT.leakedExpenseAmount,
    note: BAIT.leakedExpenseNote,
    // ইচ্ছাকৃত ভুল ডেটা — কুয়েরিটা এটিও আটকায় কিনা
    clientVisible: true,
    withReceipt: true,
  });

  const hiddenIncome = await addEntry({
    leadId: ids.leadId,
    type: 'INCOME',
    category: 'SOIL_TEST',
    amount: BAIT.hiddenIncomeAmount,
    note: BAIT.hiddenIncomeNote,
    clientVisible: false,
    withReceipt: true,
  });

  console.log(
    `  · দৃশ্যমান বিল ৳${VISIBLE_BILL.amount}, খরচ ৳${BAIT.expenseAmount}, ` +
      `ভুলে clientVisible করা খরচ ৳${BAIT.leakedExpenseAmount}, ` +
      `লুকানো আয় ৳${BAIT.hiddenIncomeAmount}`,
  );

  /* --------------------------------- ২. কাস্টমার সেশনের পুরো payload */

  console.log('\nকাস্টমার সেশনের response payload (PRD সেকশন ৫.৭):');

  const payload = await customerSessionPayload(ids.userId);

  await test('নিজের সার্ভিস বিলটি payload এ আছে (পোর্টাল কাজ করছে)', () => {
    assert.ok(payload.includes(VISIBLE_BILL.note), 'দৃশ্যমান বিলটিই আসেনি — টেস্ট অর্থহীন হতো');
    assert.ok(payload.includes(String(VISIBLE_BILL.amount)));
  });

  await test('কোনো EXPENSE এন্ট্রি payload এ নেই', () => {
    assert.equal(payload.includes(BAIT.expenseNote), false, 'খরচের নোট ফাঁস হয়েছে');
    assert.equal(
      payload.includes(String(BAIT.expenseAmount)),
      false,
      'খরচের অঙ্ক ফাঁস হয়েছে',
    );
    assert.equal(payload.includes('"EXPENSE"'), false, 'EXPENSE টাইপ payload এ আছে');
  });

  await test('DB তে clientVisible=true লেখা খরচও payload এ নেই', () => {
    assert.equal(payload.includes(BAIT.leakedExpenseNote), false, 'ভুল ডেটার খরচ ফাঁস হয়েছে');
    assert.equal(payload.includes(String(BAIT.leakedExpenseAmount)), false);
  });

  await test('clientVisible=false আয় এন্ট্রিও payload এ নেই', () => {
    assert.equal(payload.includes(BAIT.hiddenIncomeNote), false, 'লুকানো আয় ফাঁস হয়েছে');
    assert.equal(payload.includes(String(BAIT.hiddenIncomeAmount)), false);
  });

  await test('profit/cost/margin ধরনের কোনো ফিল্ড payload এ নেই', () => {
    for (const field of ['netProfit', 'internalCost', '"cost"', 'margin', 'expenseCount']) {
      assert.equal(payload.includes(field), false, `"${field}" ফিল্ডটি কাস্টমারের payload এ আছে`);
    }
  });

  await test('প্রতিটি সার্ভিস বিলের type = INCOME ও clientVisible = true', async () => {
    const portal = await customerData.loadCustomerPortal(ids.userId, new Date());
    const bills = portal.flatMap((p) => p.preProjectBills);
    assert.equal(bills.length, 1, 'দৃশ্যমান বিলের সংখ্যা মেলেনি');
    for (const bill of bills) {
      assert.equal(bill.type, 'INCOME');
      assert.equal(bill.clientVisible, true);
    }
  });

  /* ------------------------------------------- ৩. সার্ভিস বিলের রসিদ */

  console.log('\nসার্ভিস বিলের রসিদ (PRD সেকশন ৫.২ ও ৫.৭):');

  const customer = { id: ids.userId, role: 'CUSTOMER' as const };
  const accounts = { id: ids.adminId, role: 'ACCOUNTS' as const };

  await test('নিজের বিলের রসিদ কাস্টমার খুলতে পারেন', async () => {
    const receipt = await ledgerData.loadServiceBillReceipt(visibleBill.id, customer);
    assert.ok(receipt, 'নিজের রসিদই খোলেনি');
    assert.equal(receipt.amount, VISIBLE_BILL.amount);
    assert.equal(receipt.receiptNo, visibleBill.receiptNo);
  });

  await test('EXPENSE এর id বসালে রসিদ খোলে না (কাস্টমার ও Accounts — দুজনেই)', async () => {
    assert.equal(await ledgerData.loadServiceBillReceipt(expense.id, customer), null);
    assert.equal(await ledgerData.loadServiceBillReceipt(expense.id, accounts), null);
  });

  await test('clientVisible=true লেখা খরচের রসিদও খোলে না', async () => {
    assert.equal(await ledgerData.loadServiceBillReceipt(leakedExpense.id, customer), null);
    assert.equal(await ledgerData.loadServiceBillReceipt(leakedExpense.id, accounts), null);
  });

  await test('clientVisible=false আয়ের রসিদ কাস্টমার খুলতে পারেন না', async () => {
    assert.equal(await ledgerData.loadServiceBillReceipt(hiddenIncome.id, customer), null);
  });

  await test('অন্য কাস্টমারের রসিদ খোলা যায় না (id আন্দাজ করলেও)', async () => {
    const otherBill = await addEntry({
      leadId: ids.otherLeadId,
      type: 'INCOME',
      category: 'SOIL_TEST',
      amount: 4_242,
      note: `${TAG}-OTHER-CUSTOMER-BILL`,
      clientVisible: true,
      withReceipt: true,
    });
    ids.otherBillId = otherBill.id;

    assert.equal(await ledgerData.loadServiceBillReceipt(otherBill.id, customer), null);
    // মালিক নিজে পারেন — অর্থাৎ ownership চেকটি অন্ধভাবে সবাইকে আটকাচ্ছে না
    const asOwner = await ledgerData.loadServiceBillReceipt(otherBill.id, {
      id: ids.otherUserId,
      role: 'CUSTOMER',
    });
    assert.ok(asOwner, 'মালিক নিজের রসিদ খুলতে পারছেন না');
  });

  await test('Accounts যেকোনো ক্লায়েন্টের সার্ভিস বিলের রসিদ ছাপাতে পারে', async () => {
    const receipt = await ledgerData.loadServiceBillReceipt(visibleBill.id, accounts);
    assert.ok(receipt);
    assert.equal(receipt.amount, VISIBLE_BILL.amount);
  });

  await test('অন্য কাস্টমারের payload এ এই কাস্টমারের কিছু নেই', async () => {
    const otherPayload = await customerSessionPayload(ids.otherUserId);
    assert.equal(otherPayload.includes(VISIBLE_BILL.note), false);
    assert.equal(otherPayload.includes(BAIT.expenseNote), false);
  });

  /* ------------------------------------------------ ৪. লাইভ ক্যামেরা */

  console.log('\nলাইভ ক্যামেরা (PRD সেকশন ৫.৪):');

  await test('.m3u8 লিংক HLS প্লেয়ারে যায়', () => {
    assert.equal(cameraStreamKind('https://cctv.example.test/live/site-1.m3u8'), 'hls');
    // signed URL — query string থাকলেও চেনা যায়
    assert.equal(cameraStreamKind('https://cctv.example.test/live.m3u8?token=abc'), 'hls');
  });

  await test('অন্য লিংক iframe এ যায়', () => {
    assert.equal(cameraStreamKind('https://www.youtube.com/embed/xyz'), 'embed');
    assert.equal(cameraStreamKind('http://192.168.0.50:8080/player'), 'embed');
  });

  await test('লিংক না থাকলে বা স্কিম ভুল হলে কিছুই embed হয় না', () => {
    for (const bad of [null, undefined, '', 'javascript:alert(1)', 'data:text/html,x', 'ftp://x/y']) {
      assert.equal(cameraStreamKind(bad), null, `"${bad}" embed হয়ে যাচ্ছে`);
      assert.equal(isEmbeddableStreamUrl(bad), false);
    }
  });

  await test('ভুল স্কিমের ক্যামেরা URL পোর্টালের payload এ যায় না', async () => {
    await prisma.project.update({
      where: { id: ids.projectId },
      data: { cameraStreamUrl: 'javascript:alert(1)' },
    });

    const portal = await customerData.loadCustomerPortal(ids.userId, new Date());
    assert.equal(portal[0].project.cameraStreamUrl, null);
    assert.equal(JSON.stringify(portal).includes('javascript:'), false);
  });

  /* ---------------------------------------------------- ৫. route access */

  console.log('\nRoute access (PRD সেকশন ৪):');

  await test('কাস্টমার শুধু নিজের পোর্টাল ও রসিদে ঢুকতে পারে', () => {
    assert.equal(canAccessRoute('CUSTOMER', '/customer'), true);
    assert.equal(canAccessRoute('CUSTOMER', '/customer/payments'), true);
    assert.equal(canAccessRoute('CUSTOMER', '/receipts/abc'), true);
    assert.equal(canAccessRoute('CUSTOMER', '/receipts/bill/abc'), true);
  });

  await test('কাস্টমার অন্য কোনো প্যানেলে ঢুকতে পারে না', () => {
    for (const path of ['/admin', '/accounts', '/accounts/ledger', '/sales', '/engineer']) {
      assert.equal(canAccessRoute('CUSTOMER', path), false, `${path} খোলা আছে`);
    }
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

console.log('সব যাচাই সফল — কাস্টমার সেশনে কোনো internal cost/expense যায় না\n');
