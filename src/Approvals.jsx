import { useEffect, useRef, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import Icon from './Icon';
import { APPROVAL_LABEL, KIND_LABEL, approvalClient, approvalItems, applyResponses, requestApproval, withdrawApproval, findItem } from './approvals';

const CHIP = { pending: 'hero', approved: 'sage', changes: 'sand' };
const when = iso => iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '';
const republish = (d, user, clientId, toast) => import('./ClientPortal.jsx').then(m => m.republishShare(d, user.uid, clientId)).catch(() => toast('Saved. The client portal will catch up in a moment.'));

// While SoloDesk is open, copy client answers from the portal onto their items, then refresh that portal.
export function useApprovalSync({ d, mut, user, demo, toast }) {
  const latest = useRef(d); latest.current = d;
  const clients = !d ? '' : [...new Set(approvalItems(d).filter(x => x.row.approval.state === 'pending').map(x => approvalClient(d, x.row)).filter(Boolean))].sort().join(',');
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
    mut(n => { requestApproval(n, item.id, note); });
    setOpen(false); setNote('');
    if (demo || !user) { toast('Marked as waiting for approval. In your signed-in workspace it also appears in the client portal.'); return; }
    const shared = await republish(next, user, clientId, toast);
    toast(shared ? `Sent to ${client.name}’s portal for approval.` : `Marked as waiting. Set up Client access for ${client.name} so they can approve it.`);
  };
  const withdraw = () => { const next = structuredClone(d); withdrawApproval(next, item.id); mut(n => { withdrawApproval(n, item.id); }); if (!demo && user) republish(next, user, clientId, toast); toast('Approval request withdrawn.'); };
  if (kind === 'quote' && item.state !== 'draft' && !a) return null;
  return <section className={'card approval-box' + (compact ? ' compact' : '') + (a ? ' state-' + a.state : '')}>
    <div className="block-head" style={{ margin: 0 }}><h3><Icon name="approve" size={18} /> {kind === 'quote' ? 'Quote approval' : 'Client approval'}</h3>{a && <span className={'chip ' + CHIP[a.state]}>{APPROVAL_LABEL[a.state]}</span>}</div>
    {!client ? <p className="empty-note" style={{ margin: 0 }}>Give this {what} a client (or a project with a client) to send it for approval.</p>
      : a ? <>
        <p style={{ margin: 0 }}>Sent to <b>{client.name}</b> on {when(a.requestedAt)}{a.note ? <> with “{a.note}”</> : ''}.</p>
        {a.state !== 'pending' && <p className="approval-result" style={{ margin: 0 }}>{a.state === 'approved' ? 'Approved' : 'Changes requested'} on {when(a.decidedAt)}{a.comment && <><br /><span>“{a.comment}”</span></>}</p>}
        <div className="context-actions">{a.state !== 'pending' && <button className="btn sm" onClick={() => setOpen(true)}>Send again</button>}<button className="ghost sm" onClick={withdraw}>{a.state === 'pending' ? 'Withdraw request' : 'Clear approval'}</button></div>
      </> : !open && <><p style={{ margin: 0 }}>{kind === 'quote' ? <>Send this draft to <b>{client.name}</b> as a quote. They accept it or ask for changes in their portal.</> : <>Ask <b>{client.name}</b> to approve this {what} in their client portal. You’ll see their answer here.</>}</p><button className="btn sm approve" style={{ justifySelf: 'start' }} onClick={() => setOpen(true)}><Icon name="check" size={16} />{kind === 'quote' ? 'Send as quote' : 'Send for approval'}</button></>}
    {open && client && <div className="approval-send"><label>Message to {client.name} (optional)<textarea rows="2" maxLength={1000} value={note} onChange={e => setNote(e.target.value)} placeholder={kind === 'quote' ? 'Here’s the quote for the website. Happy to go ahead?' : 'Here it is. Happy for it to go ahead?'} /></label><div className="context-actions"><button className="btn sm approve" onClick={send}>{kind === 'quote' ? 'Send as quote' : 'Send for approval'}</button><button className="ghost sm" onClick={() => setOpen(false)}>Cancel</button></div></div>}
  </section>;
}

export function ApprovalsPage({ d }) {
  const all = approvalItems(d);
  const [filter, setFilter] = useState('all');
  const groups = [['changes', 'Changes requested'], ['pending', 'Waiting for client'], ['approved', 'Approved']];
  const ready = d.tasks.filter(t => !t.approval && !t.arch && t.status !== 'Done' && approvalClient(d, t)).slice(0, 6);
  return <>
    <div className="page-head"><div className="grow"><h1>Approvals</h1><p className="empty-note" style={{ margin: '6px 0 0' }}>Send tasks, PRDs, files and quotes to clients for sign-off. They approve or ask for changes in their client portal.</p></div></div>
    <div className="approval-stats">{groups.map(([k, l]) => <button key={k} type="button" className={'approval-stat ' + k + (filter === k ? ' on' : '')} onClick={() => setFilter(filter === k ? 'all' : k)}><strong>{all.filter(x => x.row.approval.state === k).length}</strong><span>{l}</span></button>)}</div>
    {groups.filter(([k]) => filter === 'all' || filter === k).map(([k, l]) => { const list = all.filter(x => x.row.approval.state === k); return list.length > 0 && <section key={k} className="approval-group"><h2>{l}</h2>{list.map(({ kind, row, title, href }) => { const client = d.clients.find(c => c.id === approvalClient(d, row)), project = d.projects.find(p => p.id === row.project); return <a key={row.id} className={'approval-row state-' + k} href={href}>
      <span className={'approval-dot ' + k} /><span className="grow"><b>{title}</b><small><span className={'kind-tag ' + kind}>{KIND_LABEL[kind]}</span> {[client?.name, project?.name].filter(Boolean).join(' · ')} · sent {when(row.approval.requestedAt)}{row.approval.decidedAt ? ' · answered ' + when(row.approval.decidedAt) : ''}</small>{row.approval.comment && <span className="approval-comment">“{row.approval.comment}”</span>}</span><span className={'chip ' + CHIP[k]}>{APPROVAL_LABEL[k]}</span><span aria-hidden="true">›</span></a>; })}</section>; })}
    {!all.length && <div className="card approval-empty"><h3>Nothing out for approval</h3><p>Open a task, a PRD or file under Files & docs, or a draft invoice, and choose <b>Send for approval</b>. Your client sees it in their portal and can approve it or ask for changes.</p></div>}
    {ready.length > 0 && <section className="approval-group"><h2>Ready to send?</h2><p className="empty-note">Open tasks with a client. Open one to send it for approval.</p>{ready.map(t => <a key={t.id} className="approval-row" href={'#/tasks/' + t.id}><span className="approval-dot" /><span className="grow"><b>{t.title}</b><small>{d.clients.find(c => c.id === approvalClient(d, t))?.name} · {t.status}</small></span><span aria-hidden="true">›</span></a>)}</section>}
  </>;
}
