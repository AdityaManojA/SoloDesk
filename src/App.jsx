import { useEffect, useState, useRef, useId } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, reauthenticateWithPopup } from 'firebase/auth';
import { doc, getDoc, setDoc, deleteDoc, runTransaction, collection, getDocs, writeBatch } from 'firebase/firestore';
import { auth, db as fdb, provider, configured, workspaceCollection } from './firebase';
import Icon from './Icon';
import { demoData } from './demo';
import Integrations from './Integrations';
import Calendar from './Calendar';
import LegalPage, { LegalLinks } from './LegalPages';
import { Select, DateInput, FileInput } from './Controls';
import useTaskflow from './useTaskflow';
import TaskflowPanel from './TaskflowPanel';
import { deletionInfo, deleteRecord } from './record-actions';
import BrandLogo from './BrandLogo';
import InstallApp from './InstallApp';
import Experience, { InstallNotice, ReplayIntroduction } from './Experience';
import { wasSeen, rememberSeen, onboardingKey } from './experience-state';
import { createWorkspaceSaves } from './workspace-saves';
import { prepareClient, prepareInvoice, nextInvoiceNumber } from './invoice-input';
import {WorkspaceSearch,Planner,Trash,Timeline,Templates,RecurringInvoices,Focus} from './ProductivityUI.jsx';
import {repeatCompletedTasks,recordActivity,trashRecord,frequencies} from './productivity';
import {assertWorkspaceSize} from './workspace-size';
import {assertUnchanged,validateWorkspace,blockers,validateDependencies,projectBudget} from './workspace-upgrades';
import {Backups,Notes,DashboardOptions,CommandMenu,RecordExtras,ProjectBudgets} from './WorkspaceUpgrades.jsx';
import {PortalManager,ClientPortal} from './ClientPortal.jsx';
import './upgrades.css';
import * as L from './lib';
const { rid, num, today, addDays, calc, status, money, fresh } = L;

const NAV = [['dash', 'Dashboard'], ['clients', 'Clients'], ['projects', 'Projects'], ['tasks', 'Tasks'], ['calendar', 'Calendar'], ['invoices', 'Invoices'], ['reports', 'Reports'], ['integrations', 'Integrations'], ['settings', 'Settings'],['planner','Daily planner'],['templates','Project templates'],['recurring','Recurring drafts'],['focus','Focus timer'],['trash','Trash'],['backups','Backup & restore'],['notes','Notes & checklists']];
const MOB = [['dash', 'Home'], ['tasks', 'Tasks'], ['calendar', 'Calendar'], ['more', 'More']];
const MORE = [['backups','Backup & restore'],['notes','Notes & checklists'],['planner','Daily planner'],['templates','Project templates'],['recurring','Recurring drafts'],['focus','Focus timer'],['trash','Trash'],['clients', 'Clients'], ['projects', 'Projects'], ['invoices', 'Invoices'], ['reports', 'Reports'], ['integrations', 'Integrations'], ['settings', 'Settings']];

/* ---------- routing (hash based, so the browser back button works) ---------- */
const parse = () => { const pathPage = window.location.pathname.replace(/\/$/, '').slice(1); const [p, id] = (window.location.hash.slice(2) || (['privacy', 'cookies'].includes(pathPage) ? pathPage : 'dash')).split('/'); return { page: p || 'dash', id }; };
const localDateTime = iso => { if (!iso || !Number.isFinite(Date.parse(iso))) return ''; const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0,16); };
const nav = (p, id) => { window.location.hash = '#/' + p + (id ? '/' + id : ''); };

/* ---------- logo: shrink the uploaded image so it stays small in the database ---------- */
function logoFile(file) {
  return new Promise((res, rej) => {
    const im = new Image(), u = URL.createObjectURL(file);
    im.onload = () => {
      const k = Math.min(1, 240 / im.width, 240 / im.height), c = document.createElement('canvas');
      c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      URL.revokeObjectURL(u);
      let out = c.toDataURL('image/png');
      if (out.length > 150000) out = c.toDataURL('image/jpeg', 0.8);
      res(out);
    };
    im.onerror = () => { URL.revokeObjectURL(u); rej(new Error('bad image')); };
    im.src = u;
  });
}

/* ---------- small UI pieces ---------- */
const Badge = ({ s }) => <span className={'b b-' + s.replace(' ', '')}>{L.ICON[s]}{s}</span>;
const Empty = ({ m, label, onClick }) => <div className="empty"><p>{m}</p>{label && <button className="btn" onClick={onClick}>{label}</button>}</div>;
const Back = ({ to, label }) => <a className="back" href={'#/' + to}>‹ {label}</a>;
const Fld = ({ l, ...p }) => <label>{l}{['date', 'datetime-local'].includes(p.type) ? <DateInput aria-label={l} {...p} /> : <input {...p} />}</label>;
const Sel = ({ l, o, ...p }) => <label>{l}<Select aria-label={l} {...p}>{o.map((x) => { const [v, t] = Array.isArray(x) ? x : [x, x]; return <option key={v} value={v}>{t}</option>; })}</Select></label>;
function Modal({ title, onClose, onSubmit, onDelete, label = 'Save', danger = false, children }) {
  const ref = useRef(null), titleId = useId();
  useEffect(() => {
    const previous = document.activeElement, oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const dialog = ref.current;
    (dialog.querySelector('input:not([type=hidden]):not(:disabled),select:not(:disabled),textarea:not(:disabled),[role=combobox]') || dialog.querySelector('button') || dialog).focus();
    const keys = (e) => {
      if (e.defaultPrevented) return;
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      if (e.key !== 'Tab') return;
      const roots = [dialog, ...document.querySelectorAll('[data-control-popover]')];
      const els = roots.flatMap(root => [...root.querySelectorAll('button:not(:disabled),input,select,textarea,a[href]')]).filter(x => x.getClientRects().length && x.tabIndex !== -1 && !x.disabled && x.getAttribute('aria-hidden') !== 'true');
      const first = els[0], last = els.at(-1);
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', keys);
    return () => { document.body.style.overflow = oldOverflow; document.removeEventListener('keydown', keys); previous?.focus(); };
  }, []);
  return <div className="ov" onClick={onClose}>
    <form ref={ref} className="dlg" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} onClick={e => e.stopPropagation()} onSubmit={e => { e.preventDefault(); onSubmit(Object.fromEntries(new FormData(e.currentTarget))); }}>
      <div className="dialog-title"><div><span className="eyebrow">YOUR WORKSPACE</span><h2 id={titleId}>{title}</h2></div><button type="button" className="icon-button" aria-label="Close dialog" onClick={onClose}><Icon name="close" /></button></div>
      {children}<div className="end">{onDelete && <button type="button" className="ghost danger modal-delete" onClick={onDelete}>Delete</button>}<button type="button" className="ghost" onClick={onClose}>Cancel</button><button className={danger ? 'btn danger' : 'btn'}>{label}</button></div>
    </form>
  </div>;
}
function Chart({ data }) {
  const mx = Math.max(...data.map(x => x.v), 1), bw = 600 / Math.max(data.length, 1);
  return <svg className="revenue-chart" viewBox="0 0 640 230" role="img" aria-label="Revenue received by month">
    {[0, 1, 2, 3].map(n => <g key={n}><line x1="35" x2="635" y1={20 + n * 55} y2={20 + n * 55} stroke="var(--gridline, var(--ln))" strokeDasharray="3 5" /><text x="28" y={24 + n * 55} textAnchor="end" fill="var(--mu)" fontSize="10">{Math.round(mx * (3 - n) / 3).toLocaleString()}</text></g>)}
    {data.map((x, i) => { const h = x.v / mx * 155, cx = 35 + i * bw + bw / 2; return <g key={x.k}><title>{x.k}: {money(x.v)}</title><rect className="chart-bar" x={cx - Math.min(bw * .25, 23)} y={185 - h} width={Math.min(bw * .5, 46)} height={Math.max(h, 2)} rx="5" fill={i === data.length - 1 ? 'var(--ac)' : 'var(--bar)'} />{i % Math.ceil(data.length / 8) === 0 && <text x={cx} y="212" textAnchor="middle" fontSize="11" fill="var(--mu)">{x.l}</text>}</g>; })}
  </svg>;
}

function Login({ onDemo }) {
  const [e, setE] = useState(''), [busy, setBusy] = useState(false);
  const go = async () => {
    if (!configured) { setE('Google sign-in needs your Firebase configuration. You can explore the local demo below.'); return; }
    setBusy(true);
    try { await signInWithPopup(auth, provider); } catch (x) { setE(x.code === 'auth/popup-closed-by-user' ? '' : 'Sign-in failed. Please try again.'); } finally { setBusy(false); }
  };
  return <><InstallNotice/><div className="login-layout"><section className="login-story"><a className="wordmark" href="#/dash"><BrandLogo /></a><div><span className="eyebrow">A LITTLE STRUCTURE. A LOT OF POSSIBILITY.</span><h1>Independent work.<br /><em>All together.</em></h1><p>A considered space for the business behind your craft. From the first brief to the final invoice.</p><div className="login-tags"><span>Clients & projects</span><span>Tasks & invoices</span><span>One workspace</span></div></div><small>Make room for your best work.</small></section><section className="login-panel"><div className="login"><span className="eyebrow">YOUR NEXT CHAPTER</span><h2>Welcome to your desk.</h2><p className="mu">Less admin. More of what you do best.</p><button className="btn" disabled={busy} onClick={go}>{busy ? 'Connecting…' : 'Continue with Google'}<Icon name="arrow" /></button><div className="login-divider">OR TAKE A LOOK AROUND</div><button className="ghost" onClick={onDemo}>Explore the demo<Icon name="arrow" /></button><p className="login-note">The demo uses sample data stored in this browser. Your real workspace stays separate.</p>{e && <p className="inline-error" role="alert">{e}</p>}<LegalLinks /></div></section></div></>;
}

function Dash({ d, open, mut }) {
  const t = today(), pays = L.allPays(d), ks = L.months(addDays(t, -165), t).slice(-6);
  const rev = pays.filter(p => p.date.slice(0, 7) === t.slice(0, 7)).reduce((s, p) => s + num(p.amt), 0);
  const tasks = d.tasks.filter(k => k.status !== 'Done').sort((a,b) => (a.due || '9').localeCompare(b.due || '9'));
  const att = d.invoices.filter(i => status(i) === 'Overdue');
  const active = d.projects.filter(p => p.status === 'Active');
  return <section className="dashboard-custom" data-hide-metrics={d.settings.dashboardHidden?.includes('metrics')} data-hide-overview={d.settings.dashboardHidden?.includes('overview')} data-hide-work={d.settings.dashboardHidden?.includes('work')}>
    <div className="page-intro"><div><span className="eyebrow">A CLEAR VIEW OF YOUR BUSINESS</span><h1>Your work, in perspective<span className="accent-dot">.</span></h1><p>Here’s what’s happening at your desk.</p></div><button className="btn" onClick={() => open('new')}><Icon name="plus" />Create new</button></div>
    <div className="cards metrics">
      {[[money(rev), 'Revenue this month', 'From recorded payments', 'reports'], [money(L.outstanding(d)), 'Outstanding balance', `${att.length} overdue ${att.length === 1 ? 'invoice' : 'invoices'}`, 'invoices'], [String(active.length).padStart(2,'0'), 'Active projects', `${d.clients.filter(c => !c.arch).length} clients in your workspace`, 'projects'], [String(tasks.filter(k => k.due && k.due >= t && k.due <= addDays(t,7)).length).padStart(2,'0'), 'Due this week', `${tasks.length} open tasks in total`, 'tasks']].map(([value,label,note,to]) => <a href={'#/' + to} className="metric" key={label}><div className="metric-label">{label}<Icon name="arrow" size={16} /></div><strong>{value}</strong><small>{note}</small></a>)}
    </div>
    <div className="dashboard-grid"><section className="card revenue-panel"><div className="section-head"><div><span className="eyebrow">THE BIGGER PICTURE</span><h3>Revenue overview</h3></div><span className="period">Last 6 months</span></div><Chart data={L.revBy(ks, pays)} /><div className="chart-foot"><span><i /> Payments received</span><a href="#/reports">View reports <Icon name="arrow" size={15} /></a></div></section>
      <section className="attention-panel"><span className="eyebrow">KEEP THINGS MOVING</span><h3>A little attention</h3>{att.length ? <><span className="attention-number">{String(att.length).padStart(2, '0')}</span><p>{att.length === 1 ? 'Invoice is' : 'Invoices are'} past due.<br />A follow-up could make a difference.</p>{att.slice(0,2).map(i => <a className="attention-invoice" href={'#/invoices/' + i.id} key={i.id}><div><b>{L.cname(d,i.client)}</b><small>{i.no} · {money(calc(i).bal)}</small></div><Icon name="arrow" /></a>)}</> : <><span className="attention-number"><Icon name="check" size={52} /></span><p>Nothing overdue.<br />You’re all caught up.</p><a className="attention-invoice" href="#/invoices">Review invoices<Icon name="arrow" /></a></>}</section></div>
    <div className="dashboard-grid lower-grid"><section><div className="section-head"><h3>On your radar <span className="count">{tasks.length}</span></h3><a href="#/tasks">All tasks <Icon name="arrow" size={15} /></a></div>{tasks.length ? tasks.slice(0,4).map(k => <div className="row task-row" data-priority={k.priority || 'None'} key={k.id}><button className="task-check" aria-label={'Complete ' + k.title} onClick={() => toggleTask(mut,k.id)} /><a className="grow" href={'#/tasks/' + k.id}><b>{k.title}</b><small>{L.cname(d,k.client)}{k.due ? ' · ' + (k.due === t ? 'Today' : k.due) : ''}</small></a>{k.priority && <span className={'priority priority-' + k.priority}>{k.priority}</span>}</div>) : <Empty m="A clear desk. Add a task when you’re ready." label="Add task" onClick={() => open('task')} />}</section>
      <section><div className="section-head"><h3>Active projects</h3><a href="#/projects">View all <Icon name="arrow" size={15} /></a></div>{active.length ? active.slice(0,3).map(p => { const all = d.tasks.filter(k => k.project === p.id), done = all.filter(k => k.status === 'Done').length; return <button key={p.id} className="project-preview" onClick={() => open('project',p)}><div className="project-preview-title"><span>{p.name}</span><Icon name="arrow" size={16} /></div><small>{L.cname(d,p.client)} · {done}/{all.length} tasks complete</small><div className="progress-track"><span style={{ width: (all.length ? done/all.length*100 : 0) + '%' }} /></div></button>; }) : <Empty m="Your next project starts here." label="Add project" onClick={() => open('project')} />}</section></div>
  </section>;
}

/* ---------- clients ---------- */
function Clients({ d, open }) {
  const [q, setQ] = useState(''), [arch, setArch] = useState(false);
  const a = d.clients.filter((c) => (arch || !c.arch) && ((c.name || '') + (c.email || '')).toLowerCase().includes(q.toLowerCase()));
  return (<>
    <div className="hd"><h1>Clients <span className="heading-count">{d.clients.filter(c => !c.arch).length}</span></h1><button className="btn" onClick={() => open('client')}>Add client</button></div>
    <div className="list-toolbar"><div className="search-field"><Icon name="search" size={17} /><input placeholder="Find a name or email…" aria-label="Search clients" value={q} onChange={(e) => setQ(e.target.value)} /></div><span className="mu">{a.length} {a.length === 1 ? 'client' : 'clients'}</span></div>
    <label><input type="checkbox" style={{ width: 'auto' }} checked={arch} onChange={(e) => setArch(e.target.checked)} /> Show archived</label>
    {a.length ? a.map((c) => (
      <a className="row" key={c.id} href={'#/clients/' + c.id}>
        <span className="client-avatar">{c.name.slice(0,1)}</span><div className="grow"><b>{c.name} {c.arch && <span className="b">Archived</span>}</b><small>{c.email || c.phone || 'No contact details yet'}</small></div><span className="client-project-count">{d.projects.filter(p => p.client === c.id).length} projects</span><Icon name="arrow" size={17} />
      </a>
    )) : <Empty m={d.clients.length ? 'No clients match.' : 'No clients yet. Add your first client to get started.'} label={d.clients.length ? '' : 'Add client'} onClick={() => open('client')} />}
  </>);
}

function ClientPage({ d, mut, open, id, removeItem, user, demo, toast }) {
  const c = d.clients.find((x) => x.id === id);
  if (!c) return <><Back to="clients" label="Clients" /><Empty m="This client could not be found." /></>;
  const info = [['Email', c.email], ['Phone', c.phone], ['Address', c.address], ['Notes', c.notes]].filter(([, v]) => v);
  return (<>
    <Back to="clients" label="Clients" />
    <div className="hd"><h1>{c.name} {c.arch && <span className="b">Archived</span>}</h1>
      <div className="end" style={{ margin: 0 }}>
        <button className="ghost sm" onClick={() => open('client', c)}>Edit</button>
        <button className="ghost sm" onClick={() => mut((n) => { const x = n.clients.find((y) => y.id === id); x.arch = !x.arch; })}>{c.arch ? 'Restore' : 'Archive'}</button>
        <button className="ghost danger sm" onClick={() => removeItem('clients',id)}>Delete client</button>
      </div></div>
    <div className="card">{info.length ? info.map(([k, v]) => <p key={k} style={{ margin: '4px 0', whiteSpace: 'pre-line' }}><small>{k}</small><br />{v}</p>) : <p className="mu">No contact details yet.</p>}</div>
    <Timeline d={d} client={id}/>
    <PortalManager d={d} user={user} demo={demo} client={c} toast={toast}/>
    <div className="hd" style={{ marginTop: 16 }}><h3 style={{ margin: 0 }}>Projects</h3><button className="ghost sm" onClick={() => open('project', { client: id })}>+ Project</button></div>
    {d.projects.filter((p) => p.client === id).map((p) => <button type="button" className="row project-row" key={p.id} onClick={() => open('project', p)}><b>{p.name}</b><span className="b">{p.status}</span></button>)}
    {!d.projects.some((p) => p.client === id) && <p className="mu">No projects yet.</p>}
    <div className="hd" style={{ marginTop: 16 }}><h3 style={{ margin: 0 }}>Tasks</h3><button className="ghost sm" onClick={() => open('task', { client: id })}>+ Task</button></div>
    {d.tasks.filter((k) => k.client === id).map((k) => <a className="row" key={k.id} href={'#/tasks/' + k.id}><div><b>{k.title}</b><small>{k.status}{blockers(d,k).length?' · Blocked':''}{k.due ? ` · due ${k.due}` : ''}</small></div><span aria-hidden="true">›</span></a>)}
    {!d.tasks.some((k) => k.client === id) && <p className="mu">No tasks yet.</p>}
    <div className="hd" style={{ marginTop: 16 }}><h3 style={{ margin: 0 }}>Invoices</h3><button className="ghost sm" onClick={() => open('invoice', { client: id })}>+ Invoice</button></div>
    {d.invoices.filter((i) => i.client === id).map((i) => <a className="row" key={i.id} href={'#/invoices/' + i.id}><div><b>{i.no}</b><small>Total {money(calc(i).total)} · Balance {money(calc(i).bal)}</small></div><Badge s={status(i)} /></a>)}
    {!d.invoices.some((i) => i.client === id) && <p className="mu">No invoices yet.</p>}
  </>);
}

/* ---------- projects ---------- */
function Projects({ d, mut, open, removeItem }) {
  const [query, setQuery] = useState(''), [filter, setFilter] = useState(''),[archived,setArchived]=useState(false);
  const projects = d.projects.filter(p => (archived || !p.arch) && (!filter || p.status === filter) && (p.name + ' ' + L.cname(d,p.client)).toLowerCase().includes(query.toLowerCase()));
  return <>
    <div className="hd"><h1>Projects <span className="heading-count">{d.projects.length}</span></h1><button className="btn" onClick={() => open('project')}><Icon name="plus" size={17} />Add project</button></div>
    <div className="list-toolbar"><div className="search-field"><Icon name="search" size={17} /><input aria-label="Search projects" placeholder="Find a project or client…" value={query} onChange={e => setQuery(e.target.value)} /></div><Select aria-label="Filter projects by status" value={filter} onChange={e => setFilter(e.target.value)}><option value="">All statuses</option>{['Active','On hold','Complete'].map(x => <option key={x}>{x}</option>)}</Select></div>
    <label className="archive-toggle"><input type="checkbox" checked={archived} onChange={e=>setArchived(e.target.checked)}/>Show archived projects</label><ProjectBudgets d={d}/><div className="project-grid">{projects.map(p => { const tasks = d.tasks.filter(t => t.project === p.id), done = tasks.filter(t => t.status === 'Done').length; return <article className="project-card" key={p.id}><button type="button" className="project-open" onClick={() => open('project',p)}><div className="project-card-top"><Icon name="projects" size={23} /><span className="b">{p.status}</span></div><small>{L.cname(d,p.client)}</small><h3>{p.name}</h3><div className="project-card-bottom"><span>{done} of {tasks.length} tasks complete</span><Icon name="arrow" size={16} /></div><div className="progress-track"><span style={{width: (tasks.length ? done/tasks.length*100 : 0) + '%'}} /></div></button><button className="ghost sm" onClick={()=>mut(n=>{const row=n.projects.find(x=>x.id===p.id);row.arch=!row.arch;})}>{p.arch?'Unarchive':'Archive'}</button><button type="button" className="ghost danger sm project-delete" aria-label={'Delete project '+p.name} onClick={() => removeItem('projects',p.id)}>Delete project</button></article>; })}</div>
    {!projects.length && <Empty m={d.projects.length ? 'No projects match your search.' : 'No projects yet. Link your first project to a client.'} label={d.projects.length ? '' : 'Add project'} onClick={() => open('project')} />}
  </>;
}

/* ---------- tasks ---------- */
const toggleTask = (mut, id) => mut((n) => { const x = n.tasks.find((y) => y.id === id); x.status = x.status === 'Done' ? 'Todo' : 'Done'; });

function Tasks({ d, mut, open, taskflow, removeItem }) {
  const [f, setF] = useState({ status: '', due: '', client: '', project: '' }),[archived,setArchived]=useState(false), t = today();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const a = d.tasks.filter((k) => (archived || !k.arch) && (!f.status || k.status === f.status) && (!f.client || k.client === f.client) && (!f.project || k.project === f.project)
    && (!f.due || (f.due === 'none' ? !k.due : f.due === 'over' ? k.due && k.due < t && k.status !== 'Done' : k.due && k.due >= t && k.due <= addDays(t, 7))))
    .sort((x, y) => (x.status === 'Done') - (y.status === 'Done') || (x.due || '9').localeCompare(y.due || '9'));
  return (<>
    <div className="hd"><h1>Tasks <span className="heading-count">{d.tasks.filter(k => k.status !== 'Done').length} open</span></h1><button className="btn" onClick={() => open('task')}>Add task</button></div>
    <label className="archive-toggle"><input type="checkbox" checked={archived} onChange={e=>setArchived(e.target.checked)}/>Show archived tasks</label><details className="filter-panel"><summary>Filter your tasks <span className="filter-summary">{a.length} results</span></summary><div className="grid2" style={{ marginTop: 8 }}>
      <Sel l="Status" o={[['', 'All'], 'Todo', 'In progress', 'Done']} value={f.status} onChange={set('status')} />
      <Sel l="Due" o={[['', 'Any'], ['week', 'Next 7 days'], ['over', 'Overdue'], ['none', 'No due date']]} value={f.due} onChange={set('due')} />
      <Sel l="Client" o={[['', 'All'], ...d.clients.map((c) => [c.id, c.name])]} value={f.client} onChange={set('client')} />
      <Sel l="Project" o={[['', 'All'], ...d.projects.map((p) => [p.id, p.name])]} value={f.project} onChange={set('project')} />
    </div></details>
    {a.length ? a.map((k) => (
      <div className="row task-row" data-priority={k.priority || 'None'} key={k.id}>
        <button className="chk" aria-pressed={k.status === 'Done'} aria-label={k.status === 'Done' ? 'Mark not done' : 'Mark complete'} onClick={() => toggleTask(mut, k.id)}>{k.status === 'Done' ? '☑' : '☐'}</button>
        <a className="grow" href={'#/tasks/' + k.id}><b style={{ textDecoration: k.status === 'Done' ? 'line-through' : 'none' }}>{k.title}</b>
          <small>{k.status}{k.due ? ` · due ${k.due}` : ''}{k.priority ? ` · ${k.priority} priority` : ''}</small></a>
        <button className="ghost sm" onClick={()=>mut(n=>{const row=n.tasks.find(x=>x.id===k.id);row.arch=!row.arch;})}>{k.arch?'Unarchive':'Archive'}</button><button type="button" className="ghost danger sm" aria-label={'Delete task '+k.title} onClick={() => removeItem('tasks',k.id)}>Delete</button>
      </div>)) : <Empty m={d.tasks.length ? 'No tasks match these filters.' : 'No tasks yet. Add one to see what is due.'} label={d.tasks.length ? '' : 'Add task'} onClick={() => open('task')} />}
    <TaskflowPanel taskflow={taskflow} />
  </>);
}

function TaskPage({ d, mut, open, ask, id, removeItem, toast }) {
  const k = d.tasks.find((x) => x.id === id);
  if (!k) return <><Back to="tasks" label="Tasks" /><Empty m="This task could not be found." /></>;
  const rows = [['Status', k.status], ['Due date', k.due || 'No due date'], ['Priority', k.priority || 'None'], ['Repeats', k.repeat||'Does not repeat'], ['Scheduled', k.scheduledAt ? new Date(k.scheduledAt).toLocaleString() + ' · ' + (k.durationMinutes || 60) + ' minutes' : 'Not scheduled']];
  return (<>
    <Back to="tasks" label="Tasks" />
    <div className="hd"><h1>{k.title}</h1>
      <div className="end" style={{ margin: 0 }}>
        <button className="ghost sm" onClick={() => open('task', k)}>Edit</button>
        <button className="ghost danger sm" onClick={() => removeItem('tasks',id)}>Delete task</button>
      </div></div>
    <div className="card">
      {rows.map(([a, b]) => <p key={a} style={{ margin: '4px 0' }}><small>{a}</small><br />{b}</p>)}
      {k.client && <p style={{ margin: '4px 0' }}><small>Client</small><br /><a href={'#/clients/' + k.client} style={{ fontWeight: 700 }}>{L.cname(d, k.client)}</a></p>}
      {k.project && <p style={{ margin: '4px 0' }}><small>Project</small><br />{d.projects.find((p) => p.id === k.project)?.name || '—'}</p>}
    </div>
    <Focus d={d} mut={mut} toast={toast} taskId={id}/>
    <RecordExtras d={d} mut={mut} task={k} toast={toast}/>
    <p><button className="btn" onClick={() => toggleTask(mut, id)}>{k.status === 'Done' ? 'Mark not done' : 'Mark complete'}</button></p>
  </>);
}

/* ---------- invoices ---------- */
function Invoices({ d, open }) {
  const [fs, setFs] = useState('');
  const a = d.invoices.filter((i) => !fs || status(i) === fs).sort((x, y) => y.no.localeCompare(x.no));
  return (<>
    <div className="hd"><h1>Invoices <span className="heading-count">{d.invoices.length}</span></h1><button className="btn" onClick={() => open('invoice')}>Create invoice</button></div>
    <div className="invoice-summary"><div><small>Awaiting payment</small><strong>{money(L.outstanding(d))}</strong></div><div><small>Overdue</small><strong>{money(d.invoices.filter(i => status(i) === 'Overdue').reduce((sum,i) => sum + calc(i).bal,0))}</strong></div><div><small>Draft invoices</small><strong>{d.invoices.filter(i => i.state === 'draft').length}</strong></div></div>
    <Sel l="Status" o={[['', 'All'], 'Draft', 'Sent', 'Partially paid', 'Paid', 'Overdue', 'Void']} value={fs} onChange={(e) => setFs(e.target.value)} />
    {a.length ? a.map((i) => { const c = calc(i); return (
      <a className="row" key={i.id} href={'#/invoices/' + i.id}>
        <div><b>{i.no} · {L.cname(d, i.client)}</b><small>Total {money(c.total)} · Balance {money(c.bal)} · Due {i.due}</small></div><Badge s={status(i)} />
      </a>); }) : <Empty m={d.invoices.length ? 'No invoices with that status.' : 'No invoices yet. Create one for a client.'} label={d.invoices.length ? '' : 'Create invoice'} onClick={() => open('invoice')} />}
  </>);
}

function InvoicePage({ d, mut, open, ask, id, removeItem, toast }) {
  const i = d.invoices.find((x) => x.id === id);
  if (!i) return <><Back to="invoices" label="Invoices" /><Empty m="This invoice could not be found." /></>;
  const c = calc(i), s = status(i), st = d.settings, cl = d.clients.find((x) => x.id === i.client) || {};
  const upd = (fn) => mut((n) => fn(n.invoices.find((x) => x.id === id)));
  const pdf = () => { const t = document.title; document.title = i.no + (cl.name ? ' - ' + cl.name : ''); window.print(); setTimeout(() => { document.title = t; }, 1000); };
  const reissue = () => { let number;try{number=nextInvoiceNumber(d);}catch(error){toast(error.message);return;} const nid = rid(); mut((n) => { n.seq=number.seq; n.invoices.push(L.reissuedInvoice(i,nid,number.no)); }); nav('invoices', nid); };
  return (<>
    <div className="noprint">
      <Back to="invoices" label="Invoices" />
      <div className="hd"><h1>{i.no} <Badge s={s} /></h1>
        <div className="end" style={{ margin: 0 }}>
          {i.state === 'draft' && <><button className="ghost sm" onClick={() => open('invoice', i)}>Edit</button><button className="btn sm" onClick={() => upd((x) => { x.state = 'sent'; })}>Mark as sent</button>
            </>}
          {i.state === 'sent' && <>{c.bal >= 0.005 && <button className="btn sm" onClick={() => open('pay', i)}>Record payment</button>}
            <button className="ghost sm" onClick={() => ask('Void this invoice? It will no longer count as outstanding. You can reissue a corrected draft afterwards.', () => upd((x) => { x.state = 'void'; }))}>Void</button></>}
          {i.state === 'void' && <button className="btn sm" onClick={reissue}>Void &amp; reissue as new draft</button>}
          <button className="ghost sm" onClick={pdf}>Download PDF</button>
          <button className="ghost danger sm" onClick={() => removeItem('invoices',id)}>Delete invoice</button>
        </div></div>
      <small>Download PDF opens your browser's print window. Choose "Save as PDF" as the destination.</small>
    </div>

    <article className="sheet" aria-label={'Invoice ' + i.no}>
      <div className="sh-top">
        <div>
          {st.logo && <img className="logo" src={st.logo} alt="" />}
          <b className="biz">{st.biz || 'Your business'}</b>
          <div className="sm-t">{st.email}{st.email && <br />}{st.phone}{st.phone && <br />}<span style={{ whiteSpace: 'pre-line' }}>{st.addr}</span></div>
        </div>
        <div className="sh-r">
          <div className="ttl">INVOICE</div><div>{i.no}</div><div>Issued {i.issue}</div><div>Due {i.due}</div>
          <div className="stamp">{L.ICON[s]}{s}</div>
        </div>
      </div>
      <div className="sh-bill"><small>BILL TO</small><b>{cl.name || '—'}</b>{[cl.email, cl.address].filter(Boolean).join('\n')}</div>
      <div className="tw" tabIndex={0} role="region" aria-label="Invoice line items, scroll horizontally on small screens"><table><tbody>
        <tr><th>Description</th><th className="r">Qty</th><th className="r">Price</th><th className="r">Amount</th></tr>
        {i.items.map((l, k) => <tr key={k}><td>{l.desc}</td><td className="r">{l.qty}</td><td className="r">{money(num(l.price))}</td><td className="r">{money(num(l.qty) * num(l.price))}</td></tr>)}
        <tr><td colSpan="3" className="r">Subtotal</td><td className="r">{money(c.sub)}</td></tr>
        <tr><td colSpan="3" className="r">Tax ({num(i.tax)}%)</td><td className="r">{money(c.tax)}</td></tr>
        <tr className="tot"><td colSpan="3" className="r">Total</td><td className="r">{money(c.total)}</td></tr>
        <tr><td colSpan="3" className="r">Paid</td><td className="r">{money(c.paid)}</td></tr>
        <tr className="tot"><td colSpan="3" className="r">Balance due</td><td className="r">{money(c.bal)}</td></tr>
      </tbody></table></div>
      {i.notes && <p style={{ whiteSpace: 'pre-line' }}><small>NOTES</small><br />{i.notes}</p>}
      {st.pay && <p style={{ whiteSpace: 'pre-line' }}><small>PAYMENT INSTRUCTIONS</small><br />{st.pay}</p>}
    </article>

    <div className="noprint">
      <h3>Payments</h3>
      {i.pays.length ? i.pays.map((p) => <div className="row" key={p.id}><div className="grow"><b>{money(num(p.amt))}</b><small>{p.date}{p.note ? ' · ' + p.note : ''}</small></div><button className="ghost danger sm" onClick={() => removeItem('payments',p.id,i.id)}>Delete payment</button></div>) : <p className="mu">No payments recorded yet.</p>}
    </div>
  </>);
}

/* ---------- reports ---------- */
function Reports({ d }) {
  const t = today(), [from, setFrom] = useState(addDays(t, -165).slice(0, 8) + '01'), [to, setTo] = useState(t);
  const pays = L.allPays(d).filter((p) => p.date >= from && p.date <= to), rows = L.revBy(L.months(from, to), pays), tot = pays.reduce((s, p) => s + num(p.amt), 0);
  return (<>
    <h1>Reports</h1>
    <div className="grid2"><Fld l="From" type="date" required max={to} value={from} onChange={(e) => { if(e.target.value) setFrom(e.target.value); }} /><Fld l="To" type="date" required min={from} value={to} onChange={(e) => { if(e.target.value) setTo(e.target.value); }} /></div>
    {from > to && <p className="inline-error" role="alert">Choose an end date on or after the start date.</p>}
    <div className="cards"><div className="card"><small>Revenue received (payments in range)</small><b>{money(tot)}</b></div><div className="card"><small>Outstanding invoice balance (now)</small><b>{money(L.outstanding(d))}</b></div></div>
    <div className="card"><h3>Revenue received by payment date</h3><Chart data={rows} /></div>
    <div className="card tw" style={{ marginTop: 12 }}><table><caption className="mu" style={{ textAlign: 'left' }}>Table version of the chart. Revenue received is not profit.</caption>
      <tbody><tr><th>Month</th><th className="r">Received</th></tr>{rows.map((r) => <tr key={r.k}><td>{r.k}</td><td className="r">{money(r.v)}</td></tr>)}</tbody></table></div>
  </>);
}

/* ---------- settings ---------- */
function Settings({ d, mut, toast, ask, user, logout, demo, saving, signingOut, startOnboarding, startTour, offlineReady }) {
  const s = d.settings;
  const del = () => ask('This permanently deletes your SoloDesk workspace, clients, projects, tasks and invoices. Your shared TaskFlow sign-in is kept. Consider exporting CSVs first.', async () => {
    if (demo) { localStorage.removeItem('sd_demo'); await logout({force:true}); return; }
    try {
      await reauthenticateWithPopup(user, provider);
      const shares=await getDocs(collection(fdb,'solodeskPortals',user.uid,'shares'));
      for(let i=0;i<shares.docs.length;i+=400){const batch=writeBatch(fdb);shares.docs.slice(i,i+400).forEach(s=>batch.delete(s.ref));await batch.commit();}
      await deleteDoc(doc(fdb, workspaceCollection, user.uid));
      await logout({force:true});
    } catch { toast('Workspace deletion did not complete. Check your connection and try again.'); }
  }, {label:'Delete workspace', danger:true, title:'Delete SoloDesk workspace?'});
  const pick = async (e) => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try { const u = await logoFile(f); mut((n) => { n.settings.logo = u; }); toast('Logo updated.'); } catch { toast('Could not read that image. Try a PNG or JPG.'); }
  };
  return (<>
    <h1>Settings</h1>
    <ReplayIntroduction onOnboarding={startOnboarding} onTour={startTour}/>
    <DashboardOptions d={d} mut={mut}/>
    <section className="card"><h3>Offline access</h3><p>{offlineReady?'SoloDesk is ready to open offline on this device.':'Offline access becomes ready after the hosted app has loaded and finished preparing.'}</p><p>Keep this browser tab open to recover workspace edits after a reload or reconnect. Closing the tab can remove its recovery copy. Export a backup for longer-term storage. Sign-out clears the current account’s recovery copy.</p><a className="ghost sm" href="#/backups">Open backup & restore</a></section>
    <InstallApp />
    <form className="card" onSubmit={(e) => { e.preventDefault(); const o = Object.fromEntries(new FormData(e.target)); mut((n) => { Object.assign(n.settings, o); }); toast('Settings saved.'); }}>
      <Fld l="Business name" name="biz" defaultValue={s.biz} /><Fld l="Business email" name="email" type="email" defaultValue={s.email} /><Fld l="Phone" name="phone" defaultValue={s.phone} />
      <label>Address<textarea name="addr" rows="2" defaultValue={s.addr} /></label><label>Payment instructions (shown on invoices)<textarea name="pay" rows="3" defaultValue={s.pay} /></label>
      <Sel l="Default currency" name="cur" o={['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'INR', 'JPY', 'CHF']} defaultValue={s.cur} />
      <label>Logo (PNG or JPG, shown on invoices)<FileInput accept="image/png,image/jpeg" onChange={pick} /></label>
      {s.logo && <div className="row"><img src={s.logo} alt="Current logo" style={{ maxHeight: 48, maxWidth: '60%' }} /><button type="button" className="ghost danger sm" onClick={() => mut((n) => { n.settings.logo = ''; })}>Remove logo</button></div>}
      <button className="btn">Save settings</button>
    </form>
    <h3>Export data (CSV)</h3>
    <div className="end" style={{ justifyContent: 'flex-start' }}>{['clients', 'projects', 'tasks', 'invoices', 'payments'].map((k) => <button key={k} className="ghost" onClick={() => L.download(`solodesk-${k}.csv`, L.csv(L.exporters(d)[k]), 'text/csv')}>{k[0].toUpperCase() + k.slice(1)}</button>)}</div>
    <div className="integration-callout"><div><span className="eyebrow">YOUR DATA, CONNECTED</span><h3>Work with your other apps.</h3><p>Export a complete snapshot or connect through the read-only API.</p></div><a className="btn" href="#/integrations">Manage integrations<Icon name="arrow" /></a></div><h3>Account</h3>
    <div className="end" style={{ justifyContent: 'flex-start' }}><button className="ghost danger" disabled={signingOut} onClick={logout}>{signingOut ? 'Signing out…' : 'Sign out'}</button><button className="ghost danger" disabled={signingOut || (!demo && saving === 'saving')} onClick={del}>Delete SoloDesk workspace</button></div>
  </>);
}

/* ---------- invoice form ---------- */
function InvForm({ v, d, mut, close, toast, removeItem }) {
  const [lines, setL] = useState(v.items || [{ desc: '', qty: 1, price: '' }]);
  const [client, setClient] = useState(v.client || d.clients.find(c=>!c.arch)?.id || '');
  const [addingClient,setAddingClient] = useState(!d.clients.some(c=>!c.arch || c.id===v.client));
  const [clientDraft,setClientDraft] = useState({name:'',email:'',phone:'',address:'',notes:''});
  const [formError,setFormError] = useState(''), [clientError,setClientError] = useState('');
  const clientName = useRef(null), clientEmail = useRef(null), submitting = useRef(false);
  const clientControls = useRef(null), restoreClientFocus = useRef(false);
  useEffect(()=>{if(!addingClient && restoreClientFocus.current){restoreClientFocus.current=false;clientControls.current?.querySelector('[role=combobox]')?.focus();}},[addingClient,client]);
  const addClient = () => {
    const result=prepareClient(clientDraft);
    if (result.error) {setClientError(result.error); (clientDraft.name.trim() ? clientEmail : clientName).current?.focus();return;}
    const id=rid(); mut(n=>n.clients.push({id,arch:false,...result.client})); restoreClientFocus.current=true;setClient(id); setAddingClient(false); setClientDraft({name:'',email:'',phone:'',address:'',notes:''});setClientError('');setFormError('');toast('Client added and selected. Your invoice is still open.');
  };
  const set = (i, k, x) => setL(lines.map((l, j) => (j === i ? { ...l, [k]: x } : l)));
  return (
    <Modal title={v.id ? `Edit draft ${v.no}` : 'New invoice'} label="Save draft" onClose={close} onDelete={v.id ? () => removeItem('invoices',v.id) : undefined} onSubmit={(o) => {
      if (submitting.current) return;
      if (addingClient) {setFormError('Save the new client first, or cancel adding the client.');return;}
      const result=prepareInvoice(d,{...o,client},lines,v.id);
      if (result.error) {setFormError(result.error);return;}
      let number;
      try {if(!v.id) number=nextInvoiceNumber(d);} catch(error) {setFormError(error.message);return;}
      submitting.current=true;
      const nid = rid();
      mut((n) => { if (v.id) Object.assign(n.invoices.find((i) => i.id === v.id),result.invoice); else { n.seq=number.seq; n.invoices.push({ id: nid, no:number.no, state: 'draft', pays: [], ...result.invoice }); } });
      close();
      if (!v.id) nav('invoices', nid);
    }}>
      <h3>Details</h3>
      <div className="invoice-client-actions" ref={clientControls}><Sel l="Client" name="client" required value={client} onChange={e=>setClient(e.target.value)} o={d.clients.filter((c) => !c.arch || c.id === v.client).map((c) => [c.id, c.name])} /><button type="button" className="ghost sm" onClick={()=>{setAddingClient(true);setClientError('');requestAnimationFrame(()=>clientName.current?.focus());}}>+ New client</button></div>
      <div>{addingClient && <fieldset className="invoice-new-client"><legend>Add a new client</legend><p className="mu">This saves a client to your workspace and selects it for this invoice. Your invoice details stay in place.</p><label>New client name<input ref={clientName} aria-label="New client name" value={clientDraft.name} onChange={e=>setClientDraft({...clientDraft,name:e.target.value})} autoComplete="organization" /></label><div className="grid2"><label>New client email (optional)<input ref={clientEmail} type="email" aria-label="New client email" value={clientDraft.email} onChange={e=>setClientDraft({...clientDraft,email:e.target.value})} /></label><label>New client phone (optional)<input aria-label="New client phone" type="tel" value={clientDraft.phone} onChange={e=>setClientDraft({...clientDraft,phone:e.target.value})} /></label></div><label>New client address (optional)<textarea aria-label="New client address" rows="2" value={clientDraft.address} onChange={e=>setClientDraft({...clientDraft,address:e.target.value})} /></label>{clientError && <p className="inline-error" role="alert">{clientError}</p>}<div className="end"><button type="button" className="ghost sm" onClick={()=>{restoreClientFocus.current=true;setAddingClient(false);setClientError('');}}>Cancel new client</button><button type="button" className="btn sm" onClick={addClient}>Add client &amp; select</button></div></fieldset>}</div>
      {formError && <p className="inline-error" role="alert">{formError}</p>}
      <div className="grid2"><Fld l="Issue date" name="issue" type="date" required defaultValue={v.issue || today()} /><Fld l="Due date" name="due" type="date" required defaultValue={v.due || addDays(today(), 14)} /></div>
      <h3>Line items</h3>
      {lines.map((l, i) => (
        <div className="ln" key={i}>
          <input placeholder="Description" aria-label="Description" required value={l.desc} onChange={(e) => set(i, 'desc', e.target.value)} />
          <input type="number" step="any" min="0.001" required aria-label="Quantity" value={l.qty} onChange={(e) => set(i, 'qty', e.target.value)} />
          <input type="number" step="any" min="0" required placeholder="Price" aria-label="Unit price" value={l.price} onChange={(e) => set(i, 'price', e.target.value)} />
          <button type="button" className="ghost" aria-label="Remove line" onClick={() => lines.length > 1 && setL(lines.filter((_, j) => j !== i))}>✕</button>
        </div>))}
      <button type="button" className="ghost sm" onClick={() => setL([...lines, { desc: '', qty: 1, price: '' }])}>+ Add line</button>
      <h3>Tax and notes</h3>
      <Fld l="Tax rate % (optional)" name="tax" type="number" step="any" min="0" defaultValue={v.tax || 0} />
      <label>Notes (optional)<textarea name="notes" rows="2" defaultValue={v.notes} /></label>
    </Modal>
  );
}

function More({ startOnboarding, startTour }) {
  return (<>
    <h1>More</h1>
    <ReplayIntroduction onOnboarding={startOnboarding} onTour={startTour}/>
    <InstallApp />
    {MORE.map(([k, t]) => <a key={k} className="row" href={'#/' + k}><b>{t}</b><span aria-hidden="true">›</span></a>)}
  </>);
}

/* ---------- app shell ---------- */
export default function App() {
  const [demo, setDemo] = useState(() => sessionStorage.getItem('sd_demo_active') === '1');
  const [user, setUser] = useState(configured ? undefined : null), [d, setD] = useState(null), [route, setRoute] = useState(parse), [dlg, setDlg] = useState(null), [msg, setMsg] = useState(''), [err, setErr] = useState('');
  const [saving, setSaving] = useState('saved'),[online,setOnline]=useState(navigator.onLine),[saveError,setSaveError]=useState('');
  const [offlineReady,setOfflineReady]=useState(false);
  useEffect(()=>{let active=true;if('serviceWorker' in navigator)navigator.serviceWorker.ready.then(()=>{if(active)setOfflineReady(true);});return()=>{active=false;};},[]);
  useEffect(()=>{const update=()=>setOnline(navigator.onLine);window.addEventListener('online',update);window.addEventListener('offline',update);return()=>{window.removeEventListener('online',update);window.removeEventListener('offline',update);};},[]);
  const undoHistory=useRef([]),[undoCount,setUndoCount]=useState(0);
  const [signingOut, setSigningOut] = useState(false), [experience,setExperience] = useState(null);
  const experienceOwner=demo?'demo':user?.uid, experienceReady=!!d && !!experienceOwner;
  useEffect(()=>{if(!experienceReady){setExperience(null);return;}if(!wasSeen(localStorage,onboardingKey(experienceOwner)))setExperience('onboarding');},[experienceOwner,experienceReady]);
  const taskflow = useTaskflow(user?.uid, demo);
  const dataRef = useRef(null), toastTimer = useRef(), loadVersion = useRef(0), mainRef = useRef(null), saves = useRef(null);
  if (!saves.current) saves.current=createWorkspaceSaves(async(owner,value,baseline)=>{
    assertWorkspaceSize(value);const json=JSON.stringify(value),ref=doc(fdb,workspaceCollection,owner),key='sd_pending_'+owner;
    try{if(auth.currentUser?.uid===owner)sessionStorage.setItem(key,JSON.stringify({baseline,data:dataRef.current||value}));}catch{/* The current tab still retains unsaved data. */}
    await runTransaction(fdb,async tx=>{const snap=await tx.get(ref);assertUnchanged(snap.exists()?snap.data().json:null,baseline);tx.set(ref,{json});});
    if(auth.currentUser?.uid===owner){try{sessionStorage.setItem('sd_cached_'+owner,JSON.stringify({baseline:json,data:value}));}catch{}}
    if(auth.currentUser?.uid===owner){try{if(JSON.stringify(dataRef.current)===json)sessionStorage.removeItem(key);else sessionStorage.setItem(key,JSON.stringify({baseline:json,data:dataRef.current}));}catch{}}
    return json;
  },(state,error)=>{
    setSaving(state);
    setSaveError(error?.message||'');
    if (state==='error') {clearTimeout(toastTimer.current);setMsg(error?.code==='workspace-too-large'?error.message:'Changes are not saved. Use Retry in the top bar.');toastTimer.current=setTimeout(()=>setMsg(''),error?.code==='workspace-too-large'?15000:4500);}
  });
  const [theme, setTheme] = useState(() => localStorage.getItem('sd_theme') || 'light');
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('sd_theme', theme); }, [theme]);
  useEffect(() => {
    const f = () => { setRoute(parse()); setDlg(null); window.scrollTo({ top: 0, behavior: 'instant' }); requestAnimationFrame(() => mainRef.current?.focus()); };
    window.addEventListener('hashchange', f);
    return () => { window.removeEventListener('hashchange', f); clearTimeout(toastTimer.current); };
  }, []);
  useEffect(() => {
    if (demo || saving === 'saved') return;
    const warn = e => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload',warn);
    return () => window.removeEventListener('beforeunload',warn);
  }, [demo,saving]);
  useEffect(() => { document.title = !demo && user === null && !['privacy','cookies'].includes(route.page) ? 'Sign in · SoloDesk' : `${NAV.find(([k]) => k === route.page)?.[1] || ({more: 'More', privacy: 'Privacy Policy', cookies: 'Cookies & storage'})[route.page] || 'Dashboard'} · SoloDesk`; }, [route.page,user,demo]);
  const apply = (value) => { if(value===null){undoHistory.current=[];setUndoCount(0);} dataRef.current = value; setD(value); };
  const load = async (u) => {
    const request = ++loadVersion.current;
    setErr(''); apply(null);
    let pending;try{pending=JSON.parse(sessionStorage.getItem('sd_pending_'+u.uid));}catch{}
    try {
      const snap = await getDoc(doc(fdb, workspaceCollection, u.uid));if(request!==loadVersion.current||auth.currentUser?.uid!==u.uid)return;
      const baseline=snap.exists()?snap.data().json:null;const value=validateWorkspace(baseline?JSON.parse(baseline):fresh());
      saves.current.begin(u.uid,baseline);
      if(pending){apply(validateWorkspace(pending.data));if(pending.baseline!==baseline){setSaving('conflict');setSaveError('Recovered pending changes conflict with another saved version. Export them before loading the latest.');}else persist(pending.data);}
      else{apply(value);try{sessionStorage.setItem('sd_cached_'+u.uid,JSON.stringify({baseline,data:value}));}catch{}}
    } catch(error) {
      if(request!==loadVersion.current||auth.currentUser?.uid!==u.uid)return;
      let cached;try{cached=JSON.parse(sessionStorage.getItem('sd_cached_'+u.uid));}catch{}
      const recover=pending||cached;
      if(recover){try{const recovered=validateWorkspace(recover.data);saves.current.begin(u.uid,recover.baseline);apply(recovered);setSaving('error');setSaveError('Offline copy recovered in this tab. Reconnect to save.');return;}catch{}}
      setErr('We could not load your data. Check your connection or backup format and try again.');
    }
  };
  useEffect(() => {
    if (demo) {
      saves.current.begin(null);setSaving('saved');
      loadVersion.current++;
      let value;
      try { value = JSON.parse(localStorage.getItem('sd_demo')); } catch { /* reset corrupt demo */ }
      apply(value?.clients && value?.settings ? value : demoData());
      return;
    }
    if (!configured) { setUser(null); return; }
    return onAuthStateChanged(auth, u => { saves.current.begin(u?.uid);setSaving('saved');loadVersion.current++; setUser(u); apply(null); setErr(''); if (u) load(u); });
  }, [demo]);
  const toast = m => { clearTimeout(toastTimer.current); setMsg(m); toastTimer.current = setTimeout(() => setMsg(''), 4500); };
  const ask = (m, fn, options = {}) => setDlg({ k: 'ask', v: { m, fn, ...options } });
  const persist = n => { void saves.current.save(n); };
  useEffect(()=>{if(online&&!demo&&user?.uid&&dataRef.current&&saving==='error')persist(dataRef.current);},[online]);
  const mut = fn => {
    const before=dataRef.current;if(!before)return;const n=structuredClone(before);fn(n);
    for(const task of n.tasks){const old=before.tasks.find(t=>t.id===task.id);if(old&&task.status==='Done'&&(old.status!=='Done'||JSON.stringify(old.dependencies)!==JSON.stringify(task.dependencies))&&blockers(n,task).length){toast('Finish the blocking tasks first. Open task details to manage dependencies.');return false;}}
    repeatCompletedTasks(before,n);
    if(JSON.stringify(before)===JSON.stringify(n))return;
    recordActivity(before,n);
    undoHistory.current=[...undoHistory.current.slice(-19),structuredClone(before)];setUndoCount(undoHistory.current.length);apply(n);
    if (demo) { try { localStorage.setItem('sd_demo', JSON.stringify(n)); } catch { toast('Browser storage is full. Export your data before leaving.'); } }
    else persist(n);
  };
  const undo=()=>{const previous=undoHistory.current.pop();if(!previous)return;setUndoCount(undoHistory.current.length);apply(previous);if(demo){try{localStorage.setItem('sd_demo',JSON.stringify(previous));}catch{toast('Browser storage is full.');}}else persist(previous);toast('Last workspace change undone.');};
  const finishLogout = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      // Demo mode may coexist with a persisted real session: sign out that session too.
      if (auth) await signOut(auth);
      saves.current.begin(null);
      loadVersion.current++;
      sessionStorage.removeItem('sd_demo_active');
      if(user?.uid){sessionStorage.removeItem('sd_pending_'+user.uid);sessionStorage.removeItem('sd_cached_'+user.uid);}
      setDemo(false); setUser(null); apply(null); setDlg(null); setErr(''); setMsg(''); setSaving('saved');
      window.history.replaceState(null,'','/'); setRoute({page:'dash'}); window.scrollTo(0,0);
    } catch { toast('Could not sign out. Please try again.'); }
    finally { setSigningOut(false); }
  };
  const logout = ({force = false} = {}) => {
    if (!force && !demo && saving !== 'saved') {
      ask('Some changes have not been saved. Sign out anyway? Unsaved changes may be lost. You can cancel to retry saving or export your data.',finishLogout,{label:'Sign out',danger:true,title:'Sign out with unsaved changes?'});
      return;
    }
    return finishLogout();
  };
  const startDemo = () => { sessionStorage.setItem('sd_demo_active','1'); setDemo(true); };
  L.setCur(d?.settings.cur);
  if(route.page==='portal')return <ClientPortal owner={route.id} />;
  if (['privacy', 'cookies'].includes(route.page)) return <LegalPage page={route.page} mainRef={mainRef} />;
  if (!demo && user === undefined) return <div className="mid"><div className="loading-mark" /><p>Opening your desk…</p></div>;
  if (!demo && !user) return <Login onDemo={startDemo} />;
  if (!d) return err ? <div className="mid"><p role="alert">{err}</p><button className="btn" onClick={() => load(user)}>Try again</button> <button className="ghost danger" onClick={logout}>Sign out</button></div> : <div className="mid"><div className="loading-mark" /><p>Loading your workspace…</p></div>;

  const page = NAV.some(([k]) => k === route.page) || route.page === 'more' ? route.page : 'dash';
  const open = (k, v = {}) => setDlg({ k, v });
  const removeItem = (kind,id,invoiceId) => {
    const info = deletionInfo(dataRef.current,kind,id,invoiceId);
    if (!info) return;
    ask(info.message.replace('This cannot be undone.','You can restore this deletion from Trash. Client portal access is revoked separately and must be republished after restoring.'),async()=>{if(kind==='clients'&&!demo){try{await deleteDoc(doc(fdb,'solodeskPortals',user.uid,'shares',id));}catch{toast('Could not revoke client access. Reconnect and try deleting again.');return;}}mut(n=>trashRecord(n,kind,id,invoiceId)); if(kind !== 'payments' && route.id===id) nav(kind); toast('Moved to Trash. Restore it from More → Trash, or use Undo.');},{label:'Move to Trash',danger:true,title:'Move to Trash?'});
  };
  const closeExperience=()=>{if(experience==='onboarding')rememberSeen(localStorage,onboardingKey(experienceOwner));setExperience(null);};
  const startTour=()=>{rememberSeen(localStorage,onboardingKey(experienceOwner));setExperience('tour');};
  const startOnboarding=()=>setExperience('onboarding');
  const purgeTrash=id=>ask('Permanently remove this Trash entry and its deleted data? Export a backup first. Undo history will also be cleared.',()=>{mut(n=>{n.trash=n.trash.filter(e=>e.id!==id);});undoHistory.current=[];setUndoCount(0);toast('Trash entry permanently removed.');},{title:'Permanently delete?',label:'Permanently delete',danger:true});
  const close = () => setDlg(null), P = { d, mut, open, ask, toast, user, logout, demo, saving, signingOut, taskflow, removeItem, startOnboarding, startTour, undo, undoCount, purgeTrash, offlineReady, id: route.id };
  const v = dlg?.v || {};
  const save = (list, o) => {
    if (list === 'clients') {const result=prepareClient(o);if(result.error)return toast(result.error);o=result.client;}
    const textField = list === 'tasks' ? 'title' : 'name';
    o[textField] = o[textField]?.trim();
    if (!o[textField]) return toast('Enter a name or title before saving.');
    if(list==='projects'&&(!Number.isFinite(Number(o.budgetHours||0))||!Number.isFinite(Number(o.hourlyRate||0))||Number(o.budgetHours)<0||Number(o.hourlyRate)<0))return toast('Enter valid non-negative budget and rate.');
    if (list === 'projects' && o.start && o.end && o.end < o.start) return toast('Project end must be on or after its start.');
    if (list === 'tasks') {
      const project = d.projects.find(p => p.id === o.project);
      if (project?.client && o.client && project.client !== o.client) return toast('Choose the client linked to this project, or leave the client empty.');
      if (project?.client && !o.client) o.client = project.client;
      if(o.repeat&&!frequencies.some(([id])=>id===o.repeat))return toast('Choose a valid repeat frequency.');
      if(o.scheduledAt&&!Number.isFinite(Date.parse(o.scheduledAt)))return toast('Choose a valid scheduled time.');
      o.scheduledAt = o.scheduledAt ? new Date(o.scheduledAt).toISOString() : '';
      if(o.repeat)o.repeatAnchor=o.repeat===v.repeat&&o.due===v.due&&v.repeatAnchor?v.repeatAnchor:Number((o.due||(o.scheduledAt?localDateTime(o.scheduledAt).slice(0,10):today())).slice(-2));
      o.durationMinutes = Math.min(1440, Math.max(5, num(o.durationMinutes) || 60));
    }
    mut((n) => { if (v.id) Object.assign(n[list].find((x) => x.id === v.id), o); else n[list].push({ id: rid(), ...(list === 'clients' ? { arch: false } : {}), ...o }); }); close(); };
  const cOpts = [['', '— none —'], ...d.clients.filter((c) => !c.arch || c.id === v.client).map((c) => [c.id, c.name])];

  return (<>
    <InstallNotice/>
    <a className="skip-link" href="#workspace" onClick={e => { e.preventDefault(); mainRef.current?.focus(); }}>Skip to content</a>
    <aside className="sidebar">
      <a className="wordmark" href="#/dash"><BrandLogo /></a>
      <div className="workspace-label"><span className="workspace-monogram">{(d.settings.biz || 'My workspace').slice(0,1)}</span><div><b>{d.settings.biz || 'My workspace'}</b><small>{demo ? 'Demo workspace' : 'Personal workspace'}</small></div></div>
      <span className="nav-caption">WORKSPACE</span>
      <nav aria-label="Main">{NAV.map(([k,t]) => <a key={k} href={'#/' + k} className={page === k ? 'on' : ''} aria-current={page === k ? 'page' : undefined}><Icon name={k} /><span>{t}</span>{k === 'tasks' && d.tasks.filter(x => x.status !== 'Done').length > 0 && <span className="nav-count">{d.tasks.filter(x => x.status !== 'Done').length}</span>}</a>)}</nav>
      <div className="sidebar-bottom"><div className="sidebar-note"><span className="eyebrow">INDEPENDENT, TOGETHER.</span><p>A place for the business<br />behind your craft.</p></div><button className="profile-button" onClick={logout}><span className="avatar">{(user?.displayName || d.settings.biz || 'You').slice(0,1)}</span><span><b>{demo ? 'Demo explorer' : user?.displayName || 'Your account'}</b><small>{demo ? 'Exit demo' : 'Sign out'}</small></span><Icon name="logout" size={17} /></button></div>
    </aside>
    <div className="app-body"><header className="topbar"><a className="header-brand" href="#/dash"><BrandLogo /></a><div className="breadcrumb">Workspace <span>/</span> <b>{NAV.find(([k]) => k === page)?.[1] || 'More'}</b>{route.id && <><span>/</span><span>Details</span></>}</div><div className="topbar-right"><WorkspaceSearch d={d} taskflow={taskflow} Modal={Modal} openProject={p=>open('project',p)}/>{demo ? <span className="demo-badge">LOCAL DEMO · SAMPLE DATA</span> : <span className={'save-state ' + saving} role="status">{saving === 'saving' ? 'Saving…' : ['error','conflict'].includes(saving) ? <button className="ghost sm" onClick={() => {if(saving!=='conflict')persist(dataRef.current);}}>Unsaved changes</button> : 'All changes saved'}</span>}<span className="topbar-date">{new Date().toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}</span><a className="icon-button header-link" href="#/reports" aria-label="View reports"><Icon name="reports" /></a><a className="icon-button header-link" href="#/settings" aria-label="Open settings"><Icon name="settings" /></a><button className="icon-button" aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}><Icon name={theme === 'dark' ? 'sun' : 'moon'} /></button><button type="button" className="ghost danger sm signout-button" aria-label="Sign out of SoloDesk" disabled={signingOut} onClick={logout}><Icon name="logout" size={18} /><span>{signingOut ? 'Signing out…' : 'Sign out'}</span></button></div></header>
    <main ref={mainRef} id="workspace" tabIndex={-1}>
      {(!online||['error','conflict'].includes(saving))&&!demo&&<section className="sync-notice" role="status"><strong>{!online?'Offline · changes stay in this tab':saving==='conflict'?'Another tab or device changed this workspace':'Changes are not saved'}</strong><p>{saveError||'Reconnect to save pending changes. An account-scoped draft is kept in this tab for reload recovery.'}</p><a className="ghost sm" href="#/backups">Export pending backup</a>{saving==='conflict'?<button className="ghost sm" onClick={()=>ask('Download a backup of pending changes first. Load the latest saved workspace and discard this tab’s pending version?',()=>{sessionStorage.removeItem('sd_pending_'+user.uid);setSaving('saved');load(user);},{title:'Load latest saved version?',label:'Load latest'})}>Load latest saved version</button>:<button className="ghost sm" disabled={!online} onClick={()=>persist(dataRef.current)}>Retry save</button>}</section>}
      <div className={'page-content page-'+page} key={page + (route.id || '')}>
      {page !== 'dash' && <div className="page-kicker"><span className="eyebrow">{({clients:'GOOD WORK STARTS WITH PEOPLE',projects:'FROM FIRST BRIEF TO FINAL DELIVERY',tasks:'MAKE SPACE FOR WHAT MATTERS',invoices:'THE BUSINESS OF GETTING PAID',reports:'FOLLOW THE NUMBERS',settings:'MAKE YOURSELF AT HOME',calendar:'MAKE ROOM FOR YOUR WORK',integrations:'YOUR WORKSPACE, WITHOUT WALLS'})[page] || 'YOUR WORKSPACE'}</span><p>{({clients:'The people you build with. All in one place.',projects:'Keep the moving pieces in perspective.',tasks:'A little structure for your next big thing.',invoices:'Clear invoices. Less chasing. Better flow.',reports:'A considered look at your business.',settings:'The details that make this desk yours.',calendar:'Your clients, projects and tasks. In one view.',integrations:'Take your data further. Connect your other tools.'})[page]}</p></div>}
      <div className="work-tools"><CommandMenu open={open} Modal={Modal}/><a className="ghost sm" href="#/planner">Daily planner</a><a className="ghost sm" href="#/templates">Templates</a><a className="ghost sm" href="#/focus">Focus</a><button type="button" className="ghost sm" disabled={!undoCount} title="Undo the latest workspace change · up to 20 changes in this session" onClick={undo}>Undo{undoCount?' · '+undoCount:''}</button><a className="ghost sm" href="#/trash">Trash{d.trash?.length?' · '+d.trash.length:''}</a></div>
      {page === 'backups' && <Backups {...P}/>}
      {page === 'notes' && <Notes {...P}/>}
      {page === 'planner' && <Planner {...P}/>}
      {page === 'templates' && <Templates {...P}/>}
      {page === 'recurring' && <RecurringInvoices {...P}/>}
      {page === 'focus' && <><h1>Focus on your work</h1><Focus {...P}/></>}
      {page === 'trash' && <Trash {...P}/>}
      {page === 'dash' && <Dash {...P} />}
      {page === 'clients' && (route.id ? <ClientPage {...P} /> : <Clients {...P} />)}
      {page === 'projects' && <Projects {...P} />}
      {page === 'tasks' && (route.id ? <TaskPage {...P} /> : <Tasks {...P} />)}
      {page === 'invoices' && (route.id ? <InvoicePage {...P} /> : <Invoices {...P} />)}
      {page === 'reports' && <Reports {...P} />}
      {page === 'calendar' && <Calendar {...P} />}
      {page === 'integrations' && <Integrations {...P} />}
      {page === 'settings' && <Settings {...P} />}
      {page === 'more' && <More {...P} />}
      </div><footer className="workspace-footer"><span>SoloDesk <span className="footer-separator">/</span> Space to do your thing.</span><a href="#/integrations">Your data belongs with you <Icon name="arrow" size={14} /></a><LegalLinks /></footer>
    </main></div>
    <nav className="bnav" aria-label="Primary">{MOB.slice(0,2).map(([k,t]) => <a key={k} href={'#/' + k} className={page === k ? 'on' : ''} aria-current={page === k ? 'page' : undefined}><span className="dock-icon"><Icon name={k} size={23} /></span>{t}</a>)}<button className="dock-add" aria-label="Create new" onClick={() => open('new')}><Icon name="plus" size={32} /></button>{MOB.slice(2).map(([k,t]) => <a key={k} href={'#/' + k} className={page === k || (k === 'more' && MORE.some(([m]) => m === page)) ? 'on' : ''} aria-current={page === k ? 'page' : undefined}><span className="dock-icon"><Icon name={k} size={23} /></span>{t}</a>)}</nav>

    {experience && <Experience key={experience+'-'+experienceOwner} mode={experience} demo={demo} onClose={closeExperience} onTour={startTour}/>}
    {dlg?.k === 'new' && <Modal title="Create new" label="Close" onClose={close} onSubmit={close}>
      {[['client', 'Client'], ['project', 'Project'], ['task', 'Task'], ['invoice', 'Invoice']].map(([k, t]) => <button type="button" key={k} className="row" style={{ width: '100%', font: 'inherit', color: 'inherit', cursor: 'pointer' }} onClick={() => { close(); setTimeout(() => open(k), 0); }}><b>{t}</b></button>)}</Modal>}
    {dlg?.k === 'client' && <Modal title={v.id ? 'Edit client' : 'New client'} onDelete={v.id ? () => removeItem('clients',v.id) : undefined} onClose={close} onSubmit={(o) => save('clients', o)}>
      <Fld l="Name" name="name" required defaultValue={v.name} /><Fld l="Email" name="email" type="email" defaultValue={v.email} /><Fld l="Phone" name="phone" type="tel" defaultValue={v.phone} />
      <label>Address<textarea name="address" rows="2" defaultValue={v.address} /></label><label>Notes<textarea name="notes" rows="2" defaultValue={v.notes} /></label></Modal>}
    {dlg?.k === 'project' && <Modal title={v.id ? 'Edit project' : 'New project'} onDelete={v.id ? () => removeItem('projects',v.id) : undefined} onClose={close} onSubmit={(o) => save('projects', o)}>
      <Fld l="Project name" name="name" required defaultValue={v.name} /><Sel l="Client" name="client" o={cOpts} defaultValue={v.client} /><Sel l="Status" name="status" o={['Active', 'On hold', 'Complete']} defaultValue={v.status || 'Active'} /><h3>Calendar timeline</h3><p className="mu form-help">Optional dates appear as a project span in your calendar. The end date is included.</p><div className="grid2"><Fld l="Start date" name="start" type="date" defaultValue={v.start} /><Fld l="End date" name="end" type="date" defaultValue={v.end} /></div><h3>Effort budget</h3><div className="grid2"><Fld l="Budget hours" name="budgetHours" type="number" min="0" step="0.25" defaultValue={v.budgetHours||''}/><Fld l="Hourly rate" name="hourlyRate" type="number" min="0" step="0.01" defaultValue={v.hourlyRate||''}/></div></Modal>}
    {dlg?.k === 'task' && <Modal title={v.id ? 'Edit task' : 'New task'} onDelete={v.id ? () => removeItem('tasks',v.id) : undefined} onClose={close} onSubmit={(o) => save('tasks', o)}>
      <Fld l="Title" name="title" required defaultValue={v.title} />
      <div className="grid2"><Sel l="Status" name="status" o={['Todo', 'In progress', 'Done']} defaultValue={v.status || 'Todo'} /><Sel l="Priority" name="priority" o={[['', 'None'], 'Low', 'Medium', 'High']} defaultValue={v.priority || ''} /></div>
      <Sel l="Repeat task after completion" name="repeat" o={frequencies} defaultValue={v.repeat||''}/><p className="form-help">Completing this task creates one next occurrence. Existing completed occurrences stay in history.</p><Fld l="Due date (optional)" name="due" type="date" defaultValue={v.due} /><Sel l="Client" name="client" o={cOpts} defaultValue={v.client || ''} />
      <Sel l="Project" name="project" o={[['', '— none —'], ...d.projects.map((p) => [p.id, p.name])]} defaultValue={v.project || ''} /><h3>Put it on your calendar</h3><p className="mu form-help">Choose a time to reserve a work block. Otherwise, a due date appears as an all-day deadline. Times use your device’s timezone ({Intl.DateTimeFormat().resolvedOptions().timeZone}).</p><div className="grid2"><Fld l="Scheduled start (optional)" name="scheduledAt" type="datetime-local" defaultValue={localDateTime(v.scheduledAt)} /><Fld l="Duration (minutes)" name="durationMinutes" type="number" min="5" max="1440" step="5" defaultValue={v.durationMinutes || 60} /></div></Modal>}
    {dlg?.k === 'invoice' && <InvForm v={v} d={d} mut={mut} close={close} toast={toast} removeItem={removeItem} />}
    {dlg?.k === 'pay' && (() => { const b = calc(v).bal; return <Modal title="Record payment" onClose={close} onSubmit={(o) => {
      if (num(o.amt) <= 0 || num(o.amt) > b + 0.005) return toast('Enter an amount up to the remaining balance.');
      mut((n) => n.invoices.find((i) => i.id === v.id).pays.push({ id: rid(), amt: num(o.amt), date: o.date, note: o.note })); close(); }}>
      <Fld l="Amount" name="amt" type="number" step="0.01" min="0.01" max={b.toFixed(2)} required defaultValue={b.toFixed(2)} />
      <Fld l="Payment date" name="date" type="date" required defaultValue={today()} /><Fld l="Method or note (optional)" name="note" /></Modal>; })()}
    {dlg?.k === 'ask' && <Modal title={v.title || 'Are you sure?'} label={v.label || 'Confirm'} danger={v.danger} onClose={close} onSubmit={() => { v.fn(); close(); }}><p>{v.m}</p></Modal>}
    {msg && <div className="toast" role="status">{msg}</div>}
  </>);
}
