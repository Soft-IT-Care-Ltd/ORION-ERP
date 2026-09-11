/**
 * Zod স্কিমাগুলোর দ্রুত যাচাই — `npm run test:validations`
 *
 * ফাইলটি ইচ্ছে করেই `.mts` — `libphonenumber-js` এর CJS বিল্ড tsx এর নিচে
 * নিজের metadata JSON লোড করতে পারে না (ESM বিল্ডটি পারে)। অ্যাপে সমস্যা নেই,
 * সেখানে Next নিজেই বান্ডল করে।
 *
 * টেস্ট ফ্রেমওয়ার্ক ছাড়াই চলে (tsx + node:assert), কারণ এখানে দরকার শুধু
 * বিশুদ্ধ ফাংশনের আচরণ পরীক্ষা — ডাটাবেস বা ব্রাউজার লাগে না। পুরো ফ্লো এর
 * ম্যানুয়াল ধাপগুলো `TESTING.md` এ।
 *
 * নিয়ম: প্রতিটি স্কিমার (ক) একটি বৈধ ইনপুট পাস করে, (খ) যে নিয়মটির জন্য
 * স্কিমাটি লেখা হয়েছে সেটি ভাঙলে ঠিক ওই ফিল্ডেই এরর আসে।
 */

import assert from 'node:assert/strict';

// namespace import — tsx স্কিমা ফাইলগুলো CJS এ নামায়, তাই ESM এর named-export
// ডিটেকশন সব নাম খুঁজে পায় না; পুরো namespace নিয়ে `mod()` দিয়ে খুলে নেওয়া হয়
import * as formNs from '../src/lib/validations/form';
import * as commonNs from '../src/lib/validations/common';
import * as userNs from '../src/lib/validations/user';
import * as leadBaseNs from '../src/lib/validations/lead-base';
import * as projectNs from '../src/lib/validations/project';
import * as paymentNs from '../src/lib/validations/payment';
import * as convertNs from '../src/lib/validations/convert';
import * as ledgerNs from '../src/lib/validations/ledger';
import * as checklistNs from '../src/lib/validations/checklist';
import * as followUpNs from '../src/lib/validations/follow-up';
import * as documentNs from '../src/lib/validations/document';

/** CJS ইন্টারঅপ — আসল exports গুলো `default` এর ভেতরে পড়ে যায় */
function mod<T>(ns: T): T {
  return ((ns as { default?: T }).default ?? ns) as T;
}

const form = mod(formNs);
const common = mod(commonNs);
const user = mod(userNs);
const leadBase = mod(leadBaseNs);
const project = mod(projectNs);
const payment = mod(paymentNs);
const convert = mod(convertNs);
const ledger = mod(ledgerNs);
const checklist = mod(checklistNs);
const followUp = mod(followUpNs);
const document = mod(documentNs);

const { formValues, validate } = form;
const { parseLocalDate } = common;
const { createUserSchema, resetPasswordSchema, updateUserSchema } = user;
const { leadFormSchema, changeStageSchema, addNoteSchema } = leadBase;
const { updateProjectSchema, phaseUpdateSchema, savePhaseTemplateSchema } = project;
const { generatePlanSchema, paymentEntrySchema, saveScheduleSchema } = payment;
const { convertLeadSchema } = convert;
const { ledgerEntrySchema } = ledger;
const { addChecklistItemSchema } = checklist;
const { logFollowUpSchema } = followUp;
const { uploadProjectDocumentSchema } = document;

let passed = 0;
const failures: string[] = [];

function test(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
  } catch (error) {
    failures.push(`${name}\n    ${(error as Error).message.split('\n')[0]}`);
  }
}

/** স্কিমাটি পাস করবে — এবং parse করা মান ফেরত দেবে */
function ok<T>(schema: { safeParse: (v: unknown) => { success: boolean; data?: T; error?: unknown } }, input: unknown): T {
  const result = schema.safeParse(input);
  assert.equal(result.success, true, `পাস করার কথা ছিল: ${JSON.stringify(result.error ?? '')}`);
  return result.data as T;
}

/** স্কিমাটি ঠিক `field` ফিল্ডে ব্যর্থ হবে */
function failsOn(schema: { safeParse: (v: unknown) => { success: boolean } }, input: unknown, field: string) {
  const result = validate(schema as never, input);
  assert.equal(result.ok, false, `ব্যর্থ হওয়ার কথা ছিল (${field})`);
  if (!result.ok) {
    assert.ok(
      field in result.fieldErrors,
      `"${field}" এ এরর আশা করা হয়েছিল, পাওয়া গেছে: ${Object.keys(result.fieldErrors).join(', ')}`,
    );
  }
}

/* ------------------------------------------------------------- common */

test('parseLocalDate — local midnight, UTC শিফট নয়', () => {
  const date = parseLocalDate('2026-01-05')!;
  assert.equal(date.getFullYear(), 2026);
  assert.equal(date.getMonth(), 0);
  assert.equal(date.getDate(), 5);
  assert.equal(date.getHours(), 0);
});

test('parseLocalDate — রোল-ওভার তারিখ বাতিল', () => {
  assert.equal(parseLocalDate('2026-02-31'), undefined);
  assert.equal(parseLocalDate('2026-13-01'), undefined);
  assert.equal(parseLocalDate('not-a-date'), undefined);
});

test('formValues — FormData → object, ফাইল বাদ', () => {
  const fd = new FormData();
  fd.set('name', 'Orion Green');
  fd.append('tag', 'a');
  fd.append('tag', 'b');
  fd.set('file', new File(['x'], 'x.pdf'));
  const values = formValues(fd);
  assert.deepEqual(values, { name: 'Orion Green', tag: ['a', 'b'] });
});

/* --------------------------------------------------------------- user */

test('createUser — বৈধ ইনপুট', () => {
  const data = ok(createUserSchema, {
    name: '  Sohel Rana ',
    email: 'Sales@Orion.com',
    phone: '01711223344',
    role: 'MARKETING',
    password: 'Orion@1234',
  });
  assert.equal(data.name, 'Sohel Rana', 'trim হওয়ার কথা');
  assert.equal(data.email, 'sales@orion.com', 'lowercase হওয়ার কথা');
});

test('createUser — ছোট পাসওয়ার্ড আটকায়', () => {
  failsOn(createUserSchema, { name: 'ক খ', email: 'a@b.com', role: 'ADMIN', password: 'short' }, 'password');
});

test('createUser — ভুল ফোন ফরম্যাট আটকায়', () => {
  failsOn(createUserSchema, { name: 'ক খ', email: 'a@b.com', phone: '0171122', role: 'ADMIN', password: 'Orion@1234' }, 'phone');
});

test('updateUser — id ছাড়া চলবে না', () => {
  failsOn(updateUserSchema, { id: '', name: 'ক খ', email: 'a@b.com', role: 'ADMIN' }, 'id');
});

test('resetPassword — ৮ অক্ষরের কম নয়', () => {
  failsOn(resetPasswordSchema, { id: 'u1', password: '1234567' }, 'password');
});

/* --------------------------------------------------------------- lead */

const validLead = {
  name: 'মোঃ রফিকুল ইসলাম',
  phoneCountry: 'AE',
  phoneNumber: '501234501',
  residenceCountry: 'AE',
  email: '',
  source: 'FACEBOOK_ADS',
  budgetMin: '4500000',
  budgetMax: '5500000',
};

test('lead (client) — বৈধ ইনপুট, খালি ইমেইল undefined', () => {
  const data = ok(leadFormSchema, validLead);
  assert.equal(data.email, undefined);
  assert.equal(data.budgetMin, 4500000);
});

test('lead (client) — উল্টো বাজেট রেঞ্জ আটকায়', () => {
  failsOn(leadFormSchema, { ...validLead, budgetMin: '9000000', budgetMax: '1000000' }, 'budgetMax');
});

test('lead (client) — নাম/নম্বর ছাড়া শুধু সম্পর্ক আটকায়', () => {
  failsOn(leadFormSchema, { ...validLead, localContactRelation: 'ভাই' }, 'localContactName');
});

test('lead (client) — অক্ষরওয়ালা ফোন নম্বর আটকায়', () => {
  failsOn(leadFormSchema, { ...validLead, phoneNumber: 'abcdefgh' }, 'phoneNumber');
});

/**
 * সার্ভারের লিড স্কিমা (`validations/lead.ts`) libphonenumber দিয়ে নম্বরটি
 * সত্যিই ওই দেশের কিনা দেখে ও E.164 তে নামায়।
 *
 * এখানে সেটি চালানো যায় না: `libphonenumber-js` এর CJS বিল্ড tsx এর নিচে নিজের
 * metadata JSON লোড করতে পারে না (Next এর বান্ডলে সমস্যা নেই, অ্যাপে কাজ করে)।
 * তাই ক্লায়েন্ট-সার্ভার ভাগটুকু এখানে যাচাই করা হয় — ব্রাউজারের স্কিমা কেবল
 * *গঠন* দেখে, দেশভিত্তিক যাচাই সার্ভারের কাজ। আসল E.164 রূপান্তরের ধাপটি
 * `TESTING.md` এর ধাপ ২ এ ম্যানুয়ালি দেখা হয়।
 */
test('lead (client) — গঠন ঠিক থাকলে ছেড়ে দেয়, দেশ-যাচাই সার্ভারের কাজ', () => {
  // বাংলাদেশের কোনো বৈধ নম্বর নয়, তবু গঠনগতভাবে নম্বরের মতো — client পাস করায়
  ok(leadFormSchema, { ...validLead, phoneCountry: 'BD', phoneNumber: '1234567' });
});

test('changeStage — LOST এ কারণ বাধ্যতামূলক', () => {
  failsOn(changeStageSchema, { id: 'l1', stage: 'LOST' }, 'lostReason');
  failsOn(changeStageSchema, { id: 'l1', stage: 'LOST', lostReason: 'যা খুশি' }, 'lostReason');
  ok(changeStageSchema, { id: 'l1', stage: 'LOST', lostReason: 'Price too high' });
  ok(changeStageSchema, { id: 'l1', stage: 'NEGOTIATION' });
});

test('addNote — খুব ছোট নোট আটকায়', () => {
  failsOn(addNoteSchema, { id: 'l1', note: 'x' }, 'note');
});

/* ------------------------------------------------------------ project */

/** v2 — প্রজেক্ট তৈরি হয় Lead→Won কনভার্শনে, তাই এখানে শুধু এডিটের স্কিমা */
const validProject = {
  id: 'p1',
  title: 'রহিম সাহেবের ডুপ্লেক্স',
  totalContractValue: '60,00,000',
  status: 'ACTIVE',
};

test('project — খালি ঐচ্ছিক ফিল্ডগুলো null হয়', () => {
  const data = ok(updateProjectSchema, {
    ...validProject,
    landLocation: '',
    buildingType: '',
    floors: '',
    totalSqft: '',
    ratePerSqft: '',
    startDate: '',
    cameraStreamUrl: '',
    engineerId: '',
  });
  assert.equal(data.totalContractValue, 6000000);
  assert.equal(data.startDate, null);
  assert.equal(data.buildingType, null);
  assert.equal(data.cameraStreamUrl, null);
  assert.equal(data.engineerId, null);
});

test('project — অবৈধ তারিখ ও তলার সংখ্যা আটকায়', () => {
  failsOn(updateProjectSchema, { ...validProject, startDate: '2026-02-31' }, 'startDate');
  failsOn(updateProjectSchema, { ...validProject, floors: '0' }, 'floors');
  failsOn(updateProjectSchema, { ...validProject, floors: '99' }, 'floors');
});

test('project — ক্যামেরার লিংক শুধু http/https', () => {
  // `javascript:` স্কিম iframe এ বসলে কাস্টমারের ব্রাউজারে স্ক্রিপ্ট চলত
  failsOn(updateProjectSchema, { ...validProject, cameraStreamUrl: 'javascript:alert(1)' }, 'cameraStreamUrl');
  failsOn(updateProjectSchema, { ...validProject, cameraStreamUrl: 'not a url' }, 'cameraStreamUrl');
  const data = ok(updateProjectSchema, { ...validProject, cameraStreamUrl: 'https://cam.example/live' });
  assert.equal(data.cameraStreamUrl, 'https://cam.example/live');
});

test('project — বাড়ির ধরন তালিকার বাইরে হলে আটকায়', () => {
  failsOn(updateProjectSchema, { ...validProject, buildingType: 'PENTHOUSE' }, 'buildingType');
  const data = ok(updateProjectSchema, { ...validProject, buildingType: 'DUPLEX' });
  assert.equal(data.buildingType, 'DUPLEX');
});

test('phaseUpdate — % শুধু ০/২৫/৫০/৭৫/১০০', () => {
  ok(phaseUpdateSchema, { phaseId: 'ph1', percentComplete: '75' });
  failsOn(phaseUpdateSchema, { phaseId: 'ph1', percentComplete: '63' }, 'percentComplete');
});

test('phaseTemplate — একই নাম দুবার আটকায় (v2: গ্লোবাল, projectId নেই)', () => {
  failsOn(
    savePhaseTemplateSchema,
    { phases: [{ name: 'Foundation', defaultDurationDays: '30' }, { name: 'foundation', defaultDurationDays: '20' }] },
    'phases',
  );
  const data = ok(savePhaseTemplateSchema, {
    phases: [{ name: 'Foundation Work', defaultDurationDays: '40' }, { name: 'Finishing', defaultDurationDays: '0' }],
  });
  assert.equal(data.phases[1].defaultDurationDays, null, '০ দিন মানে সময়কাল নেই');
});

/* ------------------------------------------------------------ payment */

const validPlan = {
  projectId: 'p1',
  bookingDate: '2026-01-05',
  bookingPercent: '10',
  downPaymentPercent: '15',
  downPaymentDays: '30',
  agreementPercent: '15',
  agreementDate: '2026-02-05',
  monthlyCount: '20',
  monthlyPercent: '2.5',
  firstInstallmentDate: '2026-03-05',
  handoverDate: '2027-11-05',
};

test('generatePlan — বৈধ টেমপ্লেট', () => {
  const data = ok(generatePlanSchema, validPlan);
  assert.equal(data.bookingPercent, 10);
  assert.ok(data.bookingDate instanceof Date);
});

test('generatePlan — শতাংশের যোগফল ১০০% ছুঁলে আটকায়', () => {
  failsOn(generatePlanSchema, { ...validPlan, monthlyPercent: '5' }, 'monthlyPercent');
});

test('saveSchedule — খালি তালিকা আটকায়, অঙ্ক রাউন্ড হয়, ফেজ লিংক ঐচ্ছিক', () => {
  failsOn(saveScheduleSchema, { projectId: 'p1', installments: [] }, 'installments');
  const data = ok(saveScheduleSchema, {
    projectId: 'p1',
    installments: [
      { label: 'Signup Money', dueDate: '2026-01-05', amount: '450000.6', phaseId: '' },
      { label: 'Foundation Complete', dueDate: '2026-03-05', amount: '800000', phaseId: 'ph1' },
    ],
  });
  assert.equal(data.installments[0].amount, 450001);
  assert.equal(data.installments[0].phaseId, null, 'খালি ফেজ → null');
  assert.equal(data.installments[1].phaseId, 'ph1');
});

test('paymentEntry — কিস্তি ও ধনাত্মক অঙ্ক লাগে', () => {
  failsOn(paymentEntrySchema, { installmentId: '', amountReceived: '1000', method: 'CASH', paidAt: '2026-01-05' }, 'installmentId');
  failsOn(paymentEntrySchema, { installmentId: 'i1', amountReceived: '0', method: 'CASH', paidAt: '2026-01-05' }, 'amountReceived');
  failsOn(paymentEntrySchema, { installmentId: 'i1', amountReceived: '1000', method: 'PAYPAL', paidAt: '2026-01-05' }, 'method');
  const data = ok(paymentEntrySchema, { installmentId: 'i1', amountReceived: '1,00,000', method: 'BKASH', receiptNo: '  ', paidAt: '2026-01-05' });
  assert.equal(data.amountReceived, 100000);
  assert.equal(data.receiptNo, undefined, 'শুধু স্পেস হলে undefined — server নিজে রসিদ নম্বর বানাবে');
});

/* ------------------------------------------------- convert (Lead→Project) */

test('convertLead — কন্ট্রাক্ট ভ্যালু লাগে, রেট/sqft ও ইমেইল ঐচ্ছিক', () => {
  failsOn(convertLeadSchema, { leadId: 'l1', totalContractValue: '' }, 'totalContractValue');
  failsOn(convertLeadSchema, { leadId: 'l1', totalContractValue: '-5' }, 'totalContractValue');
  failsOn(
    convertLeadSchema,
    { leadId: 'l1', totalContractValue: '4500000', customerEmail: 'not-an-email' },
    'customerEmail',
  );

  const data = ok(convertLeadSchema, {
    leadId: 'l1',
    totalContractValue: '45,00,000',
    ratePerSqft: '2200',
    totalSqft: '',
    startDate: '',
    customerEmail: '',
  });
  assert.equal(data.totalContractValue, 4500000);
  assert.equal(data.ratePerSqft, 2200);
  assert.equal(data.totalSqft, null);
  assert.equal(data.startDate, null);
  assert.equal(data.customerEmail, undefined);
});

/* ------------------------------------------------------------- ledger */

test('ledgerEntry — ধনাত্মক অঙ্ক ও বৈধ type/category লাগে', () => {
  failsOn(ledgerEntrySchema, { type: 'INCOME', category: 'SOIL_TEST', amount: '0', date: '2026-01-05' }, 'amount');
  failsOn(ledgerEntrySchema, { type: 'REFUND', category: 'SOIL_TEST', amount: '5000', date: '2026-01-05' }, 'type');
  failsOn(ledgerEntrySchema, { type: 'INCOME', category: 'BRIBE', amount: '5000', date: '2026-01-05' }, 'category');
  failsOn(ledgerEntrySchema, { type: 'INCOME', category: 'SOIL_TEST', amount: '5000', date: '' }, 'date');
});

test('ledgerEntry — leadId খালি হলে company-wide entry (null)', () => {
  const data = ok(ledgerEntrySchema, {
    leadId: '',
    type: 'EXPENSE',
    category: 'OFFICE_OVERHEAD',
    amount: '12,500.4',
    date: '2026-01-05',
    note: '  ',
  });
  assert.equal(data.leadId, null);
  assert.equal(data.amount, 12500, 'পয়সা বাদ — পূর্ণ টাকা');
  assert.equal(data.note, undefined);
});

test('ledgerEntry — clientVisible ইনপুটে নেই', () => {
  // PRD সেকশন ৪: EXPENSE কখনো ক্লায়েন্ট দেখবে না, তাই মানটি server এ `type`
  // থেকেই ঠিক হয় — অ্যাকশন সরাসরি ডেকেও true পাঠানো যায় না
  const data = ok(ledgerEntrySchema, {
    type: 'EXPENSE',
    category: 'MATERIAL_COST',
    amount: '1000',
    date: '2026-01-05',
    clientVisible: true,
  }) as Record<string, unknown>;
  assert.equal('clientVisible' in data, false);
});

/* ---------------------------------------------------- checklist / follow-up */

test('checklist — খুব ছোট label আটকায়', () => {
  failsOn(addChecklistItemSchema, { leadId: 'l1', label: 'x' }, 'label');
  const data = ok(addChecklistItemSchema, { leadId: 'l1', label: '  সাইট ভিজিট সম্পন্ন  ', note: '' });
  assert.equal(data.label, 'সাইট ভিজিট সম্পন্ন');
  assert.equal(data.note, undefined);
});

test('followUp — নোট লাগে, তারিখ ঐচ্ছিক', () => {
  failsOn(logFollowUpSchema, { leadId: 'l1', note: 'x' }, 'note');
  failsOn(logFollowUpSchema, { leadId: 'l1', note: 'ফোনে কথা হয়েছে', nextFollowUpAt: '2026-02-31' }, 'nextFollowUpAt');
  const data = ok(logFollowUpSchema, { leadId: 'l1', note: 'ফোনে কথা হয়েছে', nextFollowUpAt: '' });
  assert.equal(data.nextFollowUpAt, undefined, 'খালি মানে "আর ফলো-আপ নেই"');
});

/* ----------------------------------------------------------- documents */

test('projectDocument — তালিকার বাইরের ধরন আটকায়', () => {
  failsOn(uploadProjectDocumentSchema, { projectId: 'p1', type: 'Random Paper' }, 'type');
  ok(uploadProjectDocumentSchema, { projectId: 'p1', type: 'Contract', description: '  ' });
});

/* -------------------------------------------------------------- ফলাফল */

console.log(`\n✔ ${passed} টি যাচাই পাস করেছে`);
if (failures.length > 0) {
  console.error(`\n✘ ${failures.length} টি ব্যর্থ:\n`);
  for (const failure of failures) console.error(`  • ${failure}\n`);
  process.exit(1);
}
