"use strict";
/**
 * Comprehensive Agent Health Check
 *
 * Tests all 6 Content Quality & Fact-Checking agents to verify:
 * 1. BaseAgent is available and configured
 * 2. Each agent can generate responses
 * 3. Agents handle errors gracefully
 * 4. Fallback mechanisms work when AI unavailable
 */
Object.defineProperty(exports, "__esModule", { value: true });
const baseAgent_1 = require("../src/agents/baseAgent");
const factCheckPreCheckAgent_1 = require("../src/services/factCheckPreCheckAgent");
const claimExtractionAgent_1 = require("../src/services/claimExtractionAgent");
const factCheckAgent_1 = require("../src/services/factCheckAgent");
const discussionQualityAgent_1 = require("../src/services/discussionQualityAgent");
const valueScoringAgent_1 = require("../src/services/valueScoringAgent");
const explainerAgent_1 = require("../src/services/explainerAgent");
// Test data
const TEST_CHIRP = {
    id: `test-${Date.now()}`,
    authorId: 'test-user',
    text: 'According to recent studies, the COVID-19 vaccine reduces transmission rates by 85%. This is based on data from the CDC and WHO.',
    topic: 'health',
    reachMode: 'forAll',
    createdAt: new Date(),
    commentCount: 0,
};
const TEST_COMMENT = {
    id: `test-comment-${Date.now()}`,
    chirpId: TEST_CHIRP.id,
    authorId: 'test-user-2',
    text: 'I agree with this assessment. The data is compelling.',
    createdAt: new Date(),
};
const results = [];
async function testAgent(name, testFn) {
    const startTime = Date.now();
    try {
        const result = await testFn();
        const duration = Date.now() - startTime;
        return {
            agent: name,
            status: 'PASS',
            message: 'Agent responded successfully',
            duration,
            details: result,
        };
    }
    catch (error) {
        const duration = Date.now() - startTime;
        return {
            agent: name,
            status: 'FAIL',
            message: error.message || 'Unknown error',
            duration,
            details: { error: error.toString() },
        };
    }
}
async function testBaseAgent() {
    return testAgent('BaseAgent', async () => {
        const isAvailable = baseAgent_1.BaseAgent.isAvailable();
        if (!isAvailable) {
            throw new Error('BaseAgent.isAvailable() returned false - OPENAI_API_KEY not configured');
        }
        const agent = new baseAgent_1.BaseAgent();
        const response = await agent.generate('Say "test" if you can read this.', 'You are a test agent. Respond with only the word "test".');
        if (!response || !response.toLowerCase().includes('test')) {
            throw new Error(`Unexpected response: ${response}`);
        }
        return { isAvailable, testResponse: response };
    });
}
async function testPreCheckAgent() {
    return testAgent('Fact Check Pre-Check Agent', async () => {
        const result = await (0, factCheckPreCheckAgent_1.preCheckText)('According to the CDC, vaccination reduces COVID-19 transmission by 85%.');
        if (!result || typeof result.needsFactCheck !== 'boolean') {
            throw new Error('Invalid result structure');
        }
        // Test with chirp
        const chirpResult = await (0, factCheckPreCheckAgent_1.preCheckChirp)(TEST_CHIRP);
        if (!chirpResult || typeof chirpResult.needsFactCheck !== 'boolean') {
            throw new Error('Invalid chirp result structure');
        }
        return {
            textResult: result,
            chirpResult,
        };
    });
}
async function testClaimExtractionAgent() {
    return testAgent('Claim Extraction Agent', async () => {
        const claims = await (0, claimExtractionAgent_1.extractClaimsForChirp)(TEST_CHIRP);
        if (!Array.isArray(claims)) {
            throw new Error('Claims should be an array');
        }
        // Even if no claims extracted, should return empty array (not throw)
        if (claims.length > 0) {
            const firstClaim = claims[0];
            if (!firstClaim.id || !firstClaim.text || !firstClaim.type) {
                throw new Error('Invalid claim structure');
            }
        }
        return {
            claimCount: claims.length,
            sampleClaim: claims[0] || null,
        };
    });
}
async function testFactCheckAgent() {
    return testAgent('Fact Check Agent', async () => {
        // First extract claims
        const claims = await (0, claimExtractionAgent_1.extractClaimsForChirp)(TEST_CHIRP);
        if (claims.length === 0) {
            // If no claims, create a test claim
            const testClaim = {
                id: `${TEST_CHIRP.id}-test-claim`,
                text: 'COVID-19 vaccine reduces transmission by 85%',
                type: 'fact',
                domain: 'health',
                riskLevel: 'high',
                confidence: 0.8,
                extractedAt: new Date(),
            };
            claims.push(testClaim);
        }
        const factChecks = await (0, factCheckAgent_1.factCheckClaims)(TEST_CHIRP, claims);
        if (!Array.isArray(factChecks)) {
            throw new Error('Fact checks should be an array');
        }
        if (factChecks.length > 0) {
            const firstCheck = factChecks[0];
            if (!firstCheck.id || !firstCheck.claimId || !firstCheck.verdict) {
                throw new Error('Invalid fact check structure');
            }
        }
        return {
            factCheckCount: factChecks.length,
            sampleFactCheck: factChecks[0] || null,
        };
    });
}
async function testDiscussionQualityAgent() {
    return testAgent('Discussion Quality Agent', async () => {
        const comments = [TEST_COMMENT];
        const analysis = await (0, discussionQualityAgent_1.analyzeDiscussion)(TEST_CHIRP, comments);
        if (!analysis || !analysis.threadQuality) {
            throw new Error('Invalid analysis structure');
        }
        const { threadQuality } = analysis;
        if (typeof threadQuality.informativeness !== 'number' ||
            typeof threadQuality.civility !== 'number' ||
            typeof threadQuality.reasoningDepth !== 'number' ||
            typeof threadQuality.crossPerspective !== 'number') {
            throw new Error('Invalid thread quality scores');
        }
        return {
            threadQuality,
            commentInsightsCount: Object.keys(analysis.commentInsights || {}).length,
        };
    });
}
async function testValueScoringAgent() {
    return testAgent('Value Scoring Agent', async () => {
        // First get claims and fact checks
        const claims = await (0, claimExtractionAgent_1.extractClaimsForChirp)(TEST_CHIRP);
        const factChecks = claims.length > 0
            ? await (0, factCheckAgent_1.factCheckClaims)(TEST_CHIRP, claims)
            : [];
        // Get discussion analysis
        const discussion = await (0, discussionQualityAgent_1.analyzeDiscussion)(TEST_CHIRP, [TEST_COMMENT]);
        const valueScore = await (0, valueScoringAgent_1.scoreChirpValue)(TEST_CHIRP, claims, factChecks, discussion);
        if (!valueScore) {
            // This is acceptable if BaseAgent is unavailable or if response was invalid
            if (!baseAgent_1.BaseAgent.isAvailable()) {
                return {
                    skipped: true,
                    reason: 'BaseAgent unavailable',
                };
            }
            // Check if it's an AI response issue
            throw new Error('Value score returned null - AI response may be invalid or agent error occurred');
        }
        if (typeof valueScore.epistemic !== 'number' ||
            typeof valueScore.insight !== 'number' ||
            typeof valueScore.practical !== 'number' ||
            typeof valueScore.relational !== 'number' ||
            typeof valueScore.effort !== 'number' ||
            typeof valueScore.total !== 'number') {
            throw new Error('Invalid value score structure');
        }
        return {
            valueScore: {
                epistemic: valueScore.epistemic,
                insight: valueScore.insight,
                practical: valueScore.practical,
                relational: valueScore.relational,
                effort: valueScore.effort,
                total: valueScore.total,
                confidence: valueScore.confidence,
            },
        };
    });
}
async function testExplainerAgent() {
    return testAgent('Explainer Agent', async () => {
        // First get all prerequisites
        const claims = await (0, claimExtractionAgent_1.extractClaimsForChirp)(TEST_CHIRP);
        const factChecks = claims.length > 0
            ? await (0, factCheckAgent_1.factCheckClaims)(TEST_CHIRP, claims)
            : [];
        const discussion = await (0, discussionQualityAgent_1.analyzeDiscussion)(TEST_CHIRP, [TEST_COMMENT]);
        const valueScore = await (0, valueScoringAgent_1.scoreChirpValue)(TEST_CHIRP, claims, factChecks, discussion);
        if (!valueScore) {
            // Create a minimal value score for testing
            const testValueScore = {
                epistemic: 0.7,
                insight: 0.6,
                practical: 0.5,
                relational: 0.6,
                effort: 0.5,
                total: 0.58,
                confidence: 0.8,
                updatedAt: new Date(),
            };
            const explanation = await (0, explainerAgent_1.generateValueExplanation)(TEST_CHIRP, testValueScore, claims, factChecks, discussion === null || discussion === void 0 ? void 0 : discussion.threadQuality);
            if (!explanation || typeof explanation !== 'string') {
                throw new Error('Explanation should be a non-empty string');
            }
            return { explanation, usedTestValueScore: true };
        }
        const explanation = await (0, explainerAgent_1.generateValueExplanation)(TEST_CHIRP, valueScore, claims, factChecks, discussion === null || discussion === void 0 ? void 0 : discussion.threadQuality);
        if (!explanation || typeof explanation !== 'string') {
            throw new Error('Explanation should be a non-empty string');
        }
        return { explanation };
    });
}
async function runAllTests() {
    var _a, _b, _c;
    console.log('🧪 Testing All Content Quality & Fact-Checking Agents\n');
    console.log('='.repeat(70));
    console.log('');
    // Test 1: BaseAgent
    console.log('1️⃣  Testing BaseAgent...');
    const baseAgentResult = await testBaseAgent();
    results.push(baseAgentResult);
    console.log(`   ${baseAgentResult.status === 'PASS' ? '✅' : '❌'} ${baseAgentResult.agent}: ${baseAgentResult.message} (${baseAgentResult.duration}ms)`);
    if (baseAgentResult.status === 'FAIL') {
        console.log(`   Error: ${baseAgentResult.message}`);
    }
    console.log('');
    // If BaseAgent fails, we can still test fallbacks
    // (canTestAI variable removed - not needed)
    // Test 2: Pre-Check Agent
    console.log('2️⃣  Testing Fact Check Pre-Check Agent...');
    const preCheckResult = await testPreCheckAgent();
    results.push(preCheckResult);
    console.log(`   ${preCheckResult.status === 'PASS' ? '✅' : '❌'} ${preCheckResult.agent}: ${preCheckResult.message} (${preCheckResult.duration}ms)`);
    if (preCheckResult.details) {
        console.log(`   Needs Fact-Check: ${(_a = preCheckResult.details.textResult) === null || _a === void 0 ? void 0 : _a.needsFactCheck}`);
        console.log(`   Confidence: ${(_c = (_b = preCheckResult.details.textResult) === null || _b === void 0 ? void 0 : _b.confidence) === null || _c === void 0 ? void 0 : _c.toFixed(2)}`);
    }
    console.log('');
    // Test 3: Claim Extraction Agent
    console.log('3️⃣  Testing Claim Extraction Agent...');
    const claimExtractionResult = await testClaimExtractionAgent();
    results.push(claimExtractionResult);
    console.log(`   ${claimExtractionResult.status === 'PASS' ? '✅' : '❌'} ${claimExtractionResult.agent}: ${claimExtractionResult.message} (${claimExtractionResult.duration}ms)`);
    if (claimExtractionResult.details) {
        console.log(`   Claims Extracted: ${claimExtractionResult.details.claimCount}`);
        if (claimExtractionResult.details.sampleClaim) {
            console.log(`   Sample Claim: "${claimExtractionResult.details.sampleClaim.text.substring(0, 60)}..."`);
        }
    }
    console.log('');
    // Test 4: Fact Check Agent
    console.log('4️⃣  Testing Fact Check Agent...');
    const factCheckResult = await testFactCheckAgent();
    results.push(factCheckResult);
    console.log(`   ${factCheckResult.status === 'PASS' ? '✅' : '❌'} ${factCheckResult.agent}: ${factCheckResult.message} (${factCheckResult.duration}ms)`);
    if (factCheckResult.details) {
        console.log(`   Fact Checks Generated: ${factCheckResult.details.factCheckCount}`);
        if (factCheckResult.details.sampleFactCheck) {
            console.log(`   Sample Verdict: ${factCheckResult.details.sampleFactCheck.verdict} (confidence: ${factCheckResult.details.sampleFactCheck.confidence.toFixed(2)})`);
        }
    }
    console.log('');
    // Test 5: Discussion Quality Agent
    console.log('5️⃣  Testing Discussion Quality Agent...');
    const discussionResult = await testDiscussionQualityAgent();
    results.push(discussionResult);
    console.log(`   ${discussionResult.status === 'PASS' ? '✅' : '❌'} ${discussionResult.agent}: ${discussionResult.message} (${discussionResult.duration}ms)`);
    if (discussionResult.details) {
        const tq = discussionResult.details.threadQuality;
        console.log(`   Informativeness: ${tq.informativeness.toFixed(2)}`);
        console.log(`   Civility: ${tq.civility.toFixed(2)}`);
        console.log(`   Reasoning Depth: ${tq.reasoningDepth.toFixed(2)}`);
        console.log(`   Cross Perspective: ${tq.crossPerspective.toFixed(2)}`);
    }
    console.log('');
    // Test 6: Value Scoring Agent
    console.log('6️⃣  Testing Value Scoring Agent...');
    const valueScoringResult = await testValueScoringAgent();
    results.push(valueScoringResult);
    console.log(`   ${valueScoringResult.status === 'PASS' ? '✅' : '❌'} ${valueScoringResult.agent}: ${valueScoringResult.message} (${valueScoringResult.duration}ms)`);
    if (valueScoringResult.details) {
        if (valueScoringResult.details.skipped) {
            console.log(`   ⚠️  Skipped: ${valueScoringResult.details.reason}`);
        }
        else if (valueScoringResult.details.valueScore) {
            const vs = valueScoringResult.details.valueScore;
            console.log(`   Total Score: ${vs.total.toFixed(2)}`);
            console.log(`   Epistemic: ${vs.epistemic.toFixed(2)}, Insight: ${vs.insight.toFixed(2)}, Practical: ${vs.practical.toFixed(2)}`);
            console.log(`   Relational: ${vs.relational.toFixed(2)}, Effort: ${vs.effort.toFixed(2)}`);
            console.log(`   Confidence: ${vs.confidence.toFixed(2)}`);
        }
    }
    console.log('');
    // Test 7: Explainer Agent
    console.log('7️⃣  Testing Explainer Agent...');
    const explainerResult = await testExplainerAgent();
    results.push(explainerResult);
    console.log(`   ${explainerResult.status === 'PASS' ? '✅' : '❌'} ${explainerResult.agent}: ${explainerResult.message} (${explainerResult.duration}ms)`);
    if (explainerResult.details) {
        if (explainerResult.details.explanation) {
            console.log(`   Explanation: "${explainerResult.details.explanation.substring(0, 100)}..."`);
        }
        else {
            console.log(`   ⚠️  No explanation generated`);
        }
    }
    console.log('');
    // Summary
    console.log('='.repeat(70));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(70));
    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    const skipped = results.filter(r => r.status === 'SKIP').length;
    console.log(`Total Tests: ${results.length}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    if (skipped > 0) {
        console.log(`⏭️  Skipped: ${skipped}`);
    }
    console.log('');
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
    console.log(`Total Duration: ${totalDuration}ms`);
    console.log(`Average Duration: ${Math.round(totalDuration / results.length)}ms`);
    console.log('');
    if (failed > 0) {
        console.log('❌ FAILED TESTS:');
        results
            .filter(r => r.status === 'FAIL')
            .forEach(r => {
            console.log(`   - ${r.agent}: ${r.message}`);
        });
        console.log('');
    }
    // BaseAgent status
    console.log('🔑 BaseAgent Status:');
    console.log(`   Available: ${baseAgent_1.BaseAgent.isAvailable() ? '✅ Yes' : '❌ No'}`);
    if (!baseAgent_1.BaseAgent.isAvailable()) {
        console.log('   ⚠️  OPENAI_API_KEY not configured - agents will use fallback heuristics');
    }
    console.log('');
    // Exit code
    if (failed > 0) {
        process.exit(1);
    }
    else {
        console.log('🎉 All agent tests passed!');
        process.exit(0);
    }
}
// Run tests
runAllTests().catch((error) => {
    console.error('❌ Fatal error running tests:', error);
    process.exit(1);
});
//# sourceMappingURL=test-all-agents.js.map