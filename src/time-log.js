// Logged time on tasks. Manual entries are focus sessions like the timer's, so billing (billing.js) and
// project totals pick them up with no extra code. An entry that is on an existing invoice is locked.
import { rid, today } from './lib.js';

// "1h 30m", "1.5h", "90", "90m", "1:30", "45 min" → minutes. Plain numbers are minutes.
export function parseDuration(text) {
  const s = String(text || '').trim().toLowerCase().replace(',', '.');
  if (!s) return 0;
  let m = s.match(/^(\d+):(\d{1,2})$/);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  m = s.match(/^(?:(\d+(?:\.\d+)?)\s*h(?:ours?|rs?)?)?\s*(?:(\d+(?:\.\d+)?)\s*m(?:in(?:ute)?s?)?)?$/);
  if (m && (m[1] || m[2])) return Math.round(Number(m[1] || 0) * 60 + Number(m[2] || 0));
  if (/^\d+(\.\d+)?$/.test(s)) return Math.round(Number(s));
  return 0;
}

export const formatMinutes = minutes => {
  const h = Math.floor(minutes / 60), m = Math.round(minutes % 60);
  return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
};

export function taskTime(workspace, taskId) {
  const invoices = new Set(workspace.invoices.map(i => i.id));
  const entries = (workspace.focusSessions || []).filter(s => s.taskId === taskId)
    .map(s => ({ ...s, billed: !!(s.invoiceId && invoices.has(s.invoiceId)) }))
    .sort((a, b) => b.at.localeCompare(a.at));
  return { entries, minutes: entries.reduce((n, s) => n + Number(s.seconds || 0), 0) / 60 };
}

export function logTime(workspace, taskId, { minutes, date = today(), note = '' }, now = new Date()) {
  const task = workspace.tasks.find(t => t.id === taskId);
  if (!task) throw new Error('This task could not be found.');
  if (!(minutes > 0) || minutes > 24 * 60) throw new Error('Enter a time between 1 minute and 24 hours, for example 1h 30m.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > today()) throw new Error('Pick today or an earlier day.');
  // Today's entries keep the real time; earlier days sit at midday so they never slip a day across time zones.
  const at = date === today() ? now.toISOString() : new Date(date + 'T12:00:00').toISOString();
  const entry = { id: rid(), taskId, title: task.title, project: task.project || '', at, seconds: Math.round(minutes * 60), manual: true, ...(note.trim() ? { note: note.trim().slice(0, 200) } : {}) };
  workspace.focusSessions = [entry, ...(workspace.focusSessions || [])];
  return entry.id;
}

export function removeTimeEntry(workspace, entryId) {
  const entry = (workspace.focusSessions || []).find(s => s.id === entryId);
  if (!entry) return false;
  if (entry.invoiceId && workspace.invoices.some(i => i.id === entry.invoiceId)) throw new Error('This time is on an invoice. Delete or change that invoice first.');
  workspace.focusSessions = workspace.focusSessions.filter(s => s.id !== entryId);
  return true;
}
