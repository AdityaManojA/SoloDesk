import test from 'node:test';
import assert from 'node:assert/strict';
import { monthDays, onDay, shiftMonth } from '../src/calendar-view.js';
import { eventsInLocalRange } from '../src/calendar-view.js';
import { spawnSync } from 'node:child_process';

test('export ranges include overlapping spans and respect exclusive ends',()=>{
  const events=[{id:'span',allDay:true,start:'2026-10-19',end:'2026-10-22'},{id:'ended',allDay:true,start:'2026-10-18',end:'2026-10-20'},{id:'future',allDay:true,start:'2026-10-21',end:'2026-10-22'}];
  assert.deepEqual(eventsInLocalRange(events,'2026-10-20','2026-10-20').map(e=>e.id),['span']);
  assert.equal(eventsInLocalRange(events).length,3);
  assert.deepEqual(eventsInLocalRange(events,'2026-10-22','2026-10-20'),[]);
});
test('local export dates retain near-midnight tasks on the day visible in the calendar',()=>{
  const script=`import assert from 'node:assert/strict';import {eventsInLocalRange} from './src/calendar-view.js';
    const events=[
      {id:'early',start:'2026-10-19T19:00:00Z',end:'2026-10-19T20:00:00Z'},
      {id:'late',start:'2026-10-20T18:00:00Z',end:'2026-10-20T19:00:00Z'},
      {id:'tomorrow',start:'2026-10-20T19:00:00Z',end:'2026-10-20T20:00:00Z'},
      {id:'ended',start:'2026-10-19T17:00:00Z',end:'2026-10-19T18:30:00Z'}];
    assert.deepEqual(eventsInLocalRange(events,'2026-10-20','2026-10-20').map(e=>e.id),['early','late']);`;
  const result=spawnSync(process.execPath,['--input-type=module','-e',script],{cwd:process.cwd(),env:{...process.env,TZ:'Asia/Kolkata'},encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
});

test('month grid has 42 unique days, starts on Monday and covers the whole month', () => {
  const days = monthDays('2026-10');
  assert.equal(days.length, 42); assert.equal(new Set(days).size, 42);
  assert.equal(days[0], '2026-09-28'); assert.equal(days.at(-1), '2026-11-08');
  assert.equal(days.filter(d => d.startsWith('2026-10')).length, 31);
});
test('month navigation crosses years and includes leap days', () => {
  assert.equal(shiftMonth('2026-12', 1), '2027-01'); assert.equal(shiftMonth('2026-01', -1), '2025-12');
  assert.ok(monthDays('2028-02').includes('2028-02-29'));
});
test('all-day project spans use exclusive ends without timezone shifts', () => {
  const event = { allDay: true, start: '2026-10-19', end: '2026-10-22' };
  assert.equal(onDay(event, '2026-10-18'), false); assert.equal(onDay(event, '2026-10-19'), true);
  assert.equal(onDay(event, '2026-10-21'), true); assert.equal(onDay(event, '2026-10-22'), false);
});
test('timed blocks appear on every local day overlapped, without a phantom event at midnight', () => {
  const start = new Date('2026-10-19T23:00:00').toISOString(), end = new Date('2026-10-20T01:00:00').toISOString();
  assert.equal(onDay({ allDay: false, start, end }, '2026-10-19'), true);
  assert.equal(onDay({ allDay: false, start, end }, '2026-10-20'), true);
  assert.equal(onDay({ allDay: false, start, end: new Date('2026-10-20T00:00:00').toISOString() }, '2026-10-20'), false);
});
import {sortCalendarItems,groupCalendarAgenda} from '../src/calendar-view.js';
test('calendar presentation puts timed work before deadlines and spans without mutating input',()=>{
  const items=[{id:'p',type:'project',allDay:true,start:'2026-10-01',title:'Project'},{id:'b',type:'task',allDay:false,start:'2026-10-20T15:00:00Z',title:'Later'},{id:'d',type:'task',allDay:true,start:'2026-10-20',title:'Due'},{id:'a',type:'taskflow-event',allDay:false,start:'2026-10-20T08:00:00Z',title:'Earlier'}];
  assert.deepEqual(sortCalendarItems(items).map(e=>e.id),['a','b','d','p']);
  assert.deepEqual(items.map(e=>e.id),['p','b','d','a']);
});
test('agenda groups dates once and anchors continuing spans to the visible month',()=>{
  const items=[{id:'old',type:'project',allDay:true,start:'2026-09-27',title:'Continuing'},{id:'new',type:'task',allDay:true,start:'2026-10-20',title:'Deadline'},{id:'same',type:'task',allDay:true,start:'2026-10-20',title:'Another'}];
  const groups=groupCalendarAgenda(items,'2026-10');
  assert.deepEqual(groups.map(g=>g.date),['2026-10-01','2026-10-20']);
  assert.deepEqual(groups.map(g=>g.events.length),[1,2]);
  assert.equal(groups.flatMap(g=>g.events).length,items.length);
});
