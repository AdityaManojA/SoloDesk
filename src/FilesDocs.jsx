import { useEffect, useState } from 'react';
import { doc, collection, onSnapshot } from 'firebase/firestore';
import Icon from './Icon';
import { db, configured } from './firebase';
import { rid } from './lib';
import { trashReusable } from './productivity';
import { excel } from './excel-sync-client';
import { ago } from './Home.jsx';
import { ApprovalBox } from './Approvals.jsx';
import { APPROVAL_LABEL } from './approvals';

const LABEL = { title: 'Task', status: 'Status', due: 'Due date', priority: 'Priority', hours: 'Logged hours', id: 'Terracove ID' };
const DIRECTION = { both: 'Both ways', in: 'Sheet → Terracove', out: 'Terracove → sheet', locked: 'Kept by Terracove' };
const safeLink = url => { try { const u = new URL(String(url).trim()); return ['https:', 'http:'].includes(u.protocol) ? u.href : null; } catch { return null; } };
// A missing or undeployed function answers with a bare code instead of one of our sentences.
const friendly = error => !error?.message || /^(internal|not[-_ ]found|unavailable)$/i.test(error.message.trim()) ? 'Live Excel sync is not switched on for this workspace yet.' : error.message;
const host = url => safeLink(url) ? new URL(url).hostname : 'Link';

function useSync(uid) {
  const [state, setState] = useState({ account: null, links: [], ready: false });
  useEffect(() => {
    if (!uid || !db) return;
    const offAccount = onSnapshot(doc(db, 'solodeskSync', uid), s => setState(v => ({ ...v, account: s.data()?.microsoft || null, ready: true })), () => setState(v => ({ ...v, ready: true })));
    const offLinks = onSnapshot(collection(db, 'solodeskSync', uid, 'links'), s => setState(v => ({ ...v, links: s.docs.map(x => ({ id: x.id, ...x.data() })) })), () => {});
    return () => { offAccount(); offLinks(); };
  }, [uid]);
  return state;
}

function ExcelSync({ scope, user, demo, toast }) {
  const live = configured && !demo && user;
  // Switched on at build time once the server part is deployed (needs the Blaze plan): VITE_EXCEL_SYNC=on
  if (import.meta.env.VITE_EXCEL_SYNC !== 'on') return <div className="card" style={{ display: 'grid', gap: 10, alignContent: 'start' }}><div className="block-head" style={{ margin: 0 }}><h3>Connected spreadsheet</h3><span className="chip sand">Coming soon</span></div><p style={{ margin: 0 }}>Soon you can link a Microsoft Excel workbook to this {scope.kind}. Task names, statuses, due dates and priorities will stay in step both ways, and logged hours will go to the sheet.</p><p className="notice soft" style={{ margin: 0 }}>Until then, link the workbook below under Documents so everyone can open it from here.</p></div>;
  const { account, links, ready } = useSync(live ? user.uid : null);
  const [url, setUrl] = useState(''), [sheet, setSheet] = useState('Terracove tasks'), [busy, setBusy] = useState('');
  const mine = links.filter(l => l.scope?.kind === scope.kind && l.scope?.id === scope.id);
  const run = async (key, action, data, done) => { setBusy(key); try { const r = await excel(action, data); done?.(r); } catch (e) { toast(friendly(e)); } finally { setBusy(''); } };
  if (!live) return <div className="card"><h3 style={{ marginTop: 0 }}>Connected spreadsheet</h3><p>Link a Microsoft Excel workbook to this {scope.kind}. Task names, statuses, due dates and priorities stay in step both ways, and logged hours go to the sheet.</p><p className="notice soft">{demo ? 'Live Excel sync works in your signed-in workspace, not in the demo.' : 'Live Excel sync needs the hosted app.'}</p></div>;
  return <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
    <div className="block-head" style={{ margin: 0 }}><h3>Connected spreadsheet</h3>{account?.account && <span className="chip white">Microsoft · {account.account}</span>}</div>
    {account?.error && <p className="notice hero">{account.error}</p>}
    {!ready ? <p className="empty-note">Checking your Microsoft connection…</p> : !account?.connectedAt ? <>
      <p style={{ margin: 0 }}>Connect your Microsoft 365 or OneDrive account, then link a workbook. Terracove only opens the workbooks you link.</p>
      <button className="btn" style={{ alignSelf: 'flex-start' }} disabled={busy === 'connect'} onClick={() => run('connect', 'connect', {}, r => { window.location.href = r.url; })}>{busy === 'connect' ? 'Opening Microsoft…' : 'Connect Microsoft account'}</button>
    </> : <>
      {mine.map(l => <div key={l.id} className="card" style={{ background: 'var(--sf)', padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="file-row" style={{ padding: 0 }}><span className="file-badge" style={{ background: '#1F7246' }}>X</span><span className="grow"><b>{l.name}</b><small>Sheet “{l.worksheetName}” · two-way sync</small></span>
          <span className={'chip ' + (l.status === 'error' ? 'hero' : 'sage')}>{l.status === 'error' ? 'Needs attention' : l.lastSyncedAt ? 'Synced ' + ago(Date.parse(l.lastSyncedAt)).toLowerCase() : 'Linking…'}</span>
          <button className="ghost sm" disabled={busy === 'sync' + l.id} onClick={() => run('sync' + l.id, 'syncNow', { linkId: l.id }, r => toast(r.queued ? 'A sync is already running. Your sheet will catch up in a moment.' : 'Synced with Excel.'))}>{busy === 'sync' + l.id ? 'Syncing…' : 'Sync now'}</button>
          {l.webUrl && <a className="ghost sm" href={l.webUrl} target="_blank" rel="noopener noreferrer">Open ↗</a>}</div>
        {l.error && <p className="notice hero" style={{ margin: 0 }}>{l.error}</p>}
        {(l.conflicts || []).map(c => <div key={c.id + c.field} className="notice">“{c.title}”: {LABEL[c.field].toLowerCase()} changed in both places — Terracove has <b>{c.app || 'empty'}</b>, the sheet has <b>{c.sheet || 'empty'}</b>.
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}><button className="btn sm" onClick={() => run('r', 'resolve', { linkId: l.id, id: c.id, field: c.field, keep: 'app' }, () => toast('Kept the Terracove value.'))}>Keep Terracove</button><button className="ghost sm" onClick={() => run('r', 'resolve', { linkId: l.id, id: c.id, field: c.field, keep: 'sheet' }, () => toast('Kept the sheet value.'))}>Keep sheet</button></div></div>)}
        {(l.invalid || []).length > 0 && <p className="notice soft" style={{ margin: 0 }}>{l.invalid.length} cell{l.invalid.length === 1 ? '' : 's'} could not be read (for example a status Terracove does not know). They are skipped until fixed in the sheet.</p>}
        {((l.removedInSheet || []).length > 0 || (l.removedInApp || []).length > 0) && <p className="notice soft" style={{ margin: 0 }}>Rows deleted on one side stop syncing; nothing is deleted on the other side.</p>}
        <details><summary>Column mapping</summary><table className="map-table"><thead><tr><th>Sheet column</th><th>Terracove field</th><th>Sync</th></tr></thead><tbody>{(l.mapping || []).map(m => <tr key={m.field}><td>{m.column}</td><td>{LABEL[m.field]}</td><td>{DIRECTION[m.direction]}</td></tr>)}</tbody></table></details>
        <button className="ghost danger sm" style={{ alignSelf: 'flex-start' }} onClick={() => run('u' + l.id, 'unlink', { linkId: l.id }, () => toast('Sheet unlinked. Nothing was deleted from the workbook.'))}>Unlink sheet</button>
      </div>)}
      <form onSubmit={e => { e.preventDefault(); run('link', 'link', { shareUrl: url, worksheet: sheet, scope }, r => { setUrl(''); toast(`Linked ${r.name} · ${r.worksheet}.`); }); }} style={{ display: 'grid', gap: 10 }}>
        <label>Workbook link (in Excel: Share → Copy link)<input type="url" required placeholder="https://…sharepoint.com/… or https://1drv.ms/…" value={url} onChange={e => setUrl(e.target.value)} /></label>
        <label>Worksheet<input value={sheet} maxLength={31} onChange={e => setSheet(e.target.value)} /></label>
        <small className="empty-note">Terracove adds the worksheet if it does not exist and writes a header row with a Terracove ID column. Only mapped cells are ever changed.</small>
        <button className="btn" style={{ justifySelf: 'start' }} disabled={busy === 'link'}>{busy === 'link' ? 'Linking…' : mine.length ? 'Link another sheet' : 'Link workbook'}</button>
      </form>
      <button className="ghost sm" style={{ alignSelf: 'flex-start' }} onClick={() => run('d', 'disconnect', {}, () => toast('Microsoft account disconnected. Linked workbooks are unchanged.'))}>Disconnect Microsoft</button>
    </>}
  </div>;
}

function PrdEditor({ doc: p, d, mut, toast, scope, close, user, demo }) {
  const edit = fn => mut(n => { const row = (n.docs || []).find(x => x.id === p.id); if (row) fn(row); });
  const [req, setReq] = useState('');
  const field = (key, label, rows = 3) => <label>{label}<textarea key={key + p.id} rows={rows} defaultValue={p[key] || ''} maxLength={5000} onBlur={e => { if (e.target.value !== (p[key] || '')) edit(r => { r[key] = e.target.value; }); }} /></label>;
  const linked = r => r.taskId && d.tasks.find(t => t.id === r.taskId);
  const toTasks = () => {
    const pending = (p.requirements || []).filter(r => !linked(r));
    if (!pending.length) return toast('Every requirement already has a task.');
    const project = scope.kind === 'project' ? d.projects.find(x => x.id === scope.id) : null;
    mut(n => { const row = n.docs.find(x => x.id === p.id); for (const r of row.requirements) { if (r.taskId && n.tasks.some(t => t.id === r.taskId)) continue; const id = rid(); r.taskId = id; n.tasks.push({ id, title: r.title, status: r.done ? 'Done' : 'Todo', priority: '', project: project?.id || '', client: scope.kind === 'client' ? scope.id : project?.client || '', durationMinutes: 60, notes: 'From ' + row.title, createdAt: new Date().toISOString() }); } });
    toast(`${pending.length} task${pending.length === 1 ? '' : 's'} created from the PRD.`);
  };
  return <div className="card" style={{ background: 'var(--sf)', display: 'grid', gap: 12 }}>
    <div className="block-head" style={{ margin: 0 }}><input aria-label="PRD title" className="note-title" style={{ color: 'var(--tx)' }} defaultValue={p.title} key={'t' + p.id} onBlur={e => { const v = e.target.value.trim() || 'Untitled PRD'; if (v !== p.title) edit(r => { r.title = v; }); }} />
      <select aria-label="PRD status" value={p.status || 'Draft'} onChange={e => edit(r => { r.status = e.target.value; })} style={{ width: 'auto' }}>{['Draft', 'In review', 'Approved'].map(s => <option key={s}>{s}</option>)}</select>
      <button className="ghost sm" onClick={close}>Done</button></div>
    {field('problem', 'Problem')}{field('goals', 'Goals and success measures')}{field('outOfScope', 'Out of scope', 2)}
    <b>Requirements</b>
    {(p.requirements || []).map((r, i) => { const task = linked(r), done = task ? task.status === 'Done' : r.done; return <div key={r.id} className={'check-item' + (done ? ' done' : '')} style={{ background: done ? 'transparent' : 'var(--card)', color: 'var(--tx)', borderColor: 'var(--tx)' }}>
      <button type="button" className="check-box" style={{ borderColor: 'var(--tx)' }} role="checkbox" aria-checked={!!done} disabled={!!task} aria-label={(task ? 'Linked to a task: ' : 'Toggle ') + r.title} onClick={() => edit(row => { const x = row.requirements.find(y => y.id === r.id); x.done = !x.done; })}>{done && <Icon name="check" size={14} />}</button>
      <span>R{i + 1} · {r.title}</span>{task && <a className="chip white" href={'#/tasks/' + task.id}>Task · {task.status}</a>}
      <button type="button" className="icon-x" aria-label={'Remove ' + r.title} onClick={() => edit(row => { row.requirements = row.requirements.filter(y => y.id !== r.id); })}>×</button></div>; })}
    <form className="add-row" style={{ background: 'var(--card)' }} onSubmit={e => { e.preventDefault(); const title = req.trim(); if (!title) return; edit(r => { r.requirements = [...(r.requirements || []), { id: rid(), title: title.slice(0, 300), done: false }]; }); setReq(''); }}><Icon name="plus" size={16} /><input aria-label="New requirement" placeholder="Add a requirement…" value={req} onChange={e => setReq(e.target.value)} /><button className="btn sm">Add</button></form>
    <button className="ghost" style={{ justifySelf: 'start' }} onClick={toTasks}>Turn requirements into tasks</button>
    <ApprovalBox d={d} mut={mut} user={user} demo={demo} item={p} kind="prd" toast={toast} compact />
  </div>;
}

export function FilesAndDocs({ d, mut, toast, scope, user, demo }) {
  const key = scope.kind, items = (d.docs || []).filter(x => x[key] === scope.id).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  const [openId, setOpenId] = useState(null), [adding, setAdding] = useState(false), [link, setLink] = useState({ title: '', url: '' }), [approveId, setApproveId] = useState(null);
  const owner = () => { const project = key === 'project' ? d.projects.find(p => p.id === scope.id) : null; return { client: key === 'client' ? scope.id : project?.client || '', project: key === 'project' ? scope.id : '' }; };
  const newPrd = () => { const id = rid(); mut(n => { n.docs = [{ id, kind: 'prd', title: 'Untitled PRD', status: 'Draft', problem: '', goals: '', outOfScope: '', requirements: [], ...owner() }, ...(n.docs || [])]; }); setOpenId(id); };
  const addLink = e => { e.preventDefault(); const url = safeLink(link.url); if (!link.title.trim() || !url) return toast('Add a name and a full web address starting with https://.'); mut(n => { n.docs = [{ id: rid(), kind: 'link', title: link.title.trim().slice(0, 120), url, ...owner() }, ...(n.docs || [])]; }); setLink({ title: '', url: '' }); setAdding(false); };
  const open = items.find(x => x.id === openId && x.kind === 'prd');
  const excelOn = import.meta.env.VITE_EXCEL_SYNC === 'on';
  return <div className={excelOn ? 'two-col' : 'docs-only'}>
    {excelOn ? <ExcelSync scope={scope} user={user} demo={demo} toast={toast} /> : <p className="excel-soon"><span className="chip sand">Coming soon</span>Live Excel sync for this {scope.kind}. Until then, link the workbook under Documents.</p>}
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="docs-head"><h3>Documents</h3><div className="doc-actions"><button type="button" className={'doc-action' + (adding ? ' on' : '')} aria-expanded={adding} onClick={() => setAdding(!adding)}><span className="doc-action-icon link"><Icon name="link" size={16} /></span><span><b>Link a file</b><small>Drive, Figma, Notion…</small></span></button><button type="button" className="doc-action" onClick={newPrd}><span className="doc-action-icon prd"><Icon name="plus" size={16} /></span><span><b>New PRD</b><small>Write requirements</small></span></button></div></div>
        {adding && <form onSubmit={addLink} style={{ display: 'grid', gap: 8 }}><label>Name<input value={link.title} onChange={e => setLink({ ...link, title: e.target.value })} placeholder="Content inventory" /></label><label>Link<input type="url" value={link.url} onChange={e => setLink({ ...link, url: e.target.value })} placeholder="https://drive.google.com/…" /></label><button className="btn sm" style={{ justifySelf: 'start' }}>Add link</button></form>}
        {items.map(x => <div key={x.id} className="file-row"><span className="file-badge" style={{ background: x.kind === 'prd' ? 'var(--hero-deep)' : '#4A5566' }}>{x.kind === 'prd' ? 'P' : <Icon name="link" size={16} />}</span>
          <span className="grow"><b>{x.title}</b><small>{x.kind === 'prd' ? `Written in Terracove · ${(x.requirements || []).length} requirements` : host(x.url)}</small></span>
          {x.kind === 'prd' ? <><span className={'chip ' + (x.status === 'Approved' ? 'sage' : x.status === 'In review' ? 'sand' : 'white')}>{x.status || 'Draft'}</span><button className="ghost sm" onClick={() => setOpenId(openId === x.id ? null : x.id)}>{openId === x.id ? 'Close' : 'Open'}</button></> : <>{x.approval && <span className={'chip ' + ({ pending: 'hero', approved: 'sage', changes: 'sand' })[x.approval.state]}>{APPROVAL_LABEL[x.approval.state]}</span>}<button className="ghost sm" aria-expanded={approveId === x.id} onClick={() => setApproveId(approveId === x.id ? null : x.id)}>Approval</button><a className="ghost sm" href={safeLink(x.url)} target="_blank" rel="noopener noreferrer">Open ↗</a></>}
          <button className="icon-x" aria-label={'Move ' + x.title + ' to Trash'} onClick={() => { mut(n => trashReusable(n, 'docs', x.id)); toast('Moved to Trash.'); }}>×</button></div>)}
        {!items.length && <p className="empty-note">Write a PRD here, or link files from Google Drive, OneDrive, Notion or Figma.</p>}
      </div>
      {items.filter(x => x.id === approveId && x.kind === 'link').map(x => <ApprovalBox key={x.id} d={d} mut={mut} user={user} demo={demo} item={x} kind="link" toast={toast} />)}
      {open && <PrdEditor doc={open} d={d} mut={mut} toast={toast} scope={scope} close={() => setOpenId(null)} user={user} demo={demo} />}
    </div>
  </div>;
}
