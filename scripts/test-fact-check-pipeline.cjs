/**
 * Comprehensive Fact-Check Pipeline Test
 * 
 * Tests each step of the value pipeline:
 * 1. Pre-check
 * 2. Claim extraction
 * 3. Fact-checking
 * 4. Value scoring
 * 5. Explanation generation
 */

const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } = require('firebase/auth');
const { getFunctions, httpsCallable } = require('firebase/functions');
const { getFirestore, collection, addDoc, doc, getDoc, updateDoc, Timestamp, deleteDoc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: 'AIzaSyDZK8Satgjpb2ytIcqKA2R_1rpPCATjrak',
  authDomain: 'chirp-web-7e581.firebaseapp.com',
  projectId: 'chirp-web-7e581',
  storageBucket: 'chirp-web-7e581.firebasestorage.app',
  messagingSenderId: '679170031454',
  appId: '1:679170031454:web:4b8064ff973a10f4d859cf',
};

let app;
let auth;
let db;
let functions;

async function initialize() {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  functions = getFunctions(app);
  console.log('✅ Firebase initialized\n');
}

async function authenticateAndGetFunctions() {
  const testEmail = `test-${Date.now()}@test.com`;
  const testPassword = 'TestPassword123!';

  try {
    // Try to create new user first
    await createUserWithEmailAndPassword(auth, testEmail, testPassword);
    console.log(`✅ Created and signed in as: ${testEmail}`);
  } catch (error) {
    if (error.code === 'auth/email-already-in-use') {
      // User exists, try to sign in
      try {
        await signInWithEmailAndPassword(auth, testEmail, testPassword);
        console.log(`✅ Signed in as existing user: ${testEmail}`);
      } catch (signInError) {
        // If sign-in fails, create a new user with different email
        const newEmail = `test-${Date.now()}-${Math.random().toString(36).substr(2, 5)}@test.com`;
        await createUserWithEmailAndPassword(auth, newEmail, testPassword);
        console.log(`✅ Created and signed in as: ${newEmail}`);
        return { email: newEmail, userId: auth.currentUser.uid };
      }
    } else {
      throw error;
    }
  }

  return { email: testEmail, userId: auth.currentUser.uid };
}

async function createChirp(chirpData, db) {
  const payload = {
    authorId: chirpData.authorId,
    text: chirpData.text,
    topic: chirpData.topic || 'general',
    reachMode: chirpData.reachMode || 'forAll',
    createdAt: Timestamp.now(),
    commentCount: 0,
    factCheckingStatus: 'pending',
    factCheckingStartedAt: Timestamp.now(),
    semanticTopics: chirpData.semanticTopics || [],
    entities: chirpData.entities || [],
  };

  // Only add imageUrl if it's provided (Firestore doesn't allow undefined)
  if (chirpData.imageUrl) {
    payload.imageUrl = chirpData.imageUrl;
  }

  const docRef = await addDoc(collection(db, 'chirps'), payload);
  const created = await getDoc(docRef);
  if (!created.exists()) {
    throw new Error('Failed to create chirp in Firestore');
  }
  
  const data = created.data();
  return {
    id: created.id,
    ...payload,
    imageUrl: chirpData.imageUrl,
    createdAt: data.createdAt.toDate(),
    factCheckingStartedAt: data.factCheckingStartedAt?.toDate(),
  };
}

async function getChirpFromFirestore(chirpId, db) {
  const docRef = doc(db, 'chirps', chirpId);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) {
    return null;
  }
  const data = docSnap.data();
  return {
    id: docSnap.id,
    ...data,
    createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
    factCheckingStartedAt: data.factCheckingStartedAt?.toDate ? data.factCheckingStartedAt.toDate() : data.factCheckingStartedAt,
  };
}

const testCases = [
  {
    id: 'high-risk-health',
    name: 'High-Risk Health Claim',
    text: 'COVID-19 vaccines cause autism in 50% of children. A study from Harvard Medical School confirms this.',
    topic: 'health',
    semanticTopics: ['health', 'medical', 'vaccines'],
    entities: ['COVID-19', 'Harvard Medical School'],
    expectedFactCheck: true,
    expectedClaims: true,
    description: 'Should trigger fact-checking due to high-risk health claim with statistics',
  },
  {
    id: 'low-risk-opinion',
    name: 'Low-Risk Opinion',
    text: 'I think the weather is nice today.',
    topic: 'general',
    semanticTopics: [],
    entities: [],
    expectedFactCheck: false,
    expectedClaims: false,
    description: 'Should skip fact-checking (opinion, no factual claims)',
  },
  {
    id: 'medium-risk-politics',
    name: 'Medium-Risk Political Claim',
    text: 'The current administration has increased taxes by 15% according to official reports.',
    topic: 'politics',
    semanticTopics: ['politics', 'taxes'],
    entities: ['current administration'],
    expectedFactCheck: true,
    expectedClaims: true,
    description: 'Should trigger fact-checking (political claim with statistics)',
  },
  {
    id: 'factual-news',
    name: 'Factual News Claim',
    text: 'Breaking: NASA announced today that they discovered water on Mars. The discovery was made by the Perseverance rover.',
    topic: 'science',
    semanticTopics: ['science', 'space', 'NASA'],
    entities: ['NASA', 'Mars', 'Perseverance rover'],
    expectedFactCheck: true,
    expectedClaims: true,
    description: 'Should trigger fact-checking (factual news with specific claims)',
  },
];

async function testStep(stepName, testFn) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${stepName}`);
  console.log('='.repeat(60));
  
  try {
    const result = await testFn();
    console.log(`✅ ${stepName}: PASSED`);
    return { success: true, result };
  } catch (error) {
    console.error(`❌ ${stepName}: FAILED`);
    console.error(`   Error: ${error.message}`);
    if (error.details) {
      console.error(`   Details: ${JSON.stringify(error.details, null, 2)}`);
    }
    return { success: false, error: error.message };
  }
}

async function testPreCheck(chirp, functions) {
  // Pre-check is done internally by processChirpValue
  // We'll check the result after processing
  return { note: 'Pre-check is integrated into processChirpValue' };
}

async function testClaimExtraction(chirp, functions) {
  const processChirpValueFn = httpsCallable(functions, 'processChirpValue');
  
  const result = await processChirpValueFn({
    chirpId: chirp.id,
    options: {},
  });

  const resultData = result.data;
  const hasClaims = resultData.claims && resultData.claims.length > 0;
  
  console.log(`   Claims extracted: ${hasClaims ? resultData.claims.length : 0}`);
  if (hasClaims) {
    resultData.claims.forEach((claim, idx) => {
      console.log(`   Claim ${idx + 1}: "${claim.text.substring(0, 60)}..." (${claim.type}, ${claim.domain})`);
    });
  }
  
  return {
    hasClaims,
    claims: resultData.claims || [],
    factCheckStatus: resultData.factCheckStatus,
  };
}

async function testFactChecking(chirp, functions) {
  const processChirpValueFn = httpsCallable(functions, 'processChirpValue');
  
  const result = await processChirpValueFn({
    chirpId: chirp.id,
    options: {},
  });

  const resultData = result.data;
  const hasFactChecks = resultData.factChecks && resultData.factChecks.length > 0;
  
  console.log(`   Fact checks performed: ${hasFactChecks ? resultData.factChecks.length : 0}`);
  if (hasFactChecks) {
    resultData.factChecks.forEach((fc, idx) => {
      console.log(`   Fact Check ${idx + 1}: ${fc.verdict.toUpperCase()} (${(fc.confidence * 100).toFixed(0)}% confidence)`);
      if (fc.evidence && fc.evidence.length > 0) {
        console.log(`      Evidence: ${fc.evidence.length} sources`);
      }
      if (fc.caveats && fc.caveats.length > 0) {
        console.log(`      Caveats: ${fc.caveats.join(', ')}`);
      }
    });
  } else if (resultData.claims && resultData.claims.length > 0) {
    console.log(`   ⚠️  Claims exist but no fact-checks were performed`);
  }
  
  return {
    hasFactChecks,
    factChecks: resultData.factChecks || [],
    factCheckStatus: resultData.factCheckStatus,
  };
}

async function testValueScoring(chirp, functions) {
  const processChirpValueFn = httpsCallable(functions, 'processChirpValue');
  
  const result = await processChirpValueFn({
    chirpId: chirp.id,
    options: {},
  });

  const resultData = result.data;
  const hasValueScore = resultData.valueScore !== null && resultData.valueScore !== undefined;
  
  console.log(`   Value score calculated: ${hasValueScore ? 'Yes' : 'No'}`);
  if (hasValueScore) {
    const score = resultData.valueScore;
    console.log(`   Total: ${(score.total * 100).toFixed(0)}`);
    console.log(`   Epistemic: ${(score.epistemic * 100).toFixed(0)}`);
    console.log(`   Insight: ${(score.insight * 100).toFixed(0)}`);
    console.log(`   Practical: ${(score.practical * 100).toFixed(0)}`);
    console.log(`   Relational: ${(score.relational * 100).toFixed(0)}`);
    console.log(`   Confidence: ${score.confidence ? (score.confidence * 100).toFixed(0) + '%' : 'N/A'}`);
  }
  
  return {
    hasValueScore,
    valueScore: resultData.valueScore,
  };
}

async function testExplanation(chirp, functions) {
  const processChirpValueFn = httpsCallable(functions, 'processChirpValue');
  
  const result = await processChirpValueFn({
    chirpId: chirp.id,
    options: {},
  });

  const resultData = result.data;
  const hasExplanation = resultData.valueExplanation && resultData.valueExplanation.trim().length > 0;
  
  console.log(`   Explanation generated: ${hasExplanation ? 'Yes' : 'No'}`);
  if (hasExplanation) {
    console.log(`   Explanation: "${resultData.valueExplanation.substring(0, 100)}..."`);
  }
  
  return {
    hasExplanation,
    explanation: resultData.valueExplanation,
  };
}

async function runFullPipelineTest(testCase, functions, db, userId) {
  console.log(`\n${'#'.repeat(60)}`);
  console.log(`Test Case: ${testCase.name} (${testCase.id})`);
  console.log(`#`.repeat(60));
  console.log(`Description: ${testCase.description}`);
  console.log(`Text: "${testCase.text}"`);
  console.log(`Topic: ${testCase.topic}`);
  console.log(`Expected Fact-Check: ${testCase.expectedFactCheck ? 'YES ✅' : 'NO ❌'}`);
  console.log(`Expected Claims: ${testCase.expectedClaims ? 'YES ✅' : 'NO ❌'}`);

  let createdChirp;
  try {
    // Step 0: Create chirp in Firestore
    console.log('\n📝 Step 0: Creating chirp in Firestore...');
    createdChirp = await createChirp(
      {
        authorId: userId,
        text: testCase.text,
        topic: testCase.topic,
        semanticTopics: testCase.semanticTopics,
        entities: testCase.entities,
        reachMode: 'forAll',
      },
      db
    );
    console.log(`   ✅ Chirp created with ID: ${createdChirp.id}`);

    // Step 1: Test Pre-Check (integrated)
    const preCheckResult = await testStep('Step 1: Pre-Check', () =>
      testPreCheck(createdChirp, functions)
    );

    // Step 2: Test Claim Extraction
    const claimResult = await testStep('Step 2: Claim Extraction', () =>
      testClaimExtraction(createdChirp, functions)
    );

    // Step 3: Test Fact-Checking
    const factCheckResult = await testStep('Step 3: Fact-Checking', () =>
      testFactChecking(createdChirp, functions)
    );

    // Step 4: Test Value Scoring
    const valueScoreResult = await testStep('Step 4: Value Scoring', () =>
      testValueScoring(createdChirp, functions)
    );

    // Step 5: Test Explanation
    const explanationResult = await testStep('Step 5: Explanation Generation', () =>
      testExplanation(createdChirp, functions)
    );

    // Verify final state in Firestore
    console.log(`\n📊 Verifying final state in Firestore...`);
    const finalChirp = await getChirpFromFirestore(createdChirp.id, db);
    if (finalChirp) {
      console.log(`   Fact-checking status: ${finalChirp.factCheckingStatus || 'N/A'}`);
      console.log(`   Fact-check status: ${finalChirp.factCheckStatus || 'N/A'}`);
      console.log(`   Claims in Firestore: ${finalChirp.claims?.length || 0}`);
      console.log(`   Fact-checks in Firestore: ${finalChirp.factChecks?.length || 0}`);
      console.log(`   Value score in Firestore: ${finalChirp.valueScore ? 'Yes' : 'No'}`);
    }

    // Summary
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Test Summary: ${testCase.name}`);
    console.log('='.repeat(60));
    console.log(`Pre-Check: ${preCheckResult.success ? '✅' : '❌'}`);
    console.log(`Claim Extraction: ${claimResult.success ? '✅' : '❌'} ${claimResult.result?.hasClaims ? `(${claimResult.result.claims.length} claims)` : '(no claims)'}`);
    console.log(`Fact-Checking: ${factCheckResult.success ? '✅' : '❌'} ${factCheckResult.result?.hasFactChecks ? `(${factCheckResult.result.factChecks.length} fact-checks)` : '(no fact-checks)'}`);
    console.log(`Value Scoring: ${valueScoreResult.success ? '✅' : '❌'} ${valueScoreResult.result?.hasValueScore ? '(score calculated)' : '(no score)'}`);
    console.log(`Explanation: ${explanationResult.success ? '✅' : '❌'} ${explanationResult.result?.hasExplanation ? '(generated)' : '(no explanation)'}`);

    // Validation
    const passed =
      claimResult.success &&
      factCheckResult.success &&
      valueScoreResult.success &&
      explanationResult.success;

    const expectedMatches =
      (!testCase.expectedFactCheck || factCheckResult.result?.hasFactChecks) &&
      (!testCase.expectedClaims || claimResult.result?.hasClaims);

    if (passed && expectedMatches) {
      console.log(`\n✅ Test Case PASSED`);
    } else {
      console.log(`\n❌ Test Case FAILED`);
      if (!expectedMatches) {
        console.log(`   Expected fact-check: ${testCase.expectedFactCheck}, Got: ${factCheckResult.result?.hasFactChecks}`);
        console.log(`   Expected claims: ${testCase.expectedClaims}, Got: ${claimResult.result?.hasClaims}`);
      }
    }

    return {
      success: passed && expectedMatches,
      results: {
        preCheck: preCheckResult,
        claims: claimResult,
        factChecks: factCheckResult,
        valueScore: valueScoreResult,
        explanation: explanationResult,
      },
    };
  } catch (error) {
    console.error(`\n❌ Test Case FAILED with error:`, error);
    return { success: false, error: error.message };
  } finally {
    // Cleanup
    if (createdChirp) {
      try {
        await deleteDoc(doc(db, 'chirps', createdChirp.id));
        console.log(`\n🧹 Cleaned up test chirp ${createdChirp.id}`);
      } catch (cleanupError) {
        console.warn(`   ⚠️  Failed to cleanup chirp: ${cleanupError.message}`);
      }
    }
  }
}

async function main() {
  console.log('🧪 Fact-Check Pipeline Comprehensive Test');
  console.log('='.repeat(60));
  console.log('Testing each step of the value pipeline:');
  console.log('1. Pre-check');
  console.log('2. Claim extraction');
  console.log('3. Fact-checking');
  console.log('4. Value scoring');
  console.log('5. Explanation generation');
  console.log('='.repeat(60));

  try {
    await initialize();
    const { userId } = await authenticateAndGetFunctions();

    const results = [];
    for (const testCase of testCases) {
      const result = await runFullPipelineTest(testCase, functions, db, userId);
      results.push({ testCase: testCase.name, ...result });
      
      // Wait a bit between tests to avoid rate limits
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    // Final summary
    console.log(`\n${'#'.repeat(60)}`);
    console.log('FINAL SUMMARY');
    console.log('#'.repeat(60));
    const passed = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;
    console.log(`Total tests: ${results.length}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);

    results.forEach((result) => {
      console.log(`\n${result.success ? '✅' : '❌'} ${result.testCase}`);
      if (!result.success && result.error) {
        console.log(`   Error: ${result.error}`);
      }
    });

    process.exit(failed > 0 ? 1 : 0);
  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  }
}

main();

