import { useState } from 'react';
import Icon from './Icon';
import Shape from './Shapes.jsx';
import { rid, money, calc, today } from './lib';
import { trashReusable } from './productivity';
import { ago } from './Home.jsx';

const time = v => { const t = Date.parse(v || ''); return Number.isFinite(t) ? t : 0; };
const shortDay = day => new Date(day + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

// Notes, to-dos and dated reminders for one client or one project (scope: { client } or { project }).
export function NoteBoard({ d, mut, toast, scope, onFiles }) {
  const key = scope.client ? 'client' : 'project', id = scope.client || scope.project;
  const notes = (d.notes || []).filter(n => n[key] === id).sort((a, b) => time(b.updatedAt || b.createdAt) - time(a.updatedAt || a.createdAt));
  const [selected, setSelected] = useState(notes[0]?.id || null), [item, setItem] = useState(''), [due, setDue] = useState('');
  const note = notes.find(n => n.id === selected) || notes[0];
  const edit = fn => mut(n => { const row = n.notes.find(x => x.id === note.id); if (row) fn(row); });
  const create = () => {
    const nid = rid(), project = scope.project ? d.projects.find(p => p.id === scope.project) : null;
    mut(n => { n.notes = [{ id: nid, title: 'Untitled note', body: '', client: scope.client || project?.client || '', project: scope.project || '', createdAt: new Date().toISOString(), checklist: [] }, ...(n.notes || [])]; });
    setSelected(nid);
  };
  const addItem = e => { e.preventDefault(); const title = item.trim(); if (!title) return; edit(row => { row.checklist = [...(row.checklist || []), { id: rid(), title, done: false, ...(due ? { due } : {}) }]; }); setItem(''); setDue(''); };
  const t = today();
  const reminders = (d.notes || []).filter(n => n[key] === id).flatMap(n => (n.checklist || []).filter(c => !c.done && c.due).map(c => ({ ...c, note: n }))).sort((a, b) => a.due.localeCompare(b.due)).slice(0, 5);
  const projects = scope.client ? d.projects.filter(p => p.client === id) : [], invoices = d.invoices.filter(i => scope.client ? i.client === id : false);
  const billed = invoices.filter(i => i.state !== 'void').reduce((s, i) => s + calc(i).total, 0);
  const openCount = notes.reduce((n, x) => n + (x.checklist || []).filter(c => !c.done).length, 0);
  const files = (d.docs || []).filter(x => x[key] === id);
  return <div className="notes-layout">
    <div className="note-list">
      <button type="button" className="ghost" onClick={create} style={{ borderStyle: 'dashed' }}>+ New note</button>
      {notes.map(n => { const all = n.checklist || [], done = all.filter(c => c.done).length; return <button type="button" key={n.id} className="note-pick" aria-pressed={note?.id === n.id} onClick={() => setSelected(n.id)}><b>{n.title || 'Untitled note'}</b><small>{(n.body || 'No text yet').slice(0, 60)}{(n.body || '').length > 60 ? '…' : ''}</small><small>{ago(time(n.updatedAt || n.createdAt))}{all.length ? ` · ${done}/${all.length}` : ''}</small></button>; })}
      {!notes.length && <p className="empty-note">No notes yet. Keep briefs, decisions and to-dos here.</p>}
    </div>
    {note ? <div className="note-card">
      <Shape kind="heart" color="var(--hero-deep)" size={170} style={{ position: 'absolute', right: -30, bottom: -40, transform: 'rotate(-14deg)', zIndex: 0 }} />
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <input key={'t' + note.id} className="note-title" aria-label="Note title" defaultValue={note.title} onBlur={e => { const v = e.target.value.trim() || 'Untitled note'; if (v !== note.title) edit(r => { r.title = v; }); }} style={{ flex: 1, minWidth: 0 }} />
        <span className="chip white">Edited {ago(time(note.updatedAt || note.createdAt)).toLowerCase()}</span>
        <button type="button" className="icon-x" aria-label="Move note to Trash" onClick={() => { mut(n => trashReusable(n, 'notes', note.id)); setSelected(null); toast('Note moved to Trash. Restore it from Trash or use Undo.'); }}><Icon name="close" size={18} /></button>
      </div>
      <textarea key={'b' + note.id} aria-label="Note text" rows="4" placeholder="Brief, meeting notes or decisions…" defaultValue={note.body} onBlur={e => { if (e.target.value !== note.body) edit(r => { r.body = e.target.value; }); }} />
      <div style={{ display: 'flex', justifyContent: 'space-between' }}><b>Checklist</b><small>{(note.checklist || []).filter(c => c.done).length} of {(note.checklist || []).length} done</small></div>
      {(note.checklist || []).map(c => <div key={c.id} className={'check-item' + (c.done ? ' done' : '')}>
        <button type="button" className="check-box" role="checkbox" aria-checked={!!c.done} aria-label={(c.done ? 'Mark not done: ' : 'Mark done: ') + c.title} onClick={() => edit(r => { const x = r.checklist.find(y => y.id === c.id); x.done = !x.done; })}>{c.done && <Icon name="check" size={14} />}</button>
        <span>{c.title}</span>
        {c.due && <span className={'chip ' + (c.done ? 'white' : c.due < t ? 'hero' : 'sand')}>{c.done ? 'Done' : c.due < t ? 'Overdue · ' + shortDay(c.due) : shortDay(c.due)}</span>}
        <button type="button" className="icon-x" aria-label={'Remove ' + c.title} onClick={() => edit(r => { r.checklist = r.checklist.filter(y => y.id !== c.id); })}>×</button>
      </div>)}
      <form className="add-row" onSubmit={addItem}><Icon name="plus" size={16} /><input aria-label="New to-do" placeholder="Add a to-do…" value={item} onChange={e => setItem(e.target.value)} /><input type="date" aria-label="Reminder date (optional)" value={due} onChange={e => setDue(e.target.value)} /><button className="btn sm">Add</button></form>
    </div> : <div className="note-card"><b>Start with a note</b><p>Notes keep everything about this {key} in one place: what was agreed, what is next, and dated reminders.</p><button className="btn" style={{ alignSelf: 'flex-start' }} onClick={create}>Create a note</button></div>}
    <div className="side-col">
      <div className="side-card sand"><Shape kind="cross" color="var(--sand-deep)" size={110} style={{ position: 'absolute', right: -20, top: -24, transform: 'rotate(-18deg)', zIndex: 0 }} /><h3>Reminders:</h3>
        {reminders.length ? reminders.map(r => <div key={r.id} className="white-row"><span className="grow">{r.title}</span><span className={'chip ' + (r.due < t ? 'hero' : 'sand')}>{shortDay(r.due)}</span></div>) : <small>Add a date to a to-do and it shows here, on Home and in the calendar.</small>}
      </div>
      {scope.client && <div className="side-card sage"><Shape kind="arc" color="var(--sage-deep)" size={140} style={{ position: 'absolute', right: -20, bottom: -10, zIndex: 0 }} /><h3>This client:</h3><div className="stat-row"><span><b>{projects.length}</b><small>Projects</small></span><span><b>{money(billed)}</b><small>Billed</small></span><span><b>{openCount}</b><small>Open to-dos</small></span></div></div>}
      <div className="side-card card"><Shape kind="star" color="var(--hero)" size={120} style={{ position: 'absolute', right: -26, bottom: -30, zIndex: 0, opacity: .8 }} /><h3>Files & docs:</h3>
        {files.slice(0, 3).map(f => <div key={f.id} className="white-row"><Icon name={f.kind === 'prd' ? 'doc' : 'link'} size={16} /><span className="grow">{f.title}</span></div>)}
        {!files.length && <small>Link spreadsheets, PRDs and files for this {key}.</small>}
        {onFiles && <button type="button" className="ghost sm" style={{ alignSelf: 'flex-start' }} onClick={onFiles}>Open Files & docs</button>}
      </div>
    </div>
  </div>;
}
