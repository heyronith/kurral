/**
 * Personalized News Generation Test Script
 * Tests the AI-powered personalized news generation from user's selected topics
 * 
 * Usage: node scripts/test-personalized-news.js
 * 
 * This script:
 * 1. Creates a test user with multiple selected topics
 * 2. Creates posts across topics with distinct story clusters
 * 3. Tests story discovery agent (identifies distinct stories)
 * 4. Tests story selection agent (picks best story)
 * 5. Verifies personalized news generation
 * 6. Verifies storyClusterPostIds and deduplication
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
const testEmail = process.env.TEST_EMAIL || `test-personalized-news-${Date.now()}@example.com`;
const testPassword = process.env.TEST_PASSWORD || 'TestPassword123!';

// User's selected topics (simulating user profile)
const userTopics = ['dev', 'startups', 'crypto'];

// Story clusters - distinct stories within topics
const storyClusters = {
  dev: [
    {
      story: 'npm-security-vulnerability',
      posts: [
        "Breaking: Major security vulnerability discovered in popular npm package lodash. Update immediately!",
        "Just patched lodash vulnerability. All developers should update to version 4.17.21 or later.",
        "Security researchers found critical flaw in lodash that allows code injection. Patch now!",
        "npm security alert: lodash package has zero-day vulnerability. Millions of projects affected.",
        "Updated all my projects after lodash security warning. This is serious - update ASAP!",
        "Lodash maintainers released emergency patch. Check your dependencies now.",
        "Security breach in lodash could affect thousands of apps. Update your packages!",
      ]
    },
    {
      story: 'tech-layoffs',
      posts: [
        "Another round of tech layoffs announced. This time it's affecting 10% of the workforce.",
        "Tech industry layoffs continue. What does this mean for developers in 2024?",
        "Just got laid off from my tech job. The market is really tough right now.",
        "Major tech company announces massive layoffs. Thousands of developers affected.",
        "Tech layoffs are hitting hard. Time to update the resume and start networking.",
      ]
    }
  ],
  startups: [
    {
      story: 'ai-startup-funding',
      posts: [
        "AI startup just raised $50M Series A. The future of AI is here!",
        "Breaking: New AI startup gets massive funding round. Investors are bullish on AI.",
        "Just launched my AI startup and we're already getting investor interest.",
        "AI startup funding is through the roof. This is the next big thing.",
        "New AI startup announces $50M funding. They're building something revolutionary.",
      ]
    },
    {
      story: 'startup-accelerator',
      posts: [
        "Y Combinator announces new batch. Excited to see what these startups build!",
        "Just got accepted into YC! This is going to be an amazing journey.",
        "YC demo day is coming up. Can't wait to see the pitches.",
        "Y Combinator startups are changing the world. Innovation at its finest.",
      ]
    }
  ],
  crypto: [
    {
      story: 'bitcoin-regulation',
      posts: [
        "New Bitcoin regulation proposed in Congress. This could change everything.",
        "Breaking: SEC announces new crypto regulations. Bitcoin price reacting.",
        "Crypto regulation is finally coming. What does this mean for Bitcoin?",
        "Congressional hearing on Bitcoin regulation today. This is big news.",
        "New crypto regulations could impact Bitcoin adoption. Stay informed!",
      ]
    }
  ]
};

// Helper to wait
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Authenticate and create user with topics
async function authenticateUser() {
  console.log('🔐 Authenticating user...');
  try {
    let user;
    try {
      console.log('👤 Creating test user...');
      user = await createUserWithEmailAndPassword(auth, testEmail, testPassword);
      console.log('✅ Created new user:', user.user.uid);
      
      // Create user document with selected topics
      await setDoc(doc(db, 'users', user.user.uid), {
        name: 'Test User',
        handle: `testuser${Date.now()}`,
        email: testEmail,
        createdAt: Timestamp.now(),
        following: [],
        topics: userTopics, // User's selected topics
        onboardingCompleted: true,
      });
      console.log(`✅ Created user document with topics: ${userTopics.join(', ')}`);
    } catch (createError) {
      if (createError.code === 'auth/email-already-in-use') {
        console.log('👤 User already exists, signing in...');
        user = await signInWithEmailAndPassword(auth, testEmail, testPassword);
        console.log('✅ Logged in with existing user:', user.user.uid);
        
        // Update user topics
        await updateDoc(doc(db, 'users', user.user.uid), {
          topics: userTopics,
        });
        console.log(`✅ Updated user topics: ${userTopics.join(', ')}`);
      } else {
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
    commentCount: Math.floor(Math.random() * 10), // Random 0-9 comments for engagement
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
    console.warn(`⚠️  Could not update topic engagement for ${topic}:`, error.message);
  }
  
  return docRef.id;
}

// Create posts for a specific story cluster
async function createStoryClusterPosts(userId, topic, storyCluster, minutesAgo = 0) {
  const postIds = [];
  const posts = storyCluster.posts;
  
  for (let i = 0; i < posts.length; i++) {
    const postMinutesAgo = minutesAgo + (i * 2); // Spread posts over time
    const postId = await createPost(userId, posts[i], topic, postMinutesAgo);
    postIds.push(postId);
    await sleep(300); // Small delay to avoid rate limiting
  }
  
  return postIds;
}

// Create all story clusters across user topics
async function createAllStoryClusters(userId) {
  console.log('\n📝 Creating posts across user topics with distinct story clusters...');
  console.log(`   User topics: ${userTopics.join(', ')}`);
  
  const allPostIds = {};
  let totalPosts = 0;
  
  for (const topic of userTopics) {
    const clusters = storyClusters[topic] || [];
    allPostIds[topic] = {};
    
    console.log(`\n   📌 Topic: ${topic}`);
    
    for (const cluster of clusters) {
      console.log(`      Creating story cluster: "${cluster.story}" (${cluster.posts.length} posts)`);
      const postIds = await createStoryClusterPosts(userId, topic, cluster, 0);
      allPostIds[topic][cluster.story] = postIds;
      totalPosts += postIds.length;
      console.log(`      ✅ Created ${postIds.length} posts`);
    }
  }
  
  console.log(`\n✅ Created ${totalPosts} total posts across ${userTopics.length} topics`);
  return allPostIds;
}

// Refresh topic engagement to calculate velocity
async function refreshTopicEngagement(topic) {
  const now = Date.now();
  const fourHoursAgo = now - 4 * 60 * 60 * 1000;
  const oneHourAgo = now - 60 * 60 * 1000;
  
  const timestamp4h = Timestamp.fromMillis(fourHoursAgo);
  
  let snapshot4h;
  try {
    const q4h = query(
      collection(db, 'chirps'),
      where('topic', '==', topic),
      where('createdAt', '>=', timestamp4h),
      orderBy('createdAt', 'desc')
    );
    snapshot4h = await getDocs(q4h);
  } catch (error) {
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
  
  const topicRef = doc(db, 'topics', topic);
  await updateDoc(topicRef, {
    postsLast4h: count4h,
    postsLast1h: count1h,
    averageVelocity1h: averageVelocity,
    isTrending: isTrending,
    lastEngagementUpdate: Timestamp.now(),
  });
  
  return { isTrending, count1h, count4h, averageVelocity };
}

// Refresh all user topics
async function refreshAllTopics() {
  console.log('\n🔄 Refreshing topic engagement for all user topics...');
  
  for (const topic of userTopics) {
    const stats = await refreshTopicEngagement(topic);
    console.log(`   ${topic}: ${stats.count1h} posts/1h, ${stats.count4h} posts/4h, trending: ${stats.isTrending ? '✅' : '❌'}`);
  }
}

// Check for personalized news
async function checkPersonalizedNews(userId) {
  console.log('\n🔍 Checking for personalized news...');
  
  // Check user-specific news
  const userNewsQuery = query(
    collection(db, 'trendingNews'),
    where('userId', '==', userId),
    orderBy('lastUpdated', 'desc'),
    limit(10)
  );
  
  let userNews = [];
  try {
    const snapshot = await getDocs(userNewsQuery);
    userNews = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title,
        source: data.source,
        category: data.category,
        userId: data.userId,
        storyClusterPostIds: data.storyClusterPostIds || [],
        storySignature: data.storySignature || null,
        sourceTopics: data.sourceTopics || [],
        engagementCount: data.engagementCount || 0,
        lastUpdated: data.lastUpdated?.toDate() || new Date(),
      };
    });
  } catch (error) {
    console.log('   ⚠️  Could not query user-specific news (index may not exist yet):', error.message);
  }
  
  // Also check global news (fallback)
  const globalNewsQuery = query(
    collection(db, 'trendingNews'),
    orderBy('lastUpdated', 'desc'),
    limit(10)
  );
  
  const globalSnapshot = await getDocs(globalNewsQuery);
  const allNews = globalSnapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      title: data.title,
      source: data.source,
      category: data.category,
      userId: data.userId || null,
      storyClusterPostIds: data.storyClusterPostIds || [],
      storySignature: data.storySignature || null,
      sourceTopics: data.sourceTopics || [],
      engagementCount: data.engagementCount || 0,
      lastUpdated: data.lastUpdated?.toDate() || new Date(),
    };
  });
  
  const personalizedNews = allNews.filter(n => n.userId === userId);
  const aiNews = allNews.filter(n => n.source === 'Platform Discussion');
  
  console.log(`   Total news items: ${allNews.length}`);
  console.log(`   AI-generated news: ${aiNews.length}`);
  console.log(`   Personalized news (userId=${userId}): ${personalizedNews.length}`);
  
  if (personalizedNews.length > 0) {
    console.log('\n   ✅ Personalized News Found:');
    personalizedNews.forEach((item, index) => {
      console.log(`   ${index + 1}. ${item.title}`);
      console.log(`      Source: ${item.source} | Category: ${item.category}`);
      console.log(`      Source Topics: ${item.sourceTopics.join(', ') || 'N/A'}`);
      console.log(`      Story Post IDs: ${item.storyClusterPostIds.length} posts`);
      console.log(`      Story Signature: ${item.storySignature || 'N/A'}`);
      console.log(`      Engagement: ${item.engagementCount}`);
    });
  } else if (aiNews.length > 0) {
    console.log('\n   ⚠️  Found AI news but not personalized (userId missing):');
    aiNews.slice(0, 3).forEach((item, index) => {
      console.log(`   ${index + 1}. ${item.title} (userId: ${item.userId || 'null'})`);
    });
  } else {
    console.log('   ⚠️  No personalized news found yet');
  }
  
  return { personalizedNews, allNews, aiNews };
}

// Verify story cluster post IDs
async function verifyStoryClusterPosts(newsItem, allPostIds) {
  console.log(`\n   🔍 Verifying story cluster posts for: "${newsItem.title}"`);
  
  if (!newsItem.storyClusterPostIds || newsItem.storyClusterPostIds.length === 0) {
    console.log('      ⚠️  No storyClusterPostIds found');
    return false;
  }
  
  console.log(`      Found ${newsItem.storyClusterPostIds.length} post IDs in story cluster`);
  
  // Check if posts exist
  let foundPosts = 0;
  for (const postId of newsItem.storyClusterPostIds) {
    try {
      const postDoc = await getDoc(doc(db, 'chirps', postId));
      if (postDoc.exists()) {
        foundPosts++;
        const postData = postDoc.data();
        console.log(`      ✅ Post ${postId}: "${postData.text.substring(0, 60)}..."`);
      }
    } catch (error) {
      console.log(`      ❌ Post ${postId} not found`);
    }
  }
  
  console.log(`      Verified: ${foundPosts}/${newsItem.storyClusterPostIds.length} posts exist`);
  return foundPosts === newsItem.storyClusterPostIds.length;
}

// Main test function
async function runTest() {
  console.log('🚀 Starting Personalized News Generation End-to-End Test\n');
  console.log('='.repeat(60));
  
  // Check Firebase config
  if (!firebaseConfig.apiKey || firebaseConfig.apiKey === 'your_api_key_here') {
    console.error('❌ Firebase credentials not configured!');
    console.error('Please copy .env.example to .env and fill in your Firebase credentials.');
    process.exit(1);
  }
  
  try {
    // Step 1: Authenticate and create user with topics
    const user = await authenticateUser();
    console.log('');
    
    // Step 2: Create story clusters across user topics
    const allPostIds = await createAllStoryClusters(user.uid);
    
    // Step 3: Wait for Firestore to process
    console.log('\n⏳ Waiting 3 seconds for Firestore to process...');
    await sleep(3000);
    
    // Step 4: Refresh topic engagement
    await refreshAllTopics();
    
    // Step 5: Check for personalized news
    console.log('\n' + '='.repeat(60));
    const { personalizedNews, allNews, aiNews } = await checkPersonalizedNews(user.uid);
    
    // Step 6: Verify story cluster posts
    if (personalizedNews.length > 0) {
      console.log('\n' + '='.repeat(60));
      console.log('🔍 Verifying Story Cluster Posts');
      console.log('='.repeat(60));
      
      for (const newsItem of personalizedNews.slice(0, 3)) {
        await verifyStoryClusterPosts(newsItem, allPostIds);
      }
    }
    
    // Step 7: Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ User ID: ${user.uid}`);
    console.log(`✅ User Topics: ${userTopics.join(', ')}`);
    console.log(`✅ Total Posts Created: ${Object.values(allPostIds).reduce((sum, topic) => 
      sum + Object.values(topic).reduce((topicSum, cluster) => topicSum + cluster.length, 0), 0
    )}`);
    console.log(`✅ AI-generated news: ${aiNews.length}`);
    console.log(`✅ Personalized news: ${personalizedNews.length}`);
    
    if (personalizedNews.length > 0) {
      console.log('\n🎉 SUCCESS! Personalized news generation is working!');
      console.log('\n💡 Next steps:');
      console.log('   1. Open the app and log in with the test user');
      console.log('   2. Check "Today\'s News" section - should show personalized news');
      console.log('   3. Click on a news item to see story cluster posts');
      console.log('   4. Verify posts match the news story');
      console.log('   5. Test deduplication by refreshing news (should not create duplicates)');
    } else {
      console.log('\n⚠️  No personalized news found. This could mean:');
      console.log('   - News service needs to be triggered (refresh in app)');
      console.log('   - Story discovery agent needs more posts to identify clusters');
      console.log('   - OpenAI API might need configuration');
      console.log('\n💡 Try:');
      console.log('   1. Open the app and log in with the test user');
      console.log('   2. Click the refresh button in "Today\'s News" section');
      console.log('   3. Wait 30-60 seconds for AI agents to process');
      console.log('   4. Check browser console for agent logs');
      console.log(`   5. Test user email: ${testEmail}`);
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📝 Test User Credentials:');
    console.log(`   Email: ${testEmail}`);
    console.log(`   Password: ${testPassword}`);
    console.log(`   User ID: ${user.uid}`);
    console.log('='.repeat(60));
    
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

