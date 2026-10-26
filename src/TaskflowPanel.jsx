import { TASKFLOW_URL } from './taskflow-data';
import './taskflow-feed.css';

export function TaskflowStatus({taskflow}){
  const {status,data,cached,retry,error}=taskflow;
  const message=status==='ready'?`${cached?'Cached Levern data':'Levern connected'} · ${data.quests.length} quests · ${data.events.length} Google events · Read-only`:status==='error'?error:status==='loading'?'Connecting to Levern…':status==='demo'?'Demo workspace · Levern connects after sign-in.':status==='missing'?'No Levern data shared with this account yet.':'Sign in with your Levern account to connect.';
  return <section className="source-status" aria-label="Calendar sources"><p role="status">{message}</p>{status==='error'&&<button type="button" className="ghost sm" onClick={retry}>Retry</button>}<a href="#/integrations" className="ghost sm">Manage sources</a></section>;
}

export default function TaskflowPanel({ taskflow, compact = false }) {
  const {status,data,error,retry} = taskflow;
  const ready = status === 'ready';
  return <section className="card taskflow-feed" aria-label="From Levern"><div className="section-head"><h3>from levern</h3><a className="ghost sm" href={TASKFLOW_URL} target="_blank" rel="noopener noreferrer">Open Levern ↗</a></div>
    {status === 'demo' && <p className="mu">Sign in to see your Levern quests.</p>}
    {status === 'loading' && <p className="mu" role="status">Connecting…</p>}
    {status === 'missing' && <p className="mu">Nothing from Levern yet.</p>}
    {status === 'error' && <p className="mu" role="status">{error} <button type="button" className="ghost sm" onClick={retry}>Retry</button></p>}
    {ready && !data.quests.length && <p className="mu">No open quests.</p>}
    {ready && !compact && data.quests.length > 0 && <div className="taskflow-list">{data.quests.map(q=><article className="taskflow-item taskflow-priority" data-priority={q.tier === null ? undefined : 'P'+(q.tier+1)} key={q.id}><div className="taskflow-item-title"><b>{q.title}</b>{q.tier !== null && <span className="b">{'P'+(q.tier+1)}</span>}</div><p className="mu">{q.due || 'No due date'}{q.time ? ' · '+q.time : ''}{q.repeat ? ' · Repeats '+q.repeat : ''}</p>{q.subtasks.length > 0 && <p className="mu">{q.subtasks.filter(x=>x.done).length}/{q.subtasks.length} subtasks</p>}</article>)}</div>}
    {ready && compact && data.quests.length > 0 && <p className="mu">{data.quests.length} open {data.quests.length === 1 ? 'quest' : 'quests'}</p>}
  </section>;
}
