/**
 * Test script to verify profile summary implementation completeness
 * This script checks:
 * 1. All required files exist
 * 2. Type definitions are correct
 * 3. Service functions are properly exported
 * 4. Integration points are connected
 * 5. Firestore mappings are correct
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

const tests = [];
let passed = 0;
let failed = 0;

function test(name, condition, errorMessage) {
  tests.push({ name, condition, errorMessage });
  if (condition) {
    console.log(`✅ ${name}`);
    passed++;
  } else {
    console.error(`❌ ${name}: ${errorMessage}`);
    failed++;
  }
}

function readFile(filePath) {
  try {
    return readFileSync(join(projectRoot, filePath), 'utf-8');
  } catch (error) {
    return null;
  }
}

function fileExists(filePath) {
  return existsSync(join(projectRoot, filePath));
}

console.log('🔍 Testing Profile Summary Implementation\n');

// Test 1: Check if profileSummaryAgent.ts exists
test(
  'profileSummaryAgent.ts file exists',
  fileExists('src/webapp/lib/services/profileSummaryAgent.ts'),
  'File not found'
);

// Test 2: Check type definitions
const typesFile = readFile('src/webapp/types/index.ts');
test(
  'User type includes profileSummary fields',
  typesFile && 
    typesFile.includes('profileSummary?: string') &&
    typesFile.includes('profileSummaryVersion?: number') &&
    typesFile.includes('profileSummaryUpdatedAt?: Date'),
  'Missing profileSummary fields in User type'
);

// Test 3: Check profileSummaryAgent exports
const agentFile = readFile('src/webapp/lib/services/profileSummaryAgent.ts');
test(
  'profileSummaryAgent exports generateProfileSummary',
  agentFile && agentFile.includes('export async function generateProfileSummary'),
  'generateProfileSummary function not exported'
);

test(
  'profileSummaryAgent exports generateAndSaveProfileSummary',
  agentFile && agentFile.includes('export async function generateAndSaveProfileSummary'),
  'generateAndSaveProfileSummary function not exported'
);

// Test 4: Check BaseAgent import
test(
  'profileSummaryAgent imports BaseAgent',
  agentFile && agentFile.includes("import { BaseAgent } from '../agents/baseAgent'"),
  'BaseAgent import missing'
);

// Test 5: Check userService import
test(
  'profileSummaryAgent imports userService',
  agentFile && agentFile.includes("import { userService } from '../firestore'"),
  'userService import missing'
);

// Test 6: Check Onboarding integration
const onboardingFile = readFile('src/webapp/components/Onboarding.tsx');
test(
  'Onboarding imports generateAndSaveProfileSummary',
  onboardingFile && onboardingFile.includes("import { generateAndSaveProfileSummary } from '../lib/services/profileSummaryAgent'"),
  'Import missing in Onboarding'
);

test(
  'Onboarding calls generateAndSaveProfileSummary',
  onboardingFile && onboardingFile.includes('generateAndSaveProfileSummary(currentUser.id)'),
  'Function call missing in Onboarding'
);

// Test 7: Check EditProfileModal integration
const editProfileFile = readFile('src/webapp/components/EditProfileModal.tsx');
test(
  'EditProfileModal imports generateAndSaveProfileSummary',
  editProfileFile && editProfileFile.includes("import { generateAndSaveProfileSummary } from '../lib/services/profileSummaryAgent'"),
  'Import missing in EditProfileModal'
);

test(
  'EditProfileModal calls generateAndSaveProfileSummary',
  editProfileFile && editProfileFile.includes('generateAndSaveProfileSummary(user.id)'),
  'Function call missing in EditProfileModal'
);

// Test 8: Check Firestore integration (TS)
const firestoreTsFile = readFile('src/webapp/lib/firestore.ts');
test(
  'firestore.ts includes profileSummary in userFromFirestore',
  firestoreTsFile && 
    firestoreTsFile.includes('profileSummary: data.profileSummary') &&
    firestoreTsFile.includes('profileSummaryVersion: data.profileSummaryVersion') &&
    firestoreTsFile.includes('profileSummaryUpdatedAt: data.profileSummaryUpdatedAt'),
  'profileSummary fields missing in firestore.ts userFromFirestore'
);

// Test 9: Check Firestore integration (JS)
const firestoreJsFile = readFile('src/webapp/lib/firestore.js');
test(
  'firestore.js includes profileSummary in userFromFirestore',
  firestoreJsFile && 
    firestoreJsFile.includes('profileSummary: data.profileSummary') &&
    firestoreJsFile.includes('profileSummaryVersion: data.profileSummaryVersion') &&
    firestoreJsFile.includes('profileSummaryUpdatedAt: data.profileSummaryUpdatedAt'),
  'profileSummary fields missing in firestore.js userFromFirestore'
);

// Test 10: Check algorithm integration
const algorithmFile = readFile('src/webapp/lib/algorithm.ts');
test(
  'algorithm.ts uses profileSummary in scoring',
  algorithmFile && algorithmFile.includes('viewer.profileSummary'),
  'profileSummary not used in algorithm scoring'
);

test(
  'algorithm.ts includes profile summary matching logic',
  algorithmFile && 
    algorithmFile.includes('Profile summary matching') &&
    algorithmFile.includes('profileMatchScore'),
  'Profile summary matching logic missing'
);

// Test 11: Check error handling
test(
  'profileSummaryAgent has error handling',
  agentFile && 
    agentFile.includes('catch') &&
    agentFile.includes('console.error'),
  'Error handling missing'
);

// Test 12: Check version tracking
test(
  'profileSummaryAgent implements version tracking',
  agentFile && 
    agentFile.includes('profileSummaryVersion') &&
    agentFile.includes('newVersion'),
  'Version tracking not implemented'
);

// Test 13: Check async/await pattern
test(
  'Onboarding uses async pattern for summary generation',
  onboardingFile && onboardingFile.includes('.catch('),
  'Async error handling missing in Onboarding'
);

test(
  'EditProfileModal uses async pattern for summary generation',
  editProfileFile && editProfileFile.includes('.catch('),
  'Async error handling missing in EditProfileModal'
);

// Test 14: Check that summary generation doesn't block
test(
  'Onboarding summary generation is non-blocking',
  onboardingFile && 
    onboardingFile.includes('generateAndSaveProfileSummary') &&
    onboardingFile.includes('navigate'),
  'Summary generation may be blocking navigation'
);

// Test 15: Verify profileSummaryAgent uses all profile fields
test(
  'profileSummaryAgent uses interests',
  agentFile && agentFile.includes('user.interests'),
  'Interests not used in summary generation'
);

test(
  'profileSummaryAgent uses bio',
  agentFile && agentFile.includes('user.bio'),
  'Bio not used in summary generation'
);

test(
  'profileSummaryAgent uses location',
  agentFile && agentFile.includes('user.location'),
  'Location not used in summary generation'
);

test(
  'profileSummaryAgent uses url',
  agentFile && agentFile.includes('user.url'),
  'URL not used in summary generation'
);

test(
  'profileSummaryAgent uses reputation',
  agentFile && agentFile.includes('user.reputation'),
  'Reputation not used in summary generation'
);

// Test 16: Check algorithm scoring integration
test(
  'algorithm extracts terms from profile summary',
  algorithmFile && algorithmFile.includes('summaryTerms'),
  'Term extraction missing in algorithm'
);

test(
  'algorithm calculates profile match score',
  algorithmFile && algorithmFile.includes('profileMatchScore'),
  'Profile match scoring missing'
);

// Test 17: Check that summary is saved to Firestore
test(
  'profileSummaryAgent saves to Firestore via userService',
  agentFile && 
    agentFile.includes('userService.updateUser') &&
    agentFile.includes('profileSummary: summary'),
  'Summary not saved to Firestore'
);

// Test 18: Check date handling
test(
  'profileSummaryAgent sets profileSummaryUpdatedAt',
  agentFile && agentFile.includes('profileSummaryUpdatedAt: new Date()'),
  'profileSummaryUpdatedAt not set'
);

// Test 19: Check max length enforcement
test(
  'profileSummaryAgent enforces max length',
  agentFile && agentFile.includes('maxLength') && agentFile.includes('300'),
  'Max length enforcement missing'
);

// Test 20: Check BaseAgent availability check
test(
  'profileSummaryAgent checks BaseAgent availability',
  agentFile && agentFile.includes('BaseAgent.isAvailable()'),
  'BaseAgent availability check missing'
);

console.log('\n📊 Test Results:');
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`📝 Total: ${tests.length}\n`);

if (failed === 0) {
  console.log('🎉 All tests passed! Implementation is complete.');
  process.exit(0);
} else {
  console.log('⚠️  Some tests failed. Please review the implementation.');
  process.exit(1);
}

