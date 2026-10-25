// Smart entry, shared with TaskFlow: "Call Ava tomorrow at 7pm for Website launch" fills in the date, time,
// client and project. parseWhen is a port of TaskFlow's parseQuest (TaskFlow-controls/app/js/parse.js);
// keep the two in step when the wording rules change. parseTask and suggest add SoloDesk's clients and projects.

const pad = n => String(n).padStart(2, '0');
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const toStr = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromStr = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = fromStr(s); d.setDate(d.getDate() + n); return toStr(d); };
const addMonths = (s, n) => { const d = fromStr(s), day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + n); d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate())); return toStr(d); };
const diffDays = (a, b) => Math.round((fromStr(b) - fromStr(a)) / 86400000);
const weekday = s => fromStr(s).getDay();

const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const DAY_CORE = 'sun|mon|tue|tues|wed|weds|thu|thur|thurs|fri|sat';
const DAY_NC = `(?:${DAY_CORE})(?:day|nesday|sday|urday|rsday)?s?`;
const DAY_RE = `(${DAY_CORE})(?:day|nesday|sday|urday|rsday)?s?`;
const MONTH_RE = '(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*';
const dayIndex = w => DAYS.indexOf(w.slice(0, 3).toLowerCase());
const monthIndex = m => MONTHS.findIndex(x => x.toLowerCase() === m.slice(0, 3).toLowerCase());
const NUMW = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, forty: 40, fifty: 50 };
const numVal = s => { const w = String(s).toLowerCase().split(/[ -]/); if (w.length === 2) return (NUMW[w[0]] ?? 0) + (NUMW[w[1]] ?? 0); return /^\d+$/.test(w[0]) ? +w[0] : NUMW[w[0]]; };
const HOUR_RE = '(?:\\d{1,2}|twelve|eleven|ten|nine|eight|seven|six|five|four|three|two|one)';
const MIN_RE = '(?:\\d{2}|fifteen|thirty|forty[ -]five|forty|fifty|twenty|ten|five)';
const AMPM = '(am|pm|a\\.m\\.|p\\.m\\.)';
const inferHour = h => (h >= 1 && h <= 6) || h === 12 ? (h % 12) + 12 : h;

const KEYWORDS = [
  [/\b(urgent(?:ly)?|asap|a\.s\.a\.p\.?|critical|emergenc(?:y|ies)|immediately|right now|top priority|can'?t wait|do first|important)\b/i, 0],
  [/\b(priority|pressing|essential|vital|crucial|high priority|time[- ]sensitive|soon|key)\b/i, 1],
  [/\b(someday|sometime|maybe|eventually|one day|nice to have|low priority|whenever)\b/i, 5],
];
function nextWeekday(today, wd, strictlyAfter) { let n = (wd - weekday(today) + 7) % 7; if (n === 0 && strictlyAfter) n = 7; return addDays(today, n); }
function dateFromDayMonth(today, d, m) { const y = +today.slice(0, 4); let s = toStr(new Date(y, m, d)); if (s < today) s = toStr(new Date(y + 1, m, d)); return s; }
const lastDayOfMonth = today => toStr(new Date(+today.slice(0, 4), +today.slice(5, 7), 0));
const REPEAT_RULES = [
  ['alternate', /\balternate\s+days?\b|\bevery\s+(?:other|second)\s+days?\b|\bevery\s+(?:2|two)\s+days\b/i],
  ['daily', /\bevery\s*day\b|\beveryday\b|\bdaily\b|\b(?:every|each)\s+(?:morning|evening|night|afternoon)\b/i],
  ['weekdays', /\bweekdays?\b|\bon\s+weekdays\b|\bduring the week\b|\bmon(?:day)?\s*(?:-|to|through|until)\s*fri(?:day)?\b/i],
  ['weekly', /\b(?:every|each|per)\s+week\b|\bweekly\b/i],
  ['monthly', /\b(?:every|each|per)\s+month\b|\bmonthly\b/i],
  ['yearly', /\b(?:every|each|per)\s+year\b|\byearly\b|\bannually\b|\bonce a year\b/i],
];
const DAY_LIST_RE = new RegExp(`\\b(?:every|each|on)\\s+(${DAY_NC}(?:\\s*(?:,|and|&|/|\\+|or)\\s*${DAY_NC})+)\\b`, 'i');
const DAY_EVERY_RE = new RegExp(`\\b(?:every|each)\\s+${DAY_RE}\\b|\\bon\\s+(?:${DAY_CORE})(?:day|nesday|sday|urday|rsday)s\\b`, 'i');

// Dates, times, repeats and priority words. Returns the leftover text as the title, plus chips naming what was read.
export function parseWhen(text, now = new Date()) {
  const today = toStr(now);
  let rest = ' ' + text + ' ';
  const chips = [];
  let due = null, time = null, tier = null, repeat = null;
  const take = (re, fn) => { const m = rest.match(re); if (!m) return false; if (fn(m) === false) return false; rest = rest.slice(0, m.index) + ' ' + rest.slice(m.index + m[0].length); return true; };
  const lead = '(?:\\b(?:due|by|on|before|for|this)\\s+)?';
  const setTime = (hm, m) => { time = hm; chips.push({ kind: 'time', text: m[0].trim() }); };
  const PRI = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
  take(/(?:^|\s)(?:p|!|priority\s*)([1-4]|one|two|three|four)\b/i, m => { const n = PRI[m[1].toLowerCase()] ?? +m[1]; tier = n - 1; chips.push({ kind: 'tier', text: `P${n}` }); });
  const repeatHit = (freq, m) => { repeat = { freq }; chips.push({ kind: 'repeat', text: m[0].trim() }); };
  take(DAY_LIST_RE, m => {
    const days = [...new Set([...m[1].matchAll(new RegExp(DAY_RE, 'gi'))].map(d => dayIndex(d[1])))].sort((a, b) => a - b);
    if (days.length < 2) return false;
    repeat = { freq: 'custom', days }; due = days.map(d => nextWeekday(today, d, false)).sort()[0]; chips.push({ kind: 'repeat', text: m[0].trim() });
  });
  for (const [freq, re] of REPEAT_RULES) { if (repeat) break; take(re, m => repeatHit(freq, m)); }
  if (!repeat) take(DAY_EVERY_RE, m => { const day = m[0].match(new RegExp(DAY_RE, 'i')); repeat = { freq: 'weekly' }; due = nextWeekday(today, dayIndex(day[1]), false); chips.push({ kind: 'repeat', text: m[0].trim() }); });

  take(new RegExp(`\\b(?:at\\s+)?(quarter|half)\\s+(past|to)\\s+(${HOUR_RE})(?:\\s*${AMPM}(?![a-z]))?`, 'i'), m => {
    let h = numVal(m[3]); if (!m[4]) h = inferHour(h); else if (/^p/i.test(m[4])) h = h % 12 + 12; else h = h % 12;
    let min = m[1].toLowerCase() === 'half' ? 30 : 15; if (m[2].toLowerCase() === 'to') { min = 60 - min; h -= 1; }
    if (h < 0 || h > 23) return false; setTime(`${pad(h)}:${pad(min)}`, m);
  })
  || take(new RegExp(`\\b(?:at\\s+)?(${HOUR_RE})(?:(?::|\\s+)(${MIN_RE}))?\\s*${AMPM}(?![a-z])`, 'i'), m => {
    const h0 = numVal(m[1]); if (h0 === undefined || h0 > 12) return false; const min = m[2] ? numVal(m[2]) : 0; if (min > 59) return false;
    setTime(`${pad((h0 % 12) + (/^p/i.test(m[3]) ? 12 : 0))}:${pad(min)}`, m);
  })
  || take(new RegExp(`\\b(?:at\\s+)?(${HOUR_RE})\\s*o['’]?\\s?clock\\b`, 'i'), m => { const h = numVal(m[1]); if (h === undefined || h > 12) return false; setTime(`${pad(inferHour(h))}:00`, m); })
  || take(/\b(?:at\s+)?(noon|midnight)\b/i, m => setTime(m[1].toLowerCase() === 'noon' ? '12:00' : '00:00', m))
  || take(/\b(?:by\s+)?(eod|end of (?:the )?day)\b/i, m => setTime('17:00', m))
  || take(/\b(?:at\s+)?([01]?\d|2[0-3]):([0-5]\d)\b/i, m => setTime(`${m[1].padStart(2, '0')}:${m[2]}`, m))
  || take(new RegExp(`\\bat\\s+(${HOUR_RE})\\b(?!\\s*(?:%|days?|weeks?|months?|hours?|mins?|minutes?|people|items?|x\\b))`, 'i'), m => { const h = numVal(m[1]); if (h === undefined || h < 1 || h > 12) return false; setTime(`${pad(inferHour(h))}:00`, m); });

  const setDue = (s, m) => { due = s; chips.push({ kind: 'date', text: m[0].trim() }); };
  if (!due) take(new RegExp(`${lead}\\btonight\\b`, 'i'), m => { setDue(today, m); if (!time) time = '20:00'; })
    || take(new RegExp(`${lead}\\b(today|later today)\\b`, 'i'), m => setDue(today, m))
    || take(new RegExp(`${lead}\\bday after tomorrow\\b`, 'i'), m => setDue(addDays(today, 2), m))
    || take(new RegExp(`${lead}\\b(tomorrow|tmrw|tmr)\\b`, 'i'), m => setDue(addDays(today, 1), m))
    || take(new RegExp(`${lead}\\b(\\d{4})-(\\d{2})-(\\d{2})\\b`), m => { const s = `${m[1]}-${m[2]}-${m[3]}`; if (isNaN(Date.parse(s))) return false; setDue(s, m); })
    || take(new RegExp(`${lead}\\bin\\s+(\\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten)\\s+(day|week|month)s?\\b`, 'i'), m => { const n = { a: 1, an: 1 }[m[1].toLowerCase()] ?? numVal(m[1]); const unit = m[2].toLowerCase(); setDue(unit === 'month' ? addMonths(today, n) : addDays(today, n * (unit === 'week' ? 7 : 1)), m); })
    || take(new RegExp(`${lead}\\bin a couple (?:of )?days\\b`, 'i'), m => setDue(addDays(today, 2), m))
    || take(new RegExp(`${lead}\\bin a fortnight\\b|\\bfortnight\\b`, 'i'), m => setDue(addDays(today, 14), m))
    || take(new RegExp(`${lead}\\bnext\\s+week\\b`, 'i'), m => setDue(nextWeekday(today, 1, true), m))
    || take(new RegExp(`${lead}\\bnext\\s+month\\b`, 'i'), m => setDue(addMonths(today, 1), m))
    || take(new RegExp(`${lead}\\bend of (?:the )?week\\b|\\beow\\b`, 'i'), m => setDue(nextWeekday(today, 5, false), m))
    || take(new RegExp(`${lead}\\bend of (?:the )?month\\b|\\beom\\b`, 'i'), m => setDue(lastDayOfMonth(today), m))
    || take(new RegExp(`${lead}\\bnext\\s+weekend\\b`, 'i'), m => setDue(nextWeekday(today, 6, true), m))
    || take(new RegExp(`${lead}\\b(?:this\\s+)?weekend\\b`, 'i'), m => setDue(nextWeekday(today, 6, false), m))
    || take(new RegExp(`${lead}\\bnext\\s+${DAY_RE}\\b`, 'i'), m => setDue(nextWeekday(today, dayIndex(m[1]), true), m))
    || take(new RegExp(`${lead}\\b${DAY_RE}\\b`, 'i'), m => setDue(nextWeekday(today, dayIndex(m[1]), false), m))
    || take(new RegExp(`${lead}\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH_RE}\\b`, 'i'), m => setDue(dateFromDayMonth(today, +m[1], monthIndex(m[2])), m))
    || take(new RegExp(`${lead}\\b${MONTH_RE}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`, 'i'), m => setDue(dateFromDayMonth(today, +m[2], monthIndex(m[1])), m))
    || take(new RegExp(`${lead}\\b(\\d{1,2})/(\\d{1,2})\\b`), m => { if (+m[2] < 1 || +m[2] > 12 || +m[1] < 1 || +m[1] > 31) return false; setDue(dateFromDayMonth(today, +m[1], +m[2] - 1), m); });
  if (time && !due) { const [h, mi] = time.split(':').map(Number); due = h * 60 + mi > now.getHours() * 60 + now.getMinutes() ? today : addDays(today, 1); }
  if (repeat && !due) due = today;
  if (tier === null) for (const [re, t] of KEYWORDS) { const m = rest.match(re); if (m) { tier = t; chips.push({ kind: 'keyword', text: m[0] }); break; } }
  let title = tidy(rest);
  // "Fix login urgent" → "Fix login"; a priority word in the middle of a sentence stays.
  const kw = chips.find(c => c.kind === 'keyword');
  if (kw) title = title.replace(new RegExp(`^${escapeRe(kw.text)}[\\s:,–-]+|[\\s,–-]+${escapeRe(kw.text)}[.!]*$`, 'i'), '').trim();
  return { title: title || text.trim(), due, time, tier, repeat, chips };
}
const tidy = s => s.replace(/\s+/g, ' ').replace(/\s+([,.;:!?])/g, '$1').replace(/^[\s,.;:–-]+|[\s,.;:–-]+$/g, '').replace(/\s+(due|by|on|at|for|before|with|from|to|until)$/i, '').trim();

const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// The longest client or project name that appears in the text as whole words, optionally after for/with/@/#.
function findName(text, items, nameOf) {
  let best = null;
  for (const item of items) {
    const name = String(nameOf(item) || '').trim();
    if (name.length < 2) continue;
    const m = text.match(new RegExp(`(?:^|\\s)((?:(?:for|with|re|about|on)\\s+)?[@#]?${escapeRe(name)})(?=$|[\\s,.;:!?])`, 'i'));
    if (m && (!best || name.length > best.name.length)) best = { item, name, index: m.index + m[0].indexOf(m[1]), length: m[1].length };
  }
  return best;
}

// SoloDesk priorities. Only words or P1–P4 set one; a date alone does not.
const PRIORITY = [ 'High', 'High', 'Medium', 'Low', 'Low', 'Low' ];
const REPEATS = new Set(['daily', 'weekdays', 'weekly', 'monthly']);

// A task typed in one line → the form's fields. Workspace is used to recognise clients and projects.
export function parseTask(text, workspace = {}, now = new Date()) {
  let rest = String(text || '');
  const chips = [];
  const projects = (workspace.projects || []).filter(p => p.status !== 'Complete'), clients = (workspace.clients || []).filter(c => !c.arch);
  let project = '', client = '';
  const cut = hit => { rest = rest.slice(0, hit.index) + ' ' + rest.slice(hit.index + hit.length); };
  const p = findName(rest, projects, x => x.name);
  if (p) { project = p.item.id; client = p.item.client || ''; cut(p); chips.push({ kind: 'project', text: p.item.name }); }
  const c = findName(rest, clients, x => x.name);
  if (c && (!client || client === c.item.id)) { client = c.item.id; cut(c); chips.push({ kind: 'client', text: c.item.name }); }
  else if (client) { const owner = clients.find(x => x.id === client); if (owner) chips.push({ kind: 'client', text: owner.name, implied: true }); }
  const when = parseWhen(rest, now);
  const priority = when.tier === null ? '' : PRIORITY[when.tier];
  const repeat = when.repeat && REPEATS.has(when.repeat.freq) ? when.repeat.freq : '';
  for (const chip of when.chips) if (chip.kind !== 'repeat' || repeat) chips.push(chip);
  return { title: when.chips.length || project || client ? when.title : String(text || '').trim(), due: when.due || '', time: when.time || '', priority, repeat, client, project, chips };
}

// A project in one line: "Website launch for Ava from Nov 3 to Dec 20".
export function parseProject(text, workspace = {}, now = new Date()) {
  let rest = String(text || '');
  const chips = [];
  let client = '', start = '', end = '';
  const c = findName(rest, (workspace.clients || []).filter(x => !x.arch), x => x.name);
  if (c) { client = c.item.id; rest = rest.slice(0, c.index) + ' ' + rest.slice(c.index + c.length); chips.push({ kind: 'client', text: c.item.name }); }
  const range = rest.match(/\b(?:from|starting|starts|start)\s+(.+?)\s+(?:to|until|till|through|-|–)\s+(.+?)$/i);
  const one = phrase => { const r = parseWhen(phrase, now); return r.due && !r.title.replace(/[\s,.]/g, '') ? r.due : r.due && r.chips.length ? r.due : ''; };
  if (range) {
    start = one(range[1]); end = one(range[2]);
    if (start || end) { rest = rest.slice(0, range.index); if (start) chips.push({ kind: 'start', text: range[1].trim() }); if (end) chips.push({ kind: 'end', text: range[2].trim() }); }
  }
  if (!start && !end) {
    const until = rest.match(/\b(?:until|till|due|ending|ends|by)\s+(.+)$/i);
    if (until && (end = one(until[1]))) { rest = rest.slice(0, until.index); chips.push({ kind: 'end', text: until[1].trim() }); }
    const from = rest.match(/\b(?:from|starting|starts|start|on)\s+(.+)$/i);
    if (from && (start = one(from[1]))) { rest = rest.slice(0, from.index); chips.push({ kind: 'start', text: from[1].trim() }); }
  }
  if (end && start && end < start) [start, end] = [end, start];
  return { name: tidy(rest) || String(text || '').trim(), client, start, end, chips };
}

// Words people start typing → what they probably mean. Each suggestion replaces the word(s) being typed.
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const PHRASES = ['today', 'tonight', 'tomorrow', 'day after tomorrow', 'this weekend', 'next week', 'next month', 'end of week', 'end of month', 'in 2 days', 'in a week',
  'every day', 'every weekday', 'every week', 'every month', 'at 9am', 'at noon', 'at 2pm', 'at 5pm', 'at 7pm', 'urgent', 'p1', 'p2',
  ...DAY_NAMES, ...DAY_NAMES.map(d => 'next ' + d), ...DAY_NAMES.map(d => 'every ' + d)];
export function suggest(text, caret, workspace = {}, { names = true, dates = true } = {}) {
  const before = String(text || '').slice(0, caret ?? String(text || '').length);
  const out = [];
  const add = (label, start, kind, detail) => { if (out.length < 6 && !out.some(x => x.label.toLowerCase() === label.toLowerCase())) out.push({ label, start, end: before.length, kind, detail }); };
  // the last one to three words, longest first, so "next fr" offers "next Friday"
  const words = [...before.matchAll(/\S+/g)];
  if (!words.length || /\s$/.test(before)) return out;
  for (let n = Math.min(3, words.length); n >= 1; n--) {
    const start = words[words.length - n].index, typed = before.slice(start).toLowerCase(), bare = typed.replace(/^[@#]/, '');
    if (bare.length < (n === 1 ? 2 : 3)) continue;
    if (names) {
      const pool = [...(workspace.projects || []).filter(p => p.status !== 'Complete').map(p => ['project', p.name, (workspace.clients || []).find(c => c.id === p.client)?.name]), ...(workspace.clients || []).filter(c => !c.arch).map(c => ['client', c.name])];
      for (const [kind, name, detail] of pool) if (name && name.toLowerCase().startsWith(bare) && name.toLowerCase() !== bare) add(name, start + (typed.length - bare.length), kind, detail);
      if (n === 1 && bare.length >= 3) for (const [kind, name, detail] of pool) if (name && name.toLowerCase().includes(' ' + bare)) add(name, start + (typed.length - bare.length), kind, detail);
    }
    if (dates && !/^[@#]/.test(typed)) for (const phrase of PHRASES) if (phrase.toLowerCase().startsWith(typed) && phrase.toLowerCase() !== typed) add(phrase, start, 'when');
  }
  return out;
}
export const applySuggestion = (text, s) => { const after = text.slice(s.end).replace(/^\S*/, ''); const head = text.slice(0, s.start) + s.label; return { text: head + (after.startsWith(' ') ? after : ' ' + after.trimStart()), caret: head.length + 1 }; };

const fmtDay = (iso, now = new Date()) => { const t = toStr(now), n = diffDays(t, iso); return n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : n > 1 && n < 7 ? fromStr(iso).toLocaleDateString(undefined, { weekday: 'long' }) : fromStr(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: iso.slice(0, 4) === t.slice(0, 4) ? undefined : 'numeric' }); };
const fmtTime = hm => { const [h, m] = hm.split(':').map(Number); return new Date(2000, 0, 1, h, m).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }); };
export { fmtDay, fmtTime, toStr as dateKeyOf };
