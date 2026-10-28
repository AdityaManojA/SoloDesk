import test from 'node:test';
import assert from 'node:assert/strict';
import { fresh, money, setCur, calc, today } from '../src/lib.js';
import { validateWorkspace } from '../src/workspace-upgrades.js';
import { quoteToInvoice } from '../src/billing.js';
import { createExpense, projectFinancials } from '../src/expenses.js';
import { PAYMENT_TERMS, dueDateForTerms, calcLateFee } from '../src/payment-terms.js';
import { taxPackSummary, taxPackCsv } from '../src/tax-pack.js';
import { signOffProposal } from '../src/approvals.js';
import { createIntakeBrief, submitBriefAnswers } from '../src/intake.js';
import { safeUrl } from '../src/profile.js';

test('multi-currency formats properly and allows per-invoice/client currency', () => {
  setCur('USD');
  assert.equal(money(100), '$100.00');
  assert.equal(money(100, 'EUR'), '€100.00');
  assert.equal(money(100, 'GBP'), '£100.00');
  // Workspace validation accepts client and project with currency
  const w = {
    ...fresh(),
    clients: [{ id: 'c1', name: 'Euro Client', currency: 'EUR' }],
    projects: [{ id: 'p1', name: 'Design', client: 'c1', currency: 'EUR' }],
    invoices: [{
      id: 'inv1', no: 'INV-1', client: 'c1', project: 'p1', issue: '2026-10-25', due: '2026-11-08',
      state: 'sent', currency: 'EUR', items: [{ desc: 'Work', qty: 1, price: 500 }], tax: 0, pays: []
    }]
  };
  assert.ok(validateWorkspace(w));
});

test('quote-to-invoice converts approved quotes into full or deposit invoices', () => {
  const w = {
    ...fresh(),
    clients: [{ id: 'c', name: 'Acme' }],
    projects: [{ id: 'p', name: 'Rebrand', client: 'c' }],
    invoices: [{
      id: 'q1', no: 'QUO-1', client: 'c', project: 'p', issue: '2026-10-20', due: '2026-11-03',
      state: 'draft', title: 'Brand Identity', items: [{ desc: 'Logo Design', qty: 1, price: 2000 }],
      tax: 10, pays: [], approval: { state: 'approved', requestedAt: '2026-10-21T00:00:00Z' }
    }]
  };
  // 1. Full 100% conversion
  const inv1Id = quoteToInvoice(w, 'q1');
  const inv1 = w.invoices.find(i => i.id === inv1Id);
  assert.ok(inv1);
  assert.equal(inv1.client, 'c');
  assert.equal(inv1.project, 'p');
  assert.equal(inv1.items[0].price, 2000);
  assert.equal(inv1.tax, 10);
  assert.ok(validateWorkspace(w));

  // 2. 50% deposit conversion
  const inv2Id = quoteToInvoice(w, 'q1', { depositPercent: 50 });
  const inv2 = w.invoices.find(i => i.id === inv2Id);
  assert.ok(inv2);
  assert.equal(inv2.items.length, 1);
  assert.equal(inv2.items[0].price, 1000); // 50% of 2000
  assert.match(inv2.items[0].desc, /50% Upfront Deposit/);
  assert.ok(validateWorkspace(w));
});

test('payment terms presets and overdue late fee calculations work accurately', () => {
  assert.equal(dueDateForTerms('2026-10-01', 'receipt'), '2026-10-01');
  assert.equal(dueDateForTerms('2026-10-01', 'net7'), '2026-10-08');
  assert.equal(dueDateForTerms('2026-10-01', 'net14'), '2026-10-15');
  assert.equal(dueDateForTerms('2026-10-01', 'net30'), '2026-10-31');

  // Overdue invoice late fee
  const inv = {
    id: 'i1', no: 'INV-1', issue: '2026-09-01', due: '2026-09-15',
    state: 'sent', items: [{ desc: 'Consulting', qty: 1, price: 1000 }],
    tax: 0, pays: []
  };
  // 60 days overdue as of 2026-11-14 = 2 months. 2 months * 1.5% * $1000 = $30.00
  const fee = calcLateFee(inv, '2026-11-14', 0.015);
  assert.equal(fee, 30);

  // Paid invoice has zero late fee
  assert.equal(calcLateFee({ ...inv, state: 'paid' }, '2026-11-14'), 0);
  // Not yet due has zero late fee
  assert.equal(calcLateFee({ ...inv, due: '2026-12-01' }, '2026-11-14'), 0);
});

test('expense tracking logs project costs and computes net profit margins', () => {
  const w = {
    ...fresh(),
    clients: [{ id: 'c', name: 'Client' }],
    projects: [{ id: 'p', name: 'App', client: 'c' }],
    invoices: [{
      id: 'inv', no: 'INV-1', client: 'c', project: 'p', issue: '2026-10-01', due: '2026-10-15',
      state: 'sent', items: [{ desc: 'App Dev', qty: 1, price: 10000 }], tax: 0,
      pays: [{ id: 'pay1', date: '2026-10-05', amt: 10000, note: 'Wire' }]
    }]
  };
  // Add 2 expenses: contractor $3,000 + software $1,000
  createExpense(w, { project: 'p', desc: 'Contractor', amount: 3000, category: 'Subcontractor' });
  createExpense(w, { project: 'p', desc: 'Figma license', amount: 1000, category: 'Software' });
  assert.equal(w.expenses.length, 2);

  const fin = projectFinancials(w, 'p');
  assert.equal(fin.revenue, 10000);
  assert.equal(fin.expenses, 4000);
  assert.equal(fin.netProfit, 6000);
  assert.equal(fin.margin, 60); // 60% net profit margin
  assert.ok(validateWorkspace(w));
});

test('accountant-ready tax pack computes quarterly tax collected and uncollected revenue', () => {
  const w = {
    ...fresh(),
    clients: [{ id: 'c', name: 'Acme' }],
    projects: [{ id: 'p', name: 'Web', client: 'c' }],
    invoices: [
      {
        id: 'i1', no: 'INV-1', client: 'c', project: 'p', issue: '2026-01-15', due: '2026-01-30',
        state: 'sent', items: [{ desc: 'Dev', qty: 1, price: 1000 }], tax: 10,
        pays: [{ id: 'p1', date: '2026-01-20', amt: 1100 }] // Full $1000 + $100 tax paid
      },
      {
        id: 'i2', no: 'INV-2', client: 'c', project: 'p', issue: '2026-02-10', due: '2026-02-24',
        state: 'sent', items: [{ desc: 'Design', qty: 1, price: 2000 }], tax: 10,
        pays: [] // Unpaid: $2000 subtotal, $200 tax uncollected
      }
    ]
  };
  const summary = taxPackSummary(w, '2026-Q1');
  assert.equal(summary.length, 1);
  const q1 = summary[0];
  assert.equal(q1.quarter, '2026-Q1');
  assert.equal(q1.invoiceCount, 2);
  assert.equal(q1.taxableSubtotal, 3000);
  assert.equal(q1.taxBilled, 300);
  assert.equal(q1.taxCollected, 100);
  assert.equal(q1.uncollectedRevenue, 2200);

  const csvOut = taxPackCsv(w, '2026-Q1');
  assert.ok(csvOut.includes('2026-Q1'));
  assert.ok(csvOut.includes('3000.00'));
});

test('digital SOW / proposal sign-off logs signer name, timestamp and user agent', () => {
  const w = {
    ...fresh(),
    clients: [{ id: 'c', name: 'Acme' }],
    docs: [{
      id: 'd1', kind: 'prd', title: 'Master SOW', status: 'In review', client: 'c',
      approval: { state: 'pending', requestedAt: '2026-10-20T00:00:00Z' }
    }]
  };
  signOffProposal(w, 'd1', { signerName: 'Elena Rostova', signerEmail: 'elena@acme.test', userAgent: 'Mozilla/5.0' }, new Date('2026-10-27T10:00:00Z'));
  const doc = w.docs[0];
  assert.equal(doc.status, 'Approved');
  assert.equal(doc.approval.state, 'approved');
  assert.equal(doc.approval.signOff.name, 'Elena Rostova');
  assert.equal(doc.approval.signOff.signedAt, '2026-10-27T10:00:00.000Z');
  assert.equal(doc.approval.signOff.userAgent, 'Mozilla/5.0');
  assert.ok(validateWorkspace(w));
});

test('intake brief questionnaire initializes with default questions and records answers', () => {
  const w = {
    ...fresh(),
    clients: [{ id: 'c', name: 'Client' }],
    docs: []
  };
  const brief = createIntakeBrief(w, { clientId: 'c', title: 'Client Onboarding Intake' });
  assert.equal(brief.kind, 'brief');
  assert.equal(brief.questions.length, 3);
  assert.equal(w.docs.length, 1);

  const q1Id = brief.questions[0].id;
  submitBriefAnswers(w, brief.id, { [q1Id]: 'Build a high-converting portfolio website.' });
  assert.equal(brief.questions[0].answer, 'Build a high-converting portfolio website.');
  assert.equal(brief.status, 'Approved');
  assert.ok(brief.submittedAt);
  assert.ok(validateWorkspace(w));
});

import { applyResponses } from '../src/approvals.js';
import { applyClientUpdate } from '../src/client-feed.js';
import { finishFocus } from '../src/productivity.js';

test('applyResponses records signerName in approval signOff audit trail', () => {
  const w = {
    ...fresh(),
    clients: [{ id: 'client-1', name: 'Studio Client' }],
    tasks: [{
      id: 'task-1', client: 'client-1', title: 'Scope Proposal', status: 'Todo',
      approval: { state: 'pending', requestedAt: '2026-10-20T00:00:00Z' }
    }]
  };
  const responses = [{
    taskId: 'task-1',
    decision: 'approved',
    comment: 'All terms agreed',
    signerName: 'Marcus Vance',
    email: 'marcus@client.com',
    userAgent: 'Terracove/1.2 Chrome/120',
    at: '2026-10-27T12:00:00Z'
  }];
  const changed = applyResponses(w, 'client-1', responses);
  assert.deepEqual(changed, ['task-1']);
  const t = w.tasks[0];
  assert.equal(t.approval.state, 'approved');
  assert.equal(t.approval.signOff.name, 'Marcus Vance');
  assert.equal(t.approval.signOff.email, 'marcus@client.com');
  assert.equal(t.approval.signOff.signedAt, '2026-10-27T12:00:00Z');
  assert.equal(t.approval.signOff.userAgent, 'Terracove/1.2 Chrome/120');
});

test('applyClientUpdate syncs client brief responses to workspace doc', () => {
  const w = {
    ...fresh(),
    clients: [{ id: 'c1', name: 'Client 1' }],
    docs: [{
      id: 'brief-1', client: 'c1', kind: 'brief', title: 'Onboarding Brief',
      questions: [
        { id: 'q1', question: 'Company goals', answer: '', required: true }
      ]
    }]
  };
  const update = {
    kind: 'brief',
    docId: 'brief-1',
    questions: [
      { id: 'q1', question: 'Company goals', answer: 'Expand internationally', required: true }
    ]
  };
  const act = applyClientUpdate(w, 'c1', update, '2026-10-27T14:00:00Z');
  assert.ok(act);
  assert.equal(act.action, 'client-submitted-brief');
  const doc = w.docs[0];
  assert.equal(doc.questions[0].answer, 'Expand internationally');
  assert.equal(doc.submittedAt, '2026-10-27T14:00:00Z');
});

test('focus timer tracks elapsed time, pause/resume and logs session accurately', () => {
  const w = {
    ...fresh(),
    tasks: [{ id: 't1', title: 'Design System', project: 'p1' }],
    focusSessions: []
  };
  // Start
  const startAt = 100000;
  w.focusTimer = { taskId: 't1', title: 'Design System', project: 'p1', startedAt: startAt, elapsedMs: 0 };
  
  // Pause after 15 seconds
  const pauseAt = startAt + 15000;
  w.focusTimer.elapsedMs += (pauseAt - w.focusTimer.startedAt);
  w.focusTimer.startedAt = null;
  assert.equal(w.focusTimer.elapsedMs, 15000);

  // Resume at later time
  const resumeAt = pauseAt + 5000;
  w.focusTimer.startedAt = resumeAt;

  // Finish 45 seconds later (total 15s + 45s = 60s)
  const finishAt = resumeAt + 45000;
  assert.ok(finishFocus(w, finishAt));
  assert.equal(w.focusTimer, null);
  assert.equal(w.focusSessions.length, 1);
  assert.equal(w.focusSessions[0].seconds, 60);
  assert.equal(w.focusSessions[0].title, 'Design System');
});

test('safeUrl permits secure web payment links and rejects unsafe schemes', () => {
  assert.equal(safeUrl('https://buy.stripe.com/test_123'), 'https://buy.stripe.com/test_123');
  assert.equal(safeUrl('http://paypal.me/designstudio'), 'http://paypal.me/designstudio');
  assert.equal(safeUrl('javascript:alert(1)'), null);
  assert.equal(safeUrl('data:text/html,<script>alert(1)</script>'), null);
  assert.equal(safeUrl('vbscript:msgbox(1)'), null);
  assert.equal(safeUrl('https://user:pass@malicious.com'), null);
  assert.equal(safeUrl('not-a-valid-url'), null);
});
