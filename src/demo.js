import { fresh, today, addDays } from './lib';

// Illustrative records, available only in the explicitly labelled local demo.
export function demoData() {
  const d = fresh(), t = today();
  d.settings = { ...d.settings, biz: 'Sunday Studio', email: 'hello@example.com', cur: 'USD' };
  d.clients = [
    { id: 'north', name: 'Northstar Studio', email: 'studio@example.com', arch: false, notes: 'Brand and digital design' },
    { id: 'form', name: 'Form & Field', email: 'team@example.com', arch: false },
    { id: 'still', name: 'Still House', email: 'hello@example.com', arch: false },
  ];
  d.projects = [{ id: 'identity', name: 'A new direction for Northstar', client: 'north', status: 'Active', start: addDays(t, -7), end: addDays(t, 14) }, { id: 'web', name: 'Form & Field — digital flagship', client: 'form', status: 'Active', start: t, end: addDays(t, 21) }, { id: 'journal', name: 'Still House journal', client: 'still', status: 'On hold' }];
  d.tasks = [
    { id: 'concept', title: 'Present the identity concepts', client: 'north', project: 'identity', scheduledAt: new Date(t + 'T10:00:00').toISOString(), durationMinutes: 60, due: t, status: 'In progress', priority: 'High' },
    { id: 'wire', title: 'Refine the homepage wireframes', client: 'form', project: 'web', due: addDays(t, 2), status: 'Todo', priority: 'Medium' },
    { id: 'review', title: 'Collect feedback on the journal', client: 'still', project: 'journal', due: addDays(t, 4), status: 'Todo', priority: 'Low' },
    { id: 'brief', title: 'Send the project brief', client: 'north', project: 'identity', due: addDays(t, -2), status: 'Done', priority: '' },
  ];
  d.invoices = Array.from({ length: 6 }, (_, k) => ({ id: 'inv' + k, no: 'INV-' + String(k + 1).padStart(4, '0'), client: ['north', 'form', 'still'][k % 3], issue: addDays(t, -150 + k * 30), due: k === 5 ? addDays(t, -3) : addDays(t, -130 + k * 30), state: 'sent', tax: 0, notes: '', items: [{ desc: ['Brand strategy & identity', 'Website design', 'Editorial design'][k % 3], qty: 1, price: [2400, 3200, 1800, 4200, 2800, 3600][k] }], pays: k < 5 ? [{ id: 'p' + k, amt: [2400, 3200, 1800, 4200, 2800][k], date: addDays(t, -145 + k * 35), note: 'Sample payment' }] : [] }));
  d.seq = 6;
  return d;
}
