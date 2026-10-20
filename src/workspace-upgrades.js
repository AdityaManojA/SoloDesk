import {fresh,calc} from './lib.js';
import {assertWorkspaceSize} from './workspace-size.js';

export function assertUnchanged(actual,expected){
  if(actual!==expected)throw Object.assign(new Error('This workspace changed in another tab or device. Export your pending changes before loading the latest version.'),{code:'workspace-conflict'});
}
const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
const date=v=>!v||typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
export function validateWorkspace(input){
  if(!object(input))throw new Error('Choose a SoloDesk workspace JSON backup.');
  const pending=[input],seen=new WeakSet();
  while(pending.length){const row=pending.pop();if(!row||typeof row!=='object'||seen.has(row))continue;seen.add(row);for(const [key,value]of Object.entries(row)){if(['__proto__','prototype','constructor'].includes(key))throw new Error('Unsafe field name in backup.');if(value&&typeof value==='object')pending.push(value);}}
  const w=structuredClone(input),base=fresh();
  for(const list of ['clients','projects','tasks','invoices']){
    if(!Array.isArray(w[list]))throw new Error('Backup is missing '+list+'.');
    const ids=new Set();
    for(const row of w[list]){
      if(!object(row)||typeof row.id!=='string'||!row.id||ids.has(row.id))throw new Error('Invalid or duplicate '+list+' IDs.');
      ids.add(row.id);
      if(typeof row[list==='tasks'?'title':list==='invoices'?'no':'name']!=='string')throw new Error('Invalid '+list+' record.');
      for(const field of ['start','end','due','issue'])if(!date(row[field]))throw new Error('Invalid date in '+list+'.');
      if(list==='invoices'&&(!Array.isArray(row.items)||!row.items.length||row.items.some(i=>!object(i)||typeof i.desc!=='string'||!Number.isFinite(Number(i.qty))||Number(i.qty)<=0||!Number.isFinite(Number(i.price))||Number(i.price)<0)||!Array.isArray(row.pays)||row.pays.some(p=>!object(p)||!date(p.date)||!Number.isFinite(Number(p.amt))||Number(p.amt)<0)||!Number.isFinite(Number(row.tax||0))||!Number.isFinite(calc(row).total)))throw new Error('Invalid invoice amounts or payments.');
      if(list==='tasks'&&(row.scheduledAt&&!Number.isFinite(Date.parse(row.scheduledAt))||row.dependencies&&(!Array.isArray(row.dependencies)||row.dependencies.some(id=>typeof id!=='string'))))throw new Error('Invalid task schedule or dependencies.');
    }
  }
  if(!object(w.settings))throw new Error('Backup is missing business settings.');
  for(const key of ['biz','email','phone','addr','pay','cur','logo'])if(w.settings[key]!=null&&typeof w.settings[key]!=='string')throw new Error('Invalid business settings.');
  if(w.settings.cur&&!/^[A-Z]{3}$/.test(w.settings.cur))throw new Error('Invalid currency.');
  if(w.settings.logo&&!/^data:image\/(png|jpeg);base64,[a-zA-Z0-9+/=]+$/.test(w.settings.logo))throw new Error('Backup logo must be an embedded PNG or JPG.');
  for(const list of ['projectTemplates','invoiceSchedules','focusSessions','activity','trash','notes'])if(w[list]!=null&&!Array.isArray(w[list]))throw new Error('Invalid '+list+' in backup.');
  const strings=(row,fields)=>fields.every(key=>row[key]==null||typeof row[key]==='string');
  const checklist=items=>items==null||Array.isArray(items)&&items.every(c=>object(c)&&typeof c.title==='string'&&(c.id==null||typeof c.id==='string')&&(c.done==null||typeof c.done==='boolean'));
  if(!w.clients.every(c=>strings(c,['email','phone','address','notes']))||!w.projects.every(p=>strings(p,['client','status']))||!w.tasks.every(t=>strings(t,['client','project','status','priority','notes','scheduledAt','repeat'])&&checklist(t.checklist)))throw new Error('Invalid text or checklist fields.');
  for(const list of ['projectTemplates','invoiceSchedules','focusSessions','activity','trash','notes']){
    const ids=new Set();for(const row of w[list]||[]){if(!object(row)||typeof row.id!=='string'||!row.id||ids.has(row.id))throw new Error('Invalid '+list+' IDs.');ids.add(row.id);}
  }
  for(const p of w.projects)for(const key of ['budgetHours','hourlyRate'])if(p[key]!=null&&(!Number.isFinite(Number(p[key]))||Number(p[key])<0))throw new Error('Invalid project budget.');
  for(const t of w.projectTemplates||[])if(typeof t.name!=='string'||!Array.isArray(t.tasks)||!Array.isArray(t.milestones)||[...t.tasks,...t.milestones].some(x=>!object(x)||typeof x.title!=='string'||!Number.isInteger(x.offset)||x.offset<0||x.offset>999)||t.milestones.some(m=>!Number.isFinite(Number(m.amount))||Number(m.amount)<=0))throw new Error('Invalid project template.');
  for(const r of w.invoiceSchedules||[])if(!strings(r,['name','client','repeat','notes'])||!['daily','weekdays','weekly','monthly'].includes(r.repeat)||!r.next||!date(r.next)||!Array.isArray(r.items)||!r.items.length||r.items.some(i=>!object(i)||typeof i.desc!=='string'||!Number.isFinite(Number(i.qty))||Number(i.qty)<=0||!Number.isFinite(Number(i.price))||Number(i.price)<0)||!Number.isFinite(Number(r.tax||0))||Number(r.tax||0)<0||!Number.isFinite(calc({...r,pays:[]}).total))throw new Error('Invalid recurring invoice schedule.');
  for(const session of w.focusSessions||[])if(!strings(session,['taskId','project','title','at'])||!Number.isFinite(session.seconds)||session.seconds<0)throw new Error('Invalid focus history.');
  for(const n of w.notes||[])if(!strings(n,['title','body','project','createdAt'])||!checklist(n.checklist))throw new Error('Invalid note.');
  for(const a of w.activity||[])if(!strings(a,['at','kind','recordId','client','title','action']))throw new Error('Invalid activity history.');
  if(w.settings.dashboardHidden!=null&&(!Array.isArray(w.settings.dashboardHidden)||w.settings.dashboardHidden.some(x=>!['metrics','overview','work'].includes(x))))throw new Error('Invalid dashboard options.');
  if(w.focusTimer!=null&&(!object(w.focusTimer)||!strings(w.focusTimer,['taskId','title','project'])||!Number.isFinite(w.focusTimer.elapsedMs)||w.focusTimer.elapsedMs<0||w.focusTimer.startedAt!=null&&!Number.isFinite(w.focusTimer.startedAt)))throw new Error('Invalid focus timer.');
  for(const entry of w.trash||[])if(!strings(entry,['title','at'])||!Array.isArray(entry.changes)||entry.changes.some(c=>!object(c)||!['clients','projects','tasks','invoices','projectTemplates','invoiceSchedules','notes'].includes(c.list)||!object(c.before)||typeof c.before.id!=='string'||c.after!=null&&(!object(c.after)||!Array.isArray(c.fields)||c.fields.some(f=>typeof f!=='string'||['__proto__','prototype','constructor'].includes(f)))))throw new Error('Invalid Trash recovery entry.');
  for(const entry of w.trash||[])for(const change of entry.changes){validateWorkspace({...fresh(),[change.list]:[change.before]});if(change.after)validateWorkspace({...fresh(),[change.list]:[change.after]});}
  // Backups never grant portal access or retain credentials. Portal membership is managed separately.
  delete w.portal;delete w.portalAccess;
  const result={...base,...w,settings:{...base.settings,...w.settings}};
  assertWorkspaceSize(result);return result;
}
export function previewBackup(current,raw){
  const parsed=typeof raw==='string'?JSON.parse(raw):raw;
  if(parsed.schemaVersion!=null&&parsed.schemaVersion!==1)throw new Error('Unsupported backup version.');
  const incoming=validateWorkspace(parsed.data||parsed);
  return {incoming,counts:['clients','projects','tasks','invoices'].map(list=>({list,records:incoming[list].length,duplicates:incoming[list].filter(row=>current[list].some(x=>x.id===row.id)).length}))};
}
export function restoreBackup(current,incoming,mode){
  const valid=validateWorkspace(incoming);
  if(mode==='replace')return valid;
  if(mode!=='merge')throw new Error('Choose merge or replace.');
  const next=structuredClone(current);
  for(const list of ['clients','projects','tasks','invoices','projectTemplates','invoiceSchedules','focusSessions','activity','notes']){
    const ids=new Set((next[list]||[]).map(x=>x.id));
    next[list]=[...(next[list]||[]),...(valid[list]||[]).filter(x=>!ids.has(x.id))];
  }
  next.seq=Math.max(Number(next.seq)||0,Number(valid.seq)||0);assertWorkspaceSize(next);return next;
}
export function blockers(workspace,task){return (task.dependencies||[]).filter(id=>workspace.tasks.find(t=>t.id===id)?.status!=='Done');}
export function validateDependencies(workspace,id,dependencies){
  const visit=(next,path)=>{
    if(path.has(next))throw new Error('Task dependencies cannot form a cycle.');
    const task=workspace.tasks.find(t=>t.id===next);if(!task)throw new Error('A dependency no longer exists.');
    for(const child of next===id?dependencies:task.dependencies||[])visit(child,new Set([...path,next]));
  };
  if(dependencies.includes(id))throw new Error('A task cannot depend on itself.');
  for(const dep of dependencies)visit(dep,new Set([id]));
}
export function projectBudget(workspace,project){
  const seconds=(workspace.focusSessions||[]).filter(s=>s.project===project.id).reduce((sum,s)=>sum+Number(s.seconds||0),0),hours=seconds/3600,budget=Number(project.budgetHours)||0;
  return {hours,budget,remaining:Math.max(0,budget-hours),over:Math.max(0,hours-budget),value:hours*(Number(project.hourlyRate)||0)};
}
export function publishablePortal(workspace,clientId,projectIds,invoiceIds){
  const client=workspace.clients.find(c=>c.id===clientId);if(!client)throw new Error('Choose a client.');
  const projects=workspace.projects.filter(p=>p.client===clientId&&projectIds.includes(p.id)).map(p=>({id:p.id,name:p.name,status:p.status,start:p.start||'',end:p.end||''}));
  const tasks=workspace.tasks.filter(t=>projects.some(p=>p.id===t.project)&&(!t.client||t.client===clientId)).map(t=>({id:t.id,projectId:t.project,title:t.title,status:t.status,due:t.due||'',checklist:(t.checklist||[]).map(c=>({title:c.title,done:!!c.done}))}));
  const invoices=workspace.invoices.filter(i=>i.client===clientId&&invoiceIds.includes(i.id)&&i.state==='sent').map(i=>({id:i.id,no:i.no,issue:i.issue,due:i.due,items:i.items.map(l=>({desc:l.desc,qty:l.qty,price:l.price})),tax:i.tax||0,total:calc(i).total,paid:calc(i).paid,balance:calc(i).bal}));
  return {business:workspace.settings.biz||'SoloDesk',clientName:client.name,currency:workspace.settings.cur,projects,tasks,invoices,updatedAt:new Date().toISOString()};
}
