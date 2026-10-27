import test from 'node:test';
import assert from 'node:assert/strict';
import { splitWorkspace, joinWorkspace, baselineOf, PART_BYTES, SPLIT_MARKER } from '../src/workspace-store.js';
import { fresh } from '../src/lib.js';
import { validateWorkspace } from '../src/workspace-upgrades.js';

const big = n => Array.from({ length: n }, (_, i) => ({ id: 'n' + i, title: 'Note ' + i, body: 'x'.repeat(50_000), createdAt: '2026-10-25' }));

test('growing lists move into part documents and come back unchanged', () => {
  const w = { ...fresh(), notes: big(40), docs: [{ id: 'd', title: 'PRD', kind: 'prd' }], activity: [] };
  const { core, parts } = splitWorkspace(w);
  assert.ok(!JSON.parse(core).notes, 'notes are not in the main document');
  assert.ok(Object.keys(parts).filter(k => k.startsWith('notes.')).length >= 3, '2 MB of notes span several parts');
  for (const json of Object.values(parts)) assert.ok(new TextEncoder().encode(json).byteLength <= PART_BYTES);
  const back = joinWorkspace({ core, parts: Object.keys(parts) }, parts);
  assert.equal(baselineOf(back), baselineOf(w));
  assert.deepEqual(back.notes.map(n => n.id), w.notes.map(n => n.id));
  assert.deepEqual(back.docs, w.docs);
});

test('old single-document workspaces still load; old app versions cannot read the split layout', () => {
  const w = { ...fresh(), notes: [{ id: 'a', title: 'A', body: '' }] };
  assert.deepEqual(joinWorkspace({ json: JSON.stringify(w) }), w);
  assert.throws(() => validateWorkspace(JSON.parse(SPLIT_MARKER)));
  assert.throws(() => joinWorkspace({ core: '{}', parts: ['notes.0'] }, {}), /missing/);
});

test('the save baseline does not depend on key order or storage layout', () => {
  const a = { ...fresh(), notes: [{ id: 'x', title: 'X' }] };
  const { core, parts } = splitWorkspace(a);
  assert.equal(baselineOf(joinWorkspace({ core, parts: Object.keys(parts) }, parts)), baselineOf(a));
});

test('one oversized item is reported instead of failing silently', () => {
  assert.throws(() => splitWorkspace({ ...fresh(), notes: [{ id: 'h', title: 'Huge', body: 'x'.repeat(PART_BYTES) }] }), /too large/);
});

// A tiny in-memory stand-in for Firestore documents and transactions.
const fakeStore = () => {
  const docs = new Map(), key = id => id || 'main';
  const snap = id => ({ id, exists: () => docs.has(key(id)), data: () => docs.get(key(id)) });
  return { docs, refOf: id => id, tx: { get: async id => snap(id), set: (id, v) => docs.set(key(id), v), delete: id => docs.delete(key(id)) } };
};
const conflict = (a, b) => { if (a !== b) throw Object.assign(new Error('conflict'), { code: 'workspace-conflict' }); };

test('saving writes the main document and parts, and refuses to overwrite changes made elsewhere', async () => {
  const { writeWorkspace } = await import('../src/workspace-store.js');
  const s = fakeStore();
  const v1 = { ...fresh(), notes: big(30) };
  const b1 = await writeWorkspace(s.tx, s.refOf, v1, null, conflict);
  const partIds = [...s.docs.keys()].filter(k => k !== 'main');
  assert.ok(partIds.length >= 2);
  assert.equal(baselineOf(joinWorkspace(s.docs.get('main'), Object.fromEntries(partIds.map(id => [id, s.docs.get(id).json])))), b1);
  // fewer notes: unused parts are removed
  const v2 = { ...v1, notes: v1.notes.slice(0, 2) };
  const b2 = await writeWorkspace(s.tx, s.refOf, v2, b1, conflict);
  assert.deepEqual([...s.docs.keys()].filter(k => k !== 'main'), ['notes.0']);
  // a stale tab (old baseline) is stopped
  await assert.rejects(writeWorkspace(s.tx, s.refOf, v1, b1, conflict), { code: 'workspace-conflict' });
  // an old single-document workspace upgrades on its first save
  const old = fakeStore(), w = { ...fresh(), notes: [{ id: 'a', title: 'A' }] };
  old.docs.set('main', { json: JSON.stringify(w) });
  await writeWorkspace(old.tx, old.refOf, { ...w, notes: [...w.notes, { id: 'b', title: 'B' }] }, baselineOf(w), conflict);
  assert.equal(old.docs.get('main').v, 2);
  assert.ok(b2);
});

test('tasks and invoices move into part documents and join back completely', () => {
  const bigTasks = Array.from({ length: 40 }, (_, i) => ({ id: 't' + i, title: 'Task ' + i, notes: 'y'.repeat(50_000) }));
  const bigInvoices = Array.from({ length: 40 }, (_, i) => ({ id: 'inv' + i, no: 'INV-' + i, items: [{ desc: 'Work ' + i, qty: 1, price: 100 }], notes: 'z'.repeat(50_000), pays: [] }));
  const w = { ...fresh(), tasks: bigTasks, invoices: bigInvoices };
  const { core, parts } = splitWorkspace(w);
  assert.ok(!JSON.parse(core).tasks, 'tasks are moved out of the main document');
  assert.ok(!JSON.parse(core).invoices, 'invoices are moved out of the main document');
  assert.ok(Object.keys(parts).some(k => k.startsWith('tasks.')), 'tasks span part documents');
  assert.ok(Object.keys(parts).some(k => k.startsWith('invoices.')), 'invoices span part documents');
  const back = joinWorkspace({ core, parts: Object.keys(parts) }, parts);
  assert.equal(baselineOf(back), baselineOf(w));
  assert.equal(back.tasks.length, 40);
  assert.equal(back.invoices.length, 40);
});

test('part hash caching avoids re-reading and re-writing unchanged parts', async () => {
  const { writeWorkspace } = await import('../src/workspace-store.js');
  let getCalls = 0, setCalls = 0;
  const docs = new Map(), key = id => id || 'main';
  const snap = id => ({ id, exists: () => docs.has(key(id)), data: () => docs.get(key(id)) });
  const store = {
    docs, refOf: id => id,
    tx: {
      get: async id => { getCalls++; return snap(id); },
      set: (id, v) => { setCalls++; docs.set(key(id), v); },
      delete: id => docs.delete(key(id))
    }
  };
  const v1 = { ...fresh(), notes: big(20) };
  const b1 = await writeWorkspace(store.tx, store.refOf, v1, null, conflict);
  // Reset counters
  getCalls = 0; setCalls = 0;
  // Modify only 1 note in part 0 (keeping other parts untouched)
  const v2 = structuredClone(v1);
  v2.notes[0].title = 'Updated Title';
  const b2 = await writeWorkspace(store.tx, store.refOf, v2, b1, conflict);
  // getCalls must be exactly 1 (only main document was read, 0 part reads!)
  assert.equal(getCalls, 1, 'only main document was read');
  // setCalls must be exactly 2 (main doc + the 1 changed part notes.0, not all parts!)
  assert.equal(setCalls, 2, 'only main and the single changed part were written');
  assert.notEqual(b1, b2);
});
