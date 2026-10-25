import { useId, useMemo, useRef, useState } from 'react';
import Icon from './Icon';
import { suggest, applySuggestion, fmtDay, fmtTime } from './smart-parse';

const KIND_ICON = { project: 'projects', client: 'clients', when: 'calendar' };
const KIND_LABEL = { project: 'Project', client: 'Client', when: '' };

// A text field that offers clients, projects and date words as you type (↑ ↓ to move, Enter or Tab to pick),
// like TaskFlow's quest entry. `chips` shows what was understood under the field.
export function SmartField({ label, value, onChange, workspace, chips = [], hint, names = true, dates = true, inputRef, ...props }) {
  const [caret, setCaret] = useState(null), [active, setActive] = useState(0), [closed, setClosed] = useState(false), [focused, setFocused] = useState(false);
  const own = useRef(null), input = inputRef || own, listId = useId();
  const items = useMemo(() => focused && !closed ? suggest(value, caret ?? value.length, workspace, { names, dates }) : [], [value, caret, workspace, focused, closed, names, dates]);
  const open = items.length > 0;
  const pick = s => {
    const next = applySuggestion(value, s);
    onChange(next.text); setClosed(true);
    requestAnimationFrame(() => { input.current?.focus(); input.current?.setSelectionRange(next.caret, next.caret); setCaret(next.caret); setClosed(false); });
  };
  const keys = e => {
    if (!open) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); setActive(i => (i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length); }
    else if (e.key === 'Enter' || (e.key === 'Tab' && !e.shiftKey)) { e.preventDefault(); pick(items[Math.min(active, items.length - 1)]); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setClosed(true); }
  };
  return <div className="smart-field">
    <label>{label}<input {...props} ref={input} value={value} autoComplete="off" role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={open ? listId : undefined} aria-activedescendant={open ? listId + '-' + active : undefined}
      onChange={e => { onChange(e.target.value); setCaret(e.target.selectionStart); setActive(0); setClosed(false); setFocused(true); }}
      onSelect={e => setCaret(e.target.selectionStart)} onKeyDown={keys} onFocus={() => setFocused(true)} onBlur={() => setTimeout(() => setFocused(false), 120)} /></label>
    {open && <ul className="smart-suggest" role="listbox" id={listId} aria-label="Suggestions">{items.map((s, i) => <li key={s.kind + s.label} id={listId + '-' + i} role="option" aria-selected={i === active} className={i === active ? 'on' : ''} onMouseDown={e => { e.preventDefault(); pick(s); }} onMouseMove={() => setActive(i)}>
      <Icon name={KIND_ICON[s.kind] || 'calendar'} size={15} /><span>{s.label}</span>{(KIND_LABEL[s.kind] || s.detail) && <small>{[KIND_LABEL[s.kind], s.detail].filter(Boolean).join(' · ')}</small>}{i === active && <kbd>Tab</kbd>}</li>)}</ul>}
    {chips.length > 0 ? <div className="smart-chips" aria-live="polite">{chips.map((c, i) => <span key={i} className={'smart-chip ' + c.kind}>{c.label}</span>)}</div> : hint && <p className="smart-hint">{hint}</p>}
  </div>;
}

// Chips for a parsed task: what each field will be set to.
export function taskChips(p, d, now) {
  const out = [];
  if (p.due) out.push({ kind: 'when', label: fmtDay(p.due, now) + (p.time ? ' · ' + fmtTime(p.time) : '') });
  if (p.repeat) out.push({ kind: 'repeat', label: 'Repeats ' + ({ daily: 'daily', weekdays: 'on weekdays', weekly: 'weekly', monthly: 'monthly' })[p.repeat] });
  if (p.project) out.push({ kind: 'project', label: d.projects.find(x => x.id === p.project)?.name });
  if (p.client) out.push({ kind: 'client', label: d.clients.find(x => x.id === p.client)?.name });
  if (p.priority) out.push({ kind: 'priority', label: p.priority + ' priority' });
  if (out.length && p.title) out.push({ kind: 'title', label: 'Saves as “' + p.title + '”' });
  return out;
}
