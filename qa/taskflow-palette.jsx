import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import TaskflowPanel from '../src/TaskflowPanel';
import Calendar from '../src/Calendar';
import {normalizeTaskflow} from '../src/taskflow-data';
import '../src/styles.css';
import '../src/taskflow.css';
import '../src/dark.css';
import '../src/responsive.css';

const data={quests:['Critical delivery','High priority follow-up','Plan the next milestone','Review project notes','Organise the workspace','An idea for later'].map((title,tier)=>({id:String(tier),title,tier,due:'2026-10-20',time:null,repeat:null,notes:'Palette preview · sample data only',subtasks:[]})),events:[],tz:'Asia/Kolkata'};
data.events=[{id:'google-call',title:'Google · Planning call',tier:2,allDay:false,start:'2026-10-20T10:00:00+05:30',end:'2026-10-20T11:00:00+05:30',where:'Meeting room',url:'https://calendar.google.com/calendar/'} ,{id:'google-trip',title:'Google · Studio visit',allDay:true,start:'2026-10-21',end:'2026-10-23'}];
const feed=normalizeTaskflow(data);
function Preview(){
  const [dark,setDark]=useState(false);
  return <main><h1>TaskFlow shared calendar</h1><p>QA preview · sample cards and Google events · no account or database access</p><button className="ghost" onClick={()=>{document.documentElement.dataset.theme=dark?'light':'dark';setDark(!dark)}}>{dark?'Light':'Dark'} preview</button><TaskflowPanel taskflow={{status:'ready',data:feed}}/><Calendar d={{tasks:[],projects:[],clients:[],invoices:[],settings:{cur:'USD'}}} mut={()=>{}} open={()=>{}} taskflow={{status:'ready',data:feed}}/></main>;
}
createRoot(document.getElementById('root')).render(<Preview/>);
