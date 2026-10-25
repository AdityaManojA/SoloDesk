import { useEffect, useState } from 'react';
import { doc, getDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import Icon from './Icon';
import Shape from './Shapes.jsx';
import { db, configured } from './firebase';
import { PROFILE_COLLECTION, emptyProfile, prepareProfile, publicProfileDoc, safeUrl } from './profile';

const initials = name => (name || '?').split(/\s+/).map(x => x[0]).join('').slice(0, 2).toUpperCase();

function ProfileCard({ p, clients }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
    <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
      <span className="avatar-xl" style={{ width: 80, height: 80, fontSize: 28 }}>{initials(p.name)}</span>
      <div style={{ flex: 1, minWidth: 200 }}><h1 style={{ margin: 0, fontSize: 34 }}>{p.name}</h1>{p.headline && <p style={{ margin: '4px 0 0', color: 'var(--mu)' }}>{p.headline}</p>}
        <div className="tag-row">{p.available && <span className="chip sage">Available for projects</span>}{p.location && <span>{p.location}</span>}</div></div>
    </div>
    {p.bio && <div className="card"><h3 style={{ marginTop: 0 }}>About</h3><p style={{ margin: 0, whiteSpace: 'pre-line' }}>{p.bio}</p></div>}
    {clients.length > 0 && <div className="card"><h3 style={{ marginTop: 0 }}>Clients I have worked with</h3><div className="tag-row">{clients.map(c => <span key={c} className="chip white" style={{ padding: '8px 14px', fontSize: 14 }}>{c}</span>)}</div></div>}
    {p.links?.length > 0 && <div className="card"><h3 style={{ marginTop: 0 }}>Links</h3>{p.links.map(l => safeUrl(l.url) && <a key={l.url} className="list-row" href={safeUrl(l.url)} target="_blank" rel="noopener noreferrer nofollow"><span className="dot-icon hero"><Icon name="link" size={16} /></span><span className="grow"><b>{l.label}</b><small>{new URL(l.url).hostname}</small></span>↗</a>)}</div>}
  </div>;
}

export function ProfileEditor({ d, mut, toast, user, demo }) {
  const saved = d.profile || { ...emptyProfile(), name: user?.displayName || d.settings.biz || '' };
  const [p, setP] = useState(() => ({ ...emptyProfile(), ...saved, links: saved.links?.length ? saved.links : [{ label: '', url: '' }] }));
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const set = (k, v) => setP(x => ({ ...x, [k]: v }));
  const url = `${location.origin}/${p.username || 'your-name'}`;
  const save = async e => {
    e.preventDefault(); setError('');
    const result = prepareProfile(p, d);
    if (result.error) return setError(result.error);
    const next = result.profile, previous = d.profile?.username;
    if (!demo && configured && db && user) {
      setBusy(true);
      try {
        const ref = doc(db, PROFILE_COLLECTION, next.username), existing = await getDoc(ref);
        if (existing.exists() && existing.data().uid !== user.uid) { setBusy(false); return setError(`solodesk/${next.username} is taken. Try another username.`); }
        const batch = writeBatch(db);
        if (previous && previous !== next.username) batch.delete(doc(db, PROFILE_COLLECTION, previous));
        batch.set(ref, { ...publicProfileDoc(next, d, user.uid), updatedAt: serverTimestamp() });
        await batch.commit();
      } catch { setBusy(false); return setError('Your profile could not be published. Check your connection and try again.'); }
      setBusy(false);
    }
    mut(n => { n.profile = next; });
    toast(demo ? 'Profile saved in the demo. Publishing works in your signed-in workspace.' : next.public ? 'Profile saved and public at ' + url.replace(/^https?:\/\//, '') : 'Profile saved. It stays private: visitors see only your name.');
  };
  const chosen = p.clients.map(id => d.clients.find(c => c.id === id)?.name).filter(Boolean);
  return <form onSubmit={save}>
    <div className="page-head"><div className="grow"><h1>Profile</h1><p className="empty-note" style={{ margin: '6px 0 0' }}>A mini portfolio for clients and partners. Private until you choose to make it public.</p></div><a className="ghost" href={'/' + (d.profile?.username || '')} target="_blank" rel="noopener noreferrer" aria-disabled={!d.profile?.username}>View public page ↗</a><button className="btn" disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</button></div>
    {error && <p className="inline-error" role="alert">{error}</p>}
    <div className="two-col">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="card" style={{ display: 'grid', gap: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}><input type="checkbox" checked={p.public} onChange={e => set('public', e.target.checked)} /><span><b>Public profile</b><br /><small className="empty-note">{p.public ? 'Anyone with the link can see your profile.' : 'Off: visitors see only your name and that this profile is private.'}</small></span></label>
          <div className="white-row" style={{ background: 'var(--sf)', color: 'var(--tx)' }}><span className="grow">{url.replace(/^https?:\/\//, '')}</span><span className={'chip ' + (p.public ? 'sage' : 'white')}>{p.public ? 'Public' : 'Private'}</span><button type="button" className="ghost sm" onClick={() => navigator.clipboard?.writeText(url).then(() => toast('Link copied.'), () => toast(url))}>Copy link</button></div>
        </div>
        <div className="card form-grid">
          <h3 className="full" style={{ margin: 0 }}>About you</h3>
          <label>Username<input required value={p.username} onChange={e => set('username', e.target.value.toLowerCase())} placeholder="aditya" pattern="[a-z0-9][a-z0-9_\-]{2,29}" /></label>
          <label>Display name<input required value={p.name} maxLength={60} onChange={e => set('name', e.target.value)} /></label>
          <label className="full">Headline<input value={p.headline} maxLength={120} onChange={e => set('headline', e.target.value)} placeholder="Product designer for early-stage teams" /></label>
          <label>Location<input value={p.location} maxLength={60} onChange={e => set('location', e.target.value)} /></label>
          <label style={{ alignSelf: 'end' }}><input type="checkbox" checked={p.available} onChange={e => set('available', e.target.checked)} /> Available for projects</label>
          <label className="full">Bio<textarea rows="4" value={p.bio} maxLength={600} onChange={e => set('bio', e.target.value)} /></label>
          <small className="full empty-note">Usernames use 3–30 lowercase letters, numbers, - or _. Changing it moves your public address.</small>
        </div>
        <div className="card" style={{ display: 'grid', gap: 10 }}>
          <div className="block-head" style={{ margin: 0 }}><h3>Links</h3><button type="button" className="ghost sm" disabled={p.links.length >= 10} onClick={() => set('links', [...p.links, { label: '', url: '' }])}>+ Add link</button></div>
          {p.links.map((l, i) => <div key={i} style={{ display: 'grid', gridTemplateColumns: '160px minmax(0,1fr) auto', gap: 8, alignItems: 'end' }}>
            <label>Label<input value={l.label} maxLength={40} onChange={e => set('links', p.links.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} placeholder="Portfolio" /></label>
            <label>URL<input type="url" value={l.url} onChange={e => set('links', p.links.map((x, j) => j === i ? { ...x, url: e.target.value } : x))} placeholder="https://" /></label>
            <button type="button" className="ghost sm" onClick={() => set('links', p.links.filter((_, j) => j !== i))}>Remove</button></div>)}
        </div>
        <div className="card" style={{ display: 'grid', gap: 8 }}>
          <h3 style={{ margin: 0 }}>Clients worked with</h3><small className="empty-note">Choose which client names appear on your public profile. Nothing else about them is shared.</small>
          {d.clients.filter(c => !c.arch).map(c => <label key={c.id}><input type="checkbox" checked={p.clients.includes(c.id)} onChange={e => set('clients', e.target.checked ? [...p.clients, c.id] : p.clients.filter(x => x !== c.id))} /> {c.name}</label>)}
          {!d.clients.length && <p className="empty-note">Add clients first.</p>}
        </div>
      </div>
      <aside className="card" style={{ background: 'var(--sf)', position: 'relative', overflow: 'hidden' }} aria-label="Preview of your public profile">
        <span className="eyebrow">PREVIEW · WHAT VISITORS SEE{p.public ? '' : ' WHEN PUBLIC'}</span>
        <div style={{ marginTop: 14 }}><ProfileCard p={{ ...p, links: p.links.filter(l => l.label && safeUrl(l.url)) }} clients={chosen} /></div>
      </aside>
    </div>
  </form>;
}

export function PublicProfile({ username }) {
  const [state, setState] = useState({ status: 'loading' });
  useEffect(() => {
    document.title = 'solodesk/' + username;
    if (!configured || !db) { setState({ status: 'missing' }); return; }
    getDoc(doc(db, PROFILE_COLLECTION, username)).then(s => setState(s.exists() ? { status: 'ok', p: s.data() } : { status: 'missing' }), () => setState({ status: 'missing' }));
  }, [username]);
  const p = state.p;
  return <div className="profile-public">
    <header><span className="avatar-xl" style={{ width: 30, height: 30, fontSize: 14, borderRadius: 8 }}>S</span><b>solodesk</b><a className="ghost sm" href="/">Create your profile</a></header>
    <main className="wrap" id="workspace">
      {state.status === 'loading' && <p className="empty-note">Opening profile…</p>}
      {state.status === 'missing' && <div className="card" style={{ textAlign: 'center' }}><h1 style={{ fontSize: 28 }}>No profile here</h1><p className="empty-note">There is no SoloDesk profile at solodesk/{username}.</p></div>}
      {state.status === 'ok' && !p.public && <div className="card" style={{ textAlign: 'center', display: 'grid', gap: 10, justifyItems: 'center', padding: 40 }}>
        <span className="dot-icon" style={{ width: 52, height: 52 }}><Icon name="profile" /></span><h1 style={{ margin: 0, fontSize: 30 }}>{p.name}</h1><p style={{ margin: 0 }}>This user has decided to keep their profile private.</p><small className="empty-note">solodesk/{username}</small></div>}
      {state.status === 'ok' && p.public && <><div style={{ position: 'relative' }}><Shape kind="star" color="var(--sand)" size={90} style={{ position: 'absolute', right: 0, top: -30, zIndex: 0 }} /><ProfileCard p={p} clients={p.clients || []} /></div><small className="empty-note">Made with SoloDesk</small></>}
    </main>
  </div>;
}
