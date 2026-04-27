// Initialize Firebase
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { reportError } from './lib/sentry';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const functions = getFunctions(app);

// Auth is optional — getAuth() throws when the API key is missing (e.g. Storybook).
// Guard it so non-auth features keep working without Firebase credentials.
let auth: ReturnType<typeof getAuth> | null = null;
try {
  auth = getAuth(app);

  // Sign in anonymously so Cloud Function callables receive request.auth.
  // The promise is not awaited here — Firebase SDK queues callable requests
  // until auth resolves, so functions called after import will work correctly.
  signInAnonymously(auth).catch((err) => {
    reportError(err, { tag: 'firebase.signIn' });
  });
} catch {
  // No valid Firebase config (e.g. Storybook) — auth features are unavailable.
  console.info('[Wheelson] Firebase Auth not initialized; auth features will be unavailable.');
}

export { db, functions, auth };
