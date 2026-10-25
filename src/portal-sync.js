// Keeps every client portal in step with the workspace: whenever shared work changes, the share is published
// again (a couple of seconds after the last edit), so there is no "Update portal" button to remember.
import { useEffect, useRef, useState } from 'react';
import { collection, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { portalUpdate } from './workspace-upgrades';

const DELAY = 2000;
export function usePortalSync({ d, user, demo }) {
  const [shares, setShares] = useState([]), timer = useRef(null), writing = useRef(new Set());
  useEffect(() => {
    if (demo || !user || !db) { setShares([]); return; }
    return onSnapshot(collection(db, 'solodeskPortals', user.uid, 'shares'), snap => setShares(snap.docs.map(x => ({ id: x.id, ...x.data() }))), () => setShares([]));
  }, [user?.uid, demo]);
  useEffect(() => {
    if (!d || !shares.length) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      for (const share of shares) {
        const data = portalUpdate(d, share);
        if (!data || writing.current.has(share.id)) continue;
        writing.current.add(share.id);
        setDoc(doc(db, 'solodeskPortals', user.uid, 'shares', share.id), { ownerUid: share.ownerUid, clientId: share.clientId, recipientUid: share.recipientUid, recipientEmail: share.recipientEmail, projectIds: share.projectIds || [], invoiceIds: share.invoiceIds || [], docIds: share.docIds || [], data })
          .catch(() => {}).finally(() => writing.current.delete(share.id));
      }
    }, DELAY);
    return () => clearTimeout(timer.current);
  }, [d, shares]);
}
