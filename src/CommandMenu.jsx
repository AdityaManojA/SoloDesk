import {useEffect,useState} from 'react';
import {createPortal} from 'react-dom';
import Icon from './Icon';
export function CommandMenu({open,Modal,undo,undoCount}){
  const [visible,setVisible]=useState(false),[query,setQuery]=useState('');
  useEffect(()=>{const key=e=>{if((e.ctrlKey||e.metaKey)&&e.shiftKey&&e.key.toLowerCase()==='p'){e.preventDefault();if(!document.querySelector('[role=dialog]'))setVisible(v=>!v);}if(e.key==='Escape')setVisible(false);};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[]);
  const commands=[...(undoCount?[{title:'Undo last change',run:undo}]:[]),...['client','project','task','invoice'].map(k=>({title:'Create '+k,run:()=>open(k)})),...['planner','calendar','focus','templates','notes','backups','trash','settings'].map(k=>({title:'Open '+k,run:()=>{location.hash='#/'+k;}}))];
  return <><button type="button" className="icon-button command-trigger" aria-label="Quick actions" onClick={()=>setVisible(true)} title="Quick actions · Ctrl/⌘ Shift P"><Icon name="bolt" size={18}/></button>{visible&&createPortal(<Modal title="What would you like to do?" label="Close" onClose={()=>setVisible(false)} onSubmit={()=>setVisible(false)}><input aria-label="Find command" placeholder="Create a task, open calendar…" value={query} onChange={e=>setQuery(e.target.value)}/>{commands.filter(c=>c.title.includes(query.toLowerCase())).map(c=><button type="button" className="row" style={{width:'100%'}} key={c.title} onClick={()=>{setVisible(false);setQuery('');c.run();}}>{c.title}</button>)}</Modal>,document.body)}</>;
}
