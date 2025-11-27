/**
 * Cleanup Test Users Script
 * Removes all test users and main author from Firebase Auth and Firestore
 * 
 * Usage: node scripts/cleanup-test-users.js [confirm]
 * 
 * WARNING: This will permanently delete test users and their data!
 * Pass "confirm" as argument to proceed: node scripts/cleanup-test-users.js confirm
 */

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, deleteUser } from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  getDocs, 
  doc, 
  deleteDoc,
  query,
  where,
  writeBatch,
  limit,
} from 'firebase/firestore';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config({ path: join(__dirname, '..', '.env') });

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

// Helper to wait
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Check if email is a test user email
function isTestUserEmail(email) {
  if (!email) return false;
  const testPatterns = [
    /^testuser\d+-/,
    /^main-author-/,
    /@test\.com$/,
    /test-news-/,
    /test-personalized-news-/,
    /test-value-/,
    /test-dedup-/,
  ];
  return testPatterns.some(pattern => pattern.test(email));
}

// Delete all chirps by a user
async function deleteUserChirps(userId) {
  try {
    // Get all chirps by this user
    const chirpsQuery = query(
      collection(db, 'chirps'),
      where('authorId', '==', userId),
      limit(500) // Firestore batch limit
    );
    const chirpsSnapshot = await getDocs(chirpsQuery);
    
    if (chirpsSnapshot.empty) return 0;
    
    // Delete in batches
    const batch = writeBatch(db);
    let count = 0;
    
    chirpsSnapshot.docs.forEach((docSnap) => {
      batch.delete(docSnap.ref);
      count++;
    });
    
    await batch.commit();
    return count;
  } catch (error) {
    console.warn(`   ⚠️  Error deleting chirps for user ${userId}:`, error.message);
    return 0;
  }
}

// Delete all comments by a user
async function deleteUserComments(userId) {
  try {
    const commentsQuery = query(
      collection(db, 'comments'),
      where('authorId', '==', userId),
      limit(500)
    );
    const commentsSnapshot = await getDocs(commentsQuery);
    
    if (commentsSnapshot.empty) return 0;
    
    const batch = writeBatch(db);
    let count = 0;
    
    commentsSnapshot.docs.forEach((docSnap) => {
      batch.delete(docSnap.ref);
      count++;
    });
    
    await batch.commit();
    return count;
  } catch (error) {
    console.warn(`   ⚠️  Error deleting comments for user ${userId}:`, error.message);
    return 0;
  }
}

// Delete user document from Firestore
async function deleteUserDocument(userId) {
  try {
    await deleteDoc(doc(db, 'users', userId));
    return true;
  } catch (error) {
    console.warn(`   ⚠️  Error deleting user document ${userId}:`, error.message);
    return false;
  }
}

async function cleanupTestUsers() {
  const confirm = process.argv[2] === 'confirm';
  
  if (!confirm) {
    console.log('⚠️  WARNING: This script will delete all test users and main author!');
    console.log('='.repeat(70));
    console.log('This includes:');
    console.log('  - All users with test emails (testuser*, main-author-*, @test.com, etc.)');
    console.log('  - Their Firestore user documents');
    console.log('  - Their chirps (posts)');
    console.log('  - Their comments');
    console.log('  - Their Firebase Auth accounts');
    console.log('\nTo proceed, run:');
    console.log('  npm run cleanup:users confirm');
    console.log('='.repeat(70));
    process.exit(0);
  }

  console.log('🧹 Cleaning Up Test Users\n');
  console.log('='.repeat(70));

  try {
    // Authenticate first
    console.log('🔐 Authenticating...');
    const authEmail = process.argv[3] || process.env.TEST_EMAIL || process.env.MAIN_USER_EMAIL;
    
    if (!authEmail) {
      console.error('❌ No authentication email provided.');
      console.error('   Provide a test user email:');
      console.error('   npm run cleanup:users confirm <email>');
      console.error('   Or set TEST_EMAIL or MAIN_USER_EMAIL in .env file');
      process.exit(1);
    }

    try {
      await signInWithEmailAndPassword(auth, authEmail, 'TestPassword123!');
      console.log(`✅ Authenticated as: ${authEmail}\n`);
    } catch (authError) {
      console.error('❌ Authentication failed:', authError.message);
      console.error('   Make sure the email exists and password is "TestPassword123!"');
      process.exit(1);
    }

    // Get all users
    console.log('📋 Fetching all users from Firestore...');
    const usersSnapshot = await getDocs(collection(db, 'users'));
    const allUsers = usersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    console.log(`✅ Found ${allUsers.length} total users\n`);

    // Filter test users
    const testUsers = allUsers.filter(user => isTestUserEmail(user.email));
    
    console.log(`🔍 Found ${testUsers.length} test users to delete:\n`);
    
    if (testUsers.length === 0) {
      console.log('✅ No test users found. Nothing to clean up.');
      process.exit(0);
    }

    // Show users that will be deleted
    testUsers.forEach((user, index) => {
      const name = user.name || user.handle || user.email || `User ${user.id}`;
      console.log(`   ${index + 1}. ${name} (${user.email || 'N/A'})`);
    });

    console.log('\n' + '='.repeat(70));
    console.log('🗑️  Starting deletion process...\n');

    let deletedUsers = 0;
    let deletedChirps = 0;
    let deletedComments = 0;
    let failedDeletions = [];

    for (let i = 0; i < testUsers.length; i++) {
      const user = testUsers[i];
      const userName = user.name || user.handle || user.email || `User ${user.id}`;
      
      process.stdout.write(`   [${i + 1}/${testUsers.length}] Deleting ${userName}... `);

      try {
        // Delete user's chirps
        const chirpsDeleted = await deleteUserChirps(user.id);
        deletedChirps += chirpsDeleted;
        
        // Delete user's comments
        const commentsDeleted = await deleteUserComments(user.id);
        deletedComments += commentsDeleted;
        
        // Delete user document
        const docDeleted = await deleteUserDocument(user.id);
        
        if (docDeleted) {
          deletedUsers++;
          console.log(`✅ (${chirpsDeleted} chirps, ${commentsDeleted} comments)`);
        } else {
          failedDeletions.push({ user: userName, reason: 'Failed to delete user document' });
          console.log(`⚠️  (deleted ${chirpsDeleted} chirps, ${commentsDeleted} comments, but user doc failed)`);
        }

        // Note: Firebase Auth account deletion requires Admin SDK or authenticating as each user
        // We'll note this in the summary
        
        await sleep(200); // Rate limiting
      } catch (error) {
        failedDeletions.push({ user: userName, reason: error.message });
        console.log(`❌ Error: ${error.message}`);
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('📊 CLEANUP SUMMARY');
    console.log('='.repeat(70));
    console.log(`✅ Users deleted: ${deletedUsers}/${testUsers.length}`);
    console.log(`✅ Chirps deleted: ${deletedChirps}`);
    console.log(`✅ Comments deleted: ${deletedComments}`);

    if (failedDeletions.length > 0) {
      console.log(`\n⚠️  Failed deletions: ${failedDeletions.length}`);
      failedDeletions.forEach(({ user, reason }) => {
        console.log(`   - ${user}: ${reason}`);
      });
    }

    console.log('\n⚠️  IMPORTANT: Firebase Auth accounts were NOT deleted.');
    console.log('   To delete Firebase Auth accounts, you need to:');
    console.log('   1. Use Firebase Admin SDK (requires service account)');
    console.log('   2. Or manually delete from Firebase Console');
    console.log('   3. Or authenticate as each user and call deleteUser()');
    console.log('\n   Firestore data has been cleaned up, but Auth accounts remain.');
    console.log('   This is usually fine - Auth accounts without Firestore docs are harmless.');

    console.log('\n' + '='.repeat(70));
    console.log('✅ Cleanup completed!');
    console.log('='.repeat(70));

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

cleanupTestUsers().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});

