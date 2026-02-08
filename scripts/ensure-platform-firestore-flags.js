/**
 * Ensure Platform Account Firestore Flags
 *
 * Updates existing users (by handle) with isPlatformAccount and platformAccountType.
 * Does NOT create users or touch Auth. Use after create:platform or when Firestore
 * docs exist but lack these flags (so getPlatformAccountByTopic can resolve them).
 *
 * Usage: node scripts/ensure-platform-firestore-flags.js
 * Requires: .env with VITE_FIREBASE_* or FIREBASE_* (same as create:platform).
 *
 * Note: Uses the Firestore client SDK. If you see "Missing or insufficient permissions",
 * Firestore rules require an authenticated context. Use the fixPlatformAccounts
 * callable from an authenticated app session instead, or run with Firebase Admin.
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, limit, doc, updateDoc } from 'firebase/firestore';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '..', '.env') });

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID || process.env.FIREBASE_APP_ID,
};

const requiredVars = ['apiKey', 'authDomain', 'projectId'];
const missingVars = requiredVars.filter((k) => !firebaseConfig[k]);
if (missingVars.length > 0) {
  console.error('❌ Missing Firebase env (VITE_FIREBASE_* or FIREBASE_*).');
  process.exit(1);
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const PLATFORM_ACCOUNTS = [
  { handle: 'kural', platformAccountType: 'main' },
  { handle: 'kuralnews', platformAccountType: 'news' },
  { handle: 'kuraltech', platformAccountType: 'tech' },
  { handle: 'kuralscience', platformAccountType: 'science' },
  { handle: 'kuralbusiness', platformAccountType: 'business' },
  { handle: 'kuralsports', platformAccountType: 'sports' },
  { handle: 'kuralhealth', platformAccountType: 'health' },
  { handle: 'kuralentertainment', platformAccountType: 'entertainment' },
  { handle: 'kuraldesign', platformAccountType: 'design' },
  { handle: 'kuralgaming', platformAccountType: 'gaming' },
];

async function main() {
  console.log('🔧 Ensuring platform account flags in Firestore (users)');
  console.log('='.repeat(50));

  let updated = 0;
  let missing = 0;

  for (const { handle, platformAccountType } of PLATFORM_ACCOUNTS) {
    const q = query(collection(db, 'users'), where('handle', '==', handle), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) {
      console.log(`   ⚠️  @${handle} not found in users (run: npm run create:platform)`);
      missing++;
      continue;
    }
    const ref = doc(db, 'users', snap.docs[0].id);
    await updateDoc(ref, {
      isPlatformAccount: true,
      platformAccountType,
      onboardingCompleted: true,
    });
    console.log(`   ✅ @${handle} → isPlatformAccount=true, platformAccountType=${platformAccountType}`);
    updated++;
  }

  console.log('='.repeat(50));
  console.log(`Updated: ${updated}, Missing: ${missing}`);
  if (missing > 0) {
    console.log('Run npm run create:platform to create missing bot accounts.');
  }
  console.log('');
}

function isPermissionError(e) {
  const m = (e?.message || '').toLowerCase();
  const c = (e?.code || '').toLowerCase();
  return m.includes('permission') || m.includes('insufficient') || c === 'permission-denied';
}

main().catch((e) => {
  if (isPermissionError(e)) {
    console.error('❌ Missing or insufficient permissions (Firestore client SDK is unauthenticated).');
    console.error('   Use the fixPlatformAccounts callable from an authenticated app, or run with Firebase Admin.');
    process.exit(1);
  }
  console.error('❌', e.message);
  process.exit(1);
});
