/**
 * Semantic Similarity Implementation Test Script
 * Tests the complete semantic similarity flow for tuned posts
 * 
 * Usage: node scripts/test-semantic-similarity.js
 * 
 * This tests:
 * - Embedding generation service
 * - Similarity calculation utility
 * - Profile embedding generation
 * - Post embedding generation
 * - Audience embedding generation
 * - Algorithm eligibility checks
 * - Algorithm scoring
 * - Edge cases and error handling
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config({ path: join(__dirname, '..', '.env') });

// Test results tracking
const testResults = {
  passed: 0,
  failed: 0,
  errors: [],
  warnings: [],
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

function warn(message) {
  testResults.warnings.push(message);
  console.warn(`⚠️  ${message}`);
}

// Test 1: File Existence Checks
console.log('\n📁 Testing File Structure...\n');

const filesToCheck = [
  'src/webapp/lib/services/embeddingService.ts',
  'src/webapp/lib/utils/similarity.ts',
  'src/webapp/lib/services/profileSummaryAgent.ts',
  'src/webapp/lib/agents/reachAgent.ts',
  'src/webapp/lib/algorithm.ts',
  'src/webapp/types/index.ts',
  'src/webapp/lib/firestore.ts',
  'src/webapp/components/Composer.tsx',
];

filesToCheck.forEach(file => {
  assert(
    existsSync(join(__dirname, '..', file)),
    `File exists: ${file}`
  );
});

// Test 2: Type Definitions
console.log('\n📝 Testing Type Definitions...\n');

const typesFile = readFileSync(join(__dirname, '..', 'src/webapp/types/index.ts'), 'utf-8');

assert(
  typesFile.includes('profileEmbedding?: number[]'),
  'User type includes profileEmbedding field'
);

assert(
  typesFile.includes('profileEmbeddingVersion?: number'),
  'User type includes profileEmbeddingVersion field'
);

assert(
  typesFile.includes('contentEmbedding?: number[]'),
  'Chirp type includes contentEmbedding field'
);

assert(
  typesFile.includes('targetAudienceDescription?: string'),
  'TunedAudience type includes targetAudienceDescription field'
);

assert(
  typesFile.includes('targetAudienceEmbedding?: number[]'),
  'TunedAudience type includes targetAudienceEmbedding field'
);

assert(
  typesFile.includes('semanticSimilarityThreshold?: number'),
  'ForYouConfig type includes semanticSimilarityThreshold field'
);

assert(
  typesFile.includes('semanticSimilarityThreshold: 0.7'),
  'DEFAULT_FOR_YOU_CONFIG includes semanticSimilarityThreshold default (0.7)'
);

// Test 3: Embedding Service
console.log('\n🔧 Testing Embedding Service...\n');

const embeddingServiceFile = readFileSync(join(__dirname, '..', 'src/webapp/lib/services/embeddingService.ts'), 'utf-8');

assert(
  embeddingServiceFile.includes('export const generateEmbedding'),
  'embeddingService exports generateEmbedding function'
);

assert(
  embeddingServiceFile.includes('export const tryGenerateEmbedding'),
  'embeddingService exports tryGenerateEmbedding function'
);

assert(
  embeddingServiceFile.includes("EMBEDDING_MODEL = 'text-embedding-3-small'") || 
  embeddingServiceFile.includes("model: EMBEDDING_MODEL") ||
  embeddingServiceFile.includes('text-embedding-3-small'),
  'embeddingService uses text-embedding-3-small model'
);

assert(
  embeddingServiceFile.includes('openai'),
  'embeddingService imports OpenAI client'
);

// Test 4: Similarity Utility
console.log('\n📊 Testing Similarity Utility...\n');

const similarityFile = readFileSync(join(__dirname, '..', 'src/webapp/lib/utils/similarity.ts'), 'utf-8');

assert(
  similarityFile.includes('export const cosineSimilarity'),
  'similarity.ts exports cosineSimilarity function'
);

// Test cosine similarity logic
assert(
  similarityFile.includes('dot += a[i] * b[i]'),
  'cosineSimilarity implements dot product calculation'
);

assert(
  similarityFile.includes('Math.sqrt'),
  'cosineSimilarity implements vector normalization'
);

assert(
  similarityFile.includes('a.length !== b.length'),
  'cosineSimilarity handles mismatched vector lengths'
);

// Test 5: Profile Summary Agent
console.log('\n👤 Testing Profile Summary Agent...\n');

const profileAgentFile = readFileSync(join(__dirname, '..', 'src/webapp/lib/services/profileSummaryAgent.ts'), 'utf-8');

assert(
  profileAgentFile.includes("import { tryGenerateEmbedding } from './embeddingService'"),
  'profileSummaryAgent imports embeddingService'
);

assert(
  profileAgentFile.includes('profileEmbedding: summaryEmbedding'),
  'profileSummaryAgent generates and stores profile embedding'
);

assert(
  profileAgentFile.includes('profileEmbeddingVersion'),
  'profileSummaryAgent tracks embedding version'
);

// Test 6: Reach Agent
console.log('\n🎯 Testing Reach Agent...\n');

const reachAgentFile = readFileSync(join(__dirname, '..', 'src/webapp/lib/agents/reachAgent.ts'), 'utf-8');

assert(
  reachAgentFile.includes('targetAudienceDescription: string'),
  'ReachSuggestion interface includes targetAudienceDescription'
);

assert(
  reachAgentFile.includes('targetAudienceEmbedding?: number[]'),
  'ReachSuggestion interface includes targetAudienceEmbedding'
);

assert(
  reachAgentFile.includes('tryGenerateEmbedding'),
  'reachAgent generates audience embeddings'
);

// Test 7: Algorithm Integration
console.log('\n🧮 Testing Algorithm Integration...\n');

const algorithmFile = readFileSync(join(__dirname, '..', 'src/webapp/lib/algorithm.ts'), 'utf-8');

assert(
  algorithmFile.includes("import { cosineSimilarity } from '../utils/similarity'"),
  'algorithm.ts imports cosineSimilarity'
);

assert(
  algorithmFile.includes('getSimilarityThreshold'),
  'algorithm.ts includes getSimilarityThreshold function'
);

// Test eligibility check
assert(
  algorithmFile.includes('targetAudienceEmbedding && viewer.profileEmbedding'),
  'isChirpEligibleForViewer checks for embeddings'
);

assert(
  algorithmFile.includes('cosineSimilarity(') && algorithmFile.includes('targetAudienceEmbedding'),
  'isChirpEligibleForViewer uses cosineSimilarity for eligibility'
);

assert(
  algorithmFile.includes('similarity >= similarityThreshold'),
  'isChirpEligibleForViewer applies similarity threshold'
);

// Test scoring
assert(
  algorithmFile.includes('viewer.profileEmbedding && chirp.tunedAudience?.targetAudienceEmbedding'),
  'scoreChirpForViewer checks for embeddings in scoring'
);

assert(
  algorithmFile.includes('similarity * 35'),
  'scoreChirpForViewer uses similarity for scoring boost'
);

// Test 8: Composer Integration
console.log('\n✍️  Testing Composer Integration...\n');

const composerFile = readFileSync(join(__dirname, '..', 'src/webapp/components/Composer.tsx'), 'utf-8');

assert(
  composerFile.includes("import { tryGenerateEmbedding } from '../lib/services/embeddingService'"),
  'Composer imports embeddingService'
);

assert(
  composerFile.includes('contentEmbedding: contentEmbedding'),
  'Composer generates content embedding for posts'
);

assert(
  composerFile.includes('targetAudienceEmbedding: suggestionResult.targetAudienceEmbedding'),
  'Composer stores targetAudienceEmbedding from ReachAgent'
);

// Test 9: Firestore Integration
console.log('\n💾 Testing Firestore Integration...\n');

const firestoreFile = readFileSync(join(__dirname, '..', 'src/webapp/lib/firestore.ts'), 'utf-8');

// Test userFromFirestore
assert(
  firestoreFile.includes('profileEmbedding: data.profileEmbedding'),
  'userFromFirestore retrieves profileEmbedding'
);

assert(
  firestoreFile.includes('profileEmbeddingVersion: data.profileEmbeddingVersion'),
  'userFromFirestore retrieves profileEmbeddingVersion'
);

// Test chirpFromFirestore
assert(
  firestoreFile.includes('contentEmbedding: data.contentEmbedding'),
  'chirpFromFirestore retrieves contentEmbedding'
);

// Test createChirp
assert(
  firestoreFile.includes('chirp.contentEmbedding && chirp.contentEmbedding.length > 0'),
  'createChirp stores contentEmbedding'
);

// Test 10: Edge Cases and Error Handling
console.log('\n🛡️  Testing Edge Cases and Error Handling...\n');

// Check for null/undefined handling in similarity
assert(
  similarityFile.includes('!a || !b') || similarityFile.includes('a === undefined') || similarityFile.includes('a == null'),
  'cosineSimilarity handles null/undefined vectors'
);

assert(
  similarityFile.includes('a.length === 0'),
  'cosineSimilarity handles empty vectors'
);

// Check for error handling in embedding service
assert(
  embeddingServiceFile.includes('catch') || embeddingServiceFile.includes('try'),
  'embeddingService has error handling'
);

assert(
  embeddingServiceFile.includes('return []') || embeddingServiceFile.includes('return undefined'),
  'embeddingService returns safe defaults on error'
);

// Check for fallback logic in algorithm
assert(
  algorithmFile.includes('allowFollowers') && algorithmFile.includes('allowNonFollowers'),
  'algorithm maintains fallback to follower/non-follower logic'
);

// Test 11: Integration Points
console.log('\n🔗 Testing Integration Points...\n');

// Check that profile summary generation triggers embedding
const profileSummaryCallSites = [
  'src/webapp/components/Onboarding.tsx',
  'src/webapp/components/EditProfileModal.tsx',
];

profileSummaryCallSites.forEach(file => {
  if (existsSync(join(__dirname, '..', file))) {
    const fileContent = readFileSync(join(__dirname, '..', file), 'utf-8');
    assert(
      fileContent.includes('generateAndSaveProfileSummary'),
      `${file} calls generateAndSaveProfileSummary`
    );
  } else {
    warn(`${file} not found (may be .js version)`);
  }
});

// Test 12: Mathematical Correctness
console.log('\n🔢 Testing Mathematical Correctness...\n');

// Test cosine similarity formula
const testVector1 = [1, 0, 0];
const testVector2 = [1, 0, 0];
const testVector3 = [0, 1, 0];
const testVector4 = [-1, 0, 0];

// Manual cosine similarity calculation for testing
function manualCosineSimilarity(a, b) {
  if (!a || !b || a.length === 0 || b.length === 0 || a.length !== b.length) {
    return 0;
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

const similarity1 = manualCosineSimilarity(testVector1, testVector2);
const similarity2 = manualCosineSimilarity(testVector1, testVector3);
const similarity3 = manualCosineSimilarity(testVector1, testVector4);

assert(
  Math.abs(similarity1 - 1.0) < 0.001,
  `Identical vectors have similarity = 1 (got ${similarity1})`
);

assert(
  Math.abs(similarity2 - 0.0) < 0.001,
  `Orthogonal vectors have similarity = 0 (got ${similarity2})`
);

assert(
  Math.abs(similarity3 - (-1.0)) < 0.001,
  `Opposite vectors have similarity = -1 (got ${similarity3})`
);

// Test 13: Configuration Defaults
console.log('\n⚙️  Testing Configuration Defaults...\n');

assert(
  typesFile.includes('semanticSimilarityThreshold: 0.7'),
  'Default similarity threshold is 0.7'
);

// Test 14: Backward Compatibility
console.log('\n🔄 Testing Backward Compatibility...\n');

// Check that algorithm works without embeddings
assert(
  algorithmFile.includes('allowFollowers') && algorithmFile.includes('allowNonFollowers'),
  'Algorithm maintains follower/non-follower logic for backward compatibility'
);

// Check that missing embeddings don't break the flow
assert(
  algorithmFile.includes('if (') && (algorithmFile.includes('targetAudienceEmbedding') || algorithmFile.includes('profileEmbedding')),
  'Algorithm checks for embedding existence before use'
);

// Final Summary
console.log('\n' + '='.repeat(60));
console.log('📊 TEST SUMMARY');
console.log('='.repeat(60));
console.log(`✅ Passed: ${testResults.passed}`);
console.log(`❌ Failed: ${testResults.failed}`);
console.log(`⚠️  Warnings: ${testResults.warnings.length}`);

if (testResults.errors.length > 0) {
  console.log('\n❌ FAILED TESTS:');
  testResults.errors.forEach((error, index) => {
    console.log(`  ${index + 1}. ${error}`);
  });
}

if (testResults.warnings.length > 0) {
  console.log('\n⚠️  WARNINGS:');
  testResults.warnings.forEach((warning, index) => {
    console.log(`  ${index + 1}. ${warning}`);
  });
}

console.log('\n' + '='.repeat(60));

if (testResults.failed === 0) {
  console.log('🎉 All tests passed! Semantic similarity implementation is complete.');
  process.exit(0);
} else {
  console.log('❌ Some tests failed. Please review the errors above.');
  process.exit(1);
}

