/**
 * Verify User Posts Script
 * Checks if all test users have posts in their profiles
 * 
 * Usage: node scripts/verify-user-posts.js
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
  doc,
  getDoc,
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

// Get user email from command line or env (for authentication)
const authEmail = process.argv[2] || process.env.TEST_EMAIL || process.env.MAIN_USER_EMAIL || '';

// Helper to get posts for a user
async function getUserPosts(userId) {
  try {
    const q = query(
      collection(db, 'chirps'),
      where('authorId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    // If index doesn't exist, try without orderBy
    try {
      const q = query(
        collection(db, 'chirps'),
        where('authorId', '==', userId)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (fallbackError) {
      console.warn(`   ⚠️  Error fetching posts for user ${userId}:`, fallbackError.message);
      return [];
    }
  }
}

async function verifyUserPosts() {
  console.log('🔍 Verifying User Posts\n');
  console.log('='.repeat(70));

  try {
    // Authenticate first
    console.log('🔐 Authenticating...');
    
    if (!authEmail) {
      console.error('❌ No authentication email provided.');
      console.error('   Please provide a test user email:');
      console.error('   npm run verify:posts <email>');
      console.error('   Or set TEST_EMAIL or MAIN_USER_EMAIL in .env file');
      process.exit(1);
    }
    
    try {
      await signInWithEmailAndPassword(auth, authEmail, 'TestPassword123!');
      console.log(`✅ Authenticated as: ${authEmail}\n`);
    } catch (authError) {
      console.error('❌ Authentication failed:', authError.message);
      console.error('   Make sure the email exists and password is "TestPassword123!"');
      console.error('   Or provide a different test user email');
      process.exit(1);
    }
    
    // Now we can query Firestore
    console.log('📋 Fetching all users from Firestore...\n');
    
    const usersSnapshot = await getDocs(collection(db, 'users'));
    const allUsers = usersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    console.log(`✅ Found ${allUsers.length} total users\n`);

    // Separate main user from test users
    const mainUsers = allUsers.filter(user => 
      user.email && user.email.includes('main-author')
    );
    const testUsers = allUsers.filter(user => 
      !user.email || !user.email.includes('main-author')
    );

    console.log(`📊 Breakdown:`);
    console.log(`   Main users: ${mainUsers.length}`);
    console.log(`   Test users: ${testUsers.length}\n`);

    if (testUsers.length === 0) {
      console.log('⚠️  No test users found. Make sure you ran the test-platform script first.');
      process.exit(0);
    }

    console.log('🔍 Checking posts for each test user...\n');
    console.log('='.repeat(70));

    const usersWithPosts = [];
    const usersWithoutPosts = [];
    const postCounts = [];

    for (let i = 0; i < testUsers.length; i++) {
      const user = testUsers[i];
      const userName = user.name || user.handle || user.email || `User ${i + 1}`;
      const userEmail = user.email || 'N/A';
      
      process.stdout.write(`   [${i + 1}/${testUsers.length}] Checking ${userName}... `);
      
      const posts = await getUserPosts(user.id);
      const postCount = posts.length;
      
      postCounts.push({ userId: user.id, name: userName, email: userEmail, count: postCount });
      
      if (postCount > 0) {
        usersWithPosts.push({ user, postCount });
        console.log(`✅ ${postCount} posts`);
      } else {
        usersWithoutPosts.push({ user, postCount: 0 });
        console.log(`❌ No posts`);
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('\n' + '='.repeat(70));
    console.log('📊 SUMMARY');
    console.log('='.repeat(70));
    console.log(`Total test users checked: ${testUsers.length}`);
    console.log(`Users with posts: ${usersWithPosts.length} (${((usersWithPosts.length / testUsers.length) * 100).toFixed(1)}%)`);
    console.log(`Users without posts: ${usersWithoutPosts.length} (${((usersWithoutPosts.length / testUsers.length) * 100).toFixed(1)}%)`);

    // Calculate statistics
    const totalPosts = postCounts.reduce((sum, item) => sum + item.count, 0);
    const avgPosts = totalPosts / testUsers.length;
    const maxPosts = Math.max(...postCounts.map(item => item.count));
    const minPosts = Math.min(...postCounts.map(item => item.count));

    console.log(`\n📈 Post Statistics:`);
    console.log(`   Total posts from test users: ${totalPosts}`);
    console.log(`   Average posts per user: ${avgPosts.toFixed(2)}`);
    console.log(`   Maximum posts: ${maxPosts}`);
    console.log(`   Minimum posts: ${minPosts}`);

    // Show users without posts
    if (usersWithoutPosts.length > 0) {
      console.log(`\n❌ Users WITHOUT Posts (${usersWithoutPosts.length}):`);
      console.log('='.repeat(70));
      usersWithoutPosts.forEach(({ user }, index) => {
        const name = user.name || user.handle || user.email || `User ${user.id}`;
        const email = user.email || 'N/A';
        console.log(`   ${index + 1}. ${name} (${email})`);
        console.log(`      User ID: ${user.id}`);
      });
    }

    // Show users with posts (top 10 by count)
    if (usersWithPosts.length > 0) {
      const sortedByPosts = [...usersWithPosts].sort((a, b) => b.postCount - a.postCount);
      console.log(`\n✅ Top 10 Users WITH Posts:`);
      console.log('='.repeat(70));
      sortedByPosts.slice(0, 10).forEach(({ user, postCount }, index) => {
        const name = user.name || user.handle || user.email || `User ${user.id}`;
        const email = user.email || 'N/A';
        console.log(`   ${index + 1}. ${name} (${email}) - ${postCount} posts`);
      });
    }

    // Distribution of post counts
    const postCountDistribution = {};
    postCounts.forEach(item => {
      const count = item.count;
      postCountDistribution[count] = (postCountDistribution[count] || 0) + 1;
    });

    console.log(`\n📊 Post Count Distribution:`);
    console.log('='.repeat(70));
    const sortedDistribution = Object.entries(postCountDistribution)
      .map(([count, users]) => ({ count: parseInt(count), users }))
      .sort((a, b) => a.count - b.count);
    
    sortedDistribution.forEach(({ count, users }) => {
      const bar = '█'.repeat(Math.min(users, 50));
      console.log(`   ${count.toString().padStart(2)} posts: ${users.toString().padStart(3)} users ${bar}`);
    });

    // Check main user too
    if (mainUsers.length > 0) {
      console.log(`\n👤 Main User(s):`);
      console.log('='.repeat(70));
      for (const mainUser of mainUsers) {
        const posts = await getUserPosts(mainUser.id);
        const name = mainUser.name || mainUser.handle || mainUser.email || 'Main User';
        console.log(`   ${name} (${mainUser.email || 'N/A'}): ${posts.length} posts`);
      }
    }

    console.log('\n' + '='.repeat(70));
    
    // Final verdict
    if (usersWithoutPosts.length === 0) {
      console.log('✅ SUCCESS: All test users have posts!');
    } else {
      console.log(`⚠️  WARNING: ${usersWithoutPosts.length} test users are missing posts.`);
      console.log(`\n💡 To fix this, you can:`);
      console.log(`   1. Re-run the test-platform script`);
      console.log(`   2. Or manually create posts for users without posts`);
    }

    console.log('='.repeat(70));

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

verifyUserPosts().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});

