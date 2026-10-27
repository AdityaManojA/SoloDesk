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
  const [shares, setShares] = useState([]), [comments, setComments] = useState([]), [requests, setRequests] = useState([]), timer = useRef(null), writing = useRef(new Set()), pendingRetry = useRef(new Set()), latestShares = useRef([]), latestD = useRef(d);
  latestShares.current = shares;
  latestD.current = d;
  const config = shares.map(s => [s.id, ...(s.projectIds || []), '|', ...(s.invoiceIds || []), '|', ...(s.docIds || [])].join(',')).join(';');
  useEffect(() => {
    if (demo || !user || !db) { setShares([]); return; }
    return onSnapshot(collection(db, 'solodeskPortals', user.uid, 'shares'), snap => setShares(snap.docs.map(x => ({ id: x.id, ...x.data() }))), () => setShares([]));
  }, [user?.uid, demo]);
  useEffect(() => {
    if (!d || !latestShares.current.length) return;
    clearTimeout(timer.current);
    const syncShare = (share) => {
      const data = portalUpdate(latestD.current, share, user?.email);
      if (!data) return;
      if (writing.current.has(share.id)) {
        pendingRetry.current.add(share.id);
        return;
      }
      writing.current.add(share.id);
      setDoc(doc(db, 'solodeskPortals', user.uid, 'shares', share.id), { ownerUid: share.ownerUid, clientId: share.clientId, recipientUid: share.recipientUid, recipientEmail: share.recipientEmail, projectIds: share.projectIds || [], invoiceIds: share.invoiceIds || [], docIds: share.docIds || [], data })
        .catch(() => {}).finally(() => {
          writing.current.delete(share.id);
          if (pendingRetry.current.delete(share.id)) {
            const nextShare = latestShares.current.find(s => s.id === share.id);
            if (nextShare) syncShare(nextShare);
          }
        });
    };
    timer.current = setTimeout(() => {
      for (const share of latestShares.current) {
        syncShare(share);
      }
    }, DELAY);
    return () => clearTimeout(timer.current);
  }, [d, config]);
  // Client comments (live) and link updates (applied once, then removed).
  const ids = shares.map(s => s.id).sort().join(',');
  const activeSubs = useRef(new Map()), feeds = useRef(new Map()), reqs = useRef(new Map());
  useEffect(() => {
    if (demo || !user || !db || !ids) {
      activeSubs.current.forEach(offs => offs.forEach(f => f()));
      activeSubs.current.clear();
      feeds.current.clear();
      reqs.current.clear();
      setComments([]);
      setRequests([]);
      return;
    }
    const currentIdSet = new Set(ids.split(',').filter(Boolean));
    for (const [clientId, offs] of activeSubs.current.entries()) {
      if (!currentIdSet.has(clientId)) {
        offs.forEach(f => f());
        activeSubs.current.delete(clientId);
        feeds.current.delete(clientId);
        reqs.current.delete(clientId);
      }
    }
    for (const clientId of currentIdSet) {
      if (activeSubs.current.has(clientId)) continue;
      const base = ['solodeskPortals', user.uid, 'shares', clientId];
      const offs = [];
      offs.push(onSnapshot(collection(db, ...base, 'comments'), snap => {
        feeds.current.set(clientId, snap.docs.map(x => ({ id: x.id, clientId, ...x.data(), at: x.data().at?.toDate?.().toISOString() || '' })));
        setComments([...feeds.current.values()].flat().sort((a, b) => a.at.localeCompare(b.at)));
      }, () => {}));
      offs.push(onSnapshot(collection(db, ...base, 'requests'), snap => {
        reqs.current.set(clientId, snap.docs.map(x => ({ id: x.id, clientId, ...x.data(), at: x.data().at?.toDate?.().toISOString() || '', repliedAt: x.data().repliedAt?.toDate?.().toISOString() || '' })));
        setRequests([...reqs.current.values()].flat().sort((a, b) => b.at.localeCompare(a.at)));
      }, () => {}));
      offs.push(onSnapshot(collection(db, ...base, 'updates'), snap => {
        for (const x of snap.docs) {
          Promise.resolve(mut(n => { const row = applyClientUpdate(n, clientId, x.data()); if (row) n.activity = [row, ...(n.activity || [])].slice(0, 500); }))
            .then(saved => { if (saved) deleteDoc(x.ref).catch(() => {}); });
          toast(`${x.data().label || 'A link'} was updated by your client.`);
        }
      }, () => {}));
      activeSubs.current.set(clientId, offs);
    }
    setComments([...feeds.current.values()].flat().sort((a, b) => a.at.localeCompare(b.at)));
    setRequests([...reqs.current.values()].flat().sort((a, b) => b.at.localeCompare(a.at)));
    return () => {
      if (!user || demo) {
        activeSubs.current.forEach(offs => offs.forEach(f => f()));
        activeSubs.current.clear();
      }
    };
  }, [ids, user?.uid, demo]);
  return { comments, shares, requests };
}

// Reply to a client (or leave a note they can see) on a shared task.
export const sendOwnerComment = (user, clientId, itemId, text) => import('firebase/firestore').then(({ addDoc, serverTimestamp }) =>
  addDoc(collection(db, 'solodeskPortals', user.uid, 'shares', clientId, 'comments'), { itemId, kind: 'comment', text: text.trim().slice(0, 1000), at: serverTimestamp(), email: (user.email || '').toLowerCase(), from: 'owner' }));

// Forget a client's earlier answer, so a new request (or a withdrawn one) can't be "answered" by it.
export const clearResponse = (user, clientId, itemId) => import('firebase/firestore').then(({ deleteDoc }) =>
  deleteDoc(doc(db, 'solodeskPortals', user.uid, 'shares', clientId, 'responses', itemId))).catch(() => {});

// Delete a client request for good (rules: only the owner may delete).
export const deleteRequest = (user, clientId, requestId) => import('firebase/firestore').then(({ deleteDoc }) =>
  deleteDoc(doc(db, 'solodeskPortals', user.uid, 'shares', clientId, 'requests', requestId)));

// Answer a client request with one of the reply labels (and your own timing for "custom").
export const replyToRequest = (user, clientId, requestId, reply, replyText = '', taskId) => import('firebase/firestore').then(({ updateDoc, serverTimestamp }) =>
  updateDoc(doc(db, 'solodeskPortals', user.uid, 'shares', clientId, 'requests', requestId), { reply, replyText: String(replyText || '').trim().slice(0, 200), repliedAt: serverTimestamp(), ...(taskId ? { taskId } : {}) }));

// Revoke a client share and remove its subcollections (responses, comments, requests, updates)
export async function deletePortalShare(dbInstance, ownerUid, clientId) {
  if (!dbInstance || !ownerUid || !clientId) return;
  const { collection, getDocs, deleteDoc, doc, writeBatch } = await import('firebase/firestore');
  const shareRef = doc(dbInstance, 'solodeskPortals', ownerUid, 'shares', clientId);
  for (const sub of ['responses', 'comments', 'requests', 'updates']) {
    try {
      const snap = await getDocs(collection(shareRef, sub));
      if (!snap.empty) {
        const batch = writeBatch(dbInstance);
        snap.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
    } catch {}
  }
  await deleteDoc(shareRef);
}
