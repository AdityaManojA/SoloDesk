// Keeps every client portal in step with the workspace: whenever shared work changes, the share is published
// again (a couple of seconds after the last edit), so there is no "Update portal" button to remember.
// It also brings in what clients do in their portal: comments on tasks, and link or file updates.
import { useEffect, useRef, useState } from 'react';
import { collection, deleteDoc, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { portalUpdate } from './workspace-upgrades';
import { applyClientUpdate } from './client-feed';

const DELAY = 2000;
export function usePortalSync({ d, user, demo, mut, toast }) {
  const [shares, setShares] = useState([]), [comments, setComments] = useState([]), [requests, setRequests] = useState([]), timer = useRef(null), writing = useRef(new Set());
  useEffect(() => {
    if (demo || !user || !db) { setShares([]); return; }
    return onSnapshot(collection(db, 'solodeskPortals', user.uid, 'shares'), snap => setShares(snap.docs.map(x => ({ id: x.id, ...x.data() }))), () => setShares([]));
  }, [user?.uid, demo]);
  useEffect(() => {
    if (!d || !shares.length) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      for (const share of shares) {
        const data = portalUpdate(d, share, user?.email);
        if (!data || writing.current.has(share.id)) continue;
        writing.current.add(share.id);
        setDoc(doc(db, 'solodeskPortals', user.uid, 'shares', share.id), { ownerUid: share.ownerUid, clientId: share.clientId, recipientUid: share.recipientUid, recipientEmail: share.recipientEmail, projectIds: share.projectIds || [], invoiceIds: share.invoiceIds || [], docIds: share.docIds || [], data })
          .catch(() => {}).finally(() => writing.current.delete(share.id));
      }
    }, DELAY);
    return () => clearTimeout(timer.current);
  }, [d, shares]);
  // Client comments (live) and link updates (applied once, then removed).
  const ids = shares.map(s => s.id).sort().join(',');
  useEffect(() => {
    if (demo || !user || !db || !ids) { setComments([]); setRequests([]); return; }
    const feeds = new Map(), reqs = new Map(), offs = [];
    for (const clientId of ids.split(',')) {
      const base = ['solodeskPortals', user.uid, 'shares', clientId];
      offs.push(onSnapshot(collection(db, ...base, 'comments'), snap => {
        feeds.set(clientId, snap.docs.map(x => ({ id: x.id, clientId, ...x.data(), at: x.data().at?.toDate?.().toISOString() || '' })));
        setComments([...feeds.values()].flat().sort((a, b) => a.at.localeCompare(b.at)));
      }, () => {}));
      offs.push(onSnapshot(collection(db, ...base, 'requests'), snap => {
        reqs.set(clientId, snap.docs.map(x => ({ id: x.id, clientId, ...x.data(), at: x.data().at?.toDate?.().toISOString() || '', repliedAt: x.data().repliedAt?.toDate?.().toISOString() || '' })));
        setRequests([...reqs.values()].flat().sort((a, b) => b.at.localeCompare(a.at)));
      }, () => {}));
      offs.push(onSnapshot(collection(db, ...base, 'updates'), snap => {
        for (const x of snap.docs) {
          mut(n => { const row = applyClientUpdate(n, clientId, x.data()); if (row) n.activity = [row, ...(n.activity || [])].slice(0, 500); });
          deleteDoc(x.ref).catch(() => {});
          toast(`${x.data().label || 'A link'} was updated by your client.`);
        }
      }, () => {}));
    }
    return () => offs.forEach(f => f());
  }, [ids, user?.uid, demo]);
  return { comments, shares, requests };
}

// Reply to a client (or leave a note they can see) on a shared task.
export const sendOwnerComment = (user, clientId, itemId, text) => import('firebase/firestore').then(({ addDoc, serverTimestamp }) =>
  addDoc(collection(db, 'solodeskPortals', user.uid, 'shares', clientId, 'comments'), { itemId, kind: 'comment', text: text.trim().slice(0, 1000), at: serverTimestamp(), email: (user.email || '').toLowerCase(), from: 'owner' }));

// Answer a client request with one of the reply labels (and your own timing for "custom").
export const replyToRequest = (user, clientId, requestId, reply, replyText = '', taskId) => import('firebase/firestore').then(({ updateDoc, serverTimestamp }) =>
  updateDoc(doc(db, 'solodeskPortals', user.uid, 'shares', clientId, 'requests', requestId), { reply, replyText: String(replyText || '').trim().slice(0, 200), repliedAt: serverTimestamp(), ...(taskId ? { taskId } : {}) }));
