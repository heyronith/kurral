// Firebase configuration and initialization
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
const isBrowser = typeof window !== 'undefined';
// Safe env reader that works in both browser (import.meta.env) and Node (process.env)
const readEnv = (key) => {
    // Vite in browser
    const viteEnv = (typeof import.meta !== 'undefined' && import.meta.env) || {};
    if (viteEnv && viteEnv[key] !== undefined) {
        return viteEnv[key];
    }
    // Node / scripts
    if (typeof process !== 'undefined' && process.env && process.env[key] !== undefined) {
        return process.env[key];
    }
    return '';
};
// Firebase config - should be in environment variables in production
const firebaseConfig = {
    apiKey: readEnv('VITE_FIREBASE_API_KEY') || readEnv('FIREBASE_API_KEY') || '',
    authDomain: readEnv('VITE_FIREBASE_AUTH_DOMAIN') || readEnv('FIREBASE_AUTH_DOMAIN') || '',
    projectId: readEnv('VITE_FIREBASE_PROJECT_ID') || readEnv('FIREBASE_PROJECT_ID') || '',
    storageBucket: readEnv('VITE_FIREBASE_STORAGE_BUCKET') || readEnv('FIREBASE_STORAGE_BUCKET') || '',
    messagingSenderId: readEnv('VITE_FIREBASE_MESSAGING_SENDER_ID') || readEnv('FIREBASE_MESSAGING_SENDER_ID') || '',
    appId: readEnv('VITE_FIREBASE_APP_ID') || readEnv('FIREBASE_APP_ID') || '',
};
// Validate Firebase config
const isConfigValid = firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId;
if (!isConfigValid) {
    const errorMessage = 'Firebase configuration is missing required environment variables.\n\n' +
        'Please check your .env file and ensure the following variables are set:\n' +
        '- VITE_FIREBASE_API_KEY (or FIREBASE_API_KEY)\n' +
        '- VITE_FIREBASE_AUTH_DOMAIN (or FIREBASE_AUTH_DOMAIN)\n' +
        '- VITE_FIREBASE_PROJECT_ID (or FIREBASE_PROJECT_ID)\n\n' +
        'Current status:\n' +
        `- VITE_FIREBASE_API_KEY: ${firebaseConfig.apiKey ? '✓ set' : '✗ missing'}\n` +
        `- VITE_FIREBASE_AUTH_DOMAIN: ${firebaseConfig.authDomain ? '✓ set' : '✗ missing'}\n` +
        `- VITE_FIREBASE_PROJECT_ID: ${firebaseConfig.projectId ? '✓ set' : '✗ missing'}`;
    console.error('[Firebase] Missing required environment variables.');
    console.error('[Firebase]', errorMessage);
    // Create a clear error that will be caught by error boundary (browser only)
    if (isBrowser) {
        window.firebaseError = new Error(errorMessage);
    }
}
// Initialize Firebase (only if not already initialized)
let app;
try {
    if (getApps().length === 0) {
        if (!isConfigValid) {
            throw new Error('Firebase configuration is missing required environment variables. Please check your .env file and ensure VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, and VITE_FIREBASE_PROJECT_ID are set.');
        }
        app = initializeApp(firebaseConfig);
        console.log('[Firebase] Successfully initialized');
    }
    else {
        app = getApps()[0];
        console.log('[Firebase] Using existing app instance');
    }
}
catch (error) {
    console.error('[Firebase] Initialization failed:', error?.message || error);
    if (isBrowser) {
        window.firebaseError = error;
    }
    throw error;
}
let db;
let auth;
let storage;
try {
    db = getFirestore(app);
    auth = getAuth(app);
    storage = getStorage(app);
    console.log('[Firebase] Services initialized');
}
catch (error) {
    console.error('[Firebase] Service initialization failed:', error?.message || error);
    if (isBrowser) {
        window.firebaseError = error;
    }
    throw error;
}
export { db, auth, storage };
export default app;
