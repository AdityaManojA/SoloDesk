// Pure business logic: money, invoice maths, statuses, reports, CSV and PDF.
export const rid = () => {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, b => b.toString(36).padStart(2, '0')).join('').slice(0, 10);
  }
  return Math.random().toString(36).slice(2, 10);
};
export const num = (v) => parseFloat(v) || 0;
export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
export const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export const addDays = (d, n) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
export const reissuedInvoice = (invoice, id, no, issue = today()) => { const copy = { ...structuredClone(invoice), id, no, state: 'draft', issue, due: invoice.due >= issue ? invoice.due : addDays(issue, 14) }; delete copy.approval; delete copy.scheduleId; delete copy.scheduleDate; return copy; };
export const fresh = () => ({ clients: [], projects: [], tasks: [], invoices: [], seq: 0, settings: { biz: '', email: '', phone: '', addr: '', pay: '', cur: 'USD' } });
let CUR = 'USD';
export const setCur = (c) => { CUR = c || 'USD'; };
export const money = (n, cur = CUR) => new Intl.NumberFormat(undefined, { style: 'currency', currency: cur || CUR }).format(n || 0);
export const calc = (i) => {
  const sub = round2((i.items || []).reduce((s, l) => s + num(l.qty) * num(l.price), 0));
  const tax = round2((sub * num(i.tax)) / 100);
  const total = round2(sub + tax);
  const paid = round2((i.pays || []).reduce((s, p) => s + num(p.amt), 0));
  const bal = Math.max(0, round2(total - paid));
  return { sub, tax, total, paid, bal };
};
export const status = (i) => {
  if (i.state === 'void') return 'Void'; if (i.state === 'draft') return 'Draft';
  const c = calc(i); if (c.bal < 0.005) return 'Paid'; if (i.due < today()) return 'Overdue';
  return c.paid > 0 ? 'Partially paid' : 'Sent';
};
export const ICON = { Paid: '\u2713 ', Overdue: '! ', Void: '\u2715 ', Draft: '\u270E ', Sent: '\u27A4 ', 'Partially paid': '\u25D0 ' };
export const outstanding = (d) => d.invoices.filter((i) => i.state === 'sent').reduce((s, i) => s + calc(i).bal, 0);
export const allPays = (d) => d.invoices.filter((i) => i.state !== 'void').flatMap((i) => i.pays.map((p) => ({ ...p, inv: i })));
export const months = (a, b) => { const r = []; let [y, m] = a.slice(0, 7).split('-').map(Number); for (let k = 0; k < 120; k++) { const key = `${y}-${String(m).padStart(2, '0')}`; r.push(key); if (key >= b.slice(0, 7)) break; if (++m > 12) { m = 1; y++; } } return r; };
export const revBy = (ks, pays) => ks.map((k) => ({ k, l: new Date(k + '-15').toLocaleString(undefined, { month: 'short' }), v: pays.filter((p) => p.date.slice(0, 7) === k).reduce((s, p) => s + num(p.amt), 0) }));
export const cname = (d, id) => d.clients.find((c) => c.id === id)?.name || '\u2014';
export const csv = (rows) => '\uFEFF' + rows.map((r) => r.map((v) => { let value = String(v ?? ''); if (/^[\s]*[=+\-@]/.test(value)) value = "'" + value; return `"${value.replace(/"/g, '""')}"`; }).join(',')).join('\r\n');
export const download = (name, data, type) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type })); a.download = name; a.click(); URL.revokeObjectURL(a.href); };
export const exporters = (d) => ({
  clients: [['Name', 'Email', 'Phone', 'Address', 'Notes', 'Archived'], ...d.clients.map((c) => [c.name, c.email, c.phone, c.address, c.notes, c.arch ? 'yes' : 'no'])],
  projects: [['Name', 'Client', 'Status', 'Start date', 'End date'], ...d.projects.map(p => [p.name, cname(d, p.client), p.status, p.start, p.end])],
  tasks: [['Title', 'Status', 'Priority', 'Due', 'Client', 'Project', 'Scheduled start (UTC)', 'Duration (minutes)'], ...d.tasks.map((k) => [k.title, k.status, k.priority, k.due, cname(d, k.client), d.projects.find(p => p.id === k.project)?.name || '', k.scheduledAt, k.durationMinutes])],
  invoices: [['Number', 'Client', 'Status', 'Issued', 'Due', 'Total', 'Paid', 'Balance'], ...d.invoices.map((i) => { const c = calc(i); return [i.no, cname(d, i.client), status(i), i.issue, i.due, c.total.toFixed(2), c.paid.toFixed(2), c.bal.toFixed(2)]; })],
  payments: [['Invoice', 'Client', 'Date', 'Amount', 'Note'], ...allPays(d).map((p) => [p.inv.no, cname(d, p.inv.client), p.date, p.amt, p.note])],
});

const WIN_ANSI_SYMBOLS = {
  '\u20AC': '\\200', '\u00A3': '\\243', '\u00A5': '\\245', '\u00A7': '\\247',
  '\u00A9': '\\251', '\u00AE': '\\256', '\u00B0': '\\260', '\u00B1': '\\261',
  '\u00B5': '\\265', '\u00B7': '\\267', '\u2018': "'", '\u2019': "'",
  '\u201C': '"', '\u201D': '"',
  '\u2026': '...', '\u2013': '-', '\u2014': '--', '\u2022': '\\225', '\u20B9': 'Rs. ',
};

export function pdfEscape(str) {
  let s = String(str ?? '');
  for (const [char, rep] of Object.entries(WIN_ANSI_SYMBOLS)) {
    s = s.replaceAll(char, rep);
  }
  let out = '';
  for (let k = 0; k < s.length; k++) {
    const code = s.charCodeAt(k), char = s[k];
    if (char === '\\' || char === '(' || char === ')') {
      out += '\\' + char;
    } else if (code >= 32 && code <= 126) {
      out += char;
    } else if (code >= 160 && code <= 255) {
      out += '\\' + code.toString(8).padStart(3, '0');
    } else {
      const decomp = char.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (decomp && decomp !== char && decomp.charCodeAt(0) <= 255) {
        const dc = decomp.charCodeAt(0);
        out += dc >= 32 && dc <= 126 ? decomp[0] : '\\' + dc.toString(8).padStart(3, '0');
      } else {
        out += '?';
      }
    }
  }
  return out;
}

// Minimal text-only PDF (no library), with WinAnsiEncoding and unicode fallback.
export function generateInvoicePdf(d, i) {
  const s = d.settings, c = calc(i), cl = d.clients.find((x) => x.id === i.client) || {};
  const cur = i.currency || (d.projects || []).find(p => p.id === i.project)?.currency || (d.clients || []).find(x => x.id === i.client)?.currency || s?.cur || 'USD';
  const m = (n) => `${n.toFixed(2)} ${cur}`;
  const payLink = i.paymentLink || s.paymentLink || s.stripeLink || s.paypalLink || '';
  const lines = [s.biz || 'Your business', s.email, s.phone, s.addr, '', `INVOICE ${i.no}   [${status(i)}]`, `Issued: ${i.issue}    Due: ${i.due}`, '', `Bill to: ${cl.name}`, cl.email || '', cl.address || '', '',
    'Description  -  Qty x Unit price  =  Amount', ...i.items.map((l) => `${l.desc}  -  ${l.qty} x ${num(l.price).toFixed(2)}  =  ${m(num(l.qty) * num(l.price))}`), '',
    `Subtotal: ${m(c.sub)}`, `Tax (${num(i.tax)}%): ${m(c.tax)}`, `Total: ${m(c.total)}`, `Paid: ${m(c.paid)}`, `Balance due: ${m(c.bal)}`, '', ...(payLink ? [`Pay online: ${payLink}`, ''] : []), i.notes ? `Notes: ${i.notes}` : '', s.pay ? `Payment instructions: ${s.pay}` : ''].flatMap((x) => String(x).split('\n'));
  const pg = [];
  for (let k = 0; k < lines.length; k += 48) pg.push(lines.slice(k, k + 48));
  const o = ['<</Type/Catalog/Pages 2 0 R>>', null, '<</Type/Font/Subtype/Type1/BaseFont/Helvetica/Encoding/WinAnsiEncoding>>'], kids = [];
  pg.forEach((p) => { const t = 'BT /F1 11 Tf 14 TL 50 790 Td ' + p.map((l) => `(${pdfEscape(l)}) Tj T*`).join(' ') + ' ET'; o.push(`<</Length ${t.length}>>\nstream\n${t}\nendstream`); o.push(`<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Resources<</Font<</F1 3 0 R>>>>/Contents ${o.length} 0 R>>`); kids.push(o.length); });
  o[1] = `<</Type/Pages/Count ${kids.length}/Kids[${kids.map((k) => k + ' 0 R').join(' ')}]>>`;
  let out = '%PDF-1.4\n'; const off = []; o.forEach((b, k) => { off.push(out.length); out += `${k + 1} 0 obj\n${b}\nendobj\n`; });
  const x = out.length;
  out += `xref\n0 ${o.length + 1}\n0000000000 65535 f \n` + off.map((n) => String(n).padStart(10, '0') + ' 00000 n \n').join('') + `trailer\n<</Size ${o.length + 1}/Root 1 0 R>>\nstartxref\n${x}\n%%EOF`;
  return out;
}

export function invoicePdf(d, i) {
  const out = generateInvoicePdf(d, i);
  download(`${i.no}.pdf`, out, 'application/pdf');
}
