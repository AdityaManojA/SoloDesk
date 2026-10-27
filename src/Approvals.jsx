import { useEffect, useRef, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import Icon from './Icon';
import { REPLIES, REPLY_TONE, replyLabel } from './client-feed';
import { replyToRequest, deleteRequest, clearResponse } from './portal-sync';
import { rid } from './lib';
import { APPROVAL_LABEL, KIND_LABEL, approvalClient, approvalItems, applyResponses, requestApproval, withdrawApproval, findItem } from './approvals';
import { quoteToInvoice } from './billing';

const CHIP = { pending: 'hero', approved: 'sage', changes: 'sand' };
const when = iso => iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '';
const republish = (d, user, clientId, toast) => import('./ClientPortal.jsx').then(m => m.republishShare(d, user.uid, clientId)).catch(() => toast('Saved. The client portal will catch up in a moment.'));

// While Terracove is open, copy client answers from the portal onto their items, then refresh that portal.
export function useApprovalSync({ d, mut, user, demo, toast }) {
  const latest = useRef(d); latest.current = d;
  const clients = !d ? '' : [...new Set(approvalItems(d).map(x => approvalClient(d, x.row)).filter(Boolean))].sort().join(',');
  useEffect(() => {
    if (demo || !user || !db || !clients) return;
    const offs = clients.split(',').map(clientId => onSnapshot(collection(db, 'solodeskPortals', user.uid, 'shares', clientId, 'responses'), snap => {
      const responses = snap.docs.map(x => ({ ...x.data(), at: x.data().at?.toDate?.().toISOString() }));
      const next = structuredClone(latest.current), changed = applyResponses(next, clientId, responses);
      if (!changed.length) return;
      mut(n => { applyResponses(n, clientId, responses); });
      toast(changed.map(id => findItem(next, id).row).map(r => `“${r.title || r.no}” ${r.approval.state === 'approved' ? 'was approved' : 'needs changes'}`).join(' · '));
      republish(next, user, clientId, toast);
    }, () => {}));
    return () => offs.forEach(f => f());
  }, [clients, user?.uid, demo]);
}

// Send a task, PRD, file or draft invoice (as a quote) for approval.
export function ApprovalBox({ d, mut, user, demo, item, kind = 'task', toast, compact = false }) {
  const [note, setNote] = useState(''), [open, setOpen] = useState(false);
  const clientId = approvalClient(d, item), client = d.clients.find(c => c.id === clientId), a = item.approval, what = KIND_LABEL[kind].toLowerCase();
  const send = async () => {
    const next = structuredClone(d);
    try { requestApproval(next, item.id, note); } catch (e) { toast(e.message); return; }
    if (!demo && user && clientId) await clearResponse(user, clientId, item.id);
    mut(n => { requestApproval(n, item.id, note); });
    setOpen(false); setNote('');
    if (demo || !user) { toast('Marked as waiting for approval. In your signed-in workspace it also appears in the client portal.'); return; }
    const shared = await republish(next, user, clientId, toast);
    toast(shared ? `Sent to ${client.name}’s portal for approval.` : `Marked as waiting. Set up Client access for ${client.name} so they can approve it.`);
  };
  const withdraw = () => { if (!demo && user && clientId) clearResponse(user, clientId, item.id); const next = structuredClone(d); withdrawApproval(next, item.id); mut(n => { withdrawApproval(n, item.id); }); if (!demo && user) republish(next, user, clientId, toast); toast(a?.state === 'pending' ? 'Approval request withdrawn.' : 'Approval request deleted.'); };
  if (kind === 'quote' && item.state !== 'draft' && !a) return null;
  return <section className={'card approval-box' + (compact ? ' compact' : '') + (a ? ' state-' + a.state : '')}>
    <div className="block-head" style={{ margin: 0 }}><h3><Icon name="approve" size={18} /> {kind === 'quote' ? 'Quote approval' : 'Client approval'}</h3>{a && <span className={'chip ' + CHIP[a.state]}>{APPROVAL_LABEL[a.state]}</span>}</div>
    {!client ? <p className="empty-note" style={{ margin: 0 }}>Give this {what} a client (or a project with a client) to send it for approval.</p>
      : a ? <>
        <p style={{ margin: 0 }}>Sent to <b>{client.name}</b> on {when(a.requestedAt)}{a.note ? <> with “{a.note}”</> : ''}.</p>
        {a.state !== 'pending' && <p className="approval-result" style={{ margin: 0 }}>{a.state === 'approved' ? 'Approved' : 'Changes requested'} on {when(a.decidedAt)}{a.comment && <><br /><span>“{a.comment}”</span></>}{a.signOff && <><br /><small style={{ color: 'var(--sage-dark, #2b6e4e)', fontWeight: 600 }}>✓ Formally signed by {a.signOff.name}{a.signOff.email ? ` (${a.signOff.email})` : ''}</small></>}</p>}
        {kind === 'quote' && a.state === 'approved' && <div className="context-actions" style={{ marginTop: 8 }}>
          <button type="button" className="btn sm" onClick={() => {
            let invId;
            try {
              mut(n => { invId = quoteToInvoice(n, item.id); });
              toast('Invoice generated from approved quote!');
              window.location.hash = '#/invoices/' + invId;
            } catch (e) { toast(e.message); }
          }}>Generate Invoice (100%)</button>
          <button type="button" className="ghost sm" onClick={() => {
            let invId;
            try {
              mut(n => { invId = quoteToInvoice(n, item.id, { depositPercent: 50 }); });
              toast('50% deposit invoice generated from approved quote!');
              window.location.hash = '#/invoices/' + invId;
            } catch (e) { toast(e.message); }
          }}>50% Upfront Deposit Invoice</button>
        </div>}
        <div className="context-actions">{a.state !== 'pending' && <button className="btn sm" onClick={() => setOpen(true)}>Send again</button>}<button className="ghost sm" onClick={withdraw}>{a.state === 'pending' ? 'Withdraw request' : 'Delete request'}</button></div>
      </> : !open && <><p style={{ margin: 0 }}>{kind === 'quote' ? <>Send this draft to <b>{client.name}</b> as a quote. They accept it or ask for changes in their portal.</> : <>Ask <b>{client.name}</b> to approve this {what} in their client portal. You’ll see their answer here.</>}</p><button className="btn sm approve" style={{ justifySelf: 'start' }} onClick={() => setOpen(true)}><Icon name="check" size={16} />{kind === 'quote' ? 'Send as quote' : 'Send for approval'}</button></>}
    {open && client && <div className="approval-send"><label>Message to {client.name} (optional)<textarea rows="2" maxLength={1000} value={note} onChange={e => setNote(e.target.value)} placeholder={kind === 'quote' ? 'Here’s the quote for the website. Happy to go ahead?' : 'Here it is. Happy for it to go ahead?'} /></label><div className="context-actions"><button className="btn sm approve" onClick={send}>{kind === 'quote' ? 'Send as quote' : 'Send for approval'}</button><button className="ghost sm" onClick={() => setOpen(false)}>Cancel</button></div></div>}
  </section>;
}

// One client request: what they asked, and a dropdown to answer with a label (or your own timing).
function RequestRow({ r, d, mut, user, toast }) {
  const [reply, setReply] = useState(r.reply || 'now'), [text, setText] = useState(r.replyText || ''), [busy, setBusy] = useState(false);
  const client = d.clients.find(c => c.id === r.clientId), project = d.projects.find(p => p.id === r.projectId), task = r.taskId && d.tasks.find(t => t.id === r.taskId);
  const send = async (taskId) => {
    if (reply === 'custom' && !text.trim()) { toast('Write the timing for your custom reply, for example “Ready by Friday 30 Oct”.'); return; }
    setBusy(true);
    try { await replyToRequest(user, r.clientId, r.id, reply, reply === 'custom' ? text : '', taskId); toast(`Sent to ${client?.name || 'your client'}: ${reply === 'custom' ? text.trim() : REPLIES[reply]}.`); }
    catch { toast('Your reply could not be sent. Check your connection and try again.'); } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!window.confirm(`Delete “${r.title}”? ${client?.name || 'Your client'} won’t see it in their portal any more.`)) return;
    setBusy(true);
    try { await deleteRequest(user, r.clientId, r.id); toast('Request deleted.'); }
    catch { toast('The request could not be deleted. Check your connection and try again.'); setBusy(false); }
  };
  const addTask = () => { const id = rid(); mut(n => { n.tasks.push({ id, title: r.title.slice(0, 300), status: reply === 'progress' || reply === 'now' ? 'In progress' : 'Todo', priority: '', client: r.clientId, project: r.projectId && d.projects.some(p => p.id === r.projectId) ? r.projectId : '', notes: r.details || '', durationMinutes: 60, createdAt: new Date().toISOString() }); }); send(id); };
  return <article className={'request-card' + (r.reply ? ' answered' : '')}>
    <div className="approval-head"><span className={'chip ' + (r.reply ? REPLY_TONE[r.reply] : 'hero')}>{r.reply ? replyLabel(r) : 'New request'}</span><small>{client?.name}{project ? ' · ' + project.name : ''} · {r.at ? new Date(r.at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : ''}</small></div>
    <h3>{r.title}</h3>{r.details && <p className="request-details">{r.details}</p>}
    <div className="request-reply"><label>Reply<select value={reply} onChange={e => setReply(e.target.value)}>{Object.entries(REPLIES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
      {reply === 'custom' && <label>Timing<input maxLength={200} placeholder="Ready by Friday 30 Oct" value={text} onChange={e => setText(e.target.value)} /></label>}
      <div className="context-actions"><button className="btn sm" disabled={busy} onClick={() => send()}>{r.reply ? 'Update reply' : 'Send reply'}</button>{task ? <a className="ghost sm" href={'#/tasks/' + task.id}>Open task</a> : <button className="ghost sm" disabled={busy} onClick={addTask}>Reply and add as task</button>}<button className="ghost sm danger-text" disabled={busy} onClick={remove}>Delete</button></div></div>
  </article>;
}

export function ApprovalsPage({ d, mut, requests = [], user, demo, toast }) {
  const all = approvalItems(d);
  // Visiting the page clears the count on the Approvals menu item.
  useEffect(() => { const latest = all.map(x => x.row.approval.decidedAt || '').sort().at(-1) || ''; if (latest && latest > (d.settings.approvalsSeenAt || '')) mut(n => { n.settings.approvalsSeenAt = latest; }); }, [all.length, d.settings.approvalsSeenAt]);
  const [filter, setFilter] = useState('all');
  const groups = [['changes', 'Changes requested'], ['pending', 'Waiting for client'], ['approved', 'Approved']];
  const ready = d.tasks.filter(t => !t.approval && !t.arch && t.status !== 'Done' && approvalClient(d, t)).slice(0, 6);
  const remove = (row, title) => { const clientId = approvalClient(d, row), next = structuredClone(d); if (!demo && user && clientId) clearResponse(user, clientId, row.id); withdrawApproval(next, row.id); mut(n => { withdrawApproval(n, row.id); }); if (!demo && user && clientId) republish(next, user, clientId, toast); toast(`Removed the approval request for “${title}”. Undo brings it back.`); };
  return <>
    <div className="page-head"><div className="grow"><h1>Approvals</h1><p className="empty-note" style={{ margin: '6px 0 0' }}>Send tasks, PRDs, files and quotes to clients for sign-off. They approve or ask for changes in their client portal.</p></div></div>
    {(requests.length > 0 || !demo) && <section className="approval-group"><h2>Requests from clients {requests.filter(r => !r.reply).length > 0 && <span className="tab-count">{requests.filter(r => !r.reply).length}</span>}</h2>
      {requests.length ? <div className="request-grid">{[...requests].sort((a, b) => (!!a.reply - !!b.reply) || b.at.localeCompare(a.at)).map(r => <RequestRow key={r.clientId + r.id} r={r} d={d} mut={mut} user={user} toast={toast} />)}</div> : <p className="empty-note">When a client asks for something in their portal (“Can you also add a blog?”), it shows here so you can reply.</p>}</section>}
    <div className="approval-stats">{groups.map(([k, l]) => <button key={k} type="button" className={'approval-stat ' + k + (filter === k ? ' on' : '')} onClick={() => setFilter(filter === k ? 'all' : k)}><strong>{all.filter(x => x.row.approval.state === k).length}</strong><span>{l}</span></button>)}</div>
    {groups.filter(([k]) => filter === 'all' || filter === k).map(([k, l]) => { const list = all.filter(x => x.row.approval.state === k); return list.length > 0 && <section key={k} className="approval-group"><h2>{l}</h2>{list.map(({ kind, row, title, href }) => { const client = d.clients.find(c => c.id === approvalClient(d, row)), project = d.projects.find(p => p.id === row.project); return <div key={row.id} className="approval-row-wrap"><a className={'approval-row state-' + k} href={href}>
      <span className={'approval-dot ' + k} /><span className="grow"><b>{title}</b><small><span className={'kind-tag ' + kind}>{KIND_LABEL[kind]}</span> {[client?.name, project?.name].filter(Boolean).join(' · ')} · sent {when(row.approval.requestedAt)}{row.approval.decidedAt ? ' · answered ' + when(row.approval.decidedAt) : ''}{row.approval.signOff ? ' · ✓ Signed by ' + row.approval.signOff.name : ''}</small>{row.approval.comment && <span className="approval-comment">“{row.approval.comment}”</span>}</span><span className={'chip ' + CHIP[k]}>{APPROVAL_LABEL[k]}</span><span aria-hidden="true">›</span></a>{k === 'approved' && kind === 'quote' && <div className="approval-inline-actions" style={{ display: 'inline-flex', gap: 6, margin: '0 8px' }}><button type="button" className="btn sm" style={{ padding: '2px 8px', fontSize: 11 }} onClick={(e) => { e.preventDefault(); e.stopPropagation(); let invId; try { mut(n => { invId = quoteToInvoice(n, row.id); }); toast('Invoice generated from approved quote!'); window.location.hash = '#/invoices/' + invId; } catch (err) { toast(err.message); } }}>Invoice (100%)</button><button type="button" className="ghost sm" style={{ padding: '2px 8px', fontSize: 11 }} onClick={(e) => { e.preventDefault(); e.stopPropagation(); let invId; try { mut(n => { invId = quoteToInvoice(n, row.id, { depositPercent: 50 }); }); toast('50% deposit invoice generated from approved quote!'); window.location.hash = '#/invoices/' + invId; } catch (err) { toast(err.message); } }}>50% Deposit</button></div>}<button type="button" className="icon-button approval-remove" aria-label={'Remove the approval request for ' + title} title="Remove request" onClick={() => remove(row, title)}><Icon name="close" size={16} /></button></div>; })}</section>; })}
    {!all.length && <div className="card approval-empty"><h3>Nothing out for approval</h3><p>Open a task, a PRD or file under Files & docs, or a draft invoice, and choose <b>Send for approval</b>. Your client sees it in their portal and can approve it or ask for changes.</p></div>}
    {ready.length > 0 && <section className="approval-group"><h2>Ready to send?</h2><p className="empty-note">Open tasks with a client. Open one to send it for approval.</p>{ready.map(t => <a key={t.id} className="approval-row" href={'#/tasks/' + t.id}><span className="approval-dot" /><span className="grow"><b>{t.title}</b><small>{d.clients.find(c => c.id === approvalClient(d, t))?.name} · {t.status}</small></span><span aria-hidden="true">›</span></a>)}</section>}
  </>;
}
