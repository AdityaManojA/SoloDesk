import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from './Icon';
import { checklistSwipe } from './checklist-swipe';
import { parseWhen } from './smart-parse';
import { rid, today } from './lib';
import { trashReusable } from './productivity';
import { shiftLevel, toggleItem, insertAfter, removeItem, linesToItems, itemsToLines } from './checklist';
import { ago } from './Home.jsx';
import { Select } from './Controls';

// Notes work like Google Keep: a title and free text, or a checklist where Enter adds the next item.
const time = v => { const t = Date.parse(v || ''); return Number.isFinite(t) ? t : 0; };
const shortDay = day => new Date(day + 'T12:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
export const noteMode = n => n.mode || ((n.checklist || []).length && !n.body ? 'checklist' : 'text');
export const newNote = (extra = {}) => ({ id: rid(), title: '', body: '', client: '', project: '', mode: 'text', checklist: [], createdAt: new Date().toISOString(), ...extra });

// Text ↔ checklist. Indented lines become sub-items and back.
export function toggleMode(note) {
  if (noteMode(note) === 'text') return { ...note, mode: 'checklist', body: '', checklist: [...(note.checklist || []), ...linesToItems(note.body || '', rid)] };
  return { ...note, mode: 'text', body: [note.body, itemsToLines(note.checklist || [])].filter(Boolean).join('\n'), checklist: [] };
}

// Saves after a pause in typing; anything still pending is saved when the editor closes.
function useDebounced(fn, ms = 1200) {
  const timer = useRef(), latest = useRef(fn), pending = useRef(null); latest.current = fn;
  useEffect(() => () => { clearTimeout(timer.current); if (pending.current) latest.current(...pending.current); }, []);
  return useMemo(() => ({
    run: (...a) => { pending.current = a; clearTimeout(timer.current); timer.current = setTimeout(() => { pending.current = null; latest.current(...a); }, ms); },
    flush: (...a) => { clearTimeout(timer.current); pending.current = null; latest.current(...a); },
  }), [ms]);
}

// "Call Ava tomorrow" → item "Call Ava" with a reminder for tomorrow (same wording as Levern and task titles).
function withReminder(item) {
  if (item.due || !item.title) return item;
  const w = parseWhen(item.title), date = w.chips.find(c => c.kind === 'date');
  if (!date || !w.due) return item;
  const title = w.chips.filter(c => c.kind === 'date' || c.kind === 'time').reduce((x, c) => x.replace(c.text, ' '), item.title).replace(/\s+(due|by|on)\s*$/i, '').replace(/\s+/g, ' ').trim();
  return title ? { ...item, title, due: w.due } : item;
}

// Apple Notes-style checklist: type, Enter for the next item, Tab / Shift+Tab to nest, all in place.
function Checklist({ note, save }) {
  const [items, setItems] = useState(note.checklist || []), refs = useRef({}), focus = useRef(null), swipe = useRef(null);
  useEffect(() => { setItems(note.checklist || []); }, [note.id]);
  useEffect(() => { const f = focus.current, el = f && refs.current[f.id]; if (el) { el.focus(); const at = f.at === 'start' ? 0 : el.value.length; el.setSelectionRange(at, at); } focus.current = null; }, [items]);
  const debounced = useDebounced(list => save(list));
  const commit = (list, now = false) => { setItems(list); now ? debounced.flush(list) : debounced.run(list); };
  const t = today();
  const swipeStart = (e, id) => {
    swipe.current = null;
    if (e.pointerType !== 'touch' || !e.isPrimary || !matchMedia('(max-width: 1023px)').matches || e.target.closest('button, label')) return;
    swipe.current = { id, pointerId: e.pointerId, x: e.clientX, y: e.clientY, time: e.timeStamp };
  };
  const swipeEnd = (e, id) => {
    const start = swipe.current; swipe.current = null;
    if (start?.id !== id) return;
    const delta = checklistSwipe(start, e);
    if (delta) { e.preventDefault(); commit(shiftLevel(items, id, delta), true); }
  };
  const key = (e, c, i) => {
    const el = e.currentTarget, atStart = el.selectionStart === 0 && el.selectionEnd === 0, level = c.level || 0;
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!c.title) { if (level) { focus.current = { id: c.id }; commit(shiftLevel(items, c.id, -1), true); } else { focus.current = { id: items[i - 1]?.id }; commit(removeItem(items, c.id), true); } return; }
      // Split at the caret, like a text editor: text after the caret moves to the new item.
      const id = rid(), before = c.title.slice(0, el.selectionStart), after = c.title.slice(el.selectionEnd);
      focus.current = { id, at: 'start' };
      commit(insertAfter(items.map(x => x.id === c.id ? (after ? { ...x, title: before } : withReminder({ ...x, title: before })) : x), c.id, { id, title: after }), true);
    } else if (e.key === 'Tab') {
      e.preventDefault(); focus.current = { id: c.id, at: el.selectionStart === 0 ? 'start' : 'end' };
      commit(shiftLevel(items, c.id, e.shiftKey ? -1 : 1), true);
    } else if (e.key === 'Backspace' && atStart) {
      if (level) { e.preventDefault(); focus.current = { id: c.id, at: 'start' }; commit(shiftLevel(items, c.id, -1), true); }
      else if (i > 0) { e.preventDefault(); const prev = items[i - 1]; focus.current = { id: prev.id }; commit(removeItem(items.map(x => x.id === prev.id ? { ...x, title: x.title + c.title } : x), c.id), true); }
    } else if (e.key === 'ArrowUp' && i > 0) { e.preventDefault(); focus.current = { id: items[i - 1].id }; setItems([...items]); }
    else if (e.key === 'ArrowDown' && i < items.length - 1) { e.preventDefault(); focus.current = { id: items[i + 1].id }; setItems([...items]); }
  };
  return <div className="keep-list">
    {items.map((c, i) => <div key={c.id} className={'keep-item' + (c.done ? ' done' : '')} style={{ paddingLeft: 4 + (c.level || 0) * 30 }} onPointerDown={e => swipeStart(e, c.id)} onPointerUp={e => swipeEnd(e, c.id)} onPointerCancel={() => { swipe.current = null; }}>
      <button type="button" className="check-box" role="checkbox" aria-checked={!!c.done} aria-label={(c.done ? 'Untick ' : 'Tick ') + (c.title || 'item')} onClick={() => commit(toggleItem(items, c.id), true)}>{c.done && <Icon name="check" size={13} />}</button>
      <input ref={el => { refs.current[c.id] = el; }} aria-label={(c.level ? 'Sub-item' : 'List item') + (c.level ? ', level ' + (c.level + 1) : '')} value={c.title} placeholder={i === 0 ? 'List item' : ''}
        onChange={e => commit(items.map(x => x.id === c.id ? { ...x, title: e.target.value } : x))} onBlur={() => { const next = items.map(x => x.id === c.id ? withReminder(x) : x); if (next.some((x, j) => x !== items[j])) commit(next, true); else debounced.flush(items); }} onKeyDown={e => key(e, c, i)} />
      <label className={'keep-due' + (c.due ? ' set' + (c.due < t && !c.done ? ' late' : '') : '')} title="Reminder date">
        {c.due ? shortDay(c.due) : <Icon name="bell" size={14} />}
        <input type="date" aria-label={'Reminder for ' + (c.title || 'item')} value={c.due || ''} onChange={e => commit(items.map(x => x.id === c.id ? { ...x, due: e.target.value || undefined } : x), true)} />
      </label>
    </div>)}
    {!items.length && <div className="keep-item"><span className="check-box" aria-hidden="true" /><input autoFocus aria-label="First list item" placeholder="List item" value="" onChange={e => { const id = rid(); focus.current = { id }; commit([{ id, title: e.target.value, done: false, level: 0 }], true); }} /></div>}
    <p className="keep-hint keep-keyboard-hint">Enter for a new item · Tab to indent · Shift+Tab to outdent</p><p className="keep-hint keep-touch-hint">Enter for a new item · Swipe right to indent · Swipe left to outdent</p>
  </div>;
}

// Which client or project a note belongs to. Uses the app's own dropdown so it matches the theme.
function LinkPicker({ note, d, edit }) {
  const value = note.project ? 'project:' + note.project : note.client ? 'client:' + note.client : '';
  const pick = e => { const [k, r] = String(e.target.value).split(':'); const p = k === 'project' ? d.projects.find(x => x.id === r) : null; edit(n => { n.client = k === 'client' ? r : p?.client || ''; n.project = p?.id || ''; }); };
  return <span className="note-link-picker"><Select aria-label="Linked to" value={value} onChange={pick}>
    <option value="">Not linked</option>
    {d.clients.length > 0 && <option value="h:clients" disabled>Clients</option>}
    {d.clients.filter(c => !c.arch).map(c => <option key={c.id} value={'client:' + c.id}>{c.name}</option>)}
    {d.projects.length > 0 && <option value="h:projects" disabled>Projects</option>}
    {d.projects.filter(p => !p.arch).map(p => <option key={p.id} value={'project:' + p.id}>{p.name}</option>)}
  </Select></span>;
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
      {onTrash && <button type="button" className="ghost sm danger keep-delete" onClick={onTrash} title="Move this note to Trash (you can restore it)">Delete</button>}
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

// Notes page, like Apple Notes: the list on the left, the open note on the right, edited in place.
export function NotesPage({ d, mut, toast, id }) {
  const [query, setQuery] = useState(''), [filter, setFilter] = useState('all'), [fresh, setFresh] = useState(null);
  const all = [...(d.notes || [])].sort((a, b) => time(b.updatedAt || b.createdAt) - time(a.updatedAt || a.createdAt));
  const [openId, setOpenId] = useState(() => id && id !== 'new' ? id : null);
  const notes = all.filter(n => filter === 'all' || (filter === 'clients' ? n.client : filter === 'projects' ? n.project : !n.client && !n.project))
    .filter(n => !query || [n.title, n.body, ...(n.checklist || []).map(c => c.title)].join(' ').toLowerCase().includes(query.toLowerCase()));
  const select = nid => { setOpenId(nid); history.replaceState(null, '', '#/notes' + (nid ? '/' + nid : '')); };
  const create = mode => { const n = newNote({ mode }); mut(w => { w.notes = [n, ...(w.notes || [])]; }); setFresh(n.id); select(n.id); };
  useEffect(() => { if (id === 'new') create('text'); }, [id]);
  const desktop = typeof window === 'undefined' || window.matchMedia('(min-width: 761px)').matches;
  const open = all.find(n => n.id === openId) || (desktop ? all[0] : null);
  const edit = fn => mut(w => { const n = (w.notes || []).find(x => x.id === open.id); if (n) fn(n); });
  // A brand-new note that stays empty is discarded when you move on.
  useEffect(() => () => { if (fresh) mut(w => { const n = (w.notes || []).find(x => x.id === fresh); if (n && !n.title && !n.body && !(n.checklist || []).some(c => c.title)) w.notes = w.notes.filter(x => x.id !== fresh); }); }, [fresh]);
  const label = n => n.title || (n.body || '').split('\n')[0] || (n.checklist || []).find(c => c.title)?.title || 'New note';
  const snippet = n => noteMode(n) === 'checklist' ? `${(n.checklist || []).filter(c => c.done).length}/${(n.checklist || []).length} done` : (n.title ? n.body : (n.body || '').split('\n').slice(1).join(' ')).slice(0, 80) || 'No additional text';
  return <section className={'notes-split' + (open && !desktop ? ' show-note' : '')}>
    <aside className="notes-index" aria-label="All notes">
      <div className="notes-index-head"><h1>Notes</h1><span><button type="button" className="keep-tool" onClick={() => create('checklist')} title="New checklist" aria-label="New checklist"><Icon name="tasks" size={18} /></button><button type="button" className="btn sm" onClick={() => create('text')}><Icon name="plus" size={16} />New note</button></span></div>
      <div className="search-field"><Icon name="search" size={16} /><input aria-label="Search notes" placeholder="Search" value={query} onChange={e => setQuery(e.target.value)} /></div>
      <div className="tabs-pill notes-filter" role="group" aria-label="Show notes">{[['all', 'All'], ['clients', 'Clients'], ['projects', 'Projects'], ['unlinked', 'Other']].map(([k, l]) => <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}</button>)}</div>
      <div className="notes-rows">{notes.map(n => { const c = n.client && d.clients.find(x => x.id === n.client), p = n.project && d.projects.find(x => x.id === n.project);
        return <button key={n.id} type="button" className="note-row" aria-current={open?.id === n.id ? 'true' : undefined} onClick={() => select(n.id)}>
          <b>{label(n)}</b><small><span>{ago(time(n.updatedAt || n.createdAt))}</span> {snippet(n)}</small>{(c || p) && <span className="note-row-tags">{c && <i className="chip hero">{c.name}</i>}{p && <i className="chip sage">{p.name}</i>}</span>}</button>; })}
        {!notes.length && <p className="empty-note">{all.length ? 'No notes match.' : 'No notes yet.'}</p>}</div>
    </aside>
    <div className="notes-pane">
      {open ? <div className="notes-paper">
        <button type="button" className="ghost sm notes-back" onClick={() => select(null)}>‹ All notes</button>
        <NoteEditor key={open.id} note={open} edit={edit} autoFocus={open.id === fresh} onTrash={() => { mut(w => trashReusable(w, 'notes', open.id)); select(null); toast('Note moved to Trash.'); }}
          labels={<LinkPicker note={open} d={d} edit={edit} />} />
      </div> : <div className="notes-empty"><p>Pick a note on the left, or start a new one.</p><button type="button" className="btn" onClick={() => create('text')}>New note</button></div>}
    </div>
  </section>;
}

// A note opened in a dialog, from the Notes page or from Home. Empty new notes are discarded on close.
export function NoteDialog({ note, d, mut, toast, onClose }) {
  const box = useRef(null);
  const edit = fn => mut(w => { const n = (w.notes || []).find(x => x.id === note.id); if (n) fn(n); });
  const close = () => { const n = (d.notes || []).find(x => x.id === note.id); const typed = [...(box.current?.querySelectorAll('input,textarea,[contenteditable=true]') || [])].some(x => (x.value ?? x.textContent ?? '').trim());
    if (n && !typed && !n.title && !n.body && !(n.checklist || []).length) mut(w => { w.notes = w.notes.filter(x => x.id !== n.id); }); onClose(); };
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => { const k = e => { if (e.key === 'Escape') closeRef.current(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, []);
  return <div className="ov" onClick={close}><div ref={box} className="dlg keep-dialog" role="dialog" aria-modal="true" aria-label="Edit note" onClick={e => e.stopPropagation()}>
    <NoteEditor note={note} edit={edit} autoFocus onTrash={() => { mut(w => trashReusable(w, 'notes', note.id)); onClose(); toast('Note moved to Trash.'); }}
      labels={<LinkPicker note={note} d={d} edit={edit} />} />
    <div className="end" style={{ margin: 0, padding: '12px 0 0', border: 0, background: 'none' }}><button type="button" className="btn sm" onClick={close}>Done</button></div>
  </div></div>;
}
