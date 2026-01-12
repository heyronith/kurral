"use strict";
/**
 * Test script for the new Value Pipeline v2
 *
 * Usage:
 *   cd functions
 *   npx ts-node scripts/test-new-pipeline.ts
 *
 * Make sure OPENAI_API_KEY is set in your environment.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv = __importStar(require("dotenv"));
const path = __importStar(require("path"));
// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });
// Verify API key is present
if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY not found in environment');
    console.log('Please set OPENAI_API_KEY in functions/.env or functions/.env.local');
    process.exit(1);
}
console.log('✅ OPENAI_API_KEY found (length:', process.env.OPENAI_API_KEY.length, ')');
const precheck_1 = require("../src/services/pipeline/steps/precheck");
const extractClaims_1 = require("../src/services/pipeline/steps/extractClaims");
const verifyClaims_1 = require("../src/services/pipeline/steps/verifyClaims");
const scoreValue_1 = require("../src/services/pipeline/steps/scoreValue");
// Test chirp
const testChirp = {
    id: 'test-chirp-001',
    authorId: 'test-user-001',
    text: 'Covid is a scam',
    topic: 'health',
    reachMode: 'forAll',
    createdAt: new Date(),
    commentCount: 0,
};
async function runTest() {
    console.log('\n' + '='.repeat(60));
    console.log('🧪 TESTING NEW VALUE PIPELINE v2');
    console.log('='.repeat(60));
    console.log('\n📝 Test Input:');
    console.log(`   Text: "${testChirp.text}"`);
    console.log(`   Topic: ${testChirp.topic}`);
    console.log(`   ID: ${testChirp.id}`);
    const startTime = Date.now();
    try {
        // Step 1: Pre-check
        console.log('\n' + '-'.repeat(40));
        console.log('📋 STEP 1: Pre-check (Agentic)');
        console.log('-'.repeat(40));
        const preCheckStart = Date.now();
        const preCheckResult = await (0, precheck_1.runPreCheck)(testChirp.text, testChirp.imageUrl);
        const preCheckDuration = Date.now() - preCheckStart;
        console.log(`   Needs Fact-Check: ${preCheckResult.needsFactCheck ? '✅ YES' : '❌ NO'}`);
        console.log(`   Confidence: ${(preCheckResult.confidence * 100).toFixed(1)}%`);
        console.log(`   Content Type: ${preCheckResult.contentType}`);
        console.log(`   Reasoning: ${preCheckResult.reasoning}`);
        console.log(`   ⏱️  Duration: ${preCheckDuration}ms`);
        if (!preCheckResult.needsFactCheck) {
            console.log('\n⚠️  Pre-check says no fact-check needed. Continuing anyway for testing...');
        }
        // Step 2: Extract Claims
        console.log('\n' + '-'.repeat(40));
        console.log('🔍 STEP 2: Extract Claims');
        console.log('-'.repeat(40));
        const extractStart = Date.now();
        const extractResult = await (0, extractClaims_1.extractClaimsFromChirp)(testChirp);
        const extractDuration = Date.now() - extractStart;
        console.log(`   Claims Found: ${extractResult.claims.length}`);
        extractResult.claims.forEach((claim, i) => {
            console.log(`\n   Claim ${i + 1}:`);
            console.log(`     Text: "${claim.text}"`);
            console.log(`     Type: ${claim.type}`);
            console.log(`     Domain: ${claim.domain}`);
            console.log(`     Risk Level: ${claim.riskLevel}`);
            console.log(`     Confidence: ${(claim.confidence * 100).toFixed(1)}%`);
        });
        console.log(`   ⏱️  Duration: ${extractDuration}ms`);
        if (extractResult.claims.length === 0) {
            console.log('\n⚠️  No claims extracted. Cannot proceed with fact-checking.');
            return;
        }
        // Step 3: Verify Claims (Fact-check)
        console.log('\n' + '-'.repeat(40));
        console.log('✅ STEP 3: Verify Claims (Fact-check with Web Search)');
        console.log('-'.repeat(40));
        const verifyStart = Date.now();
        const verifyResults = await (0, verifyClaims_1.verifyClaimsForChirp)(testChirp, extractResult.claims);
        const verifyDuration = Date.now() - verifyStart;
        const factChecks = verifyResults.map(r => r.factCheck);
        const factCheckStatus = (0, verifyClaims_1.determineFactCheckStatus)(factChecks);
        console.log(`   Fact-checks Completed: ${factChecks.length}`);
        console.log(`   Overall Status: ${factCheckStatus.toUpperCase()}`);
        factChecks.forEach((fc, i) => {
            console.log(`\n   Fact-check ${i + 1}:`);
            console.log(`     Claim ID: ${fc.claimId}`);
            console.log(`     Verdict: ${fc.verdict.toUpperCase()}`);
            console.log(`     Confidence: ${(fc.confidence * 100).toFixed(1)}%`);
            console.log(`     Evidence Sources: ${fc.evidence.length}`);
            fc.evidence.slice(0, 3).forEach((ev, j) => {
                console.log(`       ${j + 1}. ${ev.source} (quality: ${(ev.quality * 100).toFixed(0)}%)`);
                if (ev.url)
                    console.log(`          URL: ${ev.url}`);
                console.log(`          Snippet: "${ev.snippet.substring(0, 100)}..."`);
            });
            if (fc.caveats && fc.caveats.length > 0) {
                console.log(`     Caveats: ${fc.caveats.join('; ')}`);
            }
        });
        console.log(`   ⏱️  Duration: ${verifyDuration}ms`);
        // Step 4: Score Value
        console.log('\n' + '-'.repeat(40));
        console.log('📊 STEP 4: Score Value');
        console.log('-'.repeat(40));
        const scoreStart = Date.now();
        const scoreResult = await (0, scoreValue_1.scoreChirp)(testChirp, extractResult.claims, factChecks);
        const scoreDuration = Date.now() - scoreStart;
        if (scoreResult) {
            const vs = scoreResult.valueScore;
            console.log(`   Total Score: ${(vs.total * 100).toFixed(1)}%`);
            console.log(`   Epistemic:   ${(vs.epistemic * 100).toFixed(1)}%`);
            console.log(`   Insight:     ${(vs.insight * 100).toFixed(1)}%`);
            console.log(`   Practical:   ${(vs.practical * 100).toFixed(1)}%`);
            console.log(`   Relational:  ${(vs.relational * 100).toFixed(1)}%`);
            console.log(`   Effort:      ${(vs.effort * 100).toFixed(1)}%`);
            console.log(`   Confidence:  ${(vs.confidence * 100).toFixed(1)}%`);
            if (vs.drivers && vs.drivers.length > 0) {
                console.log(`   Drivers: ${vs.drivers.join(', ')}`);
            }
            if (scoreResult.penaltiesApplied.length > 0) {
                console.log(`   Penalties Applied: ${scoreResult.penaltiesApplied.join(', ')}`);
            }
        }
        else {
            console.log('   ⚠️  Value scoring returned null');
        }
        console.log(`   ⏱️  Duration: ${scoreDuration}ms`);
        // Summary
        const totalDuration = Date.now() - startTime;
        console.log('\n' + '='.repeat(60));
        console.log('📈 PIPELINE SUMMARY');
        console.log('='.repeat(60));
        console.log(`   Input: "${testChirp.text}"`);
        console.log(`   Claims Found: ${extractResult.claims.length}`);
        console.log(`   Fact-Check Status: ${factCheckStatus.toUpperCase()}`);
        console.log(`   Verdicts: ${factChecks.map(fc => fc.verdict).join(', ')}`);
        if (scoreResult) {
            console.log(`   Value Score: ${(scoreResult.valueScore.total * 100).toFixed(1)}%`);
        }
        console.log(`   Total Duration: ${totalDuration}ms`);
        console.log('='.repeat(60));
    }
    catch (error) {
        console.error('\n❌ Test failed with error:');
        console.error(`   ${error.message}`);
        console.error('\nStack trace:');
        console.error(error.stack);
    }
}
// Run the test
runTest().then(() => {
    console.log('\n✅ Test completed');
    process.exit(0);
}).catch((error) => {
    console.error('\n❌ Test crashed:', error);
    process.exit(1);
});
//# sourceMappingURL=test-new-pipeline.js.map