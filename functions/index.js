import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { onRequest } from 'firebase-functions/v2/https';
import { defineString } from 'firebase-functions/params';
import { createApi } from './api.js';
import * as excelFunctions from './excel-functions.js';

// Live Excel sync, deployed separately with: firebase deploy --only functions:excel
const { seal: _seal, unseal: _unseal, syncUser: _syncUser, disconnectUser: _disconnectUser, ...excelTriggers } = excelFunctions;
export const excel = excelTriggers;

initializeApp();
const db = getFirestore(), auth = getAuth();
const origins = defineString('API_ALLOWED_ORIGINS', { default: '', description: 'Comma-separated exact browser origins, including your SoloDesk Hosting origin. Empty blocks all browser origins; server-to-server requests still work.' });
const keys = db.collection('integrationKeys');
const store = {
  async getWorkspace(uid) {
    const snapshot = await db.doc(`solodeskWorkspaces/${uid}`).get();
    return snapshot.exists ? JSON.parse(snapshot.data().json) : null;
  },
  async getKey(id) { const snapshot = await keys.doc(id).get(); return snapshot.exists ? snapshot.data() : null; },
  async listKeys(uid) { const snapshot = await keys.where('uid', '==', uid).get(); return snapshot.docs.map(doc => doc.data()); },
  async createKey(key) {
    return db.runTransaction(async tx => {
      const account = db.doc(`integrationKeyOwners/${key.uid}`);
      // A per-owner write serializes concurrent creations, including when the query is empty.
      await tx.get(account);
      const existing = await tx.get(keys.where('uid', '==', key.uid));
      if (existing.docs.filter(doc => !doc.data().revoked && new Date(doc.data().expiresAt) > new Date()).length >= 10) return false;
      tx.set(account, { updatedAt: key.createdAt });
      tx.set(keys.doc(key.id), key);
      return true;
    });
  },
  async revokeKey(id, uid) {
    return db.runTransaction(async tx => {
      const ref = keys.doc(id), snapshot = await tx.get(ref);
      if (!snapshot.exists || snapshot.data().uid !== uid) return false;
      tx.update(ref, { revoked: true }); return true;
    });
  },
};
export const api = onRequest({ region: 'us-central1', maxInstances: 10, timeoutSeconds: 30, memory: '256MiB' }, (req, res) => createApi({
  store,
  verifyToken: token => auth.verifyIdToken(token, true),
  userExists: async uid => { try { const user = await auth.getUser(uid); return !user.disabled; } catch (e) { if (e.code === 'auth/user-not-found') return false; throw e; } },
  allowedOrigins: origins.value().split(',').map(x => x.trim()).filter(Boolean),
})(req, res));
