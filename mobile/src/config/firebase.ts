import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  initializeAuth,
  getReactNativePersistence,
  type Auth,
} from 'firebase/auth';
import {
  getFirestore,
  type Firestore,
} from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import { getFunctions, type Functions } from 'firebase/functions';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// Read environment variables from Expo config
const getEnvVar = (key: string): string => {
  // Expo exposes env vars via Constants.expoConfig.extra
  const value = Constants.expoConfig?.extra?.[key] || process.env[key];
  if (!value) {
    console.error(`[firebase] Missing environment variable: ${key}`);
  }
  return value || '';
};

const firebaseConfig = {
  apiKey: getEnvVar('EXPO_PUBLIC_FIREBASE_API_KEY'),
  authDomain: getEnvVar('EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN'),
  projectId: getEnvVar('EXPO_PUBLIC_FIREBASE_PROJECT_ID'),
  storageBucket: getEnvVar('EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getEnvVar('EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'),
  appId: getEnvVar('EXPO_PUBLIC_FIREBASE_APP_ID'),
};

// Validate config
// #region agent log
fetch('http://127.0.0.1:7242/ingest/79478aa2-e9cd-47a0-9d85-d37e8b5e454c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'mobile/src/config/firebase.ts:37',message:'Checking firebase config',data:{hasApiKey: !!firebaseConfig.apiKey, hasAuthDomain: !!firebaseConfig.authDomain},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'env-vars'})}).catch(()=>{});
// #endregion
if (!firebaseConfig.apiKey) {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/79478aa2-e9cd-47a0-9d85-d37e8b5e454c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'mobile/src/config/firebase.ts:39',message:'Missing API Key - Throwing Error',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'env-vars'})}).catch(()=>{});
  // #endregion
  throw new Error(
    'Firebase API key is missing. Please set EXPO_PUBLIC_FIREBASE_API_KEY in your .env file and restart the development server.'
  );
}

let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0]!;
}

// Use React Native persistence for Auth in Expo Go
let auth: Auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch {
  auth = getAuth(app);
}

const db: Firestore = getFirestore(app);
const storage: FirebaseStorage = getStorage(app);
const functions: Functions = getFunctions(app);

export { app, auth, db, storage, functions };

