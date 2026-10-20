import test from 'node:test';
import assert from 'node:assert/strict';
import {fresh} from '../src/lib.js';
import {assertUnchanged,validateWorkspace,previewBackup,restoreBackup,validateDependencies,blockers,projectBudget,publishablePortal} from '../src/workspace-upgrades.js';
import {createWorkspaceSaves} from '../src/workspace-saves.js';
import {trashRecord,restoreTrash} from '../src/productivity.js';
const fixture=()=>({...fresh(),clients:[{id:'c',name:'Client',email:'c@example.test',notes:'PRIVATE'},{id:'other',name:'Other'}],projects:[{id:'p',name:'Work',client:'c',status:'Active',budgetHours:2,hourlyRate:100}],tasks:[{id:'a',title:'First',project:'p',client:'c',status:'Todo',notes:'SECRET'},{id:'b',title:'Next',project:'p',client:'c',status:'Todo',dependencies:['a']}],invoices:[{id:'i',no:'INV-1',client:'c',issue:'2026-10-20',due:'2026-11-20',state:'sent',tax:0,items:[{desc:'Work',qty:1,price:100}],pays:[],notes:'SECRET'}]});
test('concurrent sessions reject stale snapshots and queued writes advance their baseline',async()=>{
  let server=null;const writer=async(_,value,baseline)=>{assertUnchanged(server,baseline);server=JSON.stringify(value);return server;};
  const first=createWorkspaceSaves(writer,()=>{}),second=createWorkspaceSaves(writer,()=>{});first.begin('u');second.begin('u');
  assert.equal(await first.save({tasks:['a']}),true);assert.equal(await first.save({tasks:['a','b']}),true);
  assert.equal(await second.save({tasks:['lost']}),false);assert.deepEqual(JSON.parse(server).tasks,['a','b']);
});
test('backup preview identifies duplicate IDs and merge keeps current values',()=>{
  const current=fixture(),incoming=fixture();incoming.clients[0].name='Old name';incoming.tasks.push({id:'new',title:'Imported task'});
  const preview=previewBackup(current,JSON.stringify({schemaVersion:1,data:incoming}));assert.equal(preview.counts[0].duplicates,2);
  const merged=restoreBackup(current,preview.incoming,'merge');assert.equal(merged.clients[0].name,'Client');assert.ok(merged.tasks.some(t=>t.id==='new'));assert.equal(restoreBackup(current,incoming,'replace').clients[0].name,'Old name');
});
test('malformed backups fail validation before modifying the workspace',()=>{
  for(const mutate of [w=>w.tasks={},w=>w.clients.push({...w.clients[0]}),w=>w.tasks[0].due='2026-02-30',w=>w.settings.logo='https://untrusted.example/track',w=>w.invoices[0].items[0].price='NaN',w=>w.notes=[{id:'x',checklist:{}}],w=>w.focusSessions=[{id:'s',seconds:'not-time'}]]){const w=fixture();mutate(w);assert.throws(()=>validateWorkspace(w));}
  assert.throws(()=>previewBackup(fixture(),{schemaVersion:99,data:fixture()}));
  assert.throws(()=>previewBackup(fixture(),JSON.stringify(fixture()).replace('"settings":{','"settings":{"__proto__":{"polluted":true},')),/Unsafe/);
});
test('dependencies detect blockers, missing tasks, self links and cycles',()=>{
  const w=fixture();assert.deepEqual(blockers(w,w.tasks[1]),['a']);w.tasks[0].status='Done';assert.deepEqual(blockers(w,w.tasks[1]),[]);
  assert.throws(()=>validateDependencies(w,'a',['a']));assert.throws(()=>validateDependencies(w,'a',['b']));assert.throws(()=>validateDependencies(w,'a',['missing']));validateDependencies(w,'b',['a']);
});
test('deleting a prerequisite unlinks dependents and Trash can recover the relationship',()=>{
  const w=fixture();trashRecord(w,'tasks','a');assert.deepEqual(w.tasks[0].dependencies,[]);restoreTrash(w,w.trash[0].id);assert.deepEqual(w.tasks.find(t=>t.id==='b').dependencies,['a']);
});
test('project budget uses only linked logged sessions and separates time value from revenue',()=>{
  const w=fixture();w.focusSessions=[{project:'p',seconds:10800},{project:'other',seconds:3600}];assert.deepEqual(projectBudget(w,w.projects[0]),{hours:3,budget:2,remaining:0,over:1,value:300});
});
test('portal whitelist excludes private notes, contacts, drafts and unrelated clients',()=>{
  const w=fixture();w.invoices.push({...w.invoices[0],id:'draft',state:'draft'},{...w.invoices[0],id:'other-invoice',client:'other'});w.projects.push({id:'other-project',name:'OTHER',client:'other'});w.tasks.push({id:'secret',title:'OTHER',project:'other-project',client:'other'});
  const shared=publishablePortal(w,'c',['p','other-project'],['i','draft','other-invoice']);assert.equal(shared.projects.length,1);assert.equal(shared.tasks.length,2);assert.equal(shared.invoices.length,1);assert.ok(!JSON.stringify(shared).includes('SECRET'));assert.ok(!JSON.stringify(shared).includes('PRIVATE'));assert.ok(!JSON.stringify(shared).includes('OTHER'));assert.equal(shared.tasks[0].projectId,'p');
});
