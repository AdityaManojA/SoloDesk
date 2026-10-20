import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { moveCalendarItem } from '../src/calendar-move.js';

const workspace = () => ({
  tasks:[{id:'t1',title:'Deadline',due:'2026-10-20',status:'Todo'}, {id:'t2',title:'Call',scheduledAt:new Date('2026-10-20T10:30:42.123').toISOString(),due:'2026-10-23',durationMinutes:90}],
  projects:[{id:'p1',name:'Launch',start:'2026-10-19',end:'2026-10-24',client:'c1'},{id:'p2',name:'End only',end:'2026-10-31'}],
  clients:[{id:'c1',name:'Client'}],
});

test('moving a deadline updates only that task and keeps unrelated data intact',()=>{
  const d=workspace(), before=structuredClone(d);
  assert.equal(moveCalendarItem(d,'task-t1','2026-10-20','2026-11-02'),true);
  assert.equal(d.tasks[0].due,'2026-11-02');
  assert.deepEqual(d.tasks[1],before.tasks[1]);
  assert.deepEqual(d.projects,before.projects);
  assert.deepEqual(d.clients,before.clients);
});
test('timed moves preserve local time, seconds, duration and deadline offset',()=>{
  const d=workspace(), original=new Date(d.tasks[1].scheduledAt);
  moveCalendarItem(d,'task-t2','2026-10-20','2026-10-25');
  const moved=new Date(d.tasks[1].scheduledAt);
  assert.equal(moved.getDate(),25);
  assert.equal(moved.getHours(),original.getHours());
  assert.equal(moved.getMinutes(),30);
  assert.equal(moved.getSeconds(),42);
  assert.equal(moved.getMilliseconds(),123);
  assert.equal(d.tasks[1].durationMinutes,90);
  assert.equal(d.tasks[1].due,'2026-10-28');
});
test('moving the middle of a project shifts both ends by the grabbed-day offset',()=>{
  const d=workspace();
  moveCalendarItem(d,'project-p1','2026-10-22','2026-11-02');
  assert.deepEqual(d.projects[0],{id:'p1',name:'Launch',start:'2026-10-30',end:'2026-11-04',client:'c1'});
  moveCalendarItem(d,'project-p2','2026-10-31','2026-11-01');
  assert.equal(d.projects[1].end,'2026-11-01');
  assert.equal(d.projects[1].start,undefined);
});
test('moving across leap days and year boundaries uses calendar dates',()=>{
  const d=workspace();d.tasks[0].due='2028-02-28';
  moveCalendarItem(d,'task-t1','2028-02-28','2028-03-01');
  assert.equal(d.tasks[0].due,'2028-03-01');
  moveCalendarItem(d,'task-t1','2028-03-01','2027-12-31');
  assert.equal(d.tasks[0].due,'2027-12-31');
});
test('invalid dates, missing records and external events cannot mutate a workspace',()=>{
  for (const [id,from,to] of [['task-t1','2026-10-20','2026-02-30'],['task-missing','2026-10-20','2026-10-21'],['taskflow-quest-x','2026-10-20','2026-10-21'],['project-missing','2026-10-20','2026-10-21'],['task-t1','2026-10-20','0000-01-01']]) {
    const d=workspace(),before=structuredClone(d);
    assert.throws(()=>moveCalendarItem(d,id,from,to));assert.deepEqual(d,before);
  }
  const d=workspace(),before=structuredClone(d);
  assert.equal(moveCalendarItem(d,'task-t1','2026-10-20','2026-10-20'),false);
  assert.deepEqual(d,before);
});
test('invalid existing dates cannot cause a partially updated record',()=>{
  const d=workspace();d.tasks[1].due='bad';
  const before=structuredClone(d);
  assert.throws(()=>moveCalendarItem(d,'task-t2','2026-10-20','2026-10-21'));
  assert.deepEqual(d,before);
});
test('DST moves retain clock time and reject nonexistent spring-forward times',()=>{
  const script=`import assert from 'node:assert/strict';
    import {moveCalendarItem} from './src/calendar-move.js';
    const d={tasks:[{id:'t',scheduledAt:new Date('2026-03-07T09:30:00').toISOString(),durationMinutes:60}],projects:[]};
    moveCalendarItem(d,'task-t','2026-03-07','2026-03-08');
    assert.equal(new Date(d.tasks[0].scheduledAt).getHours(),9);
    assert.equal(d.tasks[0].scheduledAt,'2026-03-08T13:30:00.000Z');
    d.tasks[0].scheduledAt=new Date('2026-03-07T02:30:00').toISOString();
    const before=JSON.stringify(d);
    assert.throws(()=>moveCalendarItem(d,'task-t','2026-03-07','2026-03-08'),/daylight saving/);
    assert.equal(JSON.stringify(d),before);`;
  const result=spawnSync(process.execPath,['--input-type=module','-e',script],{cwd:process.cwd(),env:{...process.env,TZ:'America/New_York'},encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
});
