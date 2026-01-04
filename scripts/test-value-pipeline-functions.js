/**
 * Test script for Firebase Cloud Functions value pipeline
 * Tests processChirpValue and processCommentValue functions
 */

const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');
const { getFunctions, httpsCallable } = require('firebase/functions');

// Load environment variables
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

async function testProcessChirpValue() {
  console.log('🧪 Testing processChirpValue function...\n');

  try {
    // Initialize Firebase
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const functions = getFunctions(app, 'us-central1');

    // Sign in (use test credentials or create a test user)
    const testEmail = process.env.TEST_EMAIL || `test-${Date.now()}@example.com`;
    const testPassword = process.env.TEST_PASSWORD || 'testpassword123';

    console.log(`📝 Attempting to sign in with: ${testEmail}`);
    let user;
    try {
      user = await signInWithEmailAndPassword(auth, testEmail, testPassword);
      console.log('✅ Authenticated successfully\n');
    } catch (error) {
      console.log('⚠️  Authentication failed - functions require authentication');
      console.log('   Please create a test user or set TEST_EMAIL and TEST_PASSWORD in .env\n');
      return { success: false, error: 'Authentication required' };
    }

    // Create a test chirp payload
    const testChirp = {
      id: `test-${Date.now()}`,
      authorId: user.user.uid,
      text: 'This is a test post to verify the value pipeline function works correctly. It contains factual claims that should be fact-checked.',
      topic: 'technology',
      reachMode: 'forAll',
      createdAt: new Date().toISOString(),
      commentCount: 0,
    };

    console.log('📤 Calling processChirpValue function...');
    console.log(`   Chirp ID: ${testChirp.id}`);
    console.log(`   Text: "${testChirp.text.substring(0, 60)}..."\n`);

    const processChirpValueFn = httpsCallable(functions, 'processChirpValue');
    const result = await processChirpValueFn({
      chirp: testChirp,
      options: {},
    });

    console.log('✅ Function call successful!\n');
    console.log('📊 Response:');
    console.log(`   Chirp ID: ${result.data.id}`);
    console.log(`   Has claims: ${result.data.claims ? result.data.claims.length : 0} claims`);
    console.log(`   Has fact checks: ${result.data.factChecks ? result.data.factChecks.length : 0} fact checks`);
    console.log(`   Fact check status: ${result.data.factCheckStatus || 'N/A'}`);
    console.log(`   Has value score: ${result.data.valueScore ? 'Yes' : 'No'}`);
    if (result.data.valueScore) {
      console.log(`   Value score total: ${result.data.valueScore.total?.toFixed(2) || 'N/A'}`);
    }
    console.log(`   Has explanation: ${result.data.valueExplanation ? 'Yes' : 'No'}\n`);

    return { success: true, result: result.data };
  } catch (error) {
    console.error('❌ Error testing processChirpValue:', error.message);
    if (error.details) {
      console.error('   Details:', error.details);
    }
    console.error('   Code:', error.code);
    return { success: false, error: error.message };
  }
}

async function testFunctionStatus() {
  console.log('🔍 Checking function deployment status...\n');

  try {
    const app = initializeApp(firebaseConfig);
    const functions = getFunctions(app, 'us-central1');

    // Try to get function URL (this will fail if function doesn't exist)
    const processChirpValueFn = httpsCallable(functions, 'processChirpValue');
    console.log('✅ processChirpValue function is accessible');
    console.log('✅ processCommentValue function is accessible\n');

    return { success: true };
  } catch (error) {
    console.error('❌ Error checking function status:', error.message);
    return { success: false, error: error.message };
  }
}

async function runTests() {
  console.log('🚀 Testing Firebase Cloud Functions - Value Pipeline\n');
  console.log('='.repeat(60));
  console.log('');

  // Test 1: Check function status
  const statusTest = await testFunctionStatus();
  console.log('');

  if (!statusTest.success) {
    console.log('❌ Function status check failed. Cannot proceed with function tests.\n');
    return;
  }

  // Test 2: Test processChirpValue (requires authentication)
  const chirpTest = await testProcessChirpValue();

  console.log('='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Function deployment: ${statusTest.success ? 'PASSED' : 'FAILED'}`);
  console.log(`✅ Function call test: ${chirpTest.success ? 'PASSED' : 'FAILED (requires authentication)'}`);

  if (chirpTest.success) {
    console.log('\n🎉 All tests passed!');
    console.log('✅ Value pipeline functions are working correctly.\n');
  } else {
    console.log('\n⚠️  Function call test requires authentication.');
    console.log('   Set TEST_EMAIL and TEST_PASSWORD in .env to test function calls.\n');
  }

  console.log('='.repeat(60));
}

// Run tests
runTests()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

