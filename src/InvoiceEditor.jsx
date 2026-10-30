import { useState } from 'react';
import * as L from './lib';
import { Select } from './Controls';
import { invoiceView, PARTY_FIELDS, prepareInvoice } from './invoice-input';
const { money, num, calc } = L;

const BANK_LABELS = { accountName: 'Account name', bankName: 'Bank', accountNumber: 'Account no.', ifsc: 'IFSC / sort code', swift: 'SWIFT / BIC', iban: 'IBAN', upi: 'UPI' };
const draftOf = i => ({
  client: i.client, issue: i.issue, due: i.due, tax: i.tax ?? 0, notes: i.notes || '', no: i.no, title: i.title || '', reference: i.reference || '', taxLabel: i.taxLabel || '', pay: i.pay || '',
  from: { ...Object.fromEntries(PARTY_FIELDS.from.map(k => [k, ''])), ...(i.from || {}) },
  billTo: { ...Object.fromEntries(PARTY_FIELDS.billTo.map(k => [k, ''])), ...(i.billTo || {}) },
  bank: { ...Object.fromEntries(PARTY_FIELDS.bank.map(k => [k, ''])), ...(i.bank || {}) },
  items: i.items.map(x => ({ ...x })),
});

// Declared at module level so inputs keep focus while typing.
function F({ ctx, path, multiline, ...props }) {
  const [group, key] = path.split('.'), current = key ? ctx.value[group][key] : ctx.value[group], hint = key ? ctx.fallback[group]?.[key] : '';
  const onChange = e => ctx.set(path, e.target.value);
  return multiline ? <textarea data-edit rows="2" aria-label={props['aria-label']} value={current} placeholder={hint || props.placeholder} onChange={onChange} /> : <input data-edit value={current} placeholder={hint || props.placeholder} onChange={onChange} {...props} />;
}

// The printable invoice. With `edit`, every text on the page becomes a field; empty fields show the default
// that will be used (business settings or the client record) as their placeholder.
export function InvoiceSheet({ i, d, edit }) {
  const st = d.settings, value = edit ? edit.draft : i, cl = d.clients.find(c => c.id === value.client) || {};
  const fallback = invoiceView({}, st, cl), view = invoiceView(value, st, cl);
  const c = calc({ ...value, items: value.items.map(x => ({ ...x, qty: num(x.qty), price: num(x.price) })), pays: i.pays }), s = L.status(i);
  const ctx = { value, fallback, set: edit?.set };
  const text = (v, style) => v ? <span style={style}>{v}</span> : null;
  const bank = Object.entries(view.bank).filter(([, v]) => v);
  return <article className="sheet" aria-label={'Invoice ' + value.no}>
    <div className="sh-top">
      <div className="party">
        <small>FROM</small>
        {st.logo && <img className="logo" src={st.logo} alt="" />}
        {edit ? <><F ctx={ctx} path="from.name" aria-label="Your business name" style={{ fontWeight: 700, fontSize: 16 }} /><F ctx={ctx} path="from.email" aria-label="Your email" /><F ctx={ctx} path="from.phone" aria-label="Your phone" /><F ctx={ctx} path="from.address" multiline aria-label="Your address" /><F ctx={ctx} path="from.taxId" aria-label="Your tax ID (GSTIN, VAT)" placeholder="Tax ID (GSTIN, VAT)" /></>
          : <><b className="biz">{view.from.name || 'Your business'}</b><div className="sm-t" style={{ whiteSpace: 'pre-line' }}>{[view.from.email, view.from.phone, view.from.address, view.from.taxId && 'Tax ID ' + view.from.taxId].filter(Boolean).join('\n')}</div></>}
      </div>
      <div className="sh-r">
        <div className="ttl">INVOICE</div>
        {edit ? <div className="bank-grid" style={{ gridTemplateColumns: '100px 180px' }}>
          <small>Invoice no.</small><F ctx={ctx} path="no" aria-label="Invoice number" maxLength={40} />
          <small>Title</small><F ctx={ctx} path="title" aria-label="Invoice title" placeholder="e.g. Brand refresh — phase 1" />
          <small>Issued</small><F ctx={ctx} path="issue" type="date" aria-label="Issue date" />
          <small>Due</small><F ctx={ctx} path="due" type="date" aria-label="Due date" />
          <small>Reference / PO</small><F ctx={ctx} path="reference" aria-label="Reference or PO number" />
        </div> : <><div>{value.no}</div>{text(value.title, { fontWeight: 600 })}<div>Issued {value.issue}</div><div>Due {value.due}</div>{value.reference && <div>Ref. {value.reference}</div>}<div className={'stamp' + (s === 'Draft' || s === 'Sent' ? ' noprint' : '')}>{L.ICON[s]}{s}</div></>}
      </div>
    </div>
    <div className="sh-bill party"><small>BILL TO</small>
      {edit ? <><F ctx={ctx} path="billTo.name" aria-label="Bill to name" style={{ fontWeight: 700 }} /><F ctx={ctx} path="billTo.email" aria-label="Billing email" /><F ctx={ctx} path="billTo.address" multiline aria-label="Billing address" /></>
        : <><b>{view.billTo.name || '—'}</b><span style={{ whiteSpace: 'pre-line' }}>{[view.billTo.email, view.billTo.address].filter(Boolean).join('\n')}</span></>}
    </div>
    {edit ? <div style={{ margin: '16px 0' }}>
      <div className="ln-edit" style={{ fontSize: 11, fontWeight: 600, color: '#6E675C' }}><span>DESCRIPTION</span><span>QTY</span><span>PRICE</span><span style={{ textAlign: 'right' }}>AMOUNT</span><span /></div>
      {value.items.map((l, k) => <div className="ln-edit" key={k}>
        <input data-edit aria-label={'Line ' + (k + 1) + ' description'} value={l.desc} onChange={e => edit.line(k, 'desc', e.target.value)} />
        <input data-edit type="number" step="any" min="0.001" aria-label={'Line ' + (k + 1) + ' quantity'} value={l.qty} onChange={e => edit.line(k, 'qty', e.target.value)} />
        <input data-edit type="number" step="any" min="0" aria-label={'Line ' + (k + 1) + ' price'} value={l.price} onChange={e => edit.line(k, 'price', e.target.value)} />
        <span style={{ textAlign: 'right' }}>{money(num(l.qty) * num(l.price))}</span>
        <button type="button" className="icon-x" aria-label={'Remove line ' + (k + 1)} disabled={value.items.length < 2} onClick={() => edit.removeLine(k)}>×</button></div>)}
      <button type="button" className="ghost sm" onClick={edit.addLine}>+ Add line</button>
    </div> : <div className="tw" tabIndex={0} role="region" aria-label="Invoice line items, scroll horizontally on small screens"><table><tbody>
      <tr><th>Description</th><th className="r">Qty</th><th className="r">Price</th><th className="r">Amount</th></tr>
      {value.items.map((l, k) => <tr key={k}><td>{l.desc}</td><td className="r">{l.qty}</td><td className="r">{money(num(l.price))}</td><td className="r">{money(num(l.qty) * num(l.price))}</td></tr>)}
    </tbody></table></div>}
    <table style={{ marginLeft: 'auto', width: 'min(340px,100%)' }}><tbody>
      <tr><td className="r">Subtotal</td><td className="r">{money(c.sub)}</td></tr>
      <tr><td className="r">{edit ? <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><F ctx={ctx} path="taxLabel" aria-label="Tax label" placeholder="Tax" style={{ width: 70 }} /><input data-edit type="number" step="any" min="0" aria-label="Tax rate %" value={value.tax} onChange={e => edit.set('tax', e.target.value)} style={{ width: 70 }} />%</span> : `${view.taxLabel} (${num(value.tax)}%)`}</td><td className="r">{money(c.tax)}</td></tr>
      <tr className="tot"><td className="r">Total</td><td className="r">{money(c.total)}</td></tr>
      <tr><td className="r">Paid</td><td className="r">{money(c.paid)}</td></tr>
      <tr className="tot"><td className="r">Balance due</td><td className="r">{money(c.bal)}</td></tr>
    </tbody></table>
    <div className="sheet-extras" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 24, marginTop: 20, paddingTop: 16, borderTop: '1px solid #DED4C3' }}>
      {(edit || bank.length > 0) && <div><small>BANK DETAILS</small><div className="bank-grid" style={{ marginTop: 6 }}>{(edit ? PARTY_FIELDS.bank : bank.map(([k]) => k)).map(k => [<small key={k + 'l'}>{BANK_LABELS[k]}</small>, edit ? <F ctx={ctx} key={k} path={'bank.' + k} aria-label={BANK_LABELS[k]} /> : <span key={k}>{view.bank[k]}</span>])}</div></div>}
      <div>
        {(edit || value.notes) && <><small>NOTES & TERMS</small>{edit ? <textarea data-edit rows="3" aria-label="Notes and terms" value={value.notes} onChange={e => edit.set('notes', e.target.value)} /> : <p style={{ whiteSpace: 'pre-line', marginTop: 4 }}>{value.notes}</p>}</>}
        {(edit || view.pay) && <><small style={{ display: 'block', marginTop: 12 }}>PAYMENT INSTRUCTIONS</small>{edit ? <F ctx={ctx} path="pay" multiline aria-label="Payment instructions" /> : <p style={{ whiteSpace: 'pre-line', marginTop: 4 }}>{view.pay}</p>}</>}
      </div>
    </div>
  </article>;
}

// Inline editing state for a draft invoice.
export function useInvoiceEdit(i, d, mut, toast) {
  const [draft, setDraft] = useState(null), [saveBank, setSaveBank] = useState(false), [error, setError] = useState('');
  const start = () => { setDraft(draftOf(i)); setError(''); setSaveBank(false); };
  const set = (path, v) => setDraft(x => { const [g, k] = path.split('.'); return k ? { ...x, [g]: { ...x[g], [k]: v } } : { ...x, [g]: v }; });
  const line = (k, f, v) => setDraft(x => ({ ...x, items: x.items.map((l, j) => j === k ? { ...l, [f]: v } : l) }));
  const save = () => {
    const result = prepareInvoice(d, draft, draft.items, i.id);
    if (result.error) { setError(result.error); return; }
    mut(n => { Object.assign(n.invoices.find(x => x.id === i.id), result.invoice); if (saveBank) { n.settings.bank = { ...result.invoice.bank }; if (result.invoice.from.taxId) n.settings.taxId = result.invoice.from.taxId; } });
    setDraft(null); toast(saveBank ? 'Invoice saved. Bank details are now your default.' : 'Invoice saved.');
  };
  return {
    draft, editing: !!draft, start, cancel: () => setDraft(null), save, error, saveBank, setSaveBank,
    api: draft && { draft, set, line, addLine: () => setDraft(x => ({ ...x, items: [...x.items, { desc: '', qty: 1, price: '' }] })), removeLine: k => setDraft(x => ({ ...x, items: x.items.filter((_, j) => j !== k) })) },
    panel: draft && <aside className="card" style={{ display: 'grid', gap: 12, alignSelf: 'start' }} aria-label="Invoice settings">
      <h3 style={{ margin: 0 }}>Invoice settings</h3>
      <label>Client<Select aria-label="Client" value={draft.client} onChange={e => set('client', e.target.value)}>{d.clients.filter(c => !c.arch || c.id === i.client).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></label>
      <p className="empty-note" style={{ margin: 0 }}>Currency: {d.settings.cur || 'USD'} (change it in Settings → General).</p>
      <label><input type="checkbox" checked={saveBank} onChange={e => setSaveBank(e.target.checked)} /> Save these bank details as my default</label>
      <p className="notice soft" style={{ margin: 0 }}>Empty fields use your defaults from Settings and the client record. Sent invoices are locked: void and reissue to change one.</p>
      {error && <p className="inline-error" role="alert">{error}</p>}
    </aside>,
  };
}
