/**
 * Quick Fix Script - Update Main User Following List
 * 
 * This script fixes the main user's following list if it's empty or incorrect.
 * 
 * Usage: node scripts/fix-main-user-following.js <userEmail>
 * 
 * Or set MAIN_USER_EMAIL in .env file
 */

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  getDocs, 
  query, 
  where, 
  limit,
  doc,
  getDoc,
  updateDoc,
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

// Get user email from command line or env
const userEmail = process.argv[2] || process.env.MAIN_USER_EMAIL || '';

async function fixFollowingList() {
  if (!userEmail) {
    console.error('❌ Please provide user email:');
    console.error('   node scripts/fix-main-user-following.js <userEmail>');
    console.error('   Or set MAIN_USER_EMAIL in .env file');
    process.exit(1);
  }

  console.log('🔧 Fixing Main User Following List\n');
  console.log('='.repeat(70));

  try {
    // Sign in as the user
    console.log(`📧 Signing in as: ${userEmail}`);
    const userCredential = await signInWithEmailAndPassword(auth, userEmail, 'TestPassword123!');
    const userId = userCredential.user.uid;
    console.log(`✅ Signed in. User ID: ${userId}\n`);

    // Get all other users
    console.log('📋 Getting list of all users...');
    const usersSnapshot = await getDocs(collection(db, 'users'));
    const allUsers = usersSnapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(user => user.id !== userId); // Exclude main user
    
    console.log(`✅ Found ${allUsers.length} other users\n`);

    // Select 15-20 users to follow
    const usersToFollow = allUsers
      .sort(() => Math.random() - 0.5) // Shuffle
      .slice(0, Math.min(20, allUsers.length))
      .map(user => user.id);

    console.log(`📝 Updating following list to include ${usersToFollow.length} users...`);

    // Update following list
    await updateDoc(doc(db, 'users', userId), {
      following: usersToFollow,
    });

    // Verify the update
    await new Promise(resolve => setTimeout(resolve, 500)); // Wait for write
    const verifyDoc = await getDoc(doc(db, 'users', userId));
    
    if (verifyDoc.exists()) {
      const data = verifyDoc.data();
      const following = data.following || [];
      console.log(`✅ Following list updated!`);
      console.log(`   Following count: ${following.length} users`);
      
      if (following.length === 0) {
        console.error(`\n❌ Following list is still empty!`);
        console.error(`   This might be a Firestore permissions issue.`);
        console.error(`   Check firestore.rules to ensure users can update their own following list.`);
      } else {
        console.log(`\n✅ SUCCESS! Main user now follows ${following.length} users.`);
        console.log(`\n💡 Next steps:`);
        console.log(`   1. Log out and log back in to the app`);
        console.log(`   2. Check the "Latest" feed - should show posts from followed users`);
        console.log(`   3. Check your profile - following count should be ${following.length}`);
      }
    } else {
      console.error(`❌ User document not found!`);
    }

    console.log('\n' + '='.repeat(70));

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.code === 'auth/user-not-found') {
      console.error('   User not found. Make sure the email is correct.');
    } else if (error.code === 'auth/wrong-password') {
      console.error('   Wrong password. Default password is: TestPassword123!');
    } else if (error.code === 'permission-denied') {
      console.error('   Permission denied. Check Firestore security rules.');
    }
    process.exit(1);
  }
}

fixFollowingList().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});

