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
  const sources=[['taskflow','TaskFlow'],['google','Google Calendar'],['projects','Projects'],['tasks','Terracove tasks']];
  const counts={taskflow:0,google:0,projects:0,tasks:0};
  for(const event of items) counts[event.type==='taskflow-event'?'google':event.type==='taskflow-quest'?'taskflow':event.type==='project'?'projects':'tasks']++;
  return sources.filter(([key])=>counts[key]).map(([key,label])=>({key,label,count:counts[key]}));
}

// ---------- 1.03 calendar: zoom levels, spanning bars and timed layout ----------
const dayNumber = key => Date.UTC(+key.slice(0, 4), +key.slice(5, 7) - 1, +key.slice(8, 10)) / 864e5;
export const addDaysKey = (day, n) => { const d = new Date(day + 'T12:00:00'); d.setDate(d.getDate() + n); return dateKey(d); };
export const ZOOMS = ['year', 'month', 'week', 'day'];
export const weekStartKey = day => addDaysKey(day, -((new Date(day + 'T12:00:00').getDay() + 6) % 7));

// The visible period for a zoom level. End is exclusive.
export function zoomRange(zoom, day) {
  if (zoom === 'year') { const y = +day.slice(0, 4); return { start: y + '-01-01', end: (y + 1) + '-01-01' }; }
  if (zoom === 'month') { const m = day.slice(0, 7); return { start: m + '-01', end: shiftMonth(m, 1) + '-01' }; }
  if (zoom === 'week') { const s = weekStartKey(day); return { start: s, end: addDaysKey(s, 7) }; }
  return { start: day, end: addDaysKey(day, 1) };
}
export function shiftZoom(zoom, day, by) {
  if (zoom === 'year' || zoom === 'month') {
    const d = new Date(day.slice(0, 7) + '-01T12:00:00'); d.setMonth(d.getMonth() + by * (zoom === 'year' ? 12 : 1));
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    return dateKey(d).slice(0, 8) + String(Math.min(+day.slice(8, 10), last)).padStart(2, '0');
  }
  return addDaysKey(day, by * (zoom === 'week' ? 7 : 1));
}

// All-day items spanning a row of consecutive days, packed into the fewest lanes (like Google Calendar).
export function spanLanes(items, days) {
  const first = days[0], last = days[days.length - 1], ends = [], placed = [];
  for (const event of [...items].sort((a, b) => a.start.localeCompare(b.start) || b.end.localeCompare(a.end) || a.id.localeCompare(b.id))) {
    const lastDay = addDaysKey(event.end, -1);
    if (lastDay < first || event.start > last) continue;
    const from = event.start < first ? first : event.start, to = lastDay > last ? last : lastDay;
    const col = days.indexOf(from), span = days.indexOf(to) - col + 1;
    let lane = ends.findIndex(end => end < col);
    if (lane < 0) { lane = ends.length; ends.push(-1); }
    ends[lane] = col + span - 1;
    placed.push({ event, col, span, lane, before: event.start < first, after: lastDay > last });
  }
  return placed;
}

// Position of a dated span inside a period, as fractions of its width.
export function rangeFraction(start, endExclusive, range) {
  const s = Math.max(dayNumber(start), dayNumber(range.start)), e = Math.min(dayNumber(endExclusive), dayNumber(range.end)), total = dayNumber(range.end) - dayNumber(range.start);
  if (e <= s) return null;
  return { left: (s - dayNumber(range.start)) / total, width: (e - s) / total, before: dayNumber(start) < dayNumber(range.start), after: dayNumber(endExclusive) > dayNumber(range.end) };
}

// Timed events in one day column: minutes from midnight, with side-by-side columns for overlaps.
export function layoutTimed(events, day) {
  const dayStart = new Date(day + 'T00:00:00').getTime(), dayEnd = new Date(addDaysKey(day, 1) + 'T00:00:00').getTime();
  const rows = events.filter(e => !e.allDay && Date.parse(e.start) < dayEnd && Date.parse(e.end) > dayStart)
    .map(e => { const s = Math.max(Date.parse(e.start), dayStart), en = Math.min(Math.max(Date.parse(e.end), s + 15 * 60000), dayEnd); return { event: e, top: (s - dayStart) / 60000, height: (en - s) / 60000 }; })
    .sort((a, b) => a.top - b.top || b.height - a.height);
  let cluster = [], clusterEnd = -1;
  const finish = () => { const cols = []; for (const r of cluster) { let c = cols.findIndex(end => end <= r.top); if (c < 0) { c = cols.length; cols.push(0); } cols[c] = r.top + r.height; r.col = c; } for (const r of cluster) r.cols = cols.length; };
  for (const r of rows) { if (r.top >= clusterEnd && cluster.length) { finish(); cluster = []; } cluster.push(r); clusterEnd = Math.max(clusterEnd, r.top + r.height); }
  if (cluster.length) finish();
  return rows;
}

// How full a day is: everything on it (project timelines, tasks, deadlines, TaskFlow items) and how many
// different clients are involved. Levels drive the free / light / busy / packed colours.
export function dayLoad(events, day) {
  const items = events.filter(e => onDay(e, day));
  const clients = new Set(items.map(e => e.client?.id).filter(Boolean));
  const count = items.length;
  return { count, clients: clients.size, projects: items.filter(e => e.type === 'project').length, level: count === 0 ? 'free' : count <= 2 ? 'light' : count <= 4 ? 'busy' : 'packed' };
}
