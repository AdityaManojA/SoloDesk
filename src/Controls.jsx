import { Children, useEffect, useLayoutEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon';
import { dateKey, monthDays, shiftMonth } from './calendar-view';
import './controls.css';

function useValue(value, defaultValue = '', onChange) {
  const [local, setLocal] = useState(defaultValue);
  return [value === undefined ? local : value, next => {
    if (value === undefined) setLocal(next);
    onChange?.({ target: { value: next }, currentTarget: { value: next } });
  }];
}

function Panel({ anchor, close, children, className = '', focusId, ...props }) {
  const panel = useRef(null), [position, setPosition] = useState(null), panelId = useId();
  const actualId = props.id || panelId;
  useEffect(() => {
    const place = () => {
      const box = anchor.current?.getBoundingClientRect(), el = panel.current;
      if (!box || !el) return;
      const width = Math.min(className === 'date-panel' ? 320 : Math.max(box.width, 240), window.innerWidth - 24);
      const available = window.innerHeight - 24, height = Math.min(el.scrollHeight, 400, available);
      const below = box.bottom + 8;
      setPosition({ width, maxHeight: Math.min(400, available), left: Math.max(12, Math.min(box.left, window.innerWidth - width - 12)), top: Math.max(12, Math.min(below + height <= window.innerHeight - 12 ? below : box.top - height - 8, window.innerHeight - height - 12)) });
    };
    const outside = e => { if (!panel.current?.contains(e.target) && !anchor.current?.contains(e.target)) close(false); };
    const escape = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); } };
    place();
    // Portal contents remain part of a modal's focus cycle.
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape, true);
    window.addEventListener('resize', place);
    const scroll = e => { if (!panel.current?.contains(e.target)) place(); };
    window.addEventListener('scroll', scroll, true);
    const owner = anchor.current?.closest('[role=dialog]'), previousOwns = owner?.getAttribute('aria-owns');
    owner?.setAttribute('aria-owns', actualId);
    return () => { if (owner?.getAttribute('aria-owns') === actualId) { if (previousOwns) owner.setAttribute('aria-owns', previousOwns); else owner.removeAttribute('aria-owns'); } document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape, true); window.removeEventListener('resize', place); window.removeEventListener('scroll', scroll, true); };
  }, []);
  // Wait until the positioned panel is visible before moving keyboard focus.
  useLayoutEffect(() => {
    if (position) (focusId ? document.getElementById(focusId) : panel.current?.querySelector('[aria-selected=true], [aria-pressed=true], button:not(:disabled)'))?.focus({ preventScroll: true });
  }, [!!position]);
  const keys = e => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const selector = 'button,input,select,textarea,a[href],[tabindex]';
      const scope = anchor.current?.closest('[role=dialog]') || document;
      const stops = [...scope.querySelectorAll(selector)].filter(el => el.tabIndex >= 0 && !el.disabled && el.getAttribute('aria-hidden') !== 'true' && el.getClientRects().length && !el.closest('[data-control-popover]'));
      const origin = anchor.current?.matches(selector) ? anchor.current : [...(anchor.current?.querySelectorAll(selector) || [])].at(-1);
      const index = stops.indexOf(origin), next = stops[(index + (e.shiftKey ? -1 : 1) + stops.length) % stops.length];
      close(false); next?.focus();
    } else props.onKeyDown?.(e);
  };
  return createPortal(<div ref={panel} data-control-popover className={'control-panel ' + className} style={{ width: className === 'date-panel' ? 320 : undefined, ...position, visibility: position ? 'visible' : 'hidden' }} onBlur={e => { if (e.relatedTarget && !e.currentTarget.contains(e.relatedTarget) && !anchor.current?.contains(e.relatedTarget)) close(false); }} {...props} id={actualId} onKeyDown={keys}>{children}</div>, document.body);
}

export function Select({ children, value, defaultValue, onChange, id, name, required, disabled, ...props }) {
  const generated = useId(), controlId = id || generated, listId = generated + '-list';
  const all = Children.toArray(children).filter(child => child?.type === 'option').map(child => ({ value: String(child.props.value ?? child.props.children), label: child.props.children, disabled: child.props.disabled, group: child.props['data-group'] }));
  const [selected, change] = useValue(value, defaultValue ?? all[0]?.value ?? '', onChange);
  const [open, setOpen] = useState(false), [active, setActive] = useState(0), [invalid,setInvalid] = useState(false), trigger = useRef(null), typeahead = useRef({ text: '', time: 0 });
  // Options marked data-group (e.g. completed projects) sit behind one row that expands them.
  const grouped = all.filter(o => o.group), groupName = grouped[0]?.group;
  const [expanded, setExpanded] = useState(() => grouped.some(o => o.value === String(value ?? defaultValue)));
  const options = grouped.length ? [...all.filter(o => !o.group), { value: '\u0000group', label: groupName, toggle: true }, ...(expanded ? grouped : [])] : all;
  const index = options.findIndex(option => !option.toggle && option.value === String(selected));
  useEffect(()=>{if(index >= 0 && selected !== '')setInvalid(false);},[index,selected]);
  const close = focus => { setOpen(false); if (focus) trigger.current?.focus(); };
  const show = () => { if(!options.length)return;setActive(index < 0 ? 0 : index); setOpen(true); };
  const choose = i => { if (!options[i] || options[i].disabled) return; if (options[i].toggle) { setExpanded(!expanded); return; } setInvalid(false);change(options[i].value); close(true); };
  const keys = e => {
    if (!options.length) return;
    if (['ArrowDown','ArrowUp','Home','End'].includes(e.key)) {
      e.preventDefault();
      if (!open) { show(); return; }
      let next = active;
      if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = options.length - 1;
      else next = (next + (e.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
      for (let count = 0; count < options.length && options[next]?.disabled; count++) next = (next + 1) % options.length;
      setActive(next);
    } else if ((e.key === 'Enter' || e.key === ' ') && open) { e.preventDefault(); choose(active); }
    else if (e.key.length === 1 && e.key !== ' ' && !e.ctrlKey && !e.metaKey) {
      const now = Date.now(), text = (now - typeahead.current.time < 700 ? typeahead.current.text : '') + e.key.toLowerCase();
      typeahead.current = { text, time: now };
      const next = options.findIndex(o => !o.disabled && String(o.label).toLowerCase().startsWith(text));
      if (next >= 0) { if (open) setActive(next); else change(options[next].value); }
    }
  };
  useEffect(() => { if (open) { const option = document.getElementById(listId + '-' + active); option?.focus(); option?.scrollIntoView({ block: 'nearest' }); } }, [active, open]);
  return <span className="select-control">
    <select className="control-native" aria-hidden="true" tabIndex={-1} name={name} value={index < 0 ? '' : selected} disabled={disabled} required={required} onChange={e => {setInvalid(false);change(e.target.value);}} onInvalid={e => { e.preventDefault();setInvalid(true); trigger.current?.focus(); }}>
      {index < 0 && <option value="" disabled hidden>Choose an option</option>}
      {children}
    </select>
    <button {...props} id={controlId} ref={trigger} type="button" className="select-trigger" role="combobox" aria-haspopup="listbox" aria-controls={open ? listId : undefined} aria-expanded={open} aria-required={required || undefined} aria-invalid={invalid || undefined} aria-describedby={invalid ? generated+'-error' : props['aria-describedby']} disabled={disabled || !options.length} onClick={() => open ? close(false) : show()} onKeyDown={keys}>
      <span>{options[index]?.label || 'Choose an option'}</span><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="2" /></svg>
    </button>
    {invalid && <span className="control-error" id={generated+'-error'} role="alert">{options.length ? 'Choose an option to continue.' : 'No options yet. Add a record first.'}</span>}
    {open && <Panel anchor={trigger} close={close} role="listbox" id={listId} aria-label={props['aria-label'] || 'Options'} tabIndex={-1} aria-activedescendant={listId + '-' + active} onKeyDown={keys}>
      {options.map((option, i) => option.toggle
        ? <button id={listId + '-' + i} key={option.value} type="button" role="option" aria-selected={false} aria-expanded={expanded} tabIndex={active === i ? 0 : -1} className={'select-option select-group' + (active === i ? ' is-active' : '')} onMouseMove={() => setActive(i)} onClick={() => choose(i)}><span>{option.label} <small>{grouped.length}</small></span><Icon name="chevronDown" size={16} /></button>
        : <button id={listId + '-' + i} key={option.value} type="button" role="option" aria-selected={option.value === String(selected)} disabled={option.disabled} tabIndex={active === i ? 0 : -1} className={'select-option' + (option.group ? ' in-group' : '') + (active === i ? ' is-active' : '')} onMouseMove={() => setActive(i)} onClick={() => choose(i)}><span>{option.label}</span>{option.value === String(selected) && <Icon name="check" size={17} />}</button>)}
    </Panel>}
  </span>;
}

export function DateInput({ value, defaultValue, onChange, type = 'date', ...props }) {
  const [selected, change] = useValue(value, defaultValue || '', onChange), [open, setOpen] = useState(false);
  const today = dateKey(new Date()), initial = selected.slice(0,10) || today;
  const [month, setMonth] = useState(initial.slice(0,7)), [focusDay, setFocusDay] = useState(initial);
  const anchor = useRef(null), trigger = useRef(null), input = useRef(null), id = useId();
  const label = props['aria-label'] || 'date', min = props.min?.slice(0,10), max = props.max?.slice(0,10);
  const allowed = day => (!min || day >= min) && (!max || day <= max);
  const close = focus => { setOpen(false); if (focus) trigger.current?.focus(); };
  const show = () => { const current = selected.slice(0,10) || (min && today < min ? min : max && today > max ? max : today); setMonth(current.slice(0,7)); setFocusDay(current); setOpen(true); };
  const choose = day => {
    if (day && !allowed(day)) return;
    let next = day ? day + (type === 'datetime-local' ? 'T' + (selected.slice(11) || '09:00') : '') : '';
    if (props.min && next && next < props.min) next = props.min;
    if (props.max && next && next > props.max) next = props.max;
    change(next); close(true);
  };
  const move = e => {
    const offset = {ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7}[e.key];
    if (offset === undefined && !['Home','End','PageUp','PageDown'].includes(e.key)) return;
    e.preventDefault();
    const current = new Date(focusDay + 'T12:00:00');
    if (e.key === 'PageUp' || e.key === 'PageDown') { current.setDate(1); current.setMonth(current.getMonth() + (e.key === 'PageDown' ? 1 : -1)); }
    else current.setDate(current.getDate() + (offset ?? (e.key === 'Home' ? -((current.getDay() + 6) % 7) : 6 - ((current.getDay() + 6) % 7))));
    const next = dateKey(current); if (allowed(next)) { setFocusDay(next); setMonth(next.slice(0,7)); requestAnimationFrame(() => document.getElementById(id + next)?.focus()); }
  };
  return <span className="date-control" ref={anchor}>
    <input {...props} ref={input} type={type} value={selected} onChange={e => change(e.target.value)} className="date-native" onKeyDown={e => { if (e.key === 'ArrowDown' && e.altKey) { e.preventDefault(); show(); } }} />
    <button ref={trigger} type="button" className="date-trigger" aria-label={'Choose ' + label} aria-haspopup="dialog" aria-expanded={open} disabled={props.disabled} onClick={() => open ? close(false) : show()}><Icon name="calendar" size={20} /></button>
    {open && <Panel anchor={anchor} close={close} className="date-panel" focusId={id+focusDay} role="dialog" aria-label={'Choose ' + label}>
      <div className="date-panel-head"><button type="button" className="date-month-nav" aria-label="Previous month" disabled={!!min && shiftMonth(month,0) <= min.slice(0,7)} onClick={() => setMonth(shiftMonth(month,-1))}>‹</button><h3 aria-live="polite">{new Date(month+'-01T12:00:00').toLocaleDateString(undefined,{month:'long',year:'numeric'})}</h3><button type="button" className="date-month-nav" aria-label="Next month" disabled={!!max && month >= max.slice(0,7)} onClick={() => setMonth(shiftMonth(month,1))}>›</button></div>
      <div className="date-weekdays" aria-hidden="true">{['Mo','Tu','We','Th','Fr','Sa','Su'].map(day => <span key={day}>{day}</span>)}</div>
      <div className="date-days" onKeyDown={move}>{monthDays(month).map(day => <button type="button" id={id+day} key={day} disabled={!allowed(day)} className={(day.slice(0,7) !== month ? 'outside-date ' : '') + (day === today ? 'today-date' : '')} aria-label={new Date(day+'T12:00:00').toLocaleDateString(undefined,{weekday:'long',day:'numeric',month:'long',year:'numeric'})} aria-pressed={day === selected.slice(0,10)} aria-current={day === today ? 'date' : undefined} tabIndex={day === focusDay ? 0 : -1} onFocus={() => setFocusDay(day)} onClick={() => choose(day)}>{Number(day.slice(-2))}</button>)}</div>
      <div className="date-panel-foot"><button type="button" className="ghost sm" disabled={!allowed(today)} onClick={() => choose(today)}>Today</button>{!props.required && <button type="button" className="ghost sm" onClick={() => choose('')}>Clear</button>}<button type="button" className="ghost sm" onClick={() => close(true)}>Close</button></div>
      {type === 'datetime-local' && <p className="date-hint">Choose the time in the date and time field.</p>}
    </Panel>}
  </span>;
}

export function FileInput({ onChange, ...props }) {
  const [filename, setFilename] = useState('No file selected');
  return <span className="file-control"><input {...props} type="file" onChange={e => { setFilename(e.target.files[0]?.name || 'No file selected'); onChange?.(e); }} /><span className="file-control-display" aria-hidden="true"><span className="file-button">Choose file</span><span className="file-name">{filename}</span><Icon name="plus" size={18} /></span></span>;
}
