import {rid,today,addDays,calc} from './lib.js';
import {nextInvoiceNumber} from './invoice-input.js';
import {deleteRecord} from './record-actions.js';
import {calendarEvents} from '../functions/calendar.js';
import {taskflowCalendarEvents} from './taskflow-data.js';
import {onDay,localDay} from './calendar-view.js';

const collections=['clients','projects','tasks','invoices'];
export const frequencies=[['','Does not repeat'],['daily','Daily'],['weekdays','Weekdays'],['weekly','Weekly'],['monthly','Monthly']];
export const validDay=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T12:00:00Z'))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
export function nextRepeat(day,frequency,anchor=Number(day?.slice(-2))){
  if(!validDay(day)||!frequencies.some(([f])=>f&&f===frequency))throw new Error('Choose a valid repeat date and frequency.');
  if(frequency==='monthly'){
    const x=new Date(day+'T12:00:00Z');x.setUTCDate(1);x.setUTCMonth(x.getUTCMonth()+1);
    const last=new Date(Date.UTC(x.getUTCFullYear(),x.getUTCMonth()+1,0)).getUTCDate();
    x.setUTCDate(Math.min(Math.max(1,Number(anchor)||1),last));return x.toISOString().slice(0,10);
  }
  let next=addDays(day,frequency==='weekly'?7:1);
  while(frequency==='weekdays'&&[0,6].includes(new Date(next+'T12:00:00').getDay()))next=addDays(next,1);
  return next;
}

export function repeatCompletedTasks(before,after){
  for(const task of [...after.tasks]){
    const old=before.tasks.find(t=>t.id===task.id);
    if(task.status!=='Done'||old?.status==='Done'||!task.repeat||!old)continue;
    if(task.repeatNextId||after.tasks.some(t=>t.repeatFrom===task.id))continue;
    const day=task.due|| (task.scheduledAt?localDay(task.scheduledAt):today());
    const next=nextRepeat(day,task.repeat,task.repeatAnchor||Number(day.slice(-2)));
    const copy={...structuredClone(task),id:rid(),status:'Todo',repeatFrom:task.id,repeatAnchor:task.repeatAnchor||Number(day.slice(-2)),createdAt:new Date().toISOString()};
    if(task.due)copy.due=next;
    if(task.scheduledAt){const date=new Date(task.scheduledAt),delta=Math.round((Date.parse(next+'T12:00:00Z')-Date.parse(day+'T12:00:00Z'))/86400000);date.setDate(date.getDate()+delta);copy.scheduledAt=date.toISOString();}
    if(!task.due&&!task.scheduledAt)copy.due=next;
    task.repeatNextId=copy.id;after.tasks.push(copy);
  }
}

export function recordActivity(before,after,now=new Date().toISOString()){
  const rows=[],afterProjects=new Map(after.projects.map(p=>[p.id,p])),beforeProjects=new Map(before.projects.map(p=>[p.id,p]));
  for(const kind of collections){
    const previous=new Map(before[kind].map(item=>[item.id,item])),current=new Set(after[kind].map(item=>item.id));
    for(const item of after[kind]){
      const old=previous.get(item.id);
      if(JSON.stringify(old)===JSON.stringify(item))continue;
      const client=item.client||(kind==='clients'?item.id:afterProjects.get(item.project)?.client)||'';
      const action=!old?'Created':kind==='tasks'&&old.status!=='Done'&&item.status==='Done'?'Completed':kind==='invoices'&&old.pays?.length<item.pays?.length?'Recorded payment for':'Updated';
      rows.push({id:rid(),at:now,kind,recordId:item.id,client,title:item.name||item.title||item.no,action});
    }
    for(const item of before[kind])if(!current.has(item.id))rows.push({id:rid(),at:now,kind,recordId:item.id,client:kind==='clients'?item.id:item.client||beforeProjects.get(item.project)?.client||'',title:item.name||item.title||item.no,action:'Moved to Trash'});
  }
  after.activity=[...rows,...(after.activity||[])].slice(0,500);
}

export function trashRecord(workspace,kind,id,invoiceId){
  const before=structuredClone(workspace);
  if(!deleteRecord(workspace,kind,id,invoiceId))return false;
  const changes=[];
  for(const list of collections)for(const row of before[list]){
    const after=workspace[list].find(x=>x.id===row.id);
    if(!after)changes.push({list,before:row,after:null});
    else if(JSON.stringify(row)!==JSON.stringify(after)){
      const fields=Object.keys({...row,...after}).filter(key=>JSON.stringify(row[key])!==JSON.stringify(after[key]));
      changes.push({list,id:row.id,fields,before:row,after:structuredClone(after)});
    }
  }
  const item=before[kind]?.find(x=>x.id===id);
  workspace.trash=[{id:rid(),at:new Date().toISOString(),title:item?.name||item?.title||item?.no||'Payment record',changes},...(workspace.trash||[])];
  return true;
}

export function restoreTrash(workspace,id){
  const entry=workspace.trash?.find(x=>x.id===id);if(!entry)throw new Error('This item is no longer in Trash.');
  for(const change of entry.changes){
    const current=(workspace[change.list]||[]).find(x=>x.id===change.before.id);
    if(change.after===null&&current)throw new Error('A record with this ID already exists. Nothing was restored.');
    if(change.after!==null&&(!current||change.fields.some(key=>JSON.stringify(current[key])!==JSON.stringify(change.after[key]))))throw new Error('A linked record changed after deletion. Undo those changes before restoring this bundle.');
  }
  // Validate against the entire restored bundle before changing anything. A task
  // deleted before its client must not be restored with dangling relationships.
  const restored=structuredClone(workspace);
  for(const change of entry.changes){
    if(change.after===null)(restored[change.list] ||= []).push(structuredClone(change.before));
    else{const current=restored[change.list].find(x=>x.id===change.before.id);for(const key of change.fields){if(Object.hasOwn(change.before,key))current[key]=structuredClone(change.before[key]);else delete current[key];}}
  }
  for(const change of entry.changes){
    const row=restored[change.list].find(x=>x.id===change.before.id);
    if(row.client&&!restored.clients.some(c=>c.id===row.client)||row.project&&!restored.projects.some(p=>p.id===row.project))throw new Error('Restore the linked client or project from Trash first. Nothing was restored.');
  }
  for(const change of entry.changes){
    if(change.after===null)workspace[change.list].push(structuredClone(change.before));
    else{const current=workspace[change.list].find(x=>x.id===change.before.id);for(const key of change.fields){if(Object.hasOwn(change.before,key))current[key]=structuredClone(change.before[key]);else delete current[key];}}
  }
  workspace.trash=workspace.trash.filter(x=>x.id!==id);
}
export function trashReusable(workspace,list,id){
  if(!['projectTemplates','invoiceSchedules','notes','docs'].includes(list))throw new Error('Choose a reusable workflow.');
  const record=workspace[list]?.find(x=>x.id===id);if(!record)throw new Error('This item is no longer available.');
  workspace.trash=[{id:rid(),at:new Date().toISOString(),title:record.name||record.title||'Untitled',changes:[{list,before:structuredClone(record),after:null}]},...(workspace.trash||[])];
  workspace[list]=workspace[list].filter(x=>x.id!==id);
}

export function allWorkEvents(workspace,feed){return [...calendarEvents(workspace),...taskflowCalendarEvents(feed||{quests:[],events:[],tz:null})];}
export function conflicts(events,day){
  const busy=events.filter(e=>e.availability==='busy'&&onDay(e,day));
  const pairs=[];
  const time=(e,end)=>Date.parse((end?e.end:e.start)+(e.allDay?'T00:00:00':''));
  for(let a=0;a<busy.length;a++)for(let b=a+1;b<busy.length;b++)if(time(busy[a],false)<time(busy[b],true)&&time(busy[b],false)<time(busy[a],true))pairs.push([busy[a],busy[b]]);
  return pairs;
}
export function freeSlots(events,day,{start='09:00',end='18:00',minutes=60}={}){
  if(!validDay(day)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(start)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(end)||!Number.isFinite(Number(minutes))||minutes<5||minutes>1440)return [];
  const lo=Date.parse(day+'T'+start+':00'),hi=Date.parse(day+'T'+end+':00'),span=minutes*60000;
  if(hi<=lo)return [];
  const intervals=events.filter(e=>e.availability==='busy'&&onDay(e,day)).map(e=>[Math.max(lo,Date.parse(e.start+(e.allDay?'T00:00:00':''))),Math.min(hi,Date.parse(e.end+(e.allDay?'T00:00:00':'')))]).filter(([a,b])=>b>a).sort((a,b)=>a[0]-b[0]);
  const gaps=[];let cursor=lo;
  for(const [a,b]of intervals){if(a-cursor>=span)gaps.push({start:new Date(cursor).toISOString(),end:new Date(a).toISOString()});cursor=Math.max(cursor,b);}
  if(hi-cursor>=span)gaps.push({start:new Date(cursor).toISOString(),end:new Date(hi).toISOString()});return gaps;
}
export function scheduleTask(workspace,id,day,time='09:00',minutes=60){
  const task=workspace.tasks.find(t=>t.id===id);
  if(!task||task.status==='Done')throw new Error('Choose an open SoloDesk task.');
  if(!validDay(day)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)||!Number.isFinite(Number(minutes))||minutes<5||minutes>1440)throw new Error('Choose a date, time and duration of 5–1440 minutes.');
  const date=new Date(day+'T'+time+':00');
  if(localDay(date.toISOString())!==day||date.getHours()!==Number(time.slice(0,2))||date.getMinutes()!==Number(time.slice(3)))throw new Error('That time does not exist on this date.');
  task.scheduledAt=date.toISOString();task.durationMinutes=Number(minutes);
}

export function searchWorkspace(workspace,feed,query){
  const terms=query.trim().toLowerCase().split(/\s+/).filter(Boolean);if(!terms.length)return [];
  const clients=new Map(workspace.clients.map(c=>[c.id,c])),projects=new Map(workspace.projects.map(p=>[p.id,p]));
  const rows=collections.flatMap(kind=>workspace[kind].map(item=>({kind,id:item.id,title:item.name||item.title||item.no,detail:[item.email,item.notes,item.status,clients.get(item.client)?.name,projects.get(item.project)?.name].filter(Boolean).join(' · '),path:kind==='projects'?'#/projects':'#/'+kind+'/'+item.id})));
  rows.push(...(feed?.quests||[]).map(q=>({kind:'TaskFlow quest',id:q.id,title:q.title,detail:q.notes||'',url:'https://taskflow-dailytracker.web.app/'})),...(feed?.events||[]).map(e=>({kind:'Google event via TaskFlow',id:e.id,title:e.title,detail:e.where||'',url:e.url||'https://taskflow-dailytracker.web.app/'})));
  return rows.filter(row=>terms.every(term=>(row.title+' '+row.detail+' '+row.kind).toLowerCase().includes(term))).slice(0,50);
}

export function parseTemplateLines(text,milestones=false){
  return text.split('\n').map(x=>x.trim()).filter(Boolean).map(line=>{
    const [title,offset='0',amount='0']=line.split('|').map(x=>x.trim());
    if(!title||!/^\d{1,3}$/.test(offset)||milestones&&(!Number.isFinite(Number(amount))||Number(amount)<=0))throw new Error('Use “Title | days after start” for tasks and “Title | days after start | amount” for milestones. Days must be 0–999; milestone amounts must be positive.');
    return milestones?{title,offset:Number(offset),amount:Number(amount)}:{title,offset:Number(offset)};
  });
}
export function applyProjectTemplate(workspace,template,client,start,name){
  if(!validDay(start)||!workspace.clients.some(c=>c.id===client&&!c.arch)||!name?.trim())throw new Error('Choose an active client, project name and start date.');
  const project={id:rid(),name:name.trim(),client,status:'Active',start,end:addDays(start,Math.max(0,...template.tasks.map(t=>t.offset),...template.milestones.map(t=>t.offset)))};
  workspace.projects.push(project);
  for(const task of template.tasks)workspace.tasks.push({id:rid(),title:task.title,client,project:project.id,status:'Todo',priority:'Medium',due:addDays(start,task.offset),durationMinutes:60});
  for(const milestone of template.milestones){const number=nextInvoiceNumber(workspace);workspace.seq=number.seq;workspace.invoices.push({id:rid(),no:number.no,client,project:project.id,issue:start,due:addDays(start,milestone.offset),state:'draft',items:[{desc:milestone.title,qty:1,price:milestone.amount}],tax:0,notes:'Project milestone: '+project.name,pays:[]});}
  return project;
}
export function generateInvoiceDrafts(workspace,through=today()){
  if(!validDay(through))throw new Error('Choose a valid date.');let count=0;
  for(const rule of workspace.invoiceSchedules||[]){
    if(rule.paused)continue;
    if(!workspace.clients.some(c=>c.id===rule.client&&!c.arch))continue;
    let perRule=0;
    while(rule.next<=through&&perRule++<24){
      if(!workspace.invoices.some(i=>i.scheduleId===rule.id&&i.scheduleDate===rule.next)){
        const number=nextInvoiceNumber(workspace);workspace.seq=number.seq;
        workspace.invoices.push({id:rid(),no:number.no,client:rule.client,issue:rule.next,due:addDays(rule.next,14),state:'draft',tax:rule.tax||0,items:structuredClone(rule.items),notes:rule.notes||'',pays:[],scheduleId:rule.id,scheduleDate:rule.next});count++;
      }
      rule.next=nextRepeat(rule.next,rule.repeat,rule.anchor);
    }
  }
  return count;
}
export const defaultTemplates=[{id:'website',name:'Website launch',tasks:[{title:'Discovery & brief',offset:0},{title:'Review wireframes',offset:3},{title:'Design review',offset:7},{title:'Launch checklist',offset:14}],milestones:[]},{id:'identity',name:'Brand identity',tasks:[{title:'Kickoff & research',offset:0},{title:'Present concepts',offset:5},{title:'Refine identity',offset:10},{title:'Deliver brand assets',offset:14}],milestones:[]}];
export function finishFocus(workspace,now=Date.now()){
  const t=workspace.focusTimer;if(!t)return false;
  const ms=(t.elapsedMs||0)+(t.startedAt?Math.max(0,now-t.startedAt):0);
  if(ms>=1000)workspace.focusSessions=[{id:rid(),taskId:t.taskId,title:t.title,project:t.project,at:new Date(now).toISOString(),seconds:Math.min(86400,Math.floor(ms/1000))},...(workspace.focusSessions||[])];
  workspace.focusTimer=null;return true;
}
export function focusProjectTotals(workspace){
  const totals=new Map();
  for(const session of workspace.focusSessions||[]){
    const name=workspace.projects.find(p=>p.id===session.project)?.name||'No project';
    totals.set(name,(totals.get(name)||0)+session.seconds);
  }
  return [...totals];
}
export function clientTimeline(workspace,id){
  const projects=new Set(workspace.projects.filter(p=>p.client===id).map(p=>p.id));
  const rows=(workspace.activity||[]).filter(a=>a.client===id).map(a=>({...a,label:a.action+' '+a.title}));
  for(const p of workspace.projects.filter(p=>p.client===id))for(const [field,label]of [['start','Project starts'],['end','Project ends']])if(p[field])rows.push({id:p.id+field,at:p[field]+'T12:00:00',label:label+' · '+p.name,planned:true});
  for(const t of workspace.tasks.filter(t=>t.client===id||projects.has(t.project)))if(t.due)rows.push({id:t.id+'due',at:t.due+'T12:00:00',label:(t.status==='Done'?'Completed task':'Task deadline')+' · '+t.title,planned:true});
  for(const i of workspace.invoices.filter(i=>i.client===id)){
    rows.push({id:i.id+'issue',at:i.issue+'T12:00:00',label:'Invoice issued · '+i.no,detail:calc(i).total,planned:false});
    for(const p of i.pays)rows.push({id:i.id+p.id,at:p.date+'T12:00:00',label:'Payment recorded · '+i.no,detail:p.amt,planned:false});
  }
  return rows.filter(r=>Number.isFinite(Date.parse(r.at))).sort((a,b)=>Date.parse(b.at)-Date.parse(a.at));
}
