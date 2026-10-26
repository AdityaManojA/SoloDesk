import test from 'node:test';
import assert from 'node:assert/strict';
import {fresh} from '../src/lib.js';
import {nextRepeat,repeatCompletedTasks,trashRecord,restoreTrash,recordActivity,conflicts,freeSlots,scheduleTask,searchWorkspace,parseTemplateLines,applyProjectTemplate,generateInvoiceDrafts,clientTimeline,finishFocus,focusProjectTotals,trashReusable} from '../src/productivity.js';
import {moveCalendarItem} from '../src/calendar-move.js';

const fixture=()=>({...fresh(),clients:[{id:'c',name:'Studio'},{id:'other',name:'Elsewhere'}],projects:[{id:'p',name:'Launch',client:'c'}],tasks:[{id:'t',title:'Review',project:'p',client:'c',status:'Todo',due:'2026-01-31',repeat:'monthly'}],invoices:[{id:'i',no:'INV-0008',client:'c',issue:'2026-01-01',due:'2026-01-15',state:'sent',tax:0,items:[{desc:'Design',qty:1,price:100}],pays:[{id:'pay',amt:20,date:'2026-01-02'}]}]});
const event=(id,start,end,availability='busy')=>({id,title:id,start,end,availability,allDay:false});

test('restoring a task refuses missing parents until their bundle is restored',()=>{
  const w=fixture();trashRecord(w,'tasks','t');const taskEntry=w.trash[0].id;trashRecord(w,'clients','c');const clientEntry=w.trash[0].id;
  const before=structuredClone(w);assert.throws(()=>restoreTrash(w,taskEntry),/linked client or project/);assert.deepEqual(w,before);
  restoreTrash(w,clientEntry);restoreTrash(w,taskEntry);assert.equal(w.tasks[0].client,'c');assert.equal(w.tasks[0].project,'p');
});

test('focus totals handle names matching Object prototype properties',()=>{
  const w=fixture();w.projects[0].name='__proto__';w.projects.push({id:'special',name:'constructor'});
  w.focusSessions=[{project:'p',seconds:60},{project:'p',seconds:30},{project:'special',seconds:45}];
  assert.deepEqual(focusProjectTotals(w),[['__proto__',90],['constructor',45]]);
});
test('monthly recurrence preserves day 31 through short months and weekdays skip weekends',()=>{
  assert.equal(nextRepeat('2026-01-31','monthly',31),'2026-02-28');
  assert.equal(nextRepeat('2026-02-28','monthly',31),'2026-03-31');
  assert.equal(nextRepeat('2026-10-23','weekdays'),'2026-10-26');
  assert.equal(nextRepeat('2026-12-31','daily'),'2027-01-01');
  assert.throws(()=>nextRepeat('2026-02-30','weekly'));
});
test('task completion creates exactly one next occurrence, even after toggling and deletion',()=>{
  const before=fixture(),after=structuredClone(before);after.tasks[0].status='Done';repeatCompletedTasks(before,after);
  assert.equal(after.tasks.length,2);assert.equal(after.tasks[1].due,'2026-02-28');assert.equal(after.tasks[1].status,'Todo');
  repeatCompletedTasks(before,after);assert.equal(after.tasks.length,2);
  const nextBefore=structuredClone(after);after.tasks[1].status='Done';repeatCompletedTasks(nextBefore,after);assert.equal(after.tasks[2].due,'2026-03-31');
  const original=after.tasks[0];after.tasks=after.tasks.filter(t=>t.repeatFrom!=='t');repeatCompletedTasks(before,after);assert.equal(after.tasks.filter(t=>t.repeatFrom==='t').length,0);assert.ok(original.repeatNextId);
});
test('deleting and restoring a client recovers linked projects, tasks, invoices and payments',()=>{
  const w=fixture();assert.ok(trashRecord(w,'clients','c'));assert.equal(w.clients.length,1);assert.equal(w.tasks.length,0);assert.equal(w.invoices.length,0);
  restoreTrash(w,w.trash[0].id);assert.equal(w.tasks[0].client,'c');assert.equal(w.invoices[0].pays[0].amt,20);assert.equal(w.trash.length,0);
});
test('restoration preserves unrelated task edits and rejects conflicting relationship changes atomically',()=>{
  const w=fixture();trashRecord(w,'projects','p');w.tasks[0].title='Renamed later';restoreTrash(w,w.trash[0].id);assert.equal(w.tasks[0].project,'p');assert.equal(w.tasks[0].title,'Renamed later');
  trashRecord(w,'projects','p');w.tasks[0].project='another';const snapshot=structuredClone(w);assert.throws(()=>restoreTrash(w,w.trash[0].id),/changed/);assert.deepEqual(w,snapshot);
});
test('payment recovery does not overwrite payments added after deletion',()=>{
  const w=fixture();trashRecord(w,'payments','pay','i');w.invoices[0].pays.push({id:'later',amt:5});assert.throws(()=>restoreTrash(w,w.trash[0].id));assert.equal(w.invoices[0].pays[0].id,'later');
});
test('restoration detects duplicate IDs without partial restoration',()=>{
  const w=fixture();trashRecord(w,'clients','c');w.projects.push({id:'p',name:'Different'});const snapshot=structuredClone(w);assert.throws(()=>restoreTrash(w,w.trash[0].id));assert.deepEqual(w,snapshot);
});
test('busy overlaps are detected; touching endpoints and free deadlines do not conflict',()=>{
  const events=[event('a','2026-10-20T09:00:00','2026-10-20T10:00:00'),event('b','2026-10-20T09:30:00','2026-10-20T10:30:00'),event('c','2026-10-20T10:30:00','2026-10-20T11:00:00'),event('deadline','2026-10-20T09:00:00','2026-10-20T18:00:00','free')];
  assert.deepEqual(conflicts(events,'2026-10-20').map(pair=>pair.map(e=>e.id)),[['a','b']]);
});
test('free slots merge overlapping meetings and respect an all-day busy event',()=>{
  const events=[event('a','2026-10-20T09:00:00','2026-10-20T10:00:00'),event('b','2026-10-20T09:30:00','2026-10-20T11:00:00')];
  const slots=freeSlots(events,'2026-10-20',{start:'09:00',end:'12:00',minutes:60});assert.equal(slots.length,1);assert.equal(new Date(slots[0].start).getHours(),11);
  assert.deepEqual(freeSlots([{id:'all',start:'2026-10-20',end:'2026-10-21',allDay:true,availability:'busy'}],'2026-10-20'),[]);
  assert.deepEqual(freeSlots([],'2026-10-20',{start:'18:00',end:'09:00'}),[]);
});
test('scheduling validates work blocks without moving their deadline or accepting TaskFlow IDs',()=>{
  const w=fixture();scheduleTask(w,'t','2026-10-20','14:30',45);assert.equal(new Date(w.tasks[0].scheduledAt).getHours(),14);assert.equal(w.tasks[0].due,'2026-01-31');assert.equal(w.tasks[0].durationMinutes,45);
  assert.throws(()=>scheduleTask(w,'taskflow-x','2026-10-20'));assert.throws(()=>scheduleTask(w,'t','2026-10-20','25:00'));assert.throws(()=>scheduleTask(w,'t','2026-10-20','10:00',-1));
});
test('unscheduled tray can drop on the selected day and rejects stale tray items',()=>{
  const w=fixture();w.tasks[0].due='';assert.ok(moveCalendarItem(w,'unscheduled-t','2026-10-20','2026-10-20'));assert.equal(w.tasks[0].due,'2026-10-20');assert.throws(()=>moveCalendarItem(w,'unscheduled-t','2026-10-20','2026-10-21'));
});
test('global search combines query terms and includes shared data without changing it',()=>{
  const w=fixture(),feed={quests:[{id:'q',title:'Buy paper',notes:'Studio supplies'}],events:[{id:'e',title:'Planning call',where:'HQ'}]},before=structuredClone(feed);
  assert.equal(searchWorkspace(w,feed,'review studio')[0].id,'t');assert.equal(searchWorkspace(w,feed,'planning')[0].kind,'Google event via TaskFlow');assert.equal(searchWorkspace(w,feed,'INV-0008')[0].id,'i');assert.deepEqual(feed,before);assert.deepEqual(searchWorkspace(w,feed,''),[]);
});
test('templates create linked tasks and uniquely numbered unsent milestone drafts',()=>{
  const w=fixture(),template={tasks:parseTemplateLines('Kickoff | 0\nReview | 7'),milestones:parseTemplateLines('Deposit | 0 | 500\nDelivery | 14 | 1500',true)};
  const project=applyProjectTemplate(w,template,'c','2026-10-20','New launch');assert.equal(project.end,'2026-11-03');assert.equal(w.tasks.find(t=>t.title==='Review'&&t.project===project.id).due,'2026-10-27');
  assert.deepEqual(w.invoices.slice(-2).map(i=>i.no),['INV-0009','INV-0010']);assert.ok(w.invoices.slice(-2).every(i=>i.state==='draft'&&!i.pays.length));
  assert.throws(()=>parseTemplateLines('Bad | -1'));assert.throws(()=>parseTemplateLines('Bad | 0 | NaN',true));
});
test('recurring invoices are generated once per date and never inherit payments',()=>{
  const w=fixture();w.invoiceSchedules=[{id:'s',name:'Retainer',client:'c',items:w.invoices[0].items,tax:0,repeat:'monthly',next:'2026-01-31',anchor:31}];
  assert.equal(generateInvoiceDrafts(w,'2026-03-31'),3);assert.equal(w.invoiceSchedules[0].next,'2026-04-30');assert.equal(generateInvoiceDrafts(w,'2026-03-31'),0);
  assert.ok(w.invoices.slice(1).every(i=>i.state==='draft'&&i.pays.length===0));assert.equal(new Set(w.invoices.map(i=>i.no)).size,4);
  w.invoiceSchedules[0].paused=true;assert.equal(generateInvoiceDrafts(w,'2026-12-31'),0);
});
test('activity and client timeline include completions, project dates and existing payments',()=>{
  const before=fixture(),after=structuredClone(before);after.tasks[0].status='Done';recordActivity(before,after,'2026-10-20T12:00:00Z');assert.equal(after.activity[0].action,'Completed');assert.equal(after.activity[0].client,'c');
  const rows=clientTimeline(after,'c');assert.ok(rows.some(r=>r.label==='Completed Review'));assert.ok(rows.some(r=>r.label==='Payment recorded · INV-0008'));
});
test('finishing focus is idempotent, includes paused time and limits a stale timer to 24h',()=>{
  const w=fixture();w.focusTimer={taskId:'t',title:'Review',project:'p',startedAt:1000,elapsedMs:5000};assert.ok(finishFocus(w,61000));assert.equal(w.focusSessions[0].seconds,65);assert.equal(finishFocus(w,62000),false);assert.equal(w.focusSessions.length,1);
  w.focusTimer={taskId:'t',startedAt:1000,elapsedMs:0};finishFocus(w,1000+48*3600000);assert.equal(w.focusSessions[0].seconds,86400);
});
test('repeating a task preserves the offset between its work block and deadline',()=>{
  const before=fixture();before.tasks[0].repeat='weekly';before.tasks[0].scheduledAt=new Date('2026-01-29T10:30:00').toISOString();const after=structuredClone(before);after.tasks[0].status='Done';repeatCompletedTasks(before,after);
  assert.equal(after.tasks[1].due,'2026-02-07');const next=new Date(after.tasks[1].scheduledAt);assert.equal(next.getDate(),5);assert.equal(next.getHours(),10);assert.equal(next.getMinutes(),30);
});
test('reusable workflows can be recovered without touching generated invoices',()=>{
  const w=fixture();w.invoiceSchedules=[{id:'rule',name:'Retainer'}];trashReusable(w,'invoiceSchedules','rule');assert.equal(w.invoiceSchedules.length,0);assert.equal(w.invoices.length,1);restoreTrash(w,w.trash[0].id);assert.equal(w.invoiceSchedules[0].id,'rule');
});

test('TaskFlow repeats: every other day, yearly and chosen weekdays', async () => {
  const { nextRepeat, repeatLabel } = await import('../src/productivity.js');
  assert.equal(nextRepeat('2026-10-21', 'alternate'), '2026-10-23');
  assert.equal(nextRepeat('2028-02-29', 'yearly', 29), '2029-02-28');
  assert.equal(nextRepeat('2026-10-21', 'custom', 21, [1, 3, 5]), '2026-10-23');
  assert.equal(nextRepeat('2026-10-23', 'custom', 23, [1, 3, 5]), '2026-10-26');
  assert.throws(() => nextRepeat('2026-10-23', 'custom', 23, []));
  assert.equal(repeatLabel('custom', [5, 1]), 'Every Mon, Fri');
  assert.equal(repeatLabel('alternate'), 'Every other day');
});

test('the next repeat of a task starts clean: no approval, checklist unticked', () => {
  const before = { ...fresh(), tasks: [{ id: 't', title: 'Weekly report', status: 'Todo', repeat: 'weekly', due: '2026-10-26', checklist: [{ id: 'a', text: 'Draft', done: true }], approval: { state: 'approved' } }] };
  const after = structuredClone(before); after.tasks[0].status = 'Done';
  repeatCompletedTasks(before, after);
  const copy = after.tasks.find(t => t.repeatFrom === 't');
  assert.equal(copy.due, '2026-11-02'); assert.equal(copy.approval, undefined); assert.equal(copy.repeatNextId, undefined);
  assert.equal(copy.checklist[0].done, false);
});
