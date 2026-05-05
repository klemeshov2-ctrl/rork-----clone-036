import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import type { FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';

function getFirebaseConfig() {
  const extraFirebase = Constants.expoConfig?.extra?.firebase;
  return {
    apiKey: extraFirebase?.apiKey || process.env.EXPO_PUBLIC_FIREBASE_API_KEY || '',
    authDomain: extraFirebase?.authDomain || process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
    projectId: extraFirebase?.projectId || process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || '',
    storageBucket: extraFirebase?.storageBucket || process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: extraFirebase?.messagingSenderId || process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: extraFirebase?.appId || process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '',
  };
}

const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';
const canInit = Platform.OS !== 'web' || isBrowser;

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;

if (canInit) {
  try {
    const config = getFirebaseConfig();
    console.log('[Firebase] Initializing with project:', config.projectId);
    if (!config.apiKey) {
      console.error('[Firebase] WARNING: No API key found!');
    }

    // Use require to avoid evaluating Firebase modules during web SSR.
    const { initializeApp } = require('firebase/app');
    const firebaseAuth = require('firebase/auth');
    const { getFirestore } = require('firebase/firestore');

    app = initializeApp(config);

    if (Platform.OS === 'web') {
      auth = firebaseAuth.getAuth(app);
    } else {
      auth = firebaseAuth.initializeAuth(app, {
        persistence: firebaseAuth.getReactNativePersistence(AsyncStorage),
      });
    }

    db = getFirestore(app);

    console.log('[Firebase] DB ready:', !!db);
    console.log('[Firebase] Auth ready:', !!auth);

    if (auth) {
      firebaseAuth.signInAnonymously(auth).catch((err: Error) => {
        console.error('[Firebase] Anonymous auth error:', err?.message);
      });
    }
  } catch (err) {
    console.error('[Firebase] Init error:', (err as Error)?.message);
  }
} else {
  console.log('[Firebase] Skipping init (SSR)');
}

const authExport = auth as Auth;
const dbExport = db as Firestore;
export { authExport as auth, dbExport as db, dbExport as firestore };
