import { TASKFLOW_URL } from './taskflow-data';
import './taskflow-feed.css';

export function TaskflowStatus({taskflow}){
  const {status,data,cached,retry,error}=taskflow;
  const message=status==='ready'?`${cached?'Cached TaskFlow data':'TaskFlow connected'} · ${data.quests.length} quests · ${data.events.length} Google events · Read-only`:status==='error'?error:status==='loading'?'Connecting to TaskFlow…':status==='demo'?'Demo workspace · TaskFlow connects after sign-in.':status==='missing'?'No TaskFlow data shared with this account yet.':'Sign in with your TaskFlow account to connect.';
  return <section className="source-status" aria-label="Calendar sources"><p role="status">{message}</p>{status==='error'&&<button type="button" className="ghost sm" onClick={retry}>Retry</button>}<a href="#/integrations" className="ghost sm">Manage sources</a></section>;
}

export default function TaskflowPanel({ taskflow, compact = false }) {
  const {status,data,cached,error,retry} = taskflow;
  const ready = status === 'ready';
  return <section className="card taskflow-feed" aria-label="From TaskFlow"><div className="section-head"><div><span className="eyebrow">YOUR CONNECTED WORK</span><h3>From TaskFlow</h3></div><a className="ghost sm" href={TASKFLOW_URL} target="_blank" rel="noopener noreferrer">Open TaskFlow ↗</a></div>
    <p className="mu" role="status">{status === 'demo' ? 'Sign in to Terracove with the same Google account you use in TaskFlow to see your quests and calendar events. Demo mode does not read your TaskFlow data.' : status === 'loading' ? 'Connecting to your TaskFlow calendar…' : status === 'missing' ? 'You haven’t used TaskFlow with this Google account yet. Open TaskFlow and add a quest to get started.' : status === 'error' ? error : ready ? `${cached ? 'Cached copy · reconnecting' : 'Connected'} · ${data.quests.length} open quests · ${data.events.length} Google Calendar events${data.tz ? ' · '+data.tz : ''}. Read-only here; edit in TaskFlow.` : 'Sign in with your TaskFlow Google account to connect.'}</p>
    {ready && <p className="taskflow-source-note">Google Calendar events come through TaskFlow’s shared feed and appear in all Terracove calendar views. TaskFlow currently shares the primary Google calendar from one week back to about two months ahead. Open TaskFlow → calendar connection → Sync now to refresh; use the same Google account in both apps. Updates reach Terracove automatically after TaskFlow shares them.</p>}
    {ready && !data.events.length && <p className="taskflow-source-note">No Google events were shared. This can mean an empty date range or that Google Calendar needs connecting, permission or a refresh in TaskFlow. Terracove cannot check that connection from this feed.</p>}
    {status === 'error' && <button type="button" className="ghost sm" onClick={retry}>Retry TaskFlow connection</button>}
    {ready && !data.quests.length && !data.events.length && <p>No open quests or Google Calendar events shared yet. Changes in TaskFlow appear here automatically.</p>}
    {ready && compact && data.quests.some(q=>!q.due) && <p className="mu">{data.quests.filter(q=>!q.due).length} quests have no due date. See them in <a href="#/tasks">Tasks</a>; add a date in TaskFlow to put them on this calendar.</p>}
    {ready && !compact && <><div className="taskflow-list">{data.quests.map(q=><article className="taskflow-item taskflow-priority" data-priority={q.tier === null ? undefined : 'P'+(q.tier+1)} key={q.id}><div className="taskflow-item-title"><b>{q.title}</b><span className="b">{q.tier === null ? 'Quest' : 'P'+(q.tier+1)}</span></div><p className="mu">{q.due || 'No due date'}{q.time ? ' · '+q.time+(data.tz ? ' '+data.tz : '') : ''}{q.repeat ? ' · Repeats '+q.repeat : ''}</p>{q.notes && <p className="taskflow-notes">{q.notes}</p>}{q.subtasks.length > 0 && <details><summary>Subtasks · {q.subtasks.filter(s=>s.done).length}/{q.subtasks.length} complete</summary><ul>{q.subtasks.map((s,i)=><li key={i}>{s.done ? '✓' : '○'} {s.title}</li>)}</ul></details>}</article>)}</div>
    {data.events.length > 0 && <p><a href="#/calendar">View {data.events.length} Google Calendar events →</a></p>}
    </>}
  </section>;
}
