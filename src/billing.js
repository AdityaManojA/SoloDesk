// Logged time → invoices. Focus sessions for a project that are not on an invoice yet are "unbilled".
// Invoicing them adds a draft invoice with one line per task (hours rounded to the quarter hour) at the
// project's hourly rate, and marks those sessions with the invoice. Deleting that draft frees them again.
import { nextInvoiceNumber } from './invoice-input.js';
import { rid, today, addDays } from './lib.js';

const quarter = hours => Math.round(hours * 4) / 4;

export function unbilled(workspace, projectId) {
  const invoices = new Set(workspace.invoices.map(i => i.id));
  const sessions = (workspace.focusSessions || []).filter(s => s.project === projectId && !(s.invoiceId && invoices.has(s.invoiceId)));
  const hours = sessions.reduce((n, s) => n + Number(s.seconds || 0), 0) / 3600;
  const rate = Number(workspace.projects.find(p => p.id === projectId)?.hourlyRate) || 0;
  return { sessions, hours, billable: quarter(hours), value: quarter(hours) * rate, rate };
}

export function invoiceUnbilledHours(workspace, projectId, now = today()) {
  const project = workspace.projects.find(p => p.id === projectId);
  if (!project) throw new Error('This project could not be found.');
  if (!project.client) throw new Error('Give this project a client before invoicing its hours.');
  const { sessions, rate } = unbilled(workspace, projectId);
  if (!(rate > 0)) throw new Error('Add an hourly rate to this project (Edit → Track an effort budget) first.');
  const byTask = new Map();
  for (const s of sessions) { const key = s.title || 'Project work'; byTask.set(key, (byTask.get(key) || 0) + Number(s.seconds || 0) / 3600); }
  const items = [...byTask].map(([desc, h]) => ({ desc, qty: quarter(h), price: rate })).filter(i => i.qty > 0);
  if (!items.length) throw new Error('There is no unbilled time on this project yet (at least 15 minutes).');
  const number = nextInvoiceNumber(workspace), id = rid();
  workspace.seq = number.seq;
  workspace.invoices.push({ id, no: number.no, client: project.client, project: project.id, issue: now, due: addDays(now, 14), state: 'draft', items, tax: 0, title: project.name + ' · time', notes: 'Logged time for ' + project.name, pays: [] });
  for (const s of sessions) s.invoiceId = id;
  return id;
}
