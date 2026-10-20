import { useEffect, useState, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { calendarEvents, calendarIcs } from '../functions/calendar';
import { download, today, addDays } from './lib';
import { localDay, monthDays, onDay, shiftMonth, matchesCalendarFilters, sortCalendarItems, groupCalendarAgenda } from './calendar-view';
import Icon from './Icon';
import { Select, DateInput } from './Controls';
import { moveCalendarItem } from './calendar-move';
import useCalendarDrag from './useCalendarDrag';
import {TaskflowStatus} from './TaskflowPanel';
import {PlanningNav,useViewState} from './ViewState.jsx';
import { taskflowCalendarEvents } from './taskflow-data';
import {CalendarPlanning} from './ProductivityUI.jsx';
import HourCalendar from './HourCalendar.jsx';
import {scheduleTask} from './productivity';

export default function Calendar({ d, mut, open, user, taskflow, toast=()=>{} }) {
  const [month, setMonth] = useViewState('calendar.month',() => today().slice(0, 7)), [day, setDay] = useViewState('calendar.day',today);
  const [client, setClient] = useViewState('calendar.client',''), [type, setType] = useViewState('calendar.type',''), [completed, setCompleted] = useViewState('calendar.completed',false), [view, setView] = useViewState('calendar.view','month');
  const [eventId, setEventId] = useState(null), inspector = useRef(null), dayPanel=useRef(null);
  const [showFilters,setShowFilters]=useViewState('calendar.filters-visible',false);
  const [moveDate, setMoveDate] = useState(''), [moveMessage, setMoveMessage] = useState('');
  const moveItem = (id, from, to) => {
    if(to.includes('|')&&(id.startsWith('task-')||id.startsWith('unscheduled-'))){
      const [date,time]=to.split('|'),taskId=id.replace(/^(task-|unscheduled-)/,'');
      try{mut(n=>scheduleTask(n,taskId,date,time,n.tasks.find(t=>t.id===taskId)?.durationMinutes||60));setDay(date);setMonth(date.slice(0,7));setMoveMessage('Work block moved to '+date+' '+time+'.');}catch(e){setMoveMessage(e.message);}return;
    }
    to=to.split('|')[0];
    if (from === to&&!id.startsWith('unscheduled-')) return;
    try {
      let changed = false;
      mut(workspace => { changed = moveCalendarItem(workspace,id,from,to); });
      if (changed) { setDay(to); setMonth(to.slice(0,7)); setMoveMessage('Moved to ' + new Date(to+'T12:00:00').toLocaleDateString(undefined,{day:'numeric',month:'long',year:'numeric'}) + '.'); }
    } catch (error) { setMoveMessage(error.message); }
  };
  const {drag,over,props:dragProps,cellProps} = useCalendarDrag(moveItem);
  const sharedEvents=useMemo(()=>taskflowCalendarEvents(taskflow.data),[taskflow.data]);
  const planningEvents=useMemo(()=>[...calendarEvents(d),...sharedEvents],[d,sharedEvents]);
  const events=useMemo(()=>(completed?[...calendarEvents(d,{includeCompleted:true}),...sharedEvents]:planningEvents).filter(e=>matchesCalendarFilters(e,client,type)).sort((a,b)=>a.start.localeCompare(b.start)||a.id.localeCompare(b.id)),[d,sharedEvents,planningEvents,completed,client,type]);
  const selected=events.find(e=>e.id===eventId);
  const monthStart=month+'-01',monthEnd=shiftMonth(month,1)+'-01';
  const inMonth=useMemo(()=>events.filter(e=>localDay(e.start)<monthEnd&&(e.allDay?e.end>monthStart:Date.parse(e.end)>new Date(monthStart+'T00:00:00').getTime())),[events,monthStart,monthEnd]);
  const gridDays=useMemo(()=>monthDays(month),[month]);
  const dayItems=useMemo(()=>new Map(gridDays.map(date=>[date,sortCalendarItems(events.filter(e=>onDay(e,date)))])),[events,gridDays]);
  const dayEvents=useMemo(()=>sortCalendarItems(events.filter(e=>onDay(e,day))),[events,day]);
  const agendaGroups=useMemo(()=>groupCalendarAgenda(inMonth,month),[inMonth,month]);
  const daySections=[['Scheduled',dayEvents.filter(e=>!e.allDay&&e.type!=='project')],['Deadlines & all-day',dayEvents.filter(e=>e.allDay&&e.type!=='project')],['Project timelines',dayEvents.filter(e=>e.type==='project')]];
  const weekStart=addDays(day,-((new Date(day+'T12:00:00').getDay()+6)%7));
  const periodEvents=view==='day'?dayEvents:view==='week'?events.filter(e=>Array.from({length:7},(_,i)=>addDays(weekStart,i)).some(date=>onDay(e,date))):inMonth;
  const periodLabel=view==='day'?new Date(day+'T12:00:00').toLocaleDateString(undefined,{weekday:'short',month:'long',day:'numeric'}):view==='week'?'Week of '+new Date(weekStart+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}):new Date(month+'-15T12:00:00').toLocaleDateString(undefined,{month:'long',year:'numeric'});
  const period=view==='agenda'?'month':view;
  const unscheduled = d.tasks.filter(t => t.status !== 'Done' && !t.due && !t.scheduledAt).length;
  const exportEvents = (items, filename) => download(filename + '.ics', calendarIcs(items, { namespace: user?.uid || 'demo', origin: window.location.origin }), 'text/calendar;charset=utf-8');
  const changeMonth = by => { if(view==='week'||view==='day'){const next=addDays(day,by*(view==='week'?7:1));setDay(next);setMonth(next.slice(0,7));return;} const next = shiftMonth(month, by); setMonth(next); setDay(next + '-01'); };
  const edit = event => {
    const record = event.type === 'task' ? d.tasks.find(t => 'task-' + t.id === event.id) : d.projects.find(p => 'project-' + p.id === event.id);
    if (record) { setEventId(null); open(event.type, record); }
  };
  useEffect(() => {
    if (!selected) return;
    setMoveDate(localDay(selected.start));
    const previous = document.activeElement; inspector.current?.focus();
    const close = e => { if (e.key === 'Escape') setEventId(null); };
    window.addEventListener('keydown', close); return () => { window.removeEventListener('keydown', close); previous?.focus(); };
  }, [selected?.id,selected?.start]);
  const selectDate=date=>{setDay(date);if(window.matchMedia('(max-width:768px)').matches)requestAnimationFrame(()=>{dayPanel.current?.focus({preventScroll:true});dayPanel.current?.scrollIntoView({block:'start',behavior:'instant'});});};
  const eventRow = event => <div key={event.id} className="calendar-agenda-row">{event.source !== 'taskflow' && <button type="button" className="calendar-drag-handle" aria-label={'Drag ' + event.title + ' to another date, or open details to move it'} title="Drag to a calendar date" {...dragProps(event,localDay(event.start),true)} onClick={() => setEventId(event.id)}>⠿</button>}<button key={event.id} data-priority={event.priority} className={'calendar-agenda-item event-' + event.type + (event.source === 'taskflow' ? ' taskflow-priority' : '')} onClick={() => setEventId(event.id)}>
    <span className="agenda-time">{event.allDay ? 'All day' : new Date(event.start).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
    <span className="grow"><b>{event.title}</b><small>{event.source === 'taskflow' ? 'From TaskFlow · '+(event.reminder ? 'Quest deadline' : 'Google Calendar') : ([event.client?.name, event.projectName].filter(Boolean).join(' · ') || 'Your workspace')+' · '+(event.type === 'project' ? 'Project timeline' : event.allDay ? 'Deadline' : event.durationMinutes + ' min')}</small></span><Icon name="arrow" size={18} />
  </button></div>;
  return <>
    <PlanningNav current="calendar"/>
    <div className="hd calendar-heading"><h1>Your calendar</h1><div className="end" style={{ margin: 0 }}><button className="btn" onClick={() => open('task', { due: day })}><Icon name="plus" />Add task</button></div></div>
    <div className="calendar-filter-toggle"><button type="button" className="ghost sm" aria-expanded={showFilters} aria-controls="calendar-filters" onClick={()=>setShowFilters(value=>!value)}>Filters{client||type||completed?' · Active':''}</button>{(client||type||completed)&&<button type="button" className="ghost sm" onClick={()=>{setClient('');setType('');setCompleted(false);}}>Clear filters</button>}</div>
    {showFilters&&<div className="calendar-controls" id="calendar-filters"><label>Client<Select value={client} onChange={e => setClient(e.target.value)} aria-label="Calendar client"><option value="">All clients</option>{d.clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></label><label>Show<Select value={type} onChange={e => setType(e.target.value)} aria-label="Calendar event type"><option value="">All calendars & work</option><option value="task">Tasks & quests</option><option value="taskflow">TaskFlow quests & Google events</option><option value="taskflow-event">Google Calendar via TaskFlow</option><option value="project">Projects only</option></Select></label><label className="calendar-completed"><input type="checkbox" checked={completed} onChange={e => setCompleted(e.target.checked)} />Include completed</label></div>}


    <p className="calendar-move-status" role="status" aria-live="polite">{drag ? 'Moving ' + drag.title + (over ? ' to ' + over : ' — drop on a calendar date; Escape cancels') : moveMessage}</p>
    <div className="calendar-workspace" data-view={view}><div className="calendar-primary">
    <section className="calendar-board"><div className="month-toolbar"><div className="month-title"><button className="icon-button" aria-label={'Previous '+period} onClick={() => changeMonth(-1)}>‹</button><div><h2 aria-live="polite">{periodLabel}</h2><span className="period-count">{periodEvents.length} {periodEvents.length===1?'item':'items'} · {period==='month'?'This month':period==='week'?'This week':'This day'}</span></div><button className="icon-button" aria-label={'Next '+period} onClick={() => changeMonth(1)}>›</button></div><div className="month-actions"><button className="ghost sm" onClick={() => { setMonth(today().slice(0, 7)); setDay(today()); }}>Today</button><div className="view-switch" aria-label="Calendar view"><button aria-pressed={view === 'month'} onClick={() => setView('month')}>Month</button><button aria-pressed={view === 'week'} onClick={() => setView('week')}>Week</button><button aria-pressed={view === 'day'} onClick={() => setView('day')}>Day</button><button aria-pressed={view === 'agenda'} onClick={() => setView('agenda')}>Agenda</button></div><button className="ghost sm" onClick={() => exportEvents(periodEvents, 'solodesk-' + period + '-' + (period==='month'?month:day))}>Export {period}</button></div></div>
      {view === 'month' ? <><div className="weekdays" aria-hidden="true">{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(x => <span key={x}>{x}</span>)}</div><div className="month-grid" role="group" aria-label={month + ' calendar'}>{gridDays.map(date => {
        const items = dayItems.get(date);
        return <div {...cellProps(date)} className={'month-cell' + (over === date ? ' drop-target' : '') + (date.slice(0, 7) !== month ? ' outside-month' : '') + (date === day ? ' selected-day' : '')} key={date}>
          <button className={'day-number' + (date === today() ? ' is-today' : '')} aria-label={new Date(date + 'T12:00:00').toLocaleDateString(undefined, { day:'numeric',month:'long',year:'numeric' }) + ', ' + items.length + ' events'} aria-pressed={date === day} onClick={() => selectDate(date)}>{Number(date.slice(-2))}</button>
          <span className="month-item-count" aria-hidden="true">{items.length?items.length+(items.length===1?' item':' items'):''}</span><div className="month-event-dots" aria-hidden="true">{items.slice(0,4).map(event=><i key={event.id} className={'event-'+event.type}/>)}</div>{items.slice(0, 3).map(event => <button key={event.id} data-priority={event.priority} className={'month-chip event-' + event.type + (event.source === 'taskflow' ? ' taskflow-priority' : '') + (event.source !== 'taskflow' ? ' can-drag' : '')} {...dragProps(event,date)} title={event.title + (event.source !== 'taskflow' ? ' · Drag to reschedule' : ' · Read only')} onClick={() => { setDay(date); setEventId(event.id); }}>{event.type === 'taskflow-event' ? 'Google · ' : event.source === 'taskflow' ? 'TF · ' : ''}{event.allDay ? '' : new Date(event.start).toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'}) + ' '}{event.title}</button>)}
          {items.length > 3 && <button className="more-events" onClick={() => { setDay(date); }} aria-label={'Show all '+items.length+' items on '+date}>+{items.length - 3} more</button>}
        </div>;
      })}</div></> : ['week','day'].includes(view)?<HourCalendar events={events} day={day} view={view} setDay={date=>{setDay(date);setMonth(date.slice(0,7));}} mut={mut} d={d} showNavigation={false} dragProps={dragProps} cellProps={cellProps} onEvent={setEventId} toast={toast}/> : <div className="month-agenda">{agendaGroups.length ? agendaGroups.map(group => <section className="agenda-date-group" key={group.date}><h3>{new Date(group.date+'T12:00:00').toLocaleDateString(undefined,{weekday:'long',month:'short',day:'numeric'})}<span>{group.events.length} {group.events.length===1?'item':'items'}</span></h3>{group.events.map(eventRow)}</section>) : <div className="empty"><p>No dated work in this month.</p></div>}</div>}
    </section>
    <div className="calendar-legend"><span><i className="event-project" />Projects</span><span><i className="event-task" />Tasks & deadlines</span><span><i className="event-taskflow-quest" />TaskFlow quests</span><span><i className="event-taskflow-event" />Google Calendar via TaskFlow</span></div>
    </div><aside className="calendar-day-panel" aria-label="Selected day schedule" ref={dayPanel} tabIndex={-1}><section className="day-agenda"><div className="section-head"><h2>{new Date(day + 'T12:00:00').toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'})}</h2><span className="b">{dayEvents.length} events</span></div>{dayEvents.length ? daySections.filter(([,items])=>items.length).map(([title,items])=><section className="day-event-section" key={title}><h3>{title}<span>{items.length}</span></h3>{items.map(eventRow)}</section>) : <div className="empty"><p>A little breathing room. No work scheduled for this day.</p><button className="btn" onClick={() => open('task',{due:day})}>Plan a task</button></div>}</section>
    </aside></div><TaskflowStatus taskflow={taskflow}/><details className="calendar-help"><summary>Moving items & calendar sources</summary><div><p>{unscheduled ? `${unscheduled} open tasks have no date yet. ` : ''}Project spans and deadlines leave your availability free; timed tasks reserve busy time. SoloDesk items can be edited here; TaskFlow items are read-only. Click an event for details or to export it. Client filters show linked SoloDesk records; choose All clients to include TaskFlow.</p><a href="#/integrations">Google & Apple Calendar setup <Icon name="arrow" size={16} /></a></div></details>
    <CalendarPlanning d={d} mut={mut} day={day} taskflow={taskflow} toast={toast} dragProps={dragProps} events={planningEvents}/>
    {drag?.x != null && <div className="calendar-drag-preview" aria-hidden="true" style={{left:Math.min(drag.x+12,window.innerWidth-180),top:Math.max(8,drag.y-48)}}>{drag.title}</div>}
    {selected && createPortal(<section ref={inspector} tabIndex={-1} className="event-inspector card" aria-label="Selected calendar event"><div className="section-head"><div><span className="eyebrow">{selected.source === 'taskflow' ? (selected.reminder ? 'FROM TASKFLOW · READ ONLY' : 'GOOGLE CALENDAR VIA TASKFLOW · READ ONLY') : selected.type === 'task' ? 'TASK' : 'PROJECT'}</span><h2>{selected.title}</h2></div><button className="icon-button" aria-label="Close event details" onClick={() => setEventId(null)}><Icon name="close" /></button></div><p>{selected.description}</p><p><b>{selected.allDay ? 'All day' : new Date(selected.start).toLocaleString()}</b>{selected.allDay ? ` · ${selected.start} to ${new Date(Date.parse(selected.end) - 86400000).toISOString().slice(0,10)}` : selected.reminder ? ' · Due time reminder, not a reserved work block' : ` · ${selected.durationMinutes} minutes`} · {selected.availability === 'busy' ? 'Busy' : 'Free'}</p>{selected.source !== 'taskflow' && <div className="calendar-move-form"><label>Move to date<DateInput aria-label="Move to date" value={moveDate} onChange={e=>setMoveDate(e.target.value)} /></label><button type="button" className="btn" disabled={!moveDate || moveDate===localDay(selected.start)} onClick={()=>moveItem(selected.id,localDay(selected.start),moveDate)}>Move {selected.type}</button><p className="form-help">Task times and project lengths stay the same. Moving a timed task also shifts its own deadline. Moving a project shifts its timeline only.</p></div>}<div className="export-actions"><>{selected.source === 'taskflow' ? <a className="btn" href={selected.url} target="_blank" rel="noopener noreferrer">Open in {selected.reminder ? 'TaskFlow' : 'source calendar'} ↗</a> : <button className="btn" onClick={() => edit(selected)}>Edit {selected.type}</button>}</><button className="ghost" onClick={() => exportEvents([selected], 'solodesk-' + selected.id)}>Export this event · ICS</button></div><p className="form-help">{selected.source === 'taskflow' && 'This item is shared live by TaskFlow. Changes must be made in its source app. Exporting makes a separate copy. '}For Google Calendar, import this file in Settings → Import & export. For Apple Calendar on Mac, use File → Import. This makes a separate copy; future edits here won’t update the imported event.</p></section>,document.body)}
  </>;
}
