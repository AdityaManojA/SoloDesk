// Local-date helpers for a month grid. All-day events retain their date in every timezone.
export const dateKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export const localDay = value => value.length === 10 ? value : dateKey(new Date(value));
export function matchesCalendarFilters(event, client='', type='') {
  return (!client || event.client?.id===client) && (!type || (type==='taskflow' ? event.source==='taskflow' : type==='task' ? ['task','taskflow-quest'].includes(event.type) : event.type===type));
}
export function monthDays(month) {
  const first = new Date(month + '-01T12:00:00');
  const start = new Date(first); start.setDate(1 - ((first.getDay() + 6) % 7));
  return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(d.getDate() + i); return dateKey(d); });
}
export function onDay(event, day) {
  if (event.allDay) return event.start <= day && event.end > day;
  const start = new Date(day + 'T00:00:00'), end = new Date(start); end.setDate(end.getDate() + 1);
  return Date.parse(event.start) < end.getTime() && Date.parse(event.end) > start.getTime();
}
export function shiftMonth(month, by) {
  const d = new Date(month + '-01T12:00:00'); d.setMonth(d.getMonth() + by); return dateKey(d).slice(0, 7);
}

// Browser-selected date ranges mean whole local days. API date filters remain UTC.
export function eventsInLocalRange(events, from='', through='') {
  const start = from ? new Date(from+'T00:00:00') : null;
  const end = through ? new Date(through+'T00:00:00') : null;
  if (end) end.setDate(end.getDate()+1);
  if ((start && !Number.isFinite(start.getTime())) || (end && !Number.isFinite(end.getTime())) || (from && through && from>through)) return [];
  return events.filter(event=>event.allDay
    ? (!from || event.end>from) && (!through || event.start<=through)
    : (!start || Date.parse(event.end)>start.getTime()) && (!end || Date.parse(event.start)<end.getTime()));
}

// Stable chronological presentation; a project span never hides timed work.
export function sortCalendarItems(items) {
  const rank = event => event.type==='project'?2:event.allDay?1:0;
  return [...items].sort((a,b)=>rank(a)-rank(b)||(a.allDay&&b.allDay?a.start.localeCompare(b.start):Date.parse(a.start)-Date.parse(b.start))||a.title.localeCompare(b.title)||a.id.localeCompare(b.id));
}
export function groupCalendarAgenda(items, month) {
  const groups=new Map();
  for(const event of items){
    // Spanning events appear once, on their start or the first visible month day.
    const date=localDay(event.start)<month+'-01'?month+'-01':localDay(event.start);
    if(!groups.has(date))groups.set(date,[]);
    groups.get(date).push(event);
  }
  return [...groups].sort(([a],[b])=>a.localeCompare(b)).map(([date,events])=>({date,events:sortCalendarItems(events)}));
}

// Count every source, including events beyond the three visible title previews.
export function calendarSourceCounts(items) {
  const sources=[['taskflow','TaskFlow'],['google','Google Calendar'],['projects','Projects'],['tasks','SoloDesk tasks']];
  const counts={taskflow:0,google:0,projects:0,tasks:0};
  for(const event of items) counts[event.type==='taskflow-event'?'google':event.type==='taskflow-quest'?'taskflow':event.type==='project'?'projects':'tasks']++;
  return sources.filter(([key])=>counts[key]).map(([key,label])=>({key,label,count:counts[key]}));
}
