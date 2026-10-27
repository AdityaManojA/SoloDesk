// Logged time → invoices. Focus sessions for a project that are not on an invoice yet are "unbilled".
// Invoicing them adds a draft invoice with one line per task (hours rounded to the quarter hour) at the
// project's hourly rate, and marks those sessions with the invoice. Deleting that draft frees them again.
import { nextInvoiceNumber } from './invoice-input.js';
import { rid, today, addDays, round2 } from './lib.js';

const quarter = hours => Math.round(hours * 4) / 4;

// One line per task, rounded to the quarter hour. Tasks under 8 minutes round to 0: they stay unbilled
// (and keep adding up) instead of being marked as invoiced and lost.
function taskLines(sessions) {
  const byTask = new Map();
  for (const s of sessions) {
    const key = s.taskId ? `task:${s.taskId}` : `title:${s.title || 'Project work'}`;
    const t = byTask.get(key) || { desc: s.title || 'Project work', hours: 0, sessions: [] };
    if (s.title) t.desc = s.title;
    t.hours += Number(s.seconds || 0) / 3600;
    t.sessions.push(s);
    byTask.set(key, t);
  }
  return [...byTask.values()].map(t => ({ desc: t.desc, qty: quarter(t.hours), sessions: t.sessions })).filter(l => l.qty > 0);
}

export function unbilled(workspace, projectId) {
  const invoices = new Set(workspace.invoices.map(i => i.id));
  const sessions = (workspace.focusSessions || []).filter(s => s.project === projectId && !(s.invoiceId && invoices.has(s.invoiceId)));
  const hours = sessions.reduce((n, s) => n + Number(s.seconds || 0), 0) / 3600;
  const rate = Number(workspace.projects.find(p => p.id === projectId)?.hourlyRate) || 0;
  const billable = taskLines(sessions).reduce((n, l) => n + l.qty, 0);
  return { sessions, hours, billable, value: billable * rate, rate };
}

export function invoiceUnbilledHours(workspace, projectId, now = today(), id = rid()) {
  const project = workspace.projects.find(p => p.id === projectId);
  if (!project) throw new Error('This project could not be found.');
  if (!project.client) throw new Error('Give this project a client before invoicing its hours.');
  const { sessions, rate } = unbilled(workspace, projectId);
  if (!(rate > 0)) throw new Error('Add an hourly rate to this project (Edit → Track an effort budget) first.');
  const lines = taskLines(sessions), items = lines.map(l => ({ desc: l.desc, qty: l.qty, price: rate }));
  if (!items.length) throw new Error('There is no unbilled time on this project yet (at least 15 minutes).');
  const number = nextInvoiceNumber(workspace);
  workspace.seq = number.seq;
  workspace.invoices.push({ id, no: number.no, client: project.client, project: project.id, issue: now, due: addDays(now, 14), state: 'draft', items, tax: 0, title: project.name + ' · time', notes: 'Logged time for ' + project.name, pays: [] });
  for (const l of lines) for (const s of l.sessions) s.invoiceId = id;
  return id;
}

export function quoteToInvoice(workspace, quoteId, { depositPercent = 100, now = today(), id = rid() } = {}) {
  const quote = workspace.invoices.find(i => i.id === quoteId);
  if (!quote) throw new Error('Quote not found.');
  const number = nextInvoiceNumber(workspace);
  workspace.seq = number.seq;
  const pct = Math.max(1, Math.min(100, Number(depositPercent) || 100));
  let items;
  if (pct === 100) {
    items = quote.items.map(it => ({ ...it }));
  } else {
    const subtotal = (quote.items || []).reduce((sum, it) => sum + (Number(it.qty) || 0) * (Number(it.price) || 0), 0);
    const depositAmount = round2(subtotal * (pct / 100));
    items = [{
      desc: `${quote.title || 'Project'} · ${pct}% Upfront Deposit`,
      qty: 1,
      price: depositAmount
    }];
  }
  const invoice = {
    id,
    no: number.no,
    client: quote.client,
    project: quote.project,
    issue: now,
    due: addDays(now, 14),
    state: 'draft',
    items,
    tax: quote.tax || 0,
    title: pct === 100 ? (quote.title ? `${quote.title} · Invoice` : 'Invoice') : `${quote.title || 'Project'} · ${pct}% Deposit`,
    notes: `Generated from quote ${quote.no}. ` + (quote.notes || ''),
    pays: [],
    ...(quote.currency ? { currency: quote.currency } : {})
  };
  workspace.invoices.push(invoice);
  return id;
}
