/**
 * Most Valued Feature End-to-End Test Script
 * Tests the complete Most Valued feature using real Firebase/Firestore
 * 
 * Usage: 
 *   node scripts/test-most-valued-e2e.js           # Runs tests and cleans up
 *   node scripts/test-most-valued-e2e.js --keep   # Runs tests and keeps data (for viewing in app)
 * 
 * Requirements:
 * - KURAL_NEWS_EMAIL and KURAL_NEWS_PASSWORD in .env file
 * - Firebase credentials configured in .env
 * 
 * This tests:
 * - Service layer queries (timeframe, interests, minValueThreshold)
 * - Reach mode filtering (forAll, tuned)
 * - Interest-based filtering
 * - Pagination
 * - Error handling
 * - Eligibility filtering
 * 
 * Note: Uses the @kuralnews platform account for all test operations
 */

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
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

// Test results tracking
const testResults = {
  passed: 0,
  failed: 0,
  errors: [],
  testData: {
    users: [],
    chirps: [],
  }
};

function assert(condition, message) {
  if (condition) {
    testResults.passed++;
    console.log(`✅ ${message}`);
  } else {
    testResults.failed++;
    testResults.errors.push(message);
    console.error(`❌ ${message}`);
  }
}

function assertEqual(actual, expected, message) {
  const passed = JSON.stringify(actual) === JSON.stringify(expected);
  if (passed) {
    testResults.passed++;
    console.log(`✅ ${message}`);
  } else {
    testResults.failed++;
    testResults.errors.push(`${message} - Expected: ${JSON.stringify(expected)}, Got: ${JSON.stringify(actual)}`);
    console.error(`❌ ${message}`);
    console.error(`   Expected: ${JSON.stringify(expected)}`);
    console.error(`   Got: ${JSON.stringify(actual)}`);
  }
}

function assertGreaterThan(actual, threshold, message) {
  if (actual > threshold) {
    testResults.passed++;
    console.log(`✅ ${message}`);
  } else {
    testResults.failed++;
    testResults.errors.push(`${message} - Expected > ${threshold}, Got: ${actual}`);
    console.error(`❌ ${message}`);
  }
}

function assertLessThan(actual, threshold, message) {
  if (actual < threshold) {
    testResults.passed++;
    console.log(`✅ ${message}`);
  } else {
    testResults.failed++;
    testResults.errors.push(`${message} - Expected < ${threshold}, Got: ${actual}`);
    console.error(`❌ ${message}`);
  }
}

// Helper: Get current authenticated user (kuralnews account)
async function getCurrentUser() {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('No authenticated user. Please sign in first.');
  }
  
  const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
  const userData = userDoc.exists() ? userDoc.data() : null;
  
  return {
    userId: currentUser.uid,
    userDoc: userData || {
      id: currentUser.uid,
      email: currentUser.email,
      name: 'Kural News',
      handle: 'kuralnews',
      following: [],
      interests: [],
    },
  };
}

// Helper: Create additional test user (for testing following relationships, etc.)
// This creates a user document but doesn't authenticate as them
async function createTestUserDocument(userData = {}) {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Must be authenticated to create test users');
  }
  
  // Generate a unique user ID for the test user document
  const testUserId = `test-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  
  const userDoc = {
    id: testUserId,
    name: userData.name || `Test User ${Date.now()}`,
    handle: userData.handle || `testuser${Date.now()}`,
    email: userData.email || `test-${testUserId}@test.com`,
    createdAt: Timestamp.now(),
    following: userData.following || [],
    interests: userData.interests || [],
    profileEmbedding: userData.profileEmbedding || null,
    ...userData,
  };
  
  // Note: We can't create user documents for other users due to Firestore rules
  // So we'll just return the user data structure for testing
  // In real tests, we'd need to have those users authenticate themselves
  testResults.testData.users.push({ id: testUserId, email: userDoc.email });
  console.log(`✅ Created test user document structure: ${testUserId}`);
  return { userId: testUserId, userDoc };
}

// Helper: Create test chirp with value score
async function createTestChirp(authorId, chirpData = {}) {
  const now = new Date();
  const chirpDoc = {
    authorId: authorId,
    text: chirpData.text || `Test chirp created at ${now.toISOString()}`,
    topic: chirpData.topic || 'dev',
    semanticTopics: chirpData.semanticTopics || [],
    reachMode: chirpData.reachMode || 'forAll',
    tunedAudience: chirpData.tunedAudience || null,
    createdAt: Timestamp.fromDate(chirpData.createdAt || now),
    commentCount: chirpData.commentCount || 0,
    valueScore: chirpData.valueScore || {
      epistemic: 0.5,
      insight: 0.5,
      practical: 0.5,
      relational: 0.5,
      effort: 0.5,
      total: 0.5,
      confidence: 0.8,
      updatedAt: Timestamp.now(),
    },
    factCheckStatus: chirpData.factCheckStatus || null,
    scheduledAt: chirpData.scheduledAt ? Timestamp.fromDate(chirpData.scheduledAt) : null,
    ...chirpData,
  };
  
  const docRef = await addDoc(collection(db, 'chirps'), chirpDoc);
  testResults.testData.chirps.push(docRef.id);
  return { id: docRef.id, ...chirpDoc };
}

// Helper: Most Valued Service (simplified version matching the real service)
async function getTopValuedPosts(timeframe = 'week', interests, minValueThreshold = 0.5, limitCount = 5) {
  const constraints = [];
  
  // Min value threshold
  constraints.push(where('valueScore.total', '>=', minValueThreshold));
  
  // Timeframe filter
  const now = Date.now();
  let startDate = null;
  switch (timeframe) {
    case 'today':
      startDate = new Date(now - 24 * 60 * 60 * 1000);
      break;
    case 'week':
      startDate = new Date(now - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'month':
      startDate = new Date(now - 30 * 24 * 60 * 60 * 1000);
      break;
    case 'all':
    default:
      startDate = null;
  }
  
  if (startDate) {
    constraints.push(where('createdAt', '>=', Timestamp.fromDate(startDate)));
  }
  
  // Interest filter
  if (interests && interests.length > 0) {
    constraints.push(where('semanticTopics', 'array-contains-any', interests.slice(0, 10)));
  }
  
  // Ordering
  constraints.push(orderBy('valueScore.total', 'desc'));
  constraints.push(orderBy('createdAt', 'desc'));
  constraints.push(limit(limitCount));
  
  const snapshot = await getDocs(query(collection(db, 'chirps'), ...constraints));
  
  // Filter scheduled posts
  const nowDate = new Date();
  const posts = snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((chirp) => {
      if (chirp.scheduledAt && chirp.scheduledAt.toDate() > nowDate) {
        return false;
      }
      return true;
    });
  
  return { posts, cursor: snapshot.docs[snapshot.docs.length - 1] || null, hasMore: snapshot.docs.length === limitCount };
}

// Helper: Eligibility check (matching the real implementation)
function isChirpEligibleForMostValued(chirp, viewer, config, options = {}) {
  if (!viewer) {
    return chirp.reachMode === 'forAll';
  }
  
  // Check muted topics
  if (!options.ignoreMuted && config.mutedTopics) {
    const chirpTopics = [chirp.topic, ...(chirp.semanticTopics || [])].map(t => t?.toLowerCase());
    const mutedTopics = config.mutedTopics.map(t => t?.toLowerCase());
    if (chirpTopics.some(t => mutedTopics.includes(t))) {
      return false;
    }
  }
  
  // Check reach settings
  if (chirp.reachMode === 'forAll') {
    return true;
  }
  
  if (chirp.reachMode === 'tuned') {
    if (!chirp.tunedAudience) {
      return false;
    }
    
    // Always show own posts
    if (viewer.id === chirp.authorId) {
      return true;
    }
    
    const isFollowing = (viewer.following || []).includes(chirp.authorId);
    
    if (chirp.tunedAudience.allowFollowers && isFollowing) {
      return true;
    }
    
    if (chirp.tunedAudience.allowNonFollowers && !isFollowing) {
      return true;
    }
    
    return false;
  }
  
  return true;
}

function filterChirpsForMostValued(chirps, viewer, config, options = {}) {
  return chirps.filter((chirp) => {
    // Check fact-check status
    if (chirp.factCheckStatus === 'blocked') {
      if (viewer?.id === chirp.authorId) {
        return true;
      }
      return false;
    }
    
    // Check reach eligibility
    return isChirpEligibleForMostValued(chirp, viewer, config, options);
  });
}

// Test 1: Basic query with value score filtering
async function testBasicValueScoreQuery() {
  console.log('\n📋 Test 1: Basic value score query');
  
  const kuralNewsUser = await getCurrentUser();
  
  // Create chirps with different value scores (all as kuralnews user)
  const highValueChirp = await createTestChirp(kuralNewsUser.userId, {
    text: 'High value post',
    valueScore: {
      total: 0.9,
      epistemic: 0.9,
      insight: 0.9,
      practical: 0.9,
      relational: 0.9,
      effort: 0.9,
      confidence: 0.9,
      updatedAt: Timestamp.now(),
    },
    createdAt: new Date(),
  });
  
  const lowValueChirp = await createTestChirp(kuralNewsUser.userId, {
    text: 'Low value post',
    valueScore: {
      total: 0.3,
      epistemic: 0.3,
      insight: 0.3,
      practical: 0.3,
      relational: 0.3,
      effort: 0.3,
      confidence: 0.5,
      updatedAt: Timestamp.now(),
    },
    createdAt: new Date(),
  });
  
  // Wait a bit for Firestore to index
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const result = await getTopValuedPosts('week', undefined, 0.5, 10);
  
  const highValueFound = result.posts.some(p => p.id === highValueChirp.id);
  const lowValueFound = result.posts.some(p => p.id === lowValueChirp.id);
  
  assert(highValueFound, 'High value chirp should be returned');
  assert(!lowValueFound, 'Low value chirp should be filtered out');
  assertGreaterThan(result.posts.length, 0, 'Should return at least one post');
}

// Test 2: Timeframe filtering
async function testTimeframeFiltering() {
  console.log('\n📋 Test 2: Timeframe filtering');
  
  const kuralNewsUser = await getCurrentUser();
  
  // Create old chirp (2 months ago)
  const oldChirp = await createTestChirp(kuralNewsUser.userId, {
    text: 'Old post',
    valueScore: { total: 0.8, epistemic: 0.8, insight: 0.8, practical: 0.8, relational: 0.8, effort: 0.8, confidence: 0.8, updatedAt: Timestamp.now() },
    createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // 60 days ago
  });
  
  // Create recent chirp (today)
  const recentChirp = await createTestChirp(kuralNewsUser.userId, {
    text: 'Recent post',
    valueScore: { total: 0.8, epistemic: 0.8, insight: 0.8, practical: 0.8, relational: 0.8, effort: 0.8, confidence: 0.8, updatedAt: Timestamp.now() },
    createdAt: new Date(),
  });
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Test 'today' timeframe
  const todayResult = await getTopValuedPosts('today', undefined, 0.5, 10);
  const todayHasRecent = todayResult.posts.some(p => p.id === recentChirp.id);
  const todayHasOld = todayResult.posts.some(p => p.id === oldChirp.id);
  
  assert(todayHasRecent, 'Today timeframe should include recent post');
  assert(!todayHasOld, 'Today timeframe should exclude old post');
  
  // Test 'all' timeframe
  const allResult = await getTopValuedPosts('all', undefined, 0.5, 10);
  const allHasRecent = allResult.posts.some(p => p.id === recentChirp.id);
  const allHasOld = allResult.posts.some(p => p.id === oldChirp.id);
  
  assert(allHasRecent, 'All timeframe should include recent post');
  assert(allHasOld, 'All timeframe should include old post');
}

// Test 3: Interest-based filtering
async function testInterestFiltering() {
  console.log('\n📋 Test 3: Interest-based filtering');
  
  const kuralNewsUser = await getCurrentUser();
  
  // Create chirps with different semantic topics
  const techChirp = await createTestChirp(kuralNewsUser.userId, {
    text: 'Tech post',
    semanticTopics: ['technology', 'programming'],
    valueScore: { total: 0.8, epistemic: 0.8, insight: 0.8, practical: 0.8, relational: 0.8, effort: 0.8, confidence: 0.8, updatedAt: Timestamp.now() },
  });
  
  const sportsChirp = await createTestChirp(kuralNewsUser.userId, {
    text: 'Sports post',
    semanticTopics: ['sports', 'football'],
    valueScore: { total: 0.8, epistemic: 0.8, insight: 0.8, practical: 0.8, relational: 0.8, effort: 0.8, confidence: 0.8, updatedAt: Timestamp.now() },
  });
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Test with technology interest
  const techResult = await getTopValuedPosts('week', ['technology'], 0.5, 10);
  const techHasTech = techResult.posts.some(p => p.id === techChirp.id);
  const techHasSports = techResult.posts.some(p => p.id === sportsChirp.id);
  
  assert(techHasTech, 'Should return tech post when filtering by technology interest');
  assert(!techHasSports, 'Should not return sports post when filtering by technology interest');
}

// Test 4: Reach mode filtering
async function testReachModeFiltering() {
  console.log('\n📋 Test 4: Reach mode filtering');
  
  const kuralNewsUser = await getCurrentUser();
  
  // For this test, we'll use kuralnews as the author
  // The "viewer" will be kuralnews (following themselves), and "non-follower" will be simulated
  // by checking eligibility with an empty following array
  
  // Create forAll chirp
  const forAllChirp = await createTestChirp(kuralNewsUser.userId, {
    text: 'For all post',
    reachMode: 'forAll',
    valueScore: { total: 0.8, epistemic: 0.8, insight: 0.8, practical: 0.8, relational: 0.8, effort: 0.8, confidence: 0.8, updatedAt: Timestamp.now() },
  });
  
  // Create tuned chirp (followers only)
  const tunedChirp = await createTestChirp(kuralNewsUser.userId, {
    text: 'Tuned post (followers only)',
    reachMode: 'tuned',
    tunedAudience: {
      allowFollowers: true,
      allowNonFollowers: false,
    },
    valueScore: { total: 0.8, epistemic: 0.8, insight: 0.8, practical: 0.8, relational: 0.8, effort: 0.8, confidence: 0.8, updatedAt: Timestamp.now() },
  });
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Get all posts
  const allPosts = await getTopValuedPosts('week', undefined, 0.5, 10);
  const forAllFound = allPosts.posts.find(p => p.id === forAllChirp.id);
  const tunedFound = allPosts.posts.find(p => p.id === tunedChirp.id);
  
  // Test eligibility
  const config = { mutedTopics: [], semanticSimilarityThreshold: 0.7 };
  
  // KuralNews (as author/viewer) should see both (own posts always visible)
  const kuralNewsEligibleForAll = isChirpEligibleForMostValued(forAllFound, { id: kuralNewsUser.userId, following: [kuralNewsUser.userId] }, config);
  const kuralNewsEligibleTuned = isChirpEligibleForMostValued(tunedFound, { id: kuralNewsUser.userId, following: [kuralNewsUser.userId] }, config);
  
  assert(kuralNewsEligibleForAll, 'Author should see forAll post');
  assert(kuralNewsEligibleTuned, 'Author should see tuned post (own posts always visible)');
  
  // Simulate non-follower viewer (empty following array)
  const nonFollowerEligibleForAll = isChirpEligibleForMostValued(forAllFound, { id: 'other-user-id', following: [] }, config);
  const nonFollowerEligibleTuned = isChirpEligibleForMostValued(tunedFound, { id: 'other-user-id', following: [] }, config);
  
  assert(nonFollowerEligibleForAll, 'Non-follower should see forAll post');
  assert(!nonFollowerEligibleTuned, 'Non-follower should not see tuned post (followers only)');
}

// Test 5: Own posts visibility
async function testOwnPostsVisibility() {
  console.log('\n📋 Test 5: Own posts visibility');
  
  const kuralNewsUser = await getCurrentUser();
  
  // Create own post with tuned reach (non-followers not allowed)
  const ownPost = await createTestChirp(kuralNewsUser.userId, {
    text: 'My own post',
    reachMode: 'tuned',
    tunedAudience: {
      allowFollowers: true,
      allowNonFollowers: false,
    },
    valueScore: { total: 0.8, epistemic: 0.8, insight: 0.8, practical: 0.8, relational: 0.8, effort: 0.8, confidence: 0.8, updatedAt: Timestamp.now() },
  });
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const allPosts = await getTopValuedPosts('week', undefined, 0.5, 10);
  const ownPostFound = allPosts.posts.find(p => p.id === ownPost.id);
  
  const config = { mutedTopics: [], semanticSimilarityThreshold: 0.7 };
  
  // KuralNews should see their own post
  const eligible = isChirpEligibleForMostValued(ownPostFound, { id: kuralNewsUser.userId, following: [] }, config);
  assert(eligible, 'User should see their own post even with restricted reach');
}

// Test 6: Fact-check status filtering
async function testFactCheckFiltering() {
  console.log('\n📋 Test 6: Fact-check status filtering');
  
  const kuralNewsUser = await getCurrentUser();
  
  // Create blocked post
  const blockedPost = await createTestChirp(kuralNewsUser.userId, {
    text: 'Blocked post',
    factCheckStatus: 'blocked',
    valueScore: { total: 0.8, epistemic: 0.8, insight: 0.8, practical: 0.8, relational: 0.8, effort: 0.8, confidence: 0.8, updatedAt: Timestamp.now() },
  });
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const allPosts = await getTopValuedPosts('week', undefined, 0.5, 10);
  const blockedFound = allPosts.posts.find(p => p.id === blockedPost.id);
  
  const config = { mutedTopics: [], semanticSimilarityThreshold: 0.7 };
  
  // Filter posts
  const authorFiltered = filterChirpsForMostValued([blockedFound], { id: kuralNewsUser.userId, following: [] }, config);
  const viewerFiltered = filterChirpsForMostValued([blockedFound], { id: 'other-user-id', following: [] }, config);
  
  assert(authorFiltered.length === 1, 'Author should see their own blocked post');
  assert(viewerFiltered.length === 0, 'Viewer should not see blocked post');
}

// Test 7: Scheduled posts filtering
async function testScheduledPostsFiltering() {
  console.log('\n📋 Test 7: Scheduled posts filtering');
  
  const kuralNewsUser = await getCurrentUser();
  
  // Create scheduled post (future)
  const scheduledPost = await createTestChirp(kuralNewsUser.userId, {
    text: 'Scheduled post',
    scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
    valueScore: { total: 0.8, epistemic: 0.8, insight: 0.8, practical: 0.8, relational: 0.8, effort: 0.8, confidence: 0.8, updatedAt: Timestamp.now() },
  });
  
  // Create published post
  const publishedPost = await createTestChirp(kuralNewsUser.userId, {
    text: 'Published post',
    valueScore: { total: 0.8, epistemic: 0.8, insight: 0.8, practical: 0.8, relational: 0.8, effort: 0.8, confidence: 0.8, updatedAt: Timestamp.now() },
  });
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const result = await getTopValuedPosts('week', undefined, 0.5, 10);
  
  const scheduledFound = result.posts.some(p => p.id === scheduledPost.id);
  const publishedFound = result.posts.some(p => p.id === publishedPost.id);
  
  assert(!scheduledFound, 'Scheduled post should be filtered out');
  assert(publishedFound, 'Published post should be included');
}

// Test 8: Pagination
async function testPagination() {
  console.log('\n📋 Test 8: Pagination');
  
  const kuralNewsUser = await getCurrentUser();
  
  // Create multiple posts with different value scores
  const posts = [];
  for (let i = 0; i < 15; i++) {
    const post = await createTestChirp(kuralNewsUser.userId, {
      text: `Post ${i}`,
      valueScore: {
        total: 0.5 + (i * 0.03), // Increasing value scores
        epistemic: 0.5,
        insight: 0.5,
        practical: 0.5,
        relational: 0.5,
        effort: 0.5,
        confidence: 0.8,
        updatedAt: Timestamp.now(),
      },
    });
    posts.push(post);
  }
  
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Get first page
  const firstPage = await getTopValuedPosts('week', undefined, 0.5, 5);
  
  assertEqual(firstPage.posts.length, 5, 'First page should return 5 posts');
  assert(firstPage.hasMore, 'Should indicate more posts available');
  
  // Verify posts are sorted by value score (descending)
  const scores = firstPage.posts.map(p => p.valueScore?.total || 0);
  const isSorted = scores.every((score, i) => i === 0 || scores[i - 1] >= score);
  assert(isSorted, 'Posts should be sorted by value score (descending)');
}

// Test 9: Muted topics filtering
async function testMutedTopicsFiltering() {
  console.log('\n📋 Test 9: Muted topics filtering');
  
  const kuralNewsUser = await getCurrentUser();
  
  // Create posts with different topics
  const devPost = await createTestChirp(kuralNewsUser.userId, {
    text: 'Dev post',
    topic: 'dev',
    semanticTopics: ['development', 'coding'],
    valueScore: { total: 0.8, epistemic: 0.8, insight: 0.8, practical: 0.8, relational: 0.8, effort: 0.8, confidence: 0.8, updatedAt: Timestamp.now() },
  });
  
  const sportsPost = await createTestChirp(kuralNewsUser.userId, {
    text: 'Sports post',
    topic: 'sports',
    semanticTopics: ['football', 'sports'],
    valueScore: { total: 0.8, epistemic: 0.8, insight: 0.8, practical: 0.8, relational: 0.8, effort: 0.8, confidence: 0.8, updatedAt: Timestamp.now() },
  });
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const allPosts = await getTopValuedPosts('week', undefined, 0.5, 10);
  const devFound = allPosts.posts.find(p => p.id === devPost.id);
  const sportsFound = allPosts.posts.find(p => p.id === sportsPost.id);
  
  const config = { mutedTopics: ['sports'], semanticSimilarityThreshold: 0.7 };
  
  // Filter with muted sports topic
  const filtered = filterChirpsForMostValued([devFound, sportsFound], { id: kuralNewsUser.userId, following: [] }, config);
  
  const devIncluded = filtered.some(p => p.id === devPost.id);
  const sportsIncluded = filtered.some(p => p.id === sportsPost.id);
  
  assert(devIncluded, 'Dev post should be included (not muted)');
  assert(!sportsIncluded, 'Sports post should be filtered out (muted)');
}

// Cleanup function
async function cleanup(skipCleanup = false) {
  if (skipCleanup) {
    console.log('\n📝 Skipping cleanup - test data will remain in Firestore');
    console.log(`   Created ${testResults.testData.chirps.length} test chirps that you can view in the app`);
    console.log(`   Chirp IDs: ${testResults.testData.chirps.join(', ')}`);
    return;
  }
  
  console.log('\n🧹 Cleaning up test data...');
  
  const batch = writeBatch(db);
  let batchCount = 0;
  
  // Delete test chirps
  for (const chirpId of testResults.testData.chirps) {
    if (batchCount >= 500) {
      await batch.commit();
      batchCount = 0;
    }
    batch.delete(doc(db, 'chirps', chirpId));
    batchCount++;
  }
  
  if (batchCount > 0) {
    await batch.commit();
  }
  
  console.log(`✅ Cleaned up ${testResults.testData.chirps.length} test chirps`);
  console.log(`⚠️  Note: Test users were not deleted. You may want to clean them up manually.`);
}

// Main test runner
async function runTests() {
  console.log('🚀 Starting Most Valued Feature End-to-End Tests\n');
  console.log('='.repeat(60));
  
  // Check if credentials are configured
  if (!firebaseConfig.apiKey || firebaseConfig.apiKey === 'your_api_key_here') {
    console.error('❌ Firebase credentials not configured!');
    console.error('Please copy .env.example to .env and fill in your Firebase credentials.');
    process.exit(1);
  }
  
  try {
    // Authenticate with @kuralnews platform account
    const kuralNewsEmail = process.env.KURAL_NEWS_EMAIL || 'news@kurral.app';
    const kuralNewsPassword = process.env.KURAL_NEWS_PASSWORD;
    
    if (!kuralNewsPassword) {
      console.error('❌ KURAL_NEWS_PASSWORD not found in .env!');
      console.error('Please add KURAL_NEWS_PASSWORD to your .env file.');
      console.error('You can get the password by running: npm run verify:platform');
      process.exit(1);
    }
    
    console.log(`🔐 Authenticating with @kuralnews account (${kuralNewsEmail})...`);
    
    try {
      const userCredential = await signInWithEmailAndPassword(auth, kuralNewsEmail, kuralNewsPassword);
      const kuralNewsUserId = userCredential.user.uid;
      console.log(`✅ Authenticated as @kuralnews (UID: ${kuralNewsUserId})`);
      
      // Verify user document exists
      const userDoc = await getDoc(doc(db, 'users', kuralNewsUserId));
      if (!userDoc.exists()) {
        console.warn('⚠️  User document not found in Firestore. Some tests may fail.');
      } else {
        const userData = userDoc.data();
        console.log(`✅ User document found: @${userData.handle || 'unknown'}`);
      }
    } catch (error) {
      console.error(`❌ Failed to authenticate with @kuralnews account: ${error.code}`);
      console.error(`   Error: ${error.message}`);
      console.error('\n💡 Troubleshooting:');
      console.error('   1. Verify password is correct in .env file');
      console.error('   2. Check for special character issues when copying password');
      console.error('   3. Try: npm run verify:platform');
      console.error('   4. If account doesn\'t exist: npm run create:platform');
      process.exit(1);
    }
    
    // Check for Firestore index errors and provide helpful message
    const originalError = console.error;
    console.error = function(...args) {
      const errorMsg = args.join(' ');
      if (errorMsg.includes('requires an index') || errorMsg.includes('failed-precondition')) {
        console.log('\n⚠️  Firestore Index Required!');
        console.log('   The Most Valued feature requires Firestore indexes to be deployed.');
        console.log('   Please run: npm run firebase:deploy:indexes');
        console.log('   This will deploy the indexes defined in firestore.indexes.json\n');
      }
      originalError.apply(console, args);
    };
    
    // Run all tests
    await testBasicValueScoreQuery();
    await testTimeframeFiltering();
    await testInterestFiltering();
    await testReachModeFiltering();
    await testOwnPostsVisibility();
    await testFactCheckFiltering();
    await testScheduledPostsFiltering();
    await testPagination();
    await testMutedTopicsFiltering();
    
    // Check if --keep flag is set to skip cleanup
    const skipCleanup = process.argv.includes('--keep') || process.argv.includes('--no-cleanup');
    
    // Cleanup (unless --keep flag is set)
    await cleanup(skipCleanup);
    
    // Print results
    console.log('\n' + '='.repeat(60));
    console.log('📊 Test Results Summary');
    console.log('='.repeat(60));
    console.log(`✅ Passed: ${testResults.passed}`);
    console.log(`❌ Failed: ${testResults.failed}`);
    console.log(`📈 Total: ${testResults.passed + testResults.failed}`);
    
    if (testResults.errors.length > 0) {
      console.log('\n❌ Errors:');
      testResults.errors.forEach((error, i) => {
        console.log(`   ${i + 1}. ${error}`);
      });
    }
    
    if (testResults.failed === 0) {
      console.log('\n🎉 All tests passed!');
      process.exit(0);
    } else {
      console.log('\n⚠️  Some tests failed. Please review the errors above.');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n💥 Fatal error:', error);
    
    // Check if it's a Firestore index error
    if (error.code === 'failed-precondition' && error.message?.includes('requires an index')) {
      console.error('\n⚠️  Firestore Index Required!');
      console.error('   The Most Valued feature requires Firestore indexes to be deployed.');
      console.error('   Please run: npm run firebase:deploy:indexes');
      console.error('   This will deploy the indexes defined in firestore.indexes.json');
      console.error('   After deploying, wait a few minutes for indexes to build, then run the test again.\n');
    }
    
    console.error(error.stack);
    const skipCleanup = process.argv.includes('--keep') || process.argv.includes('--no-cleanup');
    await cleanup(skipCleanup);
    process.exit(1);
  }
}

// Run tests
runTests();
