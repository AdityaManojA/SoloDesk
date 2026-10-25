import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from './Icon';
import { rid, today } from './lib';
import { trashReusable } from './productivity';
import { ago } from './Home.jsx';

// Notes work like Google Keep: a title and free text, or a checklist where Enter adds the next item.
const time = v => { const t = Date.parse(v || ''); return Number.isFinite(t) ? t : 0; };
const shortDay = day => new Date(day + 'T12:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
export const noteMode = n => n.mode || ((n.checklist || []).length && !n.body ? 'checklist' : 'text');
export const newNote = (extra = {}) => ({ id: rid(), title: '', body: '', client: '', project: '', mode: 'text', checklist: [], createdAt: new Date().toISOString(), ...extra });

// Text ↔ checklist, like Keep's "Show checkboxes" / "Hide checkboxes".
export function toggleMode(note) {
  if (noteMode(note) === 'text') {
    const lines = (note.body || '').split('\n').map(x => x.replace(/^\s*[-*•☐☑]\s*/, '').trim()).filter(Boolean);
    return { ...note, mode: 'checklist', body: '', checklist: [...(note.checklist || []), ...lines.map(title => ({ id: rid(), title, done: false }))] };
  }
  const lines = (note.checklist || []).map(c => c.title).filter(Boolean);
  return { ...note, mode: 'text', body: [note.body, ...lines].filter(Boolean).join('\n'), checklist: [] };
}

function useDebounced(fn, ms = 600) {
  const timer = useRef(), latest = useRef(fn); latest.current = fn;
  useEffect(() => () => clearTimeout(timer.current), []);
  return useMemo(() => ({ run: (...a) => { clearTimeout(timer.current); timer.current = setTimeout(() => latest.current(...a), ms); }, flush: (...a) => { clearTimeout(timer.current); latest.current(...a); } }), [ms]);
}

function Checklist({ note, save }) {
  const [items, setItems] = useState(note.checklist || []), refs = useRef({}), focusNext = useRef(null);
  useEffect(() => { setItems(note.checklist || []); }, [note.id]);
  useEffect(() => { const el = focusNext.current && refs.current[focusNext.current]; if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } focusNext.current = null; });
  const debounced = useDebounced(list => save(list));
  const commit = (list, now = false) => { setItems(list); now ? debounced.flush(list) : debounced.run(list); };
  const t = today(), open = items.filter(c => !c.done), done = items.filter(c => c.done);
  const row = c => <div key={c.id} className={'keep-item' + (c.done ? ' done' : '')}>
    <button type="button" className="check-box" role="checkbox" aria-checked={!!c.done} aria-label={(c.done ? 'Untick ' : 'Tick ') + (c.title || 'item')} onClick={() => commit(items.map(x => x.id === c.id ? { ...x, done: !x.done } : x), true)}>{c.done && <Icon name="check" size={14} />}</button>
    <input ref={el => { refs.current[c.id] = el; }} aria-label="List item" value={c.title} placeholder="List item"
      onChange={e => commit(items.map(x => x.id === c.id ? { ...x, title: e.target.value } : x))}
      onBlur={() => debounced.flush(items)}
      onKeyDown={e => {
        if (e.key === 'Enter') { e.preventDefault(); const id = rid(), i = items.findIndex(x => x.id === c.id); focusNext.current = id; commit([...items.slice(0, i + 1), { id, title: '', done: false }, ...items.slice(i + 1)], true); }
        if (e.key === 'Backspace' && !c.title) { e.preventDefault(); const i = items.findIndex(x => x.id === c.id), prev = items.slice(0, i).reverse().find(x => !x.done); focusNext.current = prev?.id; commit(items.filter(x => x.id !== c.id), true); }
      }} />
    <label className={'keep-due' + (c.due ? ' set' + (c.due < t && !c.done ? ' late' : '') : '')} title="Reminder date">
      {c.due ? shortDay(c.due) : <Icon name="bell" size={14} />}
      <input type="date" aria-label={'Reminder for ' + (c.title || 'item')} value={c.due || ''} onChange={e => commit(items.map(x => x.id === c.id ? { ...x, due: e.target.value || undefined } : x), true)} />
    </label>
    <button type="button" className="icon-x" aria-label={'Delete ' + (c.title || 'item')} onClick={() => commit(items.filter(x => x.id !== c.id), true)}>×</button>
  </div>;
  return <div className="keep-list">
    {open.map(row)}
    <div className="keep-item add"><Icon name="plus" size={16} /><input aria-label="Add a list item" placeholder="List item" value="" onChange={e => { const id = rid(); focusNext.current = id; commit([...items, { id, title: e.target.value, done: false }], true); }} /></div>
    {done.length > 0 && <details className="keep-done" open><summary>{done.length} checked item{done.length === 1 ? '' : 's'}</summary>{done.map(row)}</details>}
  </div>;
}

// One note, edited in place. `edit(fn)` changes the stored note; `onTrash` moves it to Trash.
export function NoteEditor({ note, edit, onTrash, labels, autoFocus }) {
  const mode = noteMode(note), [body, setBody] = useState(note.body || ''), area = useRef(null), title = useRef(null);
  useEffect(() => { setBody(note.body || ''); }, [note.id, mode]);
  useEffect(() => { if (autoFocus) (mode === 'text' ? area : title).current?.focus(); }, [note.id]);
  useEffect(() => { const a = area.current; if (a) { a.style.height = 'auto'; a.style.height = a.scrollHeight + 'px'; } }, [body, mode]);
  const saveBody = useDebounced(v => edit(n => { n.body = v; }));
  return <div className="keep-editor">
    <input ref={title} key={'t' + note.id} className="keep-title" aria-label="Note title" placeholder="Title" defaultValue={note.title} onBlur={e => { const v = e.target.value.trim(); if (v !== (note.title || '')) edit(n => { n.title = v; }); }} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); (mode === 'text' ? area.current : null)?.focus(); } }} />
    {mode === 'text' ? <textarea ref={area} className="keep-body" aria-label="Note" placeholder="Take a note…" rows="3" value={body} onChange={e => { setBody(e.target.value); saveBody.run(e.target.value); }} onBlur={() => saveBody.flush(body)} />
      : <Checklist note={note} save={list => edit(n => { n.checklist = list; n.mode = 'checklist'; })} />}
    <div className="keep-toolbar">
      <button type="button" className="keep-tool" aria-pressed={mode === 'checklist'} onClick={() => { saveBody.flush(body); edit(n => Object.assign(n, toggleMode({ ...n, body }))); }} title={mode === 'checklist' ? 'Hide checkboxes' : 'Show checkboxes'}><Icon name="tasks" size={18} /><span>{mode === 'checklist' ? 'Hide checkboxes' : 'Checklist'}</span></button>
      {labels}
      <span className="keep-meta">{note.updatedAt || note.createdAt ? 'Edited ' + ago(time(note.updatedAt || note.createdAt)).toLowerCase() : ''}</span>
      {onTrash && <button type="button" className="keep-tool" onClick={onTrash} aria-label="Move note to Trash" title="Move to Trash"><Icon name="close" size={16} /></button>}
    </div>
  </div>;
}

function NotePreview({ note, d, onOpen, onToggle }) {
  const items = note.checklist || [], mode = noteMode(note);
  const client = note.client && d.clients.find(c => c.id === note.client), project = note.project && d.projects.find(p => p.id === note.project);
  return <article className="keep-card" tabIndex={0} role="button" aria-label={'Open note ' + (note.title || 'untitled')} onClick={onOpen} onKeyDown={e => { if (e.key === 'Enter' && e.target === e.currentTarget) onOpen(); }}>
    {note.title && <b className="keep-card-title">{note.title}</b>}
    {mode === 'text' ? <p className="keep-card-body">{(note.body || '').slice(0, 400) || <span className="empty-note">Empty note</span>}</p>
      : <ul className="keep-card-list">{items.filter(c => !c.done).slice(0, 6).map(c => <li key={c.id}><button type="button" className="check-box" role="checkbox" aria-checked="false" aria-label={'Tick ' + c.title} onClick={e => { e.stopPropagation(); onToggle(c.id); }} /><span>{c.title}</span>{c.due && <span className="chip sand">{shortDay(c.due)}</span>}</li>)}
        {items.filter(c => !c.done).length > 6 && <li className="empty-note">+{items.filter(c => !c.done).length - 6} more</li>}
        {items.some(c => c.done) && <li className="empty-note">+ {items.filter(c => c.done).length} checked</li>}</ul>}
    <div className="tag-row" style={{ marginTop: 10 }}>{client && <span className="chip hero">{client.name}</span>}{project && <span className="chip sage">{project.name}</span>}<span className="keep-meta">{ago(time(note.updatedAt || note.createdAt))}</span></div>
  </article>;
}

// Notes page: every note in the workspace, newest first, with a Keep-style "Take a note…" bar.
export function NotesPage({ d, mut, toast, id }) {
  const [query, setQuery] = useState(''), [filter, setFilter] = useState('all'), [openId, setOpenId] = useState(null), [linkTo, setLinkTo] = useState('');
  const notes = (d.notes || []).filter(n => filter === 'all' || (filter === 'clients' ? n.client : filter === 'projects' ? n.project : !n.client && !n.project))
    .filter(n => !query || [n.title, n.body, ...(n.checklist || []).map(c => c.title)].join(' ').toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => time(b.updatedAt || b.createdAt) - time(a.updatedAt || a.createdAt));
  const create = mode => { const [kind, ref] = linkTo.split(':'); const project = kind === 'project' ? d.projects.find(p => p.id === ref) : null; const n = newNote({ mode, client: kind === 'client' ? ref : project?.client || '', project: project?.id || '' }); mut(w => { w.notes = [n, ...(w.notes || [])]; }); setOpenId(n.id); };
  useEffect(() => { if (id === 'new') { create('text'); history.replaceState(null, '', '#/notes'); } }, [id]);
  const open = (d.notes || []).find(n => n.id === openId);
  const edit = fn => mut(w => { const n = (w.notes || []).find(x => x.id === openId); if (n) fn(n); });
  const close = () => { if (open && !open.title && !open.body && !(open.checklist || []).length) mut(w => { w.notes = w.notes.filter(x => x.id !== open.id); }); setOpenId(null); };
  useEffect(() => { if (!open) return; const k = e => { if (e.key === 'Escape') close(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); });
  return <section>
    <div className="page-head"><div className="grow"><h1>Notes</h1><p className="empty-note" style={{ margin: '6px 0 0' }}>All your notes and checklists, including the ones on clients and projects.</p></div></div>
    <div className="keep-composer">
      <button type="button" className="keep-composer-bar" onClick={() => create('text')}>Take a note…</button>
      <button type="button" className="keep-tool" onClick={() => create('checklist')} title="New checklist" aria-label="New checklist"><Icon name="tasks" size={18} /></button>
      <select aria-label="Link new notes to" value={linkTo} onChange={e => setLinkTo(e.target.value)} className="keep-link"><option value="">Not linked</option><optgroup label="Clients">{d.clients.filter(c => !c.arch).map(c => <option key={c.id} value={'client:' + c.id}>{c.name}</option>)}</optgroup><optgroup label="Projects">{d.projects.filter(p => !p.arch).map(p => <option key={p.id} value={'project:' + p.id}>{p.name}</option>)}</optgroup></select>
    </div>
    <div className="cal-toolbar" style={{ margin: '18px 0' }}>
      <div className="tabs-pill" role="group" aria-label="Show notes">{[['all', 'All'], ['clients', 'Clients'], ['projects', 'Projects'], ['unlinked', 'Not linked']].map(([k, l]) => <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}</button>)}</div>
      <div className="search-field" style={{ marginLeft: 'auto', minWidth: 220 }}><Icon name="search" size={16} /><input aria-label="Search notes" placeholder="Search notes" value={query} onChange={e => setQuery(e.target.value)} /></div>
    </div>
    {notes.length ? <div className="keep-grid">{notes.map(n => <NotePreview key={n.id} note={n} d={d} onOpen={() => setOpenId(n.id)} onToggle={itemId => mut(w => { const c = w.notes.find(x => x.id === n.id).checklist.find(x => x.id === itemId); c.done = !c.done; })} />)}</div>
      : <p className="empty-note">{(d.notes || []).length ? 'No notes match.' : 'Notes you take appear here.'}</p>}
    {open && <div className="ov" onClick={close}><div className="dlg keep-dialog" role="dialog" aria-modal="true" aria-label="Edit note" onClick={e => e.stopPropagation()}>
      <NoteEditor note={open} edit={edit} autoFocus onTrash={() => { mut(w => trashReusable(w, 'notes', open.id)); setOpenId(null); toast('Note moved to Trash.'); }}
        labels={<select aria-label="Linked to" className="keep-link" value={open.project ? 'project:' + open.project : open.client ? 'client:' + open.client : ''} onChange={e => { const [k, r] = e.target.value.split(':'); const p = k === 'project' ? d.projects.find(x => x.id === r) : null; edit(n => { n.client = k === 'client' ? r : p?.client || ''; n.project = p?.id || ''; }); }}><option value="">Not linked</option><optgroup label="Clients">{d.clients.map(c => <option key={c.id} value={'client:' + c.id}>{c.name}</option>)}</optgroup><optgroup label="Projects">{d.projects.map(p => <option key={p.id} value={'project:' + p.id}>{p.name}</option>)}</optgroup></select>} />
      <div className="end" style={{ margin: 0, padding: '12px 0 0', border: 0, background: 'none' }}><button type="button" className="btn sm" onClick={close}>Close</button></div>
    </div></div>}
  </section>;
}
