import test from 'node:test';
import assert from 'node:assert/strict';
import { requestApproval, withdrawApproval, applyResponses, validApproval } from '../src/approvals.js';
import { publishablePortal, validateWorkspace } from '../src/workspace-upgrades.js';
import { fresh } from '../src/lib.js';

const ws = () => ({ ...fresh(), clients: [{ id: 'c', name: 'Hytz', links: [{ label: 'Site', url: 'https://hytz.co/' }] }, { id: 'x', name: 'Other' }],
  projects: [{ id: 'p', name: 'Hytz Website', client: 'c', status: 'Active' }, { id: 'q', name: 'Private', client: 'c', status: 'Active' }],
  tasks: [{ id: 't1', title: 'Homepage', status: 'Todo', project: 'p', notes: 'SECRET' }, { id: 't2', title: 'Logo', status: 'Todo', client: 'c' }, { id: 't3', title: 'No client', status: 'Todo' }],
  docs: [{ id: 'd1', kind: 'prd', title: 'Site PRD', status: 'In review', client: 'c', project: 'p', problem: 'Slow', goals: '', outOfScope: '', requirements: [{ id: 'r', title: 'Fast', done: false }] }, { id: 'd2', kind: 'link', title: 'Drive', url: 'https://drive.google.com/x', client: 'c' }, { id: 'd3', kind: 'link', title: 'Other', url: 'https://x.co/', client: 'x' }] });

test('sending for approval needs a client and records the request', () => {
  const w = ws();
  requestApproval(w, 't2', ' Please check ', new Date('2026-10-25T10:00:00Z'));
  assert.deepEqual(w.tasks[1].approval, { state: 'pending', note: 'Please check', requestedAt: '2026-10-25T10:00:00.000Z' });
  assert.throws(() => requestApproval(w, 't3'), /client/);
  assert.ok(validateWorkspace(w));
  withdrawApproval(w, 't2'); assert.equal(w.tasks[1].approval, undefined);
  assert.ok(!validApproval({ state: 'maybe', requestedAt: 'x' }));
});

test('client answers apply only after the latest request, for that client', () => {
  const w = ws();
  requestApproval(w, 't1', '', new Date('2026-10-25T10:00:00Z'));
  assert.deepEqual(applyResponses(w, 'c', [{ taskId: 't1', decision: 'approved', at: '2026-10-25T09:00:00.000Z' }]), []);
  assert.deepEqual(applyResponses(w, 'x', [{ taskId: 't1', decision: 'approved', at: '2026-10-25T11:00:00.000Z' }]), []);
  assert.deepEqual(applyResponses(w, 'c', [{ taskId: 't1', decision: 'changes', comment: 'Bigger logo', at: '2026-10-25T11:00:00.000Z' }]), ['t1']);
  assert.deepEqual([w.tasks[0].approval.state, w.tasks[0].approval.comment], ['changes', 'Bigger logo']);
  // the client changes their mind later: the newer answer wins, an older or equal one does not
  assert.deepEqual(applyResponses(w, 'c', [{ taskId: 't1', decision: 'approved', at: '2026-10-25T12:00:00.000Z' }]), ['t1']);
  assert.equal(w.tasks[0].approval.state, 'approved');
  assert.deepEqual(applyResponses(w, 'c', [{ taskId: 't1', decision: 'changes', at: '2026-10-25T11:30:00.000Z' }]), []);
});

test('the portal shares chosen docs, client links, project tasks and approvals only', () => {
  const w = ws(); requestApproval(w, 't2');
  const s = publishablePortal(w, 'c', ['p'], [], ['d1', 'd2', 'd3']);
  assert.deepEqual(s.tasks.map(t => t.id), ['t1', 't2']);
  assert.deepEqual(s.approvalIds, ['t2']);  // only t2 was sent for approval
  assert.deepEqual(s.docs.map(x => x.id), ['d1', 'd2']);
  assert.equal(s.docs[0].requirements[0].title, 'Fast');
  assert.deepEqual(s.links, [{ label: 'Site', url: 'https://hytz.co/' }]);
  assert.match(s.accent, /^#/);
  assert.ok(!JSON.stringify(s).includes('SECRET'));
  assert.deepEqual(publishablePortal(w, 'c', ['p'], []).docs, []);
});

test('a portal is republished only when what it shares has changed', async () => {
  const { portalUpdate } = await import('../src/workspace-upgrades.js');
  const w = ws(), share = { clientId: 'c', projectIds: ['p'], invoiceIds: [], docIds: ['d2'] };
  const first = portalUpdate(w, share);
  assert.ok(first);
  assert.equal(portalUpdate(w, { ...share, data: { ...first, updatedAt: 'later' } }), null);
  w.tasks[0].status = 'Done';
  assert.equal(portalUpdate(w, { ...share, data: first }).tasks[0].status, 'Done');
  w.tasks[0].notes = 'still private';
  const again = portalUpdate(w, { ...share, data: first });
  assert.equal(portalUpdate(w, { ...share, data: again }), null, 'private fields do not trigger a publish');
  assert.equal(portalUpdate(w, { ...share, clientId: 'gone' }), null);
});

test('PRDs, files and draft invoices can go out for approval', () => {
  const w = ws(); w.invoices = [{ id: 'inv', no: 'INV-0001', client: 'c', state: 'draft', issue: '2026-10-25', due: '2026-11-08', items: [{ desc: 'Design', qty: 1, price: 100 }], tax: 0, pays: [] }];
  requestApproval(w, 'd1', 'Please review', new Date('2026-10-25T10:00:00Z'));
  requestApproval(w, 'd2'); requestApproval(w, 'inv');
  assert.equal(w.docs[0].status, 'In review');
  const s = publishablePortal(w, 'c', ['p'], [], []);
  assert.deepEqual(s.approvals.map(x => x.kind).sort(), ['link', 'prd', 'quote']);
  assert.equal(s.approvals.find(x => x.kind === 'quote').quote.total, 100);
  assert.deepEqual(s.approvalIds.sort(), ['d1', 'd2', 'inv']);
  assert.deepEqual(applyResponses(w, 'c', [{ taskId: 'd1', decision: 'approved', at: '2026-10-25T11:00:00.000Z' }]), ['d1']);
  assert.equal(w.docs[0].status, 'Approved');
  w.invoices[0].state = 'sent'; delete w.invoices[0].approval;
  assert.throws(() => requestApproval(w, 'inv'), /draft/);
  assert.ok(validateWorkspace(w));
});

test('an older copy of the workspace never overwrites a newer portal', async () => {
  const { portalUpdate, publishablePortal } = await import('../src/workspace-upgrades.js');
  const w = ws(); w.tasks[0].updatedAt = '2026-10-25T10:00:00.000Z';
  const share = { clientId: 'c', projectIds: ['p'], invoiceIds: [], docIds: [] };
  const newer = structuredClone(w); newer.tasks.push({ id: 'n', title: 'New', status: 'Todo', project: 'p', updatedAt: '2026-10-25T11:00:00.000Z' });
  const published = publishablePortal(newer, 'c', ['p'], [], []);
  assert.equal(portalUpdate(w, { ...share, data: published }), null, 'stale tab stays quiet');
  assert.ok(portalUpdate(newer, { ...share, data: publishablePortal(w, 'c', ['p'], [], []) }), 'newer tab can publish');
});
