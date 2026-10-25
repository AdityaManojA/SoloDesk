import test from 'node:test';
import assert from 'node:assert/strict';
import { newlyRequested, requestEmail, answerEmail } from './approval-mail.js';

const data = (state, at = '2026-10-25T10:00:00Z') => ({ tasks: [{ id: 't', title: 'Homepage', approval: { state, requestedAt: at, note: 'Go live?' } }, { id: 'x', title: 'Other' }], approvals: [{ id: 'q', kind: 'quote', title: 'INV-0008 <b>', approval: { state: 'pending', requestedAt: '2026-10-24T10:00:00Z' } }] });

test('only new or re-sent requests are emailed', () => {
  assert.deepEqual(newlyRequested(null, data('pending')).map(x => x.id), ['t', 'q']);
  assert.deepEqual(newlyRequested(data('pending'), data('pending')).map(x => x.id), []);
  assert.deepEqual(newlyRequested(data('changes'), data('pending', '2026-10-26T10:00:00Z')).map(x => x.id), ['t']);
  assert.deepEqual(newlyRequested(data('pending'), data('approved')).map(x => x.id), []);
});

test('emails link to the portal or Approvals and escape what clients typed', () => {
  const r = requestEmail({ to: 'a@b.co', business: 'Studio', clientName: 'Ava', items: newlyRequested(null, data('pending')), portalUrl: 'https://x.app/#/portal/u1' });
  assert.equal(r.to, 'a@b.co'); assert.match(r.message.subject, /2 items/); assert.match(r.message.html, /#\/portal\/u1/); assert.ok(r.message.html.includes('INV-0008 &lt;b&gt;'));
  const a = answerEmail({ to: 'me@x.co', clientName: 'Ava', item: { title: 'INV-0008', kind: 'quote' }, decision: 'approved', comment: '<script>', appUrl: 'https://x.app' });
  assert.match(a.message.subject, /accepted/); assert.ok(!a.message.html.includes('<script>')); assert.match(a.message.html, /#\/approvals/);
});
