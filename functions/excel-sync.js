// Two-way sync between a SoloDesk task list (one project or one client) and a table in an Excel worksheet.
// Pure functions only: the Graph calls and Firestore storage live in excel-runner.js and excel-functions.js.
//
// Each sheet row carries a "SoloDesk ID" that SoloDesk owns. Every sync compares three versions of each
// mapped cell: SoloDesk now, the sheet now, and the value both agreed on after the last sync ("base").
// Whichever side differs from base changed; if both did, it is a conflict and nothing is overwritten.
// Rows are never deleted on either side: a row removed in one place is reported and stops syncing.

export const DEFAULT_MAPPING = [
  { column: 'SoloDesk ID', field: 'id', direction: 'locked' },
  { column: 'Task', field: 'title', direction: 'both' },
  { column: 'Status', field: 'status', direction: 'both' },
  { column: 'Due', field: 'due', direction: 'both' },
  { column: 'Priority', field: 'priority', direction: 'both' },
  { column: 'Hours logged', field: 'hours', direction: 'out' },
];
const DIRECTIONS = ['both', 'in', 'out'];

const isoDay = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value;
// Excel stores dates as days since 30 Dec 1899.
const fromSerial = serial => new Date(Date.UTC(1899, 11, 30) + Math.round(serial) * 86400000).toISOString().slice(0, 10);

// Each reader turns a sheet cell into a SoloDesk value, or undefined when the cell cannot be used.
export const readers = {
  title: v => { const t = String(v ?? '').trim().slice(0, 200); return t || undefined; },
  status: v => {
    const s = String(v ?? '').trim().toLowerCase();
    if (['done', 'complete', 'completed', 'finished', 'yes', 'true', '✓', '✔'].includes(s)) return 'Done';
    if (['in progress', 'in-progress', 'doing', 'started', 'wip'].includes(s)) return 'In progress';
    if (['todo', 'to do', 'to-do', 'open', 'not started', 'no', 'false', ''].includes(s)) return 'Todo';
    return undefined;
  },
  due: v => {
    if (v === '' || v == null) return '';
    if (typeof v === 'number' && Number.isFinite(v) && v > 0 && v < 2958466) return fromSerial(v);
    const s = String(v).trim();
    return isoDay(s) ? s : undefined;
  },
  priority: v => {
    const s = String(v ?? '').trim().toLowerCase();
    return { '': '', low: 'Low', medium: 'Medium', med: 'Medium', high: 'High' }[s];
  },
  hours: v => (v === '' || v == null ? 0 : Number.isFinite(Number(v)) ? Math.round(Number(v) * 10) / 10 : undefined),
};

export function validateMapping(mapping) {
  if (!Array.isArray(mapping) || !mapping.length || mapping.length > 12) throw new Error('Map between 1 and 12 columns.');
  const fields = new Set(), columns = new Set();
  for (const m of mapping) {
    const column = String(m?.column || '').trim();
    if (!column || column.length > 60) throw new Error('Each mapped column needs a header of up to 60 characters.');
    if (m.field === 'id' ? m.direction !== 'locked' : !readers[m.field] || !DIRECTIONS.includes(m.direction)) throw new Error('Unknown field or sync direction in the column mapping.');
    if (m.field === 'hours' && m.direction !== 'out') throw new Error('Logged hours can only be sent from SoloDesk to the sheet.');
    if (fields.has(m.field) || columns.has(column.toLowerCase())) throw new Error('Each field and column can be mapped once.');
    fields.add(m.field); columns.add(column.toLowerCase());
  }
  if (!fields.has('id') || !fields.has('title')) throw new Error('The mapping needs the SoloDesk ID and Task columns.');
  return mapping.map(m => ({ column: String(m.column).trim(), field: m.field, direction: m.direction }));
}

const inScope = (workspace, scope) => task => {
  if (task.arch) return false;
  if (scope.kind === 'project') return task.project === scope.id;
  const project = workspace.projects.find(p => p.id === task.project);
  return task.client === scope.id || project?.client === scope.id;
};

export function appRows(workspace, scope) {
  const seconds = new Map();
  for (const s of workspace.focusSessions || []) if (s.taskId) seconds.set(s.taskId, (seconds.get(s.taskId) || 0) + Number(s.seconds || 0));
  return workspace.tasks.filter(inScope(workspace, scope)).map(t => ({
    id: t.id, title: t.title, status: t.status || 'Todo', due: t.due || '', priority: t.priority || '',
    hours: Math.round((seconds.get(t.id) || 0) / 360) / 10,
  }));
}

// values: the worksheet's used range as a matrix, header in the first row.
export function parseSheet(values, mapping) {
  const header = (values[0] || []).map(h => String(h ?? '').trim().toLowerCase());
  const index = {}, missing = [];
  for (const m of mapping) { const i = header.indexOf(m.column.toLowerCase()); if (i < 0) missing.push(m.column); else index[m.field] = i; }
  if (missing.length) return { missing, index, rows: [] };
  const rows = [];
  values.slice(1).forEach((cells, k) => {
    if (!cells.some(c => String(c ?? '').trim() !== '')) return;
    const raw = Object.fromEntries(mapping.map(m => [m.field, cells[index[m.field]]]));
    rows.push({ row: k + 1, id: String(raw.id ?? '').trim(), raw });
  });
  return { missing: [], index, rows };
}

const same = (a, b) => (a ?? '') === (b ?? '');

export function planSync({ app, sheet, base = {}, mapping, newId, resolve = {} }) {
  const out = { app: [], sheet: [], conflicts: [], invalid: [], removedInApp: [], removedInSheet: [], base: {} };
  const fields = mapping.filter(m => m.field !== 'id');
  const appById = new Map(app.map(r => [r.id, r])), sheetById = new Map();
  const snapshot = row => Object.fromEntries(fields.map(m => [m.field, row[m.field] ?? '']));

  for (const s of sheet.rows) {
    if (s.id) {
      if (sheetById.has(s.id)) out.invalid.push({ row: s.row, id: s.id, field: 'id', reason: 'This SoloDesk ID appears more than once. Only the first row syncs.' });
      else sheetById.set(s.id, s);
      continue;
    }
    // A row typed into the sheet without an ID becomes a new SoloDesk task.
    const fieldsIn = {};
    for (const m of fields) {
      if (m.direction === 'out') continue;
      const v = readers[m.field](s.raw[m.field]);
      if (v === undefined) { if (m.field !== 'title') out.invalid.push({ row: s.row, field: m.field, value: s.raw[m.field] }); }
      else fieldsIn[m.field] = v;
    }
    if (!fieldsIn.title) { out.invalid.push({ row: s.row, field: 'title', reason: 'New rows need a task name.' }); continue; }
    const id = newId();
    const created = { status: 'Todo', due: '', priority: '', ...fieldsIn };
    out.app.push({ op: 'create', id, fields: created });
    out.sheet.push({ op: 'update', row: s.row, id, values: { id, ...Object.fromEntries(fields.filter(m => m.direction === 'out').map(m => [m.field, m.field === 'hours' ? 0 : ''])) } });
    out.base[id] = snapshot({ ...created, hours: 0 });
  }

  for (const [id, s] of sheetById) {
    const a = appById.get(id), b = base[id];
    if (b?.detached) { out.base[id] = b; continue; }
    if (!a) {
      if (b) { out.removedInApp.push({ id, row: s.row }); out.base[id] = { ...b, detached: true }; }
      else out.invalid.push({ row: s.row, id, field: 'id', reason: 'This ID does not belong to a task in this project or client.' });
      continue;
    }
    const toSheet = {}, toApp = {}, agreed = {};
    for (const m of fields) {
      const f = m.field, av = a[f] ?? '', bv = b?.[f];
      if (m.direction === 'out') { if (!same(readers[f](s.raw[f]), av)) toSheet[f] = av; agreed[f] = av; continue; }
      const sv = readers[f](s.raw[f]);
      if (sv === undefined) { out.invalid.push({ row: s.row, id, field: f, value: s.raw[f] }); agreed[f] = bv ?? av; continue; }
      if (m.direction === 'in') { if (!same(sv, av)) toApp[f] = sv; agreed[f] = sv; continue; }
      if (same(av, sv)) agreed[f] = av;
      else if (bv === undefined || same(sv, bv)) { toSheet[f] = av; agreed[f] = av; }
      else if (same(av, bv)) { toApp[f] = sv; agreed[f] = sv; }
      else {
        const pick = resolve[id + ':' + f];
        if (pick === 'app') { toSheet[f] = av; agreed[f] = av; }
        else if (pick === 'sheet') { toApp[f] = sv; agreed[f] = sv; }
        else { out.conflicts.push({ id, row: s.row, field: f, title: a.title, app: av, sheet: sv }); agreed[f] = bv; }
      }
    }
    if (Object.keys(toApp).length) out.app.push({ op: 'update', id, fields: toApp });
    if (Object.keys(toSheet).length) out.sheet.push({ op: 'update', row: s.row, id, values: toSheet });
    out.base[id] = agreed;
  }

  for (const a of app) {
    if (sheetById.has(a.id)) continue;
    const b = base[a.id];
    if (b?.detached) out.base[a.id] = b;
    else if (b) { out.removedInSheet.push({ id: a.id, title: a.title }); out.base[a.id] = { ...b, detached: true }; }
    else { out.sheet.push({ op: 'append', id: a.id, values: { id: a.id, ...snapshot(a) } }); out.base[a.id] = snapshot(a); }
  }
  return out;
}

// Applied by the SoloDesk app (from its sync inbox) and by the server to predict pending changes.
export function applyAppChanges(workspace, changes, scope, now = new Date().toISOString()) {
  let applied = 0;
  for (const change of changes) {
    const fields = Object.fromEntries(Object.entries(change.fields || {}).filter(([f, v]) => ['title', 'status', 'due', 'priority'].includes(f) && readers[f](v) === v));
    if (change.op === 'create') {
      if (workspace.tasks.some(t => t.id === change.id) || !fields.title) continue;
      const project = scope.kind === 'project' ? workspace.projects.find(p => p.id === scope.id) : null;
      workspace.tasks.push({ id: change.id, status: 'Todo', ...fields, project: project?.id || '', client: scope.kind === 'client' ? scope.id : project?.client || '', durationMinutes: 60, createdAt: now, updatedAt: now });
      applied++;
    } else if (change.op === 'update') {
      const task = workspace.tasks.find(t => t.id === change.id);
      if (!task || !Object.keys(fields).length) continue;
      Object.assign(task, fields, { updatedAt: now }); applied++;
    }
  }
  return applied;
}

export const columnLetter = n => { let s = ''; for (n++; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + (n - 1) % 26) + s; return s; };
const sheetValue = (field, value) => field === 'hours' ? Number(value) || 0 : String(value ?? '');

// Turns a plan into single-cell writes, so formulas and unmapped columns in the sheet are never touched.
// origin: zero-based { row, col } of the used range's top-left cell; lastRow: zero-based index of its last row.
export function sheetWrites(plan, parsed, origin, lastRow) {
  const writes = [], cell = (r, field) => columnLetter(origin.col + parsed.index[field]) + (origin.row + r + 1);
  let next = lastRow - origin.row + 1;
  for (const change of plan.sheet) {
    const r = change.op === 'append' ? next++ : change.row;
    for (const [field, value] of Object.entries(change.values)) if (field in parsed.index) writes.push({ address: cell(r, field), values: [[sheetValue(field, value)]] });
  }
  return writes;
}
