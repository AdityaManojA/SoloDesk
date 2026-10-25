// Client approvals. You send a task, a PRD, a linked file or a draft invoice (as a quote) for approval; it
// appears in that client's portal, where they approve it or ask for changes. Their answer is written to
// solodeskPortals/{owner}/shares/{client}/responses/{itemId} and copied onto the item the next time Terracove is
// open. Item ids are unique across tasks, docs and invoices, so the response only needs the id.
export const APPROVAL_LABEL = { pending: 'Waiting for client', approved: 'Approved', changes: 'Changes requested' };
export const DECISIONS = ['approved', 'changes'];
export const KIND_LABEL = { task: 'Task', prd: 'PRD', link: 'File', quote: 'Quote' };

const LISTS = [['tasks', 'task'], ['docs', 'doc'], ['invoices', 'quote']];
// The record behind an id, with its kind (task, prd, link or quote).
export function findItem(workspace, id) {
  for (const [list, kind] of LISTS) {
    const row = (workspace[list] || []).find(x => x.id === id);
    if (row) return { list, row, kind: kind === 'doc' ? (row.kind === 'prd' ? 'prd' : 'link') : kind };
  }
  return null;
}
export const itemTitle = (kind, row) => kind === 'quote' ? (row.title ? `${row.no} · ${row.title}` : row.no) : row.title || row.name || 'Untitled';
export const itemHref = (kind, row) => kind === 'task' ? '#/tasks/' + row.id : kind === 'quote' ? '#/invoices/' + row.id : row.project ? '#/projects/' + row.project : '#/clients/' + row.client;

export const approvalClient = (workspace, row) => row?.client || workspace.projects.find(p => p.id === row?.project)?.client || '';

export function requestApproval(workspace, id, note = '', now = new Date()) {
  const found = findItem(workspace, id);
  if (!found) throw new Error('This item could not be found.');
  if (found.kind === 'quote' && found.row.state !== 'draft') throw new Error('Only a draft invoice can be sent as a quote.');
  if (!approvalClient(workspace, found.row)) throw new Error('Choose a client for this ' + KIND_LABEL[found.kind].toLowerCase() + ' (or its project) before sending it for approval.');
  found.row.approval = { state: 'pending', note: String(note || '').trim().slice(0, 1000), requestedAt: now.toISOString() };
  if (found.kind === 'prd' && found.row.status !== 'Approved') found.row.status = 'In review';
  return found.row;
}

export function withdrawApproval(workspace, id) {
  const found = findItem(workspace, id);
  if (found) delete found.row.approval;
}

// Copy client answers onto their items. Only an answer given after the latest request counts, and a client
// can change their mind: an answer newer than the one already recorded replaces it.
export function applyResponses(workspace, clientId, responses) {
  const changed = [];
  for (const r of responses) {
    const found = findItem(workspace, r.taskId), row = found?.row;
    const at = typeof r.at === 'string' ? r.at : r.at?.toDate?.().toISOString();
    if (!row?.approval || !DECISIONS.includes(r.decision) || !at || at < row.approval.requestedAt) continue;
    if (row.approval.state !== 'pending' && (!row.approval.decidedAt || at <= row.approval.decidedAt)) continue;
    if (approvalClient(workspace, row) !== clientId) continue;
    row.approval = { ...row.approval, state: r.decision, comment: String(r.comment || '').slice(0, 1000), decidedAt: at };
    if (found.kind === 'prd') row.status = r.decision === 'approved' ? 'Approved' : 'In review';
    changed.push(row.id);
  }
  return changed;
}

export const validApproval = a => a == null || (typeof a === 'object' && !Array.isArray(a) && Object.keys(APPROVAL_LABEL).includes(a.state)
  && typeof a.requestedAt === 'string' && ['note', 'comment', 'decidedAt'].every(k => a[k] == null || typeof a[k] === 'string'));

// Everything out for approval, newest activity first.
export function approvalItems(workspace) {
  const out = [];
  for (const [list] of LISTS) for (const row of workspace[list] || []) if (row.approval && !row.arch) { const { kind } = findItem(workspace, row.id); out.push({ kind, row, title: itemTitle(kind, row), href: itemHref(kind, row) }); }
  return out.sort((a, b) => (b.row.approval.decidedAt || b.row.approval.requestedAt).localeCompare(a.row.approval.decidedAt || a.row.approval.requestedAt));
}
export const approvalTasks = workspace => workspace.tasks.filter(t => t.approval && !t.arch);
