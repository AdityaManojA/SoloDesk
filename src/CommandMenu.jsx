import {useEffect,useMemo,useState} from 'react';
import {createPortal} from 'react-dom';
import Icon from './Icon';
import {SmartField,taskChips} from './SmartField.jsx';
import {parseTask} from './smart-parse';
import {rid} from './lib';

// Quick add, from anywhere: Ctrl/⌘ K is search, Ctrl/⌘ J (or the bolt) opens one line to add a task.
// "Call Ava tomorrow 7pm for Website" fills the date, time, client and project; Enter adds it.
// With the line empty, it also lists quick actions (create a client, open the calendar, undo…).
export function CommandMenu({d,mut,open,Modal,undo,undoCount,toast}){
  const [visible,setVisible]=useState(false),[query,setQuery]=useState('');
  useEffect(()=>{const key=e=>{const k=e.key.toLowerCase(),typing=/^(input|textarea|select)$/i.test(e.target.tagName)||e.target.isContentEditable;if(((e.ctrlKey||e.metaKey)&&(k==='j'||(e.shiftKey&&k==='p')))||(k==='n'&&!typing&&!e.ctrlKey&&!e.metaKey&&!e.altKey)){e.preventDefault();if(!document.querySelector('[role=dialog]'))setVisible(v=>!v);}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[]);
  const parsed=useMemo(()=>query.trim()?parseTask(query,d):null,[query,d]);
  const close=()=>{setVisible(false);setQuery('');};
  const add=()=>{
    if(!parsed?.title)return;
    const id=rid(),task={id,title:parsed.title.slice(0,300),status:'Todo',priority:parsed.priority||'',repeat:parsed.repeat||'',due:parsed.due||'',client:parsed.client||'',project:parsed.project||'',scheduledAt:parsed.time&&parsed.due?new Date(parsed.due+'T'+parsed.time).toISOString():'',durationMinutes:60,createdAt:new Date().toISOString(),...(parsed.repeat==='custom'?{repeatDays:parsed.repeatDays}:{}),...(parsed.repeat?{repeatAnchor:Number((parsed.due||new Date().toISOString().slice(0,10)).slice(-2))}:{})};
    mut(n=>{n.tasks.push(task);});
    toast?.(`Added “${task.title}”.`);close();
  };
  const commands=[...(undoCount?[{title:'Undo last change',run:undo}]:[]),...['client','project','task','invoice','note'].map(k=>({title:'New '+k,run:()=>k==='note'?(location.hash='#/notes/new'):open(k)})),...[['calendar','Calendar'],['approvals','Approvals'],['planner','Daily planner'],['reports','Reports'],['focus','Focus timer'],['templates','Project templates'],['backups','Backup & restore'],['trash','Trash'],['settings','Settings']].map(([k,l])=>({title:'Open '+l,run:()=>{location.hash='#/'+k;}}))];
  const shown=query.trim()?commands.filter(c=>c.title.toLowerCase().includes(query.trim().toLowerCase())).slice(0,4):commands;
  return <><button type="button" className="icon-button command-trigger" aria-label="Quick add" onClick={()=>setVisible(true)} title="Quick add a task · N or Ctrl/⌘ J"><Icon name="bolt" size={18}/></button>{visible&&createPortal(<Modal title="Quick add" label="Add task" onClose={close} onSubmit={add}>
    <div className="quick-add">
      <SmartField label="New task" autoFocus placeholder="Call Ava tomorrow 7pm for Website…" value={query} onChange={setQuery} workspace={d} chips={parsed?taskChips(parsed,d):[]} hint="Type a task with a day, time, client or project. Enter adds it · Tab picks a suggestion · press N (or Ctrl/⌘ J) anywhere to open this."/>
      {shown.length>0&&<div className="quick-actions"><small className="eyebrow">{query.trim()?'OR':'QUICK ACTIONS'}</small>{shown.map(c=><button type="button" className="quick-action" key={c.title} onClick={()=>{close();c.run();}}>{c.title}</button>)}</div>}
    </div>
  </Modal>,document.body)}</>;
}
