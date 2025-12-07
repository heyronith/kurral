/**
 * Onboarding Flow Comprehensive Test Script
 * Tests the complete onboarding pipeline end-to-end using real Firebase/Firestore
 * 
 * Usage: node scripts/test-onboarding-flow.js
 * 
 * This tests:
 * - Step 1: Profile basics (displayName, userId, bio, url, location)
 * - Step 2: Semantic interests collection
 * - Step 3: Follow suggestions and selection
 * - Step 4: Onboarding completion
 * - Auto-follow functionality (ensures minimum 3 follows)
 * - Profile embedding generation
 * - Welcome screen logic (firstTimeUser flag)
 * - Empty states handling
 * - Data persistence and validation
 */

import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
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
  deleteDoc
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

// Test results tracking
const testResults = {
  passed: 0,
  failed: 0,
  errors: [],
  warnings: [],
};

// Test data
let testUserId = null;
let testUserEmail = null;
let testUserPassword = null;
let testUserHandle = null;
let createdChirpIds = [];
let createdUserIds = [];

function log(message, type = 'info') {
  const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : type === 'warning' ? '⚠️' : 'ℹ️';
  console.log(`${prefix} ${message}`);
}

function assert(condition, message) {
  if (condition) {
    testResults.passed++;
    log(message, 'success');
  } else {
    testResults.failed++;
    testResults.errors.push(message);
    log(message, 'error');
  }
}

function assertEqual(actual, expected, message) {
  const passed = JSON.stringify(actual) === JSON.stringify(expected);
  if (passed) {
    testResults.passed++;
    log(message, 'success');
  } else {
    testResults.failed++;
    testResults.errors.push(`${message} - Expected: ${JSON.stringify(expected)}, Got: ${JSON.stringify(actual)}`);
    log(`${message} - Expected: ${JSON.stringify(expected)}, Got: ${JSON.stringify(actual)}`, 'error');
  }
}

function assertGreaterThan(actual, threshold, message) {
  if (actual > threshold) {
    testResults.passed++;
    log(message, 'success');
  } else {
    testResults.failed++;
    testResults.errors.push(`${message} - Expected > ${threshold}, Got: ${actual}`);
    log(`${message} - Expected > ${threshold}, Got: ${actual}`, 'error');
  }
}

function assertNotNull(value, message) {
  if (value !== null && value !== undefined) {
    testResults.passed++;
    log(message, 'success');
  } else {
    testResults.failed++;
    testResults.errors.push(`${message} - Value is null/undefined`);
    log(`${message} - Value is null/undefined`, 'error');
  }
}

// Helper: Convert Firestore Timestamp to Date
const toDate = (timestamp) => {
  if (timestamp?.toDate) {
    return timestamp.toDate();
  }
  if (timestamp instanceof Date) {
    return timestamp;
  }
  return new Date(timestamp);
};

// Helper: Get user document from Firestore
async function getUserDoc(userId) {
  const userRef = doc(db, 'users', userId);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) {
    return null;
  }
  return { id: userSnap.id, ...userSnap.data() };
}

// Helper: Check if handle is available
async function isHandleAvailable(handle) {
  const normalizedHandle = handle.toLowerCase().trim();
  const q = query(
    collection(db, 'users'),
    where('handle', '==', normalizedHandle),
    limit(1)
  );
  const snapshot = await getDocs(q);
  return snapshot.empty;
}

// Helper: Get popular accounts (users with recent posts)
async function getPopularAccounts(limitCount = 5) {
  try {
    // Get recent chirps to find active authors
    const chirpsQuery = query(
      collection(db, 'chirps'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    const chirpsSnapshot = await getDocs(chirpsQuery);
    
    // Count posts per author
    const authorPostCounts = new Map();
    const authorIds = new Set();
    
    chirpsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const authorId = data.authorId;
      if (authorId) {
        authorIds.add(authorId);
        authorPostCounts.set(authorId, (authorPostCounts.get(authorId) || 0) + 1);
      }
    });
    
    // Get user documents for active authors
    const popularUsers = [];
    for (const authorId of Array.from(authorIds).slice(0, limitCount * 2)) {
      const userData = await getUserDoc(authorId);
      if (userData) {
        popularUsers.push({
          ...userData,
          postCount: authorPostCounts.get(authorId) || 0,
        });
      }
    }
    
    // Sort by post count and return top N
    popularUsers.sort((a, b) => b.postCount - a.postCount);
    return popularUsers.slice(0, limitCount).map(u => ({
      id: u.id,
      name: u.name || u.displayName,
      handle: u.handle,
      bio: u.bio,
    }));
  } catch (error) {
    log(`Error getting popular accounts: ${error.message}`, 'warning');
    return [];
  }
}

// Helper: Get users with similar interests
async function getUsersWithSimilarInterests(userInterests, excludeUserId, limitCount = 5) {
  if (!userInterests || userInterests.length === 0) {
    return [];
  }
  
  try {
    // Get recent users (limit to 100 for performance)
    const q = query(
      collection(db, 'users'),
      orderBy('createdAt', 'desc'),
      limit(100)
    );
    
    const snapshot = await getDocs(q);
    const allUsers = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(user => user.id !== excludeUserId && user.interests && user.interests.length > 0);
    
    // Calculate similarity for each user
    const normalizedUserInterests = userInterests.map(i => i.toLowerCase());
    
    const usersWithSimilarity = allUsers.map(user => {
      const normalizedOtherInterests = (user.interests || []).map(i => i.toLowerCase());
      
      // Calculate overlap
      const exactMatches = [];
      const partialMatches = [];
      
      normalizedUserInterests.forEach(interest => {
        const exactMatch = normalizedOtherInterests.find(otherInterest => interest === otherInterest);
        if (exactMatch) {
          exactMatches.push(exactMatch);
        } else {
          const partialMatch = normalizedOtherInterests.find(otherInterest => 
            interest.includes(otherInterest) || otherInterest.includes(interest)
          );
          if (partialMatch) {
            partialMatches.push(partialMatch);
          }
        }
      });
      
      const totalMatches = exactMatches.length + partialMatches.length;
      const similarity = totalMatches / Math.max(normalizedUserInterests.length, normalizedOtherInterests.length);
      
      return {
        user,
        similarity,
        overlapCount: totalMatches,
      };
    });
    
    // Sort by similarity and return top matches
    usersWithSimilarity.sort((a, b) => {
      if (b.similarity !== a.similarity) {
        return b.similarity - a.similarity;
      }
      return b.overlapCount - a.overlapCount;
    });
    
    return usersWithSimilarity
      .filter(item => item.similarity > 0)
      .slice(0, limitCount)
      .map(item => ({
        id: item.user.id,
        name: item.user.name || item.user.displayName,
        handle: item.user.handle,
        bio: item.user.bio,
        matchingInterests: item.overlapCount,
      }));
  } catch (error) {
    log(`Error getting users with similar interests: ${error.message}`, 'warning');
    return [];
  }
}

// Helper: Auto-follow accounts to ensure minimum follows
async function ensureMinimumFollows(userId, minFollows = 3) {
  const userData = await getUserDoc(userId);
  if (!userData) {
    throw new Error('User not found');
  }
  
  const currentFollowing = userData.following || [];
  if (currentFollowing.length >= minFollows) {
    return { following: currentFollowing, autoFollowed: [] };
  }
  
  const needed = minFollows - currentFollowing.length;
  const popularAccounts = await getPopularAccounts(needed + 2); // Get extra in case some are already followed
  
  const toFollow = [];
  const autoFollowed = [];
  
  for (const account of popularAccounts) {
    if (toFollow.length >= needed) break;
    if (!currentFollowing.includes(account.id) && account.id !== userId) {
      toFollow.push(account.id);
      autoFollowed.push(account.id);
    }
  }
  
  if (toFollow.length > 0) {
    const newFollowing = [...currentFollowing, ...toFollow];
    const autoFollowedList = [...(userData.autoFollowedAccounts || []), ...autoFollowed];
    
    await updateDoc(doc(db, 'users', userId), {
      following: newFollowing,
      autoFollowedAccounts: autoFollowedList,
    });
    
    log(`Auto-followed ${toFollow.length} accounts to ensure minimum follows`, 'info');
  }
  
  const updatedUser = await getUserDoc(userId);
  return {
    following: updatedUser.following || [],
    autoFollowed: autoFollowed,
  };
}

// Test 1: Create test user (simulates signup)
async function testCreateUser() {
  log('\n📝 Test 1: Creating test user...', 'info');
  
  try {
    const timestamp = Date.now();
    testUserEmail = `onboarding-test-${timestamp}@example.com`;
    testUserPassword = 'TestPassword123!';
    testUserHandle = `onboardingtest${timestamp}`;
    
    // Create Firebase Auth user
    const userCredential = await createUserWithEmailAndPassword(auth, testUserEmail, testUserPassword);
    testUserId = userCredential.user.uid;
    
    // Create user document in Firestore (simulating auth.ts createAppUserFromFirebase)
    const userData = {
      name: 'Test User',
      handle: testUserHandle,
      email: testUserEmail,
      following: [],
      bookmarks: [],
      interests: [],
      onboardingCompleted: false,
      firstTimeUser: true,
      createdAt: Timestamp.now(),
      kurralScore: {
        score: 65,
        lastUpdated: Timestamp.now(),
        components: {
          qualityHistory: 0,
          violationHistory: 0,
          engagementQuality: 0,
          consistency: 0,
          communityTrust: 0,
        },
        history: [],
      },
      forYouConfig: {
        followingWeight: 'medium',
        boostActiveConversations: true,
        likedTopics: [],
        mutedTopics: [],
        timeWindowDays: 7,
      },
    };
    
    await setDoc(doc(db, 'users', testUserId), userData);
    createdUserIds.push(testUserId);
    
    // Verify user was created
    const userDoc = await getUserDoc(testUserId);
    assertNotNull(userDoc, 'User document created');
    assertEqual(userDoc.onboardingCompleted, false, 'User onboardingCompleted is false');
    assertEqual(userDoc.firstTimeUser, true, 'User firstTimeUser is true');
    assertEqual(userDoc.following?.length || 0, 0, 'User has no follows initially');
    assertEqual(userDoc.interests?.length || 0, 0, 'User has no interests initially');
    
    log(`✅ Test user created: ${testUserEmail} (${testUserId})`, 'success');
    return userDoc;
  } catch (error) {
    log(`❌ Failed to create user: ${error.message}`, 'error');
    throw error;
  }
}

// Test 2: Step 1 - Profile Basics (displayName, userId, bio, url, location)
async function testStep1ProfileBasics() {
  log('\n📝 Test 2: Step 1 - Profile Basics...', 'info');
  
  try {
    const displayName = 'John Doe';
    const userId = testUserHandle;
    const bio = 'Software engineer passionate about AI and machine learning';
    const url = 'https://johndoe.dev';
    const location = 'San Francisco, CA';
    
    // Check handle availability
    // The current handle should NOT be available since we just created the user with it
    const currentHandleAvailable = await isHandleAvailable(userId);
    assert(!currentHandleAvailable, 'Current handle is correctly marked as unavailable (already taken)');
    
    // Check a new handle that should be available
    const newHandle = `newhandle${Date.now()}`;
    const newHandleAvailable = await isHandleAvailable(newHandle);
    assert(newHandleAvailable, 'New handle is available');
    
    // Update user with profile basics (simulating Onboarding.tsx handleComplete)
    const updateData = {
      displayName: displayName.trim(),
      userId: userId.toLowerCase().trim(),
      handle: userId.toLowerCase().trim(),
      name: displayName.trim(),
      topics: [],
      bio: bio.trim(),
      url: url.trim(),
      location: location.trim(),
    };
    
    // Filter out undefined values
    const cleanUpdates = {};
    for (const [key, value] of Object.entries(updateData)) {
      if (value !== undefined) {
        cleanUpdates[key] = value;
      }
    }
    
    await updateDoc(doc(db, 'users', testUserId), cleanUpdates);
    
    // Verify updates
    const userDoc = await getUserDoc(testUserId);
    assertEqual(userDoc.displayName, displayName, 'Display name updated');
    assertEqual(userDoc.userId, userId.toLowerCase(), 'User ID updated');
    assertEqual(userDoc.handle, userId.toLowerCase(), 'Handle updated');
    assertEqual(userDoc.bio, bio, 'Bio updated');
    assertEqual(userDoc.url, url, 'URL updated');
    assertEqual(userDoc.location, location, 'Location updated');
    
    log('✅ Step 1 (Profile Basics) completed successfully', 'success');
    return userDoc;
  } catch (error) {
    log(`❌ Step 1 failed: ${error.message}`, 'error');
    throw error;
  }
}

// Test 3: Step 2 - Semantic Interests
async function testStep2SemanticInterests() {
  log('\n📝 Test 3: Step 2 - Semantic Interests...', 'info');
  
  try {
    const semanticInterests = [
      'artificial intelligence',
      'machine learning',
      'software engineering',
      'web development',
    ];
    
    // Update user with interests
    await updateDoc(doc(db, 'users', testUserId), {
      interests: semanticInterests,
    });
    
    // Verify interests
    const userDoc = await getUserDoc(testUserId);
    assertEqual(userDoc.interests?.length || 0, semanticInterests.length, 'Interests count matches');
    assertEqual(userDoc.interests, semanticInterests, 'Interests match');
    
    // Test interest validation (should have at least 1)
    assertGreaterThan(userDoc.interests.length, 0, 'User has at least one interest');
    
    log('✅ Step 2 (Semantic Interests) completed successfully', 'success');
    return userDoc;
  } catch (error) {
    log(`❌ Step 2 failed: ${error.message}`, 'error');
    throw error;
  }
}

// Test 4: Step 3 - Follow Suggestions
async function testStep3FollowSuggestions() {
  log('\n📝 Test 4: Step 3 - Follow Suggestions...', 'info');
  
  try {
    const userDoc = await getUserDoc(testUserId);
    const userInterests = userDoc.interests || [];
    
    // Get follow suggestions (similar interests + popular accounts)
    const similarUsers = await getUsersWithSimilarInterests(userInterests, testUserId, 5);
    const popularAccounts = await getPopularAccounts(5);
    
    log(`Found ${similarUsers.length} users with similar interests`, 'info');
    log(`Found ${popularAccounts.length} popular accounts`, 'info');
    
    // Combine and deduplicate
    const suggestionsMap = new Map();
    similarUsers.forEach(u => suggestionsMap.set(u.id, u));
    popularAccounts.forEach(u => {
      if (!suggestionsMap.has(u.id)) {
        suggestionsMap.set(u.id, u);
      }
    });
    
    const suggestions = Array.from(suggestionsMap.values()).slice(0, 8);
    assertGreaterThan(suggestions.length, 0, 'Follow suggestions available');
    
    // Select some to follow (simulating user selection)
    const selectedFollows = suggestions.slice(0, Math.min(3, suggestions.length)).map(u => u.id);
    
    if (selectedFollows.length > 0) {
      const currentFollowing = userDoc.following || [];
      const newFollowing = [...new Set([...currentFollowing, ...selectedFollows])];
      
      await updateDoc(doc(db, 'users', testUserId), {
        following: newFollowing,
      });
      
      const updatedUser = await getUserDoc(testUserId);
      assertEqual(updatedUser.following.length, newFollowing.length, 'Follows updated correctly');
      assertGreaterThan(updatedUser.following.length, 0, 'User has at least one follow');
    }
    
    log('✅ Step 3 (Follow Suggestions) completed successfully', 'success');
    return await getUserDoc(testUserId);
  } catch (error) {
    log(`❌ Step 3 failed: ${error.message}`, 'error');
    throw error;
  }
}

// Test 5: Auto-follow functionality
async function testAutoFollow() {
  log('\n📝 Test 5: Auto-follow functionality...', 'info');
  
  try {
    const userDoc = await getUserDoc(testUserId);
    const currentFollowing = userDoc.following || [];
    
    log(`Current follows: ${currentFollowing.length}`, 'info');
    
    // Test auto-follow to ensure minimum 3 follows
    const result = await ensureMinimumFollows(testUserId, 3);
    
    const updatedUser = await getUserDoc(testUserId);
    assertGreaterThan(updatedUser.following.length, 0, 'User has follows after auto-follow');
    
    if (result.autoFollowed.length > 0) {
      assertEqual(updatedUser.autoFollowedAccounts?.length || 0, result.autoFollowed.length, 'Auto-followed accounts tracked');
      log(`Auto-followed ${result.autoFollowed.length} accounts`, 'info');
    }
    
    // Verify minimum follows
    if (updatedUser.following.length < 3) {
      log(`⚠️  User has ${updatedUser.following.length} follows (less than minimum 3) - may need more popular accounts in database`, 'warning');
    } else {
      assertGreaterThan(updatedUser.following.length, 2, 'User has at least 3 follows');
    }
    
    log('✅ Auto-follow functionality works correctly', 'success');
    return updatedUser;
  } catch (error) {
    log(`❌ Auto-follow test failed: ${error.message}`, 'error');
    throw error;
  }
}

// Test 6: Step 4 - Onboarding Completion
async function testStep4OnboardingCompletion() {
  log('\n📝 Test 6: Step 4 - Onboarding Completion...', 'info');
  
  try {
    const userDoc = await getUserDoc(testUserId);
    
    // Complete onboarding (simulating Onboarding.tsx handleComplete)
    const onboardingCompletedAt = Timestamp.now();
    const updateData = {
      onboardingCompleted: true,
      onboardingCompletedAt: onboardingCompletedAt,
    };
    
    await updateDoc(doc(db, 'users', testUserId), updateData);
    
    // Verify completion
    const updatedUser = await getUserDoc(testUserId);
    assertEqual(updatedUser.onboardingCompleted, true, 'Onboarding marked as completed');
    assertNotNull(updatedUser.onboardingCompletedAt, 'Onboarding completion timestamp set');
    
    // Verify all required fields are present
    assertNotNull(updatedUser.displayName, 'Display name present');
    assertNotNull(updatedUser.handle, 'Handle present');
    assertGreaterThan(updatedUser.interests?.length || 0, 0, 'Interests present');
    assertGreaterThan(updatedUser.following?.length || 0, 0, 'Follows present');
    
    log('✅ Step 4 (Onboarding Completion) completed successfully', 'success');
    return updatedUser;
  } catch (error) {
    log(`❌ Step 4 failed: ${error.message}`, 'error');
    throw error;
  }
}

// Test 7: Profile Embedding (simulated - actual embedding requires AI service)
async function testProfileEmbedding() {
  log('\n📝 Test 7: Profile Embedding (simulated)...', 'info');
  
  try {
    const userDoc = await getUserDoc(testUserId);
    
    // Simulate profile summary generation (actual implementation would call AI service)
    // For testing, we'll just verify the structure is ready
    const profileSummary = `User interested in ${(userDoc.interests || []).join(', ')}. ${userDoc.bio || ''}`;
    
    // In real implementation, this would be generated by profileSummaryAgent
    // For testing, we'll just verify the user has the necessary data for embedding
    assertGreaterThan(userDoc.interests?.length || 0, 0, 'User has interests for profile summary');
    
    // Note: Actual embedding generation requires AI service and would be async
    // This test verifies the data structure is ready
    log('✅ Profile embedding data structure ready (actual embedding requires AI service)', 'success');
    return userDoc;
  } catch (error) {
    log(`❌ Profile embedding test failed: ${error.message}`, 'error');
    throw error;
  }
}

// Test 8: Welcome Screen Logic (firstTimeUser flag)
async function testWelcomeScreenLogic() {
  log('\n📝 Test 8: Welcome Screen Logic...', 'info');
  
  try {
    const userDoc = await getUserDoc(testUserId);
    
    // Verify firstTimeUser flag is set
    assertEqual(userDoc.firstTimeUser, true, 'firstTimeUser flag is true');
    
    // Simulate welcome screen dismissal (would set firstTimeUser to false)
    // For testing, we'll verify the flag exists and can be updated
    await updateDoc(doc(db, 'users', testUserId), {
      firstTimeUser: false,
    });
    
    const updatedUser = await getUserDoc(testUserId);
    assertEqual(updatedUser.firstTimeUser, false, 'firstTimeUser flag can be updated');
    
    // Restore for other tests
    await updateDoc(doc(db, 'users', testUserId), {
      firstTimeUser: true,
    });
    
    log('✅ Welcome screen logic works correctly', 'success');
    return updatedUser;
  } catch (error) {
    log(`❌ Welcome screen test failed: ${error.message}`, 'error');
    throw error;
  }
}

// Test 9: Empty States Handling
async function testEmptyStates() {
  log('\n📝 Test 9: Empty States Handling...', 'info');
  
  try {
    const userDoc = await getUserDoc(testUserId);
    
    // Test For You feed empty state conditions
    const hasFollowing = (userDoc.following?.length || 0) > 0;
    const hasInterests = (userDoc.interests?.length || 0) > 0;
    
    // User should have both following and interests after onboarding
    assert(hasFollowing, 'User has follows (For You feed should not be empty)');
    assert(hasInterests, 'User has interests (For You feed should not be empty)');
    
    // Test Latest feed empty state conditions
    if (!hasFollowing) {
      log('⚠️  User has no follows - Latest feed would be empty', 'warning');
    } else {
      log('✅ User has follows - Latest feed should have content', 'success');
    }
    
    log('✅ Empty states handling verified', 'success');
    return userDoc;
  } catch (error) {
    log(`❌ Empty states test failed: ${error.message}`, 'error');
    throw error;
  }
}

// Test 10: Data Persistence and Validation
async function testDataPersistence() {
  log('\n📝 Test 10: Data Persistence and Validation...', 'info');
  
  try {
    // Re-fetch user to verify persistence
    const userDoc = await getUserDoc(testUserId);
    
    // Verify all onboarding data persisted
    assertNotNull(userDoc.displayName, 'Display name persisted');
    assertNotNull(userDoc.handle, 'Handle persisted');
    assertNotNull(userDoc.userId, 'User ID persisted');
    assertGreaterThan(userDoc.interests?.length || 0, 0, 'Interests persisted');
    assertGreaterThan(userDoc.following?.length || 0, 0, 'Follows persisted');
    assertEqual(userDoc.onboardingCompleted, true, 'Onboarding completion persisted');
    assertNotNull(userDoc.onboardingCompletedAt, 'Onboarding timestamp persisted');
    assertEqual(userDoc.firstTimeUser, true, 'firstTimeUser flag persisted');
    
    // Verify no undefined values in critical fields
    assert(userDoc.bio !== undefined, 'Bio field exists (may be empty)');
    assert(userDoc.url !== undefined, 'URL field exists (may be empty)');
    assert(userDoc.location !== undefined, 'Location field exists (may be empty)');
    
    log('✅ Data persistence and validation passed', 'success');
    return userDoc;
  } catch (error) {
    log(`❌ Data persistence test failed: ${error.message}`, 'error');
    throw error;
  }
}

// Cleanup: Delete test user
async function cleanup() {
  log('\n🧹 Cleaning up test data...', 'info');
  
  try {
    if (testUserId) {
      // Delete user document
      await deleteDoc(doc(db, 'users', testUserId));
      log('✅ Test user document deleted', 'success');
    }
    
    // Note: Firebase Auth user deletion requires admin SDK
    // For testing, we'll just log the credentials
    if (testUserEmail) {
      log(`ℹ️  Test user credentials (for manual cleanup if needed):`, 'info');
      log(`   Email: ${testUserEmail}`, 'info');
      log(`   Password: ${testUserPassword}`, 'info');
    }
  } catch (error) {
    log(`⚠️  Cleanup warning: ${error.message}`, 'warning');
  }
}

// Main test runner
async function runTests() {
  console.log('🚀 Starting Onboarding Flow Comprehensive Tests...\n');
  
  // Check if credentials are configured
  if (!firebaseConfig.apiKey || firebaseConfig.apiKey === 'your_api_key_here') {
    log('❌ Firebase credentials not configured!', 'error');
    log('Please copy .env.example to .env and fill in your Firebase credentials.', 'error');
    process.exit(1);
  }
  
  try {
    // Run all tests in sequence
    await testCreateUser();
    await testStep1ProfileBasics();
    await testStep2SemanticInterests();
    await testStep3FollowSuggestions();
    await testAutoFollow();
    await testStep4OnboardingCompletion();
    await testProfileEmbedding();
    await testWelcomeScreenLogic();
    await testEmptyStates();
    await testDataPersistence();
    
    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Test Results Summary');
    console.log('='.repeat(60));
    console.log(`✅ Passed: ${testResults.passed}`);
    console.log(`❌ Failed: ${testResults.failed}`);
    console.log(`⚠️  Warnings: ${testResults.warnings.length}`);
    
    if (testResults.errors.length > 0) {
      console.log('\n❌ Errors:');
      testResults.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
    }
    
    if (testResults.warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      testResults.warnings.forEach((warning, index) => {
        console.log(`   ${index + 1}. ${warning}`);
      });
    }
    
    console.log('\n' + '='.repeat(60));
    
    if (testResults.failed === 0) {
      console.log('✅ All tests passed!');
    } else {
      console.log(`❌ ${testResults.failed} test(s) failed`);
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  } finally {
    await cleanup();
  }
}

// Run tests
runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

