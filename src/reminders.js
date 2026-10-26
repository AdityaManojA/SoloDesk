// Payment reminders for unpaid invoices: a ready-to-send email (Gmail by default, any mail app as a
// fallback) and a short history on the invoice (i.reminders: ISO times, newest last).
import { calc, status, money, today } from './lib.js';

export const canRemind = invoice => ['Sent', 'Partially paid', 'Overdue'].includes(status(invoice));

export const daysLate = (invoice, now = today()) => Math.max(0, Math.round((Date.parse(now) - Date.parse(invoice.due)) / 864e5));

export function reminderDraft(workspace, invoice, now = today()) {
  const client = workspace.clients.find(c => c.id === invoice.client) || {};
  const s = workspace.settings || {}, balance = money(calc(invoice).bal), late = daysLate(invoice, now);
  const from = invoice.from?.name || s.biz || '', pay = invoice.pay || s.pay || '';
  const due = new Date(invoice.due + 'T12:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
  const subject = late ? `Payment reminder: invoice ${invoice.no} is ${late} day${late === 1 ? '' : 's'} overdue` : `Friendly reminder: invoice ${invoice.no} is due ${due}`;
  const body = [
    `Hi ${client.contact || client.name || 'there'},`,
    '',
    late
      ? `A quick reminder that invoice ${invoice.no}${invoice.title ? ` (${invoice.title})` : ''} for ${balance} was due on ${due} and is now ${late} day${late === 1 ? '' : 's'} overdue.`
      : `A friendly reminder that invoice ${invoice.no}${invoice.title ? ` (${invoice.title})` : ''} for ${balance} is due on ${due}.`,
    pay ? `\nHow to pay:\n${pay}` : '',
    '',
    'If you have already paid, thank you, and please ignore this message.',
    '',
    'Thanks,',
    from,
  ].filter((line, i, all) => !(line === '' && all[i - 1] === '')).join('\n');
  return { to: invoice.billTo?.email || client.email || '', subject, body };
}

export const gmailUrl = ({ to, subject, body }) => `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
export const mailtoUrl = ({ to, subject, body }) => `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

export function recordReminder(workspace, invoiceId, at = new Date().toISOString()) {
  const invoice = workspace.invoices.find(i => i.id === invoiceId);
  if (!invoice) return false;
  invoice.reminders = [...(invoice.reminders || []), at].slice(-20);
  return true;
}

export function lastReminded(invoice, now = Date.now()) {
  const last = (invoice.reminders || []).at(-1);
  if (!last) return '';
  const days = Math.floor((now - Date.parse(last)) / 864e5);
  return days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
}
