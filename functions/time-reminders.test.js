import test from 'node:test';
import assert from 'node:assert/strict';
import { fresh, today, addDays } from '../src/lib.js';
import { parseDuration, formatMinutes, logTime, taskTime, removeTimeEntry } from '../src/time-log.js';
import { unbilled, invoiceUnbilledHours } from '../src/billing.js';
import { validateWorkspace } from '../src/workspace-upgrades.js';
import { canRemind, reminderDraft, recordReminder, daysLate, gmailUrl } from '../src/reminders.js';

test('durations are read the way people type them', () => {
  for (const [text, minutes] of [['1h 30m', 90], ['1.5h', 90], ['90', 90], ['90m', 90], ['1:30', 90], ['45 min', 45], ['2 hours', 120], ['2h', 120], ['', 0], ['soon', 0]]) assert.equal(parseDuration(text), minutes, text);
  assert.equal(formatMinutes(90), '1h 30m'); assert.equal(formatMinutes(60), '1h'); assert.equal(formatMinutes(5), '5m');
});

test('logged time is billable on the project, still loads, and locks once invoiced', () => {
  const w = { ...fresh(), clients: [{ id: 'c', name: 'Ava' }], projects: [{ id: 'p', name: 'Site', client: 'c', hourlyRate: 80 }], tasks: [{ id: 't', title: 'Homepage', project: 'p', status: 'Todo' }] };
  const id = logTime(w, 't', { minutes: 90, date: today(), note: 'Hero section' });
  assert.equal(taskTime(w, 't').minutes, 90);
  assert.equal(unbilled(w, 'p').billable, 1.5);
  assert.doesNotThrow(() => validateWorkspace(w));
  invoiceUnbilledHours(w, 'p', today(), 'inv1');
  assert.throws(() => removeTimeEntry(w, id), /on an invoice/);
  w.invoices = []; assert.equal(removeTimeEntry(w, id), true); assert.equal(taskTime(w, 't').minutes, 0);
  assert.throws(() => logTime(w, 't', { minutes: 0 }), /between 1 minute/);
  assert.throws(() => logTime(w, 't', { minutes: 30, date: addDays(today(), 1) }), /today or an earlier day/);
});

test('reminders: only unpaid sent invoices, a clear email, and a history that loads', () => {
  const sent = { id: 'i', no: 'INV-7', client: 'c', state: 'sent', issue: '2026-10-01', due: '2026-10-10', items: [{ desc: 'Design', qty: 2, price: 500 }], tax: 0, pays: [{ amt: 200, date: '2026-10-05' }] };
  const w = { ...fresh(), clients: [{ id: 'c', name: 'Ava Studio', email: 'ava@example.test' }], invoices: [sent], settings: { ...fresh().settings, biz: 'Aditya', pay: 'IBAN 123', cur: 'USD' } };
  assert.equal(canRemind(sent), true);
  assert.equal(canRemind({ ...sent, state: 'draft' }), false);
  assert.equal(canRemind({ ...sent, pays: [{ amt: 1000, date: '2026-10-05' }] }), false, 'paid');
  assert.equal(daysLate(sent, '2026-10-26'), 16);
  const draft = reminderDraft(w, sent, '2026-10-26');
  assert.equal(draft.to, 'ava@example.test');
  assert.match(draft.subject, /INV-7 is 16 days overdue/);
  assert.match(draft.body, /\$800\.00/); assert.match(draft.body, /IBAN 123/); assert.match(draft.body, /Aditya$/);
  assert.match(gmailUrl(draft), /^https:\/\/mail\.google\.com\/mail\/\?view=cm/);
  recordReminder(w, 'i', '2026-10-26T09:00:00.000Z');
  assert.deepEqual(w.invoices[0].reminders, ['2026-10-26T09:00:00.000Z']);
  assert.doesNotThrow(() => validateWorkspace(w));
});
