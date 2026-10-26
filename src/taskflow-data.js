// Normalize Levern's public share document only; never read its internal chunks.
const text = value => typeof value === 'string' ? value : '';
const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && Number.isFinite(Date.parse(value + 'T00:00:00Z')) && new Date(value + 'T00:00:00Z').toISOString().slice(0,10) === value;
const instant = value => typeof value === 'string' && /T.*(?:Z|[+-]\d{2}:\d{2})$/i.test(value) && Number.isFinite(Date.parse(value));
const nextDay = value => new Date(Date.parse(value + 'T12:00:00Z') + 86400000).toISOString().slice(0,10);
export const TASKFLOW_URL = 'https://getlevern.web.app/';
const repeats = new Set(['daily','weekdays','weekly','monthly']);
export function safeEventUrl(value) { try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null; } catch { return null; } }
export function normalizeTaskflow(data) {
  let tz = null;
  try { if (typeof data?.tz === 'string') { new Intl.DateTimeFormat('en',{timeZone:data.tz}).format(); tz = data.tz; } } catch { /* Preserve an unknown timezone rather than inventing an instant. */ }
  const unique = rows => [...new Map(rows.map(row => [row.id,row])).values()];
  const quests = unique((Array.isArray(data?.quests) ? data.quests : []).filter(q => q && typeof q.id === 'string' && q.id && text(q.title).trim()).map(q => ({
    id:q.id,title:q.title.trim(),tier:Number.isInteger(q.tier) && q.tier >= 0 && q.tier <= 5 ? q.tier : null,
    due:validDate(q.due) ? q.due : null,time:/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(q.time || '') ? q.time : null,
    repeat:repeats.has(q.repeat) ? q.repeat : null,notes:text(q.notes),
    subtasks:(Array.isArray(q.subtasks) ? q.subtasks : []).filter(s => s && text(s.title).trim()).map(s => ({title:s.title,done:s.done === true})),updatedAt:q.updatedAt ?? null,
  })));
  const events = unique((Array.isArray(data?.events) ? data.events : []).filter(e => e && typeof e.id === 'string' && e.id && text(e.title).trim()).flatMap(e => {
    const allDay = e.allDay === true;
    if (allDay ? !validDate(e.start) || !validDate(e.end) || e.end <= e.start : !instant(e.start) || !instant(e.end) || Date.parse(e.end) <= Date.parse(e.start)) return [];
    return [{id:e.id,title:e.title.trim(),tier:Number.isInteger(e.tier) && e.tier >= 0 && e.tier <= 5 ? e.tier : null,allDay,start:allDay ? e.start : new Date(e.start).toISOString(),end:allDay ? e.end : new Date(e.end).toISOString(),where:text(e.where),url:safeEventUrl(e.url)}];
  }));
  return {quests,events,tz,updatedAt:data?.updatedAt ?? null};
}

// Convert a quest's local due time with its own timezone, independent of this browser.
// Round-trip validation rejects nonexistent daylight-saving times.
export function questInstant(day, time, timeZone) {
  if (!validDate(day) || !timeZone || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time || '')) return null;
  const target = Date.parse(day + 'T' + time + ':00Z');
  const formatter = new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
  let candidate = target;
  for (let i=0;i<4;i++) {
    const p = Object.fromEntries(formatter.formatToParts(new Date(candidate)).map(part => [part.type,part.value]));
    const represented = Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`);
    const difference = target - represented;
    if (!difference) return new Date(candidate).toISOString();
    candidate += difference;
  }
  return null;
}

export function taskflowCalendarEvents(feed) {
  if (!feed) return [];
  const quests = feed.quests.filter(q => q.due).map(q => {
    const start = q.time ? questInstant(q.due,q.time,feed.tz) : null;
    return {id:'taskflow-quest-'+q.id,type:'taskflow-quest',source:'taskflow',sourceId:q.id,title:q.title,
      start:start || q.due,end:start ? new Date(Date.parse(start)+60000).toISOString() : nextDay(q.due),allDay:!start,
      availability:'free',durationMinutes:start ? 1 : null,priority:q.tier === null ? null : 'P'+(q.tier+1),
      description:['Levern quest',q.tier === null ? '' : 'P'+(q.tier+1),q.repeat ? 'Repeats '+q.repeat : '',q.time ? `Due ${q.time} (${feed.tz || 'timezone unavailable'})` : '',q.time && !start ? 'Shown as an all-day reminder; due time could not be resolved.' : '',q.notes].filter(Boolean).join(' · '),
      path:'/tasks',url:TASKFLOW_URL,reminder:true};
  });
  const events = feed.events.map(e => ({...e,id:'taskflow-event-'+e.id,sourceId:e.id,type:'taskflow-event',source:'taskflow',priority:e.tier == null ? null : 'P'+(e.tier+1),availability:'busy',durationMinutes:e.allDay ? null : Math.round((Date.parse(e.end)-Date.parse(e.start))/60000),description:['Google Calendar via Levern',e.where].filter(Boolean).join(' · '),path:'/calendar',url:e.url || TASKFLOW_URL}));
  return [...quests,...events].sort((a,b)=>a.start.localeCompare(b.start)||a.id.localeCompare(b.id));
}

export const emptyTaskflow = () => ({quests:[],events:[],tz:null,updatedAt:null});
