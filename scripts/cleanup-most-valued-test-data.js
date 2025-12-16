/**
 * Cleanup Most Valued Test Data Script
 * Removes test chirps created by @kuralnews during Most Valued feature testing
 * 
 * Usage: node scripts/cleanup-most-valued-test-data.js
 * 
 * This script will:
 * - Find chirps created by @kuralnews in the last 24 hours
 * - Optionally filter by test-like content patterns
 * - Delete the identified test chirps
 */

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit,
  Timestamp,
  doc,
  getDoc,
  deleteDoc,
  writeBatch
} from 'firebase/firestore';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables (try env/.env first, then root .env)
const envPath = join(__dirname, '..', 'env', '.env');
const rootEnvPath = join(__dirname, '..', '.env');
try {
  config({ path: envPath });
} catch (error) {
  config({ path: rootEnvPath });
}

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Test content patterns to identify test chirps
const TEST_PATTERNS = [
  'High value post',
  'Low value post',
  'Old post',
  'Recent post',
  'Tech post',
  'Sports post',
  'For all post',
  'Tuned post',
  'My own post',
  'Blocked post',
  'Scheduled post',
  'Published post',
  'Dev post',
  'Test chirp created at',
];

function isTestChirp(chirp) {
  const text = (chirp.text || '').toLowerCase();
  return TEST_PATTERNS.some(pattern => text.includes(pattern.toLowerCase()));
}

async function findTestChirps(kuralNewsUserId, hoursAgo = 24) {
  console.log(`🔍 Finding test chirps created by @kuralnews in the last ${hoursAgo} hours...`);
  
  const cutoffDate = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
  const cutoffTimestamp = Timestamp.fromDate(cutoffDate);
  
  const q = query(
    collection(db, 'chirps'),
    where('authorId', '==', kuralNewsUserId),
    where('createdAt', '>=', cutoffTimestamp),
    orderBy('createdAt', 'desc'),
    limit(100)
  );
  
  const snapshot = await getDocs(q);
  const allChirps = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  
  // Filter by test patterns
  const testChirps = allChirps.filter(chirp => isTestChirp(chirp));
  
  console.log(`   Found ${allChirps.length} total chirps`);
  console.log(`   Found ${testChirps.length} test chirps (matching test patterns)`);
  
  return testChirps;
}

async function deleteChirps(chirpIds) {
  if (chirpIds.length === 0) {
    console.log('✅ No chirps to delete');
    return;
  }
  
  console.log(`\n🗑️  Deleting ${chirpIds.length} test chirps...`);
  
  const batch = writeBatch(db);
  let batchCount = 0;
  let deletedCount = 0;
  
  for (const chirpId of chirpIds) {
    if (batchCount >= 500) {
      await batch.commit();
      batchCount = 0;
      console.log(`   Deleted batch (${deletedCount}/${chirpIds.length})...`);
    }
    batch.delete(doc(db, 'chirps', chirpId));
    batchCount++;
    deletedCount++;
  }
  
  if (batchCount > 0) {
    await batch.commit();
  }
  
  console.log(`✅ Successfully deleted ${deletedCount} test chirps`);
}

async function main() {
  console.log('🧹 Most Valued Test Data Cleanup\n');
  console.log('='.repeat(60));
  
  // Check if credentials are configured
  if (!firebaseConfig.apiKey || firebaseConfig.apiKey === 'your_api_key_here') {
    console.error('❌ Firebase credentials not configured!');
    process.exit(1);
  }
  
  try {
    // Authenticate with @kuralnews account
    const kuralNewsEmail = process.env.KURAL_NEWS_EMAIL || 'news@kurral.app';
    const kuralNewsPassword = process.env.KURAL_NEWS_PASSWORD;
    
    if (!kuralNewsPassword) {
      console.error('❌ KURAL_NEWS_PASSWORD not found in .env!');
      process.exit(1);
    }
    
    console.log(`🔐 Authenticating with @kuralnews account...`);
    const userCredential = await signInWithEmailAndPassword(auth, kuralNewsEmail, kuralNewsPassword);
    const kuralNewsUserId = userCredential.user.uid;
    console.log(`✅ Authenticated as @kuralnews (UID: ${kuralNewsUserId})\n`);
    
    // Find test chirps
    const testChirps = await findTestChirps(kuralNewsUserId, 24);
    
    if (testChirps.length === 0) {
      console.log('\n✅ No test chirps found to clean up');
      process.exit(0);
    }
    
    // Show what will be deleted
    console.log('\n📋 Test chirps to be deleted:');
    testChirps.forEach((chirp, i) => {
      const preview = (chirp.text || '').substring(0, 50);
      const valueScore = chirp.valueScore?.total ? ` (value: ${(chirp.valueScore.total * 100).toFixed(0)})` : '';
      console.log(`   ${i + 1}. ${chirp.id}: "${preview}..."${valueScore}`);
    });
    
    // Delete the test chirps
    const chirpIds = testChirps.map(c => c.id);
    await deleteChirps(chirpIds);
    
    console.log('\n✅ Cleanup complete!');
    process.exit(0);
    
  } catch (error) {
    console.error('\n💥 Error:', error.message);
    if (error.code === 'auth/invalid-credential') {
      console.error('   Authentication failed. Check KURAL_NEWS_PASSWORD in .env');
    }
    process.exit(1);
  }
}

// Run cleanup
main();
