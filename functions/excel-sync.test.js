import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_MAPPING, validateMapping, appRows, applyAppChanges, readers, columnLetter } from './excel-sync.js';
import { syncLink, parseAddress, shareId } from './excel-runner.js';

// An in-memory worksheet that understands the Graph calls the runner makes.
function fakeGraph(cells = []) {
  const grid = cells.map(r => [...r]);
  const cellRef = a => { const m = /^([A-Z]+)(\d+)$/.exec(a); return { r: Number(m[2]) - 1, c: [...m[1]].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1 }; };
  const patch = (url, body) => {
    const [from, to = from] = /address='([^']+)'/.exec(url)[1].split(':'), a = cellRef(from), b = cellRef(to);
    for (let r = a.r; r <= b.r; r++) for (let c = a.c; c <= b.c; c++) { grid[r] ||= []; grid[r][c] = body.values[r - a.r][c - a.c]; }
  };
  const calls = [];
  return {
    grid, calls,
    async call(method, path, body) {
      calls.push(method + ' ' + path);
      if (method === 'GET' && path.includes('/usedRange')) {
        const rows = grid.length, cols = Math.max(0, ...grid.map(r => r.length));
        if (!rows) return { address: 'Tasks!A1', values: [['']] };
        return { address: `Tasks!A1:${columnLetter(cols - 1)}${rows}`, values: grid.map(r => Array.from({ length: cols }, (_, i) => r[i] ?? '')) };
      }
      if (method === 'PATCH') return patch(path, body);
      throw new Error('Unexpected call ' + method + ' ' + path);
    },
    async batch(requests) { for (const r of requests) { calls.push('BATCH ' + r.url); patch(r.url, r.body); } },
  };
}
const workspace = () => ({
  clients: [{ id: 'c', name: 'Client' }], projects: [{ id: 'p', name: 'Launch', client: 'c' }, { id: 'other', name: 'Other', client: 'c' }],
  tasks: [{ id: 't1', title: 'Wireframes', status: 'Todo', due: '2026-10-27', project: 'p', client: 'c', priority: 'High' }, { id: 't2', title: 'Copy', status: 'In progress', project: 'p', client: 'c' }, { id: 'x', title: 'Elsewhere', project: 'other', client: 'c' }],
  focusSessions: [{ taskId: 't1', seconds: 5400 }],
});
const link = (base = {}) => ({ scope: { kind: 'project', id: 'p' }, mapping: DEFAULT_MAPPING, base, driveId: 'd', itemId: 'i', worksheetId: 'w' });
let ids = 0; const newId = () => 'new' + ++ids;
const row = (grid, id) => grid.find(r => r[0] === id);

async function linked() {
  const graph = fakeGraph(), w = workspace();
  const first = await syncLink({ graph, link: link(), workspace: w, newId });
  return { graph, w, base: first.base, first };
}

test('first sync writes the header and every in-scope task, with hours from the focus timer', async () => {
  const { graph, first } = await linked();
  assert.deepEqual(graph.grid[0], DEFAULT_MAPPING.map(m => m.column));
  assert.deepEqual(row(graph.grid, 't1'), ['t1', 'Wireframes', 'Todo', '2026-10-27', 'High', 1.5]);
  assert.ok(row(graph.grid, 't2') && !row(graph.grid, 'x'), 'only the linked project syncs');
  assert.equal(first.appChanges.length, 0);
});

test('a sheet edit flows to SoloDesk and a SoloDesk edit flows to the sheet, one cell at a time', async () => {
  const { graph, w, base } = await linked();
  row(graph.grid, 't1')[2] = 'done';                // edited in Excel
  w.tasks[1].title = 'Homepage copy';               // edited in SoloDesk
  graph.grid[1][7] = '=F2*2';                        // a formula in an unmapped column
  graph.calls.length = 0;
  const result = await syncLink({ graph, link: link(base), workspace: w, newId });
  assert.deepEqual(result.appChanges, [{ op: 'update', id: 't1', fields: { status: 'Done' } }]);
  assert.equal(row(graph.grid, 't2')[1], 'Homepage copy');
  assert.equal(graph.calls.filter(c => c.startsWith('BATCH')).length, 1, 'only the changed cell is written');
  assert.equal(graph.grid[1][7], '=F2*2');
  assert.equal(result.base.t1.status, 'Done');
});

test('a cell changed on both sides is a conflict until the owner picks a side', async () => {
  const { graph, w, base } = await linked();
  row(graph.grid, 't1')[3] = '2026-10-29'; w.tasks[0].due = '2026-10-30';
  const held = await syncLink({ graph, link: link(base), workspace: w, newId });
  assert.deepEqual(held.conflicts.map(c => [c.id, c.field, c.app, c.sheet]), [['t1', 'due', '2026-10-30', '2026-10-29']]);
  assert.equal(row(graph.grid, 't1')[3], '2026-10-29', 'nothing is overwritten');
  const picked = await syncLink({ graph, link: link(held.base), workspace: w, newId, resolve: { 't1:due': 'sheet' } });
  assert.deepEqual(picked.appChanges, [{ op: 'update', id: 't1', fields: { due: '2026-10-29' } }]);
});

test('a row typed into the sheet becomes a task and gets its SoloDesk ID written back', async () => {
  const { graph, w, base } = await linked();
  graph.grid.push(['', 'Launch checklist', 'In progress', 46325, 'low']);   // 46325 = Excel serial for 2026-10-30
  const result = await syncLink({ graph, link: link(base), workspace: w, newId });
  const [create] = result.appChanges;
  assert.equal(create.op, 'create');
  assert.deepEqual(create.fields, { status: 'In progress', due: '2026-10-30', priority: 'Low', title: 'Launch checklist' });
  assert.equal(graph.grid.at(-1)[0], create.id);
  applyAppChanges(w, result.appChanges, { kind: 'project', id: 'p' });
  assert.equal(w.tasks.at(-1).project, 'p'); assert.equal(w.tasks.at(-1).client, 'c');
});

test('deleted rows are reported once and never deleted or re-added on the other side', async () => {
  const { graph, w, base } = await linked();
  graph.grid.splice(graph.grid.indexOf(row(graph.grid, 't2')), 1);
  const first = await syncLink({ graph, link: link(base), workspace: w, newId });
  assert.deepEqual(first.removedInSheet.map(r => r.id), ['t2']);
  assert.ok(w.tasks.some(t => t.id === 't2'), 'the task stays in SoloDesk');
  const again = await syncLink({ graph, link: link(first.base), workspace: w, newId });
  assert.ok(!row(graph.grid, 't2') && !again.removedInSheet.length);
  w.tasks = w.tasks.filter(t => t.id !== 't1');
  const gone = await syncLink({ graph, link: link(again.base), workspace: w, newId });
  assert.deepEqual(gone.removedInApp.map(r => r.id), ['t1']); assert.ok(row(graph.grid, 't1'), 'the sheet row stays');
});

test('changes waiting in the app inbox are not undone by the next sync', async () => {
  const { graph, w, base } = await linked();
  row(graph.grid, 't1')[1] = 'Wireframes v2';
  const sent = await syncLink({ graph, link: link(base), workspace: w, newId });
  // The app has not applied the change yet, and another sync runs.
  const next = await syncLink({ graph, link: link(sent.base), workspace: w, pending: sent.appChanges, newId });
  assert.equal(row(graph.grid, 't1')[1], 'Wireframes v2');
  assert.equal(next.appChanges.length, 0);
});

test('unreadable cells are reported instead of synced, and missing columns stop the sync', async () => {
  const { graph, w, base } = await linked();
  row(graph.grid, 't1')[2] = 'maybe';
  const result = await syncLink({ graph, link: link(base), workspace: w, newId });
  assert.deepEqual(result.invalid.map(i => [i.id, i.field]), [['t1', 'status']]);
  assert.equal(result.appChanges.length, 0);
  graph.grid[0][2] = 'State';
  await assert.rejects(syncLink({ graph, link: link(base), workspace: w, newId }), /missing these columns: Status/);
});

test('mapping, readers and helpers reject unsafe input', () => {
  assert.throws(() => validateMapping([{ column: 'Task', field: 'title', direction: 'both' }]), /SoloDesk ID/);
  assert.throws(() => validateMapping([...DEFAULT_MAPPING.slice(0, 5), { column: 'Hours', field: 'hours', direction: 'both' }]), /hours/i);
  assert.throws(() => validateMapping([...DEFAULT_MAPPING, { column: 'task', field: 'status', direction: 'in' }]), /once/);
  assert.equal(readers.due('2026-02-30'), undefined); assert.equal(readers.priority('urgent'), undefined);
  assert.deepEqual(parseAddress("'My Tasks'!B3:F10"), { row: 2, col: 1, lastRow: 9 });
  assert.equal(shareId('https://1drv.ms/x/s!abc?e=1'), 'u!aHR0cHM6Ly8xZHJ2Lm1zL3gvcyFhYmM_ZT0x');
  assert.deepEqual(appRows(workspace(), { kind: 'client', id: 'c' }).map(r => r.id), ['t1', 't2', 'x']);
  assert.equal(columnLetter(26), 'AA');
});
