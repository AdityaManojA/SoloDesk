import test from 'node:test';
import assert from 'node:assert/strict';
import { calendarEvents, calendarIcs } from './calendar.js';

const workspace = {
  clients: [{ id: 'c', name: 'Client', email: 'private@example.com', notes: 'Private' }],
  projects: [{ id: 'p', name: 'Project', client: 'c', status: 'Active', start: '2026-10-10', end: '2026-10-20' }, { id: 'complete', name: 'Done project', status: 'Complete', end: '2026-10-15' }],
  tasks: [
    { id: 'timed', title: 'Work block', status: 'In progress', scheduledAt: '2026-10-19T09:30:00Z', durationMinutes: 90, project: 'p' },
    { id: 'due', title: 'Deadline', status: 'Todo', due: '2026-10-22', client: 'c' },
    { id: 'undated', title: 'Backlog', status: 'Todo' },
    { id: 'done', title: 'Done task', status: 'Done', due: '2026-10-01' },
  ],
};
test('calendar exports timed blocks, inclusive project ranges and all-day deadlines', () => {
  const events = calendarEvents(workspace); assert.equal(events.length, 3);
  const project = events.find(e => e.type === 'project'); assert.equal(project.end, '2026-10-21'); assert.equal(project.availability, 'free');
  const timed = events.find(e => e.id === 'task-timed'); assert.equal(timed.end, '2026-10-19T11:00:00.000Z'); assert.equal(timed.allDay, false); assert.equal(timed.availability, 'busy'); assert.equal(timed.client.name, 'Client');
  const due = events.find(e => e.id === 'task-due'); assert.equal(due.end, '2026-10-23'); assert.equal(due.allDay, true);
  assert.ok(!JSON.stringify(events).includes('private@example.com')); assert.ok(!JSON.stringify(events).includes('Private'));
});
test('completed and undated work has explicit inclusion behavior', () => {
  assert.equal(calendarEvents(workspace, { includeCompleted: true }).length, 5);
  assert.ok(!calendarEvents(workspace, { includeCompleted: true }).some(e => e.id === 'task-undated'));
});
test('event IDs remain stable across refreshes and edits', () => {
  const changed = structuredClone(workspace); changed.tasks[0].title = 'Revised title';
  assert.deepEqual(calendarEvents(workspace).map(e => e.id), calendarEvents(changed).map(e => e.id));
});
test('ICS has UTC blocks, exclusive date ends, escaped text and folded UTF-8 lines', () => {
  const events = calendarEvents(workspace); events[0].title = 'Title, with; punctuation\n' + 'é'.repeat(90);
  const ics = calendarIcs(events, { namespace: 'owner', now: new Date('2026-10-19T12:00:00Z') });
  assert.match(ics, /DTSTART:20261019T093000Z/); assert.match(ics, /DTEND:20261019T110000Z/);
  assert.match(ics, /SUMMARY:Title\\, with\\; punctuation\\n/);
  assert.equal((ics.match(/TRANSP:TRANSPARENT/g) || []).length, 2); assert.equal((ics.match(/TRANSP:OPAQUE/g) || []).length, 1);
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
  for (const line of ics.split('\r\n')) assert.ok(Buffer.byteLength(line, 'utf8') <= 75);
});
