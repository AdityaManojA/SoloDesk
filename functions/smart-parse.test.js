// Smart entry. Fixed "now": Wednesday 21 Oct 2026, 10:00 (the same as TaskFlow's parser tests).
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseWhen, parseTask, parseProject, suggest, applySuggestion } from '../src/smart-parse.js';

const NOW = new Date(2026, 9, 21, 10, 0);
const W = {
  clients: [{ id: 'c1', name: 'The Whisky Business' }, { id: 'c2', name: 'Ava Studio' }, { id: 'c3', name: 'Old Co', arch: true }],
  projects: [{ id: 'p1', name: 'TWB-Website', client: 'c1', status: 'Active' }, { id: 'p2', name: 'TWB-Admin Panel', client: 'c1', status: 'Active' }, { id: 'p3', name: 'Website launch', client: 'c2', status: 'Active' }, { id: 'p4', name: 'Old site', client: 'c2', status: 'Complete' }],
};

test('TaskFlow phrases still read the same', () => {
  assert.deepEqual([parseWhen('call mum today at 7 PM', NOW).due, parseWhen('call mum today at 7 PM', NOW).time], ['2026-10-21', '19:00']);
  assert.equal(parseWhen('team check-in quarter past three', NOW).time, '15:15');
  assert.deepEqual(['clean room at nine thirty am'].map(t => [parseWhen(t, NOW).time, parseWhen(t, NOW).due])[0], ['09:30', '2026-10-22']);
  assert.equal(parseWhen('dentist on friday at four pm', NOW).due, '2026-10-23');
  assert.equal(parseWhen('pay rent by end of month', NOW).due, '2026-10-31');
  assert.equal(parseWhen('read chapter in a fortnight', NOW).due, '2026-11-04');
  assert.equal(parseWhen('plan trip next weekend', NOW).due, '2026-10-24');
  assert.equal(parseWhen('ship parcel 2026-10-30', NOW).due, '2026-10-30');
  assert.equal(parseWhen('renew passport on friday', NOW).repeat, null);
  assert.equal(parseWhen('meet at 5', NOW).time, '17:00');
  assert.equal(parseWhen('Call Ava tomorrow at 7pm', NOW).title, 'Call Ava');
});

test('a task line fills date, time, client, project, priority and repeat', () => {
  const t = parseTask('figure out google icon issue for TWB-website tomorrow at 7pm urgent', W, NOW);
  assert.equal(t.title, 'figure out google icon issue');
  assert.deepEqual([t.project, t.client, t.due, t.time, t.priority], ['p1', 'c1', '2026-10-22', '19:00', 'High']);
  const c = parseTask('Send moodboard to Ava Studio every week', W, NOW);
  assert.deepEqual([c.client, c.project, c.repeat, c.title], ['c2', '', 'weekly', 'Send moodboard']);
  assert.equal(parseTask('fix #twb-admin panel login', W, NOW).project, 'p2');
});

test('plain text stays plain; completed projects and archived clients are not matched', () => {
  const t = parseTask('Write the brief', W, NOW);
  assert.deepEqual([t.title, t.due, t.time, t.priority, t.client, t.project], ['Write the brief', '', '', '', '', '']);
  assert.equal(parseTask('check Old site analytics', W, NOW).project, '');
  assert.equal(parseTask('email Old Co', W, NOW).client, '');
  assert.equal(parseTask('send invoice', W, NOW).priority, '');
});

test('a project line fills client, start and end', () => {
  const p = parseProject('Brand refresh for Ava Studio from Nov 3 to Dec 20', W, NOW);
  assert.deepEqual([p.name, p.client, p.start, p.end], ['Brand refresh', 'c2', '2026-11-03', '2026-12-20']);
  const q = parseProject('Retainer starting next monday', W, NOW);
  assert.deepEqual([q.name, q.start, q.end], ['Retainer', '2026-10-26', '']);
  assert.deepEqual(parseProject('Launch until end of month', W, NOW).end, '2026-10-31');
  assert.equal(parseProject('From scratch', W, NOW).name, 'From scratch');
});

test('suggestions complete names and date words as you type', () => {
  const s = suggest('fix login for TWB-A', undefined, W);
  assert.equal(s[0].label, 'TWB-Admin Panel');
  assert.equal(applySuggestion('fix login for TWB-A', s[0]).text, 'fix login for TWB-Admin Panel ');
  assert.ok(suggest('call tom', undefined, W).some(x => x.label === 'tomorrow'));
  assert.ok(suggest('call next fr', undefined, W).some(x => x.label === 'next Friday'));
  assert.ok(suggest('email @av', undefined, W).some(x => x.label === 'Ava Studio'));
  assert.ok(!suggest('see old', undefined, W).some(x => x.label === 'Old site'));
  assert.deepEqual(suggest('call tomorrow ', undefined, W), []);
});
