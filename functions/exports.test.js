import test from 'node:test';
import assert from 'node:assert/strict';
import { csv, exporters, fresh, calc, status, reissuedInvoice, allPays, generateInvoicePdf, rid } from '../src/lib.js';
import { invoiceTotals } from './api.js';

test('CSV protects spreadsheet formulas, quotes embedded text and preserves Unicode', () => {
  const output = csv([['=SUM(A1:A5)', '  +cmd', 'hello "world"', '\u20B9 amount']]);
  assert.ok(output.startsWith('\uFEFF'));
  assert.ok(output.includes('"\'=SUM(A1:A5)"'));
  assert.ok(output.includes('"\'  +cmd"'));
  assert.ok(output.includes('"hello ""world"""')); assert.ok(output.includes('\u20B9 amount'));
});
test('task and project CSV exports retain calendar fields', () => {
  const data = fresh(); data.clients = [{ id: 'c', name: 'Client' }];
  data.projects = [{ id: 'p', name: 'Project', client: 'c', status: 'Active', start: '2026-10-19', end: '2026-10-30' }];
  data.tasks = [{ id: 't', title: 'Task', client: 'c', project: 'p', scheduledAt: '2026-10-19T04:30:00Z', durationMinutes: 90 }];
  const output = exporters(data); assert.equal(output.projects[1][4], '2026-10-30'); assert.equal(output.tasks[1][5], 'Project'); assert.equal(output.tasks[1][7], 90);
});
test('browser and API invoice calculations agree', () => {
  for (const state of ['draft', 'sent', 'void']) for (const amt of [0, 25, 110]) {
    const invoice = { state, items: [{ qty: 2, price: 50 }], tax: 10, pays: [{ amt }], due: '2000-01-01' };
    const browser = calc(invoice), api = invoiceTotals(invoice, '2026-10-19');
    assert.equal(browser.total, api.total); assert.equal(browser.bal, api.balance); assert.equal(status(invoice), api.status);
  }
});

test('calc and invoiceTotals round taxes and fractional payments to cents without floating-point drift', () => {
  // 10.55 * 19% tax = 2.0045 => should round tax to 2.00, total to 12.55
  const invoice = { state: 'sent', items: [{ qty: 1, price: 10.55 }], tax: 19, pays: [{ amt: 12.55 }], due: '2026-12-01' };
  const c = calc(invoice);
  assert.equal(c.sub, 10.55);
  assert.equal(c.tax, 2);
  assert.equal(c.total, 12.55);
  assert.equal(c.bal, 0);
  assert.equal(status(invoice), 'Paid');

  const api = invoiceTotals(invoice, '2026-10-27');
  assert.equal(api.subtotal, 10.55);
  assert.equal(api.tax, 2);
  assert.equal(api.total, 12.55);
  assert.equal(api.balance, 0);
  assert.equal(api.status, 'Paid');
});

test('rid produces distinct non-empty 10-character identifiers', () => {
  const ids = new Set();
  for (let k = 0; k < 500; k++) {
    const id = rid();
    assert.equal(typeof id, 'string');
    assert.ok(id.length >= 8 && id.length <= 10);
    assert.ok(!ids.has(id), 'duplicate id generated');
    ids.add(id);
  }
});

test('reissuing an old invoice never creates a due date before its new issue date', () => {
  const source = { state: 'void', due: '2026-09-01', items: [{ desc: 'Design', qty: 1, price: 100 }], pays: [{ amt: 25 }] };
  const result = reissuedInvoice(source, 'new', 'INV-2', '2026-10-19');
  assert.equal(result.due, '2026-11-02'); assert.equal(result.state, 'draft'); assert.deepEqual(result.pays, [{ amt: 25 }], 'what was paid carries over to the new draft');
  assert.equal(source.state, 'void'); assert.equal(source.pays.length, 1);
  assert.equal(reissuedInvoice({ ...source, due: '2026-12-01' }, 'new', 'INV-2', '2026-10-19').due, '2026-12-01');
});

test('reissue drops the old approval and schedule link, and void invoices do not count as revenue', () => {
  const source = { id: 'old', state: 'void', due: '2026-12-01', items: [{ desc: 'Design', qty: 1, price: 1000 }], pays: [{ amt: 400, date: '2026-10-01' }], approval: { state: 'approved' }, scheduleId: 's1', scheduleDate: '2026-10-01' };
  const copy = reissuedInvoice(source, 'new', 'INV-2', '2026-10-19');
  assert.equal(copy.approval, undefined); assert.equal(copy.scheduleId, undefined); assert.equal(copy.scheduleDate, undefined);
  const d = { ...fresh(), invoices: [source, copy] };
  assert.equal(allPays(d).reduce((n, p) => n + p.amt, 0), 400, 'the 400 is counted once');
});

test('PDF export preserves accented characters, currency symbols and sanitizes PDF literals', () => {
  const d = {
    settings: { biz: 'Studio Caf\u00E9', email: 'hello@cafe.com', cur: 'EUR' },
    clients: [{ id: 'c1', name: 'Fran\u00E7ois M\u00FCller', email: 'francois@muller.fr', address: '12 Rue d\u2019Artois, Paris' }]
  };
  const invoice = {
    no: 'INV-001',
    issue: '2026-10-27',
    due: '2026-11-10',
    client: 'c1',
    state: 'sent',
    items: [{ desc: 'Caf\u00E9 & P\u00E2tisserie design (special/menu)', qty: 1, price: 150 }],
    tax: 20,
    pays: [],
    notes: 'Total: \u20AC180 or Rs. 16,000'
  };
  const pdf = generateInvoicePdf(d, invoice);
  assert.ok(pdf.startsWith('%PDF-1.4'));
  assert.ok(pdf.includes('%%EOF'));
  assert.ok(!pdf.includes('Fran?ois'), 'François should not be corrupted to Fran?ois');
  assert.ok(!pdf.includes('M?ller'), 'Müller should not be corrupted to M?ller');
  assert.ok(!pdf.includes('Caf?'), 'Café should not be corrupted to Caf?');
  assert.ok(!pdf.includes('P?tisserie'), 'Pâtisserie should not be corrupted to P?tisserie');
  assert.ok(!pdf.includes('?180'), '€180 should not be corrupted to ?180');
});
