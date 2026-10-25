import Icon from './Icon';
import Shape from './Shapes.jsx';
import { ACTION_COLOURS, DEFAULT_ACTION, actionColour } from './appearance';
import { changelog, currentVersion } from './changelog';
import { PARTY_FIELDS } from './invoice-input';

const day = iso => iso ? new Date(iso + 'T12:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : '';

export function AppearanceSettings({ d, mut, theme, setTheme }) {
  const current = actionColour(d.settings.actionColour).id, hidden = d.settings.dashboardHidden || [];
  const pick = id => mut(n => { n.settings.actionColour = id; });
  const move = (e, index) => { const k = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]; if (!k) return; e.preventDefault(); const next = ACTION_COLOURS[(index + k + ACTION_COLOURS.length) % ACTION_COLOURS.length]; pick(next.id); requestAnimationFrame(() => document.getElementById('swatch-' + next.id)?.focus()); };
  return <div style={{ display: 'grid', gap: 16 }}>
    <div className="two-col">
      <div className="card" style={{ display: 'grid', gap: 14 }}>
        <div className="block-head" style={{ margin: 0 }}><h2 id="action-colour">Action colour</h2><button className="chip dashed" style={{ cursor: 'pointer' }} onClick={() => pick(DEFAULT_ACTION)}>Reset to Terracotta</button></div>
        <p style={{ margin: 0, color: 'var(--mu)' }}>Used for highlights: the active menu item, today in the calendar, featured cards and selected tags. Buttons stay black.</p>
        <div className="swatches" role="radiogroup" aria-labelledby="action-colour">{ACTION_COLOURS.map((c, i) => <button key={c.id} id={'swatch-' + c.id} type="button" role="radio" className="swatch" aria-checked={current === c.id} tabIndex={current === c.id ? 0 : -1} onKeyDown={e => move(e, i)} onClick={() => pick(c.id)}><i style={{ background: c.hex }}>{current === c.id && <Icon name="check" size={18} />}</i><span><b>{c.name}</b><small>{c.hex}</small></span></button>)}</div>
        <p className="notice soft" style={{ margin: 0 }}>Every colour keeps text readable in light and dark mode. Your choice is saved to this workspace and shows on every device.</p>
      </div>
      <aside className="card" style={{ background: 'var(--sf)', display: 'grid', gap: 12, alignContent: 'start' }} aria-label="Preview">
        <div className="block-head" style={{ margin: 0 }}><h3>Preview</h3><span className="chip hero">Live</span></div>
        <div style={{ background: 'var(--ink)', color: 'var(--ink-tx)', borderRadius: 18, padding: '12px 16px', display: 'grid', gap: 6 }}><span style={{ borderLeft: '2px solid var(--hero)', paddingLeft: 10, color: 'var(--hero)', fontWeight: 600 }}>Home</span><span>Clients</span></div>
        <div className="tag-row" style={{ marginTop: 0 }}><span className="avatar-xl" style={{ width: 40, height: 40, fontSize: 14 }}>25</span><span className="chip hero">October</span><span className="chip hero">Brand</span></div>
        <div className="tile hero" style={{ minHeight: 0 }}><Shape kind="heart" size={90} style={{ position: 'absolute', right: -16, bottom: -20 }} /><span className="tile-top">Project</span><span className="tile-title">Featured card</span></div>
        <button type="button" className="btn wide-btn">Buttons stay black</button>
      </aside>
    </div>
    <div className="card" style={{ display: 'grid', gap: 10 }}>
      <h3 style={{ margin: 0 }}>Light or dark</h3>
      <div className="tabs-pill" role="group" aria-label="Colour mode">{[['light', 'Light'], ['dark', 'Dark']].map(([k, l]) => <button key={k} type="button" aria-pressed={theme === k} onClick={() => setTheme(k)}>{l}</button>)}</div>
    </div>
    <div className="card" style={{ display: 'grid', gap: 8 }}>
      <h3 style={{ margin: 0 }}>Home</h3><small className="empty-note">Choose what appears on Home.</small>
      {[['metrics', 'Jump back in (your 3 most recent items)'], ['overview', 'Needs attention'], ['work', 'Calendar and today’s timeline']].map(([key, label]) => <label key={key}><input type="checkbox" checked={!hidden.includes(key)} onChange={() => mut(n => { const h = n.settings.dashboardHidden || []; n.settings.dashboardHidden = h.includes(key) ? h.filter(k => k !== key) : [...h, key]; })} /> {label}</label>)}
    </div>
  </div>;
}

const BANK = { accountName: 'Account name', bankName: 'Bank', accountNumber: 'Account number', ifsc: 'IFSC / sort code', swift: 'SWIFT / BIC', iban: 'IBAN', upi: 'UPI ID' };
export function InvoiceDefaults({ d, mut, toast }) {
  const s = d.settings;
  return <form className="card form-grid" onSubmit={e => { e.preventDefault(); const o = Object.fromEntries(new FormData(e.currentTarget)); mut(n => { n.settings.taxId = String(o.taxId || '').trim().slice(0, 60); n.settings.pay = String(o.pay || '').trim().slice(0, 600); n.settings.bank = Object.fromEntries(PARTY_FIELDS.bank.map(k => [k, String(o['bank_' + k] || '').trim().slice(0, 120)])); }); toast('Invoice defaults saved.'); }}>
    <h2 className="full" style={{ margin: 0 }}>Invoices & bank details</h2>
    <p className="full empty-note" style={{ margin: 0 }}>Defaults for every invoice. You can still change any of them on a single draft invoice.</p>
    <label>Tax ID (GSTIN, VAT)<input name="taxId" defaultValue={s.taxId || ''} maxLength={60} /></label>
    <span />
    {PARTY_FIELDS.bank.map(k => <label key={k}>{BANK[k]}<input name={'bank_' + k} defaultValue={s.bank?.[k] || ''} maxLength={120} /></label>)}
    <label className="full">Payment instructions<textarea name="pay" rows="3" defaultValue={s.pay || ''} maxLength={600} /></label>
    <button className="btn" style={{ justifySelf: 'start' }}>Save invoice defaults</button>
  </form>;
}

export function WhatsNew() {
  const released = changelog.filter(r => r.released), upcoming = changelog.filter(r => !r.released);
  return <div>
    <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}><div style={{ flex: 1 }}><h2 style={{ margin: 0 }}>SoloDesk {currentVersion()}</h2><small className="empty-note">Released {day(released[0]?.date)} · You are on the latest version</small></div><span className="chip sage">Up to date</span></div>
    {[...upcoming, ...released].map(r => <section key={r.version} className="release" aria-label={'Version ' + r.version}>
      <div className="release-head"><span className="chip ink">{r.version}</span><h3>{r.title}</h3><span className={'chip ' + (r.released ? (r.version === currentVersion() ? 'sage' : 'white') : 'hero')}>{r.released ? (r.version === currentVersion() ? 'Current' : 'Released') : 'Coming soon'}</span><small className="empty-note">{r.released ? day(r.date) : 'In progress'}</small></div>
      <ul>{r.highlights.map(([t, x]) => <li key={t}><span><b>{t}</b><small>{x}</small></span></li>)}</ul>
      {r.fixes.length > 0 && <><p className="eyebrow" style={{ margin: '14px 0 8px' }}>FIXES</p><ul className="fixes">{r.fixes.map(f => <li key={f}><span>{f}</span></li>)}</ul></>}
    </section>)}
  </div>;
}

export function UpdateNotice({ Modal, onClose }) {
  const r = changelog.find(x => x.released);
  return <Modal title={'SoloDesk updated to ' + r.version} label="Got it" onClose={onClose} onSubmit={onClose}>
    <div className="update-hero"><Shape kind="star" color="var(--hero-deep)" size={110} style={{ position: 'absolute', right: -24, top: -24 }} /><b style={{ fontSize: 18 }}>{r.title}</b><p style={{ margin: '4px 0 0' }}>Here is what changed.</p></div>
    <ul style={{ margin: '16px 0', paddingLeft: 18, display: 'grid', gap: 8 }}>{r.highlights.slice(0, 6).map(([t, x]) => <li key={t}><b>{t}.</b> {x}</li>)}</ul>
    <a className="text-link" href="#/settings/whats-new" onClick={onClose}>See all release notes →</a>
  </Modal>;
}
