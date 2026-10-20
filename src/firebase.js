// Firebase setup. Config comes from environment variables (.env.local), never hardcoded.
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
};
// Keep SoloDesk records separate from other apps using the same Firebase project.
export const workspaceCollection = 'solodeskWorkspaces';
export const configured = !!(config.apiKey && config.projectId && config.appId && config.authDomain);
const app = configured ? initializeApp(config) : null;
export const firebaseOptions=config;
export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;
export const provider = new GoogleAuthProvider();
