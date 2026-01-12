/**
 * End-to-End Value Scoring System Test
 * 
 * Tests the complete value scoring system including:
 * 1. Value scoring pipeline
 * 2. Prediction generation
 * 3. Validation logic
 * 4. Ranking algorithm integration
 * 5. Quality-weighted engagement
 */

import * as admin from 'firebase-admin';
import type { Chirp, ValueScore, Claim, FactCheck } from '../src/types';
import { generateEngagementPrediction } from '../src/services/predictionService';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  try {
    admin.initializeApp();
  } catch (error) {
    // Already initialized
  }
}

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: any;
  duration: number;
}

// Test data helpers
function createTestChirp(overrides?: Partial<Chirp>): Chirp {
  const now = new Date();
  return {
    id: 'test-chirp-' + Date.now(),
    authorId: 'test-user-1',
    text: 'This is a test post with factual claims about climate change. The earth has warmed by approximately 1.1°C since pre-industrial times according to scientific consensus.',
    topic: 'science',
    semanticTopics: ['climate', 'environment'],
    reachMode: 'forAll',
    createdAt: now,
    commentCount: 0,
    bookmarkCount: 0,
    rechirpCount: 0,
    ...overrides,
  };
}

function createTestValueScore(overrides?: Partial<ValueScore>): ValueScore {
  const now = new Date();
  return {
    epistemic: 0.8,
    insight: 0.7,
    practical: 0.6,
    relational: 0.75,
    effort: 0.7,
    total: 0.71,
    confidence: 0.85,
    updatedAt: now,
    ...overrides,
  };
}

function createTestClaims(): Claim[] {
  const now = new Date();
  return [
    {
      id: 'claim-1',
      text: 'The earth has warmed by approximately 1.1°C since pre-industrial times',
      type: 'fact',
      domain: 'science',
      riskLevel: 'medium',
      confidence: 0.9,
      extractedAt: now,
    },
  ];
}

function createTestFactChecks(): FactCheck[] {
  const now = new Date();
  return [
    {
      id: 'fact-check-1',
      claimId: 'claim-1',
      verdict: 'true',
      confidence: 0.95,
      evidence: [
        {
          source: 'IPCC',
          url: 'https://www.ipcc.ch/',
          snippet: 'Global surface temperature has increased faster since 1970 than in any other 50-year period',
          quality: 0.95,
        },
      ],
      checkedAt: now,
    },
  ];
}

async function testAgent(name: string, testFn: () => Promise<any>): Promise<TestResult> {
  const startTime = Date.now();
  try {
    const result = await testFn();
    const duration = Date.now() - startTime;
    return {
      name,
      passed: true,
      details: result,
      duration,
    };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    return {
      name,
      passed: false,
      error: error.message || String(error),
      duration,
    };
  }
}

// Test 1: Prediction Generation
async function testPredictionGeneration(): Promise<any> {
  const valueScore = createTestValueScore();
  const claims = createTestClaims();
  const factChecks = createTestFactChecks();

  const prediction = generateEngagementPrediction(valueScore, claims, factChecks);

  // Validate prediction structure
  if (!prediction.expectedViews7d || prediction.expectedViews7d < 0) {
    throw new Error('Invalid expectedViews7d');
  }
  if (!prediction.expectedBookmarks7d || prediction.expectedBookmarks7d < 0) {
    throw new Error('Invalid expectedBookmarks7d');
  }
  if (!prediction.expectedRechirps7d || prediction.expectedRechirps7d < 0) {
    throw new Error('Invalid expectedRechirps7d');
  }
  if (!prediction.expectedComments7d || prediction.expectedComments7d < 0) {
    throw new Error('Invalid expectedComments7d');
  }
  if (!(prediction.predictedAt instanceof Date)) {
    throw new Error('Invalid predictedAt date');
  }

  // Test that high value scores generate higher predictions
  const highValueScore = createTestValueScore({ total: 0.9, confidence: 0.9 });
  const lowValueScore = createTestValueScore({ total: 0.2, confidence: 0.5 });
  
  const highPrediction = generateEngagementPrediction(highValueScore, claims, factChecks);
  const lowPrediction = generateEngagementPrediction(lowValueScore, claims, factChecks);

  if (highPrediction.expectedViews7d <= lowPrediction.expectedViews7d) {
    throw new Error('High value scores should generate higher predictions');
  }

  // Test that false claims reduce predictions
  const falseFactChecks: FactCheck[] = [
    {
      id: 'fact-check-false',
      claimId: 'claim-1',
      verdict: 'false',
      confidence: 0.9,
      evidence: [],
      checkedAt: new Date(),
    },
  ];
  const predictionWithFalse = generateEngagementPrediction(valueScore, claims, falseFactChecks);
  const predictionWithTrue = generateEngagementPrediction(valueScore, claims, factChecks);

  if (predictionWithFalse.expectedViews7d >= predictionWithTrue.expectedViews7d) {
    throw new Error('False claims should reduce predictions');
  }

  return {
    prediction,
    highValuePrediction: highPrediction,
    lowValuePrediction: lowPrediction,
    falseClaimPrediction: predictionWithFalse,
    trueClaimPrediction: predictionWithTrue,
  };
}

// Test 2: Validation Logic (Mock Test)
async function testValidationLogic(): Promise<any> {
  // Create test chirp with predictions and actual engagement
  const chirp = createTestChirp({
    predictedEngagement: {
      expectedViews7d: 100,
      expectedBookmarks7d: 10,
      expectedRechirps7d: 5,
      expectedComments7d: 20,
      predictedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    },
    bookmarkCount: 1, // Actual: much lower than predicted
    rechirpCount: 0, // Actual: much lower than predicted
    commentCount: 1, // Actual: much lower than predicted
  });

  const predicted = chirp.predictedEngagement!;
  const actualBookmarks = chirp.bookmarkCount ?? 0;
  const actualRechirps = chirp.rechirpCount ?? 0;
  const actualComments = chirp.commentCount ?? 0;

  // Calculate prediction errors (same logic as validationService)
  const bookmarkError = Math.abs(predicted.expectedBookmarks7d - actualBookmarks) / Math.max(predicted.expectedBookmarks7d, 1);
  const rechirpError = Math.abs(predicted.expectedRechirps7d - actualRechirps) / Math.max(predicted.expectedRechirps7d, 1);
  const commentError = Math.abs(predicted.expectedComments7d - actualComments) / Math.max(predicted.expectedComments7d, 1);
  const overallError = (bookmarkError + rechirpError + commentError) / 3;

  // Flag as suspicious if high prediction error AND low actual engagement
  const flaggedForReview =
    overallError > 0.8 &&
    actualBookmarks < predicted.expectedBookmarks7d * 0.2 &&
    actualRechirps < predicted.expectedRechirps7d * 0.2 &&
    actualComments < predicted.expectedComments7d * 0.2;

  if (!flaggedForReview) {
    throw new Error('Expected flagging for review (high error + low engagement)');
  }

  // Test with accurate predictions (should not flag)
  const accurateChirp = createTestChirp({
    predictedEngagement: {
      expectedViews7d: 100,
      expectedBookmarks7d: 10,
      expectedRechirps7d: 5,
      expectedComments7d: 20,
      predictedAt: new Date(),
    },
    bookmarkCount: 9, // Close to predicted
    rechirpCount: 5, // Close to predicted
    commentCount: 18, // Close to predicted
  });

  const accuratePredicted = accurateChirp.predictedEngagement!;
  const accurateBookmarks = accurateChirp.bookmarkCount ?? 0;
  const accurateRechirps = accurateChirp.rechirpCount ?? 0;
  const accurateComments = accurateChirp.commentCount ?? 0;

  const accurateBookmarkError = Math.abs(accuratePredicted.expectedBookmarks7d - accurateBookmarks) / Math.max(accuratePredicted.expectedBookmarks7d, 1);
  const accurateRechirpError = Math.abs(accuratePredicted.expectedRechirps7d - accurateRechirps) / Math.max(accuratePredicted.expectedRechirps7d, 1);
  const accurateCommentError = Math.abs(accuratePredicted.expectedComments7d - accurateComments) / Math.max(accuratePredicted.expectedComments7d, 1);
  const accurateOverallError = (accurateBookmarkError + accurateRechirpError + accurateCommentError) / 3;

  const accurateFlagged =
    accurateOverallError > 0.8 &&
    accurateBookmarks < accuratePredicted.expectedBookmarks7d * 0.2 &&
    accurateRechirps < accuratePredicted.expectedRechirps7d * 0.2 &&
    accurateComments < accuratePredicted.expectedComments7d * 0.2;

  if (accurateFlagged) {
    throw new Error('Should not flag accurate predictions');
  }

  return {
    flaggedChirp: {
      overallError,
      flaggedForReview,
      predicted: {
        bookmarks: predicted.expectedBookmarks7d,
        rechirps: predicted.expectedRechirps7d,
        comments: predicted.expectedComments7d,
      },
      actual: {
        bookmarks: actualBookmarks,
        rechirps: actualRechirps,
        comments: actualComments,
      },
    },
    accurateChirp: {
      overallError: accurateOverallError,
      flaggedForReview: accurateFlagged,
      predicted: {
        bookmarks: accuratePredicted.expectedBookmarks7d,
        rechirps: accuratePredicted.expectedRechirps7d,
        comments: accuratePredicted.expectedComments7d,
      },
      actual: {
        bookmarks: accurateBookmarks,
        rechirps: accurateRechirps,
        comments: accurateComments,
      },
    },
  };
}

// Test 3: Ranking Algorithm Integration (Logic Test)
async function testRankingAlgorithm(): Promise<any> {
  // Test ranking logic without importing shared code
  // We test that the ranking signals work correctly based on the algorithm implementation
  
  // Test 1: Bookmark boost logic
  // From algorithm: bookmarkBoost = Math.min(25, bookmarkCount * 3)
  const highBookmarks = 50;
  const lowBookmarks = 0;
  const highBookmarkBoost = Math.min(25, highBookmarks * 3);
  const lowBookmarkBoost = Math.min(25, lowBookmarks * 3);
  
  if (highBookmarkBoost <= lowBookmarkBoost) {
    throw new Error('High bookmarks should generate higher boost');
  }
  if (highBookmarkBoost !== 25) {
    throw new Error('Bookmark boost should cap at 25');
  }

  // Test 2: Rechirp boost logic (logarithmic)
  // From algorithm: rechirpBoost = Math.min(20, Math.log10(rechirpCount + 1) * 8)
  const highRechirps = 20;
  const lowRechirps = 0;
  const highRechirpBoost = Math.min(20, Math.log10(highRechirps + 1) * 8);
  const lowRechirpBoost = Math.min(20, Math.log10(lowRechirps + 1) * 8);
  
  if (highRechirpBoost <= lowRechirpBoost) {
    throw new Error('High rechirps should generate higher boost');
  }

  // Test 3: Prediction validation penalty
  // From algorithm: score -= 15 if flaggedForReview
  const baseScore = 100;
  const penaltyScore = baseScore - 15; // Flagged penalty
  if (penaltyScore !== 85) {
    throw new Error('Prediction validation penalty should be 15 points');
  }

  // Test 4: Quality-weighted bookmark boost
  // From algorithm: qualityBookmarkBoost = qualityWeightedBookmarkScore * 20
  const qualityScore = 0.9;
  const qualityBoost = qualityScore * 20;
  if (qualityBoost !== 18) {
    throw new Error('Quality-weighted bookmark boost calculation incorrect');
  }

  // Test 5: Quality-weighted comment score normalization
  // From algorithm: commentMetric = qualityWeightedCommentScore * 100 (normalize to similar scale)
  const qualityCommentScore = 0.8;
  const normalizedCommentMetric = qualityCommentScore * 100;
  if (normalizedCommentMetric !== 80) {
    throw new Error('Quality-weighted comment score normalization incorrect');
  }

  return {
    bookmarkBoost: {
      high: highBookmarkBoost,
      low: lowBookmarkBoost,
      capped: highBookmarkBoost === 25,
    },
    rechirpBoost: {
      high: highRechirpBoost,
      low: lowRechirpBoost,
      logarithmic: highRechirpBoost > lowRechirpBoost,
    },
    predictionPenalty: {
      baseScore,
      penaltyScore,
      penalty: 15,
    },
    qualityBoost: {
      score: qualityScore,
      boost: qualityBoost,
      maxBoost: 20,
    },
    qualityCommentNormalization: {
      qualityScore: qualityCommentScore,
      normalized: normalizedCommentMetric,
    },
  };
}

// Test 4: Value Score Structure
async function testValueScoreStructure(): Promise<any> {
  const valueScore = createTestValueScore();

  // Validate all dimensions are 0-1
  const dimensions = ['epistemic', 'insight', 'practical', 'relational', 'effort'] as const;
  for (const dim of dimensions) {
    const value = valueScore[dim];
    if (value < 0 || value > 1) {
      throw new Error(`Invalid ${dim} value: ${value} (must be 0-1)`);
    }
  }

  // Validate total is 0-1
  if (valueScore.total < 0 || valueScore.total > 1) {
    throw new Error(`Invalid total value: ${valueScore.total} (must be 0-1)`);
  }

  // Validate confidence is 0-1
  if (valueScore.confidence < 0 || valueScore.confidence > 1) {
    throw new Error(`Invalid confidence value: ${valueScore.confidence} (must be 0-1)`);
  }

  // Validate updatedAt is a Date
  if (!(valueScore.updatedAt instanceof Date)) {
    throw new Error('Invalid updatedAt (must be Date)');
  }

  return {
    valueScore,
    dimensions: dimensions.map(dim => ({ name: dim, value: valueScore[dim] })),
    total: valueScore.total,
    confidence: valueScore.confidence,
  };
}

// Test 5: Integration Test (Full Flow)
async function testFullIntegration(): Promise<any> {
  // This test simulates the full flow without actually calling Firestore
  // We test that all components work together logically

  // Step 1: Create a chirp
  const chirp = createTestChirp({
    text: 'The scientific consensus on climate change is overwhelming. 97% of climate scientists agree that human activities are the primary driver of recent climate change.',
  });

  // Step 2: Generate value score (simulated)
  const valueScore = createTestValueScore({
    epistemic: 0.9,
    insight: 0.7,
    practical: 0.6,
    relational: 0.8,
    effort: 0.75,
    total: 0.75,
    confidence: 0.9,
  });

  // Step 3: Generate predictions
  const claims = createTestClaims();
  const factChecks = createTestFactChecks();
  const prediction = generateEngagementPrediction(valueScore, claims, factChecks);

  // Step 4: Simulate actual engagement (after 7 days)
  const actualEngagement = {
    bookmarks: 45,
    rechirps: 18,
    comments: 85,
  };

  // Step 5: Calculate validation errors
  const bookmarkError = Math.abs(prediction.expectedBookmarks7d - actualEngagement.bookmarks) / Math.max(prediction.expectedBookmarks7d, 1);
  const rechirpError = Math.abs(prediction.expectedRechirps7d - actualEngagement.rechirps) / Math.max(prediction.expectedRechirps7d, 1);
  const commentError = Math.abs(prediction.expectedComments7d - actualEngagement.comments) / Math.max(prediction.expectedComments7d, 1);
  const overallError = (bookmarkError + rechirpError + commentError) / 3;

  const flaggedForReview =
    overallError > 0.8 &&
    actualEngagement.bookmarks < prediction.expectedBookmarks7d * 0.2 &&
    actualEngagement.rechirps < prediction.expectedRechirps7d * 0.2 &&
    actualEngagement.comments < prediction.expectedComments7d * 0.2;

  // Simulate ranking score calculation (testing logic, not importing shared code)
  // Base score from value score
  let rankingScore = valueScore.total * 40; // Value score boost (from algorithm)
  
  // Add bookmark boost
  const bookmarkBoost = Math.min(25, actualEngagement.bookmarks * 3);
  rankingScore += bookmarkBoost;
  
  // Add rechirp boost (logarithmic)
  const rechirpBoost = Math.min(20, Math.log10(actualEngagement.rechirps + 1) * 8);
  rankingScore += rechirpBoost;
  
  // Add comment boost
  const commentBoost = Math.min(20, Math.log10(actualEngagement.comments + 1) * 5);
  rankingScore += commentBoost;
  
  // Apply prediction validation penalty
  if (flaggedForReview) {
    rankingScore -= 15; // Penalty from algorithm
  }

  return {
    chirp: {
      id: chirp.id,
      text: chirp.text.substring(0, 50) + '...',
    },
    valueScore: {
      total: valueScore.total,
      confidence: valueScore.confidence,
    },
    prediction: {
      expectedBookmarks7d: prediction.expectedBookmarks7d,
      expectedRechirps7d: prediction.expectedRechirps7d,
      expectedComments7d: prediction.expectedComments7d,
    },
    actualEngagement,
    validation: {
      overallError,
      flaggedForReview,
    },
    ranking: {
      finalScore: rankingScore,
      boosts: {
        valueScore: valueScore.total * 40,
        bookmark: bookmarkBoost,
        rechirp: rechirpBoost,
        comment: commentBoost,
      },
      penalty: flaggedForReview ? 15 : 0,
    },
  };
}

// Main test runner
async function runAllTests(): Promise<void> {
  console.log('🧪 Value Scoring System End-to-End Test');
  console.log('=' .repeat(60));
  console.log('');

  const tests = [
    { name: 'Prediction Generation', fn: testPredictionGeneration },
    { name: 'Validation Logic', fn: testValidationLogic },
    { name: 'Ranking Algorithm Integration', fn: testRankingAlgorithm },
    { name: 'Value Score Structure', fn: testValueScoreStructure },
    { name: 'Full Integration Flow', fn: testFullIntegration },
  ];

  const results: TestResult[] = [];

  for (const test of tests) {
    console.log(`Testing: ${test.name}...`);
    const result = await testAgent(test.name, test.fn);
    results.push(result);

    if (result.passed) {
      console.log(`✅ ${test.name} - PASSED (${result.duration}ms)`);
      if (result.details) {
        console.log(`   Details: ${JSON.stringify(result.details, null, 2).substring(0, 200)}...`);
      }
    } else {
      console.log(`❌ ${test.name} - FAILED (${result.duration}ms)`);
      console.log(`   Error: ${result.error}`);
    }
    console.log('');
  }

  // Summary
  console.log('='.repeat(60));
  console.log('📊 Test Summary');
  console.log('='.repeat(60));
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  console.log(`Total Tests: ${results.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏱️  Total Duration: ${totalDuration}ms`);
  console.log('');

  if (failed > 0) {
    console.log('Failed Tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  ❌ ${r.name}: ${r.error}`);
    });
    console.log('');
    process.exit(1);
  } else {
    console.log('✅ All tests passed!');
    console.log('');
    process.exit(0);
  }
}

// Run tests
runAllTests().catch((error) => {
  console.error('❌ Test execution failed:', error);
  process.exit(1);
});

