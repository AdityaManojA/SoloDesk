import { addDays, today, round2 } from './lib.js';

export const PAYMENT_TERMS = {
  receipt: { days: 0, label: 'Due on receipt' },
  net7: { days: 7, label: 'Net 7' },
  net14: { days: 14, label: 'Net 14' },
  net30: { days: 30, label: 'Net 30' }
};

export function dueDateForTerms(issueDate = today(), termKey = 'net14') {
  const term = PAYMENT_TERMS[termKey] || PAYMENT_TERMS.net14;
  return addDays(issueDate, term.days);
}

export function calcLateFee(invoice, asOfDate = today(), monthlyRate = 0.015) {
  if (!invoice || invoice.state === 'paid' || invoice.state === 'void') return 0;
  if (!invoice.due || invoice.due >= asOfDate) return 0;
  const daysOverdue = Math.max(0, Math.floor((Date.parse(asOfDate) - Date.parse(invoice.due)) / 86400000));
  if (daysOverdue <= 0) return 0;
  const monthsOverdue = daysOverdue / 30;
  // Calculate remaining balance
  const sub = (invoice.items || []).reduce((sum, l) => sum + (Number(l.qty) || 0) * (Number(l.price) || 0), 0);
  const tax = (sub * (Number(invoice.tax) || 0)) / 100;
  const total = sub + tax;
  const paid = (invoice.pays || []).reduce((sum, p) => sum + (Number(p.amt) || 0), 0);
  const bal = Math.max(0, total - paid);
  if (bal <= 0) return 0;
  return round2(bal * monthlyRate * monthsOverdue);
}
