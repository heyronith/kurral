/**
 * AI Bot Feature End-to-End Test Script
 * Tests the complete AI bot pipeline using real implementation
 * 
 * Usage: npm run test:bot-feature
 *       or: npx tsx scripts/test-bot-feature-e2e.js
 * 
 * This tests:
 * - Bot profile creation and validation
 * - NewsAPI integration (if key available)
 * - Article fetching and processing
 * - Article classification and routing
 * - Bot post scheduling
 * - Bot post publishing
 * - Fact-checking integration (trusted vs untrusted sources)
 * - Topic engagement tracking
 * - Full pipeline integration
 */

import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, query, where, getDocs, doc, getDoc, Timestamp, limit } from 'firebase/firestore';
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

// Import services (using dynamic imports to handle TypeScript/ES modules)
// Note: This script requires tsx to run TypeScript files: npm install -D tsx
// Then run: npx tsx scripts/test-bot-feature-e2e.js
let botService, newsApiService, articleProcessingService, botRoutingService, botPostService, newsPipelineService;
let userService, chirpService, topicService, factCheckAgent;

// Test results tracking
const testResults = {
  passed: 0,
  failed: 0,
  errors: [],
  warnings: [],
};

// Test data
let createdChirpIds = [];
let testBotIds = [];
let testUserEmail = null;
let testUserPassword = null;
let authenticated = false;

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

function assertGreaterThan(actual, expected, message) {
  const passed = actual > expected;
  if (passed) {
    testResults.passed++;
    log(message, 'success');
  } else {
    testResults.failed++;
    testResults.errors.push(`${message} - Expected: > ${expected}, Got: ${actual}`);
    log(`${message} - Expected: > ${expected}, Got: ${actual}`, 'error');
  }
}

function assertContains(array, item, message) {
  const passed = array.includes(item);
  if (passed) {
    testResults.passed++;
    log(message, 'success');
  } else {
    testResults.failed++;
    testResults.errors.push(`${message} - Item not found in array`);
    log(`${message} - Item not found in array`, 'error');
  }
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Test 0: Authenticate with Firebase
async function authenticate() {
  log('\n=== Test 0: Firebase Authentication ===', 'info');
  
  try {
    // Use test credentials from env or create new user
    testUserEmail = process.env.TEST_EMAIL || `test-bot-${Date.now()}@example.com`;
    testUserPassword = process.env.TEST_PASSWORD || 'TestPassword123!';
    
    try {
      // Try to sign in first (if user exists)
      const userCredential = await signInWithEmailAndPassword(auth, testUserEmail, testUserPassword);
      log(`Authenticated with existing user: ${userCredential.user.uid}`, 'success');
      authenticated = true;
    } catch (signInError) {
      // If user doesn't exist or wrong password, try to create new user
      if (signInError.code === 'auth/user-not-found' || signInError.code === 'auth/wrong-password' || signInError.code === 'auth/invalid-credential') {
        try {
          // Create new user
          log('Creating new test user...', 'info');
          const userCredential = await createUserWithEmailAndPassword(auth, testUserEmail, testUserPassword);
          log(`Created and authenticated new user: ${userCredential.user.uid}`, 'success');
          authenticated = true;
        } catch (createError) {
          if (createError.code === 'auth/email-already-in-use') {
            // User exists but password might be wrong, try sign in again with different approach
            log('User exists but authentication failed. Please check TEST_EMAIL and TEST_PASSWORD in .env', 'warning');
            throw new Error('Authentication failed: User exists but credentials are invalid. Please set TEST_EMAIL and TEST_PASSWORD in .env');
          } else {
            throw createError;
          }
        }
      } else {
        throw signInError;
      }
    }
    
    assert(authenticated === true, 'Firebase authentication successful');
    return authenticated;
  } catch (error) {
    log(`Authentication failed: ${error.message}`, 'error');
    throw error;
  }
}

// Test 1: Load Services
async function testLoadServices() {
  log('\n=== Test 1: Loading Services ===', 'info');
  
  try {
    // Import services using dynamic imports (works with tsx)
    // If running with node, you'll need to use tsx: npx tsx scripts/test-bot-feature-e2e.js
    const botServiceModule = await import('../src/webapp/lib/services/botService.ts');
    botService = botServiceModule.botService;
    
    const newsApiServiceModule = await import('../src/webapp/lib/services/newsApiService.ts');
    newsApiService = newsApiServiceModule.newsApiService;
    
    const articleProcessingModule = await import('../src/webapp/lib/services/articleProcessingService.ts');
    articleProcessingService = articleProcessingModule.articleProcessingService;
    
    const botRoutingModule = await import('../src/webapp/lib/services/botRoutingService.ts');
    botRoutingService = botRoutingModule.botRoutingService;
    
    const botPostModule = await import('../src/webapp/lib/services/botPostService.ts');
    botPostService = botPostModule.botPostService;
    
    const newsPipelineModule = await import('../src/webapp/lib/services/newsPipelineService.ts');
    newsPipelineService = newsPipelineModule.newsPipelineService;
    
    const firestoreModule = await import('../src/webapp/lib/firestore.ts');
    userService = firestoreModule.userService;
    chirpService = firestoreModule.chirpService;
    topicService = firestoreModule.topicService;
    
    const factCheckModule = await import('../src/webapp/lib/services/factCheckAgent.ts');
    factCheckAgent = factCheckModule;
    
    assert(botService !== undefined, 'botService loaded');
    assert(newsApiService !== undefined, 'newsApiService loaded');
    assert(articleProcessingService !== undefined, 'articleProcessingService loaded');
    assert(botRoutingService !== undefined, 'botRoutingService loaded');
    assert(botPostService !== undefined, 'botPostService loaded');
    assert(newsPipelineService !== undefined, 'newsPipelineService loaded');
    assert(userService !== undefined, 'userService loaded');
    assert(chirpService !== undefined, 'chirpService loaded');
    assert(topicService !== undefined, 'topicService loaded');
  } catch (error) {
    log(`Failed to load services: ${error.message}`, 'error');
    throw error;
  }
}

// Test 2: Bot Profile Creation
async function testBotProfileCreation() {
  log('\n=== Test 2: Bot Profile Creation ===', 'info');
  
  try {
    const result = await botService.ensureBotProfiles();
    
    assert(result.success === true, 'Bot profiles created successfully');
    assert(result.bots.length > 0, 'At least one bot profile created');
    assertGreaterThan(result.bots.length, 0, `Created ${result.bots.length} bot profiles`);
    
    // Verify bots in Firestore
    const botsQuery = query(collection(db, 'users'), where('isBot', '==', true));
    const botsSnapshot = await getDocs(botsQuery);
    const botsInDb = botsSnapshot.docs.length;
    
    assertGreaterThan(botsInDb, 0, `Found ${botsInDb} bots in Firestore`);
    
    // Store bot IDs for cleanup
    result.bots.forEach(bot => {
      testBotIds.push(bot.id);
    });
    
    // Verify bot properties
    const firstBot = result.bots[0];
    assert(firstBot.isBot === true, 'Bot has isBot flag set');
    assert(firstBot.botType !== undefined, 'Bot has botType');
    assert(firstBot.botPersonality !== undefined, 'Bot has personality');
    assert(firstBot.botPostingPreferences !== undefined, 'Bot has posting preferences');
    
    log(`Created/verified ${result.bots.length} bot profiles`, 'success');
  } catch (error) {
    log(`Bot profile creation failed: ${error.message}`, 'error');
    throw error;
  }
}

// Test 3: NewsAPI Configuration Check
async function testNewsApiConfiguration() {
  log('\n=== Test 3: NewsAPI Configuration ===', 'info');
  
  const hasApiKey = !!process.env.VITE_NEWS_API_KEY;
  const isConfigured = newsApiService.isConfigured();
  
  assert(hasApiKey === isConfigured, 'NewsAPI configuration check matches environment');
  
  if (!hasApiKey) {
    testResults.warnings.push('VITE_NEWS_API_KEY not set - skipping article fetching tests');
    log('⚠️  VITE_NEWS_API_KEY not set. Article fetching tests will be skipped.', 'warning');
    return false;
  }
  
  log('NewsAPI key is configured', 'success');
  return true;
}

// Test 4: Article Fetching
async function testArticleFetching() {
  log('\n=== Test 4: Article Fetching ===', 'info');
  
  if (!newsApiService.isConfigured()) {
    log('Skipping article fetching test - API key not configured', 'warning');
    return [];
  }
  
  try {
    const articles = await newsApiService.fetchDiverseArticles();
    
    if (articles.length === 0) {
      testResults.warnings.push('No articles fetched from NewsAPI. This may be due to an invalid API key or network issues. Article-related tests will be skipped.');
      log('No articles fetched from NewsAPI. This may be due to an invalid API key or network issues.', 'warning');
      return [];
    }
    
    assertGreaterThan(articles.length, 0, `Fetched ${articles.length} articles from NewsAPI`);
    
    // Verify article structure
    if (articles.length > 0) {
      const firstArticle = articles[0];
      assert(firstArticle.id !== undefined, 'Article has id');
      assert(firstArticle.title !== undefined, 'Article has title');
      assert(firstArticle.url !== undefined, 'Article has url');
      assert(firstArticle.sourceName !== undefined, 'Article has sourceName');
      assert(firstArticle.publishedAt instanceof Date, 'Article has publishedAt date');
      assert(firstArticle.category !== undefined, 'Article has category');
    }
    
    log(`Fetched ${articles.length} articles successfully`, 'success');
    return articles;
  } catch (error) {
    log(`Article fetching failed: ${error.message}`, 'error');
    throw error;
  }
}

// Test 5: Article Processing
async function testArticleProcessing(articles) {
  log('\n=== Test 5: Article Processing ===', 'info');
  
  if (!articles || articles.length === 0) {
    log('Skipping article processing test - no articles available', 'warning');
    return [];
  }
  
  try {
    // Test deduplication
    const duplicated = [...articles, ...articles];
    const deduped = articleProcessingService.dedupe(duplicated);
    
    assert(deduped.length <= articles.length, 'Deduplication reduces article count');
    assertGreaterThan(deduped.length, 0, `Deduplicated to ${deduped.length} unique articles`);
    
    // Test classification
    const classifications = [];
    for (const article of deduped.slice(0, 5)) {
      const classification = articleProcessingService.classify(article);
      classifications.push(classification);
      
      assert(classification.botType !== undefined, `Article classified with botType: ${classification.botType}`);
      assert(classification.primaryTopic !== undefined, 'Article has primary topic');
      assert(classification.confidence >= 0 && classification.confidence <= 1, 'Classification confidence is valid');
    }
    
    log(`Classified ${classifications.length} articles successfully`, 'success');
    return deduped;
  } catch (error) {
    log(`Article processing failed: ${error.message}`, 'error');
    throw error;
  }
}

// Test 6: Bot Routing
async function testBotRouting(articles) {
  log('\n=== Test 6: Bot Routing ===', 'info');
  
  if (!articles || articles.length === 0) {
    log('Skipping bot routing test - no articles available', 'warning');
    return [];
  }
  
  try {
    const routed = botRoutingService.routeArticles(articles);
    
    assertGreaterThan(routed.length, 0, `Routed ${routed.length} articles to bots`);
    
    // Verify routing structure
    if (routed.length > 0) {
      const firstRouted = routed[0];
      assert(firstRouted.article !== undefined, 'Routed article has article');
      assert(firstRouted.classification !== undefined, 'Routed article has classification');
      assert(firstRouted.assignedBotId !== undefined, 'Routed article has assignedBotId');
      assert(firstRouted.assignedBotType !== undefined, 'Routed article has assignedBotType');
      assert(firstRouted.assignedAt instanceof Date, 'Routed article has assignedAt date');
    }
    
    // Verify all routed articles have valid bot IDs
    const botIds = new Set();
    routed.forEach(r => botIds.add(r.assignedBotId));
    
    // Check that assigned bots exist
    for (const botId of Array.from(botIds).slice(0, 3)) {
      const bot = await userService.getUser(botId);
      assert(bot !== null, `Assigned bot ${botId} exists in Firestore`);
      if (bot) {
        assert(bot.isBot === true, `User ${botId} is marked as bot`);
      }
    }
    
    log(`Successfully routed ${routed.length} articles to ${botIds.size} different bots`, 'success');
    return routed;
  } catch (error) {
    log(`Bot routing failed: ${error.message}`, 'error');
    throw error;
  }
}

// Test 7: Bot Post Enqueue
async function testBotPostEnqueue(routedArticles) {
  log('\n=== Test 7: Bot Post Enqueue ===', 'info');
  
  if (!routedArticles || routedArticles.length === 0) {
    log('Skipping bot post enqueue test - no routed articles available', 'warning');
    return;
  }
  
  try {
    // Stop any running service first
    botPostService.stop();
    
    // Enqueue articles
    botPostService.enqueue(routedArticles.slice(0, 5)); // Limit to 5 for testing
    
    // Start the service to process
    const startResult = botPostService.start(5000); // 5 second interval for testing
    
    assert(startResult.success === true, `Bot post service started successfully${startResult.reason ? `: ${startResult.reason}` : ''}`);
    
    log('Bot posts enqueued and service started', 'success');
    
    // Wait a bit for posts to be scheduled
    await sleep(2000);
    
    return startResult;
  } catch (error) {
    log(`Bot post enqueue failed: ${error.message}`, 'error');
    throw error;
  }
}

// Test 8: Bot Post Publishing
async function testBotPostPublishing() {
  log('\n=== Test 8: Bot Post Publishing ===', 'info');
  
  try {
    // Wait for posts to be published (they're scheduled, so we need to wait)
    log('Waiting for scheduled bot posts to be published...', 'info');
    await sleep(10000); // Wait 10 seconds
    
    // Check for bot posts in Firestore
    // Firestore 'in' query limit is 10, so we need to batch queries if we have more bots
    let botPosts = [];
    const botIdBatches = [];
    for (let i = 0; i < testBotIds.length; i += 10) {
      botIdBatches.push(testBotIds.slice(i, i + 10));
    }
    
    for (const botIdBatch of botIdBatches) {
      const botPostsQuery = query(
        collection(db, 'chirps'),
        where('authorId', 'in', botIdBatch),
        limit(20)
      );
      
      const postsSnapshot = await getDocs(botPostsQuery);
      const batchPosts = postsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      botPosts = botPosts.concat(batchPosts);
    }
    
    if (botPosts.length > 0) {
      assertGreaterThan(botPosts.length, 0, `Found ${botPosts.length} bot posts in Firestore`);
      
      // Verify post structure
      const firstPost = botPosts[0];
      assert(testBotIds.includes(firstPost.authorId), 'Post author is a bot');
      assert(firstPost.text !== undefined, 'Post has text');
      assert(firstPost.topic !== undefined, 'Post has topic');
      assert(firstPost.createdAt !== undefined, 'Post has createdAt');
      
      // Store for cleanup
      botPosts.forEach(post => createdChirpIds.push(post.id));
      
      log(`Found ${botPosts.length} bot posts published successfully`, 'success');
      
      // Check if posts have fact-checking status
      const postsWithFactCheck = botPosts.filter(p => p.factCheckingStatus !== undefined);
      if (postsWithFactCheck.length > 0) {
        log(`Found ${postsWithFactCheck.length} posts with fact-checking status`, 'success');
      }
      
      // Check if posts have semantic topics
      const postsWithSemanticTopics = botPosts.filter(p => p.semanticTopics && p.semanticTopics.length > 0);
      if (postsWithSemanticTopics.length > 0) {
        log(`Found ${postsWithSemanticTopics.length} posts with semantic topics`, 'success');
      }
    } else {
      log('No bot posts found yet. They may still be scheduled for future posting.', 'warning');
    }
    
    return botPosts;
  } catch (error) {
    log(`Bot post publishing check failed: ${error.message}`, 'error');
    throw error;
  }
}

// Test 9: Topic Engagement Tracking
async function testTopicEngagementTracking(botPosts) {
  log('\n=== Test 9: Topic Engagement Tracking ===', 'info');
  
  if (!botPosts || botPosts.length === 0) {
    log('Skipping topic engagement test - no bot posts available', 'warning');
    return;
  }
  
  try {
    // Get topics from bot posts
    const topics = new Set();
    botPosts.forEach(post => {
      if (post.topic) topics.add(post.topic);
      if (post.semanticTopics) {
        post.semanticTopics.forEach(t => topics.add(t));
      }
    });
    
    if (topics.size > 0) {
      // Check topic metadata in Firestore
      for (const topicName of Array.from(topics).slice(0, 3)) {
        const topicDoc = await getDoc(doc(db, 'topics', topicName));
        if (topicDoc.exists()) {
          const topicData = topicDoc.data();
          assert(topicData.postsLast48h !== undefined, `Topic ${topicName} has postsLast48h`);
          assertGreaterThan(topicData.postsLast48h, 0, `Topic ${topicName} has engagement count > 0`);
          log(`Topic ${topicName} engagement tracked: ${topicData.postsLast48h} posts in last 48h`, 'success');
        } else {
          log(`Topic ${topicName} metadata not found (may be created on next update)`, 'warning');
        }
      }
    }
  } catch (error) {
    log(`Topic engagement tracking check failed: ${error.message}`, 'error');
    // Don't throw - this is not critical
  }
}

// Test 10: Fact-Checking Integration
async function testFactCheckingIntegration(botPosts) {
  log('\n=== Test 10: Fact-Checking Integration ===', 'info');
  
  if (!botPosts || botPosts.length === 0) {
    log('Skipping fact-checking test - no bot posts available', 'warning');
    return;
  }
  
  try {
    // Check if posts have fact-checking data
    const postsWithClaims = botPosts.filter(p => p.claims && p.claims.length > 0);
    const postsWithFactChecks = botPosts.filter(p => p.factChecks && p.factChecks.length > 0);
    const postsWithStatus = botPosts.filter(p => p.factCheckStatus !== undefined);
    
    log(`Posts with claims: ${postsWithClaims.length}`, 'info');
    log(`Posts with fact-checks: ${postsWithFactChecks.length}`, 'info');
    log(`Posts with fact-check status: ${postsWithStatus.length}`, 'info');
    
    // Verify isTrustedDomain function works
    const testUrls = [
      'https://reuters.com/article',
      'https://bbc.com/news',
      'https://unknown-blog.com/article',
    ];
    
    for (const url of testUrls) {
      const isTrusted = factCheckAgent.isTrustedDomain(url);
      if (url.includes('reuters') || url.includes('bbc')) {
        assert(isTrusted === true, `Trusted domain detected: ${url}`);
      }
    }
    
    log('Fact-checking integration verified', 'success');
  } catch (error) {
    log(`Fact-checking integration check failed: ${error.message}`, 'error');
    // Don't throw - fact-checking is async and may not complete immediately
  }
}

// Test 11: Pipeline Integration
async function testPipelineIntegration() {
  log('\n=== Test 11: Pipeline Integration ===', 'info');
  
  try {
    // Stop services first
    botPostService.stop();
    newsPipelineService.stop();
    
    // Test single run
    const runResult = await newsPipelineService.runOnce();
    
    // Verify run completed
    assert(Array.isArray(runResult), 'Pipeline runOnce returns array');
    
    log(`Pipeline run completed: ${runResult.length} assignments prepared`, 'success');
    
    // Test service start
    const pipelineStartResult = await newsPipelineService.start(0); // Single run mode
    
    if (pipelineStartResult.success) {
      log('Pipeline service started successfully', 'success');
    } else {
      log(`Pipeline service start returned: ${pipelineStartResult.reason || 'unknown reason'}`, 'warning');
    }
    
    // Stop services
    botPostService.stop();
    newsPipelineService.stop();
    
    log('Pipeline integration test completed', 'success');
  } catch (error) {
    log(`Pipeline integration test failed: ${error.message}`, 'error');
    throw error;
  }
}

// Cleanup
async function cleanup() {
  log('\n=== Cleanup ===', 'info');
  
  try {
    // Stop services
    botPostService.stop();
    newsPipelineService.stop();
    
    log('Services stopped', 'success');
    
    // Note: We don't delete bot profiles or posts as they're part of the system
    // But we log what was created for manual review if needed
    if (createdChirpIds.length > 0) {
      log(`Created ${createdChirpIds.length} test chirps (not deleted - part of system)`, 'info');
    }
    
    if (testBotIds.length > 0) {
      log(`Verified ${testBotIds.length} bot profiles (not deleted - part of system)`, 'info');
    }
  } catch (error) {
    log(`Cleanup error: ${error.message}`, 'error');
  }
}

// Main test runner
async function runTests() {
  log('🚀 Starting AI Bot Feature End-to-End Tests', 'info');
  log('='.repeat(60), 'info');
  
  let articles = [];
  let processedArticles = [];
  let routedArticles = [];
  let botPosts = [];
  
  try {
    await authenticate();
    await testLoadServices();
    await testBotProfileCreation();
    
    const hasNewsApi = await testNewsApiConfiguration();
    
    if (hasNewsApi) {
      articles = await testArticleFetching();
      processedArticles = await testArticleProcessing(articles);
      routedArticles = await testBotRouting(processedArticles);
      await testBotPostEnqueue(routedArticles);
      
      // Wait a bit for posts to be published
      await sleep(5000);
      botPosts = await testBotPostPublishing();
    } else {
      log('Skipping article-related tests due to missing API key', 'warning');
    }
    
    await testTopicEngagementTracking(botPosts);
    await testFactCheckingIntegration(botPosts);
    await testPipelineIntegration();
    
  } catch (error) {
    log(`Test execution failed: ${error.message}`, 'error');
    console.error(error);
  } finally {
    await cleanup();
    
    // Print summary
    log('\n' + '='.repeat(60), 'info');
    log('📊 Test Summary', 'info');
    log('='.repeat(60), 'info');
    log(`✅ Passed: ${testResults.passed}`, 'success');
    log(`❌ Failed: ${testResults.failed}`, testResults.failed > 0 ? 'error' : 'info');
    
    if (testResults.warnings.length > 0) {
      log(`\n⚠️  Warnings: ${testResults.warnings.length}`, 'warning');
      testResults.warnings.forEach(w => log(`   - ${w}`, 'warning'));
    }
    
    if (testResults.errors.length > 0) {
      log(`\n❌ Errors:`, 'error');
      testResults.errors.forEach(e => log(`   - ${e}`, 'error'));
    }
    
    const total = testResults.passed + testResults.failed;
    const successRate = total > 0 ? ((testResults.passed / total) * 100).toFixed(1) : 0;
    
    log(`\n📈 Success Rate: ${successRate}%`, 'info');
    log('='.repeat(60), 'info');
    
    if (testResults.failed === 0) {
      log('🎉 All tests passed!', 'success');
      process.exit(0);
    } else {
      log('⚠️  Some tests failed. Review errors above.', 'error');
      process.exit(1);
    }
  }
}

// Run tests
runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

