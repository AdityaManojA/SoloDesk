import { createHash, randomBytes } from 'node:crypto';
import { calendarEvents, calendarIcs } from './calendar.js';

export const hashKey = value => createHash('sha256').update(value).digest('hex');
const fail = (status, message) => Object.assign(new Error(message), { status });
const amount = value => Number.isFinite(Number(value)) ? Number(value) : 0;

export function invoiceTotals(invoice, date) {
  const subtotal = (invoice.items || []).reduce((sum, item) => sum + amount(item.qty) * amount(item.price), 0);
  const tax = subtotal * amount(invoice.tax) / 100;
  const total = subtotal + tax, paid = (invoice.pays || []).reduce((sum, p) => sum + amount(p.amt), 0);
  const balance = Math.max(0, total - paid);
  const status = invoice.state === 'void' ? 'Void' : invoice.state === 'draft' ? 'Draft' : balance < .005 ? 'Paid' : invoice.due < date ? 'Overdue' : paid > 0 ? 'Partially paid' : 'Sent';
  return { subtotal, tax, total, paid, balance, status };
}

function keyMetadata(key) {
  return { id: key.id, name: key.name, prefix: key.prefix, scope: key.scope || 'workspace', createdAt: key.createdAt, expiresAt: key.expiresAt };
}

export function createApi({ store, verifyToken, userExists, allowedOrigins = [], now = () => new Date() }) {
  return async (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Vary', 'Origin');
    const origin = req.get('origin');
    // Server-to-server clients do not send Origin. Browser callers must be explicitly allowed.
    if (origin && !allowedOrigins.includes(origin)) return res.status(403).json({ error: { message: 'Origin is not allowed.' } });
    if (origin) res.set('Access-Control-Allow-Origin', origin);
    res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.set('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(204).send('');
    try {
      const path = req.path.replace(/^\/api\/v1(?=\/|$)/, '').replace(/\/$/, '') || '/';
      const calendarRoute = path === '/calendar' || path === '/calendar.ics';
      const queryAuth = path === '/calendar.ics' && typeof req.query.key === 'string';
      const token = /^Bearer ([^\s]+)$/i.exec(req.get('authorization') || '')?.[1] || (queryAuth ? req.query.key : null);
      if (!token) throw fail(401, 'A Bearer token is required.');
      let uid, keyAuth = false, scope = 'workspace';
      if (token.startsWith('sd_live_')) {
        const key = await store.getKey(hashKey(token));
        if (!key || key.revoked || new Date(key.expiresAt) <= now()) throw fail(401, 'API key is invalid, expired or revoked.');
        uid = key.uid; keyAuth = true; scope = key.scope || 'workspace';
        if (!await userExists(uid)) throw fail(401, 'Account no longer exists.');
      } else {
        if (queryAuth) throw fail(401, 'Calendar subscription requires a calendar key.');
        try { uid = (await verifyToken(token)).uid; } catch { throw fail(401, 'Sign-in token is invalid or expired.'); }
      }
      if (!uid) throw fail(401, 'Authentication failed.');
      if (keyAuth && scope === 'calendar' && !calendarRoute) throw fail(403, 'This key can only read calendar events.');
      if (queryAuth && scope !== 'calendar') throw fail(403, 'Use a calendar-only key in subscription URLs.');
      const keyRoute = path === '/keys' || path.startsWith('/keys/');
      if (keyRoute) {
        if (keyAuth) throw fail(403, 'Sign in to manage API keys.');
        if (path === '/keys' && req.method === 'GET') {
          const keys = await store.listKeys(uid);
          return res.json({ data: keys.filter(k => !k.revoked && new Date(k.expiresAt) > now()).map(keyMetadata).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) });
        }
        if (path === '/keys' && req.method === 'POST') {
          const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
          if (!name || name.length > 60) throw fail(400, 'Application name must be 1–60 characters.');
          const scope = req.body.scope || 'calendar';
          if (!['workspace', 'calendar'].includes(scope)) throw fail(400, 'Scope must be calendar or workspace.');
          const secret = 'sd_live_' + randomBytes(32).toString('hex'), id = hashKey(secret);
          const key = { id, uid, name, scope, prefix: secret.slice(0, 16), createdAt: now().toISOString(), expiresAt: new Date(now().getTime() + 90 * 86400000).toISOString(), revoked: false };
          const created = await store.createKey(key);
          if (!created) throw fail(409, 'You can have at most 10 active API keys. Revoke a key first.');
          return res.status(201).json({ data: keyMetadata(key), secret });
        }
        if (/^\/keys\/[a-f0-9]{64}$/.test(path) && req.method === 'DELETE') {
          if (!await store.revokeKey(path.split('/')[2], uid)) throw fail(404, 'API key was not found.');
          return res.json({ data: { revoked: true } });
        }
        throw fail(req.method === 'GET' ? 404 : 405, 'Unsupported key endpoint or method.');
      }
      const resources = ['workspace', 'clients', 'projects', 'tasks', 'invoices', 'payments', 'summary', 'calendar', 'calendar.ics'];
      const resource = path.slice(1);
      if (!resources.includes(resource)) throw fail(404, 'Endpoint was not found.');
      if (req.method !== 'GET') { res.set('Allow', 'GET'); throw fail(405, 'Data endpoints are read-only.'); }
      const workspace = await store.getWorkspace(uid);
      if (!workspace) throw fail(404, 'Workspace was not found. Open SoloDesk and save your first record.');
      let events;
      if (calendarRoute) {
        for (const field of ['from', 'to']) if (req.query[field] && (!/^\d{4}-\d{2}-\d{2}$/.test(req.query[field]) || !Number.isFinite(Date.parse(req.query[field])) || new Date(req.query[field] + 'T00:00:00Z').toISOString().slice(0, 10) !== req.query[field])) throw fail(400, 'Date filters must use YYYY-MM-DD.');
        if (req.query.from && req.query.to && req.query.from > req.query.to) throw fail(400, 'from must be on or before to.');
        events = calendarEvents(workspace, { from: req.query.from, to: req.query.to, includeCompleted: req.query.includeCompleted === 'true' });
        if (resource === 'calendar.ics') {
          res.set('Content-Type', 'text/calendar; charset=utf-8');
          res.set('Content-Disposition', 'inline; filename="solodesk-calendar.ics"');
          return res.send(calendarIcs(events, { namespace: hashKey(uid).slice(0, 16), now: now() }));
        }
      }
      const date = now().toISOString().slice(0, 10), invoices = (workspace.invoices || []).map(i => ({ ...i, computed: invoiceTotals(i, date) }));
      const payments = invoices.flatMap(i => (i.pays || []).map(p => ({ ...p, invoiceId: i.id, invoiceNumber: i.no, clientId: i.client })));
      let data;
      if (resource === 'calendar') data = events;
      else if (resource === 'workspace') data = { ...workspace, invoices };
      else if (resource === 'summary') data = {
        currency: workspace.settings?.cur || 'USD',
        revenueReceived: payments.reduce((sum, p) => sum + amount(p.amt), 0),
        outstandingBalance: invoices.filter(i => i.state === 'sent').reduce((sum, i) => sum + i.computed.balance, 0),
        overdueInvoices: invoices.filter(i => i.computed.status === 'Overdue').length,
        openTasks: (workspace.tasks || []).filter(t => t.status !== 'Done').length,
        activeProjects: (workspace.projects || []).filter(p => p.status === 'Active').length,
      };
      else data = resource === 'invoices' ? invoices : resource === 'payments' ? payments : workspace[resource] || [];
      const meta = { schemaVersion: 1, exportedAt: now().toISOString() };
      if (Array.isArray(data)) {
        const limit = req.query.limit === undefined ? 100 : Number(req.query.limit), offset = req.query.offset === undefined ? 0 : Number(req.query.offset);
        if (!Number.isInteger(limit) || limit < 1 || limit > 500 || !Number.isSafeInteger(offset) || offset < 0) throw fail(400, 'limit must be 1–500 and offset must be a non-negative integer.');
        Object.assign(meta, { total: data.length, limit, offset, nextOffset: offset + limit < data.length ? offset + limit : null });
        data = data.slice(offset, offset + limit);
      }
      return res.json({ data, meta });
    } catch (error) {
      return res.status(error.status || 500).json({ error: { message: error.status ? error.message : 'The API could not complete this request.' } });
    }
  };
}
