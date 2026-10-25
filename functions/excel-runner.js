// Runs one sync of a linked worksheet through Microsoft Graph. Dependencies are passed in so tests can use
// an in-memory workbook.
import { createHash } from 'node:crypto';
import { appRows, applyAppChanges, parseSheet, planSync, sheetWrites } from './excel-sync.js';

const GRAPH = 'https://graph.microsoft.com/v1.0';
const fail = (message, extra = {}) => Object.assign(new Error(message), extra);

export function createGraph(token, fetchImpl = globalThis.fetch) {
  const call = async (method, path, body) => {
    const res = await fetchImpl(GRAPH + path, { method, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    if (res.status === 204) return null;
    const json = await res.json().catch(() => null);
    if (!res.ok) throw fail(json?.error?.message || 'Microsoft request failed (' + res.status + ').', { status: res.status, code: json?.error?.code });
    return json;
  };
  return {
    call,
    // Graph JSON batching: up to 20 requests per call.
    async batch(requests) {
      for (let i = 0; i < requests.length; i += 20) {
        const chunk = requests.slice(i, i + 20).map((r, k) => ({ id: String(k + 1), method: r.method, url: r.url, body: r.body, headers: { 'Content-Type': 'application/json' } }));
        const result = await call('POST', '/$batch', { requests: chunk });
        const failed = (result?.responses || []).find(r => r.status >= 400);
        if (failed) throw fail(failed.body?.error?.message || 'Microsoft could not update the sheet.', { status: failed.status });
      }
    },
  };
}

// "u!" + unpadded base64url of the sharing link, as Graph's /shares endpoint expects.
export const shareId = url => 'u!' + Buffer.from(String(url).trim()).toString('base64').replace(/=+$/, '').replace(/\//g, '_').replace(/\+/g, '-');
export const worksheetPath = link => `/drives/${encodeURIComponent(link.driveId)}/items/${encodeURIComponent(link.itemId)}/workbook/worksheets/${encodeURIComponent(link.worksheetId)}`;
export const rowsHash = rows => createHash('sha256').update(JSON.stringify(rows)).digest('hex');

// "'Tasks'!B3:F10" → zero-based origin and last row.
export function parseAddress(address) {
  const m = /!?\$?([A-Z]+)\$?(\d+)(?::\$?[A-Z]+\$?(\d+))?$/.exec(String(address || ''));
  if (!m) return { row: 0, col: 0, lastRow: -1 };
  const col = [...m[1]].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
  return { row: Number(m[2]) - 1, col, lastRow: Number(m[3] || m[2]) - 1 };
}

export async function readWorksheet(graph, link) {
  const used = await graph.call('GET', worksheetPath(link) + '/usedRange(valuesOnly=true)?$select=address,values');
  const values = used?.values || [];
  const empty = !values.some(r => r.some(c => String(c ?? '').trim() !== ''));
  const at = parseAddress(used?.address);
  return { values: empty ? [] : values, origin: { row: empty ? 0 : at.row, col: empty ? 0 : at.col }, lastRow: empty ? -1 : at.lastRow };
}

// Resolves a OneDrive/SharePoint sharing link to a workbook and makes sure the worksheet exists.
export async function resolveWorkbook(graph, shareUrl, worksheetName) {
  const item = await graph.call('GET', `/shares/${shareId(shareUrl)}/driveItem?$select=id,name,webUrl,parentReference,file`);
  if (!/\.xlsx$/i.test(item?.name || '')) throw fail('Choose an Excel workbook (.xlsx) stored in OneDrive or SharePoint.', { status: 400 });
  const base = `/drives/${encodeURIComponent(item.parentReference.driveId)}/items/${encodeURIComponent(item.id)}/workbook/worksheets`;
  const sheets = (await graph.call('GET', base + '?$select=id,name'))?.value || [];
  let sheet = sheets.find(s => s.name.toLowerCase() === worksheetName.toLowerCase());
  if (!sheet) sheet = await graph.call('POST', base + '/add', { name: worksheetName });
  return { driveId: item.parentReference.driveId, itemId: item.id, name: item.name, webUrl: item.webUrl, worksheetId: sheet.id, worksheetName: sheet.name };
}

export async function syncLink({ graph, link, workspace, pending = [], newId, now = new Date().toISOString(), resolve = {} }) {
  // Changes already sent to the app but not yet applied count as Terracove's current state.
  const effective = structuredClone(workspace);
  applyAppChanges(effective, pending, link.scope, now);
  const app = appRows(effective, link.scope);
  const ws = worksheetPath(link);
  let sheet = await readWorksheet(graph, link);
  if (!sheet.values.length) {
    const header = [link.mapping.map(m => m.column)];
    await graph.call('PATCH', `${ws}/range(address='A1:${String.fromCharCode(64 + header[0].length)}1')`, { values: header });
    sheet = { values: header, origin: { row: 0, col: 0 }, lastRow: 0 };
  }
  const parsed = parseSheet(sheet.values, link.mapping);
  if (parsed.missing.length) throw fail('The sheet is missing these columns: ' + parsed.missing.join(', ') + '. Add them to the header row or update the column mapping.', { code: 'missing-columns' });
  const plan = planSync({ app, sheet: parsed, base: link.base || {}, mapping: link.mapping, newId, resolve });
  const writes = sheetWrites(plan, parsed, sheet.origin, sheet.lastRow);
  await graph.batch(writes.map(w => ({ method: 'PATCH', url: `${ws}/range(address='${w.address}')`, body: { values: w.values } })));
  return { appChanges: plan.app, base: plan.base, conflicts: plan.conflicts, invalid: plan.invalid, removedInApp: plan.removedInApp, removedInSheet: plan.removedInSheet, writes: writes.length, appHash: rowsHash(app) };
}
