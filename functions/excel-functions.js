// Live Microsoft Excel sync (needs the Blaze plan). Deployed as the "excel" function group:
//   connect / oauthCallback        Microsoft sign-in (authorization code + PKCE); the refresh token is
//                                  encrypted and kept in solodeskPrivate/{uid}, which browsers cannot read.
//   link / unlink / syncNow / resolve / disconnect   called from the app.
//   webhook                        Microsoft change notifications for linked drives → queue a sync.
//   onQueue / onWorkspaceWrite     run a sync after a sheet change or a SoloDesk save.
//   maintain                       hourly: renew notification subscriptions and run a backstop sync.
// Changes from the sheet are left in solodeskSync/{uid}/inbox for the app to apply; the server never
// rewrites the workspace document, so it cannot collide with the app's own saves.
import { randomBytes, createHash, createCipheriv, createDecipheriv } from 'node:crypto';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineString, defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions';
import { DEFAULT_MAPPING, validateMapping, appRows, applyAppChanges } from './excel-sync.js';
import { createGraph, resolveWorkbook, syncLink, rowsHash } from './excel-runner.js';

const CLIENT_ID = defineString('MS_CLIENT_ID', { description: 'Application (client) ID of the Microsoft Entra app registration.' });
const TENANT = defineString('MS_TENANT', { default: 'common', description: '"common" for work, school and personal Microsoft accounts.' });
const APP_URL = defineString('SOLODESK_APP_URL', { description: 'SoloDesk origin, for example https://taskflow-solodesk.web.app' });
const REDIRECT_URI = defineString('MS_REDIRECT_URI', { description: 'Redirect URI registered with Microsoft; must reach excel-oauthCallback.' });
const WEBHOOK_URL = defineString('MS_WEBHOOK_URL', { description: 'Public HTTPS URL that reaches excel-webhook.' });
const CLIENT_SECRET = defineSecret('MS_CLIENT_SECRET');
const TOKEN_KEY = defineSecret('MS_TOKEN_KEY');
const SCOPES = 'offline_access User.Read Files.ReadWrite.All';
const base = { region: 'us-central1', maxInstances: 10, timeoutSeconds: 120, memory: '256MiB' };
const withSecrets = { ...base, secrets: [CLIENT_SECRET, TOKEN_KEY] };
const MAX_LINKS = 25, SUB_DAYS = 3;

const db = () => getFirestore();
const now = () => new Date().toISOString();
const need = request => { if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Sign in to SoloDesk first.'); return request.auth.uid; };
const text = (value, max) => typeof value === 'string' ? value.trim().slice(0, max) : '';

// AES-256-GCM with a 32-byte key kept in Secret Manager.
const key = () => { const k = Buffer.from(TOKEN_KEY.value(), 'base64'); if (k.length !== 32) throw new Error('MS_TOKEN_KEY must be 32 random bytes, base64-encoded.'); return k; };
export function seal(value, k = key()) { const iv = randomBytes(12), c = createCipheriv('aes-256-gcm', k, iv); const enc = Buffer.concat([c.update(value, 'utf8'), c.final()]); return [iv, c.getAuthTag(), enc].map(b => b.toString('base64')).join('.'); }
export function unseal(sealed, k = key()) { const [iv, tag, enc] = sealed.split('.').map(s => Buffer.from(s, 'base64')); const d = createDecipheriv('aes-256-gcm', k, iv); d.setAuthTag(tag); return Buffer.concat([d.update(enc), d.final()]).toString('utf8'); }

async function tokenRequest(params) {
  const res = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(TENANT.value())}/oauth2/v2.0/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID.value(), client_secret: CLIENT_SECRET.value(), scope: SCOPES, ...params }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error('Microsoft sign-in failed. Connect your account again.'), { code: json.error });
  return json;
}

async function accessToken(uid) {
  const ref = db().doc(`solodeskPrivate/${uid}`), sealed = (await ref.get()).get('microsoft.token');
  if (!sealed) throw new HttpsError('failed-precondition', 'Connect your Microsoft account first.');
  try {
    const t = await tokenRequest({ grant_type: 'refresh_token', refresh_token: unseal(sealed) });
    if (t.refresh_token) await ref.set({ microsoft: { token: seal(t.refresh_token) } }, { merge: true });
    return t.access_token;
  } catch (error) {
    if (error.code === 'invalid_grant') await db().doc(`solodeskSync/${uid}`).set({ microsoft: { error: 'Microsoft access expired or was removed. Connect again to keep syncing.' } }, { merge: true });
    throw error;
  }
}

// One change subscription per linked drive. Personal OneDrive only accepts the signed-in user's root.
async function ensureSubscriptions(uid, token) {
  const graph = createGraph(token);
  const [links, subs, account] = await Promise.all([
    db().collection(`solodeskSync/${uid}/links`).get(),
    db().collection('solodeskSyncSubs').where('uid', '==', uid).get(),
    db().doc(`solodeskSync/${uid}`).get(),
  ]);
  const needed = new Set(links.docs.map(d => d.get('driveId'))), covered = new Set();
  const soon = Date.now() + 24 * 3600e3, expires = new Date(Date.now() + SUB_DAYS * 24 * 3600e3).toISOString();
  for (const sub of subs.docs) {
    const driveId = sub.get('driveId');
    if (!needed.has(driveId) || covered.has(driveId)) { await graph.call('DELETE', `/subscriptions/${sub.id}`).catch(() => {}); await sub.ref.delete(); continue; }
    if (Date.parse(sub.get('expiresAt')) < soon) {
      try { await graph.call('PATCH', `/subscriptions/${sub.id}`, { expirationDateTime: expires }); await sub.ref.update({ expiresAt: expires }); }
      catch { await sub.ref.delete(); continue; }
    }
    covered.add(driveId);
  }
  for (const driveId of needed) {
    if (covered.has(driveId)) continue;
    const clientState = randomBytes(24).toString('base64url');
    const resource = driveId === account.get('microsoft.driveId') ? '/me/drive/root' : `/drives/${encodeURIComponent(driveId)}/root`;
    const sub = await graph.call('POST', '/subscriptions', { changeType: 'updated', notificationUrl: WEBHOOK_URL.value(), resource, expirationDateTime: expires, clientState });
    await db().doc(`solodeskSyncSubs/${sub.id}`).set({ uid, driveId, clientState, expiresAt: sub.expirationDateTime });
  }
}

// One sync per account at a time; requests that arrive meanwhile make the running sync go round again.
async function withLock(uid, run) {
  const ref = db().doc(`solodeskSyncLocks/${uid}`);
  const got = await db().runTransaction(async tx => {
    const lock = await tx.get(ref);
    if (lock.exists && lock.get('until') > Date.now()) { tx.update(ref, { rerun: true }); return false; }
    tx.set(ref, { until: Date.now() + 110000, rerun: false }); return true;
  });
  if (!got) return false;
  try {
    for (let round = 0; round < 3; round++) {
      await run();
      const again = await db().runTransaction(async tx => {
        const lock = await tx.get(ref);
        if (!lock.get('rerun')) return false;
        tx.update(ref, { rerun: false, until: Date.now() + 110000 }); return true;
      });
      if (!again) break;
    }
  } finally { await ref.delete(); }
  return true;
}

const predictedHash = (workspace, changes, scope) => { const copy = structuredClone(workspace); applyAppChanges(copy, changes, scope, ''); return rowsHash(appRows(copy, scope)); };

export async function syncUser(uid, { source = 'app', linkId, resolve = {} } = {}) {
  return withLock(uid, async () => {
    const links = (await db().collection(`solodeskSync/${uid}/links`).get()).docs.filter(d => !linkId || d.id === linkId);
    const snap = await db().doc(`solodeskWorkspaces/${uid}`).get();
    if (!links.length || !snap.exists) return;
    const workspace = JSON.parse(snap.get('core') ?? snap.get('json'));
    const inbox = await db().collection(`solodeskSync/${uid}/inbox`).get();
    const work = links.map(doc => {
      const link = { id: doc.id, ...doc.data() };
      const pending = inbox.docs.filter(d => d.get('linkId') === doc.id).flatMap(d => d.get('changes') || []);
      return { doc, link, pending };
    // A SoloDesk save that did not touch this project's or client's tasks needs no Excel round trip.
    }).filter(({ link, pending }) => source !== 'app' || link.status !== 'ok' || predictedHash(workspace, pending, link.scope) !== link.appHash);
    if (!work.length) return;
    let graph;
    try { graph = createGraph(await accessToken(uid)); }
    catch (error) { await Promise.all(work.map(({ doc }) => doc.ref.update({ status: 'error', error: error.message.slice(0, 300), lastTriedAt: now() }))); return; }
    for (const { doc, link, pending } of work) {
      try {
        const r = await syncLink({ graph, link, workspace, pending, newId: () => db().collection('solodeskSync').doc().id, resolve });
        const batch = db().batch();
        if (r.appChanges.length) batch.set(db().collection(`solodeskSync/${uid}/inbox`).doc(), { linkId: doc.id, scope: link.scope, changes: r.appChanges, createdAt: now() });
        batch.update(doc.ref, {
          base: r.base, appHash: predictedHash(workspace, [...pending, ...r.appChanges], link.scope),
          conflicts: r.conflicts.slice(0, 50), invalid: r.invalid.slice(0, 50),
          ...(r.removedInApp.length ? { removedInApp: FieldValue.arrayUnion(...r.removedInApp.map(x => x.id)) } : {}),
          ...(r.removedInSheet.length ? { removedInSheet: FieldValue.arrayUnion(...r.removedInSheet.map(x => x.id)) } : {}),
          lastSyncedAt: now(), status: 'ok', error: null, lastChanges: { toApp: r.appChanges.length, toSheet: r.writes },
        });
        await batch.commit();
      } catch (error) {
        logger.warn('Excel sync failed', { uid, link: doc.id, message: error.message });
        await doc.ref.update({ status: 'error', error: String(error.message).slice(0, 300), lastTriedAt: now() });
      }
    }
  });
}

const queue = uid => db().doc(`solodeskSyncQueue/${uid}`).set({ requestedAt: FieldValue.serverTimestamp() });

export const connect = onCall(base, async request => {
  const uid = need(request);
  const state = randomBytes(24).toString('base64url'), verifier = randomBytes(48).toString('base64url');
  await db().doc(`solodeskSyncStates/${state}`).set({ uid, verifier, expiresAt: Date.now() + 10 * 60000 });
  const url = new URL(`https://login.microsoftonline.com/${encodeURIComponent(TENANT.value())}/oauth2/v2.0/authorize`);
  for (const [k, v] of Object.entries({ client_id: CLIENT_ID.value(), response_type: 'code', redirect_uri: REDIRECT_URI.value(), response_mode: 'query', scope: SCOPES, state, code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256', prompt: 'select_account' })) url.searchParams.set(k, v);
  return { url: url.href };
});

export const oauthCallback = onRequest(withSecrets, async (req, res) => {
  const back = status => res.redirect(303, `${APP_URL.value()}/#/integrations?microsoft=${status}`);
  const state = String(req.query.state || ''), code = String(req.query.code || '');
  if (!state || !code || state.length > 100) return back(req.query.error === 'access_denied' ? 'cancelled' : 'failed');
  const ref = db().doc(`solodeskSyncStates/${state}`), saved = await ref.get();
  await ref.delete();
  if (!saved.exists || saved.get('expiresAt') < Date.now()) return back('expired');
  try {
    const uid = saved.get('uid');
    const t = await tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI.value(), code_verifier: saved.get('verifier') });
    const graph = createGraph(t.access_token);
    const [me, drive] = await Promise.all([graph.call('GET', '/me?$select=displayName,mail,userPrincipalName'), graph.call('GET', '/me/drive?$select=id').catch(() => null)]);
    await db().doc(`solodeskPrivate/${uid}`).set({ microsoft: { token: seal(t.refresh_token) } }, { merge: true });
    await db().doc(`solodeskSync/${uid}`).set({ microsoft: { account: me.mail || me.userPrincipalName || '', name: me.displayName || '', driveId: drive?.id || '', connectedAt: now(), error: null } }, { merge: true });
    back('connected');
  } catch (error) { logger.error('Microsoft connect failed', { message: error.message }); back('failed'); }
});

export const link = onCall(withSecrets, async request => {
  const uid = need(request), data = request.data || {};
  const scope = { kind: data.scope?.kind, id: text(data.scope?.id, 100) };
  if (!['project', 'client'].includes(scope.kind) || !scope.id) throw new HttpsError('invalid-argument', 'Choose a project or client to sync.');
  const snap = await db().doc(`solodeskWorkspaces/${uid}`).get();
  const workspace = snap.exists ? JSON.parse(snap.get('core') ?? snap.get('json')) : null;
  if (!workspace?.[scope.kind === 'project' ? 'projects' : 'clients'].some(r => r.id === scope.id)) throw new HttpsError('not-found', 'That project or client was not found. Save your workspace and try again.');
  let mapping;
  try { mapping = validateMapping(data.mapping || DEFAULT_MAPPING); } catch (error) { throw new HttpsError('invalid-argument', error.message); }
  const shareUrl = text(data.shareUrl, 2000);
  if (!/^https:\/\//.test(shareUrl)) throw new HttpsError('invalid-argument', 'Paste the workbook’s OneDrive or SharePoint link (Share → Copy link).');
  const existing = await db().collection(`solodeskSync/${uid}/links`).get();
  if (existing.size >= MAX_LINKS) throw new HttpsError('resource-exhausted', `You can link up to ${MAX_LINKS} sheets.`);
  const token = await accessToken(uid);
  let workbook;
  try { workbook = await resolveWorkbook(createGraph(token), shareUrl, text(data.worksheet, 31) || 'SoloDesk tasks'); }
  catch (error) { throw new HttpsError('failed-precondition', error.status === 404 || error.status === 403 ? 'Microsoft could not open that workbook with this account. Check the link and that you can edit it.' : error.message); }
  if (existing.docs.some(d => d.get('itemId') === workbook.itemId && d.get('worksheetId') === workbook.worksheetId)) throw new HttpsError('already-exists', 'That worksheet is already linked. Use another worksheet name.');
  const ref = db().collection(`solodeskSync/${uid}/links`).doc();
  await ref.set({ ...workbook, scope, mapping, base: {}, status: 'new', conflicts: [], invalid: [], removedInApp: [], removedInSheet: [], createdAt: now() });
  await ensureSubscriptions(uid, token);
  await syncUser(uid, { source: 'link', linkId: ref.id });
  return { id: ref.id, name: workbook.name, worksheet: workbook.worksheetName, webUrl: workbook.webUrl };
});

export const unlink = onCall(withSecrets, async request => {
  const uid = need(request), id = text(request.data?.linkId, 100);
  if (!id) throw new HttpsError('invalid-argument', 'Choose a linked sheet.');
  const inbox = await db().collection(`solodeskSync/${uid}/inbox`).where('linkId', '==', id).get();
  const batch = db().batch(); inbox.docs.forEach(d => batch.delete(d.ref)); batch.delete(db().doc(`solodeskSync/${uid}/links/${id}`)); await batch.commit();
  await ensureSubscriptions(uid, await accessToken(uid)).catch(() => {});
  return { ok: true };
});

export const syncNow = onCall(withSecrets, async request => {
  const uid = need(request);
  const ran = await syncUser(uid, { source: 'manual', linkId: text(request.data?.linkId, 100) || undefined });
  return { ok: true, queued: !ran };
});

export const resolve = onCall(withSecrets, async request => {
  const uid = need(request), { linkId, id, field, keep } = request.data || {};
  if (!['app', 'sheet'].includes(keep) || !['title', 'status', 'due', 'priority'].includes(field) || typeof id !== 'string' || typeof linkId !== 'string') throw new HttpsError('invalid-argument', 'Choose which version to keep.');
  await syncUser(uid, { source: 'manual', linkId, resolve: { [id + ':' + field]: keep } });
  return { ok: true };
});

export async function disconnectUser(uid) {
  const token = await accessToken(uid).catch(() => null);
  const subs = await db().collection('solodeskSyncSubs').where('uid', '==', uid).get();
  for (const sub of subs.docs) { if (token) await createGraph(token).call('DELETE', `/subscriptions/${sub.id}`).catch(() => {}); await sub.ref.delete(); }
  for (const name of ['links', 'inbox']) { const docs = await db().collection(`solodeskSync/${uid}/${name}`).get(); for (const d of docs.docs) await d.ref.delete(); }
  await Promise.all([db().doc(`solodeskPrivate/${uid}`).delete(), db().doc(`solodeskSync/${uid}`).delete(), db().doc(`solodeskSyncQueue/${uid}`).delete()]);
}
export const disconnect = onCall(withSecrets, async request => { await disconnectUser(need(request)); return { ok: true }; });

export const webhook = onRequest(base, async (req, res) => {
  // Microsoft checks the endpoint by asking it to echo a token as plain text.
  if (typeof req.query.validationToken === 'string') return res.status(200).type('text/plain').send(req.query.validationToken.slice(0, 1000));
  const items = Array.isArray(req.body?.value) ? req.body.value.slice(0, 100) : [];
  const users = new Set();
  for (const n of items) {
    if (typeof n?.subscriptionId !== 'string' || typeof n?.clientState !== 'string') continue;
    const sub = await db().doc(`solodeskSyncSubs/${n.subscriptionId}`).get();
    if (sub.exists && sub.get('clientState') === n.clientState) users.add(sub.get('uid'));
  }
  await Promise.all([...users].map(queue));
  res.status(202).send('');
});

export const onQueue = onDocumentWritten({ ...withSecrets, document: 'solodeskSyncQueue/{uid}' }, async event => {
  if (event.data?.after?.exists) await syncUser(event.params.uid, { source: 'sheet' });
});

export const onWorkspaceWrite = onDocumentWritten({ ...withSecrets, document: 'solodeskWorkspaces/{uid}' }, async event => {
  const uid = event.params.uid;
  if (!event.data?.after?.exists) { if ((await db().doc(`solodeskSync/${uid}`).get()).exists) await disconnectUser(uid); return; }
  if ((await db().collection(`solodeskSync/${uid}/links`).limit(1).get()).empty) return;
  await syncUser(uid, { source: 'app' });
});

export const maintain = onSchedule({ ...withSecrets, schedule: 'every 60 minutes', timeoutSeconds: 540 }, async () => {
  const subs = await db().collection('solodeskSyncSubs').limit(500).get();
  for (const uid of new Set(subs.docs.map(d => d.get('uid')))) {
    try { await ensureSubscriptions(uid, await accessToken(uid)); await queue(uid); }
    catch (error) { logger.warn('Excel maintenance failed', { uid, message: error.message }); }
  }
});
