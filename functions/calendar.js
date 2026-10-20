// Shared by the browser export and the authenticated calendar API.
const isDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && !Number.isNaN(Date.parse(value)) && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value;
const nextDate = value => new Date(Date.parse(value + 'T12:00:00Z') + 86400000).toISOString().slice(0, 10);
const isInstant = value => typeof value === 'string' && /T/.test(value) && Number.isFinite(Date.parse(value));

export function calendarEvents(workspace, { from, to, includeCompleted = false } = {}) {
  const client = id => workspace.clients?.find(c => c.id === id);
  const project = id => workspace.projects?.find(p => p.id === id);
  const events = [];
  for (const p of workspace.projects || []) {
    if (!includeCompleted && (p.status === 'Complete'||p.arch)) continue;
    const start = isDate(p.start) ? p.start : isDate(p.end) ? p.end : null;
    const end = isDate(p.end) ? p.end : start;
    if (!start || end < start) continue;
    events.push({ id: `project-${p.id}`, type: 'project', title: p.name, start, end: nextDate(end), allDay: true, availability: 'free', status: p.status, client: client(p.client) ? { id: p.client, name: client(p.client).name } : null, projectId: p.id, description: `Project timeline${client(p.client) ? ' · ' + client(p.client).name : ''}`, path: '/projects' });
  }
  for (const task of workspace.tasks || []) {
    if (!includeCompleted && (task.status === 'Done'||task.arch)) continue;
    const scheduled = isInstant(task.scheduledAt), due = isDate(task.due);
    if (!scheduled && !due) continue;
    const durationMinutes = Math.min(1440, Math.max(5, Number(task.durationMinutes) || 60));
    const start = scheduled ? new Date(task.scheduledAt).toISOString() : task.due;
    const end = scheduled ? new Date(Date.parse(start) + durationMinutes * 60000).toISOString() : nextDate(task.due);
    const linked = project(task.project), owner = client(task.client || linked?.client);
    events.push({ id: `task-${task.id}`, type: 'task', title: task.title, start, end, allDay: !scheduled, availability: scheduled ? 'busy' : 'free', durationMinutes: scheduled ? durationMinutes : null, due: task.due || null, priority: task.priority || null, status: task.status, client: owner ? { id: owner.id, name: owner.name } : null, projectId: task.project || null, projectName: linked?.name || null, description: [owner?.name, linked?.name, task.priority ? task.priority + ' priority' : '', task.due ? 'Due ' + task.due : ''].filter(Boolean).join(' · '), path: '/tasks/' + encodeURIComponent(task.id) });
  }
  // End is exclusive, matching RFC 5545 and calendar event APIs.
  return events.filter(event => (!from || Date.parse(event.end) > Date.parse(from)) && (!to || event.start.slice(0, 10) <= to)).sort((a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id));
}

const escape = value => String(value || '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\r/g, '');
const stamp = value => new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
// Fold UTF-8 content lines at 75 octets without splitting a multibyte character.
function fold(line) {
  const encoder = new TextEncoder(); let result = '', current = '', bytes = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    if (bytes + size > 75) { result += current + '\r\n'; current = ' '; bytes = 1; }
    current += char; bytes += size;
  }
  return result + current;
}
export function calendarIcs(events, { namespace = 'local', now = new Date(), origin = '' } = {}) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//SoloDesk//Workspace calendar//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:SoloDesk'];
  for (const event of events) {
    lines.push('BEGIN:VEVENT', `UID:${escape(namespace)}-${escape(event.id)}@solodesk`, `DTSTAMP:${stamp(now)}`, `SUMMARY:${escape(event.title)}`, `DESCRIPTION:${escape(event.description)}`);
    if (event.allDay) lines.push('DTSTART;VALUE=DATE:' + event.start.replace(/-/g, ''), 'DTEND;VALUE=DATE:' + event.end.replace(/-/g, ''));
    else lines.push('DTSTART:' + stamp(event.start), 'DTEND:' + stamp(event.end));
    if (event.where) lines.push('LOCATION:' + escape(event.where));
    if (/^https?:\/\//.test(origin)) lines.push('URL:' + escape(origin.replace(/\/$/, '') + '/#' + event.path));
    lines.push('STATUS:CONFIRMED', event.availability === 'busy' ? 'TRANSP:OPAQUE' : 'TRANSP:TRANSPARENT', 'END:VEVENT');
  }
  return [...lines, 'END:VCALENDAR'].map(fold).join('\r\n') + '\r\n';
}
