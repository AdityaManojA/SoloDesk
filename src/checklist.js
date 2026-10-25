// Nested checklists, like Apple Notes: each item has a level (0 = top). Tab indents under the item above,
// Shift+Tab outdents, and an item's sub-items move and tick with it. Items keep their order when ticked.
export const MAX_LEVEL = 4;
const lv = x => x.level || 0;

// Index just past an item's sub-items.
export function subtreeEnd(items, i) {
  let j = i + 1;
  while (j < items.length && lv(items[j]) > lv(items[i])) j++;
  return j;
}

// No item may sit more than one level deeper than the item above it.
export function normalize(items) {
  let prev = -1;
  return items.map(x => { const l = Math.max(0, Math.min(lv(x), prev + 1, MAX_LEVEL)); prev = l; return l === lv(x) ? x : { ...x, level: l }; });
}

export function shiftLevel(items, id, delta) {
  const i = items.findIndex(x => x.id === id);
  if (i < 0) return items;
  const cur = lv(items[i]), max = i === 0 ? 0 : Math.min(MAX_LEVEL, lv(items[i - 1]) + 1), next = Math.max(0, Math.min(max, cur + delta));
  if (next === cur) return items;
  const end = subtreeEnd(items, i), shift = next - cur;
  return normalize(items.map((x, j) => j >= i && j < end ? { ...x, level: Math.max(0, Math.min(MAX_LEVEL, lv(x) + shift)) } : x));
}

export function toggleItem(items, id) {
  const i = items.findIndex(x => x.id === id);
  if (i < 0) return items;
  const done = !items[i].done, end = subtreeEnd(items, i);
  return items.map((x, j) => j >= i && j < end ? { ...x, done } : x);
}

export function insertAfter(items, id, item) {
  const i = items.findIndex(x => x.id === id);
  const level = i < 0 ? 0 : lv(items[i]);
  return [...items.slice(0, i + 1), { done: false, ...item, level }, ...items.slice(i + 1)];
}

export function removeItem(items, id) { return normalize(items.filter(x => x.id !== id)); }

// Plain text ↔ checklist. Two spaces (or a tab) of indentation per level.
export function linesToItems(text, makeId) {
  return text.split('\n').map(line => {
    const indent = (line.match(/^[ \t]*/)[0].replace(/\t/g, '  ').length) >> 1;
    const title = line.trim().replace(/^[-*•☐☑]\s*/, '').trim();
    return title ? { id: makeId(), title, done: /^\s*☑/.test(line), level: Math.min(indent, MAX_LEVEL) } : null;
  }).filter(Boolean).reduce((list, x) => normalize([...list, x]), []);
}
export function itemsToLines(items) { return items.filter(x => x.title).map(x => '  '.repeat(lv(x)) + x.title).join('\n'); }
