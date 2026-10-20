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
