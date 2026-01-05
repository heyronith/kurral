/**
 * Test script for risk-based pre-check logic
 * 
 * This script tests the new risk-based pre-check implementation with various post types:
 * - High-risk posts (health, finance, politics) should always be fact-checked
 * - Low-risk posts (opinion, personal experience) should skip fact-checking
 * - Ambiguous posts should fail-open (proceed with fact-checking)
 * 
 * Run with: node --input-type=module scripts/test-risk-based-precheck.js
 * OR: node scripts/test-risk-based-precheck.cjs (if renamed)
 * 
 * Requires:
 * - Firebase Functions to be deployed
 * - TEST_EMAIL and TEST_PASSWORD environment variables (or will create test user)
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '../env/.env') });

// Load Firebase config from environment
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

// Test cases with expected outcomes
const testCases = [
  {
    name: 'High Risk - Health Claim with Statistics',
    text: 'Vaccines cause autism in 50% of children according to a new study.',
    topic: 'health',
    semanticTopics: ['health', 'vaccines', 'medical'],
    expectedFactCheck: true,
    expectedRisk: 'high',
    description: 'Health claim with statistics - should always be fact-checked'
  },
  {
    name: 'High Risk - Finance Prediction',
    text: 'Bitcoin will reach $1 million by next year according to financial experts.',
    topic: 'crypto',
    semanticTopics: ['finance', 'cryptocurrency', 'investment'],
    expectedFactCheck: true,
    expectedRisk: 'high',
    description: 'Financial prediction with authority claim - should be fact-checked'
  },
  {
    name: 'High Risk - Political Claim',
    text: 'The election was rigged with 2 million fraudulent votes.',
    topic: 'politics',
    semanticTopics: ['politics', 'election'],
    expectedFactCheck: true,
    expectedRisk: 'high',
    description: 'Political claim with statistics - should be fact-checked'
  },
  {
    name: 'Medium Risk - Scientific Claim',
    text: 'Climate change is causing sea levels to rise by 3mm per year according to scientists.',
    topic: 'science',
    semanticTopics: ['climate', 'environment'],
    expectedFactCheck: true,
    expectedRisk: 'medium-high',
    description: 'Scientific claim with data and authority - should be fact-checked'
  },
  {
    name: 'Low Risk - Pure Opinion',
    text: 'I think the new iPhone is great!',
    topic: 'technology',
    semanticTopics: ['technology', 'products'],
    expectedFactCheck: false,
    expectedRisk: 'low',
    description: 'Pure opinion - should skip fact-checking'
  },
  {
    name: 'Low Risk - Personal Experience',
    text: 'I went to the park yesterday and it was beautiful.',
    topic: 'general',
    semanticTopics: [],
    expectedFactCheck: false,
    expectedRisk: 'low',
    description: 'Personal experience - should skip fact-checking'
  },
  {
    name: 'Low Risk - Short Post',
    text: 'Great day!',
    topic: 'general',
    semanticTopics: [],
    expectedFactCheck: false,
    expectedRisk: 'low',
    description: 'Very short post - should skip'
  },
  {
    name: 'Ambiguous - Mixed Content',
    text: 'I think the healthcare system needs reform because 30% of patients wait too long.',
    topic: 'health',
    semanticTopics: ['health', 'policy'],
    expectedFactCheck: true,
    expectedRisk: 'medium-high',
    description: 'Mixed opinion + factual claim - should proceed (fail-open)'
  },
  {
    name: 'Ambiguous - Question with Claim',
    text: 'Did you know that 75% of people support this policy?',
    topic: 'politics',
    semanticTopics: ['politics', 'policy'],
    expectedFactCheck: true,
    expectedRisk: 'medium-high',
    description: 'Question with statistical claim - should proceed'
  }
];

async function authenticate() {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const functions = getFunctions(app, 'us-central1');

  const testEmail = process.env.TEST_EMAIL || `test-${Date.now()}@example.com`;
  const testPassword = process.env.TEST_PASSWORD || 'testpassword123!';

  console.log(`📝 Attempting authentication with: ${testEmail}`);

  try {
    // Try to sign in
    const userCredential = await signInWithEmailAndPassword(auth, testEmail, testPassword);
    console.log('✅ Authenticated successfully\n');
    return { auth, functions, userId: userCredential.user.uid };
  } catch (signInError) {
    // If sign in fails, try to create the user
    try {
      console.log('⚠️  Sign in failed, attempting to create user...');
      const userCredential = await createUserWithEmailAndPassword(auth, testEmail, testPassword);
      console.log('✅ User created and authenticated successfully\n');
      return { auth, functions, userId: userCredential.user.uid };
    } catch (createError) {
      console.error('❌ Authentication failed:', createError.message);
      throw new Error('Authentication required - please set TEST_EMAIL and TEST_PASSWORD in env/.env');
    }
  }
}

async function testPreCheck(testCase, functions, userId) {
  const testChirp = {
    id: `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    authorId: userId,
    text: testCase.text,
    topic: testCase.topic,
    semanticTopics: testCase.semanticTopics || [],
    createdAt: new Date().toISOString(),
    reachMode: 'forAll',
    commentCount: 0
  };

  try {
    const processChirpValueFn = httpsCallable(functions, 'processChirpValue');
    
    console.log(`   ⏳ Calling processChirpValue...`);
    const startTime = Date.now();
    
    const result = await processChirpValueFn({
      chirp: testChirp,
      options: {}
    });

    const duration = Date.now() - startTime;
    const resultData = result.data;

    // Analyze the result
    const hasClaims = resultData.claims && resultData.claims.length > 0;
    const hasFactChecks = resultData.factChecks && resultData.factChecks.length > 0;
    const factCheckStatus = resultData.factCheckStatus || 'pending';
    const wasFactChecked = hasClaims && (hasFactChecks || factCheckStatus !== 'pending');

    return {
      success: true,
      wasFactChecked,
      hasClaims,
      hasFactChecks,
      factCheckStatus,
      claimsCount: resultData.claims?.length || 0,
      factChecksCount: resultData.factChecks?.length || 0,
      duration,
      valueScore: resultData.valueScore,
      error: null
    };
  } catch (error) {
    return {
      success: false,
      wasFactChecked: false,
      hasClaims: false,
      hasFactChecks: false,
      factCheckStatus: 'error',
      claimsCount: 0,
      factChecksCount: 0,
      duration: 0,
      valueScore: null,
      error: error.message
    };
  }
}

async function runTests() {
  console.log('🧪 Testing Risk-Based Pre-Check Logic\n');
  console.log('='.repeat(80));
  console.log(`📊 Total test cases: ${testCases.length}\n`);

  // Authenticate
  let auth, functions, userId;
  try {
    const authResult = await authenticate();
    auth = authResult.auth;
    functions = authResult.functions;
    userId = authResult.userId;
  } catch (error) {
    console.error('❌ Authentication failed:', error.message);
    return;
  }

  let passed = 0;
  let failed = 0;
  const results = [];

  // Run each test case
  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`\n[${i + 1}/${testCases.length}] 📝 Test: ${testCase.name}`);
    console.log(`   Text: "${testCase.text}"`);
    console.log(`   Topic: ${testCase.topic}`);
    console.log(`   Expected Risk: ${testCase.expectedRisk}`);
    console.log(`   Expected Fact-Check: ${testCase.expectedFactCheck ? 'YES ✅' : 'NO ❌'}`);
    console.log(`   ${testCase.description}`);

    const result = await testPreCheck(testCase, functions, userId);

    if (result.error) {
      console.log(`   ❌ Error: ${result.error}`);
      failed++;
      results.push({ testCase, result, passed: false });
      continue;
    }

    // Check if the result matches expectation
    const matches = result.wasFactChecked === testCase.expectedFactCheck;
    const statusIcon = matches ? '✅' : '❌';
    
    console.log(`   ${statusIcon} Result:`);
    console.log(`      Fact-Checked: ${result.wasFactChecked ? 'YES' : 'NO'}`);
    console.log(`      Claims: ${result.claimsCount}`);
    console.log(`      Fact-Checks: ${result.factChecksCount}`);
    console.log(`      Status: ${result.factCheckStatus}`);
    console.log(`      Duration: ${(result.duration / 1000).toFixed(2)}s`);

    if (matches) {
      console.log(`   ✅ PASS: Expected ${testCase.expectedFactCheck ? 'fact-check' : 'skip'}, got ${result.wasFactChecked ? 'fact-check' : 'skip'}`);
      passed++;
    } else {
      console.log(`   ❌ FAIL: Expected ${testCase.expectedFactCheck ? 'fact-check' : 'skip'}, got ${result.wasFactChecked ? 'fact-check' : 'skip'}`);
      failed++;
    }

    results.push({ testCase, result, passed: matches });

    // Small delay between tests to avoid rate limiting
    if (i < testCases.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(80));
  console.log('\n📊 Test Summary:');
  console.log(`   ✅ Passed: ${passed}/${testCases.length}`);
  console.log(`   ❌ Failed: ${failed}/${testCases.length}`);
  console.log(`   📈 Success Rate: ${((passed / testCases.length) * 100).toFixed(1)}%`);

  // Detailed results
  console.log('\n📋 Detailed Results:\n');
  results.forEach(({ testCase, result, passed: testPassed }, index) => {
    const icon = testPassed ? '✅' : '❌';
    console.log(`${icon} ${index + 1}. ${testCase.name}`);
    if (!testPassed) {
      console.log(`   Expected: ${testCase.expectedFactCheck ? 'Fact-Check' : 'Skip'}`);
      console.log(`   Got: ${result.wasFactChecked ? 'Fact-Check' : 'Skip'}`);
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
    }
  });

  console.log('\n' + '='.repeat(80));
  console.log('\n💡 Notes:');
  console.log('   - High-risk posts (health, finance, politics) should always be fact-checked');
  console.log('   - Low-risk posts (opinion, personal experience) should skip');
  console.log('   - Ambiguous posts should fail-open (proceed with fact-checking)');
  console.log('   - Some tests may take 10-30 seconds due to AI processing time\n');
}

// Run the tests
runTests().catch((error) => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});

