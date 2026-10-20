import test from 'node:test';
import assert from 'node:assert/strict';
import { csv, exporters, fresh, calc, status, reissuedInvoice } from '../src/lib.js';
import { invoiceTotals } from './api.js';

test('CSV protects spreadsheet formulas, quotes embedded text and preserves Unicode', () => {
  const output = csv([['=SUM(A1:A5)', '  +cmd', 'hello "world"', '₹ amount']]);
  assert.ok(output.startsWith('\uFEFF'));
  assert.ok(output.includes('"\'=SUM(A1:A5)"'));
  assert.ok(output.includes('"\'  +cmd"'));
  assert.ok(output.includes('"hello ""world"""')); assert.ok(output.includes('₹ amount'));
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

test('reissuing an old invoice never creates a due date before its new issue date', () => {
  const source = { state: 'void', due: '2026-09-01', items: [{ desc: 'Design', qty: 1, price: 100 }], pays: [{ amt: 25 }] };
  const result = reissuedInvoice(source, 'new', 'INV-2', '2026-10-19');
  assert.equal(result.due, '2026-11-02'); assert.equal(result.state, 'draft'); assert.deepEqual(result.pays, []);
  assert.equal(source.state, 'void'); assert.equal(source.pays.length, 1);
  assert.equal(reissuedInvoice({ ...source, due: '2026-12-01' }, 'new', 'INV-2', '2026-10-19').due, '2026-12-01');
});
