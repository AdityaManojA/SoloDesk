// Pure business logic: money, invoice maths, statuses, reports, CSV and PDF.
export const rid = () => Math.random().toString(36).slice(2, 10);
export const num = (v) => parseFloat(v) || 0;
export const today = () => new Date().toISOString().slice(0, 10);
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
export const fresh = () => ({ clients: [], projects: [], tasks: [], invoices: [], seq: 0, settings: { biz: '', email: '', phone: '', addr: '', pay: '', cur: 'USD' } });
let CUR = 'USD';
export const setCur = (c) => { CUR = c || 'USD'; };
export const money = (n) => new Intl.NumberFormat(undefined, { style: 'currency', currency: CUR }).format(n || 0);
export const calc = (i) => {
  const sub = i.items.reduce((s, l) => s + num(l.qty) * num(l.price), 0), tax = (sub * num(i.tax)) / 100, total = sub + tax;
  const paid = i.pays.reduce((s, p) => s + num(p.amt), 0);
  return { sub, tax, total, paid, bal: Math.max(0, total - paid) };
};
export const status = (i) => {
  if (i.state === 'void') return 'Void'; if (i.state === 'draft') return 'Draft';
  const c = calc(i); if (c.bal < 0.005) return 'Paid'; if (i.due < today()) return 'Overdue';
  return c.paid > 0 ? 'Partially paid' : 'Sent';
};
export const ICON = { Paid: '✓ ', Overdue: '! ', Void: '✕ ', Draft: '✎ ', Sent: '➤ ', 'Partially paid': '◐ ' };
export const outstanding = (d) => d.invoices.filter((i) => i.state === 'sent').reduce((s, i) => s + calc(i).bal, 0);
export const allPays = (d) => d.invoices.flatMap((i) => i.pays.map((p) => ({ ...p, inv: i })));
export const months = (a, b) => { const r = []; let [y, m] = a.slice(0, 7).split('-').map(Number); for (let k = 0; k < 120; k++) { const key = `${y}-${String(m).padStart(2, '0')}`; r.push(key); if (key >= b.slice(0, 7)) break; if (++m > 12) { m = 1; y++; } } return r; };
export const revBy = (ks, pays) => ks.map((k) => ({ k, l: new Date(k + '-15').toLocaleString(undefined, { month: 'short' }), v: pays.filter((p) => p.date.slice(0, 7) === k).reduce((s, p) => s + num(p.amt), 0) }));
export const cname = (d, id) => d.clients.find((c) => c.id === id)?.name || '—';
export const csv = (rows) => rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
export const download = (name, data, type) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type })); a.download = name; a.click(); URL.revokeObjectURL(a.href); };
export const exporters = (d) => ({
  clients: [['Name', 'Email', 'Phone', 'Address', 'Notes', 'Archived'], ...d.clients.map((c) => [c.name, c.email, c.phone, c.address, c.notes, c.arch ? 'yes' : 'no'])],
  tasks: [['Title', 'Status', 'Priority', 'Due', 'Client'], ...d.tasks.map((k) => [k.title, k.status, k.priority, k.due, cname(d, k.client)])],
  invoices: [['Number', 'Client', 'Status', 'Issued', 'Due', 'Total', 'Paid', 'Balance'], ...d.invoices.map((i) => { const c = calc(i); return [i.no, cname(d, i.client), status(i), i.issue, i.due, c.total.toFixed(2), c.paid.toFixed(2), c.bal.toFixed(2)]; })],
  payments: [['Invoice', 'Client', 'Date', 'Amount', 'Note'], ...allPays(d).map((p) => [p.inv.no, cname(d, p.inv.client), p.date, p.amt, p.note])],
});
// Minimal text-only PDF (no library).
export function invoicePdf(d, i) {
  const s = d.settings, c = calc(i), cl = d.clients.find((x) => x.id === i.client) || {}, m = (n) => `${n.toFixed(2)} ${s.cur}`;
  const lines = [s.biz || 'Your business', s.email, s.phone, s.addr, '', `INVOICE ${i.no}   [${status(i)}]`, `Issued: ${i.issue}    Due: ${i.due}`, '', `Bill to: ${cl.name}`, cl.email || '', cl.address || '', '',
    'Description  -  Qty x Unit price  =  Amount', ...i.items.map((l) => `${l.desc}  -  ${l.qty} x ${num(l.price).toFixed(2)}  =  ${m(num(l.qty) * num(l.price))}`), '',
    `Subtotal: ${m(c.sub)}`, `Tax (${num(i.tax)}%): ${m(c.tax)}`, `Total: ${m(c.total)}`, `Paid: ${m(c.paid)}`, `Balance due: ${m(c.bal)}`, '', i.notes ? `Notes: ${i.notes}` : '', s.pay ? `Payment instructions: ${s.pay}` : ''].flatMap((x) => String(x).split('\n'));
  const pe = (t) => String(t).replace(/[^\x20-\x7e]/g, '?').replace(/[\\()]/g, '\\$&'), pg = [];
  for (let k = 0; k < lines.length; k += 48) pg.push(lines.slice(k, k + 48));
  const o = ['<</Type/Catalog/Pages 2 0 R>>', null, '<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>'], kids = [];
  pg.forEach((p) => { const t = 'BT /F1 11 Tf 14 TL 50 790 Td ' + p.map((l) => `(${pe(l)}) Tj T*`).join(' ') + ' ET'; o.push(`<</Length ${t.length}>>\nstream\n${t}\nendstream`); o.push(`<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Resources<</Font<</F1 3 0 R>>>>/Contents ${o.length} 0 R>>`); kids.push(o.length); });
  o[1] = `<</Type/Pages/Count ${kids.length}/Kids[${kids.map((k) => k + ' 0 R').join(' ')}]>>`;
  let out = '%PDF-1.4\n'; const off = []; o.forEach((b, k) => { off.push(out.length); out += `${k + 1} 0 obj\n${b}\nendobj\n`; });
  const x = out.length;
  out += `xref\n0 ${o.length + 1}\n0000000000 65535 f \n` + off.map((n) => String(n).padStart(10, '0') + ' 00000 n \n').join('') + `trailer\n<</Size ${o.length + 1}/Root 1 0 R>>\nstartxref\n${x}\n%%EOF`;
  download(`${i.no}.pdf`, out, 'application/pdf');
}
