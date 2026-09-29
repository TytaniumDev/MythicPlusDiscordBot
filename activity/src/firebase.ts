// Initialize Firebase
import { initializeApp } from 'firebase/app';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { connectAuthEmulator, getAuth, signInAnonymously } from 'firebase/auth';
import { reportError } from './lib/sentry';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// host:port of local Firebase emulators. Set only by the end-to-end smoke
// tests (scripts/smoke-test.sh); undefined in real builds.
const firestoreEmulatorHost = import.meta.env.VITE_FIRESTORE_EMULATOR_HOST as string | undefined;
const authEmulatorHost = import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_HOST as string | undefined;

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
if (firestoreEmulatorHost) {
  const sep = firestoreEmulatorHost.lastIndexOf(':');
  connectFirestoreEmulator(db, firestoreEmulatorHost.slice(0, sep), Number(firestoreEmulatorHost.slice(sep + 1)));
}
const functions = getFunctions(app);

// Auth is optional — getAuth() throws when the API key is missing (e.g. Storybook).
// Guard it so non-auth features keep working without Firebase credentials.
let auth: ReturnType<typeof getAuth> | null = null;
// Resolves once sign-in settles. Callables attach whichever user is signed in
// at call time (the SDK does not wait for sign-in), so anything that needs
// request.auth must await this first.
let authReady: Promise<void> = Promise.resolve();
try {
  const firebaseAuth = getAuth(app);
  auth = firebaseAuth;
  if (authEmulatorHost) {
    connectAuthEmulator(firebaseAuth, `http://${authEmulatorHost}`, { disableWarnings: true });
  }

  // Sign in anonymously so Cloud Function callables receive request.auth —
  // unless a session was restored. A player who signed in with Discord
  // (services/discordAuth.ts) stays signed in across launches; signing in
  // anonymously would replace them.
  authReady = firebaseAuth.authStateReady()
    .then(async () => {
      if (!firebaseAuth.currentUser) await signInAnonymously(firebaseAuth);
    })
    .catch((err: unknown) => {
      reportError(err, { tag: 'firebase.signIn' });
    });
} catch {
  // No valid Firebase config (e.g. Storybook) — auth features are unavailable.
  console.info('[Wheelson] Firebase Auth not initialized; auth features will be unavailable.');
}

export { db, functions, auth, authReady };
