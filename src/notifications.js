// The bell in the top bar. Everything here is worked out from the workspace (and live client comments), so
// nothing extra is stored except when you last opened the list (settings.notificationsSeenAt).
import { approvalItems, approvalClient } from './approvals.js';
import { calc, status, today, money } from './lib.js';

const CLIENT_ACTIONS = { 'client-updated-link': 'updated a link', 'client-added-link': 'added a link', 'client-updated-file': 'updated a shared file' };

export function buildNotifications(workspace, comments = [], now = new Date()) {
  const t = today(), out = [], cname = id => workspace.clients.find(c => c.id === id)?.name || 'Your client';
  for (const { kind, row, title, href } of approvalItems(workspace)) {
    if (row.approval.state === 'pending' || !row.approval.decidedAt) continue;
    const who = cname(approvalClient(workspace, row));
    out.push({ id: 'ap-' + row.id + row.approval.decidedAt, at: row.approval.decidedAt, kind: row.approval.state === 'approved' ? 'approved' : 'changes', title: `${who} ${row.approval.state === 'approved' ? (kind === 'quote' ? 'accepted' : 'approved') : 'asked for changes to'} “${title}”`, detail: row.approval.comment || '', href: '#/approvals' });
  }
  for (const c of comments) {
    if (c.from !== 'client' || !c.at) continue;
    const task = workspace.tasks.find(x => x.id === c.itemId);
    out.push({ id: 'cm-' + c.id, at: c.at, kind: c.kind === 'cheer' ? 'cheer' : c.kind === 'change' ? 'changes' : 'comment', title: `${cname(c.clientId)} ${c.kind === 'cheer' ? 'cheered you on' + (task ? ' for' : '') : c.kind === 'change' ? 'requested a change' + (task ? ' to' : '') : 'commented' + (task ? ' on' : '')}${task ? ` “${task.title}”` : ''}`, detail: c.kind === 'cheer' ? '' : c.text, href: task ? '#/tasks/' + task.id : '#/approvals' });
  }
  for (const a of workspace.activity || []) if (CLIENT_ACTIONS[a.action]) out.push({ id: 'ac-' + a.id, at: a.at, kind: 'link', title: `${cname(a.client)} ${CLIENT_ACTIONS[a.action]}`, detail: a.title, href: '#/clients/' + a.client });
  for (const i of workspace.invoices) if (status(i) === 'Overdue') out.push({ id: 'od-' + i.id + i.due, at: i.due + 'T09:00:00.000Z', kind: 'overdue', title: `${i.no} is overdue`, detail: `${cname(i.client)} · ${money(calc(i).bal)} outstanding`, href: '#/invoices/' + i.id });
  for (const n of workspace.notes || []) for (const c of n.checklist || []) if (!c.done && c.due && c.due <= t) out.push({ id: 'rm-' + c.id + c.due, at: c.due + 'T08:00:00.000Z', kind: 'reminder', title: c.title || 'Reminder', detail: (c.due === t ? 'Today' : 'Overdue') + (n.title ? ' · ' + n.title : ''), href: '#/notes/' + n.id });
  for (const k of workspace.tasks) if (!k.arch && k.status !== 'Done' && k.due && k.due === t) out.push({ id: 'td-' + k.id + k.due, at: k.due + 'T07:00:00.000Z', kind: 'due', title: `“${k.title}” is due today`, detail: '', href: '#/tasks/' + k.id });
  return out.filter(x => x.at <= now.toISOString() || x.kind === 'due' || x.kind === 'reminder').sort((a, b) => b.at.localeCompare(a.at)).slice(0, 40);
}

export const unreadCount = (list, seenAt) => list.filter(x => !seenAt || x.at > seenAt).length;
// Approvals with an answer you have not looked at yet: the count on the Approvals menu item.
export const unseenAnswers = (workspace, seenAt) => approvalItems(workspace).filter(x => x.row.approval.state !== 'pending' && x.row.approval.decidedAt && (!seenAt || x.row.approval.decidedAt > seenAt)).length;
