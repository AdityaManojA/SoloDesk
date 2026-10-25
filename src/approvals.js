// Client approvals. You send a task for approval; it appears in that client's portal, where they approve it or
// ask for changes. Their answer is written to solodeskPortals/{owner}/shares/{client}/responses/{taskId} and
// copied onto the task the next time SoloDesk is open.
export const APPROVAL_LABEL = { pending: 'Waiting for client', approved: 'Approved', changes: 'Changes requested' };
export const DECISIONS = ['approved', 'changes'];

export const approvalClient = (workspace, task) => task?.client || workspace.projects.find(p => p.id === task?.project)?.client || '';

export function requestApproval(workspace, taskId, note = '', now = new Date()) {
  const task = workspace.tasks.find(t => t.id === taskId);
  if (!task) throw new Error('This task could not be found.');
  if (!approvalClient(workspace, task)) throw new Error('Choose a client for this task (or its project) before sending it for approval.');
  task.approval = { state: 'pending', note: String(note || '').trim().slice(0, 1000), requestedAt: now.toISOString() };
  return task;
}

export function withdrawApproval(workspace, taskId) {
  const task = workspace.tasks.find(t => t.id === taskId);
  if (task) delete task.approval;
}

// Copy client answers onto their tasks. Only an answer given after the latest request counts.
export function applyResponses(workspace, clientId, responses) {
  const changed = [];
  for (const r of responses) {
    const task = workspace.tasks.find(t => t.id === r.taskId);
    const at = typeof r.at === 'string' ? r.at : r.at?.toDate?.().toISOString();
    if (!task?.approval || task.approval.state !== 'pending' || !DECISIONS.includes(r.decision) || !at || at < task.approval.requestedAt) continue;
    if (approvalClient(workspace, task) !== clientId) continue;
    task.approval = { ...task.approval, state: r.decision, comment: String(r.comment || '').slice(0, 1000), decidedAt: at };
    changed.push(task.id);
  }
  return changed;
}

export const validApproval = a => a == null || (typeof a === 'object' && !Array.isArray(a) && Object.keys(APPROVAL_LABEL).includes(a.state)
  && typeof a.requestedAt === 'string' && ['note', 'comment', 'decidedAt'].every(k => a[k] == null || typeof a[k] === 'string'));

export const approvalTasks = workspace => workspace.tasks.filter(t => t.approval && !t.arch);
