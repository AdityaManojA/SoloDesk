// Browser side of live Excel sync. The server never edits the workspace document directly: it leaves
// changes from the sheet in solodeskSync/{uid}/inbox, and the open app applies them like any other edit.
import { collection, onSnapshot, deleteDoc } from 'firebase/firestore';
import { app, db } from './firebase';
import { applyAppChanges } from '../functions/excel-sync.js';

export function watchSyncInbox(uid, mut) {
  if (!db || !uid) return () => {};
  const handled = new Set();
  return onSnapshot(collection(db, 'solodeskSync', uid, 'inbox'), snapshot => {
    for (const item of snapshot.docs) {
      if (handled.has(item.id)) continue;
      handled.add(item.id);
      const { changes = [], scope } = item.data();
      // Clear the inbox entry only after the workspace has saved, so a closed tab never loses a change.
      Promise.resolve(mut(n => { applyAppChanges(n, changes, scope); })).then(saved => { if (saved) return deleteDoc(item.ref); handled.delete(item.id); }).catch(() => handled.delete(item.id));
    }
  }, () => {});
}

// Server actions: connect, link, unlink, syncNow, resolve, disconnect.
export async function excel(action, data = {}) {
  if (!app) throw new Error('Excel sync needs the hosted app with Firebase configured.');
  const { getFunctions, httpsCallable } = await import('firebase/functions');
  const result = await httpsCallable(getFunctions(app, 'us-central1'), 'excel-' + action)(data);
  return result.data;
}
