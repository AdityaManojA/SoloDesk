import { useEffect, useState } from 'react';
import Icon from './Icon';
import { Select, DateInput } from './Controls';
import { download, csv, exporters } from './lib';
import { calendarEvents, calendarIcs } from '../functions/calendar';
import TaskflowPanel from './TaskflowPanel';
import { eventsInLocalRange } from './calendar-view';

const BASE = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '');
const resources = ['calendar', 'calendar.ics', 'workspace', 'clients', 'projects', 'tasks', 'invoices', 'payments', 'summary'];

export default function Integrations({ d, user, demo, toast, ask, taskflow }) {
  const [keys, setKeys] = useState([]), [secret, setSecret] = useState(''), [name, setName] = useState('');
  const [scope, setScope] = useState('calendar'), [revealedScope, setRevealedScope] = useState('calendar');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [resource, setResource] = useState('calendar'), [loaded, setLoaded] = useState(false);
  const [from, setFrom] = useState(''), [to, setTo] = useState('');
  const url = /^https?:/.test(BASE) ? BASE : window.location.origin + BASE;
  const rangeInvalid = from && to && from > to;
  const events = rangeInvalid ? [] : eventsInLocalRange(calendarEvents(d),from,to);
  const unscheduled = d.tasks.filter(t => t.status !== 'Done' && !t.due && !t.scheduledAt).length;

  const call = async (path, options = {}) => {
    const token = await user.getIdToken();
    const res = await fetch(BASE + path, { ...options, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, cache: 'no-store' });
    if (!(res.headers.get('content-type') || '').includes('application/json')) throw new Error('The API is not available here yet. Deploy the Firebase function and Hosting rewrite, or set VITE_API_BASE_URL.');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'The request failed. Please try again.');
    return data;
  };
  const load = async () => {
    setBusy(true); setError('');
    try { const result = await call('/keys'); setKeys(result.data); setLoaded(true); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  useEffect(() => { if (!demo) load(); }, [demo]);
  const create = async e => {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const result = await call('/keys', { method: 'POST', body: JSON.stringify({ name: name.trim(), scope }) });
      setSecret(result.secret); setRevealedScope(scope); setKeys(x => [result.data, ...x]); setName('');
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const revoke = key => ask(`Revoke “${key.name}”? Applications and calendar subscriptions using this key will immediately lose access. Previously imported calendar events are not removed.`, async () => {
    setBusy(true); setError('');
    try { await call('/keys/' + key.id, { method: 'DELETE' }); setKeys(x => x.filter(k => k.id !== key.id)); setSecret(''); toast('API key revoked.'); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  });
  const copy = async value => { try { await navigator.clipboard.writeText(value); toast('Copied to clipboard.'); } catch { toast('Copy is unavailable. Select the text and copy it manually.'); } };
  const exportCalendar = () => download('solodesk-calendar.ics', calendarIcs(events, { namespace: user?.uid || 'demo', origin: window.location.origin }), 'text/calendar;charset=utf-8');

  return <>
    <div className="hd"><h1>Calendar & integrations</h1><span className="b">Read-only connections</span></div>
    <TaskflowPanel taskflow={taskflow} compact />
    <div className="integration-callout"><div><h3>See the whole picture.</h3><p>Open your full month, switch to an agenda, or filter the schedule by client.</p></div><a className="btn" href="#/calendar"><Icon name="calendar" />Open full calendar</a></div>
    <section className="card calendar-panel">
      <div className="section-head"><div><span className="eyebrow">MAKE ROOM FOR THE WORK</span><h3>Your project & client timeline</h3></div><span className="b">{events.length} events</span></div>
      <p className="mu">Project date ranges, scheduled task blocks, and task deadlines — with the client and project attached to each event.</p>
      <div className="calendar-toolbar"><div className="grid2"><label>From (optional)<DateInput aria-label="From (optional)" max={to || undefined} value={from} onChange={e => setFrom(e.target.value)} /></label><label>Through (optional)<DateInput aria-label="Through (optional)" min={from || undefined} value={to} onChange={e => setTo(e.target.value)} /></label></div><div className="export-actions"><button className="btn" disabled={!!rangeInvalid} onClick={exportCalendar}>Export calendar · ICS</button><button className="ghost" disabled={!!rangeInvalid} onClick={() => download('solodesk-events.json', JSON.stringify({ data: events, meta: { schemaVersion: 1, exportedAt: new Date().toISOString() } }, null, 2), 'application/json')}>Export events · JSON</button></div></div>
      {rangeInvalid && <p className="inline-error" role="alert">Choose an end date on or after the start date.</p>}
      <div className="calendar-preview">{events.slice(0, 6).map(event => <a className="calendar-event" href={'#' + event.path} key={event.id}><div className="event-date"><b>{new Date(event.start.length === 10 ? event.start + 'T12:00:00' : event.start).toLocaleDateString(undefined, { day: '2-digit' })}</b><small>{new Date(event.start.length === 10 ? event.start + 'T12:00:00' : event.start).toLocaleDateString(undefined, { month: 'short' })}</small></div><div className="grow"><b>{event.title}</b><small>{[event.client?.name, event.projectName].filter(Boolean).join(' · ') || 'Your workspace'} · {event.allDay ? event.type === 'project' ? 'Project timeline' : 'All-day deadline' : new Date(event.start).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) + ' · ' + event.durationMinutes + ' min'}</small></div><span className="b">{event.type}</span><Icon name="arrow" size={16} /></a>)}</div>
      {!events.length && <div className="connection-notice">No dated work in this range. Add start/end dates to a project or a scheduled time or due date to a task.</div>}
      <p className="calendar-note">{events.length > 6 ? `Showing 6 of ${events.length} events. Exports include all matching events. ` : ''}{unscheduled > 0 ? `${unscheduled} open ${unscheduled === 1 ? 'task has' : 'tasks have'} no date and won’t appear in your calendar. ` : ''}Completed work is excluded. Timed blocks use your device’s timezone; the API returns UTC. Project end dates are inclusive in the form and exclusive in exported events.</p>
    </section>
    <section className="card provider-guide"><h3>Bring your work to Google or Apple Calendar</h3><div className="grid2"><div><h4>Add one event at a time</h4><ol><li>Open <a href="#/calendar">Calendar</a> and click a task or project.</li><li>Choose <b>Export this event · ICS</b>.</li><li>In Google Calendar on a computer, open <b>Settings → Import & export</b>, select the file and choose the destination calendar.</li><li>In Apple Calendar on Mac, choose <b>File → Import</b>, select the file and choose a calendar.</li></ol><p>Importing creates a copy. Edits here do not update that copy. Avoid repeatedly importing the same event.</p></div><div><h4>Keep a whole calendar updated</h4><ol><li>Deploy the SoloDesk API and sign in to your real workspace.</li><li>Create a <b>Calendar events only</b> key below and save its private subscription URL.</li><li>Google Calendar: <b>Other calendars → + → From URL</b>.</li><li>Apple Calendar on Mac: <b>File → New Calendar Subscription</b>. On iPhone: <b>Calendars → Add Calendar → Add Subscription Calendar</b>.</li></ol><p>Subscriptions are read-only. Your provider controls refresh timing. A localhost address will not work on another device or Google’s servers; use your deployed HTTPS URL.</p></div></div><p><a href="https://support.google.com/calendar/answer/37118?hl=en" target="_blank" rel="noreferrer">Google import instructions</a> · <a href="https://support.apple.com/guide/calendar/import-or-export-calendars-icl1023/mac" target="_blank" rel="noreferrer">Apple import instructions</a> · <a href="https://support.apple.com/en-us/102301" target="_blank" rel="noreferrer">Apple subscription instructions</a></p></section>
    <div className="integration-grid">
      <section className="card"><div className="connection-icon"><Icon name="integrations" /></div><h3>Connect your calendar app</h3><p>Use a calendar-only key for scheduling. It can read event titles, dates, and client/project context. Use a workspace key only for applications that need financial and contact records too.</p>
        {demo ? <div className="connection-notice">You’re exploring sample data. Sign in to your real workspace to create API keys and a calendar subscription. Local calendar and data exports work in the demo.</div> : <>
          {error && <div className="inline-error" role="alert">{error}<div className="end"><button className="ghost sm" disabled={busy} onClick={load}>Retry connection</button></div></div>}
          <form onSubmit={create} className="key-create-form"><div className="grid2"><label>Application name<input required maxLength={60} placeholder="e.g. My calendar" value={name} onChange={e => setName(e.target.value)} /></label><label>Data access<Select value={scope} onChange={e => setScope(e.target.value)}><option value="calendar">Calendar events only</option><option value="workspace">Full workspace (read-only)</option></Select></label></div><button className="btn" disabled={busy || !loaded || !name.trim()}>{busy ? 'Working…' : 'Create API key'}</button></form>
          {secret && <div className="key-reveal"><b>Save your connection now</b><p>The full key is shown once. Store it on your other application’s server.</p><code>{secret}</code><button className="ghost sm" onClick={() => copy(secret)}>Copy key</button>{revealedScope === 'calendar' && <><h3>Calendar subscription URL</h3><p>Paste this into your calendar’s “Subscribe by URL” field. Anyone with this URL can read your timeline. Your calendar controls refresh frequency; this key expires in 90 days.</p><code>{url}/calendar.ics?key={secret}</code><button className="ghost sm" onClick={() => copy(`${url}/calendar.ics?key=${secret}`)}>Copy subscription URL</button></>}<div className="end"><button className="ghost sm" onClick={() => setSecret('')}>I’ve saved it</button></div></div>}
          <div className="key-list">{keys.map(key => <div className="row" key={key.id}><div><b>{key.name} <span className="b">{key.scope === 'calendar' ? 'Calendar only' : 'Workspace'}</span></b><small>{key.prefix}… · Expires {new Date(key.expiresAt).toLocaleDateString()}</small></div><button className="ghost sm" disabled={busy} onClick={() => revoke(key)}>Revoke</button></div>)}{loaded && !keys.length && <p>No keys yet. Create one for each application you connect.</p>}</div>
        </>}
      </section>
      <section className="card"><div className="connection-icon"><Icon name="reports" /></div><h3>Take a copy with you</h3><p>Download your workspace as JSON, or export individual records as a spreadsheet-friendly CSV.</p><div className="export-actions"><button className="btn" onClick={() => download('solodesk-workspace.json', JSON.stringify({ schemaVersion: 1, exportedAt: new Date().toISOString(), data: d }, null, 2), 'application/json')}>Export all data · JSON</button>{Object.keys(exporters(d)).map(k => <button className="ghost sm" key={k} onClick={() => download(`solodesk-${k}.csv`, csv(exporters(d)[k]), 'text/csv;charset=utf-8')}>{k[0].toUpperCase() + k.slice(1)} · CSV</button>)}</div><p>Exports contain your business and client information. Store them somewhere you trust.</p></section>
    </div>
    <section className="card api-docs"><span className="eyebrow">FOR YOUR NEXT CONNECTION</span><h3>A simple request. Your timeline, returned.</h3><p>Fetch calendar events from your scheduler’s backend. Upsert events by their stable <code>id</code>; remove entries no longer returned by a complete refresh of the same range. This is one-way sync from SoloDesk.</p><div className="endpoint-picker"><label htmlFor="api-resource">Example resource</label><Select id="api-resource" value={resource} onChange={e => setResource(e.target.value)}>{resources.map(k => <option value={k} key={k}>{k}</option>)}</Select></div><pre className="code-block">{`curl "${url}/${resource}" \\\n  -H "Authorization: Bearer YOUR_API_KEY"`}</pre><button className="ghost sm" onClick={() => copy(`curl "${url}/${resource}" -H "Authorization: Bearer YOUR_API_KEY"`)}>Copy request</button>
      <div className="connection-notice">For a scheduler: <code>GET /api/v1/calendar?from=2026-10-01&amp;to=2026-12-31</code>. Date filters include overlapping projects. Follow <code>meta.nextOffset</code> until it is null. Tasks without a scheduled time use an all-day due date; undated tasks are omitted.</div>
      <h3>Available endpoints</h3>{resources.map(k => <div className="endpoint-row" key={k}><span className="method">GET</span><code>/api/v1/{k}</code><span className="mu">{k === 'calendar' ? 'Scheduler events · JSON' : k === 'calendar.ics' ? 'Calendar subscription · ICS' : k === 'workspace' ? 'Complete workspace snapshot' : k === 'summary' ? 'Financial and work totals' : `Your ${k}`}</span></div>)}
      <p style={{ marginTop: 18 }}>JSON lists accept <code>?limit=100&amp;offset=0</code> (up to 500). Calendar-only keys can access only the two calendar endpoints. Workspace keys access all data endpoints. Keys expire after 90 days and can be revoked at any time.</p><div className="connection-notice">The calendar file is a snapshot for importing. A subscription refreshes from SoloDesk on your calendar provider’s schedule. Live API access and subscriptions require the included Firebase function to be deployed and your Hosting origin configured.</div>
    </section>
  </>;
}
