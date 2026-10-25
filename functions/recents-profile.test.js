import test from 'node:test';
import assert from 'node:assert/strict';
import {fresh} from '../src/lib.js';
import {stampUpdated,recentWork,allWork,clientReminders} from '../src/recents.js';
import {prepareProfile,publicProfileDoc,profileRoute,safeUrl,validUsername} from '../src/profile.js';
import {prepareInvoice,invoiceView} from '../src/invoice-input.js';
import {validateWorkspace} from '../src/workspace-upgrades.js';

const fixture=()=>({...fresh(),clients:[{id:'a',name:'Alpha'},{id:'b',name:'Beta'},{id:'old',name:'Old',arch:true}],projects:[{id:'p',name:'Launch',client:'a',status:'Active'},{id:'q',name:'Shipped',client:'b',status:'Complete'}],tasks:[{id:'t',title:'Draft',project:'p',client:'a',status:'Todo'}],invoices:[{id:'i',no:'INV-0001',client:'a',issue:'2026-10-01',due:'2026-10-15',state:'draft',tax:0,items:[{desc:'Work',qty:1,price:100}],pays:[]}],notes:[]});

test('only changed or new records get a fresh timestamp',()=>{
  const before=fixture();before.clients[1].updatedAt='2026-01-01T00:00:00.000Z';
  const after=structuredClone(before);after.clients[0].name='Alpha Ltd';after.tasks.push({id:'n',title:'New',status:'Todo'});
  stampUpdated(before,after,'2026-10-25T10:00:00.000Z');
  assert.equal(after.clients[0].updatedAt,'2026-10-25T10:00:00.000Z');
  assert.equal(after.clients[1].updatedAt,'2026-01-01T00:00:00.000Z');
  assert.equal(after.tasks[1].updatedAt,'2026-10-25T10:00:00.000Z');
  assert.equal(after.projects[0].updatedAt,undefined);
});

test('jump back in lists the SoloDesk items edited most recently, never TaskFlow quests',()=>{
  const w=fixture();w.projects[0].updatedAt='2026-10-20T00:00:00Z';w.clients[1].updatedAt='2026-10-21T00:00:00Z';w.tasks[0].updatedAt='2026-10-23T00:00:00Z';
  w.notes=[{id:'n',title:'Kickoff',client:'a',checklist:[],updatedAt:'2026-10-24T00:00:00Z'}];
  assert.deepEqual(recentWork(w).map(e=>e.kind+':'+e.row.id),['note:n','task:t','client:b']);
  w.clients[0].arch=true;w.clients[0].updatedAt='2026-10-25T00:00:00Z';
  assert.ok(!recentWork(w,{limit:10}).some(e=>e.row.id==='a'),'archived clients stay out');
});

test('all work splits active projects, clients and completed work',()=>{
  const w=fixture();w.tasks.push({id:'d',title:'Done',status:'Done'});
  const all=allWork(w);
  assert.deepEqual(all.projects.map(e=>e.row.id),['p']);
  assert.deepEqual(all.clients.map(e=>e.row.id).sort(),['a','b']);
  assert.deepEqual(all.completed.map(e=>e.row.id).sort(),['d','q']);
});

test('client reminders are open dated checklist items, soonest first',()=>{
  const w=fixture();w.notes=[{id:'n',title:'Kickoff',client:'a',checklist:[{id:'1',title:'Later',due:'2026-11-02',done:false},{id:'2',title:'Soon',due:'2026-10-27',done:false},{id:'3',title:'Done',due:'2026-10-26',done:true},{id:'4',title:'Undated',done:false}]}];
  assert.deepEqual(clientReminders(w,'a').map(r=>r.title),['Soon','Later']);
});

test('profiles validate usernames, links and client choices',()=>{
  const w=fixture();
  for(const username of ['ab','privacy','-lead','Has Space','x'.repeat(31)])assert.ok(prepareProfile({username,name:'A'},w).error,username);
  assert.ok(validUsername('aditya_m'));
  assert.match(prepareProfile({username:'aditya',name:'A',links:[{label:'Site',url:'javascript:alert(1)'}]},w).error,/link/);
  const {profile}=prepareProfile({username:' Aditya ',name:' Aditya Manoj ',links:[{label:'Site',url:'https://aditya.design'},{label:'',url:''}],clients:['a','missing','a']},w);
  assert.equal(profile.username,'aditya');assert.deepEqual(profile.clients,['a']);assert.equal(profile.links.length,1);assert.equal(profile.public,false);
  assert.equal(safeUrl('https://user:pw@example.com'),null);
});

test('a private profile publishes only the name; a public one shares chosen client names only',()=>{
  const w=fixture();w.clients[0].email='secret@example.com';
  const {profile}=prepareProfile({username:'aditya',name:'Aditya',bio:'Bio',clients:['a']},w);
  assert.deepEqual(publicProfileDoc(profile,w,'uid1'),{uid:'uid1',username:'aditya',name:'Aditya',public:false});
  const doc=publicProfileDoc({...profile,public:true},w,'uid1');
  assert.deepEqual(doc.clients,['Alpha']);assert.ok(!JSON.stringify(doc).includes('secret@'));
});

test('profile paths only match valid, unreserved usernames',()=>{
  assert.equal(profileRoute('/Aditya/'),'aditya');
  for(const path of ['/','/privacy','/brand/logo.png','/%E0%A4%A','/a'])assert.equal(profileRoute(path),null,path);
});

test('invoice number, title, parties and bank details are editable and fall back to settings',()=>{
  const w=fixture();w.invoices.push({id:'j',no:'SD-2026-01',client:'a',state:'sent'});
  const base={client:'a',issue:'2026-10-20',due:'2026-11-03',tax:'18'},lines=[{desc:'Design',qty:1,price:100}];
  assert.match(prepareInvoice(w,{...base,no:'sd-2026-01'},lines,'i').error,/already used/);
  assert.ok(prepareInvoice(w,{...base,no:'<script>'},lines,'i').error);
  assert.match(prepareInvoice(w,{...base,billTo:{email:'nope'}},lines,'i').error,/billing email/);
  const {invoice}=prepareInvoice(w,{...base,no:' INV-0001 ',title:'Phase 1',taxLabel:'GST',bank:{accountName:'Sunday LLP',ifsc:'HDFC0001234',junk:'x'}},lines,'i');
  assert.equal(invoice.no,'INV-0001');assert.equal(invoice.title,'Phase 1');assert.deepEqual(Object.keys(invoice.bank),['accountName','bankName','accountNumber','ifsc','swift','iban','upi']);
  const view=invoiceView(invoice,{biz:'Sunday',pay:'Pay by transfer',bank:{upi:'sunday@hdfc'}},{name:'Alpha',email:'a@x.com'});
  w.invoices.pop();
  assert.equal(view.from.name,'Sunday');assert.equal(view.billTo.email,'a@x.com');assert.equal(view.bank.accountName,'Sunday LLP');assert.equal(view.bank.upi,'sunday@hdfc');assert.equal(view.taxLabel,'GST');
  assert.ok(validateWorkspace({...w,invoices:[{...w.invoices[0],...invoice}],profile:{username:'aditya',name:'A',public:false,links:[],clients:[]}}));
  assert.throws(()=>validateWorkspace({...w,profile:{public:'yes'}}),/profile/);
  assert.throws(()=>validateWorkspace({...w,notes:[{id:'n',title:'N',checklist:[{title:'x',due:'soon'}]}]}),/note/);
});

test('action colour accepts presets and custom hex colours only', async () => {
  const { validateWorkspace } = await import('../src/workspace-upgrades.js');
  const base = { ...fresh(), settings: { ...fresh().settings } };
  for (const ok of ['terracotta', 'teal', '#A1B2C3']) assert.ok(validateWorkspace({ ...base, settings: { ...base.settings, actionColour: ok } }));
  for (const bad of ['pink-ish', '#12345', 'red']) assert.throws(() => validateWorkspace({ ...base, settings: { ...base.settings, actionColour: bad } }), /appearance/);
});
