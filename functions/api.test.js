import test from 'node:test';
import assert from 'node:assert/strict';
import { createApi, hashKey, invoiceTotals } from './api.js';

const date = new Date('2026-10-19T12:00:00Z');
const workspace = {
  clients: [{ id: 'c1', name: 'Client A' }, { id: 'c2', name: 'Client B' }], projects: [{ id: 'pr1', name: 'Brand identity', client: 'c1', status: 'Active', start: '2026-10-01', end: '2026-10-31' }],
  tasks: [{ id: 't1', title: 'Design review', status: 'Todo', due: '2026-10-20', client: 'c1', project: 'pr1' }, { id: 't2', status: 'Done' }], settings: { cur: 'INR' },
  invoices: [{ id: 'i1', no: 'INV-1', client: 'c1', state: 'sent', due: '2026-10-01', tax: 10, items: [{ qty: 2, price: 100 }], pays: [{ id: 'p1', amt: 50, date: '2026-10-10' }] }],
};
function fixture() {
  const keys = new Map(); let requestedUid;
  const store = {
    getWorkspace: async uid => { requestedUid = uid; return uid === 'alice' ? structuredClone(workspace) : null; },
    getKey: async id => keys.get(id),
    listKeys: async uid => [...keys.values()].filter(k => k.uid === uid),
    createKey: async key => { if ([...keys.values()].filter(k => k.uid === key.uid && !k.revoked).length >= 10) return false; keys.set(key.id, key); return true; },
    revokeKey: async (id, uid) => { const key = keys.get(id); if (!key || key.uid !== uid) return false; key.revoked = true; return true; },
  };
  const api = createApi({ store, now: () => date, verifyToken: async token => { if (!['alice', 'bob'].includes(token)) throw Error('invalid'); return { uid: token }; }, userExists: async uid => uid !== 'deleted', allowedOrigins: ['https://desk.example'] });
  const call = async (path, { method = 'GET', token = 'alice', query = {}, body, origin } = {}) => {
    const result = { status: 200, headers: {} };
    const res = { set: (key, value) => { result.headers[key] = value; return res; }, status: value => { result.status = value; return res; }, json: value => { result.body = value; return res; }, send: value => { result.body = value; return res; } };
    await api({ path, method, query, body, get: name => ({ authorization: token ? 'Bearer ' + token : undefined, origin })[name.toLowerCase()] }, res);
    return result;
  };
  return { call, keys, get requestedUid() { return requestedUid; } };
}

test('missing and invalid credentials return 401', async () => {
  const { call } = fixture();
  for (const token of [null, 'bad', 'sd_live_bad']) assert.equal((await call('/api/v1/clients', { token })).status, 401);
});
test('data belongs to the verified account, never a query-supplied uid', async () => {
  const f = fixture(); const res = await f.call('/api/v1/clients', { query: { uid: 'bob' } });
  assert.equal(f.requestedUid, 'alice'); assert.equal(res.body.data[0].name, 'Client A');
  assert.equal((await f.call('/api/v1/workspace', { token: 'bob', query: { uid: 'alice' } })).status, 404);
});
test('pagination has stable counts, bounded limits and next offset', async () => {
  const { call } = fixture(); const res = await call('/api/v1/clients', { query: { limit: '1', offset: '0' } });
  assert.equal(res.body.data.length, 1); assert.deepEqual(res.body.meta, { schemaVersion: 1, exportedAt: date.toISOString(), total: 2, limit: 1, offset: 0, nextOffset: 1 });
  for (const query of [{ limit: 0 }, { limit: 501 }, { limit: 'foo' }, { offset: -1 }, { offset: 1.5 }]) assert.equal((await call('/api/v1/clients', { query })).status, 400);
});
test('all seven export endpoints work', async () => {
  const { call } = fixture();
  for (const name of ['workspace', 'clients', 'projects', 'tasks', 'invoices', 'payments', 'summary']) assert.equal((await call('/api/v1/' + name)).status, 200);
});
test('invoice arithmetic and summary use payment records', async () => {
  const { call } = fixture(); const inv = await call('/api/v1/invoices');
  assert.deepEqual(inv.body.data[0].computed, { subtotal: 200, tax: 20, total: 220, paid: 50, balance: 170, status: 'Overdue' });
  assert.deepEqual((await call('/api/v1/summary')).body.data, { currency: 'INR', revenueReceived: 50, outstandingBalance: 170, overdueInvoices: 1, openTasks: 1, activeProjects: 1 });
  const invoice = workspace.invoices[0];
  assert.equal(invoiceTotals({ ...invoice, state: 'draft' }, '2026-10-19').status, 'Draft');
  assert.equal(invoiceTotals({ ...invoice, state: 'void' }, '2026-10-19').status, 'Void');
  assert.equal(invoiceTotals({ ...invoice, pays: [{ amt: 220 }] }, '2026-10-19').status, 'Paid');
});
test('API keys are random, hash-indexed and not returned in lists', async () => {
  const { call, keys } = fixture(); const created = await call('/api/v1/keys', { method: 'POST', body: { name: 'Reports', scope: 'workspace' } });
  assert.equal(created.status, 201); assert.match(created.body.secret, /^sd_live_[a-f0-9]{64}$/);
  assert.equal(created.body.data.id, hashKey(created.body.secret)); assert.ok(keys.has(hashKey(created.body.secret)));
  const listed = await call('/api/v1/keys'); assert.ok(!JSON.stringify(listed.body).includes(created.body.secret));
  assert.ok(!JSON.stringify([...keys.values()]).includes(created.body.secret));
  assert.equal((await call('/api/v1/clients', { token: created.body.secret })).status, 200);
});
test('API key cannot create, list or revoke credentials', async () => {
  const { call } = fixture(); const created = await call('/api/v1/keys', { method: 'POST', body: { name: 'App', scope: 'workspace' } });
  for (const method of ['GET', 'POST', 'DELETE']) assert.equal((await call('/api/v1/keys', { method, token: created.body.secret })).status, 403);
});
test('revocation is owner-scoped and immediately prevents reads', async () => {
  const { call } = fixture(); const { body } = await call('/api/v1/keys', { method: 'POST', body: { name: 'App', scope: 'workspace' } });
  assert.equal((await call('/api/v1/keys/' + body.data.id, { method: 'DELETE', token: 'bob' })).status, 404);
  assert.equal((await call('/api/v1/keys/' + body.data.id, { method: 'DELETE' })).status, 200);
  assert.equal((await call('/api/v1/clients', { token: body.secret })).status, 401);
});
test('expired keys and deleted account keys cannot read data', async () => {
  const { call, keys } = fixture();
  for (const record of [{ uid: 'alice', expiresAt: '2026-01-01' }, { uid: 'deleted', expiresAt: '2027-01-01' }]) {
    const secret = 'sd_live_' + record.uid; keys.set(hashKey(secret), record);
    assert.equal((await call('/api/v1/clients', { token: secret })).status, 401);
  }
});
test('key names and maximum key count are validated', async () => {
  const { call } = fixture();
  for (const name of ['', ' ', 'a'.repeat(61), null]) assert.equal((await call('/api/v1/keys', { method: 'POST', body: { name } })).status, 400);
  for (let i = 0; i < 10; i++) assert.equal((await call('/api/v1/keys', { method: 'POST', body: { name: 'App ' + i } })).status, 201);
  assert.equal((await call('/api/v1/keys', { method: 'POST', body: { name: 'Eleven' } })).status, 409);
});
test('data endpoints reject writes and unknown endpoints return 404', async () => {
  const { call } = fixture();
  assert.equal((await call('/api/v1/clients', { method: 'POST' })).status, 405);
  assert.equal((await call('/api/v1/unknown')).status, 404);
});
test('CORS permits explicit origins and server clients; responses prevent caching', async () => {
  const { call } = fixture(); assert.equal((await call('/api/v1/clients', { origin: 'https://evil.example' })).status, 403);
  const allowed = await call('/api/v1/clients', { origin: 'https://desk.example' }); assert.equal(allowed.headers['Access-Control-Allow-Origin'], 'https://desk.example'); assert.equal(allowed.headers['Cache-Control'], 'no-store');
  assert.equal((await call('/api/v1/clients', { method: 'OPTIONS', token: null, origin: 'https://desk.example' })).status, 204);
});

test('calendar-scoped credentials expose events but no financial or contact records', async () => {
  const { call } = fixture();
  const key = await call('/api/v1/keys', { method: 'POST', body: { name: 'Calendar', scope: 'calendar' } });
  assert.equal(key.body.data.scope, 'calendar');
  const events = await call('/api/v1/calendar', { token: key.body.secret });
  assert.equal(events.status, 200); assert.equal(events.body.data.length, 2);
  assert.equal(events.body.data[0].end, '2026-11-01');
  assert.deepEqual(events.body.data[0].client, { id: 'c1', name: 'Client A' });
  for (const endpoint of ['clients', 'invoices', 'workspace', 'payments', 'summary', 'keys']) assert.equal((await call('/api/v1/' + endpoint, { token: key.body.secret })).status, 403);
});
test('calendar date filters include overlapping projects and validate ranges', async () => {
  const { call } = fixture();
  const res = await call('/api/v1/calendar', { query: { from: '2026-10-25', to: '2026-10-26' } });
  assert.equal(res.body.data.length, 1); assert.equal(res.body.data[0].id, 'project-pr1');
  assert.equal((await call('/api/v1/calendar', { query: { from: 'tomorrow' } })).status, 400);
  assert.equal((await call('/api/v1/calendar', { query: { from: '2026-12-01', to: '2026-10-01' } })).status, 400);
});
test('ICS subscriptions require calendar-only keys and honor revocation', async () => {
  const { call } = fixture();
  const key = await call('/api/v1/keys', { method: 'POST', body: { name: 'Calendar' } });
  const response = await call('/api/v1/calendar.ics', { token: null, query: { key: key.body.secret } });
  assert.equal(response.status, 200); assert.equal(response.headers['Content-Type'], 'text/calendar; charset=utf-8');
  assert.match(response.body, /BEGIN:VCALENDAR/); assert.match(response.body, /DTEND;VALUE=DATE:20261101/);
  assert.equal((await call('/api/v1/calendar', { token: null, query: { key: key.body.secret } })).status, 401);
  const full = await call('/api/v1/keys', { method: 'POST', body: { name: 'Full', scope: 'workspace' } });
  assert.equal((await call('/api/v1/calendar.ics', { token: null, query: { key: full.body.secret } })).status, 403);
  await call('/api/v1/keys/' + key.body.data.id, { method: 'DELETE' });
  assert.equal((await call('/api/v1/calendar.ics', { token: null, query: { key: key.body.secret } })).status, 401);
});
