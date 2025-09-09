// Firebase configuration and initialization
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

const firebaseConfig = {
  // TODO: Replace with your Firebase project configuration
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Initialize Firebase services
export const db = getFirestore(app);
export const auth = getAuth(app);
export const functions = getFunctions(app);

// Connect to emulators in development
if (process.env.NODE_ENV === 'development') {
  try {
    // Only connect if not already connected
    if (!globalThis.FIRESTORE_EMULATOR_CONNECTED) {
      connectFirestoreEmulator(db, 'localhost', 8080);
      globalThis.FIRESTORE_EMULATOR_CONNECTED = true;
    }
    if (!globalThis.AUTH_EMULATOR_CONNECTED) {
      connectAuthEmulator(auth, 'http://localhost:9099');
      globalThis.AUTH_EMULATOR_CONNECTED = true;
    }
    if (!globalThis.FUNCTIONS_EMULATOR_CONNECTED) {
      connectFunctionsEmulator(functions, 'localhost', 5001);
      globalThis.FUNCTIONS_EMULATOR_CONNECTED = true;
    }
  } catch (error) {
    console.log('Emulator connection error (this is normal if already connected):', error);
  }
}

export default app;