// How a workspace is laid out in Firestore. Firestore caps one document at 1 MB, so the lists that grow
// without limit (notes, documents and PRDs, activity, focus history, trash) live in their own documents under
// solodeskWorkspaces/{uid}/parts/{list}.{n}, each holding up to ~900 KB of items. The main document keeps
// everything else in `core` and lists the part ids in `parts`.
//
// Old app versions read `json`. In the split layout it holds a marker their validation rejects, so an old tab
// shows a load error instead of saving a workspace with those lists missing.
export const PART_LISTS = ['notes', 'docs', 'activity', 'focusSessions', 'trash'];
export const PART_BYTES = 900_000;
export const SPLIT_MARKER = JSON.stringify({ splitStorage: 2, message: 'This workspace was saved by a newer SoloDesk. Reload the page.' });
const bytes = s => new TextEncoder().encode(s).byteLength;

export function splitWorkspace(workspace) {
  const core = { ...workspace }, parts = {};
  for (const list of PART_LISTS) {
    const items = core[list];
    if (!Array.isArray(items) || !items.length) continue;
    delete core[list];
    let chunk = [], size = 2, n = 0;
    for (const item of items) {
      const s = JSON.stringify(item), b = bytes(s) + 1;
      if (b > PART_BYTES) throw Object.assign(new Error(`One item in ${list} is too large to save (over ${Math.round(PART_BYTES / 1000)} KB). Shorten it, then retry.`), { code: 'workspace-too-large' });
      if (size + b > PART_BYTES && chunk.length) { parts[`${list}.${n++}`] = JSON.stringify(chunk); chunk = []; size = 2; }
      chunk.push(item); size += b;
    }
    if (chunk.length) parts[`${list}.${n}`] = JSON.stringify(chunk);
  }
  const coreJson = JSON.stringify(core);
  if (bytes(coreJson) > PART_BYTES) throw Object.assign(new Error('Workspace too large to save. Changes remain in this tab. Export a JSON backup, then reduce large client notes or the business logo before retrying.'), { code: 'workspace-too-large' });
  return { core: coreJson, parts };
}

// Rebuild the workspace from the main document's data and its part documents ({id: json}).
export function joinWorkspace(data, partDocs = {}) {
  if (!data) return null;
  if (!data.core) return data.json ? JSON.parse(data.json) : null;
  const workspace = JSON.parse(data.core);
  for (const id of data.parts || []) {
    const list = id.slice(0, id.lastIndexOf('.'));
    if (!(id in partDocs)) throw Object.assign(new Error('Part of this workspace is missing. Reload to try again.'), { code: 'workspace-part-missing' });
    workspace[list] = [...(workspace[list] || []), ...JSON.parse(partDocs[id])];
  }
  return workspace;
}

// Fixed form used as the save baseline: the same workspace always gives the same string, however it was stored.
export const baselineOf = workspace => workspace == null ? null : JSON.stringify(sortKeys(workspace));
const sortKeys = w => Object.fromEntries(Object.keys(w).sort().map(k => [k, w[k]]));

// One save, inside a Firestore transaction. refOf(null) is the main document, refOf(id) a part. Throws a
// 'workspace-conflict' error when the stored workspace no longer matches `baseline` (changed elsewhere).
export async function writeWorkspace(tx, refOf, value, baseline, assertUnchanged) {
  const { core, parts } = splitWorkspace(value);
  const snap = await tx.get(refOf(null)), data = snap.exists() ? snap.data() : null, oldIds = data?.parts || [];
  const partSnaps = await Promise.all(oldIds.map(id => tx.get(refOf(id))));
  const partDocs = Object.fromEntries(partSnaps.filter(s => s.exists()).map((s, i) => [s.id ?? oldIds[i], s.data().json]));
  let current; try { current = baselineOf(joinWorkspace(data, partDocs)); } catch { current = 'missing-part'; }
  assertUnchanged(current, baseline);
  for (const [id, json] of Object.entries(parts)) if (partDocs[id] !== json) tx.set(refOf(id), { json });
  for (const id of oldIds) if (!(id in parts)) tx.delete(refOf(id));
  tx.set(refOf(null), { json: SPLIT_MARKER, core, parts: Object.keys(parts), v: 2 });
  return baselineOf(value);
}
