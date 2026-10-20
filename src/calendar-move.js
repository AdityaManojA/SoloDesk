import { localDay } from './calendar-view.js';

const validDay = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && value.slice(0,4) !== '0000' && Number.isFinite(Date.parse(value + 'T12:00:00Z')) && new Date(value + 'T12:00:00Z').toISOString().slice(0,10) === value;
const shiftDay = (value, delta) => {
  if (!validDay(value)) throw new Error('This item has an invalid date. Edit it before moving it.');
  const date = new Date(value + 'T12:00:00Z');
  date.setUTCDate(date.getUTCDate() + delta);
  const result = date.toISOString().slice(0,10);
  if (!validDay(result)) throw new Error('Choose a date between years 0001 and 9999.');
  return result;
};

// Move by calendar days rather than 24-hour intervals, preserving local clock time across DST.
// fromDay is the cell grabbed, so dragging the middle of a project keeps its span intact.
export function moveCalendarItem(workspace, eventId, fromDay, toDay) {
  if (!validDay(fromDay) || !validDay(toDay)) throw new Error('Choose a valid calendar date.');
  const delta = Math.round((Date.parse(toDay + 'T12:00:00Z') - Date.parse(fromDay + 'T12:00:00Z')) / 86400000);
  let record, patch;
  if (eventId.startsWith('task-')) {
    record = workspace.tasks.find(item => 'task-' + item.id === eventId);
    if (!record) throw new Error('This task is no longer available.');
    patch = {};
    if (record.scheduledAt) {
      const date = new Date(record.scheduledAt);
      if (!Number.isFinite(date.getTime())) throw new Error('Edit this task’s invalid time before moving it.');
      const time = [date.getHours(),date.getMinutes()];
      const target = shiftDay(localDay(record.scheduledAt), delta);
      const moved = new Date(date);
      const [year,month,day] = target.split('-').map(Number);
      moved.setFullYear(year,month-1,day);
      if (moved.getHours() !== time[0] || moved.getMinutes() !== time[1]) throw new Error('That time does not exist on this date because of daylight saving. Choose a time in Edit task.');
      patch.scheduledAt = moved.toISOString();
    }
    if (record.due) patch.due = shiftDay(record.due, delta);
    if (!Object.keys(patch).length) throw new Error('Schedule this task before moving it.');
  } else if (eventId.startsWith('project-')) {
    record = workspace.projects.find(item => 'project-' + item.id === eventId);
    if (!record) throw new Error('This project is no longer available.');
    patch = {};
    if (record.start) patch.start = shiftDay(record.start, delta);
    if (record.end) patch.end = shiftDay(record.end, delta);
    if (!Object.keys(patch).length) throw new Error('Add dates to this project before moving it.');
  } else throw new Error('TaskFlow items must be moved in their source app.');
  if (!delta) return false;
  Object.assign(record, patch);
  return true;
}
