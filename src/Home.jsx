import { useState } from 'react';
import Icon from './Icon';
import Shape from './Shapes.jsx';
import * as L from './lib';
import { recentWork, allWork } from './recents';
import { TASKFLOW_URL } from './taskflow-data';
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

export function Home({ d, open, user, taskflow }) {
  const t = today(), hidden = d.settings.dashboardHidden || [];
  const recents = recentWork(d, { quests: taskflow?.data?.quests || [] });
  const pays = L.allPays(d), month = t.slice(0, 7), last = addDays(t.slice(0, 8) + '01', -1).slice(0, 7);
  const sum = m => pays.filter(p => p.date.slice(0, 7) === m).reduce((s, p) => s + num(p.amt), 0);
  const rev = sum(month), prev = sum(last), change = prev ? Math.round((rev - prev) / prev * 100) : null;
  const months = L.months(addDays(t, -165), t).slice(-6), byMonth = L.revBy(months, pays), max = Math.max(...byMonth.map(x => x.v), 1);
  const overdue = d.invoices.filter(i => status(i) === 'Overdue');
  const dueSoon = d.invoices.filter(i => ['Sent', 'Partially paid'].includes(status(i)) && i.due >= t && i.due <= addDays(t, 3));
  const reminders = (d.notes || []).flatMap(n => (n.checklist || []).filter(c => !c.done && c.due && c.due <= t).map(c => ({ ...c, note: n })));
  const attention = [
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
        <div className="hello"><h1>{greeting()}{name ? ', ' + name : ''}</h1><p>{dueToday.length} task{dueToday.length === 1 ? '' : 's'} due today · {overdue.length} invoice{overdue.length === 1 ? '' : 's'} overdue{reminders.length ? ` · ${reminders.length} reminder${reminders.length === 1 ? '' : 's'}` : ''}.</p></div>
        {!hidden.includes('metrics') && <div>
          <div className="block-head"><h2>Jump back in</h2><a href="#/work">View all work →</a></div>
          {recents.length ? <div className="tile-row">{recents.map((e, i) => <WorkTile key={e.kind + e.row.id} d={d} entry={e} tone={tones[i]} shape={shapes[i]} />)}</div>
            : <div className="tile sand"><span className="tile-title">Your recent work shows up here</span><span className="tile-meta">Add a client or project and edit it — the three most recent stay at the top.</span><button className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={() => open('client')}>Add a client</button></div>}
        </div>}
        {!hidden.includes('overview') && <div className="tile-row overview-row">
          <a className="tile sage" href="#/reports" style={{ minHeight: 230 }}>
            <Shape kind="triangle" color="var(--sage-deep)" size={150} style={{ position: 'absolute', right: -36, bottom: -34, transform: 'rotate(20deg)' }} />
            <span className="tile-title">Revenue:</span>
            <div className="stat-row"><span><b>{money(rev)}</b><small>This month</small></span>{change !== null && <span><b>{change >= 0 ? '+' : ''}{change}%</b><small>vs last month</small></span>}<span><b>{money(L.outstanding(d))}</b><small>Outstanding</small></span></div>
            <div className="minibars" style={{ height: 96 }} role="img" aria-label="Revenue for the last six months">{byMonth.map((x, i) => <i key={x.k} title={`${x.l}: ${money(x.v)}`} style={{ height: Math.max(6, x.v / max * 92), width: 14 }} className={i === byMonth.length - 1 || x.v ? '' : 'open'} />)}</div>
          </a>
          <div className="tile" style={{ cursor: 'default' }}>
            <div className="block-head" style={{ marginBottom: 4 }}><span className="tile-title">Needs attention:</span><a className="chip ink" href="#/invoices">Invoices</a></div>
            {attention.length ? attention.map(a => <a key={a.key} className="list-row" href={a.href}><span className={'dot-icon ' + a.tone}><Icon name={a.icon} size={18} /></span><span className="grow"><b>{a.title}</b><small>{a.meta}</small></span><span className={'chip ' + a.chipTone}>{a.chip}</span></a>) : <p className="empty-note">Nothing needs you right now. Overdue invoices and dated to-dos appear here.</p>}
          </div>
        </div>}
      </div>
      {!hidden.includes('work') && <aside className="side-col" aria-label="Calendar and today">
        <MiniCalendar d={d} />
        <div style={{ display: 'flex', gap: 8 }}><button className="btn wide-btn" onClick={() => open('task')}>Add task</button><button className="ghost" aria-label="New invoice" onClick={() => open('invoice')}><Icon name="invoices" size={18} /></button></div>
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
