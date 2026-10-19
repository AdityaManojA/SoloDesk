import { useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, deleteUser } from 'firebase/auth';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { auth, db as fdb, provider } from './firebase';
import * as L from './lib';
const { rid, num, today, addDays, calc, status, money, fresh } = L;

const NAV = [['dash', 'Dashboard'], ['clients', 'Clients'], ['projects', 'Projects'], ['tasks', 'Tasks'], ['invoices', 'Invoices'], ['reports', 'Reports'], ['settings', 'Settings']];
const MOB = [['dash', 'Dashboard'], ['clients', 'Clients'], ['tasks', 'Tasks'], ['invoices', 'Invoices'], ['more', 'More']];
const MORE = [['projects', 'Projects'], ['reports', 'Reports'], ['settings', 'Settings']];

/* ---------- routing (hash based, so the browser back button works) ---------- */
const parse = () => { const [p, id] = (window.location.hash.slice(2) || 'dash').split('/'); return { page: p || 'dash', id }; };
const nav = (p, id) => { window.location.hash = '#/' + p + (id ? '/' + id : ''); };

/* ---------- logo: shrink the uploaded image so it stays small in the database ---------- */
function logoFile(file) {
  return new Promise((res, rej) => {
    const im = new Image(), u = URL.createObjectURL(file);
    im.onload = () => {
      const k = Math.min(1, 240 / im.width), c = document.createElement('canvas');
      c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      URL.revokeObjectURL(u);
      let out = c.toDataURL('image/png');
      if (out.length > 150000) out = c.toDataURL('image/jpeg', 0.8);
      res(out);
    };
    im.onerror = () => rej(new Error('bad image'));
    im.src = u;
  });
}

/* ---------- small UI pieces ---------- */
const Badge = ({ s }) => <span className={'b b-' + s.replace(' ', '')}>{L.ICON[s]}{s}</span>;
const Empty = ({ m, label, onClick }) => <div className="empty"><p>{m}</p>{label && <button className="btn" onClick={onClick}>{label}</button>}</div>;
const Back = ({ to, label }) => <a className="back" href={'#/' + to}>‹ {label}</a>;
const Fld = ({ l, ...p }) => <label>{l}<input {...p} /></label>;
const Sel = ({ l, o, ...p }) => <label>{l}<select {...p}>{o.map((x) => { const [v, t] = Array.isArray(x) ? x : [x, x]; return <option key={v} value={v}>{t}</option>; })}</select></label>;
function Modal({ title, onClose, onSubmit, label = 'Save', children }) {
  return (
    <div className="ov" onClick={onClose}>
      <form className="dlg" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); onSubmit(Object.fromEntries(new FormData(e.target))); }}>
        <h2>{title}</h2>{children}
        <div className="end"><button type="button" className="ghost" onClick={onClose}>Cancel</button><button className="btn">{label}</button></div>
      </form>
    </div>
  );
}
function Chart({ data }) {
  const n = data.length, bw = 300 / n, mx = Math.max(...data.map((x) => x.v), 1), st = Math.ceil(n / 6);
  return (
    <svg viewBox="0 0 300 160" role="img" aria-label="Revenue received by month">
      {data.map((x, i) => { const h = (x.v / mx) * 105, cx = i * bw + bw / 2; return (
        <g key={x.k}><rect x={i * bw + bw * 0.15} y={125 - h} width={bw * 0.7} height={h} rx="3" fill="var(--ac)" />
          {n <= 8 && x.v > 0 && <text x={cx} y={120 - h} textAnchor="middle" fontSize="9" fill="var(--tx)">{Math.round(x.v)}</text>}
          {i % st === 0 && <text x={cx} y="143" textAnchor="middle" fontSize="9" fill="var(--mu)">{x.l}</text>}</g>); })}
      <line x1="0" x2="300" y1="125" y2="125" stroke="var(--ln)" />
    </svg>
  );
}

/* ---------- login (Google sign-in) ---------- */
function Login({ err }) {
  const [e, setE] = useState(err || '');
  const go = () => signInWithPopup(auth, provider).catch((x) => setE(x.code === 'auth/popup-closed-by-user' ? '' : 'Sign-in failed. Please try again.'));
  return (
    <div className="login"><h2>SoloDesk</h2><p className="mu">Clients, projects, tasks and invoices in one calm place.</p>
      <button className="btn" onClick={go}>Continue with Google</button>
      <p role="alert">{e}</p></div>
  );
}

/* ---------- dashboard ---------- */
function Dash({ d }) {
  const t = today(), m = t.slice(0, 7), pays = L.allPays(d), ks = L.months(addDays(t, -165), t).slice(-6);
  const rev = pays.filter((p) => p.date.slice(0, 7) === m).reduce((s, p) => s + num(p.amt), 0);
  const due = d.tasks.filter((k) => k.due && k.status !== 'Done' && k.due >= t && k.due <= addDays(t, 7)).length;
  const att = [
    ...d.invoices.filter((i) => status(i) === 'Overdue').map((i) => ({ id: i.id, h: '#/invoices/' + i.id, t: `${i.no} · ${L.cname(d, i.client)}`, s: `Due ${i.due} · ${money(calc(i).bal)} unpaid`, b: <Badge s="Overdue" /> })),
    ...d.tasks.filter((k) => k.due && k.due < t && k.status !== 'Done').map((k) => ({ id: k.id, h: '#/tasks/' + k.id, t: k.title, s: `Due ${k.due}`, b: <span className="b b-Overdue">! Task overdue</span> })),
  ].slice(0, 5);
  return (<>
    <h2>Dashboard</h2>
    <div className="cards">
      <div className="card"><small>Revenue received this month</small><b>{money(rev)}</b></div>
      <div className="card"><small>Outstanding balance</small><b>{money(L.outstanding(d))}</b></div>
      <div className="card"><small>Tasks due in 7 days</small><b>{due}</b></div>
    </div>
    <div className="card"><h3>Revenue received · last 6 months</h3><Chart data={L.revBy(ks, pays)} /></div>
    <h3>Needs attention</h3>
    {att.length ? att.map((a) => <a className="row" key={a.id} href={a.h}><div><b>{a.t}</b><small>{a.s}</small></div>{a.b}</a>) : <Empty m="Nothing overdue. You are all caught up." />}
  </>);
}

/* ---------- clients ---------- */
function Clients({ d, open }) {
  const [q, setQ] = useState(''), [arch, setArch] = useState(false);
  const a = d.clients.filter((c) => (arch || !c.arch) && ((c.name || '') + (c.email || '')).toLowerCase().includes(q.toLowerCase()));
  return (<>
    <div className="hd"><h2>Clients</h2><button className="btn" onClick={() => open('client')}>Add client</button></div>
    <input placeholder="Search clients" aria-label="Search clients" value={q} onChange={(e) => setQ(e.target.value)} />
    <label><input type="checkbox" style={{ width: 'auto' }} checked={arch} onChange={(e) => setArch(e.target.checked)} /> Show archived</label>
    {a.length ? a.map((c) => (
      <a className="row" key={c.id} href={'#/clients/' + c.id}>
        <div><b>{c.name} {c.arch && <span className="b">Archived</span>}</b><small>{c.email || c.phone}</small></div><span aria-hidden="true">›</span>
      </a>
    )) : <Empty m={d.clients.length ? 'No clients match.' : 'No clients yet. Add your first client to get started.'} label={d.clients.length ? '' : 'Add client'} onClick={() => open('client')} />}
  </>);
}

function ClientPage({ d, mut, open, id }) {
  const c = d.clients.find((x) => x.id === id);
  if (!c) return <><Back to="clients" label="Clients" /><Empty m="This client could not be found." /></>;
  const info = [['Email', c.email], ['Phone', c.phone], ['Address', c.address], ['Notes', c.notes]].filter(([, v]) => v);
  return (<>
    <Back to="clients" label="Clients" />
    <div className="hd"><h2>{c.name} {c.arch && <span className="b">Archived</span>}</h2>
      <div className="end" style={{ margin: 0 }}>
        <button className="ghost sm" onClick={() => open('client', c)}>Edit</button>
        <button className="ghost sm" onClick={() => mut((n) => { const x = n.clients.find((y) => y.id === id); x.arch = !x.arch; })}>{c.arch ? 'Restore' : 'Archive'}</button>
      </div></div>
    <div className="card">{info.length ? info.map(([k, v]) => <p key={k} style={{ margin: '4px 0', whiteSpace: 'pre-line' }}><small>{k}</small><br />{v}</p>) : <p className="mu">No contact details yet.</p>}</div>
    <div className="hd" style={{ marginTop: 16 }}><h3 style={{ margin: 0 }}>Projects</h3><button className="ghost sm" onClick={() => open('project', { client: id })}>+ Project</button></div>
    {d.projects.filter((p) => p.client === id).map((p) => <div className="row" key={p.id} onClick={() => open('project', p)}><b>{p.name}</b><span className="b">{p.status}</span></div>)}
    {!d.projects.some((p) => p.client === id) && <p className="mu">No projects yet.</p>}
    <div className="hd" style={{ marginTop: 16 }}><h3 style={{ margin: 0 }}>Tasks</h3><button className="ghost sm" onClick={() => open('task', { client: id })}>+ Task</button></div>
    {d.tasks.filter((k) => k.client === id).map((k) => <a className="row" key={k.id} href={'#/tasks/' + k.id}><div><b>{k.title}</b><small>{k.status}{k.due ? ` · due ${k.due}` : ''}</small></div><span aria-hidden="true">›</span></a>)}
    {!d.tasks.some((k) => k.client === id) && <p className="mu">No tasks yet.</p>}
    <div className="hd" style={{ marginTop: 16 }}><h3 style={{ margin: 0 }}>Invoices</h3><button className="ghost sm" onClick={() => open('invoice', { client: id })}>+ Invoice</button></div>
    {d.invoices.filter((i) => i.client === id).map((i) => <a className="row" key={i.id} href={'#/invoices/' + i.id}><div><b>{i.no}</b><small>Total {money(calc(i).total)} · Balance {money(calc(i).bal)}</small></div><Badge s={status(i)} /></a>)}
    {!d.invoices.some((i) => i.client === id) && <p className="mu">No invoices yet.</p>}
  </>);
}

/* ---------- projects ---------- */
function Projects({ d, open }) {
  return (<>
    <div className="hd"><h2>Projects</h2><button className="btn" onClick={() => open('project')}>Add project</button></div>
    {d.projects.length ? d.projects.map((p) => <div className="row" key={p.id} onClick={() => open('project', p)}><div><b>{p.name}</b><small>{L.cname(d, p.client)}</small></div><span className="b">{p.status}</span></div>)
      : <Empty m="No projects yet. Link projects to a client to keep work organized." label="Add project" onClick={() => open('project')} />}
  </>);
}

/* ---------- tasks ---------- */
const toggleTask = (mut, id) => mut((n) => { const x = n.tasks.find((y) => y.id === id); x.status = x.status === 'Done' ? 'Todo' : 'Done'; });

function Tasks({ d, mut, open }) {
  const [f, setF] = useState({ status: '', due: '', client: '', project: '' }), t = today();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const a = d.tasks.filter((k) => (!f.status || k.status === f.status) && (!f.client || k.client === f.client) && (!f.project || k.project === f.project)
    && (!f.due || (f.due === 'none' ? !k.due : f.due === 'over' ? k.due && k.due < t && k.status !== 'Done' : k.due && k.due >= t && k.due <= addDays(t, 7))))
    .sort((x, y) => (x.status === 'Done') - (y.status === 'Done') || (x.due || '9').localeCompare(y.due || '9'));
  return (<>
    <div className="hd"><h2>Tasks</h2><button className="btn" onClick={() => open('task')}>Add task</button></div>
    <details><summary>Filters</summary><div className="grid2" style={{ marginTop: 8 }}>
      <Sel l="Status" o={[['', 'All'], 'Todo', 'In progress', 'Done']} value={f.status} onChange={set('status')} />
      <Sel l="Due" o={[['', 'Any'], ['week', 'Next 7 days'], ['over', 'Overdue'], ['none', 'No due date']]} value={f.due} onChange={set('due')} />
      <Sel l="Client" o={[['', 'All'], ...d.clients.map((c) => [c.id, c.name])]} value={f.client} onChange={set('client')} />
      <Sel l="Project" o={[['', 'All'], ...d.projects.map((p) => [p.id, p.name])]} value={f.project} onChange={set('project')} />
    </div></details>
    {a.length ? a.map((k) => (
      <div className="row" key={k.id}>
        <button className="chk" aria-label={k.status === 'Done' ? 'Mark not done' : 'Mark complete'} onClick={() => toggleTask(mut, k.id)}>{k.status === 'Done' ? '☑' : '☐'}</button>
        <a className="grow" href={'#/tasks/' + k.id}><b style={{ textDecoration: k.status === 'Done' ? 'line-through' : 'none' }}>{k.title}</b>
          <small>{k.status}{k.due ? ` · due ${k.due}` : ''}{k.priority ? ` · ${k.priority} priority` : ''}</small></a>
      </div>)) : <Empty m={d.tasks.length ? 'No tasks match these filters.' : 'No tasks yet. Add one to see what is due.'} label={d.tasks.length ? '' : 'Add task'} onClick={() => open('task')} />}
  </>);
}

function TaskPage({ d, mut, open, ask, id }) {
  const k = d.tasks.find((x) => x.id === id);
  if (!k) return <><Back to="tasks" label="Tasks" /><Empty m="This task could not be found." /></>;
  const rows = [['Status', k.status], ['Due date', k.due || 'No due date'], ['Priority', k.priority || 'None']];
  return (<>
    <Back to="tasks" label="Tasks" />
    <div className="hd"><h2>{k.title}</h2>
      <div className="end" style={{ margin: 0 }}>
        <button className="ghost sm" onClick={() => open('task', k)}>Edit</button>
        <button className="ghost sm" onClick={() => ask('Delete this task?', () => { mut((n) => { n.tasks = n.tasks.filter((x) => x.id !== id); }); nav('tasks'); })}>Delete</button>
      </div></div>
    <div className="card">
      {rows.map(([a, b]) => <p key={a} style={{ margin: '4px 0' }}><small>{a}</small><br />{b}</p>)}
      {k.client && <p style={{ margin: '4px 0' }}><small>Client</small><br /><a href={'#/clients/' + k.client} style={{ fontWeight: 700 }}>{L.cname(d, k.client)}</a></p>}
      {k.project && <p style={{ margin: '4px 0' }}><small>Project</small><br />{d.projects.find((p) => p.id === k.project)?.name || '—'}</p>}
    </div>
    <p><button className="btn" onClick={() => toggleTask(mut, id)}>{k.status === 'Done' ? 'Mark not done' : 'Mark complete'}</button></p>
  </>);
}

/* ---------- invoices ---------- */
function Invoices({ d, open }) {
  const [fs, setFs] = useState('');
  const a = d.invoices.filter((i) => !fs || status(i) === fs).sort((x, y) => y.no.localeCompare(x.no));
  return (<>
    <div className="hd"><h2>Invoices</h2><button className="btn" onClick={() => open('invoice')}>Create invoice</button></div>
    <Sel l="Status" o={[['', 'All'], 'Draft', 'Sent', 'Partially paid', 'Paid', 'Overdue', 'Void']} value={fs} onChange={(e) => setFs(e.target.value)} />
    {a.length ? a.map((i) => { const c = calc(i); return (
      <a className="row" key={i.id} href={'#/invoices/' + i.id}>
        <div><b>{i.no} · {L.cname(d, i.client)}</b><small>Total {money(c.total)} · Balance {money(c.bal)} · Due {i.due}</small></div><Badge s={status(i)} />
      </a>); }) : <Empty m={d.invoices.length ? 'No invoices with that status.' : 'No invoices yet. Create one for a client.'} label={d.invoices.length ? '' : 'Create invoice'} onClick={() => open('invoice')} />}
  </>);
}

function InvoicePage({ d, mut, open, ask, id }) {
  const i = d.invoices.find((x) => x.id === id);
  if (!i) return <><Back to="invoices" label="Invoices" /><Empty m="This invoice could not be found." /></>;
  const c = calc(i), s = status(i), st = d.settings, cl = d.clients.find((x) => x.id === i.client) || {};
  const upd = (fn) => mut((n) => fn(n.invoices.find((x) => x.id === id)));
  const pdf = () => { const t = document.title; document.title = i.no + (cl.name ? ' - ' + cl.name : ''); window.print(); setTimeout(() => { document.title = t; }, 1000); };
  const reissue = () => { const nid = rid(); mut((n) => { n.seq++; n.invoices.push({ ...structuredClone(i), id: nid, no: 'INV-' + String(n.seq).padStart(4, '0'), state: 'draft', pays: [], issue: today() }); }); nav('invoices', nid); };
  return (<>
    <div className="noprint">
      <Back to="invoices" label="Invoices" />
      <div className="hd"><h2>{i.no} <Badge s={s} /></h2>
        <div className="end" style={{ margin: 0 }}>
          {i.state === 'draft' && <><button className="ghost sm" onClick={() => open('invoice', i)}>Edit</button><button className="btn sm" onClick={() => upd((x) => { x.state = 'sent'; })}>Mark as sent</button>
            <button className="ghost sm" onClick={() => ask('Delete this draft invoice?', () => { mut((n) => { n.invoices = n.invoices.filter((x) => x.id !== id); }); nav('invoices'); })}>Delete</button></>}
          {i.state === 'sent' && <><button className="btn sm" onClick={() => open('pay', i)}>Record payment</button>
            <button className="ghost sm" onClick={() => ask('Void this invoice? It will no longer count as outstanding. You can reissue a corrected draft afterwards.', () => upd((x) => { x.state = 'void'; }))}>Void</button></>}
          {i.state === 'void' && <button className="btn sm" onClick={reissue}>Void &amp; reissue as new draft</button>}
          <button className="ghost sm" onClick={pdf}>Download PDF</button>
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
      <div className="tw"><table><tbody>
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
      {i.pays.length ? i.pays.map((p) => <div className="row" key={p.id}><div><b>{money(num(p.amt))}</b><small>{p.date}{p.note ? ' · ' + p.note : ''}</small></div></div>) : <p className="mu">No payments recorded yet.</p>}
    </div>
  </>);
}

/* ---------- reports ---------- */
function Reports({ d }) {
  const t = today(), [from, setFrom] = useState(addDays(t, -165).slice(0, 8) + '01'), [to, setTo] = useState(t);
  const pays = L.allPays(d).filter((p) => p.date >= from && p.date <= to), rows = L.revBy(L.months(from, to), pays), tot = pays.reduce((s, p) => s + num(p.amt), 0);
  return (<>
    <h2>Reports</h2>
    <div className="grid2"><Fld l="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /><Fld l="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
    <div className="cards"><div className="card"><small>Revenue received (payments in range)</small><b>{money(tot)}</b></div><div className="card"><small>Outstanding invoice balance (now)</small><b>{money(L.outstanding(d))}</b></div></div>
    <div className="card"><h3>Revenue received by payment date</h3><Chart data={rows} /></div>
    <div className="card tw" style={{ marginTop: 12 }}><table><caption className="mu" style={{ textAlign: 'left' }}>Table version of the chart. Revenue received is not profit.</caption>
      <tbody><tr><th>Month</th><th className="r">Received</th></tr>{rows.map((r) => <tr key={r.k}><td>{r.k}</td><td className="r">{money(r.v)}</td></tr>)}</tbody></table></div>
  </>);
}

/* ---------- settings ---------- */
function Settings({ d, mut, toast, ask, user }) {
  const s = d.settings;
  const del = () => ask('This permanently deletes your account, clients, projects, tasks and invoices. Consider exporting CSVs first.', async () => {
    try { await deleteDoc(doc(fdb, 'users', user.uid)); await deleteUser(user); } catch { toast('For security, sign out, sign in again, then retry deleting.'); }
  });
  const pick = async (e) => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try { const u = await logoFile(f); mut((n) => { n.settings.logo = u; }); toast('Logo updated.'); } catch { toast('Could not read that image. Try a PNG or JPG.'); }
  };
  return (<>
    <h2>Settings</h2>
    <form className="card" onSubmit={(e) => { e.preventDefault(); const o = Object.fromEntries(new FormData(e.target)); mut((n) => { Object.assign(n.settings, o); }); toast('Settings saved.'); }}>
      <Fld l="Business name" name="biz" defaultValue={s.biz} /><Fld l="Business email" name="email" type="email" defaultValue={s.email} /><Fld l="Phone" name="phone" defaultValue={s.phone} />
      <label>Address<textarea name="addr" rows="2" defaultValue={s.addr} /></label><label>Payment instructions (shown on invoices)<textarea name="pay" rows="3" defaultValue={s.pay} /></label>
      <Sel l="Default currency" name="cur" o={['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'INR', 'JPY', 'CHF']} defaultValue={s.cur} />
      <label>Logo (PNG or JPG, shown on invoices)<input type="file" accept="image/*" onChange={pick} /></label>
      {s.logo && <div className="row"><img src={s.logo} alt="Current logo" style={{ maxHeight: 48, maxWidth: '60%' }} /><button type="button" className="ghost sm" onClick={() => mut((n) => { n.settings.logo = ''; })}>Remove logo</button></div>}
      <button className="btn">Save settings</button>
    </form>
    <h3>Export data (CSV)</h3>
    <div className="end" style={{ justifyContent: 'flex-start' }}>{['clients', 'tasks', 'invoices', 'payments'].map((k) => <button key={k} className="ghost" onClick={() => L.download(`solodesk-${k}.csv`, L.csv(L.exporters(d)[k]), 'text/csv')}>{k[0].toUpperCase() + k.slice(1)}</button>)}</div>
    <h3>Account</h3>
    <div className="end" style={{ justifyContent: 'flex-start' }}><button className="ghost" onClick={() => signOut(auth)}>Sign out</button><button className="ghost" onClick={del}>Delete account &amp; all data</button></div>
  </>);
}

/* ---------- invoice form ---------- */
function InvForm({ v, d, mut, close, toast }) {
  const [lines, setL] = useState(v.items || [{ desc: '', qty: 1, price: '' }]);
  const set = (i, k, x) => setL(lines.map((l, j) => (j === i ? { ...l, [k]: x } : l)));
  return (
    <Modal title={v.id ? `Edit draft ${v.no}` : 'New invoice'} onClose={close} onSubmit={(o) => {
      if (o.due < o.issue) return toast('Due date cannot be before the issue date.');
      const nid = rid();
      mut((n) => { const x = { client: o.client, issue: o.issue, due: o.due, tax: num(o.tax), notes: o.notes, items: lines.map((l) => ({ desc: l.desc, qty: num(l.qty), price: num(l.price) })) };
        if (v.id) Object.assign(n.invoices.find((i) => i.id === v.id), x); else { n.seq++; n.invoices.push({ id: nid, no: 'INV-' + String(n.seq).padStart(4, '0'), state: 'draft', pays: [], ...x }); } });
      close();
      if (!v.id) nav('invoices', nid);
    }}>
      <h3>Details</h3>
      <Sel l="Client" name="client" defaultValue={v.client} o={d.clients.filter((c) => !c.arch || c.id === v.client).map((c) => [c.id, c.name])} />
      <div className="grid2"><Fld l="Issue date" name="issue" type="date" required defaultValue={v.issue || today()} /><Fld l="Due date" name="due" type="date" required defaultValue={v.due || addDays(today(), 14)} /></div>
      <h3>Line items</h3>
      {lines.map((l, i) => (
        <div className="ln" key={i}>
          <input placeholder="Description" aria-label="Description" required value={l.desc} onChange={(e) => set(i, 'desc', e.target.value)} />
          <input type="number" step="any" min="0" aria-label="Quantity" value={l.qty} onChange={(e) => set(i, 'qty', e.target.value)} />
          <input type="number" step="any" min="0" placeholder="Price" aria-label="Unit price" value={l.price} onChange={(e) => set(i, 'price', e.target.value)} />
          <button type="button" className="ghost" aria-label="Remove line" onClick={() => lines.length > 1 && setL(lines.filter((_, j) => j !== i))}>✕</button>
        </div>))}
      <button type="button" className="ghost sm" onClick={() => setL([...lines, { desc: '', qty: 1, price: '' }])}>+ Add line</button>
      <h3>Tax and notes</h3>
      <Fld l="Tax rate % (optional)" name="tax" type="number" step="any" min="0" defaultValue={v.tax || 0} />
      <label>Notes (optional)<textarea name="notes" rows="2" defaultValue={v.notes} /></label>
    </Modal>
  );
}

function More() {
  return (<>
    <h2>More</h2>
    {MORE.map(([k, t]) => <a key={k} className="row" href={'#/' + k}><b>{t}</b><span aria-hidden="true">›</span></a>)}
  </>);
}

/* ---------- app shell ---------- */
export default function App() {
  const [user, setUser] = useState(undefined), [d, setD] = useState(null), [route, setRoute] = useState(parse), [dlg, setDlg] = useState(null), [msg, setMsg] = useState(''), [err, setErr] = useState('');
  const [theme, setTheme] = useState(() => localStorage.getItem('sd_theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('sd_theme', theme); }, [theme]);
  useEffect(() => {
    const f = () => { setRoute(parse()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  const load = async (u) => {
    setErr(''); setD(null);
    try { const s = await getDoc(doc(fdb, 'users', u.uid)); setD(s.exists() ? { ...fresh(), ...JSON.parse(s.data().json) } : fresh()); }
    catch (e) { console.error(e); setErr('We could not load your data. Check your connection and try again.'); }
  };
  useEffect(() => onAuthStateChanged(auth, (u) => { setUser(u); setD(null); setErr(''); if (u) load(u); }), []);
  const toast = (m) => { setMsg(m); setTimeout(() => setMsg(''), 3000); };
  const mut = (fn) => { const n = structuredClone(d); fn(n); setD(n); setDoc(doc(fdb, 'users', user.uid), { json: JSON.stringify(n) }).catch(() => toast('Could not save changes. Please try again.')); };
  L.setCur(d?.settings.cur);
  if (user === undefined) return <p className="mid">Loading…</p>;
  if (!user) return <Login />;
  if (!d) return err
    ? <div className="mid"><p role="alert">{err}</p><button className="btn" onClick={() => load(user)}>Try again</button> <button className="ghost" onClick={() => signOut(auth)}>Sign out</button></div>
    : <p className="mid">Loading your workspace…</p>;

  const page = NAV.some(([k]) => k === route.page) || route.page === 'more' ? route.page : 'dash';
  const open = (k, v = {}) => { if (k === 'invoice' && !d.clients.some((c) => !c.arch)) { toast('Add a client first.'); nav('clients'); return; } setDlg({ k, v }); };
  const ask = (m, fn) => setDlg({ k: 'ask', v: { m, fn } });
  const close = () => setDlg(null), P = { d, mut, open, ask, toast, user, id: route.id };
  const v = dlg?.v || {};
  const save = (list, o) => { mut((n) => { if (v.id) Object.assign(n[list].find((x) => x.id === v.id), o); else n[list].push({ id: rid(), ...(list === 'clients' ? { arch: false } : {}), ...o }); }); close(); };
  const cOpts = [['', '— none —'], ...d.clients.filter((c) => !c.arch || c.id === v.client).map((c) => [c.id, c.name])];

  return (<>
    <header className="pill"><b className="brand">SoloDesk</b>
      <nav aria-label="Main">{NAV.map(([k, t]) => <a key={k} href={'#/' + k} className={page === k ? 'on' : ''} aria-current={page === k ? 'page' : undefined}>{t}</a>)}</nav>
      <button className="tgl" aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? '☀' : '☾'}</button></header>
    <main>
      {page === 'dash' && <Dash {...P} />}
      {page === 'clients' && (route.id ? <ClientPage {...P} /> : <Clients {...P} />)}
      {page === 'projects' && <Projects {...P} />}
      {page === 'tasks' && (route.id ? <TaskPage {...P} /> : <Tasks {...P} />)}
      {page === 'invoices' && (route.id ? <InvoicePage {...P} /> : <Invoices {...P} />)}
      {page === 'reports' && <Reports {...P} />}
      {page === 'settings' && <Settings {...P} />}
      {page === 'more' && <More />}
    </main>
    <nav className="bnav" aria-label="Primary">{MOB.map(([k, t]) => <a key={k} href={'#/' + k} className={page === k || (k === 'more' && MORE.some(([m]) => m === page)) ? 'on' : ''} aria-current={page === k ? 'page' : undefined}>{t}</a>)}</nav>
    <button className="btn fab" onClick={() => open('new')}>+ New</button>

    {dlg?.k === 'new' && <Modal title="Create new" label="Close" onClose={close} onSubmit={close}>
      {[['client', 'Client'], ['task', 'Task'], ['invoice', 'Invoice']].map(([k, t]) => <button type="button" key={k} className="row" style={{ width: '100%', font: 'inherit', color: 'inherit', cursor: 'pointer' }} onClick={() => { close(); setTimeout(() => open(k), 0); }}><b>{t}</b></button>)}</Modal>}
    {dlg?.k === 'client' && <Modal title={v.id ? 'Edit client' : 'New client'} onClose={close} onSubmit={(o) => save('clients', o)}>
      <Fld l="Name" name="name" required defaultValue={v.name} /><Fld l="Email" name="email" type="email" defaultValue={v.email} /><Fld l="Phone" name="phone" type="tel" defaultValue={v.phone} />
      <label>Address<textarea name="address" rows="2" defaultValue={v.address} /></label><label>Notes<textarea name="notes" rows="2" defaultValue={v.notes} /></label></Modal>}
    {dlg?.k === 'project' && <Modal title={v.id ? 'Edit project' : 'New project'} onClose={close} onSubmit={(o) => save('projects', o)}>
      <Fld l="Project name" name="name" required defaultValue={v.name} /><Sel l="Client" name="client" o={cOpts} defaultValue={v.client} /><Sel l="Status" name="status" o={['Active', 'On hold', 'Complete']} defaultValue={v.status || 'Active'} /></Modal>}
    {dlg?.k === 'task' && <Modal title={v.id ? 'Edit task' : 'New task'} onClose={close} onSubmit={(o) => save('tasks', o)}>
      <Fld l="Title" name="title" required defaultValue={v.title} />
      <div className="grid2"><Sel l="Status" name="status" o={['Todo', 'In progress', 'Done']} defaultValue={v.status || 'Todo'} /><Sel l="Priority" name="priority" o={[['', 'None'], 'Low', 'Medium', 'High']} defaultValue={v.priority || ''} /></div>
      <Fld l="Due date (optional)" name="due" type="date" defaultValue={v.due} /><Sel l="Client" name="client" o={cOpts} defaultValue={v.client || ''} />
      <Sel l="Project" name="project" o={[['', '— none —'], ...d.projects.map((p) => [p.id, p.name])]} defaultValue={v.project || ''} /></Modal>}
    {dlg?.k === 'invoice' && <InvForm v={v} d={d} mut={mut} close={close} toast={toast} />}
    {dlg?.k === 'pay' && (() => { const b = calc(v).bal; return <Modal title="Record payment" onClose={close} onSubmit={(o) => {
      if (num(o.amt) <= 0 || num(o.amt) > b + 0.005) return toast('Enter an amount up to the remaining balance.');
      mut((n) => n.invoices.find((i) => i.id === v.id).pays.push({ id: rid(), amt: num(o.amt), date: o.date, note: o.note })); close(); }}>
      <Fld l="Amount" name="amt" type="number" step="0.01" min="0.01" max={b.toFixed(2)} required defaultValue={b.toFixed(2)} />
      <Fld l="Payment date" name="date" type="date" required defaultValue={today()} /><Fld l="Method or note (optional)" name="note" /></Modal>; })()}
    {dlg?.k === 'ask' && <Modal title="Are you sure?" label="Confirm" onClose={close} onSubmit={() => { v.fn(); close(); }}><p>{v.m}</p></Modal>}
    {msg && <div className="toast" role="status">{msg}</div>}
  </>);
}