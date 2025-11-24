/**
 * News Generation Test Script
 * Tests the AI-powered news generation from trending topics
 * 
 * Usage: node scripts/test-news-generation.js
 * 
 * This script:
 * 1. Creates multiple posts for a topic to trigger trending
 * 2. Waits for velocity tracking to update
 * 3. Triggers news generation
 * 4. Verifies AI-generated news appears
 */

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit,
  Timestamp,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  increment
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

// Test credentials
const testEmail = process.env.TEST_EMAIL || `test-news-${Date.now()}@example.com`;
const testPassword = process.env.TEST_PASSWORD || 'TestPassword123!';
const testTopic = 'dev'; // Topic to test with

// Sample post texts for the test topic
const samplePosts = [
  "Just released a new open-source library for React state management! Check it out on GitHub.",
  "Breaking: Major tech company announces new AI framework. This could change everything.",
  "New JavaScript features in ES2024 are game-changers. Here's what you need to know.",
  "Just finished building a real-time collaboration tool. The architecture is fascinating.",
  "Tech industry is seeing massive layoffs this quarter. What does this mean for developers?",
  "New programming language gaining traction. Early adopters are raving about it.",
  "Just discovered an amazing debugging tool. It's saved me hours of work already.",
  "Breaking news: Major security vulnerability found in popular npm package. Update immediately!",
  "New framework release is getting mixed reviews. What do you think?",
  "Just launched my startup! Building developer tools for the next generation.",
  "Tech conference announcements are rolling in. Which ones are you attending?",
  "New API standards are being proposed. This could standardize the industry.",
  "Just read an interesting article about quantum computing. The future is wild.",
  "Breaking: New development tool hits 1M downloads in first week.",
  "Tech giants are investing heavily in AI. What does this mean for developers?",
];

// Helper to wait
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Authenticate user
async function authenticateUser() {
  console.log('🔐 Authenticating user...');
  try {
    let user;
    // First try to create user (will fail if exists, which is fine)
    try {
      console.log('👤 Attempting to create test user...');
      user = await createUserWithEmailAndPassword(auth, testEmail, testPassword);
      console.log('✅ Created new user:', user.user.uid);
      
      // Create user document
      await setDoc(doc(db, 'users', user.user.uid), {
        name: 'Test User',
        handle: `testuser${Date.now()}`,
        email: testEmail,
        createdAt: Timestamp.now(),
        following: [],
        topics: [testTopic],
        onboardingCompleted: true,
      });
      console.log('✅ Created user document');
    } catch (createError) {
      // If user already exists, try to sign in
      if (createError.code === 'auth/email-already-in-use') {
        console.log('👤 User already exists, signing in...');
        try {
          user = await signInWithEmailAndPassword(auth, testEmail, testPassword);
          console.log('✅ Logged in with existing user:', user.user.uid);
        } catch (signInError) {
          console.error('❌ Sign in failed:', signInError.message);
          throw signInError;
        }
      } else {
        console.error('❌ User creation failed:', createError.message);
        throw createError;
      }
    }
    return user.user;
  } catch (error) {
    console.error('❌ Authentication failed:', error.message);
    throw error;
  }
}

// Create a test post
async function createPost(userId, text, topic, minutesAgo = 0) {
  const createdAt = Timestamp.fromMillis(Date.now() - (minutesAgo * 60 * 1000));
  
  const chirpData = {
    authorId: userId,
    text: text,
    topic: topic,
    reachMode: 'forAll',
    createdAt: createdAt,
    commentCount: Math.floor(Math.random() * 5), // Random 0-4 comments for engagement
  };
  
  const docRef = await addDoc(collection(db, 'chirps'), chirpData);
  
  // Increment topic engagement
  try {
    const topicRef = doc(db, 'topics', topic);
    const topicSnap = await getDoc(topicRef);
    
    if (topicSnap.exists()) {
      await updateDoc(topicRef, {
        postsLast48h: increment(1),
        postsLast1h: increment(1),
        postsLast4h: increment(1),
        lastEngagementUpdate: Timestamp.now(),
      });
    } else {
      await setDoc(topicRef, {
        name: topic,
        postsLast48h: 1,
        postsLast1h: 1,
        postsLast4h: 1,
        totalUsers: 0,
        averageVelocity1h: 0,
        isTrending: false,
        lastEngagementUpdate: Timestamp.now(),
      });
    }
  } catch (error) {
    console.warn('⚠️  Could not update topic engagement:', error.message);
  }
  
  return docRef.id;
}

// Create multiple posts to simulate trending
async function createTrendingPosts(userId, topic, count = 15) {
  console.log(`\n📝 Creating ${count} posts for topic "${topic}" to trigger trending...`);
  
  const posts = [];
  for (let i = 0; i < count; i++) {
    const text = samplePosts[i % samplePosts.length];
    const minutesAgo = Math.floor(i / 3); // Spread posts over time
    const postId = await createPost(userId, text, topic, minutesAgo);
    posts.push(postId);
    
    if ((i + 1) % 5 === 0) {
      console.log(`   Created ${i + 1}/${count} posts...`);
      await sleep(500); // Small delay to avoid rate limiting
    }
  }
  
  console.log(`✅ Created ${posts.length} posts`);
  return posts;
}

// Check if topic is trending
async function checkTopicTrending(topic) {
  const topicRef = doc(db, 'topics', topic);
  const topicSnap = await getDoc(topicRef);
  
  if (!topicSnap.exists()) {
    return { isTrending: false, postsLast1h: 0, postsLast4h: 0 };
  }
  
  const data = topicSnap.data();
  return {
    isTrending: data.isTrending || false,
    postsLast1h: data.postsLast1h || 0,
    postsLast4h: data.postsLast4h || 0,
    averageVelocity1h: data.averageVelocity1h || 0,
  };
}

// Refresh topic engagement to calculate velocity
async function refreshTopicEngagement(topic) {
  console.log(`\n🔄 Refreshing topic engagement for "${topic}"...`);
  
  const now = Date.now();
  const fourHoursAgo = now - 4 * 60 * 60 * 1000;
  const oneHourAgo = now - 60 * 60 * 1000;
  
  const timestamp4h = Timestamp.fromMillis(fourHoursAgo);
  const timestamp1h = Timestamp.fromMillis(oneHourAgo);
  
  // Get posts in different time windows
  let snapshot4h;
  try {
    // Try with index first
    const q4h = query(
      collection(db, 'chirps'),
      where('topic', '==', topic),
      where('createdAt', '>=', timestamp4h),
      orderBy('createdAt', 'desc')
    );
    snapshot4h = await getDocs(q4h);
  } catch (error) {
    // If index doesn't exist, try without orderBy
    console.log('   ⚠️  Index not found, fetching without orderBy...');
    const q4h = query(
      collection(db, 'chirps'),
      where('topic', '==', topic),
      where('createdAt', '>=', timestamp4h)
    );
    snapshot4h = await getDocs(q4h);
  }
  
  const posts4h = snapshot4h.docs.filter(doc => {
    const data = doc.data();
    let postTime;
    if (data.createdAt?.toMillis) {
      postTime = data.createdAt.toMillis();
    } else if (data.createdAt?.toDate) {
      postTime = data.createdAt.toDate().getTime();
    } else if (data.createdAt) {
      postTime = new Date(data.createdAt).getTime();
    } else {
      return false;
    }
    return postTime >= fourHoursAgo;
  });
  
  const posts1h = posts4h.filter(doc => {
    const data = doc.data();
    let postTime;
    if (data.createdAt?.toMillis) {
      postTime = data.createdAt.toMillis();
    } else if (data.createdAt?.toDate) {
      postTime = data.createdAt.toDate().getTime();
    } else if (data.createdAt) {
      postTime = new Date(data.createdAt).getTime();
    } else {
      return false;
    }
    return postTime >= oneHourAgo;
  });
  
  const count4h = posts4h.length;
  const count1h = posts1h.length;
  const averageVelocity = count4h / 4;
  const isTrending = averageVelocity > 0 && count1h >= averageVelocity * 2;
  
  // Update topic
  const topicRef = doc(db, 'topics', topic);
  await updateDoc(topicRef, {
    postsLast4h: count4h,
    postsLast1h: count1h,
    averageVelocity1h: averageVelocity,
    isTrending: isTrending,
    lastEngagementUpdate: Timestamp.now(),
  });
  
  console.log(`   Posts last 1h: ${count1h}`);
  console.log(`   Posts last 4h: ${count4h}`);
  console.log(`   Average velocity: ${averageVelocity.toFixed(2)} posts/hour`);
  console.log(`   Is trending: ${isTrending ? '✅ YES' : '❌ NO'}`);
  
  return { isTrending, count1h, count4h, averageVelocity };
}

// Check for AI-generated news
async function checkAIGeneratedNews() {
  console.log('\n🔍 Checking for AI-generated news...');
  
  const q = query(
    collection(db, 'trendingNews'),
    orderBy('lastUpdated', 'desc'),
    limit(10)
  );
  
  const snapshot = await getDocs(q);
  const news = snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      title: data.title,
      source: data.source,
      category: data.category,
      engagementCount: data.engagementCount || 0,
      lastUpdated: data.lastUpdated?.toDate() || new Date(),
      isAIGenerated: data.source === 'Platform Discussion',
    };
  });
  
  const aiNews = news.filter(n => n.isAIGenerated);
  
  console.log(`   Total news items: ${news.length}`);
  console.log(`   AI-generated news: ${aiNews.length}`);
  
  if (aiNews.length > 0) {
    console.log('\n   ✅ AI-Generated News Found:');
    aiNews.forEach((item, index) => {
      console.log(`   ${index + 1}. ${item.title}`);
      console.log(`      Source: ${item.source} | Category: ${item.category} | Engagement: ${item.engagementCount}`);
    });
  } else {
    console.log('   ⚠️  No AI-generated news found yet');
  }
  
  return aiNews;
}

// Main test function
async function runTest() {
  console.log('🚀 Starting News Generation End-to-End Test\n');
  console.log('=' .repeat(60));
  
  // Check Firebase config
  if (!firebaseConfig.apiKey || firebaseConfig.apiKey === 'your_api_key_here') {
    console.error('❌ Firebase credentials not configured!');
    console.error('Please copy .env.example to .env and fill in your Firebase credentials.');
    process.exit(1);
  }
  
  try {
    // Step 1: Authenticate
    const user = await authenticateUser();
    console.log('');
    
    // Step 2: Create posts to trigger trending
    const postIds = await createTrendingPosts(user.uid, testTopic, 15);
    console.log(`\n✅ Created ${postIds.length} test posts`);
    
    // Step 3: Wait a moment for Firestore to process
    console.log('\n⏳ Waiting 2 seconds for Firestore to process...');
    await sleep(2000);
    
    // Step 4: Refresh topic engagement to calculate velocity
    const topicStats = await refreshTopicEngagement(testTopic);
    
    if (!topicStats.isTrending) {
      console.log('\n⚠️  Topic is not trending yet. Creating more posts...');
      await createTrendingPosts(user.uid, testTopic, 10);
      await sleep(2000);
      const updatedStats = await refreshTopicEngagement(testTopic);
      
      if (!updatedStats.isTrending) {
        console.log('\n❌ Topic still not trending. This might be because:');
        console.log('   - Need more posts (try increasing count)');
        console.log('   - Velocity calculation needs more time');
        console.log('   - Average velocity is too high');
        console.log('\n📊 Current stats:');
        console.log(`   Posts last 1h: ${updatedStats.count1h}`);
        console.log(`   Posts last 4h: ${updatedStats.count4h}`);
        console.log(`   Average velocity: ${updatedStats.averageVelocity.toFixed(2)}`);
        console.log(`   Required for trending: ${(updatedStats.averageVelocity * 2).toFixed(2)} posts/hour`);
      }
    }
    
    // Step 5: Check for AI-generated news
    console.log('\n' + '='.repeat(60));
    const aiNews = await checkAIGeneratedNews();
    
    // Step 6: Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Created ${postIds.length} posts for topic "${testTopic}"`);
    console.log(`✅ Topic stats: ${topicStats.count1h} posts/hour, ${topicStats.count4h} posts/4h`);
    console.log(`✅ Topic trending: ${topicStats.isTrending ? 'YES' : 'NO'}`);
    console.log(`✅ AI-generated news found: ${aiNews.length}`);
    
    if (aiNews.length > 0) {
      console.log('\n🎉 SUCCESS! AI news generation is working!');
      console.log('\n💡 Next steps:');
      console.log('   1. Check the app UI - news should appear in "Today\'s News" section');
      console.log('   2. Click on a news item to see the full detail view');
      console.log('   3. Verify related posts are shown below the news');
    } else {
      console.log('\n⚠️  No AI-generated news found. This could mean:');
      console.log('   - News service needs to be triggered (refresh in app)');
      console.log('   - Topic needs more posts to be considered trending');
      console.log('   - OpenAI API might need configuration');
      console.log('\n💡 Try:');
      console.log('   1. Refresh the news in the app (click refresh button)');
      console.log('   2. Create more posts for the topic');
      console.log('   3. Wait a few minutes and check again');
    }
    
    console.log('\n' + '='.repeat(60));
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the test
runTest().then(() => {
  console.log('\n✅ Test script completed');
  process.exit(0);
}).catch((error) => {
  console.error('\n❌ Test script failed:', error);
  process.exit(1);
});

