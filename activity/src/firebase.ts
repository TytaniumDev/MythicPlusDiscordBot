// Initialize Firebase
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Configuration should be loaded/hardcoded.
// Since this is a public web app, these credentials are public by definition.
// Users must add their own Firebase Config here or we can inject it during build.
// For now, I will use placeholders that the user must replace or provide instructions.

// HOWEVER, the user asked to avoid manually setting env vars.
// But for client-side Firebase, you usually NEED the config object in the code.
// I will attempt to load from environment variables if Vite supports them (VITE_...),
// but standard practice is often just embedding the config.

const firebaseConfig = {
  // Setup your project in Firebase Console -> Project Settings -> General -> Your Apps
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };
