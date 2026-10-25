import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { calendarEvents, calendarIcs } from '../functions/calendar';
import { download, today } from './lib';
import { localDay, monthDays, onDay, matchesCalendarFilters, sortCalendarItems, ZOOMS, zoomRange, shiftZoom, spanLanes, rangeFraction, layoutTimed, addDaysKey, weekStartKey, dateKey } from './calendar-view';
import Icon from './Icon';
import { Select, DateInput } from './Controls';
import { moveCalendarItem } from './calendar-move';
import useCalendarDrag from './useCalendarDrag';
import { TaskflowStatus } from './TaskflowPanel';
import { useViewState } from './ViewState.jsx';
import { taskflowCalendarEvents } from './taskflow-data';
import { CalendarPlanning } from './ProductivityUI.jsx';
import { scheduleTask } from './productivity';

const HOUR = 56;
const ZOOM_LABEL = { year: 'Year', month: 'Month', week: 'Week', day: 'Day' };
// Each client gets a colour from the palette, in a stable order; work without a client uses the card colour.
const CLIENT_TONES = ['var(--hero)', 'var(--sage)', 'var(--sand)', '#A3B8C4', '#D9B8A0', '#B9C7A0'];
const fmt = (day, o) => new Date(day + 'T12:00:00').toLocaleDateString(undefined, o);
const clock = iso => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

export default function Calendar({ d, mut, open, user, taskflow, toast = () => {} }) {
  const [savedDay, setDay] = useViewState('calendar.day', today), [savedZoom, setZoom] = useViewState('calendar.zoom', 'month');
  const day = typeof savedDay === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(savedDay) ? savedDay : today(), zoom = ZOOMS.includes(savedZoom) ? savedZoom : 'month';
  const [client, setClient] = useViewState('calendar.client', ''), [showShared, setShowShared] = useViewState('calendar.shared', true), [completed, setCompleted] = useViewState('calendar.completed', false);
  const [eventId, setEventId] = useState(null), [moveDate, setMoveDate] = useState(''), [moveMessage, setMoveMessage] = useState(''), inspector = useRef(null);
  const t = today();

  const toneOf = useMemo(() => { const order = d.clients.map(c => c.id); return id => id && order.includes(id) ? CLIENT_TONES[order.indexOf(id) % CLIENT_TONES.length] : 'var(--card)'; }, [d.clients]);
  const shared = useMemo(() => showShared ? taskflowCalendarEvents(taskflow.data) : [], [taskflow.data, showShared]);
  const own = useMemo(() => calendarEvents(d, { includeCompleted: completed }), [d, completed]);
  const events = useMemo(() => [...own, ...shared].filter(e => matchesCalendarFilters(e, client, '')).sort((a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id)), [own, shared, client]);
  const range = zoomRange(zoom, day);
  const inRange = useMemo(() => events.filter(e => (e.allDay ? e.end > range.start && e.start < range.end : Date.parse(e.end) > new Date(range.start + 'T00:00:00').getTime() && Date.parse(e.start) < new Date(range.end + 'T00:00:00').getTime())), [events, range.start, range.end]);
  const selected = events.find(e => e.id === eventId);

  const moveItem = (id, from, to) => {
    if (to.includes('|') && (id.startsWith('task-') || id.startsWith('unscheduled-'))) {
      const [date, time] = to.split('|'), taskId = id.replace(/^(task-|unscheduled-)/, '');
      try { mut(n => scheduleTask(n, taskId, date, time, n.tasks.find(x => x.id === taskId)?.durationMinutes || 60)); setMoveMessage(`Scheduled for ${fmt(date, { weekday: 'short', day: 'numeric', month: 'short' })} at ${time}.`); } catch (e) { setMoveMessage(e.message); }
      return;
    }
    to = to.split('|')[0];
    if (from === to && !id.startsWith('unscheduled-')) return;
    try { let changed = false; mut(w => { changed = moveCalendarItem(w, id, from, to); }); if (changed) setMoveMessage('Moved to ' + fmt(to, { day: 'numeric', month: 'long', year: 'numeric' }) + '.'); } catch (e) { setMoveMessage(e.message); }
  };
  const { drag, over, props: dragProps, cellProps } = useCalendarDrag(moveItem);
  const exportEvents = (items, name) => download(name + '.ics', calendarIcs(items, { namespace: user?.uid || 'demo', origin: window.location.origin }), 'text/calendar;charset=utf-8');
  const edit = e => { const record = e.type === 'task' ? d.tasks.find(x => 'task-' + x.id === e.id) : d.projects.find(p => 'project-' + p.id === e.id); if (record) { setEventId(null); open(e.type, record); } };
  const zoomTo = (z, date) => { if (date) setDay(date); setZoom(z); };
  const step = by => setDay(shiftZoom(zoom, day, by));
  const zoomIndex = ZOOMS.indexOf(zoom), zoomArea = useRef(null), lastWheel = useRef(0);
  // Ctrl/⌘ + scroll and trackpad pinch (which browsers report as Ctrl + wheel) zoom the calendar, not the page.
  useEffect(() => {
    const el = zoomArea.current; if (!el) return;
    const wheel = e => { if (!e.ctrlKey && !e.metaKey) return; e.preventDefault(); const now = Date.now(); if (now - lastWheel.current < 350 || Math.abs(e.deltaY) < 2) return; lastWheel.current = now; setZoom(z => { const i = ZOOMS.indexOf(ZOOMS.includes(z) ? z : 'month'); return ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, i + (e.deltaY < 0 ? 1 : -1)))]; }); };
    el.addEventListener('wheel', wheel, { passive: false }); return () => el.removeEventListener('wheel', wheel);
  }, []);
  useEffect(() => { const keys = e => { if (e.target.closest('input,textarea,select,[contenteditable]') || document.querySelector('[role=dialog]')) return; const k = { y: 'year', m: 'month', w: 'week', d: 'day' }[e.key.toLowerCase()]; if (k && !e.metaKey && !e.ctrlKey && !e.altKey) setZoom(k); if (e.key === 't' || e.key === 'T') setDay(today()); if (e.key === 'ArrowLeft' && e.altKey) step(-1); if (e.key === 'ArrowRight' && e.altKey) step(1); }; window.addEventListener('keydown', keys); return () => window.removeEventListener('keydown', keys); });
  useEffect(() => {
    if (!selected) return;
    setMoveDate(localDay(selected.start));
    const previous = document.activeElement; inspector.current?.focus();
    const close = e => { if (e.key === 'Escape') setEventId(null); };
    window.addEventListener('keydown', close); return () => { window.removeEventListener('keydown', close); previous?.focus(); };
  }, [selected?.id, selected?.start]);

  const label = zoom === 'year' ? day.slice(0, 4) : zoom === 'month' ? fmt(day, { month: 'long', year: 'numeric' }) : zoom === 'week' ? `${fmt(range.start, { day: 'numeric', month: 'short' })} – ${fmt(addDaysKey(range.end, -1), { day: 'numeric', month: 'short', year: 'numeric' })}` : fmt(day, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const chipTone = e => e.source === 'taskflow' ? 'shared' : '';
  const chip = (e, date) => <button key={e.id} type="button" className={'cal-chip ' + chipTone(e)} style={{ '--tone': toneOf(e.client?.id) }} {...(e.source !== 'taskflow' ? dragProps(e, date) : {})} onClick={ev => { ev.stopPropagation(); setEventId(e.id); }} title={e.title}>
    {!e.allDay && <span className="cal-time">{clock(e.start)}</span>}<span className="cal-title">{e.title}</span></button>;

  return <section className="calendar-b" aria-label="Calendar" ref={zoomArea}>
    <div className="page-head"><div className="grow"><h1>Calendar</h1><p className="empty-note" style={{ margin: '6px 0 0' }}>Zoom out to see the year, zoom in to plan the day. Keys: Y M W D, T for today.</p></div>
      <button className="ghost" onClick={() => exportEvents(inRange, `solodesk-${zoom}-${range.start}`)}>Export {ZOOM_LABEL[zoom].toLowerCase()} · ICS</button>
      <button className="btn" onClick={() => open('task', { due: zoom === 'day' ? day : undefined })}><Icon name="plus" size={18} />Add task</button></div>

    <div className="cal-toolbar">
      <button className="ghost sm" onClick={() => setDay(t)}>Today</button>
      <div className="cal-step"><button className="icon-x" aria-label={'Previous ' + zoom} onClick={() => step(-1)}><Icon name="left" /></button><button className="icon-x" aria-label={'Next ' + zoom} onClick={() => step(1)}><Icon name="arrow" /></button></div>
      <h2 className="cal-label" aria-live="polite">{label}</h2>
      <div className="cal-zoom" role="group" aria-label="Zoom">
        <button type="button" className="zoom-btn" aria-label="Zoom out" title="Zoom out (Ctrl/⌘ + scroll down, or pinch)" disabled={zoomIndex === 0} onClick={() => setZoom(ZOOMS[zoomIndex - 1])}><Icon name="zoomOut" size={18} /><span>Zoom out</span></button>
        <div className="tabs-pill">{ZOOMS.map(z => <button key={z} type="button" aria-pressed={zoom === z} onClick={() => setZoom(z)}>{ZOOM_LABEL[z]}</button>)}</div>
        <button type="button" className="zoom-btn" aria-label="Zoom in" title="Zoom in (Ctrl/⌘ + scroll up, or pinch)" disabled={zoomIndex === ZOOMS.length - 1} onClick={() => setZoom(ZOOMS[zoomIndex + 1])}><Icon name="zoomIn" size={18} /><span>Zoom in</span></button>
      </div>
      <div className="cal-filters">
        <Select aria-label="Show client" value={client} onChange={e => setClient(e.target.value)}><option value="">All clients</option>{d.clients.filter(c => !c.arch).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
        <label className="cal-check"><input type="checkbox" checked={showShared} onChange={e => setShowShared(e.target.checked)} /> TaskFlow & Google</label>
        <label className="cal-check"><input type="checkbox" checked={completed} onChange={e => setCompleted(e.target.checked)} /> Completed</label>
      </div>
    </div>
    <p className="calendar-move-status" role="status" aria-live="polite">{drag ? `Moving ${drag.title}${over ? ' to ' + over.replace('|', ' at ') : ' — drop on a day or time; Escape cancels'}` : moveMessage}</p>

    <WorkTimeline d={d} zoom={zoom} day={day} toneOf={toneOf} completed={completed} client={client} onOpen={id => setEventId(id)} />

    {zoom === 'year' && <YearView day={day} events={events} onPick={date => zoomTo('day', date)} onMonth={m => zoomTo('month', m + '-01')} t={t} />}
    {zoom === 'month' && <MonthView day={day} events={events} t={t} chip={chip} toneOf={toneOf} cellProps={cellProps} dragProps={dragProps} over={over} onPickDay={date => zoomTo('day', date)} onOpen={setEventId} />}
    {(zoom === 'week' || zoom === 'day') && <div className={zoom === 'day' ? 'day-layout' : ''}>
      <TimeGrid days={zoom === 'week' ? Array.from({ length: 7 }, (_, i) => addDaysKey(range.start, i)) : [day]} events={events} t={t} toneOf={toneOf} dragProps={dragProps} cellProps={cellProps} over={over} onOpen={setEventId} onPickDay={date => zoomTo('day', date)} chip={chip} />
      {zoom === 'day' && <DayPlan d={d} day={day} events={events} toneOf={toneOf} onOpen={setEventId} open={open} />}
    </div>}

    {zoom === 'day' && <CalendarPlanning d={d} mut={mut} day={day} taskflow={taskflow} toast={toast} dragProps={dragProps} events={[...own, ...shared]} />}
    <div className="cal-foot"><TaskflowStatus taskflow={taskflow} /><a className="text-link" href="#/integrations">Google & Apple Calendar setup →</a></div>
    {drag?.x != null && <div className="calendar-drag-preview" aria-hidden="true" style={{ left: Math.min(drag.x + 12, window.innerWidth - 180), top: Math.max(8, drag.y - 48) }}>{drag.title}</div>}
    {selected && createPortal(<section ref={inspector} tabIndex={-1} className="event-inspector card" aria-label="Selected calendar event">
      <div className="section-head"><div><span className="eyebrow">{selected.source === 'taskflow' ? (selected.reminder ? 'FROM TASKFLOW · READ ONLY' : 'GOOGLE CALENDAR VIA TASKFLOW · READ ONLY') : selected.type === 'task' ? 'TASK' : 'PROJECT'}</span><h2>{selected.title}</h2></div><button className="icon-button" aria-label="Close event details" onClick={() => setEventId(null)}><Icon name="close" /></button></div>
      <p>{selected.description}</p>
      <p><b>{selected.allDay ? 'All day' : new Date(selected.start).toLocaleString()}</b>{selected.allDay ? ` · ${selected.start} to ${addDaysKey(selected.end, -1)}` : selected.reminder ? ' · Due time reminder, not a reserved work block' : ` · ${selected.durationMinutes} minutes`} · {selected.availability === 'busy' ? 'Busy' : 'Free'}</p>
      {selected.source !== 'taskflow' && <div className="calendar-move-form"><label>Move to date<DateInput aria-label="Move to date" value={moveDate} onChange={e => setMoveDate(e.target.value)} /></label><button type="button" className="btn" disabled={!moveDate || moveDate === localDay(selected.start)} onClick={() => moveItem(selected.id, localDay(selected.start), moveDate)}>Move {selected.type}</button><p className="form-help">Task times and project lengths stay the same. Moving a timed task also shifts its own deadline. Moving a project shifts its timeline only.</p></div>}
      <div className="export-actions">{selected.source === 'taskflow' ? <a className="btn" href={selected.url} target="_blank" rel="noopener noreferrer">Open in {selected.reminder ? 'TaskFlow' : 'source calendar'} ↗</a> : <><button className="btn" onClick={() => edit(selected)}>Edit {selected.type}</button>{selected.type === 'project' && <a className="ghost" href={'#/projects/' + selected.projectId}>Open project</a>}</>}<button className="ghost" onClick={() => exportEvents([selected], 'solodesk-' + selected.id)}>Export · ICS</button><button className="ghost" onClick={() => { setEventId(null); zoomTo('day', localDay(selected.start) < range.start ? range.start : localDay(selected.start)); }}>Show day</button></div>
      <p className="form-help">{selected.source === 'taskflow' && 'This item is shared live by TaskFlow. Changes must be made in its source app. '}Imported ICS files are separate copies; later edits here won’t update them.</p>
    </section>, document.body)}
  </section>;
}

// "What you're working on": active projects as bars across the visible period, one row per client.
function WorkTimeline({ d, zoom, day, toneOf, completed, client, onOpen }) {
  const range = zoom === 'day' ? zoomRange('week', day) : zoomRange(zoom, day);
  const t = today(), now = rangeFraction(t, addDaysKey(t, 1), range);
  const projects = d.projects.filter(p => !p.arch && (completed || p.status !== 'Complete') && (!client || p.client === client) && (p.start || p.end));
  const rows = [];
  for (const c of [...d.clients.filter(c => !c.arch), { id: '', name: 'No client' }]) {
    const bars = projects.filter(p => (p.client || '') === c.id).map(p => { const s = p.start || p.end, e = addDaysKey(p.end || p.start, 1); return { p, f: rangeFraction(s, e, range) }; }).filter(x => x.f);
    if (bars.length) rows.push({ c, bars });
  }
  const undated = d.projects.filter(p => !p.arch && p.status === 'Active' && !p.start && !p.end).length;
  const ticks = zoom === 'year' ? Array.from({ length: 12 }, (_, i) => ({ key: i, label: new Date(+range.start.slice(0, 4), i, 1).toLocaleDateString(undefined, { month: 'short' }), f: rangeFraction(`${range.start.slice(0, 4)}-${String(i + 1).padStart(2, '0')}-01`, `${range.start.slice(0, 4)}-${String(i + 1).padStart(2, '0')}-02`, range) }))
    : Array.from({ length: (Date.parse(range.end) - Date.parse(range.start)) / 864e5 }, (_, i) => { const k = addDaysKey(range.start, i); return { key: k, label: zoom === 'month' ? (i % 7 === 0 || i === 0 ? String(+k.slice(8)) : '') : fmt(k, { weekday: 'short', day: 'numeric' }), f: rangeFraction(k, addDaysKey(k, 1), range) }; });
  const tasksFor = p => { const all = d.tasks.filter(x => x.project === p.id && !x.arch); return `${all.filter(x => x.status === 'Done').length}/${all.length} tasks`; };
  return <section className="work-timeline card" aria-label="What you are working on">
    <div className="block-head" style={{ margin: 0 }}><h3>What you’re working on</h3><small className="empty-note">{rows.reduce((n, r) => n + r.bars.length, 0)} project{rows.reduce((n, r) => n + r.bars.length, 0) === 1 ? '' : 's'} in this {zoom === 'day' ? 'week' : zoom}{undated ? ` · ${undated} active without dates` : ''}</small></div>
    {rows.length ? <div className="wt-grid">
      <div className="wt-ticks" aria-hidden="true"><span className="wt-name" />{<div className="wt-track">{ticks.map(x => x.label && <span key={x.key} style={{ left: (x.f.left * 100) + '%' }}>{x.label}</span>)}</div>}</div>
      {rows.map(({ c, bars }) => <div className="wt-row" key={c.id || 'none'}>
        <a className="wt-name" href={c.id ? '#/clients/' + c.id : '#/projects'}><i style={{ background: toneOf(c.id) }} />{c.name}</a>
        <div className="wt-track">{now && <span className="wt-now" style={{ left: ((now.left + now.width / 2) * 100) + '%' }} />}{bars.map(({ p, f }, i) => <button key={p.id} type="button" className={'wt-bar' + (f.before ? ' before' : '') + (f.after ? ' after' : '')} style={{ left: (f.left * 100) + '%', width: `max(${f.width * 100}%, 6px)`, top: i * 30, background: toneOf(c.id) }} onClick={() => onOpen('project-' + p.id)} title={`${p.name} · ${p.start || '?'} → ${p.end || '?'} · ${tasksFor(p)}`}><b>{p.name}</b><small>{tasksFor(p)}</small></button>)}<span style={{ display: 'block', height: bars.length * 30 }} /></div>
      </div>)}
    </div> : <p className="empty-note" style={{ margin: 0 }}>No dated projects in this period. Give a project a start and end date to see it here.</p>}
  </section>;
}

function YearView({ day, events, onPick, onMonth, t }) {
  const year = day.slice(0, 4);
  const busy = useMemo(() => { const m = new Map(); for (const e of events) { if (e.type === 'project') continue; const k = localDay(e.start); if (k.startsWith(year)) m.set(k, (m.get(k) || 0) + 1); } return m; }, [events, year]);
  const projectDays = useMemo(() => { const s = new Set(); for (const e of events) if (e.type === 'project') for (let k = e.start; k < e.end && k <= year + '-12-31'; k = addDaysKey(k, 1)) if (k >= year + '-01-01') s.add(k); return s; }, [events, year]);
  return <div className="year-grid">{Array.from({ length: 12 }, (_, i) => { const m = `${year}-${String(i + 1).padStart(2, '0')}`; const days = monthDays(m);
    return <section key={m} className="year-month"><button type="button" className="year-title" onClick={() => onMonth(m)}>{new Date(m + '-15T12:00:00').toLocaleDateString(undefined, { month: 'long' })}</button>
      <div className="mini-cal">{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((x, j) => <span key={j} className="dow">{x}</span>)}{days.map(k => k.slice(0, 7) !== m ? <span key={k} /> : <a key={k} href="#/calendar" onClick={e => { e.preventDefault(); onPick(k); }} className={(k === t ? 'today ' : '') + (busy.get(k) ? 'has ' : '') + (projectDays.has(k) ? 'in-project' : '')} aria-label={fmt(k, { dateStyle: 'full' }) + (busy.get(k) ? `, ${busy.get(k)} items` : '')}>{+k.slice(8)}</a>)}</div>
    </section>; })}</div>;
}

function MonthView({ day, events, t, chip, toneOf, cellProps, dragProps, over, onPickDay, onOpen }) {
  const month = day.slice(0, 7), grid = monthDays(month), weeks = Array.from({ length: 6 }, (_, i) => grid.slice(i * 7, i * 7 + 7));
  return <div className="month-b" role="grid" aria-label={fmt(day, { month: 'long', year: 'numeric' })}>
    <div className="month-b-head" role="row">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(x => <span key={x} role="columnheader">{x}</span>)}</div>
    {weeks.map(week => { const spans = spanLanes(events.filter(e => e.allDay && (e.type === 'project' || addDaysKey(e.start, 1) < e.end)), week); const lanes = Math.min(3, spans.reduce((n, s) => Math.max(n, s.lane + 1), 0));
      return <div className="month-b-week" role="row" key={week[0]} style={{ '--lanes': lanes }}>
        {week.map((k, i) => { const singles = sortCalendarItems(events.filter(e => onDay(e, k) && !(e.allDay && (e.type === 'project' || addDaysKey(e.start, 1) < e.end)))); const hidden = spans.filter(s => s.lane >= 3 && s.col <= i && i < s.col + s.span).length; const shown = singles.slice(0, 3), extra = singles.length - shown.length + hidden;
          return <div key={k} role="gridcell" className={'month-b-cell' + (k.slice(0, 7) !== month ? ' outside' : '') + (over === k ? ' drop-target' : '')} style={{ gridColumn: i + 1 }} {...cellProps(k)}>
            <button type="button" className={'month-b-num' + (k === t ? ' today' : '')} onClick={() => onPickDay(k)} aria-label={fmt(k, { dateStyle: 'full' }) + ', open day'}>{+k.slice(8)}{k.slice(8) === '01' ? ' ' + fmt(k, { month: 'short' }) : ''}</button>
            <div className="month-b-items" style={{ marginTop: lanes * 24 }}>{shown.map(e => chip(e, k))}{extra > 0 && <button type="button" className="more-events" onClick={() => onPickDay(k)}>+{extra} more</button>}</div>
          </div>; })}
        {spans.filter(s => s.lane < 3).map(s => <button key={s.event.id + week[0]} type="button" className={'month-b-span' + (s.before ? ' before' : '') + (s.after ? ' after' : '') + (s.event.source === 'taskflow' ? ' shared' : '')} style={{ gridColumn: `${s.col + 1} / span ${s.span}`, top: 34 + s.lane * 24, background: s.event.source === 'taskflow' ? 'var(--sf)' : toneOf(s.event.client?.id) }} {...(s.event.source !== 'taskflow' ? dragProps(s.event, week[s.col]) : {})} onClick={() => onOpen(s.event.id)} title={s.event.title}>{s.event.title}</button>)}
      </div>; })}
  </div>;
}

function TimeGrid({ days, events, t, toneOf, dragProps, cellProps, over, onOpen, onPickDay, chip }) {
  const scroll = useRef(null), [, tick] = useState(0);
  useEffect(() => { if (scroll.current) scroll.current.scrollTop = 7 * HOUR; const timer = setInterval(() => tick(x => x + 1), 60000); return () => clearInterval(timer); }, [days[0]]);
  const now = new Date(), nowTop = (now.getHours() * 60 + now.getMinutes()) / 60 * HOUR;
  const allDay = spanLanes(events.filter(e => e.allDay), days), lanes = allDay.reduce((n, s) => Math.max(n, s.lane + 1), 0);
  const cols = `56px repeat(${days.length}, minmax(0,1fr))`;
  return <div className={'timegrid card' + (days.length === 1 ? ' single' : '')}>
    <div className="tg-head" style={{ gridTemplateColumns: cols }}><span />{days.map(k => <button key={k} type="button" className={'tg-day' + (k === t ? ' today' : '')} onClick={() => onPickDay(k)} aria-label={'Open ' + fmt(k, { dateStyle: 'full' })}><small>{fmt(k, { weekday: 'short' })}</small><b>{+k.slice(8)}</b></button>)}</div>
    <div className="tg-allday" style={{ gridTemplateColumns: cols, minHeight: Math.max(1, lanes) * 26 + 10 }}><span className="tg-label">All day</span>{days.map((k, i) => <div key={k} className={'tg-allday-cell' + (over === k ? ' drop-target' : '')} style={{ gridColumn: i + 2, gridRow: 1 }} {...cellProps(k)} />)}
      {allDay.map(s => <button key={s.event.id} type="button" className={'month-b-span' + (s.before ? ' before' : '') + (s.after ? ' after' : '') + (s.event.source === 'taskflow' ? ' shared' : '')} style={{ gridColumn: `${s.col + 2} / span ${s.span}`, gridRow: 1, marginTop: 4 + s.lane * 26, background: s.event.source === 'taskflow' ? 'var(--sf)' : toneOf(s.event.client?.id) }} {...(s.event.source !== 'taskflow' ? dragProps(s.event, days[s.col]) : {})} onClick={() => onOpen(s.event.id)}>{s.event.type === 'task' ? 'Due · ' : ''}{s.event.title}</button>)}</div>
    <div className="tg-scroll" ref={scroll}><div className="tg-body" style={{ gridTemplateColumns: cols, height: 24 * HOUR }}>
      <div className="tg-hours">{Array.from({ length: 24 }, (_, h) => <span key={h} style={{ top: h * HOUR }}>{h ? new Date(2000, 0, 1, h).toLocaleTimeString(undefined, { hour: 'numeric' }) : ''}</span>)}</div>
      {days.map(k => <div key={k} className="tg-col">
        {Array.from({ length: 24 }, (_, h) => { const slot = k + '|' + String(h).padStart(2, '0') + ':00'; return <div key={h} className={'tg-slot' + (over === slot ? ' drop-target' : '')} style={{ top: h * HOUR, height: HOUR }} {...cellProps(slot)} aria-label={fmt(k, { weekday: 'short', day: 'numeric' }) + ' ' + h + ':00'} />; })}
        {layoutTimed(events, k).map(r => <button key={r.event.id} type="button" className={'tg-event' + (r.event.source === 'taskflow' ? ' shared' : '') + (r.height < 40 ? ' short' : '')} style={{ top: r.top / 60 * HOUR, height: Math.max(22, r.height / 60 * HOUR - 2), left: `calc(${r.col / r.cols * 100}% + 2px)`, width: `calc(${100 / r.cols}% - 4px)`, '--tone': toneOf(r.event.client?.id) }} {...(r.event.source !== 'taskflow' ? dragProps(r.event, k) : {})} onClick={() => onOpen(r.event.id)}>
          <b>{r.event.title}</b><small>{clock(r.event.start)}{r.event.reminder ? '' : ' – ' + clock(r.event.end)}{r.event.client ? ' · ' + r.event.client.name : ''}</small></button>)}
        {k === t && <span className="tg-now" style={{ top: nowTop }} aria-hidden="true" />}
      </div>)}
    </div></div>
  </div>;
}

// The zoomed-in day, explained: what is due, what is scheduled, which projects are running.
function DayPlan({ d, day, events, toneOf, onOpen, open }) {
  const items = sortCalendarItems(events.filter(e => onDay(e, day)));
  const scheduled = items.filter(e => !e.allDay && !e.reminder), due = items.filter(e => (e.allDay || e.reminder) && e.type !== 'project'), running = items.filter(e => e.type === 'project');
  const minutes = scheduled.filter(e => e.source !== 'taskflow').reduce((n, e) => n + (e.durationMinutes || 0), 0);
  const row = (e, meta) => <button key={e.id} type="button" className="list-row" style={{ width: '100%', border: 0, textAlign: 'left', font: 'inherit', cursor: 'pointer' }} onClick={() => onOpen(e.id)}><span className="dot-icon" style={{ background: e.source === 'taskflow' ? 'var(--card)' : toneOf(e.client?.id) }}><Icon name={e.type === 'project' ? 'projects' : e.source === 'taskflow' ? 'link' : 'tasks'} size={16} /></span><span className="grow"><b>{e.title}</b><small>{meta}</small></span></button>;
  const progress = e => { const p = d.projects.find(x => 'project-' + x.id === e.id); const all = p ? d.tasks.filter(x => x.project === p.id && !x.arch) : []; return `${e.client?.name || 'No client'} · ${all.filter(x => x.status === 'Done').length}/${all.length} tasks · until ${fmt(addDaysKey(e.end, -1), { day: 'numeric', month: 'short' })}`; };
  return <aside className="day-plan" aria-label="Day plan">
    <div className="side-card hero"><h3>{fmt(day, { weekday: 'long' })}</h3><div className="stat-row"><span><b>{scheduled.length}</b><small>Scheduled</small></span><span><b>{Math.round(minutes / 6) / 10}h</b><small>Booked</small></span><span><b>{due.length}</b><small>Due</small></span></div></div>
    <div className="card"><h3 style={{ marginTop: 0 }}>Due today</h3>{due.length ? due.map(e => row(e, e.source === 'taskflow' ? 'TaskFlow · read only' : [e.client?.name, e.projectName, e.priority && e.priority + ' priority'].filter(Boolean).join(' · ') || 'Deadline')) : <p className="empty-note">Nothing due.</p>}</div>
    <div className="card"><h3 style={{ marginTop: 0 }}>Scheduled</h3>{scheduled.length ? scheduled.map(e => row(e, `${clock(e.start)} – ${clock(e.end)}${e.client ? ' · ' + e.client.name : ''}`)) : <p className="empty-note">No time blocks yet. Drag a task onto the timeline, or use the free-time suggestions below.</p>}</div>
    <div className="card"><h3 style={{ marginTop: 0 }}>Projects running</h3>{running.length ? running.map(e => row(e, progress(e))) : <p className="empty-note">No project timelines cover this day.</p>}</div>
    <button className="btn wide-btn" onClick={() => open('task', { due: day })}>Add task for this day</button>
  </aside>;
}
