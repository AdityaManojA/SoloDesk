import { useState } from 'react';
import { DateInput } from './Controls';
import { today, money } from './lib';
import { parseDuration, formatMinutes, taskTime, logTime, removeTimeEntry } from './time-log';

// Task page: log time by hand ("1h 30m", "90", "1:30"), see what's logged, and remove entries not yet invoiced.
export default function TimeLog({ d, mut, task, toast }) {
  const [amount, setAmount] = useState(''), [date, setDate] = useState(today()), [note, setNote] = useState('');
  const { entries, minutes } = taskTime(d, task.id), parsed = parseDuration(amount);
  const project = d.projects.find(p => p.id === task.project), rate = Number(project?.hourlyRate) || 0;
  const add = e => {
    e.preventDefault();
    const next = structuredClone(d);
    try { logTime(next, task.id, { minutes: parsed, date, note }); } catch (err) { toast(err.message); return; }
    mut(n => { logTime(n, task.id, { minutes: parsed, date, note }); });
    toast(`Logged ${formatMinutes(parsed)} on “${task.title}”.`); setAmount(''); setNote('');
  };
  const remove = entry => { try { mut(n => { removeTimeEntry(n, entry.id); }); toast('Time entry removed. Undo brings it back.'); } catch (err) { toast(err.message); } };
  return <section className="card time-log" aria-label="Time on this task">
    <div className="block-head" style={{ margin: 0 }}><h3>Time</h3><b className="time-total">{formatMinutes(minutes)}</b></div>
    <form className="time-form" onSubmit={add}>
      <label>Time spent<input value={amount} onChange={e => setAmount(e.target.value)} placeholder="1h 30m" inputMode="text" aria-describedby="time-help" /></label>
      <label>Day<DateInput aria-label="Day worked" value={date} max={today()} onChange={e => setDate(e.target.value)} /></label>
      <label className="wide">Note (optional)<input value={note} maxLength={200} onChange={e => setNote(e.target.value)} placeholder="What you worked on" /></label>
      <button className="btn sm" type="submit" disabled={!parsed}>Log {parsed ? formatMinutes(parsed) : 'time'}</button>
    </form>
    <small id="time-help" className="empty-note">{amount && !parsed ? 'Try 1h 30m, 90 or 1:30.' : project ? (rate ? `Billable on ${project.name} at ${money(rate)}/h. Use Invoice unbilled hours on the project.` : `Add an hourly rate to ${project.name} to invoice this time.`) : 'Link this task to a project to invoice its time.'}</small>
    {entries.length > 0 && <ul className="time-entries">{entries.slice(0, 8).map(s => <li key={s.id || s.at}>
      <span className="grow"><b>{formatMinutes(s.seconds / 60)}</b><small>{new Date(s.at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} · {s.manual ? 'logged' : 'focus timer'}{s.note ? ' · ' + s.note : ''}</small></span>
      {s.billed ? <span className="chip sage">Invoiced</span> : s.id && <button type="button" className="icon-button time-remove" aria-label={'Remove ' + formatMinutes(s.seconds / 60) + ' entry'} onClick={() => remove(s)}>×</button>}
    </li>)}{entries.length > 8 && <li className="empty-note">+{entries.length - 8} earlier entries</li>}</ul>}
  </section>;
}
