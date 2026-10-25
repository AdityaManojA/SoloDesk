import { useState } from 'react';
import Icon from './Icon';
import Shape from './Shapes.jsx';
import { rid, money, calc, today } from './lib';
import { trashReusable } from './productivity';
import { ago } from './Home.jsx';
import { NoteEditor, newNote, noteMode } from './NotesKeep.jsx';

const time = v => { const t = Date.parse(v || ''); return Number.isFinite(t) ? t : 0; };
const shortDay = day => new Date(day + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

// Notes, to-dos and dated reminders for one client or one project (scope: { client } or { project }).
export function NoteBoard({ d, mut, toast, scope, onFiles }) {
  const key = scope.client ? 'client' : 'project', id = scope.client || scope.project;
  const notes = (d.notes || []).filter(n => n[key] === id).sort((a, b) => time(b.updatedAt || b.createdAt) - time(a.updatedAt || a.createdAt));
  const [selected, setSelected] = useState(notes[0]?.id || null);
  const note = notes.find(n => n.id === selected) || notes[0];
  const edit = fn => mut(n => { const row = n.notes.find(x => x.id === note.id); if (row) fn(row); });
  const create = mode => {
    const project = scope.project ? d.projects.find(p => p.id === scope.project) : null, n = newNote({ mode, client: scope.client || project?.client || '', project: scope.project || '' });
    mut(w => { w.notes = [n, ...(w.notes || [])]; });
    setSelected(n.id);
  };
  const t = today();
  const reminders = (d.notes || []).filter(n => n[key] === id).flatMap(n => (n.checklist || []).filter(c => !c.done && c.due).map(c => ({ ...c, note: n }))).sort((a, b) => a.due.localeCompare(b.due)).slice(0, 5);
  const projects = scope.client ? d.projects.filter(p => p.client === id) : [], invoices = d.invoices.filter(i => scope.client ? i.client === id : false);
  const billed = invoices.filter(i => i.state !== 'void').reduce((s, i) => s + calc(i).total, 0);
  const openCount = notes.reduce((n, x) => n + (x.checklist || []).filter(c => !c.done).length, 0);
  const files = (d.docs || []).filter(x => x[key] === id);
  return <div className="notes-layout">
    <div className="note-list">
      <button type="button" className="ghost" onClick={() => create('text')} style={{ borderStyle: 'dashed' }}>+ Take a note</button>
      {notes.map(n => { const all = n.checklist || [], done = all.filter(c => c.done).length; return <button type="button" key={n.id} className="note-pick" aria-pressed={note?.id === n.id} onClick={() => setSelected(n.id)}><b>{n.title || (n.body || '').split('\n')[0].slice(0, 40) || (n.checklist || [])[0]?.title || 'Untitled note'}</b><small>{noteMode(n) === 'checklist' ? `${(n.checklist || []).filter(c => !c.done).length} to do` : (n.body || 'Empty note').slice(0, 60)}</small><small>{ago(time(n.updatedAt || n.createdAt))}{all.length ? ` · ${done}/${all.length}` : ''}</small></button>; })}
      {!notes.length && <p className="empty-note">No notes yet. Keep briefs, decisions and to-dos here.</p>}
    </div>
    {note ? <div className="note-card">
      <Shape kind="heart" color="var(--hero-deep)" size={170} style={{ position: 'absolute', right: -30, bottom: -40, transform: 'rotate(-14deg)', zIndex: 0 }} />
      <NoteEditor key={note.id} note={note} edit={edit} onTrash={() => { mut(n => trashReusable(n, 'notes', note.id)); setSelected(null); toast('Note moved to Trash. Restore it from Trash or use Undo.'); }} />
    </div> : <div className="note-card"><b>Start with a note</b><p>Notes keep everything about this {key} in one place: what was agreed, what is next, and dated reminders.</p><div style={{ display: 'flex', gap: 8 }}><button className="btn" onClick={() => create('text')}>Take a note</button><button className="ghost" style={{ borderColor: '#141414', color: '#141414' }} onClick={() => create('checklist')}>New checklist</button></div></div>}
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
