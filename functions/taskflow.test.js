import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTaskflow, questInstant, taskflowCalendarEvents, safeEventUrl } from '../src/taskflow-data.js';
import { calendarIcs } from './calendar.js';
import { onDay, matchesCalendarFilters } from '../src/calendar-view.js';

const sample = () => ({tz:'Asia/Kolkata',quests:[{id:'q1',title:'Submit lab report',tier:0,due:'2026-10-22',time:'17:00',repeat:'weekly',notes:'Bring notes',subtasks:[{title:'Method',done:true}]}],events:[{id:'e1',title:'Client call',allDay:false,start:'2026-10-20T09:00:00+05:30',end:'2026-10-20T09:30:00+05:30',where:'Studio',url:'https://calendar.google.com/calendar/event?eid=example'}]});
test('shared quests retain priorities, notes, repeats and subtasks without mutating the source',()=>{
  const data=sample(), before=structuredClone(data), feed=normalizeTaskflow(data);
  assert.equal(feed.quests[0].tier,0); assert.equal(feed.quests[0].repeat,'weekly'); assert.equal(feed.quests[0].subtasks[0].done,true);
  assert.equal(feed.quests[0].notes,'Bring notes'); assert.deepEqual(data,before);
});
test('quest due times use TaskFlow timezone rather than the browser timezone',()=>{
  assert.equal(questInstant('2026-10-22','17:00','Asia/Kolkata'),'2026-10-22T11:30:00.000Z');
  assert.equal(questInstant('2026-07-01','09:00','America/New_York'),'2026-07-01T13:00:00.000Z');
  assert.equal(questInstant('2026-01-01','09:00','America/New_York'),'2026-01-01T14:00:00.000Z');
  assert.equal(questInstant('2026-03-08','02:30','America/New_York'),null);
});
test('undated quests stay in the list; unresolved quest times use a free all-day reminder',()=>{
  const feed=normalizeTaskflow({quests:[{id:'a',title:'Undated',due:null},{id:'b',title:'Deadline',due:'2026-10-22',time:'17:00'}]});
  assert.equal(feed.quests.length,2); const events=taskflowCalendarEvents(feed);
  assert.equal(events.length,1); assert.equal(events[0].allDay,true); assert.equal(events[0].availability,'free');
  assert.equal(events[0].end,'2026-10-23'); assert.match(events[0].description,/could not be resolved/);
});
test('calendar IDs stay distinct from SoloDesk and quest due times never reserve a work block',()=>{
  const feed=normalizeTaskflow(sample()), events=taskflowCalendarEvents(feed);
  assert.deepEqual(events.map(e=>e.id),['taskflow-event-e1','taskflow-quest-q1']);
  assert.equal(events[1].availability,'free'); assert.equal(events[1].reminder,true);
  assert.equal(events[0].start,'2026-10-20T03:30:00.000Z'); assert.equal(events[0].durationMinutes,30);
});
test('all-day calendar ends remain exclusive and live snapshots can remove completed quests',()=>{
  const feed=normalizeTaskflow({events:[{id:'a',title:'Trip',allDay:true,start:'2026-10-20',end:'2026-10-22'}]});
  const [event]=taskflowCalendarEvents(feed); assert.ok(onDay(event,'2026-10-21')); assert.equal(onDay(event,'2026-10-22'),false);
  assert.deepEqual(taskflowCalendarEvents(normalizeTaskflow({quests:[],events:[]})),[]);
});
test('malformed rows and unsafe links are rejected without breaking a valid feed',()=>{
  const feed=normalizeTaskflow({tz:'not-a-zone',quests:[null,{id:'a',title:'Valid',tier:9,due:'2026-02-30'},{id:'a',title:'New title'}],events:[null,{id:'e',title:'Bad',start:'bad',end:'bad'}, {id:'f',title:'No offset',start:'2026-10-20T09:00:00',end:'2026-10-20T10:00:00'}]});
  assert.equal(feed.tz,null); assert.equal(feed.quests.length,1); assert.equal(feed.events.length,0);
  assert.equal(safeEventUrl('javascript:alert(1)'),null); assert.equal(safeEventUrl('https://user:pass@example.com'),null);
  assert.equal(safeEventUrl('https://calendar.google.com/'),'https://calendar.google.com/');
});
test('shared items export with stable IDs and valid UTC times',()=>{
  const events=taskflowCalendarEvents(normalizeTaskflow(sample())); const result=calendarIcs(events,{namespace:'account',now:new Date('2026-10-19T00:00:00Z')});
  assert.match(result,/UID:account-taskflow-quest-q1@solodesk/); assert.match(result,/DTSTART:20261022T113000Z/);
  assert.match(result,/TRANSP:TRANSPARENT/); assert.match(result,/SUMMARY:Client call/);
});

test('Google events retain TaskFlow priority, location and busy time alongside quests',()=>{
  const data=sample(); data.events[0].tier=2;
  const event=taskflowCalendarEvents(normalizeTaskflow(data)).find(e=>e.type==='taskflow-event');
  assert.equal(event.priority,'P3'); assert.equal(event.where,'Studio'); assert.equal(event.availability,'busy');
  assert.equal(event.durationMinutes,30); assert.equal(event.path,'/calendar');
  assert.match(event.description,/Google Calendar via TaskFlow/);
  assert.match(calendarIcs([event]),/LOCATION:Studio/);
  assert.ok(onDay(event,'2026-10-20'));
});

test('calendar filters include Google by default and can isolate its shared feed',()=>{
  const imported=taskflowCalendarEvents(normalizeTaskflow(sample()));
  const solo={id:'task-own',type:'task',client:{id:'client1'}};
  const events=[...imported,solo];
  assert.equal(events.filter(e=>matchesCalendarFilters(e)).length,3);
  assert.deepEqual(events.filter(e=>matchesCalendarFilters(e,'','taskflow-event')).map(e=>e.id),['taskflow-event-e1']);
  assert.equal(events.filter(e=>matchesCalendarFilters(e,'','taskflow')).length,2);
  assert.equal(events.filter(e=>matchesCalendarFilters(e,'','task')).length,2);
  assert.deepEqual(events.filter(e=>matchesCalendarFilters(e,'client1')).map(e=>e.id),['task-own']);
  assert.deepEqual(taskflowCalendarEvents(normalizeTaskflow({events:[]})),[]);
});
