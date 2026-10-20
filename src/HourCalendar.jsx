import {useEffect,useRef,useState} from 'react';
import {addDays} from './lib';
import {onDay,localDay} from './calendar-view';
import {scheduleTask} from './productivity';
import {useScrollMemory} from './ViewState.jsx';

export default function HourCalendar({events,day,view,setDay,mut,d,dragProps,cellProps,onEvent,toast,showNavigation=true}){
  const scroll=useRef(null),resize=useRef(null),[resizing,setResizing]=useState(null);
  const weekday=(new Date(day+'T12:00:00').getDay()+6)%7,first=view==='week'?addDays(day,-weekday):day;
  const days=Array.from({length:view==='week'?7:1},(_,i)=>addDays(first,i));
  useScrollMemory(scroll,'calendar.hour-scroll',8*62);
  useEffect(()=>{
    const move=e=>{if(resize.current&&e.pointerId===resize.current.pointerId){e.preventDefault();const r=resize.current;setResizing({id:r.id,minutes:Math.max(5,Math.min(1440,Math.round((r.minutes+(e.clientY-r.y)/62*60)/15)*15))});}};
    const end=e=>{const r=resize.current;if(!r||e.pointerId!==r.pointerId)return;resize.current=null;setResizing(null);if(e.type==='pointercancel')return;const minutes=Math.max(5,Math.min(1440,Math.round((r.minutes+(e.clientY-r.y)/62*60)/15)*15));mut(n=>{const t=n.tasks.find(t=>'task-'+t.id===r.id);if(t)t.durationMinutes=minutes;});toast('Work duration updated.');};
    const cancel=e=>{if(e.key==='Escape'){resize.current=null;setResizing(null);}};
    document.addEventListener('pointermove',move,{passive:false});document.addEventListener('pointerup',end);document.addEventListener('pointercancel',end);document.addEventListener('keydown',cancel);
    return()=>{document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',end);document.removeEventListener('pointercancel',end);document.removeEventListener('keydown',cancel);};
  },[mut]);
  return <>{showNavigation&&<div className="week-controls"><button className="ghost sm" onClick={()=>setDay(addDays(day,view==='week'?-7:-1))}>Previous {view}</button><strong>{days[0]}{view==='week'?' — '+days.at(-1):''}</strong><button className="ghost sm" onClick={()=>setDay(addDays(day,view==='week'?7:1))}>Next {view}</button></div>}<p className="mu">Drag a task’s ⠿ handle to an hourly cell. Drag its bottom edge to resize (15-minute steps). Open details for exact start times and keyboard-friendly editing. Shared events are read-only.</p><div className="timeline-scroll" ref={scroll}><div className={'hour-grid '+(view==='day'?'day-only':'')}><div className="hour-head">Time</div>{days.map(date=><div className="hour-head" key={date}>{new Date(date+'T12:00:00').toLocaleDateString(undefined,{weekday:'short',day:'numeric',month:'short'})}</div>)}<div className="hour-label">All day</div>{days.map(date=><div className="hour-all-day" key={date} {...cellProps(date)}>{events.filter(e=>e.allDay&&onDay(e,date)).map(e=><button className="ghost sm" key={e.id} {...dragProps(e,date)} onClick={()=>onEvent(e.id)}>{e.title}</button>)}</div>)}{Array.from({length:24},(_,hour)=><HourRow key={hour} hour={hour} days={days} events={events} dragProps={dragProps} cellProps={cellProps} onEvent={onEvent} resizing={resizing} resize={resize}/>)}</div></div></>;
}
function HourRow({hour,days,events,dragProps,cellProps,onEvent,resizing,resize}){
  const time=String(hour).padStart(2,'0')+':00';
  return <><div className="hour-label">{time}</div>{days.map(date=>{
    const items=events.filter(e=>!e.allDay&&onDay(e,date)&&(localDay(e.start)<date?hour===0:new Date(e.start).getHours()===hour));
    return <div className="hour-slot" key={date} {...cellProps(date+'|'+time)} aria-label={date+' '+time}>{items.map((e,index)=>{
      const start=Math.max(Date.parse(e.start),Date.parse(date+'T00:00:00')),end=Math.min(Date.parse(e.end),Date.parse(addDays(date,1)+'T00:00:00')),duration=resizing?.id===e.id?resizing.minutes:(end-start)/60000;
      return <div className="timed-work" key={e.id} style={{position:'absolute',top:new Date(start).getMinutes()/60*62,left:(index/items.length*100)+'%',width:(100/items.length)+'%',height:Math.max(36,duration/60*62),zIndex:1}}><button className="ghost sm" style={{touchAction:'none',padding:2}} aria-label={'Move work block '+e.title} {...dragProps(e,date)} onClick={()=>onEvent(e.id)}>⠿ {e.title}</button>{e.source!=='taskflow'&&e.type==='task'&&<button type="button" className="resize-work" aria-label={'Resize '+e.title} onPointerDown={ev=>{ev.preventDefault();ev.stopPropagation();ev.currentTarget.setPointerCapture(ev.pointerId);resize.current={id:e.id,minutes:e.durationMinutes,y:ev.clientY,pointerId:ev.pointerId};}}>↕ {resizing?.id===e.id?resizing.minutes:e.durationMinutes} min</button>}</div>;
    })}</div>;
  })}</>;
}
