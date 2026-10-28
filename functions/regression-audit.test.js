import test from 'node:test';
import assert from 'node:assert/strict';
import { fresh, money, setCur, calc, today, rid } from '../src/lib.js';
import { validateWorkspace, publishablePortal } from '../src/workspace-upgrades.js';
import { quoteToInvoice } from '../src/billing.js';
import { createExpense, projectFinancials } from '../src/expenses.js';
import { PAYMENT_TERMS, dueDateForTerms, calcLateFee } from '../src/payment-terms.js';
import { taxPackSummary, taxPackCsv, quarterOfDate } from '../src/tax-pack.js';
import { signOffProposal, applyResponses, requestApproval } from '../src/approvals.js';
import { createIntakeBrief, submitBriefAnswers } from '../src/intake.js';
import { applyClientUpdate } from '../src/client-feed.js';
import { safeUrl } from '../src/profile.js';
import { finishFocus } from '../src/productivity.js';

// ============================================================================
// 1. Multi-Currency Support Tests
// ============================================================================
test('regression: multi-currency formatting, client fallback, and project currency', () => {
  setCur('USD');
  assert.equal(money(250), '$250.00');
  assert.equal(money(250, 'EUR'), '€250.00');
  assert.equal(money(250, 'GBP'), '£250.00');
  assert.equal(money(250, 'INR'), '₹250.00');
  assert.equal(money(250, 'CAD'), 'CA$250.00');
  assert.equal(money(250, 'AUD'), 'A$250.00');
  assert.equal(money(250, 'JPY'), 'JP¥250');

  const w = {
    ...fresh(),
    clients: [
      { id: 'c-eur', name: 'Euro Client', currency: 'EUR' },
      { id: 'c-def', name: 'Default Client' } // no currency
    ],
    projects: [
      { id: 'p-eur', name: 'Euro Project', client: 'c-eur', currency: 'EUR' },
      { id: 'p-gbp', name: 'GBP Override Project', client: 'c-eur', currency: 'GBP' }
    ],
    invoices: [
      {
        id: 'inv-eur', no: 'INV-E1', client: 'c-eur', project: 'p-eur', issue: '2026-10-01', due: '2026-10-15',
        state: 'sent', currency: 'EUR', items: [{ desc: 'Dev', qty: 2, price: 500 }], tax: 20, pays: []
      },
      {
        id: 'inv-gbp', no: 'INV-G1', client: 'c-eur', project: 'p-gbp', issue: '2026-10-01', due: '2026-10-15',
        state: 'sent', currency: 'GBP', items: [{ desc: 'Audit', qty: 1, price: 1200 }], tax: 0, pays: []
      }
    ]
  };

  assert.ok(validateWorkspace(w), 'Workspace with multi-currency records must validate successfully');
  
  const cEur = calc(w.invoices[0]);
  assert.equal(cEur.sub, 1000);
  assert.equal(cEur.tax, 200);
  assert.equal(cEur.total, 1200);
  assert.equal(money(cEur.total, w.invoices[0].currency), '€1,200.00');

  const cGbp = calc(w.invoices[1]);
  assert.equal(cGbp.total, 1200);
  assert.equal(money(cGbp.total, w.invoices[1].currency), '£1,200.00');
});

// ============================================================================
// 2. Quote-to-Invoice Conversion & Milestone Billing Tests
// ============================================================================
test('regression: quote-to-invoice handles 100% full conversion and 50% milestone deposits', () => {
  const w = {
    ...fresh(),
    clients: [{ id: 'c1', name: 'Client Apex' }],
    projects: [{ id: 'p1', name: 'Brand Identity', client: 'c1' }],
    invoices: [{
      id: 'quo-1', no: 'QUO-001', client: 'c1', project: 'p1', issue: '2026-10-10', due: '2026-10-24',
      state: 'draft', title: 'Complete Brand Pack', currency: 'USD',
      items: [
        { desc: 'Phase 1: Design', qty: 1, price: 3000 },
        { desc: 'Phase 2: Collateral', qty: 2, price: 1000 }
      ],
      tax: 10, pays: [], approval: { state: 'approved', requestedAt: '2026-10-11T00:00:00Z' }
    }]
  };

  // Test 1: Full 100% conversion
  const fullInvId = quoteToInvoice(w, 'quo-1');
  const fullInv = w.invoices.find(i => i.id === fullInvId);
  assert.ok(fullInv, 'Full invoice must be generated');
  assert.equal(fullInv.client, 'c1');
  assert.equal(fullInv.project, 'p1');
  assert.equal(fullInv.currency, 'USD');
  assert.equal(fullInv.items.length, 2);
  assert.equal(fullInv.items[0].price, 3000);
  assert.equal(fullInv.items[1].price, 1000);
  assert.equal(calc(fullInv).sub, 5000);
  assert.equal(calc(fullInv).total, 5500); // 5000 + 10% tax

  // Test 2: 50% deposit conversion
  const depositInvId = quoteToInvoice(w, 'quo-1', { depositPercent: 50 });
  const depInv = w.invoices.find(i => i.id === depositInvId);
  assert.ok(depInv, 'Deposit invoice must be generated');
  assert.equal(depInv.items.length, 1);
  assert.match(depInv.items[0].desc, /50% Upfront Deposit/);
  assert.equal(depInv.items[0].price, 2500); // 50% of 5000 subtotal
  assert.equal(calc(depInv).sub, 2500);
  assert.equal(calc(depInv).total, 2750); // 2500 + 10% tax
  assert.ok(validateWorkspace(w), 'Workspace must remain fully valid after conversions');
});

// ============================================================================
// 3. Payment Link URL Sanitization & Online Pay Buttons
// ============================================================================
test('regression: safeUrl strictly enforces safe web schemes and sanitizes malicious input', () => {
  // Safe web URLs
  assert.equal(safeUrl('https://buy.stripe.com/abc123xyz'), 'https://buy.stripe.com/abc123xyz');
  assert.equal(safeUrl('https://paypal.me/terracovestudio'), 'https://paypal.me/terracovestudio');
  assert.equal(safeUrl('https://rzp.io/l/demo_pay'), 'https://rzp.io/l/demo_pay');
  assert.equal(safeUrl('http://localhost:5173/pay'), 'http://localhost:5173/pay');
  
  // Trimming
  assert.equal(safeUrl('   https://buy.stripe.com/trimmed   '), 'https://buy.stripe.com/trimmed');

  // Attack vectors: JavaScript pseudo-protocol, Data URIs, VBScript
  assert.equal(safeUrl('javascript:alert(document.cookie)'), null);
  assert.equal(safeUrl('JaVaScRiPt:alert(1)'), null);
  assert.equal(safeUrl('javascript://%0aalert(1)'), null);
  assert.equal(safeUrl('data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=='), null);
  assert.equal(safeUrl('vbscript:msgbox("test")'), null);
  assert.equal(safeUrl('file:///etc/passwd'), null);

  // Authority abuse (embedded username/password)
  assert.equal(safeUrl('https://admin:supersecret@evil.com/phish'), null);

  // Non-strings & excessively long URLs
  assert.equal(safeUrl(null), null);
  assert.equal(safeUrl(undefined), null);
  assert.equal(safeUrl(''), null);
  assert.equal(safeUrl('https://' + 'a'.repeat(305) + '.com'), null);
});

// ============================================================================
// 4. Expense Tracking & Net Profitability Calculations
// ============================================================================
test('regression: expense creation and project financial net profit calculations', () => {
  const w = {
    ...fresh(),
    clients: [{ id: 'c1', name: 'Apex Ltd' }],
    projects: [{ id: 'p1', name: 'VR App', client: 'c1', rate: 100 }],
    tasks: [
      { id: 't1', title: 'VR Setup', project: 'p1', status: 'Done' }
    ],
    invoices: [
      {
        id: 'inv1', no: 'INV-1', client: 'c1', project: 'p1', issue: '2026-10-10', due: '2026-10-24',
        state: 'paid', items: [{ desc: 'VR Milestone', qty: 1, price: 4000 }], tax: 0,
        pays: [{ id: 'py1', amt: 4000, date: '2026-10-12' }]
      }
    ],
    expenses: []
  };

  const exp1 = createExpense(w, {
    client: 'c1',
    project: 'p1',
    category: 'Contractor',
    desc: '3D Render specialist fee',
    amount: 1200,
    date: '2026-10-15'
  });
  assert.ok(exp1.id);
  assert.equal(exp1.amount, 1200);
  assert.equal(exp1.category, 'Contractor');

  const exp2 = createExpense(w, {
    client: 'c1',
    project: 'p1',
    category: 'Software',
    desc: 'Asset 3D model pack',
    amount: 300,
    date: '2026-10-16'
  });

  // Case 1: Standard project with revenue & expenses
  const fin = projectFinancials(w, 'p1');
  assert.equal(fin.revenue, 4000, 'Total collected revenue should be $4000');
  assert.equal(fin.expenses, 1500, 'Total expenses should be $1200 + $300 = $1500');
  assert.equal(fin.netProfit, 2500, 'Net profit should be $4000 - $1500 = $2500');
  assert.equal(fin.margin, 63, 'Profit margin rounded should be 63%');

  // Case 2: Project with zero revenue and only expenses (loss)
  const pLossId = 'p-loss';
  w.projects.push({ id: pLossId, name: 'R&D', client: 'c1' });
  createExpense(w, { project: pLossId, client: 'c1', amount: 500 });
  const finLoss = projectFinancials(w, pLossId);
  assert.equal(finLoss.revenue, 0);
  assert.equal(finLoss.expenses, 500);
  assert.equal(finLoss.netProfit, -500);
  assert.equal(finLoss.margin, 0);
});

// ============================================================================
// 5. Client Portal Intake Questionnaires & Brief Updates
// ============================================================================
test('regression: intake questionnaire creation, client submissions and sync', () => {
  const w = {
    ...fresh(),
    clients: [{ id: 'c1', name: 'Nova Corp' }],
    projects: [{ id: 'p1', name: 'Rebranding', client: 'c1' }],
    docs: []
  };

  const brief = createIntakeBrief(w, {
    clientId: 'c1',
    projectId: 'p1',
    title: 'Brand Discovery Questionnaire',
    questions: [
      { id: 'q1', question: 'Target audience', required: true, answer: '' },
      { id: 'q2', question: 'Brand adjectives (e.g. Modern, Minimal)', required: false, answer: '' }
    ]
  });
  assert.equal(brief.kind, 'brief');
  assert.equal(brief.questions.length, 2);
  assert.equal(brief.questions[0].answer, '');

  // Submit client answers
  const clientAnswers = {
    q1: 'Tech founders and design leads',
    q2: 'Clean, architectural, trustworthy'
  };
  const updatedDoc = submitBriefAnswers(w, brief.id, clientAnswers);
  assert.equal(updatedDoc.questions[0].answer, 'Tech founders and design leads');
  assert.equal(updatedDoc.questions[1].answer, 'Clean, architectural, trustworthy');
  assert.ok(updatedDoc.submittedAt);
  assert.equal(updatedDoc.status, 'Approved');

  // Sync update via applyClientUpdate
  const updatePayload = {
    kind: 'brief',
    docId: brief.id,
    questions: updatedDoc.questions
  };
  const activityRow = applyClientUpdate(w, 'c1', updatePayload, '2026-10-28T12:00:00Z');
  assert.ok(activityRow, 'Activity record must be generated');
  assert.equal(activityRow.action, 'client-submitted-brief');
  assert.equal(w.docs[0].questions[0].answer, 'Tech founders and design leads');
  assert.equal(w.docs[0].submittedAt, '2026-10-28T12:00:00Z');
});

// ============================================================================
// 6. Header Global Stopwatch / Timer Tests
// ============================================================================
test('regression: global header timer operations, elapsed calculation, and session commit', () => {
  const w = {
    ...fresh(),
    tasks: [{ id: 't-timer', title: 'Security Hardening', project: 'p1' }],
    focusSessions: []
  };

  // 1. Start timer
  const startTime = 1000000;
  w.focusTimer = { taskId: 't-timer', title: 'Security Hardening', project: 'p1', startedAt: startTime, elapsedMs: 0 };
  assert.ok(w.focusTimer);
  assert.equal(w.focusTimer.taskId, 't-timer');

  // 2. Pause timer after 120,000 ms (2 minutes)
  const pauseTime = startTime + 120000;
  w.focusTimer.elapsedMs += (pauseTime - w.focusTimer.startedAt);
  w.focusTimer.startedAt = null;
  assert.equal(w.focusTimer.elapsedMs, 120000);

  // 3. Resume timer 30 seconds later
  const resumeTime = pauseTime + 30000;
  w.focusTimer.startedAt = resumeTime;

  // 4. Finish timer 180,000 ms (3 minutes) later (total elapsed = 2 min + 3 min = 5 min = 300 seconds)
  const finishTime = resumeTime + 180000;
  const committed = finishFocus(w, finishTime);
  assert.ok(committed, 'Timer session must be committed');
  assert.equal(w.focusTimer, null, 'Active timer state must be cleared after save');
  assert.equal(w.focusSessions.length, 1);
  assert.equal(w.focusSessions[0].seconds, 300, 'Elapsed seconds must equal 300');
  assert.equal(w.focusSessions[0].taskId, 't-timer');
  assert.equal(w.focusSessions[0].title, 'Security Hardening');
});

// ============================================================================
// 7. Digital SOW / Proposal Sign-Off & Audit Trail
// ============================================================================
test('regression: proposal sign-off records audit details and applyResponses syncs signature', () => {
  const w = {
    ...fresh(),
    clients: [{ id: 'c-sign', name: 'Enterprise Client' }],
    projects: [{ id: 'p-sign', name: 'Migration', client: 'c-sign' }],
    tasks: [{
      id: 'task-sow', title: 'SOW v1.0 Agreement', project: 'p-sign',
      approval: { state: 'pending', note: 'Please review and sign', requestedAt: '2026-10-27T10:00:00Z' }
    }]
  };

  // Sign off proposal
  const signedItem = signOffProposal(w, 'task-sow', {
    signerName: 'Jane Doe, CEO',
    signerEmail: 'jane@enterprise.com',
    userAgent: 'Mozilla/5.0 Mac OS X Terracove/1.2'
  }, '2026-10-28T14:30:00Z');

  assert.equal(signedItem.approval.state, 'approved');
  assert.ok(signedItem.approval.signOff);
  assert.equal(signedItem.approval.signOff.name, 'Jane Doe, CEO');
  assert.equal(signedItem.approval.signOff.email, 'jane@enterprise.com');
  assert.equal(signedItem.approval.signOff.signedAt, '2026-10-28T14:30:00.000Z');
  assert.equal(signedItem.approval.signOff.userAgent, 'Mozilla/5.0 Mac OS X Terracove/1.2');

  // Verify applyResponses with audit details
  const incomingResponse = [{
    taskId: 'task-sow',
    decision: 'approved',
    comment: 'Accepted on behalf of Enterprise Client',
    signerName: 'Jane Doe, CEO',
    email: 'jane@enterprise.com',
    userAgent: 'Mozilla/5.0 Mac OS X Terracove/1.2',
    at: '2026-10-28T14:30:00Z'
  }];

  const changed = applyResponses(w, 'c-sign', incomingResponse);
  assert.deepEqual(changed, ['task-sow']);
  const t = w.tasks[0];
  assert.equal(t.approval.state, 'approved');
  assert.equal(t.approval.signOff.name, 'Jane Doe, CEO');
  assert.equal(t.approval.signOff.userAgent, 'Mozilla/5.0 Mac OS X Terracove/1.2');
});

// ============================================================================
// 8. Preset Payment Terms & Automated Late Fees
// ============================================================================
test('regression: payment terms calculation and optional automated 1.5% late fee', () => {
  const issueDate = '2026-10-01';
  assert.equal(dueDateForTerms(issueDate, 'receipt'), '2026-10-01');
  assert.equal(dueDateForTerms(issueDate, 'net7'), '2026-10-08');
  assert.equal(dueDateForTerms(issueDate, 'net14'), '2026-10-15');
  assert.equal(dueDateForTerms(issueDate, 'net30'), '2026-10-31');

  // Late fee tests
  const invoiceOnTime = {
    issue: '2026-10-01',
    due: '2026-10-15',
    items: [{ desc: 'Retainer', qty: 1, price: 1000 }],
    tax: 0,
    pays: []
  };
  // Checking on day before due date: no late fee
  assert.equal(calcLateFee(invoiceOnTime, '2026-10-14'), 0);

  // Overdue by 30 days (1 month late fee = 1.5% of $1000 = $15)
  const fee30 = calcLateFee(invoiceOnTime, '2026-11-14');
  assert.equal(fee30, 15, '1.5% late fee on $1000 should be $15');

  // Overdue by 60 days (2 months late fee = 3.0% of $1000 = $30)
  const fee60 = calcLateFee(invoiceOnTime, '2026-12-14');
  assert.equal(fee60, 30, '3.0% late fee on $1000 should be $30');

  // When paid in full: must always return 0
  const invoicePaid = {
    ...invoiceOnTime,
    state: 'paid',
    pays: [{ id: 'p1', amt: 1000, date: '2026-10-10' }]
  };
  assert.equal(calcLateFee(invoicePaid, '2026-12-14'), 0);
});

// ============================================================================
// 9. Accountant-Ready Tax Pack Export Tests
// ============================================================================
test('regression: accountant tax pack summary aggregation and RFC 4180 CSV export', () => {
  assert.equal(quarterOfDate('2026-02-15'), '2026-Q1');
  assert.equal(quarterOfDate('2026-05-10'), '2026-Q2');
  assert.equal(quarterOfDate('2026-08-20'), '2026-Q3');
  assert.equal(quarterOfDate('2026-11-05'), '2026-Q4');

  const w = {
    ...fresh(),
    clients: [{ id: 'c1', name: 'Global Tech, Inc.' }],
    invoices: [
      {
        id: 'inv-q1', no: 'INV-Q1-1', client: 'c1', issue: '2026-02-10', due: '2026-02-24',
        state: 'paid', items: [{ desc: 'Architecture', qty: 1, price: 5000 }], tax: 10,
        pays: [{ id: 'p1', amt: 5500, date: '2026-02-15' }] // Fully paid: 5000 sub + 500 tax
      },
      {
        id: 'inv-q1-unpaid', no: 'INV-Q1-2', client: 'c1', issue: '2026-03-01', due: '2026-03-15',
        state: 'sent', items: [{ desc: 'Consulting', qty: 1, price: 2000 }], tax: 10,
        pays: [] // Unpaid: 2000 sub + 200 tax
      }
    ]
  };

  const rows = taxPackSummary(w, '2026-Q1');
  assert.equal(rows.length, 1);
  const summary = rows[0];
  assert.equal(summary.quarter, '2026-Q1');
  assert.equal(summary.grossBilled, 7700); // 5500 + 2200
  assert.equal(summary.taxableSubtotal, 7000); // 5000 + 2000
  assert.equal(summary.taxBilled, 700); // 500 + 200
  assert.equal(summary.taxCollected, 500); // Only on paid invoice
  assert.equal(summary.uncollectedRevenue, 2200); // Remaining unpaid gross balance

  // Verify CSV generation
  const csv = taxPackCsv(w, '2026-Q1');
  assert.match(csv, /"Quarter","Invoices","Taxable Base"/);
  assert.match(csv, /"2026-Q1","2","7000\.00","700\.00","500\.00","2200\.00","7700\.00"/);
});
