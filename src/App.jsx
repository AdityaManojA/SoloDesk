import { useEffect, useState, useRef, useId, lazy, Suspense, Component } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, reauthenticateWithPopup } from 'firebase/auth';
import { doc, getDoc, setDoc, deleteDoc, runTransaction, collection, getDocs, writeBatch } from 'firebase/firestore';
import { auth, db as fdb, provider, configured, workspaceCollection } from './firebase';
import Icon from './Icon';
import { demoData } from './demo';
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
import {repeatCompletedTasks,recordActivity,trashRecord,frequencies,repeatLabel} from './productivity';
import {stampUpdated} from './recents';
import {watchSyncInbox} from './excel-sync-client';
import {Home,AllWork} from './Home.jsx';
import {NotesPage} from './NotesKeep.jsx';
import {NoteBoard} from './ClientNotes.jsx';
import {FilesAndDocs} from './FilesDocs.jsx';
import {ProfileEditor,PublicProfile} from './Profile.jsx';
import {InvoiceSheet,useInvoiceEdit} from './InvoiceEditor.jsx';
import {AppearanceSettings,InvoiceDefaults,WhatsNew,UpdateNotice} from './SettingsParts.jsx';
import {applyActionColour} from './appearance';
import {profileRoute,PROFILE_COLLECTION} from './profile';
import {currentVersion,shouldShowUpdate} from './changelog';
import {assertWorkspaceSize} from './workspace-size';
import {splitWorkspace,joinWorkspace,baselineOf,writeWorkspace} from './workspace-store';
import {assertUnchanged,validateWorkspace,blockers,validateDependencies,projectBudget} from './workspace-upgrades';
import {ViewStateProvider,useViewState,PageFrame,DataNav} from './ViewState.jsx';
import {CommandMenu} from './CommandMenu.jsx';
import {SmartField,taskChips} from './SmartField.jsx';
import {ApprovalsPage,ApprovalBox,useApprovalSync} from './Approvals.jsx';
import {approvalItems,approvalClient} from './approvals';
import {usePortalSync,sendOwnerComment} from './portal-sync';
import {NotificationBell} from './Notifications.jsx';
import {unseenAnswers} from './notifications';
import {unbilled,invoiceUnbilledHours} from './billing';
import {parseTask,parseProject,fmtDay} from './smart-parse';
const Calendar=lazy(()=>import('./Calendar.jsx'));
const Integrations=lazy(()=>import('./Integrations.jsx'));
const portalView=name=>lazy(()=>import('./ClientPortal.jsx').then(module=>({default:module[name]})));
const PortalManager=portalView('PortalManager'),ClientPortal=portalView('ClientPortal'),PortalPreview=portalView('PortalPreview');
const toolView=name=>lazy(()=>import('./WorkspaceUpgrades.jsx').then(module=>({default:module[name]})));
const Backups=toolView('Backups'),Notes=toolView('Notes'),DashboardOptions=toolView('DashboardOptions'),RecordExtras=toolView('RecordExtras');
import './upgrades.css';
import './polish.css';
import * as L from './lib';
const { rid, num, today, addDays, calc, status, money, fresh } = L;

const NAV = [['dash', 'Home'], ['work', 'All work'], ['clients', 'Clients'], ['projects', 'Projects'], ['tasks', 'Tasks'], ['calendar', 'Calendar'], ['invoices', 'Invoices'], ['reports', 'Reports'], ['integrations', 'Data & connections'], ['settings', 'Settings'],['planner','Daily planner'],['templates','Project templates'],['recurring','Recurring drafts'],['focus','Focus timer'],['trash','Trash'],['backups','Backup & restore'],['notes','Notes'],['profile','Profile'],['approvals','Approvals']];
const MOB = [['dash', 'Home'], ['tasks', 'Tasks'], ['calendar', 'Calendar'], ['more', 'More']];
const MORE = [['work','All work'],['clients','Clients'],['projects','Projects'],['invoices','Invoices'],['reports','Reports'],['notes','Notes'],['focus','Focus timer'],['integrations','Data & connections'],['profile','Profile'],['settings','Settings']];
// Sidebar groups (desktop). Other tools stay reachable from their pages and from More.
const GROUPS = [['General',['dash','clients','projects','tasks','calendar','invoices']],['Tools',['work','approvals','notes','integrations']],['Account',['profile','settings']]];
// The last breadcrumb names the record you are looking at.
const crumbName = (d, page, id) => ({ clients: () => d.clients.find(x => x.id === id)?.name, projects: () => d.projects.find(x => x.id === id)?.name, tasks: () => d.tasks.find(x => x.id === id)?.title, invoices: () => d.invoices.find(x => x.id === id)?.no, notes: () => { const n = (d.notes || []).find(x => x.id === id); return n && (n.title || 'Note'); }, settings: () => ({ general: 'General', invoices: 'Invoices & bank', appearance: 'Appearance', data: 'Data & connections', 'whats-new': "What's new", account: 'Account' })[id] }[page]?.() || 'Details');
const NAV_ICON = {dash:'home',work:'work',notes:'notes',planner:'planner',profile:'profile',focus:'focus',approvals:'approve'};

/* ---------- routing (hash based, so the browser back button works) ---------- */
const parse = () => {
  const pathPage = window.location.pathname.replace(/\/$/, '').slice(1), hash = window.location.hash.slice(2).split('?')[0];
  if (!hash && !['privacy', 'cookies'].includes(pathPage)) { const username = profileRoute(window.location.pathname); if (username) return { page: 'u', id: username }; }
  const [p, id] = (hash || (['privacy', 'cookies'].includes(pathPage) ? pathPage : 'dash')).split('/'); return { page: p || 'dash', id };
};
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
const Sel = ({ l, o, ...p }) => <label>{l}<Select aria-label={l} {...p}>{o.map((x) => { const [v, t, group] = Array.isArray(x) ? x : [x, x]; return <option key={v} value={v} data-group={group}>{t}</option>; })}</Select></label>;
// Project choices for forms: completed projects are tucked into a collapsed group.
const projectOptions = projects => [...projects.filter(p => p.status !== 'Complete').map(p => [p.id, p.name]), ...projects.filter(p => p.status === 'Complete').map(p => [p.id, p.name, 'Completed projects'])];
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
    {data.map((x, i) => { const h = x.v / mx * 155, cx = 35 + i * bw + bw / 2; return <g key={x.k}><title>{x.k}: {money(x.v)}</title><rect className={'chart-bar' + (i === data.length - 1 ? ' current' : '')} x={cx - Math.min(bw * .25, 23)} y={185 - h} width={Math.min(bw * .5, 46)} height={Math.max(h, 2)} rx="6" />{i % Math.ceil(data.length / 8) === 0 && <text x={cx} y="212" textAnchor="middle" fontSize="11" fill="var(--mu)">{x.l}</text>}</g>; })}
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

/* ---------- clients ---------- */
function Clients({ d, open }) {
  const [q, setQ] = useViewState('clients.query',''), [arch, setArch] = useViewState('clients.archived',false);
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

function ClientPage({ d, mut, open, id, removeItem, user, demo, toast, shares }) {
  const [section,setSection]=useViewState('client.'+id+'.section','overview');
  const c = d.clients.find((x) => x.id === id);
  if (!c) return <><Back to="clients" label="Clients" /><Empty m="This client could not be found." /></>;
  const info = [['Email', c.email], ['Phone', c.phone], ['Address', c.address], ['Notes', c.notes]].filter(([, v]) => v);
  const active = d.projects.some(p => p.client === id && p.status === 'Active');
  return (<>
    <Back to="clients" label="Clients" />
    <div className="page-head"><span className="avatar-xl">{(c.name || '?').split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase()}</span>
      <div className="grow"><h1>{c.name}</h1><div className="tag-row">{c.arch ? <span className="chip white">Archived</span> : <span className={'chip ' + (active ? 'sage' : 'white')}>{active ? 'Active' : 'No active projects'}</span>}{c.email && <span>{c.email}</span>}{c.phone && <span>· {c.phone}</span>}</div><ClientLinks links={c.links} /></div>
      <button className="ghost" onClick={() => open('client', c)}>Edit</button><button className="btn" onClick={() => open('invoice', { client: id })}>+ Invoice</button>
    </div>
    <div className="section-tabs" role="group" aria-label="Client sections">{[['overview','Overview'],['work','Work'],['notes','Notes & checklists'],['files','Files & docs'],['invoices','Invoices'],['access','Client access']].map(([key,title])=><button type="button" key={key} aria-pressed={section===key} onClick={()=>setSection(key)}>{title}</button>)}</div>
    {section==='overview'&&<section aria-label="Client overview" style={{display:'grid',gap:16}}><ClientSummary d={d} c={c} user={user} demo={demo} share={(shares || []).find(s => s.id === id)} toast={toast} onAccess={() => setSection('access')} /><div className="card">{info.length ? info.map(([k, v]) => <p key={k} style={{ margin: '4px 0', whiteSpace: 'pre-line' }}><small>{k}</small><br />{v}</p>) : !c.links?.length && <p className="mu">No contact details yet.</p>}{c.links?.length > 0 && <div style={{ margin: '8px 0 4px' }}><small>Links</small><ul className="client-link-list">{c.links.map((l, i) => <li key={i}><a href={l.url} target="_blank" rel="noopener noreferrer"><b>{linkName(l)}</b><span>{l.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}</span></a></li>)}</ul></div>}</div>
<div className="client-summary-grid">{[['Projects',d.projects.filter(p=>p.client===id).length,'work'],['Open tasks',d.tasks.filter(t=>t.client===id&&t.status!=='Done'&&!t.arch).length,'work'],['Invoices',d.invoices.filter(i=>i.client===id).length,'invoices']].map(([label,count,target])=><button className="card client-summary" key={label} onClick={()=>setSection(target)}><strong>{count}</strong><span>{label}</span></button>)}</div><details className="card"><summary>Activity timeline</summary><Timeline d={d} client={id}/></details>
      <div className="end" style={{ justifyContent: 'flex-start', margin: 0 }}><button className="ghost sm" onClick={() => mut((n) => { const x = n.clients.find((y) => y.id === id); x.arch = !x.arch; })}>{c.arch ? 'Restore client' : 'Archive client'}</button><button className="ghost danger sm" onClick={() => removeItem('clients',id)}>Delete client</button></div></section>}
    {section==='work'&&<section aria-label="Client work">    <div className="hd" style={{ marginTop: 16 }}><h3 style={{ margin: 0 }}>Projects</h3><button className="ghost sm" onClick={() => open('project', { client: id })}>+ Project</button></div>
    {d.projects.filter((p) => p.client === id).map((p) => <a className="row project-row" key={p.id} href={'#/projects/' + p.id}><b>{p.name}</b><span className="b">{p.status}</span></a>)}
    {!d.projects.some((p) => p.client === id) && <p className="mu">No projects yet.</p>}
    <div className="hd" style={{ marginTop: 16 }}><h3 style={{ margin: 0 }}>Tasks</h3><button className="ghost sm" onClick={() => open('task', { client: id })}>+ Task</button></div>
    {d.tasks.filter((k) => k.client === id).map((k) => <a className="row" key={k.id} href={'#/tasks/' + k.id}><div><b>{k.title}</b><small>{k.status}{blockers(d,k).length?' · Blocked':''}{k.due ? ` · due ${k.due}` : ''}</small></div><span aria-hidden="true">›</span></a>)}
    {!d.tasks.some((k) => k.client === id) && <p className="mu">No tasks yet.</p>}
</section>}
    {section==='notes'&&<NoteBoard d={d} mut={mut} toast={toast} scope={{client:id}} onFiles={()=>setSection('files')}/>}
    {section==='files'&&<FilesAndDocs d={d} mut={mut} toast={toast} scope={{kind:'client',id}} user={user} demo={demo}/>}
    {section==='invoices'&&<section aria-label="Client invoices">    <div className="hd" style={{ marginTop: 16 }}><h3 style={{ margin: 0 }}>Invoices</h3><button className="ghost sm" onClick={() => open('invoice', { client: id })}>+ Invoice</button></div>
    {d.invoices.filter((i) => i.client === id).map((i) => <a className="row" key={i.id} href={'#/invoices/' + i.id}><div><b>{i.no}{i.title ? ' · ' + i.title : ''}</b><small>Total {money(calc(i).total)} · Balance {money(calc(i).bal)}</small></div><Badge s={status(i)} /></a>)}
    {!d.invoices.some((i) => i.client === id) && <p className="mu">No invoices yet.</p>}
</section>}
    {section==='access'&&<Suspense fallback={<ScreenLoading label="Loading client access"/>}><PortalManager d={d} user={user} demo={demo} client={c} toast={toast}/></Suspense>}
  </>);
}

/* ---------- project page ---------- */
function ProjectPage({ d, mut, open, id, removeItem, user, demo, toast }) {
  const [section,setSection]=useViewState('project.'+id+'.section','tasks');
  const p = d.projects.find(x => x.id === id);
  if (!p) return <><Back to="projects" label="Projects" /><Empty m="This project could not be found." /></>;
  const tasks = d.tasks.filter(t => t.project === id && !t.arch), done = tasks.filter(t => t.status === 'Done').length, budget = projectBudget(d,p);
  return <>
    <Back to="projects" label="Projects" />
    <div className="page-head"><div className="grow"><h1>{p.name}</h1><div className="tag-row"><span className={'chip ' + (p.status === 'Active' ? 'hero' : p.status === 'Complete' ? 'sage' : 'sand')}>{p.status}</span>{p.client && <a href={'#/clients/' + p.client}>{L.cname(d,p.client)}</a>}{p.start && <span>· {p.start}{p.end ? ' – ' + p.end : ' · ongoing'}</span>}<span>· {done} of {tasks.length} tasks complete</span></div></div>
      <button className="ghost" onClick={() => open('project', p)}>Edit</button><button className="btn" onClick={() => open('task', { project: id, client: p.client })}>+ Task</button></div>
    <div className="section-tabs" role="group" aria-label="Project sections">{[['tasks','Tasks ' + tasks.length],['notes','Notes'],['files','Files & docs'],['budget','Budget']].map(([key,title])=><button type="button" key={key} aria-pressed={section===key} onClick={()=>setSection(key)}>{title}</button>)}</div>
    {section==='tasks'&&<section aria-label="Project tasks">{tasks.length ? tasks.map(k => <div className="row task-row" data-priority={k.priority || 'None'} key={k.id}><button className="chk" aria-pressed={k.status === 'Done'} aria-label={k.status === 'Done' ? 'Mark not done' : 'Mark complete'} onClick={() => toggleTask(mut, k.id)}>{k.status === 'Done' ? '☑' : '☐'}</button><a className="grow" href={'#/tasks/' + k.id}><b style={{ textDecoration: k.status === 'Done' ? 'line-through' : 'none' }}>{k.title}</b><small>{k.status}{k.due ? ` · due ${k.due}` : ''}{k.priority ? ` · ${k.priority} priority` : ''}</small></a></div>) : <Empty m="No tasks yet for this project." label="Add task" onClick={() => open('task', { project: id, client: p.client })} />}</section>}
    {section==='notes'&&<NoteBoard d={d} mut={mut} toast={toast} scope={{project:id}} onFiles={()=>setSection('files')}/>}
    {section==='files'&&<FilesAndDocs d={d} mut={mut} toast={toast} scope={{kind:'project',id}} user={user} demo={demo}/>}
    {section==='budget'&&(() => { const u = unbilled(d, id); const bill = () => { const next = structuredClone(d); let invoiceId; try { invoiceId = invoiceUnbilledHours(next, id); } catch (e) { toast(e.message); return; } mut(n => { invoiceUnbilledHours(n, id); }); toast(`Draft invoice created for ${u.billable}h. Check it, then send.`); window.location.hash = '#/invoices/' + invoiceId; };
      return <section className="budget-grid" aria-label="Project budget">
        <div className="card"><span className="eyebrow">TIME LOGGED</span><p className="budget-big">{budget.hours.toFixed(1)}h</p><p className="mu" style={{ margin: 0 }}>{budget.budget ? `of ${budget.budget}h budget · ${budget.over ? budget.over.toFixed(1) + 'h over' : budget.remaining.toFixed(1) + 'h left'}` : 'No budget set'}{p.hourlyRate ? ` · ${money(budget.value)} at ${money(p.hourlyRate)}/h` : ''}</p>{budget.budget > 0 && <div className="portal-progress" style={{ marginTop: 12 }}><i style={{ width: Math.min(100, budget.hours / budget.budget * 100) + '%' }} /></div>}</div>
        <div className={'card unbilled-card' + (u.billable > 0 ? ' has' : '')}><span className="eyebrow">NOT INVOICED YET</span><p className="budget-big">{u.billable}h{u.rate > 0 && <small> · {money(u.value)}</small>}</p>
          {!p.hourlyRate ? <p className="mu" style={{ margin: 0 }}>Add an hourly rate in Edit (tick “Track an effort budget”) to invoice logged time.</p>
            : !p.client ? <p className="mu" style={{ margin: 0 }}>Give this project a client to invoice its time.</p>
            : u.billable > 0 ? <button className="btn" onClick={bill}><Icon name="invoices" size={16} />Invoice unbilled hours</button>
            : <p className="mu" style={{ margin: 0 }}>All logged time is on an invoice. Use the Focus timer on a task to log more.</p>}</div>
      </section>; })()}
    <div className="end" style={{ justifyContent: 'flex-start', marginTop: 24 }}><button className="ghost sm" onClick={()=>mut(n=>{const row=n.projects.find(x=>x.id===id);row.arch=!row.arch;})}>{p.arch?'Unarchive project':'Archive project'}</button><button className="ghost danger sm" onClick={() => removeItem('projects',id)}>Delete project</button></div>
  </>;
}

/* ---------- projects ---------- */
function Projects({ d, mut, open, removeItem }) {
  const [query, setQuery] = useViewState('projects.query',''), [filter, setFilter] = useViewState('projects.status',''),[archived,setArchived]=useViewState('projects.archived',false);
  const projects = d.projects.filter(p => (archived || !p.arch) && (!filter || p.status === filter) && (p.name + ' ' + L.cname(d,p.client)).toLowerCase().includes(query.toLowerCase()));
  return <>
    <div className="hd"><h1>Projects <span className="heading-count">{d.projects.length}</span></h1><button className="btn" onClick={() => open('project')}><Icon name="plus" size={17} />Add project</button></div>
    <div className="list-toolbar"><div className="search-field"><Icon name="search" size={17} /><input aria-label="Search projects" placeholder="Find a project or client…" value={query} onChange={e => setQuery(e.target.value)} /></div><Select aria-label="Filter projects by status" value={filter} onChange={e => setFilter(e.target.value)}><option value="">All statuses</option>{['Active','On hold','Complete'].map(x => <option key={x}>{x}</option>)}</Select></div>
    <label className="archive-toggle"><input type="checkbox" checked={archived} onChange={e=>setArchived(e.target.checked)}/>Show archived projects</label><div className="context-actions"><a className="ghost sm" href="#/templates">Project templates</a></div><div className="project-grid">{projects.map(p => { const tasks = d.tasks.filter(t => t.project === p.id), done = tasks.filter(t => t.status === 'Done').length, budget=projectBudget(d,p); return <article className="project-card" key={p.id}><a className="project-open" href={'#/projects/' + p.id}><div className="project-card-top"><Icon name="projects" size={23} /><span className="b">{p.status}</span></div><small className="project-client">{p.client ? L.cname(d,p.client) : 'No client'}</small><h3 title={p.name}>{p.name}</h3>{(budget.budget>0||budget.hours>0)&&<p className="project-budget-summary">{budget.hours.toFixed(1)}h logged{budget.budget?` / ${budget.budget}h · ${budget.over?budget.over.toFixed(1)+'h over':budget.remaining.toFixed(1)+'h left'}`:''}{p.hourlyRate?' · Time value '+money(budget.value):''}</p>}<div className="project-card-bottom"><span>{done} of {tasks.length} tasks complete</span><Icon name="arrow" size={16} /></div><div className="progress-track"><span style={{width: (tasks.length ? done/tasks.length*100 : 0) + '%'}} /></div></a><div className="project-actions"><button className="ghost sm" onClick={()=>mut(n=>{const row=n.projects.find(x=>x.id===p.id);row.arch=!row.arch;})}>{p.arch?'Unarchive':'Archive'}</button><button type="button" className="ghost danger sm project-delete" aria-label={'Delete project '+p.name} onClick={() => removeItem('projects',p.id)}>Delete</button></div></article>; })}</div>
    {!projects.length && <Empty m={d.projects.length ? 'No projects match your search.' : 'No projects yet. Link your first project to a client.'} label={d.projects.length ? '' : 'Add project'} onClick={() => open('project')} />}
  </>;
}

/* ---------- tasks ---------- */
// One task in a list: tick, title, where it belongs, and chips for priority, due date and client approval.
const APPROVAL_TAG = { pending: ['Waiting for client', 'hero'], approved: ['Approved', 'sage'], changes: ['Changes requested', 'sand'] };
function TaskRow({ k, d, mut, removeItem, t, hideProject = false }) {
  const project = d.projects.find(p => p.id === k.project), late = k.due && k.status !== 'Done' && k.due < t;
  return <div className={'row task-row' + (k.status === 'Done' ? ' done' : '')} data-priority={k.priority || 'None'}>
    <button className="chk" aria-pressed={k.status === 'Done'} aria-label={k.status === 'Done' ? 'Mark not done' : 'Mark complete'} onClick={() => toggleTask(mut, k.id)}>{k.status === 'Done' ? '☑' : '☐'}</button>
    <a className="grow" href={'#/tasks/' + k.id}><b style={{ textDecoration: k.status === 'Done' ? 'line-through' : 'none' }}>{k.title}</b>
      <span className="task-chips">{k.status === 'In progress' && <span className="chip sand">In progress</span>}{k.priority && <span className={'chip pri-' + k.priority.toLowerCase()}>{k.priority}</span>}{k.due && <span className={'chip ' + (late ? 'hero' : 'white')}>{late ? 'Overdue · ' : k.due === t ? 'Today · ' : ''}{new Date(k.due + 'T12:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span>}{k.approval && <span className={'chip ' + APPROVAL_TAG[k.approval.state][1]}>{APPROVAL_TAG[k.approval.state][0]}</span>}{!hideProject && project && <small>{project.name}</small>}{!project && k.client && <small>{L.cname(d, k.client)}</small>}</span></a>
    <button className="ghost sm" onClick={() => mut(n => { const row = n.tasks.find(x => x.id === k.id); row.arch = !row.arch; })}>{k.arch ? 'Unarchive' : 'Archive'}</button><button type="button" className="ghost danger sm" aria-label={'Delete task ' + k.title} onClick={() => removeItem('tasks', k.id)}>Delete</button>
  </div>;
}
const toggleTask = (mut, id) => mut((n) => { const x = n.tasks.find((y) => y.id === id); x.status = x.status === 'Done' ? 'Todo' : 'Done'; });

function Tasks({ d, mut, open, taskflow, removeItem }) {
  const [f, setF] = useViewState('tasks.filters',{ status: '', due: '', client: '', project: '' }),[archived,setArchived]=useViewState('tasks.archived',false),[group,setGroup]=useViewState('tasks.group','list'), t = today();
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
    <div className="tabs-pill task-view" role="group" aria-label="Show tasks as">{[['list', 'List'], ['project', 'By project']].map(([k, l]) => <button key={k} type="button" aria-pressed={group === k} onClick={() => setGroup(k)}>{l}</button>)}</div>
    {a.length ? (group === 'project'
      ? [...new Set(a.map(k => k.project || ''))].sort((x, y) => (!x) - (!y) || (d.projects.find(p => p.id === x)?.name || '').localeCompare(d.projects.find(p => p.id === y)?.name || '')).map(pid => { const p = d.projects.find(x => x.id === pid), list = a.filter(k => (k.project || '') === pid), done = list.filter(k => k.status === 'Done').length;
        return <section key={pid || 'none'} className="task-group"><div className="task-group-head">{p ? <a href={'#/projects/' + p.id}><b>{p.name}</b></a> : <b>No project</b>}{p?.client && <small>{L.cname(d, p.client)}</small>}<span className="grow" /><small>{done}/{list.length} done</small><button type="button" className="ghost sm" onClick={() => open('task', p ? { project: p.id, client: p.client } : {})}>+ Task</button></div>{list.map(k => <TaskRow key={k.id} k={k} d={d} mut={mut} removeItem={removeItem} t={t} hideProject />)}</section>; })
      : a.map(k => <TaskRow key={k.id} k={k} d={d} mut={mut} removeItem={removeItem} t={t} />))
      : <Empty m={d.tasks.length ? 'No tasks match these filters.' : 'No tasks yet. Add one to see what is due.'} label={d.tasks.length ? '' : 'Add task'} onClick={() => open('task')} />}
    <TaskflowPanel taskflow={taskflow} />
  </>);
}

const PRIORITY_CHIP = { High: 'hero', Medium: 'sand', Low: 'sage' };
const STATUS_CHIP = { Todo: 'white', 'In progress': 'sand', Done: 'sage' };
function TaskPage({ d, mut, open, ask, id, removeItem, toast, user, demo, comments, shares }) {
  const k = d.tasks.find((x) => x.id === id);
  if (!k) return <><Back to="tasks" label="Tasks" /><Empty m="This task could not be found." /></>;
  const project = d.projects.find(p => p.id === k.project), clientId = k.client || project?.client || '';
  const setStatus = status => mut(n => { const t = n.tasks.find(x => x.id === id); t.status = status; });
  const when = iso => new Date(iso + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const late = k.due && k.status !== 'Done' && k.due < today();
  const details = [
    ['calendar', 'Due', k.due ? when(k.due) + (late ? ' · overdue' : '') : 'No due date', late],
    ['planner', 'Scheduled', k.scheduledAt ? new Date(k.scheduledAt).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) + ' · ' + (k.durationMinutes || 60) + ' min' : 'Not scheduled'],
    ['focus', 'Repeats', repeatLabel(k.repeat, k.repeatDays)],
    ['clients', 'Client', clientId ? <a href={'#/clients/' + clientId}>{L.cname(d, clientId)}</a> : 'No client'],
    ['projects', 'Project', project ? <a href={'#/projects/' + project.id}>{project.name}</a> : 'No project'],
  ];
  return (<>
    <Back to="tasks" label="Tasks" />
    <section className={'task-hero status-' + (k.status || 'Todo').replace(' ', '-').toLowerCase()}>
      <div className="task-hero-chips"><span className={'chip ' + STATUS_CHIP[k.status || 'Todo']}>{k.status || 'Todo'}</span>{k.priority && <span className={'chip ' + PRIORITY_CHIP[k.priority]}>{k.priority} priority</span>}{k.approval && <span className="chip ink">Approval: {({ pending: 'waiting', approved: 'approved', changes: 'changes requested' })[k.approval.state]}</span>}</div>
      <h1>{k.title}</h1>
      <div className="task-hero-actions">
        <div className="status-switch" role="group" aria-label="Status">{['Todo', 'In progress', 'Done'].map(s => <button key={s} type="button" aria-pressed={(k.status || 'Todo') === s} onClick={() => setStatus(s)}>{s === 'Done' && <Icon name="check" size={15} />}{s}</button>)}</div>
        <span className="grow" />
        <button className="ghost sm" onClick={() => open('task', k)}>Edit</button>
        <button className="ghost danger sm" onClick={() => removeItem('tasks', id)}>Delete</button>
      </div>
    </section>
    <div className="task-layout">
      <div className="task-main">
        <ClientThread d={d} task={k} clientId={clientId} comments={(comments || []).filter(c => c.itemId === k.id)} shared={(shares || []).some(s => s.id === clientId)} user={user} demo={demo} toast={toast} />
        <ApprovalBox d={d} mut={mut} user={user} demo={demo} item={k} kind="task" toast={toast}/>
        <RecordExtras d={d} mut={mut} task={k} toast={toast}/>
      </div>
      <aside className="task-side">
        <dl className="card task-details">{details.map(([icon, label, value, warn]) => <div key={label} className={warn ? 'warn' : ''}><dt><Icon name={icon} size={15} />{label}</dt><dd>{value}</dd></div>)}</dl>
        <Focus d={d} mut={mut} toast={toast} taskId={id}/>
      </aside>
    </div>
  </>);
}

// The conversation with the client about this task: their comments, cheers and change requests, and your replies.
function ClientThread({ d, task, clientId, comments, shared, user, demo, toast }) {
  const [text, setText] = useState(''), [busy, setBusy] = useState(false), client = d.clients.find(c => c.id === clientId);
  if (!client) return null;
  const send = async e => { e.preventDefault(); if (!text.trim()) return; setBusy(true); try { await sendOwnerComment(user, clientId, task.id, text); setText(''); } catch { toast('Your reply could not be sent. Check your connection and try again.'); } finally { setBusy(false); } };
  return <section className="card client-thread">
    <div className="block-head" style={{ margin: 0 }}><h3><Icon name="notes" size={18} /> Talk with {client.name}</h3>{comments.length > 0 && <span className="chip white">{comments.length}</span>}</div>
    {demo ? <p className="empty-note" style={{ margin: 0 }}>In your signed-in workspace, {client.name} can comment on this task from their portal, and you can reply here.</p>
      : !shared ? <p className="empty-note" style={{ margin: 0 }}>Set up <a href={'#/clients/' + clientId}>Client access</a> so {client.name} can comment on shared tasks and you can reply here.</p>
      : <>{comments.length ? <ul className="thread-list">{comments.map(c => <li key={c.id} className={'thread-msg ' + (c.from === 'owner' ? 'client' : 'owner') + ' ' + c.kind}><span className="thread-who">{c.from === 'owner' ? 'You' : client.name}{c.kind === 'change' && <span className="chip sand">Change request</span>}<small>{c.at ? new Date(c.at).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : 'Sending…'}</small></span><p>{c.text}</p></li>)}</ul> : <p className="empty-note" style={{ margin: 0 }}>No comments yet. {client.name} can comment from their portal when this task’s project is shared.</p>}
        <form className="thread-form" onSubmit={send}><textarea rows="2" maxLength={1000} aria-label={'Reply to ' + client.name} placeholder={'Reply to ' + client.name + '…'} value={text} onChange={e => setText(e.target.value)} /><button className="btn sm" disabled={busy || !text.trim()}>Send</button></form></>}
  </section>;
}

/* ---------- invoices ---------- */
function Invoices({ d, open }) {
  const [fs, setFs] = useViewState('invoices.status','');
  const a = d.invoices.filter((i) => !fs || status(i) === fs).sort((x, y) => y.no.localeCompare(x.no));
  return (<>
    <div className="hd"><h1>Invoices <span className="heading-count">{d.invoices.length}</span></h1><button className="btn" onClick={() => open('invoice')}>Create invoice</button></div>
    <div className="context-actions"><a className="ghost sm" href="#/recurring">Recurring drafts</a></div><div className="invoice-summary"><div><small>Awaiting payment</small><strong>{money(L.outstanding(d))}</strong></div><div><small>Overdue</small><strong>{money(d.invoices.filter(i => status(i) === 'Overdue').reduce((sum,i) => sum + calc(i).bal,0))}</strong></div><div><small>Draft invoices</small><strong>{d.invoices.filter(i => i.state === 'draft').length}</strong></div></div>
    <Sel l="Status" o={[['', 'All'], 'Draft', 'Sent', 'Partially paid', 'Paid', 'Overdue', 'Void']} value={fs} onChange={(e) => setFs(e.target.value)} />
    {a.length ? a.map((i) => { const c = calc(i); return (
      <a className="row" key={i.id} href={'#/invoices/' + i.id}>
        <div><b>{i.no} · {L.cname(d, i.client)}</b><small>Total {money(c.total)} · Balance {money(c.bal)} · Due {i.due}</small></div><Badge s={status(i)} />
      </a>); }) : <Empty m={d.invoices.length ? 'No invoices with that status.' : 'No invoices yet. Create one for a client.'} label={d.invoices.length ? '' : 'Create invoice'} onClick={() => open('invoice')} />}
  </>);
}

function InvoicePage({ d, mut, open, ask, id, removeItem, toast, user, demo }) {
  const i = d.invoices.find((x) => x.id === id);
  const editor = useInvoiceEdit(i, d, mut, toast);
  if (!i) return <><Back to="invoices" label="Invoices" /><Empty m="This invoice could not be found." /></>;
  const c = calc(i), s = status(i), cl = d.clients.find((x) => x.id === i.client) || {};
  const upd = (fn) => mut((n) => fn(n.invoices.find((x) => x.id === id)));
  const pdf = () => { const t = document.title; document.title = i.no + (cl.name ? ' - ' + cl.name : ''); window.print(); setTimeout(() => { document.title = t; }, 1000); };
  const reissue = () => { let number;try{number=nextInvoiceNumber(d);}catch(error){toast(error.message);return;} const nid = rid(); mut((n) => { n.seq=number.seq; n.invoices.push(L.reissuedInvoice(i,nid,number.no)); }); nav('invoices', nid); };
  return (<>
    <div className="noprint">
      <Back to="invoices" label="Invoices" />
      <div className="page-head"><div className="grow"><h1>{i.no} <Badge s={s} /></h1><p className="empty-note" style={{ margin: '6px 0 0' }}>{editor.editing ? 'Click any highlighted text to change it. Empty fields use your defaults.' : i.title || L.cname(d, i.client)}</p></div>
        <div className="end" style={{ margin: 0 }}>
          {editor.editing ? <><button className="ghost sm" onClick={editor.cancel}>Discard</button><button className="btn sm" onClick={editor.save}>Save invoice</button></> : <>
          {i.state === 'draft' && <><button className="ghost sm" onClick={editor.start}>Edit on the invoice</button><button className="btn sm" onClick={() => upd((x) => { x.state = 'sent'; })}>Mark as sent</button></>}
          {i.state === 'sent' && <>{c.bal >= 0.005 && <button className="btn sm" onClick={() => open('pay', i)}>Record payment</button>}
            <button className="ghost sm" onClick={() => ask('Void this invoice? It will no longer count as outstanding. You can reissue a corrected draft afterwards.', () => upd((x) => { x.state = 'void'; }))}>Void</button></>}
          {i.state === 'void' && <button className="btn sm" onClick={reissue}>Void &amp; reissue as new draft</button>}
          <button className="ghost sm" onClick={pdf}>Download PDF</button>
          <button className="ghost danger sm" onClick={() => removeItem('invoices',id)}>Delete invoice</button></>}
        </div></div>
      {!editor.editing && <small>Download PDF opens your browser's print window. Choose "Save as PDF" as the destination.</small>}
    </div>
    <div className={editor.editing ? 'two-col sheet-edit' : ''} style={{ marginTop: 12 }}>
      <InvoiceSheet i={i} d={d} edit={editor.api} />
      {editor.panel}
    </div>
    {!editor.editing && <div className="noprint"><ApprovalBox d={d} mut={mut} user={user} demo={demo} item={i} kind="quote" toast={toast}/></div>}
    {!editor.editing && <div className="noprint">
      <h3>Payments</h3>
      {i.pays.length ? i.pays.map((p) => <div className="row" key={p.id}><div className="grow"><b>{money(num(p.amt))}</b><small>{p.date}{p.note ? ' · ' + p.note : ''}</small></div><button className="ghost danger sm" onClick={() => removeItem('payments',p.id,i.id)}>Delete payment</button></div>) : <p className="mu">No payments recorded yet.</p>}
    </div>}
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
function Settings({ d, mut, toast, ask, user, logout, demo, saving, signingOut, startOnboarding, startTour, offlineReady, id, theme, setTheme }) {
  const s = d.settings, sections = [['general','General'],['invoices','Invoices & bank'],['appearance','Appearance'],['data','Data & connections'],['whats-new',"What's new"],['account','Account']];
  const [active, setActive] = useState(sections.some(([k]) => k === id) ? id : 'general');
  // One long page: the tab bar follows the section you are reading, and a tab click scrolls to its section.
  useEffect(() => {
    const target = sections.some(([k]) => k === id) && id !== 'general' ? document.getElementById('settings-' + id) : null;
    if (target) requestAnimationFrame(() => target.scrollIntoView({ block: 'start' }));
    const seen = new Map(), io = new IntersectionObserver(entries => { for (const e of entries) seen.set(e.target.id, e.isIntersecting ? e.boundingClientRect.top : null); const top = [...seen].filter(([, v]) => v !== null).sort((a, b) => a[1] - b[1])[0]; if (top) setActive(top[0].replace('settings-', '')); }, { rootMargin: '-140px 0px -55% 0px' });
    sections.forEach(([k]) => { const el = document.getElementById('settings-' + k); if (el) io.observe(el); });
    return () => io.disconnect();
  }, []);
  const go = k => { setActive(k); document.getElementById('settings-' + k)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); history.replaceState(null, '', '#/settings/' + k); };
  const del = () => ask('This permanently deletes your SoloDesk workspace, clients, projects, tasks, invoices and public profile. Your shared TaskFlow sign-in is kept. Consider exporting a backup first.', async () => {
    if (demo) { localStorage.removeItem('sd_demo'); await logout({force:true}); return; }
    try {
      await reauthenticateWithPopup(user, provider);
      const shares=await getDocs(collection(fdb,'solodeskPortals',user.uid,'shares'));
      for(let i=0;i<shares.docs.length;i+=400){const batch=writeBatch(fdb);shares.docs.slice(i,i+400).forEach(s=>batch.delete(s.ref));await batch.commit();}
      if(d.profile?.username)await deleteDoc(doc(fdb,PROFILE_COLLECTION,d.profile.username)).catch(()=>{});
      const parts=await getDocs(collection(fdb,workspaceCollection,user.uid,'parts'));
      for(let i=0;i<parts.docs.length;i+=400){const batch=writeBatch(fdb);parts.docs.slice(i,i+400).forEach(s=>batch.delete(s.ref));await batch.commit();}
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
    <div className="page-head"><div className="grow"><h1>Settings</h1><p className="empty-note" style={{ margin: '6px 0 0' }}>Make SoloDesk yours. SoloDesk {currentVersion()}.</p></div></div>
    <nav className="tabs-pill settings-tabs" aria-label="Settings sections">{sections.map(([k,l])=><a key={k} href={'#/settings/'+k} aria-current={active===k?'true':undefined} onClick={e=>{e.preventDefault();go(k);}}>{l}</a>)}</nav>
    <section id="settings-general" className="settings-section"><form className="card form-grid" onSubmit={(e) => { e.preventDefault(); const o = Object.fromEntries(new FormData(e.target)); mut((n) => { Object.assign(n.settings, o); }); toast('Settings saved.'); }}>
      <h2 className="full" style={{margin:0}}>General</h2><p className="full empty-note" style={{margin:0}}>Your business details, currency and logo. These appear on invoices.</p>
      <Fld l="Business name" name="biz" defaultValue={s.biz} /><Fld l="Business email" name="email" type="email" defaultValue={s.email} /><Fld l="Phone" name="phone" defaultValue={s.phone} />
      <Sel l="Default currency" name="cur" o={['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'INR', 'JPY', 'CHF']} defaultValue={s.cur} />
      <label className="full">Address<textarea name="addr" rows="2" defaultValue={s.addr} /></label>
      <label className="full">Logo (PNG or JPG, shown on invoices)<FileInput accept="image/png,image/jpeg" onChange={pick} /></label>
      {s.logo && <div className="row full"><img src={s.logo} alt="Current logo" style={{ maxHeight: 48, maxWidth: '60%' }} /><button type="button" className="ghost danger sm" onClick={() => mut((n) => { n.settings.logo = ''; })}>Remove logo</button></div>}
      <button className="btn" style={{justifySelf:'start'}}>Save settings</button>
    </form></section>
    <section id="settings-invoices" className="settings-section"><InvoiceDefaults d={d} mut={mut} toast={toast}/></section>
    <section id="settings-appearance" className="settings-section"><AppearanceSettings d={d} mut={mut} theme={theme} setTheme={setTheme}/></section>
    <section id="settings-data" className="settings-section"><div className="card"><h2 style={{marginTop:0}}>Data & connections</h2><p>Manage TaskFlow, export CSVs, and back up or restore your workspace in one place. Link Excel workbooks from a client’s or project’s Files & docs.</p><div className="context-actions"><a className="btn" href="#/integrations">Open data & connections</a><a className="ghost" href="#/backups">Backup & restore</a><a className="ghost" href="#/trash">Trash</a></div><h3>Offline access</h3><p>{offlineReady?'SoloDesk is ready to open offline on this device.':'Offline access becomes ready after the hosted app has loaded and finished preparing.'}</p><p>Keep this tab open for recovery after a reload or reconnect. Export a backup for longer-term storage. Signing out clears the current account’s recovery copy.</p><h3>Getting started</h3><ReplayIntroduction onOnboarding={startOnboarding} onTour={startTour}/><InstallApp/></div></section>
    <section id="settings-whats-new" className="settings-section"><WhatsNew/></section>
    <section id="settings-account" className="settings-section"><div className="card account-settings"><h2 style={{marginTop:0}}>Account</h2><p className="mu">{demo ? 'You are exploring the demo with sample data.' : 'Signed in as ' + (user?.email || user?.displayName || 'your Google account') + '.'} Signing out returns to the login page. Workspace deletion keeps your shared TaskFlow account.</p><div className="end" style={{ justifyContent: 'flex-start' }}><button className="ghost" disabled={signingOut} onClick={logout}>{signingOut ? 'Signing out…' : 'Sign out'}</button><button className="ghost danger" disabled={signingOut || (!demo && saving === 'saving')} onClick={del}>Delete SoloDesk workspace</button></div></div></section>
  </>);
}

/* ---------- client summary: portal, approvals, links in one place ---------- */
function ClientSummary({ d, c, user, demo, share, toast, onAccess }) {
  const items = approvalItems(d).filter(x => approvalClient(d, x.row) === c.id);
  const waiting = items.filter(x => x.row.approval.state === 'pending').length, changes = items.filter(x => x.row.approval.state === 'changes').length;
  const url = user && share ? window.location.origin + '/#/portal/' + user.uid : '';
  const copy = async () => { try { await navigator.clipboard.writeText(url); toast('Portal link copied.'); } catch { toast('Copy the link from Client access.'); } };
  return <div className="client-summary-card">
    <div className="cs-block cs-portal"><span className="eyebrow">CLIENT PORTAL</span>{share ? <><b><span className="live-dot" /> Live</b><small>{share.recipientEmail}{share.data?.updatedAt ? ' · updated ' + new Date(share.data.updatedAt).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : ''}</small><div className="cs-actions"><button className="btn sm" onClick={copy}><Icon name="link" size={15} />Copy portal link</button><a className="ghost sm" href={'#/portal/' + user.uid} target="_blank" rel="noopener noreferrer">Preview ↗</a></div></>
      : <><b>Not shared yet</b><small>{demo ? 'Client access works in your signed-in workspace.' : 'Give ' + c.name + ' a login to see progress, approve work and comment.'}</small><div className="cs-actions"><button className="ghost sm" onClick={onAccess}>Set up client access</button></div></>}</div>
    <a className="cs-block cs-approvals" href="#/approvals"><span className="eyebrow">APPROVALS</span><b>{waiting} waiting</b><small>{changes ? `${changes} with changes requested` : items.length ? `${items.filter(x => x.row.approval.state === 'approved').length} approved` : 'Nothing sent yet'}</small></a>
    <div className="cs-block cs-links"><span className="eyebrow">LINKS</span>{c.links?.length ? <ClientLinks links={c.links} /> : <small>No links yet. Add them with Edit.</small>}</div>
  </div>;
}

/* ---------- task form ---------- */
// Type the task in one line ("Call Ava tomorrow at 7pm for Website launch") and the fields below fill in,
// as in TaskFlow. A field you change yourself stays as you set it.
function TaskForm({ v, d, cOpts, close, save, removeItem }) {
  const base = { priority: v.priority || '', repeat: v.repeat || '', repeatDays: v.repeatDays || null, due: v.due || '', client: v.client || '', project: v.project || '', scheduledAt: localDateTime(v.scheduledAt) };
  const [text, setText] = useState(v.title || ''), [f, setF] = useState(base), [manual, setManual] = useState(() => new Set()), [parsed, setParsed] = useState(null);
  const type = value => {
    setText(value);
    const p = parseTask(value, d);
    setParsed(p.chips.length ? p : null);
    setF(old => {
      const next = { ...old }, from = { priority: p.priority, repeat: p.repeat, repeatDays: p.repeatDays, due: p.due, client: p.client, project: p.project, scheduledAt: p.time ? p.due + 'T' + p.time : '' };
      for (const k of Object.keys(base)) if (!manual.has(k === 'repeatDays' ? 'repeat' : k)) next[k] = from[k] || base[k];
      return next;
    });
  };
  const set = k => e => { const value = e.target.value; setManual(m => new Set(m).add(k)); setF(old => ({ ...old, [k]: value, ...(k === 'project' && value && !old.client ? { client: d.projects.find(p => p.id === value)?.client || '' } : {}) })); };
  const title = parsed?.title || text.trim();
  return <Modal title={v.id ? 'Edit task' : 'New task'} onDelete={v.id ? () => removeItem('tasks',v.id) : undefined} onClose={close} onSubmit={(o) => { const days = f.repeat === 'custom' ? (f.repeatDays?.length ? f.repeatDays : [new Date((f.due || today()) + 'T12:00:00').getDay()]) : null; const { repeatDays, ...rest } = f; save('tasks', { ...o, ...rest, title, ...(days ? { repeatDays: days } : { repeatDays: undefined }) }); }}>
    <SmartField label="Title" required value={text} onChange={type} workspace={d} chips={parsed ? taskChips(parsed, d) : []} hint={v.id ? null : 'Try “Send the draft to Ava tomorrow at 7pm” — dates, times, clients and projects fill in as you type.'} />
    <div className="grid2"><Sel l="Status" name="status" o={['Todo', 'In progress', 'Done']} defaultValue={v.status || 'Todo'} /><Sel l="Priority" o={[['', 'None'], 'Low', 'Medium', 'High']} value={f.priority} onChange={set('priority')} /></div>
    <Sel l="Repeat task after completion" o={frequencies} value={f.repeat} onChange={set('repeat')} />
    {f.repeat === 'custom' && <div className="repeat-days" role="group" aria-label="Repeat on">{['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((x, i) => { const days = f.repeatDays || [new Date((f.due || today()) + 'T12:00:00').getDay()], on = days.includes(i); return <button key={i} type="button" aria-pressed={on} aria-label={['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][i]} onClick={() => { const next = on ? days.filter(y => y !== i) : [...days, i].sort((a, b) => a - b); if (!next.length) return; setManual(m => new Set(m).add('repeat')); setF(old => ({ ...old, repeatDays: next })); }}>{x}</button>; })}</div>}<p className="form-help">Completing this task creates one next occurrence. Existing completed occurrences stay in history.</p><Fld l="Due date (optional)" type="date" value={f.due} onChange={set('due')} /><Sel l="Client" o={cOpts} value={f.client} onChange={set('client')} />
    <Sel l="Project" o={[['', '— none —'], ...projectOptions(d.projects)]} value={f.project} onChange={set('project')} /><h3>Put it on your calendar</h3><p className="mu form-help">Choose a time to reserve a work block. Otherwise, a due date appears as an all-day deadline. Times use your device’s timezone ({Intl.DateTimeFormat().resolvedOptions().timeZone}).</p><div className="grid2"><Fld l="Scheduled start (optional)" type="datetime-local" value={f.scheduledAt} onChange={set('scheduledAt')} /><Fld l="Duration (minutes)" name="durationMinutes" type="number" min="5" max="1440" step="5" defaultValue={v.durationMinutes || 60} /></div>
  </Modal>;
}

/* ---------- client form ---------- */
const linkName = l => l.label || (() => { try { return new URL(l.url).hostname.replace(/^www\./, ''); } catch { return l.url; } })();
function ClientLinks({ links }) {
  return links?.length ? <div className="client-links">{links.map((l, i) => <a key={i} className="chip white" href={l.url} target="_blank" rel="noopener noreferrer"><Icon name="link" size={14} />{linkName(l)}</a>)}</div> : null;
}
function ClientForm({ v, close, save, removeItem }) {
  const [links, setLinks] = useState(() => v.links?.length ? v.links.map(l => ({ ...l })) : [{ label: '', url: '' }]);
  const set = (i, k, x) => setLinks(links.map((l, j) => j === i ? { ...l, [k]: x } : l));
  return <Modal title={v.id ? 'Edit client' : 'New client'} onDelete={v.id ? () => removeItem('clients',v.id) : undefined} onClose={close} onSubmit={(o) => save('clients', { ...o, links })}>
    <Fld l="Name" name="name" required defaultValue={v.name} /><Fld l="Email" name="email" type="email" defaultValue={v.email} /><Fld l="Phone" name="phone" type="tel" defaultValue={v.phone} />
    <fieldset className="link-rows"><legend>Website & links</legend>
      {links.map((l, i) => <div className="link-row" key={i}><input aria-label={'Link ' + (i + 1) + ' name'} placeholder="Name (optional)" maxLength={40} value={l.label} onChange={e => set(i, 'label', e.target.value)} /><input aria-label={'Link ' + (i + 1) + ' address'} placeholder="acme.com" inputMode="url" value={l.url} onChange={e => set(i, 'url', e.target.value)} /><button type="button" className="icon-button" aria-label={'Remove link ' + (i + 1)} onClick={() => setLinks(links.length > 1 ? links.filter((_, j) => j !== i) : [{ label: '', url: '' }])}><Icon name="close" size={16} /></button></div>)}
      {links.length < 10 && <button type="button" className="add-inline-link" onClick={() => setLinks([...links, { label: '', url: '' }])}><Icon name="plus" size={16} />Add a link</button>}
    </fieldset>
    <label>Address<textarea name="address" rows="2" defaultValue={v.address} /></label><label>Notes<textarea name="notes" rows="2" defaultValue={v.notes} /></label>
  </Modal>;
}

/* ---------- project form ---------- */
function ProjectForm({ v, d, mut, toast, close, save, removeItem }) {
  const [client, setClient] = useState(v.client || ''), [adding, setAdding] = useState(false), [newName, setNewName] = useState('');
  const [budget, setBudget] = useState(!!(Number(v.budgetHours) || Number(v.hourlyRate)));
  const addInput = useRef(null);
  // "Brand refresh for Ava from Nov 3 to Dec 20" fills the client and dates; fields you change stay yours.
  const [text, setText] = useState(v.name || ''), [dates, setDates] = useState({ start: v.start || '', end: v.end || '' }), [manual, setManual] = useState(() => new Set()), [parsed, setParsed] = useState(null);
  const type = value => {
    setText(value);
    const p = parseProject(value, d); setParsed(p.chips.length ? p : null);
    if (!manual.has('client')) setClient(p.client || v.client || '');
    setDates(old => ({ start: manual.has('start') ? old.start : p.start || v.start || '', end: manual.has('end') ? old.end : p.end || v.end || '' }));
  };
  const setDate = k => e => { const value = e.target.value; setManual(m => new Set(m).add(k)); setDates(old => ({ ...old, [k]: value })); };
  const projectChips = parsed ? [...(parsed.client ? [{ kind: 'client', label: d.clients.find(c => c.id === parsed.client)?.name }] : []), ...(parsed.start ? [{ kind: 'when', label: 'Starts ' + fmtDay(parsed.start) }] : []), ...(parsed.end ? [{ kind: 'when', label: 'Ends ' + fmtDay(parsed.end) }] : []), { kind: 'title', label: 'Saves as “' + parsed.name + '”' }] : [];
  const addClient = () => {
    const result = prepareClient({ name: newName });
    if (result.error) { toast(result.error); addInput.current?.focus(); return; }
    const id = rid(); mut(n => { n.clients.push({ id, arch: false, ...result.client }); });
    setClient(id); setNewName(''); setAdding(false); toast(`${result.client.name} added and selected.`);
  };
  const opts = [['', '— none —'], ...d.clients.filter(c => !c.arch || c.id === v.client || c.id === client).map(c => [c.id, c.name])];
  return <Modal title={v.id ? 'Edit project' : 'New project'} onDelete={v.id ? () => removeItem('projects', v.id) : undefined} onClose={close} onSubmit={o => save('projects', { ...o, name: parsed?.name || text.trim(), ...dates, client, ...(budget ? {} : { budgetHours: '', hourlyRate: '' }) })}>
    <SmartField label="Project name" required value={text} onChange={type} workspace={d} names={false} chips={projectChips} hint={v.id ? null : 'Try “Brand refresh for Ava Studio from Nov 3 to Dec 20”.'} />
    <Sel l="Client" o={opts} value={client} onChange={e => { setManual(m => new Set(m).add('client')); setClient(e.target.value); }} />
    {adding ? <div className="inline-add"><input ref={addInput} autoFocus aria-label="New client name" placeholder="Client name" value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addClient(); } if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setAdding(false); } }} /><button type="button" className="btn sm" onClick={addClient}>Add</button><button type="button" className="ghost sm" onClick={() => setAdding(false)}>Cancel</button></div>
      : <button type="button" className="add-inline-link" onClick={() => setAdding(true)}><Icon name="plus" size={16} />Add a new client</button>}
    <Sel l="Status" name="status" o={['Active', 'On hold', 'Complete']} defaultValue={v.status || 'Active'} />
    <h3>Calendar timeline</h3><p className="mu form-help">Leave the end date empty for ongoing work: the project runs from its start date until you add an end date.</p>
    <div className="grid2"><Fld l="Start date" type="date" value={dates.start} onChange={setDate('start')} /><Fld l="End date (optional)" type="date" value={dates.end} onChange={setDate('end')} /></div>
    <label className="check-row"><input type="checkbox" checked={budget} onChange={e => setBudget(e.target.checked)} /> Track an effort budget</label>
    {budget && <div className="grid2"><Fld l="Budget hours" name="budgetHours" type="number" min="0" step="0.25" defaultValue={v.budgetHours || ''} /><Fld l="Hourly rate" name="hourlyRate" type="number" min="0" step="0.01" defaultValue={v.hourlyRate || ''} /></div>}
  </Modal>;
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

function More({undo,undoCount}) {
  return <><h1>More</h1><p className="mu">Your workspace tools, organized by what you need.</p><div className="more-links">{MORE.map(([key,title])=><a key={key} className="row" href={'#/'+key}><b>{title}</b><span aria-hidden="true">›</span></a>)}</div><section className="card recovery-tools"><h3>Recovery</h3><button className="ghost" disabled={!undoCount} onClick={undo}>Undo last change{undoCount?' · '+undoCount:''}</button><a className="ghost" href="#/trash">Open Trash</a></section></>;
}

function ScreenLoading({label='Opening your screen'}){return <section className="screen-loading card" role="status" aria-busy="true"><div className="loading-line"/><h2>{label}…</h2><p className="mu">Your workspace is staying right here.</p></section>;}
class ScreenBoundary extends Component {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  render(){return this.state.failed?<section className="card" role="alert"><h2>This screen could not open</h2><p>Check your connection, then reload the app. Export any pending changes before reloading.</p><a className="ghost" href="#/backups">Open backups</a><button className="btn" onClick={()=>location.reload()}>Reload app</button></section>:this.props.children;}
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
  useEffect(()=>{if(!experienceReady)return;let seen=null;try{seen=localStorage.getItem('sd_seen_version');}catch{}
    if(shouldShowUpdate(seen,wasSeen(localStorage,onboardingKey(experienceOwner))))setUpdateNote(true);else{try{localStorage.setItem('sd_seen_version',currentVersion());}catch{}}},[experienceOwner,experienceReady]);
  const closeUpdate=()=>{setUpdateNote(false);try{localStorage.setItem('sd_seen_version',currentVersion());}catch{}};
  const taskflow = useTaskflow(user?.uid, demo);
  const dataRef = useRef(null), toastTimer = useRef(), loadVersion = useRef(0), mainRef = useRef(null), saves = useRef(null), routeScrolls=useRef(new Map());
  if (!saves.current) saves.current=createWorkspaceSaves(async(owner,value,baseline)=>{
    assertWorkspaceSize(value);splitWorkspace(value);const json=baselineOf(value),ref=doc(fdb,workspaceCollection,owner),key='sd_pending_'+owner;
    const partRef=id=>doc(fdb,workspaceCollection,owner,'parts',id);
    try{if(auth.currentUser?.uid===owner)sessionStorage.setItem(key,JSON.stringify({baseline,data:dataRef.current||value}));}catch{/* The current tab still retains unsaved data. */}
    // Check nobody else changed the stored workspace, then write only the parts that changed.
    await runTransaction(fdb,tx=>writeWorkspace(tx,id=>id?partRef(id):ref,value,baseline,assertUnchanged));
    if(auth.currentUser?.uid===owner){try{sessionStorage.setItem('sd_cached_'+owner,JSON.stringify({baseline:json,data:value}));}catch{}}
    if(auth.currentUser?.uid===owner){try{if(baselineOf(dataRef.current)===json)sessionStorage.removeItem(key);else sessionStorage.setItem(key,JSON.stringify({baseline:json,data:dataRef.current}));}catch{}}
    return json;
  },(state,error)=>{
    setSaving(state);
    setSaveError(error?.message||'');
    if (state==='error') {clearTimeout(toastTimer.current);setMsg(error?.code==='workspace-too-large'?error.message:'Changes are not saved. Use Retry in the top bar.');toastTimer.current=setTimeout(()=>setMsg(''),error?.code==='workspace-too-large'?15000:4500);}
  });
  const [theme, setTheme] = useState(() => localStorage.getItem('sd_theme') || 'light');
  useEffect(() => { applyActionColour(d?.settings?.actionColour); }, [d?.settings?.actionColour]);
  const [updateNote, setUpdateNote] = useState(false);
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('sd_theme', theme); }, [theme]);
  useEffect(() => {
    const f = event => { const oldHash=new URL(event.oldURL).hash||'#/dash';routeScrolls.current.set(oldHash,window.scrollY);const next=parse();setRoute(next);setDlg(null);if(['privacy','cookies'].includes(next.page)){window.scrollTo({top:0,behavior:'instant'});requestAnimationFrame(()=>mainRef.current?.focus({preventScroll:true}));} };
    window.addEventListener('hashchange', f);
    return () => { window.removeEventListener('hashchange', f); clearTimeout(toastTimer.current); };
  }, []);
  useEffect(() => {
    if (demo || saving === 'saved') return;
    const warn = e => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload',warn);
    return () => window.removeEventListener('beforeunload',warn);
  }, [demo,saving]);
  useEffect(() => { if (route.page === 'u') return; document.title = !demo && user === null && !['privacy','cookies'].includes(route.page) ? 'Sign in · SoloDesk' : `${NAV.find(([k]) => k === route.page)?.[1] || ({more: 'More', privacy: 'Privacy Policy', cookies: 'Cookies & storage',portal:'Client portal'})[route.page] || 'Dashboard'} · SoloDesk`; }, [route.page,user,demo]);
  const apply = (value) => { if(value===null){undoHistory.current=[];setUndoCount(0);routeScrolls.current.clear();} dataRef.current = value; setD(value); };
  const load = async (u) => {
    const request = ++loadVersion.current;
    setErr(''); apply(null);
    let pending;try{pending=JSON.parse(sessionStorage.getItem('sd_pending_'+u.uid));}catch{}
    try {
      const snap = await getDoc(doc(fdb, workspaceCollection, u.uid));if(request!==loadVersion.current||auth.currentUser?.uid!==u.uid)return;
      const data=snap.exists()?snap.data():null,partSnaps=await Promise.all((data?.parts||[]).map(id=>getDoc(doc(fdb,workspaceCollection,u.uid,'parts',id))));
      if(request!==loadVersion.current||auth.currentUser?.uid!==u.uid)return;
      const stored=joinWorkspace(data,Object.fromEntries(partSnaps.filter(s=>s.exists()).map(s=>[s.id,s.data().json])));
      const baseline=baselineOf(stored);const value=validateWorkspace(stored||fresh());
      // Copies kept in this tab before the storage change used the old baseline format.
      if(pending?.baseline){try{pending.baseline=baselineOf(JSON.parse(pending.baseline));}catch{}}
      saves.current.begin(u.uid,baseline);
      if(pending){apply(validateWorkspace(pending.data));if(pending.baseline!==baseline){setSaving('conflict');setSaveError('Recovered pending changes conflict with another saved version. Export them before loading the latest.');}else persist(pending.data);}
      else{apply(value);try{sessionStorage.setItem('sd_cached_'+u.uid,JSON.stringify({baseline,data:value}));}catch{}}
    } catch(error) {
      if(request!==loadVersion.current||auth.currentUser?.uid!==u.uid)return;
      let cached;try{cached=JSON.parse(sessionStorage.getItem('sd_cached_'+u.uid));}catch{}
      const recover=pending||cached;
      if(recover){try{const recovered=validateWorkspace(recover.data);let base=recover.baseline;try{if(base)base=baselineOf(JSON.parse(base));}catch{}saves.current.begin(u.uid,base);apply(recovered);setSaving('error');setSaveError('Offline copy recovered in this tab. Reconnect to save.');return;}catch{}}
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
  useEffect(() => { const m = /[?&]microsoft=([a-z]+)/.exec(window.location.hash); if (!m) return; window.history.replaceState(null, '', window.location.pathname + window.location.hash.replace(/\?.*$/, '')); toast({ connected: 'Microsoft account connected. Link a workbook from a client’s or project’s Files & docs.', cancelled: 'Microsoft sign-in was cancelled.', expired: 'That sign-in link expired. Try connecting again.' }[m[1]] || 'Microsoft sign-in did not complete. Try again.'); }, []);
  const ask = (m, fn, options = {}) => setDlg({ k: 'ask', v: { m, fn, ...options } });
  const persist = n => { void saves.current.save(n); };
  useEffect(()=>{if(online&&!demo&&user?.uid&&dataRef.current&&saving==='error')persist(dataRef.current);},[online]);
  const mut = fn => {
    const before=dataRef.current;if(!before)return;const n=structuredClone(before);fn(n);
    for(const task of n.tasks){const old=before.tasks.find(t=>t.id===task.id);if(old&&task.status==='Done'&&(old.status!=='Done'||JSON.stringify(old.dependencies)!==JSON.stringify(task.dependencies))&&blockers(n,task).length){toast('Finish the blocking tasks first. Open task details to manage dependencies.');return false;}}
    repeatCompletedTasks(before,n);
    if(JSON.stringify(before)===JSON.stringify(n))return true;
    recordActivity(before,n);stampUpdated(before,n);
    undoHistory.current=[...undoHistory.current.slice(-19),structuredClone(before)];setUndoCount(undoHistory.current.length);apply(n);
    if (demo) { try { localStorage.setItem('sd_demo', JSON.stringify(n)); } catch { toast('Browser storage is full. Export your data before leaving.'); } return true; }
    // Resolves true once saved; the Excel sync inbox waits for this before clearing an applied change.
    return saves.current.save(n);
  };
  const mutRef=useRef(mut);mutRef.current=mut;
  useEffect(()=>watchSyncInbox(demo||!d?null:user?.uid,(fn)=>mutRef.current(fn)),[user?.uid,demo,!!d]);
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
      routeScrolls.current.clear();window.history.replaceState(null,'','/'); setRoute({page:'dash'}); window.scrollTo(0,0);
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
  useApprovalSync({ d, mut, user, demo, toast });
  const { comments: clientComments, shares: portalShares } = usePortalSync({ d, user, demo, mut, toast });
  L.setCur(d?.settings.cur);
  if(route.page==='portal-preview')return <ScreenBoundary key="portal-preview"><Suspense fallback={<ScreenLoading label="Opening preview"/>}><PortalPreview/></Suspense></ScreenBoundary>;
  if(route.page==='u')return <ScreenBoundary key={'u-'+route.id}><PublicProfile username={route.id}/></ScreenBoundary>;
  if(route.page==='portal')return <ScreenBoundary key={'portal-'+route.id}><Suspense fallback={<ScreenLoading label="Opening client portal"/>}><ClientPortal owner={route.id}/></Suspense></ScreenBoundary>;
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
  const close = () => setDlg(null), P = { d, mut, open, ask, toast, user, logout, demo, saving, signingOut, taskflow, removeItem, startOnboarding, startTour, undo, undoCount, purgeTrash, offlineReady, id: route.id, theme, setTheme, comments: clientComments, shares: portalShares };
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

  return (<ViewStateProvider owner={experienceOwner}><>
    <InstallNotice/>
    <a className="skip-link" href="#workspace" onClick={e => { e.preventDefault(); mainRef.current?.focus(); }}>Skip to content</a>
    <aside className="sidebar" aria-label="SoloDesk">
      <a className="wordmark" href="#/dash">solodesk</a>
      {GROUPS.map(([title,keys]) => <div key={title}><span className="nav-caption">{title}</span><nav aria-label={title}>{keys.map(k => { const t = NAV.find(([x]) => x === k)[1], on = page === k; return <a key={k} href={'#/' + k} className={on ? 'on' : ''} aria-current={on ? 'page' : undefined}><Icon name={NAV_ICON[k] || k} size={18} /><span>{t}</span>{k === 'tasks' && d.tasks.filter(x => x.status !== 'Done' && !x.arch).length > 0 && <span className="nav-count">{d.tasks.filter(x => x.status !== 'Done' && !x.arch).length}</span>}{k === 'approvals' && unseenAnswers(d, d.settings.approvalsSeenAt) > 0 && <span className="nav-count alert" title="New answers from clients">{unseenAnswers(d, d.settings.approvalsSeenAt)}</span>}</a>; })}</nav></div>)}
      <div className="sidebar-bottom"><div className="sidebar-user"><a className="sidebar-who" href="#/profile" title="Your profile"><span className="avatar">{(demo ? 'Demo' : user?.displayName || d.settings.biz || 'You').split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase()}</span><span className="who"><b>{demo ? 'Demo explorer' : user?.displayName || 'Your account'}</b><small>{demo ? 'Sample workspace' : user?.email || d.settings.biz || 'Signed in'}</small></span></a><button type="button" className="sidebar-logout" onClick={logout} aria-label={demo ? 'Exit demo' : 'Log out'} title={demo ? 'Exit demo' : 'Log out'}><Icon name="logout" size={16} /></button></div><a className="sidebar-version" href="#/settings/whats-new">SoloDesk {currentVersion()} · What’s new</a></div>
    </aside>
    <div className="app-body"><header className="topbar"><a className="header-brand" href="#/dash"><BrandLogo /></a><nav className="breadcrumb" aria-label="Breadcrumb"><a href="#/dash">Workspace</a> <span>/</span> {route.id ? <a href={'#/' + page}>{NAV.find(([k]) => k === page)?.[1] || 'More'}</a> : <b aria-current="page">{NAV.find(([k]) => k === page)?.[1] || 'More'}</b>}{route.id && <> <span>/</span> <b aria-current="page">{crumbName(d, page, route.id)}</b></>}</nav><div className="topbar-right">{demo ? <span className="demo-badge">LOCAL DEMO · SAMPLE DATA</span> : <span className={'save-state ' + saving} role="status">{saving === 'saving' ? 'Saving…' : ['error','conflict'].includes(saving) ? <button className="ghost sm" onClick={() => {if(saving!=='conflict')persist(dataRef.current);}}>Unsaved changes</button> : ''}</span>}<span className="topbar-date">{new Date().toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}</span><div className="header-actions" role="group" aria-label="Workspace actions"><CommandMenu d={d} mut={mut} toast={toast} open={open} Modal={Modal} undo={undo} undoCount={undoCount}/><WorkspaceSearch d={d} taskflow={taskflow} Modal={Modal} openProject={p=>open('project',p)}/><NotificationBell d={d} mut={mut} comments={clientComments}/><span className="toolbar-divider" aria-hidden="true" /><a className="icon-button header-link" href="#/reports" aria-label="View reports" title="Reports"><Icon name="reports" size={18} /></a><a className="icon-button header-link" href="#/settings" aria-label="Open settings" title="Settings"><Icon name="settings" size={18} /></a><button className="icon-button" aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} title={theme === 'dark' ? 'Light mode' : 'Dark mode'} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}><Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} /></button><button type="button" className="ghost danger sm signout-button" aria-label="Sign out of SoloDesk" disabled={signingOut} onClick={logout}><Icon name="logout" size={18} /><span>{signingOut ? 'Signing out…' : 'Sign out'}</span></button></div></div></header>
    <main ref={mainRef} id="workspace" tabIndex={-1}>
      {(!online||['error','conflict'].includes(saving))&&!demo&&<section className="sync-notice" role="status"><strong>{!online?'Offline · changes stay in this tab':saving==='conflict'?'Another tab or device changed this workspace':'Changes are not saved'}</strong><p>{saveError||'Reconnect to save pending changes. An account-scoped draft is kept in this tab for reload recovery.'}</p><a className="ghost sm" href="#/backups">Export pending backup</a>{saving==='conflict'?<button className="ghost sm" onClick={()=>ask('Download a backup of pending changes first. Load the latest saved workspace and discard this tab’s pending version?',()=>{sessionStorage.removeItem('sd_pending_'+user.uid);setSaving('saved');load(user);},{title:'Load latest saved version?',label:'Load latest'})}>Load latest saved version</button>:<button className="ghost sm" disabled={!online} onClick={()=>persist(dataRef.current)}>Retry save</button>}</section>}
      <ScreenBoundary key={page+(route.id||'')}><Suspense fallback={<ScreenLoading/>}><PageFrame mainRef={mainRef} top={routeScrolls.current.get(window.location.hash||'#/dash')||0}><div className={'page-content page-'+page} key={page + (route.id || '')}>
      {page !== 'dash' && <div className="page-kicker"><span className="eyebrow">{({clients:'GOOD WORK STARTS WITH PEOPLE',projects:'FROM FIRST BRIEF TO FINAL DELIVERY',tasks:'MAKE SPACE FOR WHAT MATTERS',invoices:'THE BUSINESS OF GETTING PAID',reports:'FOLLOW THE NUMBERS',settings:'MAKE YOURSELF AT HOME',calendar:'MAKE ROOM FOR YOUR WORK',integrations:'YOUR WORKSPACE, WITHOUT WALLS'})[page] || 'YOUR WORKSPACE'}</span><p>{({clients:'The people you build with. All in one place.',projects:'Keep the moving pieces in perspective.',tasks:'A little structure for your next big thing.',invoices:'Clear invoices. Less chasing. Better flow.',reports:'A considered look at your business.',settings:'The details that make this desk yours.',calendar:'Your clients, projects and tasks. In one view.',integrations:'Take your data further. Connect your other tools.'})[page]}</p></div>}
      {['integrations','backups'].includes(page)&&<DataNav current={page}/>}

      {page === 'backups' && <Backups {...P}/>}
      {page === 'notes' && <NotesPage {...P}/>}
      {page === 'approvals' && <ApprovalsPage {...P}/>}
      {page === 'planner' && <Planner {...P}/>}
      {page === 'templates' && <Templates {...P}/>}
      {page === 'recurring' && <RecurringInvoices {...P}/>}
      {page === 'focus' && <><h1>Focus on your work</h1><Focus {...P}/></>}
      {page === 'trash' && <Trash {...P}/>}
      {page === 'dash' && <Home {...P} />}
      {page === 'work' && <AllWork {...P} />}
      {page === 'profile' && <ProfileEditor {...P} />}
      {page === 'clients' && (route.id ? <ClientPage {...P} /> : <Clients {...P} />)}
      {page === 'projects' && (route.id ? <ProjectPage {...P} /> : <Projects {...P} />)}
      {page === 'tasks' && (route.id ? <TaskPage {...P} /> : <Tasks {...P} />)}
      {page === 'invoices' && (route.id ? <InvoicePage {...P} /> : <Invoices {...P} />)}
      {page === 'reports' && <Reports {...P} />}
      {page === 'calendar' && <Calendar {...P} />}
      {page === 'integrations' && <Integrations {...P} />}
      {page === 'settings' && <Settings {...P} />}
      {page === 'more' && <More {...P} />}
      </div></PageFrame></Suspense></ScreenBoundary><footer className="workspace-footer"><span>SoloDesk <span className="footer-separator">/</span> Space to do your thing.</span><a href="#/integrations">Your data belongs with you <Icon name="arrow" size={14} /></a><LegalLinks /></footer>
    </main></div>
    <nav className="bnav" aria-label="Primary">{MOB.slice(0,2).map(([k,t]) => <a key={k} href={'#/' + k} className={page === k ? 'on' : ''} aria-current={page === k ? 'page' : undefined}><span className="dock-icon"><Icon name={k} size={23} /></span>{t}</a>)}<button className="dock-add" aria-label="Create new" onClick={() => open('new')}><Icon name="plus" size={32} /></button>{MOB.slice(2).map(([k,t]) => <a key={k} href={'#/' + k} className={page === k || (k === 'more' && MORE.some(([m]) => m === page)) ? 'on' : ''} aria-current={page === k ? 'page' : undefined}><span className="dock-icon"><Icon name={k} size={23} /></span>{t}</a>)}</nav>

    {updateNote && !experience && <UpdateNotice Modal={Modal} onClose={closeUpdate}/>}
    {experience && <Experience key={experience+'-'+experienceOwner} mode={experience} demo={demo} onClose={closeExperience} onTour={startTour}/>}
    {dlg?.k === 'new' && <Modal title="Create new" label="Close" onClose={close} onSubmit={close}>
      {[['client', 'Client'], ['project', 'Project'], ['task', 'Task'], ['invoice', 'Invoice']].map(([k, t]) => <button type="button" key={k} className="row" style={{ width: '100%', font: 'inherit', color: 'inherit', cursor: 'pointer' }} onClick={() => { close(); setTimeout(() => open(k), 0); }}><b>{t}</b></button>)}</Modal>}
    {dlg?.k === 'client' && <ClientForm v={v} close={close} save={save} removeItem={removeItem} />}
    {dlg?.k === 'project' && <ProjectForm v={v} d={d} mut={mut} toast={toast} close={close} save={save} removeItem={removeItem} />}
    {dlg?.k === 'task' && <TaskForm v={v} d={d} cOpts={cOpts} close={close} save={save} removeItem={removeItem} />}
    {dlg?.k === 'invoice' && <InvForm v={v} d={d} mut={mut} close={close} toast={toast} removeItem={removeItem} />}
    {dlg?.k === 'pay' && (() => { const b = calc(v).bal; return <Modal title="Record payment" onClose={close} onSubmit={(o) => {
      if (num(o.amt) <= 0 || num(o.amt) > b + 0.005) return toast('Enter an amount up to the remaining balance.');
      mut((n) => n.invoices.find((i) => i.id === v.id).pays.push({ id: rid(), amt: num(o.amt), date: o.date, note: o.note })); close(); }}>
      <Fld l="Amount" name="amt" type="number" step="0.01" min="0.01" max={b.toFixed(2)} required defaultValue={b.toFixed(2)} />
      <Fld l="Payment date" name="date" type="date" required defaultValue={today()} /><Fld l="Method or note (optional)" name="note" /></Modal>; })()}
    {dlg?.k === 'ask' && <Modal title={v.title || 'Are you sure?'} label={v.label || 'Confirm'} danger={v.danger} onClose={close} onSubmit={() => { v.fn(); close(); }}><p>{v.m}</p></Modal>}
    {msg && <div className="toast" role="status"><span>{msg}</span>{undoCount>0&&<button type="button" onClick={undo}>Undo</button>}</div>}
  </></ViewStateProvider>);
}
