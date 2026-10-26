// One deliberate horizontal touch gesture; vertical scrolling and long presses do nothing.
export function checklistSwipe(start, end) {
  if (!start || start.pointerId !== end.pointerId) return 0;
  const dx = end.clientX - start.x, dy = Math.abs(end.clientY - start.y);
  const duration = end.timeStamp - start.time;
  if (duration < 0 || duration > 800 || Math.abs(dx) < 48 || dy > 24 || Math.abs(dx) < dy * 2) return 0;
  return dx > 0 ? 1 : -1;
}
