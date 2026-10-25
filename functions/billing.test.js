import test from 'node:test';
import assert from 'node:assert/strict';
import { unbilled, invoiceUnbilledHours } from '../src/billing.js';
import { fresh } from '../src/lib.js';
import { validateWorkspace } from '../src/workspace-upgrades.js';

const ws = () => ({ ...fresh(), clients: [{ id: 'c', name: 'Hytz' }], projects: [{ id: 'p', name: 'Site', client: 'c', status: 'Active', hourlyRate: '80' }, { id: 'q', name: 'No rate', client: 'c', status: 'Active' }],
  focusSessions: [{ id: 's1', project: 'p', title: 'Homepage', seconds: 3600 * 1.1, at: '2026-10-20T10:00:00Z' }, { id: 's2', project: 'p', title: 'Homepage', seconds: 1800, at: '2026-10-21T10:00:00Z' }, { id: 's3', project: 'p', title: 'Logo', seconds: 900, at: '2026-10-21T12:00:00Z' }, { id: 's4', project: 'q', title: 'X', seconds: 3600, at: '2026-10-21T12:00:00Z' }] });

test('unbilled hours become a draft invoice, one line per task, at the hourly rate', () => {
  const w = ws();
  assert.equal(unbilled(w, 'p').billable, 1.75);
  const id = invoiceUnbilledHours(w, 'p', '2026-10-25');
  const inv = w.invoices.find(i => i.id === id);
  assert.deepEqual(inv.items, [{ desc: 'Homepage', qty: 1.5, price: 80 }, { desc: 'Logo', qty: 0.25, price: 80 }]);
  assert.deepEqual([inv.state, inv.client, inv.due], ['draft', 'c', '2026-11-08']);
  assert.equal(unbilled(w, 'p').billable, 0);
  assert.throws(() => invoiceUnbilledHours(w, 'p'), /no unbilled/);
  assert.ok(validateWorkspace(w));
  w.invoices = w.invoices.filter(i => i.id !== id);
  assert.equal(unbilled(w, 'p').billable, 1.75, 'deleting the draft frees the time');
  assert.throws(() => invoiceUnbilledHours(w, 'q'), /hourly rate/);
});
