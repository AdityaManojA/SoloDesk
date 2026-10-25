import test from 'node:test';
import assert from 'node:assert/strict';
import { buildNotifications, unreadCount, unseenAnswers } from '../src/notifications.js';
import { applyClientUpdate, meetingMailto } from '../src/client-feed.js';
import { fresh, today } from '../src/lib.js';

const ws = () => ({ ...fresh(), clients: [{ id: 'c', name: 'Hytz', links: [{ label: 'Site', url: 'https://hytz.co/' }] }],
  projects: [{ id: 'p', name: 'Website', client: 'c', status: 'Active' }],
  tasks: [{ id: 't', title: 'Request all data', status: 'Todo', project: 'p', approval: { state: 'approved', requestedAt: '2026-10-25T09:00:00.000Z', decidedAt: '2026-10-25T10:00:00.000Z', comment: 'Looks great' } }, { id: 'u', title: 'Due now', status: 'Todo', due: today() }],
  docs: [{ id: 'f', kind: 'link', title: 'Brief', url: 'https://drive.google.com/a', client: 'c' }], activity: [] });

test('approvals answered, client comments, due work and link updates become notifications', () => {
  const w = ws();
  const list = buildNotifications(w, [{ id: 'x', from: 'client', clientId: 'c', itemId: 't', kind: 'cheer', text: 'You got this', at: '2026-10-25T11:00:00.000Z' }, { id: 'y', from: 'owner', itemId: 't', kind: 'comment', text: 'Thanks', at: '2026-10-25T12:00:00.000Z' }]);
  const titles = list.map(n => n.title);
  assert.ok(titles.includes('Hytz approved “Request all data”'));
  assert.ok(titles.includes('Hytz cheered you on for “Request all data”'));
  assert.ok(titles.includes('“Due now” is due today'));
  assert.ok(!titles.some(t => t.includes('Thanks')), 'your own replies are not notifications');
  assert.equal(unreadCount(list, '2026-10-25T10:30:00.000Z'), list.filter(n => n.at > '2026-10-25T10:30:00.000Z').length);
  assert.equal(unseenAnswers(w, null), 1);
  assert.equal(unseenAnswers(w, '2026-10-25T10:00:00.000Z'), 0);
});

test('clients can add or update their links and shared files, nothing else', () => {
  const w = ws();
  const row = applyClientUpdate(w, 'c', { kind: 'link', label: 'Instagram', url: 'instagram.com/hytz' });
  assert.equal(row.action, 'client-added-link');
  assert.equal(w.clients[0].links[1].url, 'https://instagram.com/hytz');
  assert.equal(applyClientUpdate(w, 'c', { kind: 'link', label: 'Site', url: 'https://hytz.com/', replaceUrl: 'https://hytz.co/' }).action, 'client-updated-link');
  assert.equal(w.clients[0].links[0].url, 'https://hytz.com/');
  assert.equal(applyClientUpdate(w, 'c', { kind: 'file', docId: 'f', url: 'https://drive.google.com/b' }).action, 'client-updated-file');
  assert.equal(w.docs[0].url, 'https://drive.google.com/b');
  assert.equal(applyClientUpdate(w, 'c', { kind: 'link', url: 'javascript:alert(1)' }), null);
  assert.equal(applyClientUpdate(w, 'other', { kind: 'link', url: 'x.co' }), null);
  w.activity.push(row);
  assert.ok(buildNotifications(w).some(n => n.title === 'Hytz added a link'));
});

test('request a meeting drafts an email to you', () => {
  const m = meetingMailto('me@studio.co', { business: 'Studio', clientName: 'Hytz', project: 'Website' });
  assert.match(m, /^mailto:me%40studio\.co\?subject=Meeting%20request%20%C2%B7%20Website/);
  assert.match(decodeURIComponent(m), /Can we have a meeting \/ quick call\?/);
});
