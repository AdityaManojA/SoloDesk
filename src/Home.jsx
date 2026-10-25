import { useEffect, useRef, useState } from 'react';
import Icon from './Icon';
import Shape from './Shapes.jsx';
import * as L from './lib';
import { recentWork, allWork } from './recents';
import { TASKFLOW_URL } from './taskflow-data';
import { NoteEditor, noteMode } from './NotesKeep.jsx';
const { today, addDays, money, calc, status, num } = L;

const tones = ['sand', 'hero', 'sage'];
const shapes = [['cross', 'var(--sand-deep)', { right: -18, top: -14, transform: 'rotate(-18deg)' }], ['heart', 'var(--hero-deep)', { right: -24, bottom: -18, transform: 'rotate(-12deg)' }], ['star', 'var(--sage-deep)', { right: -26, bottom: -26 }]];
const time = value => { const t = typeof value === 'number' ? value : Date.parse(value || ''); return Number.isFinite(t) ? t : 0; };
export function ago(at, now = Date.now()) {
  if (!at) return 'Earlier';
  const minutes = Math.round((now - at) / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return minutes + ' min ago';
  if (minutes < 24 * 60) return Math.round(minutes / 60) + ' h ago';
  if (minutes < 48 * 60) return 'Yesterday';
  return new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
const firstName = user => (user?.displayName || '').trim().split(/\s+/)[0];
const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; };
const openTodos = (d, clientId) => (d.notes || []).filter(n => n.client === clientId).reduce((n, note) => n + (note.checklist || []).filter(c => !c.done).length, 0);

function MiniBars({ done, total }) {
  const count = Math.min(Math.max(total, 1), 9), solid = total ? Math.round(done / total * count) : 0;
  return <div className="minibars" aria-hidden="true">{Array.from({ length: count }, (_, i) => <i key={i} className={i < solid ? '' : 'open'} style={{ height: 12 + ((i * 7) % 22) }} />)}</div>;
}

export function WorkTile({ d, entry, tone, shape }) {
  const { kind, row, at } = entry;
  const top = <div className="tile-top"><span>{kind === 'quest' ? 'TaskFlow quest' : kind[0].toUpperCase() + kind.slice(1)}</span><span className="chip white">{ago(at)}</span></div>;
  const deco = shape && <Shape kind={shape[0]} color={shape[1]} size={120} style={{ position: 'absolute', ...shape[2] }} />;
  if (kind === 'client') {
    const projects = d.projects.filter(p => p.client === row.id).length, todos = openTodos(d, row.id);
    return <a className={'tile ' + tone} href={'#/clients/' + row.id}>{deco}{top}<span className="tile-title">{row.name}</span><span className="tile-meta">{todos ? `${todos} open to-do${todos === 1 ? '' : 's'}` : 'No open to-dos'} · {projects} project{projects === 1 ? '' : 's'}</span></a>;
  }
  if (kind === 'project' || kind === 'task') {
    const project = kind === 'project' ? row : d.projects.find(p => p.id === row.project);
    const tasks = project ? d.tasks.filter(t => t.project === project.id) : [], done = tasks.filter(t => t.status === 'Done').length;
    const href = kind === 'project' ? '#/projects/' + row.id : '#/tasks/' + row.id;
    return <a className={'tile ' + tone} href={href}>{deco}{top}<span className="tile-title">{row.name || row.title}</span><span className="tile-meta">{L.cname(d, row.client) || 'No client'}{kind === 'project' ? ` · ${done} of ${tasks.length} tasks complete` : ''}</span>{kind === 'project' && <MiniBars done={done} total={tasks.length} />}</a>;
  }
  const left = (row.subtasks || []).filter(s => !s.done).length;
  return <a className={'tile ' + tone} href={TASKFLOW_URL} target="_blank" rel="noopener noreferrer">{deco}{top}<span className="tile-title">{row.title}</span><span className="tile-meta">{row.due ? 'Due ' + new Date(row.due + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }) : 'No due date'}{left ? ` · ${left} subtask${left === 1 ? '' : 's'} left` : ''}</span><span className="chip white" style={{ alignSelf: 'flex-start', marginTop: 'auto' }}>Open in TaskFlow ↗</span></a>;
}

// An editable "Jump back in" card: clicking edits the item right here instead of leaving Home.
function EditTile({ d, entry, tone, shape, open, mut, onNote }) {
  const { kind, row, at } = entry;
  const stop = e => e.stopPropagation();
  const deco = shape && <Shape kind={shape[0]} color={shape[1]} size={120} style={{ position: 'absolute', ...shape[2] }} />;
  const label = { note: 'Note', task: 'Task', project: 'Project', client: 'Client' }[kind];
  // Notes open in place under the cards; tasks, projects and clients open their own page.
  const act = () => kind === 'note' ? onNote(row.id) : (window.location.hash = '#/' + { task: 'tasks', project: 'projects', client: 'clients' }[kind] + '/' + row.id);
  const top = <div className="tile-top"><span>{label}</span><span className="chip white">Edited {ago(at).toLowerCase()}</span></div>;
  let body;
  if (kind === 'note') {
    const items = (row.checklist || []).filter(c => !c.done);
    body = <><span className="tile-title">{row.title || (row.body || '').split('\n')[0].slice(0, 60) || 'Untitled note'}</span>
      {noteMode(row) === 'checklist' ? <div className="tile-checks">{items.slice(0, 3).map(c => <span key={c.id} className="tile-check"><button type="button" className="check-box" role="checkbox" aria-checked="false" aria-label={'Tick ' + c.title} onClick={e => { stop(e); mut(w => { const x = w.notes.find(n => n.id === row.id)?.checklist.find(y => y.id === c.id); if (x) x.done = true; }); }} /><span>{c.title}</span></span>)}{items.length > 3 && <small>+{items.length - 3} more</small>}{!items.length && <small>All ticked</small>}</div>
        : <span className="tile-meta tile-snippet">{row.title ? (row.body || '').slice(0, 140) : (row.body || '').split('\n').slice(1).join(' ').slice(0, 140)}</span>}
      {(row.client || row.project) && <span className="tile-meta">{[L.cname(d, row.client), d.projects.find(p => p.id === row.project)?.name].filter(x => x && x !== '—').join(' · ')}</span>}</>;
  } else if (kind === 'task') {
    const done = row.status === 'Done';
    body = <><span className="tile-task"><button type="button" className="check-box" role="checkbox" aria-checked={done} aria-label={(done ? 'Mark not done: ' : 'Mark done: ') + row.title} onClick={e => { stop(e); mut(w => { const t = w.tasks.find(x => x.id === row.id); t.status = t.status === 'Done' ? 'Todo' : 'Done'; }); }}>{done && <Icon name="check" size={14} />}</button><span className="tile-title" style={done ? { textDecoration: 'line-through' } : null}>{row.title}</span></span>
      <span className="tile-meta">{[L.cname(d, row.client) !== '—' && L.cname(d, row.client), row.due && 'Due ' + new Date(row.due + 'T12:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' }), row.priority && row.priority + ' priority'].filter(Boolean).join(' · ') || 'No client or date yet'}</span></>;
  } else if (kind === 'project') {
    const tasks = d.tasks.filter(t => t.project === row.id && !t.arch), done = tasks.filter(t => t.status === 'Done').length;
    body = <><span className="tile-title">{row.name}</span><span className="tile-meta">{row.client ? L.cname(d, row.client) : 'No client'} · {done} of {tasks.length} tasks complete</span><MiniBars done={done} total={tasks.length} /></>;
  } else {
    const projects = d.projects.filter(p => p.client === row.id).length, todos = openTodos(d, row.id);
    body = <><span className="tile-title">{row.name}</span><span className="tile-meta">{todos ? `${todos} open to-do${todos === 1 ? '' : 's'}` : 'No open to-dos'} · {projects} project{projects === 1 ? '' : 's'}</span></>;
  }
  return <div className={'tile edit-tile ' + tone} role="button" tabIndex={0} aria-label={'Open ' + label.toLowerCase() + ' ' + (row.title || row.name || '')} onClick={act} onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); act(); } }}>{deco}{top}{body}</div>;
}

// TaskFlow quests are a small pill on Home, opening a compact list. TaskFlow stays the place to edit them.
function TaskflowPill({ taskflow }) {
  const [show, setShow] = useState(false), ref = useRef(null);
  const quests = taskflow?.status === 'ready' ? taskflow.data.quests : [];
  useEffect(() => { if (!show) return; const close = e => { if (!ref.current?.contains(e.target)) setShow(false); }; const key = e => { if (e.key === 'Escape') setShow(false); }; document.addEventListener('pointerdown', close); document.addEventListener('keydown', key); return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', key); }; }, [show]);
  if (!quests.length) return null;
  const sorted = [...quests].sort((a, b) => (a.due || '9').localeCompare(b.due || '9'));
  return <span className="tf-pill-wrap" ref={ref}>
    <button type="button" className="tf-pill" aria-expanded={show} onClick={() => setShow(!show)} title="TaskFlow quests"><i aria-hidden="true" />TaskFlow · {quests.length}</button>
    {show && <span className="tf-pop" role="dialog" aria-label="TaskFlow quests">{sorted.slice(0, 8).map(q => <span key={q.id} className="tf-row"><span>{q.title}</span><small>{q.due ? new Date(q.due + 'T12:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : ''}</small></span>)}{quests.length > 8 && <small>+{quests.length - 8} more</small>}<a className="text-link" href={TASKFLOW_URL} target="_blank" rel="noopener noreferrer">Open TaskFlow ↗</a></span>}
  </span>;
}

function MiniCalendar({ d }) {
  const t = today(), [month, setMonth] = useState(t.slice(0, 7));
  const first = new Date(month + '-01T12:00:00'), lead = (first.getDay() + 6) % 7, days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const busy = new Set(d.tasks.flatMap(k => [k.due, k.scheduledAt ? new Date(k.scheduledAt).toLocaleDateString('en-CA') : null]).filter(Boolean));
  const shift = n => { const m = new Date(first); m.setMonth(m.getMonth() + n); setMonth(m.toLocaleDateString('en-CA').slice(0, 7)); };
  return <div>
    <div className="cal-head"><button type="button" className="icon-x" aria-label="Previous month" onClick={() => shift(-1)}><Icon name="left" /></button><span className="chip hero">{first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</span><button type="button" className="icon-x" aria-label="Next month" onClick={() => shift(1)}><Icon name="arrow" /></button></div>
    <div className="mini-cal" style={{ marginTop: 12 }}>
      {['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'].map(x => <span key={x} className="dow">{x}</span>)}
      {Array.from({ length: lead }, (_, i) => <span key={'b' + i} />)}
      {Array.from({ length: days }, (_, i) => { const key = month + '-' + String(i + 1).padStart(2, '0'); return <a key={key} href="#/calendar" className={(key === t ? 'today ' : '') + (busy.has(key) ? 'has' : '')} aria-label={new Date(key + 'T12:00:00').toLocaleDateString(undefined, { dateStyle: 'full' }) + (busy.has(key) ? ', has work' : '')}>{i + 1}</a>; })}
    </div>
  </div>;
}

export function Home({ d, open, user, taskflow, mut, toast }) {
  const [noteId, setNoteId] = useState(null), note = (d.notes || []).find(n => n.id === noteId);
  const t = today(), hidden = d.settings.dashboardHidden || [];
  const recents = recentWork(d);
  const overdue = d.invoices.filter(i => status(i) === 'Overdue');
  const dueSoon = d.invoices.filter(i => ['Sent', 'Partially paid'].includes(status(i)) && i.due >= t && i.due <= addDays(t, 3));
  const reminders = (d.notes || []).flatMap(n => (n.checklist || []).filter(c => !c.done && c.due && c.due <= t).map(c => ({ ...c, note: n })));
  const changes = [...d.tasks, ...(d.docs || []), ...d.invoices].filter(x => x.approval?.state === 'changes' && !x.arch);
  const attention = [
    ...changes.map(x => ({ key: 'ap-' + x.id, href: '#/approvals', icon: 'approve', tone: 'sand', title: x.title || x.no, meta: x.approval.comment ? '“' + x.approval.comment + '”' : 'Client asked for changes', chip: 'Changes', chipTone: 'sand' })),
    ...overdue.map(i => ({ key: i.id, href: '#/invoices/' + i.id, icon: 'invoices', tone: 'hero', title: `${i.no} · ${L.cname(d, i.client)}`, meta: `${money(calc(i).bal)} overdue`, chip: `${Math.max(1, Math.round((Date.parse(t) - Date.parse(i.due)) / 864e5))} days`, chipTone: 'hero' })),
    ...reminders.map(r => ({ key: r.id, href: r.note.client ? '#/clients/' + r.note.client : '#/notes', icon: 'notes', tone: 'sand', title: r.title, meta: r.note.title, chip: r.due === t ? 'Today' : 'Overdue', chipTone: 'sand' })),
    ...dueSoon.map(i => ({ key: i.id, href: '#/invoices/' + i.id, icon: 'invoices', tone: 'sage', title: `${i.no} · ${L.cname(d, i.client)}`, meta: `${money(calc(i).bal)} due soon`, chip: new Date(i.due + 'T12:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' }), chipTone: 'sage' })),
  ].slice(0, 4);
  const dueToday = d.tasks.filter(k => k.status !== 'Done' && !k.arch && (k.due === t || (k.scheduledAt && new Date(k.scheduledAt).toLocaleDateString('en-CA') === t)));
  const timeline = [...dueToday].sort((a, b) => (a.scheduledAt || '9').localeCompare(b.scheduledAt || '9')).slice(0, 5);
  const name = firstName(user);
  return <section className="home">
    <div className="home-grid">
      <div className="home-main">
        <div className="hello"><h1>{greeting()}{name ? ', ' + name : ''}</h1><p>{dueToday.length} task{dueToday.length === 1 ? '' : 's'} due today · {overdue.length} invoice{overdue.length === 1 ? '' : 's'} overdue{reminders.length ? ` · ${reminders.length} reminder${reminders.length === 1 ? '' : 's'}` : ''}. <TaskflowPill taskflow={taskflow} /></p></div>
        {!hidden.includes('metrics') && <div>
          <div className="block-head"><h2>Jump back in</h2><a href="#/work">View all work →</a></div>
          {recents.length ? <div className="tile-row">{recents.map((e, i) => <EditTile key={e.kind + e.row.id} d={d} entry={e} tone={tones[i]} shape={shapes[i]} open={open} mut={mut} onNote={id => setNoteId(noteId === id ? null : id)} />)}</div>
            : <div className="tile sand"><span className="tile-title">Your recent work shows up here</span><span className="tile-meta">Notes, tasks, projects and clients you edit show up here, newest first.</span><button className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={() => open('client')}>Add a client</button></div>}
          {note && <div className="card home-note-editor"><NoteEditor key={note.id} note={note} autoFocus edit={fn => mut(w => { const n = (w.notes || []).find(x => x.id === note.id); if (n) fn(n); })} labels={<a className="keep-tool" href={'#/notes/' + note.id}>Open in Notes</a>} /><button type="button" className="ghost sm" style={{ alignSelf: 'flex-end' }} onClick={() => setNoteId(null)}>Done</button></div>}
        </div>}
        {!hidden.includes('overview') && <div className="overview-row single">
          <div className="tile" style={{ cursor: 'default' }}>
            <div className="block-head" style={{ marginBottom: 4 }}><span className="tile-title">Needs attention:</span><a className="chip ink" href="#/invoices">Invoices</a></div>
            {attention.length ? attention.map(a => <a key={a.key} className="list-row" href={a.href}><span className={'dot-icon ' + a.tone}><Icon name={a.icon} size={18} /></span><span className="grow"><b>{a.title}</b><small>{a.meta}</small></span><span className={'chip ' + a.chipTone}>{a.chip}</span></a>) : <p className="empty-note">Nothing needs you right now. Overdue invoices and dated to-dos appear here.</p>}
          </div>
        </div>}
      </div>
      {!hidden.includes('work') && <aside className="side-col" aria-label="Calendar and today">
        <MiniCalendar d={d} />
        <div style={{ display: 'flex', gap: 8 }}><button className="btn wide-btn" onClick={() => open('task')}>Add task</button><button className="ghost" aria-label="New invoice" onClick={() => open('invoice')}><Icon name="invoices" size={18} /></button></div>
        <a className="keep-composer-bar home-note" href="#/notes/new"><Icon name="notes" size={18} /><span>Take a note…</span></a>
        <div className="block-head" style={{ margin: 0 }}><h3>Today</h3><span className="chip ink">{dueToday.length}</span></div>
        <div className="timeline">{timeline.length ? timeline.map(k => <div className="timeline-item" key={k.id}><time>{k.scheduledAt ? new Date(k.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'All day'}</time><a className="list-row" href={'#/tasks/' + k.id}><span className={'dot-icon ' + (k.priority === 'High' ? 'hero' : k.priority === 'Medium' ? 'sand' : 'sage')}><Icon name="tasks" size={16} /></span><span className="grow"><b>{k.title}</b><small>{L.cname(d, k.client) || 'No client'}{k.durationMinutes && k.scheduledAt ? ' · ' + k.durationMinutes + ' min' : ''}</small></span></a></div>) : <p className="empty-note">A clear day. Scheduled and due tasks show up here.</p>}</div>
        <a className="btn wide-btn" href="#/calendar">View full calendar</a>
      </aside>}
    </div>
  </section>;
}

export function AllWork({ d }) {
  const [tab, setTab] = useState('all');
  const work = allWork(d);
  const client = e => { const billed = d.invoices.filter(i => i.client === e.row.id && i.state !== 'void').reduce((s, i) => s + calc(i).total, 0), todos = openTodos(d, e.row.id), projects = d.projects.filter(p => p.client === e.row.id).length;
    return <a key={e.row.id} className="tile" href={'#/clients/' + e.row.id}><div className="tile-top"><span className="avatar-xl" style={{ width: 40, height: 40, fontSize: 15 }}>{(e.row.name || '?').slice(0, 2).toUpperCase()}</span><span className="chip white">{ago(e.at)}</span></div><span className="tile-title">{e.row.name}</span><span className="tile-meta">{projects} project{projects === 1 ? '' : 's'} · {money(billed)} billed</span><span className="chip white" style={{ alignSelf: 'flex-start' }}>{todos ? `${todos} open to-do${todos === 1 ? '' : 's'}` : 'All clear'}</span></a>; };
  const done = e => <a key={e.kind + e.row.id} className="tile sage" href={e.kind === 'project' ? '#/projects/' + e.row.id : '#/tasks/' + e.row.id}><div className="tile-top"><span className="chip white">Completed</span><span>{ago(e.at)}</span></div><span className="tile-title">{e.row.name || e.row.title}</span><span className="tile-meta">{L.cname(d, e.row.client) || 'No client'} · {e.kind === 'project' ? 'Project' : 'Task'}</span></a>;
  const rows = [
    ['projects', 'Projects', 'Most recently edited first', work.projects, e => <WorkTile key={e.row.id} d={d} entry={e} tone={['sand', 'hero', 'sage'][e.index % 3]} />],
    ['clients', 'Clients', 'Including edits to their notes and checklists', work.clients, client],
    ['completed', 'Completed work', 'Finished projects and tasks', work.completed, done],
  ];
  return <section>
    <div className="page-head"><div className="grow"><h1>All work</h1><p className="empty-note" style={{ margin: '6px 0 0' }}>Everything in your workspace, most recently edited first. Only you can see this.</p></div><a className="btn" href="#/projects">Projects list</a></div>
    <div className="tabs-pill" role="group" aria-label="Filter work">{[['all', 'All'], ['projects', `Projects ${work.projects.length}`], ['clients', `Clients ${work.clients.length}`], ['completed', `Completed ${work.completed.length}`]].map(([k, l]) => <button key={k} type="button" aria-pressed={tab === k} onClick={() => setTab(k)}>{l}</button>)}</div>
    {rows.filter(([k]) => tab === 'all' || tab === k).map(([k, title, sub, list, render]) => <div key={k} style={{ marginTop: 26 }}>
      <div className="block-head"><div><h2>{title}</h2><small className="empty-note">{sub}</small></div></div>
      {list.length ? <div className="card-row">{list.map(render)}</div> : <p className="empty-note">Nothing here yet.</p>}
    </div>)}
  </section>;
}
