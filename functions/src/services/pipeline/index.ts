/**
 * Value Pipeline v2 - Main Orchestrator
 * 
 * Simple, linear, 4-step pipeline:
 * 1. Pre-check (agentic) - decide if fact-checking is needed
 * 2. Extract claims - pull factual claims from content
 * 3. Verify claims - fact-check each claim with web search + LLM
 * 4. Score value - rate content on 5 value dimensions
 * 
 * Key principles:
 * - Fail fast, fail loud (no silent errors)
 * - Atomic write at end (all or nothing)
 * - Side effects are separate (reputation, Kurral score)
 * - Simple state: pending → processing → completed/failed
 */

import { logger } from 'firebase-functions';
import { chirpService, commentService } from '../firestoreService';
import { isAuthenticationError } from '../../agents/baseAgent';
import { runPreCheck } from './steps/precheck';
import { extractClaimsFromChirp, extractClaimsFromComment } from './steps/extractClaims';
import { verifyClaimsForChirp, determineFactCheckStatus } from './steps/verifyClaims';
import { scoreChirp } from './steps/scoreValue';
import { queueSideEffects } from './sideEffects';
import { generateEngagementPrediction } from '../predictionService';
import type { Chirp } from '../../types';
import type { PipelineResult, PipelineOptions, ChirpPipelineInput, CommentPipelineInput } from './types';

// Default options
const DEFAULT_OPTIONS: Required<PipelineOptions> = {
  maxRetries: 2,
  timeoutMs: 120000, // 2 minutes
  skipValueScoring: false,
};

/**
 * Process a chirp through the value pipeline
 * 
 * This is the main entry point for chirp processing.
 * Returns a complete result - either success with all data, or failure with error info.
 */
export async function processChirp(
  input: ChirpPipelineInput,
  options?: PipelineOptions
): Promise<PipelineResult> {
  const startTime = Date.now();
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const { chirp, skipPreCheck } = input;
  const stepsCompleted: string[] = [];

  console.log('\n' + '='.repeat(80));
  console.log('🚀 [PIPELINE] Starting chirp processing');
  console.log('='.repeat(80));
  console.log(`📝 Chirp ID: ${chirp.id}`);
  console.log(`👤 Author ID: ${chirp.authorId}`);
  console.log(`📄 Text: "${chirp.text?.substring(0, 100)}${chirp.text && chirp.text.length > 100 ? '...' : ''}"`);
  console.log(`📏 Text Length: ${chirp.text?.length || 0} chars`);
  console.log(`🖼️  Has Image: ${!!chirp.imageUrl}`);
  console.log(`🏷️  Topic: ${chirp.topic}`);
  
  logger.info('[Pipeline] Starting chirp processing', {
    chirpId: chirp.id,
    authorId: chirp.authorId,
    textLength: chirp.text?.length || 0,
    hasImage: !!chirp.imageUrl,
  });

  try {
    // ========================================================================
    // STEP 1: Pre-check
    // ========================================================================
    console.log('\n' + '-'.repeat(80));
    console.log('📋 STEP 1: Pre-check (Agentic)');
    console.log('-'.repeat(80));
    
    let needsFactCheck = true;
    let preCheck;

    if (!skipPreCheck) {
      const preCheckStart = Date.now();
      preCheck = await runPreCheck(chirp.text, chirp.imageUrl);
      const preCheckDuration = Date.now() - preCheckStart;
      needsFactCheck = preCheck.needsFactCheck;
      stepsCompleted.push('precheck');

      console.log(`✅ Pre-check complete (${preCheckDuration}ms)`);
      console.log(`   Needs Fact-Check: ${needsFactCheck ? '✅ YES' : '❌ NO'}`);
      console.log(`   Content Type: ${preCheck.contentType}`);
      console.log(`   Confidence: ${(preCheck.confidence * 100).toFixed(1)}%`);
      console.log(`   Reasoning: ${preCheck.reasoning}`);

      logger.info('[Pipeline] Pre-check complete', {
        chirpId: chirp.id,
        needsFactCheck,
        contentType: preCheck.contentType,
      });
    } else {
      console.log('⏭️  Pre-check skipped (skipPreCheck=true)');
      stepsCompleted.push('precheck_skipped');
    }

    // If no fact-check needed, return early with clean status
    if (!needsFactCheck) {
      console.log('\n⏹️  No fact-check needed - returning early with clean status');
      
      const result: PipelineResult = {
        success: true,
        status: 'completed',
        preCheck,
        claims: [],
        factChecks: [],
        factCheckStatus: 'clean',
        processedAt: new Date(),
        durationMs: Date.now() - startTime,
        stepsCompleted,
      };

      console.log('💾 Saving result to Firestore...');
      // Atomic save
      await saveChirpResult(chirp.id, result);
      console.log('✅ Result saved');
      
      // Queue side effects (async, non-blocking)
      queueSideEffects(chirp, result).catch((err) => {
        logger.error('[Pipeline] Failed to queue side effects', { error: err.message });
      });

      console.log(`\n✅ Pipeline completed in ${result.durationMs}ms - Status: CLEAN`);
      console.log('='.repeat(80) + '\n');
      
      return result;
    }

    // ========================================================================
    // STEP 2: Extract claims
    // ========================================================================
    console.log('\n' + '-'.repeat(80));
    console.log('🔍 STEP 2: Extract Claims');
    console.log('-'.repeat(80));
    
    const extractStart = Date.now();
    const { claims } = await extractClaimsFromChirp(chirp);
    const extractDuration = Date.now() - extractStart;
    stepsCompleted.push('extract_claims');

    console.log(`✅ Claims extracted (${extractDuration}ms)`);
    console.log(`   Claims Found: ${claims.length}`);
    
    claims.forEach((claim, i) => {
      console.log(`\n   Claim ${i + 1}:`);
      console.log(`     Text: "${claim.text}"`);
      console.log(`     Type: ${claim.type}`);
      console.log(`     Domain: ${claim.domain}`);
      console.log(`     Risk Level: ${claim.riskLevel}`);
      console.log(`     Confidence: ${(claim.confidence * 100).toFixed(1)}%`);
    });

    logger.info('[Pipeline] Claims extracted', {
      chirpId: chirp.id,
      claimCount: claims.length,
    });

    // If no claims found, return clean status
    if (claims.length === 0) {
      console.log('\n⏹️  No claims found - returning early with clean status');
      
      const result: PipelineResult = {
        success: true,
        status: 'completed',
        preCheck,
        claims: [],
        factChecks: [],
        factCheckStatus: 'clean',
        processedAt: new Date(),
        durationMs: Date.now() - startTime,
        stepsCompleted,
      };

      console.log('💾 Saving result to Firestore...');
      await saveChirpResult(chirp.id, result, undefined);
      console.log('✅ Result saved');
      
      queueSideEffects(chirp, result).catch((err) => {
        logger.error('[Pipeline] Failed to queue side effects', { error: err.message });
      });

      console.log(`\n✅ Pipeline completed in ${result.durationMs}ms - Status: CLEAN`);
      console.log('='.repeat(80) + '\n');
      
      return result;
    }

    // ========================================================================
    // STEP 3: Verify claims (fact-check)
    // ========================================================================
    console.log('\n' + '-'.repeat(80));
    console.log('✅ STEP 3: Verify Claims (Fact-check with Web Search)');
    console.log('-'.repeat(80));
    
    const verifyStart = Date.now();
    const factCheckResults = await verifyClaimsForChirp(chirp, claims);
    const verifyDuration = Date.now() - verifyStart;
    const factChecks = factCheckResults.map((r) => r.factCheck);
    const factCheckStatus = determineFactCheckStatus(factChecks);
    stepsCompleted.push('verify_claims');

    console.log(`✅ Claims verified (${verifyDuration}ms)`);
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
        if (ev.url) console.log(`          URL: ${ev.url}`);
        console.log(`          Snippet: "${ev.snippet.substring(0, 80)}..."`);
      });
      if (fc.caveats && fc.caveats.length > 0) {
        console.log(`     Caveats: ${fc.caveats.join('; ')}`);
      }
    });

    logger.info('[Pipeline] Claims verified', {
      chirpId: chirp.id,
      factCheckCount: factChecks.length,
      factCheckStatus,
      verdicts: factChecks.map((fc) => fc.verdict),
    });

    // ========================================================================
    // STEP 4: Score value
    // ========================================================================
    console.log('\n' + '-'.repeat(80));
    console.log('📊 STEP 4: Score Value');
    console.log('-'.repeat(80));
    
    let valueScore;

    if (!opts.skipValueScoring) {
      const scoreStart = Date.now();
      const scoreResult = await scoreChirp(chirp, claims, factChecks);
      const scoreDuration = Date.now() - scoreStart;
      valueScore = scoreResult?.valueScore;
      stepsCompleted.push('score_value');

      if (scoreResult && valueScore) {
        console.log(`✅ Value scored (${scoreDuration}ms)`);
        console.log(`   Total Score: ${(valueScore.total * 100).toFixed(1)}%`);
        console.log(`   Epistemic:   ${(valueScore.epistemic * 100).toFixed(1)}%`);
        console.log(`   Insight:     ${(valueScore.insight * 100).toFixed(1)}%`);
        console.log(`   Practical:   ${(valueScore.practical * 100).toFixed(1)}%`);
        console.log(`   Relational:  ${(valueScore.relational * 100).toFixed(1)}%`);
        console.log(`   Effort:      ${(valueScore.effort * 100).toFixed(1)}%`);
        console.log(`   Confidence:  ${(valueScore.confidence * 100).toFixed(1)}%`);
        if (scoreResult.penaltiesApplied.length > 0) {
          console.log(`   Penalties:   ${scoreResult.penaltiesApplied.join(', ')}`);
        }
        if (valueScore.drivers && valueScore.drivers.length > 0) {
          console.log(`   Drivers:     ${valueScore.drivers.join(', ')}`);
        }
      } else {
        console.log('⚠️  Value scoring returned null');
      }

      logger.info('[Pipeline] Value scored', {
        chirpId: chirp.id,
        total: valueScore?.total,
      });
    } else {
      console.log('⏭️  Value scoring skipped (skipValueScoring=true)');
      stepsCompleted.push('score_value_skipped');
    }

    // ========================================================================
    // SUCCESS: Build final result
    // ========================================================================
    const result: PipelineResult = {
      success: true,
      status: 'completed',
      preCheck,
      claims,
      factChecks,
      factCheckStatus,
      valueScore,
      processedAt: new Date(),
      durationMs: Date.now() - startTime,
      stepsCompleted,
    };

    // Generate engagement predictions if value score exists
    let predictedEngagement;
    if (valueScore) {
      predictedEngagement = generateEngagementPrediction(valueScore, claims, factChecks);
      console.log(`📈 Engagement predictions generated:`);
      console.log(`   Expected Views (7d): ${predictedEngagement.expectedViews7d}`);
      console.log(`   Expected Bookmarks (7d): ${predictedEngagement.expectedBookmarks7d}`);
      console.log(`   Expected Rechirps (7d): ${predictedEngagement.expectedRechirps7d}`);
      console.log(`   Expected Comments (7d): ${predictedEngagement.expectedComments7d}`);
    }

    // Atomic save - single write with all data
    console.log('\n💾 Saving result to Firestore...');
    await saveChirpResult(chirp.id, result, predictedEngagement);
    console.log('✅ Result saved');

    // Queue side effects (async, non-blocking)
    console.log('🔄 Queueing side effects (reputation, Kurral score)...');
    queueSideEffects(chirp, result).catch((err) => {
      logger.error('[Pipeline] Failed to queue side effects', { error: err.message });
    });

    // Final summary
    console.log('\n' + '='.repeat(80));
    console.log('📈 PIPELINE SUMMARY');
    console.log('='.repeat(80));
    console.log(`   Chirp ID: ${chirp.id}`);
    console.log(`   Claims Found: ${claims.length}`);
    console.log(`   Fact-Check Status: ${factCheckStatus.toUpperCase()}`);
    console.log(`   Verdicts: ${factChecks.map(fc => fc.verdict).join(', ')}`);
    if (valueScore) {
      console.log(`   Value Score: ${(valueScore.total * 100).toFixed(1)}%`);
    }
    console.log(`   Total Duration: ${result.durationMs}ms`);
    console.log(`   Steps Completed: ${stepsCompleted.join(' → ')}`);
    console.log('='.repeat(80) + '\n');

    logger.info('[Pipeline] Chirp processing complete', {
      chirpId: chirp.id,
      durationMs: result.durationMs,
      claimCount: claims.length,
      factCheckStatus,
      valueTotal: valueScore?.total,
    });

    return result;

  } catch (error: any) {
    // ========================================================================
    // FAILURE: Build error result
    // ========================================================================
    const lastStep = stepsCompleted[stepsCompleted.length - 1] || 'init';
    const isAuth = isAuthenticationError(error);

    console.log('\n' + '='.repeat(80));
    console.log('❌ PIPELINE FAILED');
    console.log('='.repeat(80));
    console.log(`   Chirp ID: ${chirp.id}`);
    console.log(`   Failed at Step: ${lastStep}`);
    console.log(`   Error: ${error.message}`);
    console.log(`   Is Auth Error: ${isAuth ? '✅ YES' : '❌ NO'}`);
    console.log(`   Retryable: ${!isAuth ? '✅ YES' : '❌ NO'}`);
    console.log(`   Steps Completed: ${stepsCompleted.join(' → ')}`);
    console.log('='.repeat(80) + '\n');

    logger.error('[Pipeline] Chirp processing failed', {
      chirpId: chirp.id,
      step: lastStep,
      error: error.message,
      isAuthError: isAuth,
      stepsCompleted,
    });

    const result: PipelineResult = {
      success: false,
      status: 'failed',
      claims: [],
      factChecks: [],
      factCheckStatus: 'needs_review',
      processedAt: new Date(),
      durationMs: Date.now() - startTime,
      stepsCompleted,
      error: {
        step: lastStep,
        message: error.message,
        isRetryable: !isAuth, // Don't retry auth errors
      },
    };

    // Save failed status
    await saveChirpFailure(chirp.id, result).catch((saveErr) => {
      logger.error('[Pipeline] Failed to save failure status', { error: saveErr.message });
    });

    return result;
  }
}

/**
 * Process a comment through the value pipeline
 */
export async function processComment(
  input: CommentPipelineInput,
  options?: PipelineOptions
): Promise<PipelineResult> {
  const startTime = Date.now();
  const { comment, parentChirp, skipPreCheck } = input;
  const stepsCompleted: string[] = [];

  logger.info('[Pipeline] Starting comment processing', {
    commentId: comment.id,
    chirpId: comment.chirpId,
    authorId: comment.authorId,
  });

  try {
    // STEP 1: Pre-check
    let needsFactCheck = true;
    let preCheck;

    if (!skipPreCheck) {
      preCheck = await runPreCheck(comment.text, comment.imageUrl);
      needsFactCheck = preCheck.needsFactCheck;
      stepsCompleted.push('precheck');
    } else {
      stepsCompleted.push('precheck_skipped');
    }

    if (!needsFactCheck) {
      const result: PipelineResult = {
        success: true,
        status: 'completed',
        preCheck,
        claims: [],
        factChecks: [],
        factCheckStatus: 'clean',
        processedAt: new Date(),
        durationMs: Date.now() - startTime,
        stepsCompleted,
      };

      await saveCommentResult(comment.id, result);
      return result;
    }

    // STEP 2: Extract claims
    const { claims } = await extractClaimsFromComment(comment);
    stepsCompleted.push('extract_claims');

    if (claims.length === 0) {
      const result: PipelineResult = {
        success: true,
        status: 'completed',
        preCheck,
        claims: [],
        factChecks: [],
        factCheckStatus: 'clean',
        processedAt: new Date(),
        durationMs: Date.now() - startTime,
        stepsCompleted,
      };

      await saveCommentResult(comment.id, result);
      return result;
    }

    // STEP 3: Verify claims
    // Create chirp-like object for fact-checking
    const commentAsChirp: Chirp = {
      id: comment.id,
      authorId: comment.authorId,
      text: comment.text,
      topic: parentChirp.topic,
      reachMode: 'forAll',
      createdAt: comment.createdAt,
      commentCount: 0,
      imageUrl: comment.imageUrl,
    };

    const factCheckResults = await verifyClaimsForChirp(commentAsChirp, claims);
    const factChecks = factCheckResults.map((r) => r.factCheck);
    const factCheckStatus = determineFactCheckStatus(factChecks);
    stepsCompleted.push('verify_claims');

    // Build result (skip value scoring for comments for now)
    const result: PipelineResult = {
      success: true,
      status: 'completed',
      preCheck,
      claims,
      factChecks,
      factCheckStatus,
      processedAt: new Date(),
      durationMs: Date.now() - startTime,
      stepsCompleted,
    };

    await saveCommentResult(comment.id, result);

    logger.info('[Pipeline] Comment processing complete', {
      commentId: comment.id,
      durationMs: result.durationMs,
      claimCount: claims.length,
      factCheckStatus,
    });

    return result;

  } catch (error: any) {
    const lastStep = stepsCompleted[stepsCompleted.length - 1] || 'init';
    const isAuth = isAuthenticationError(error);

    logger.error('[Pipeline] Comment processing failed', {
      commentId: comment.id,
      step: lastStep,
      error: error.message,
      isAuthError: isAuth,
    });

    const result: PipelineResult = {
      success: false,
      status: 'failed',
      claims: [],
      factChecks: [],
      factCheckStatus: 'needs_review',
      processedAt: new Date(),
      durationMs: Date.now() - startTime,
      stepsCompleted,
      error: {
        step: lastStep,
        message: error.message,
        isRetryable: !isAuth,
      },
    };

    await saveCommentFailure(comment.id, result).catch((saveErr) => {
      logger.error('[Pipeline] Failed to save comment failure status', { error: saveErr.message });
    });

    return result;
  }
}

// ============================================================================
// Firestore Save Helpers
// ============================================================================

/**
 * Atomic save of successful chirp result
 */
async function saveChirpResult(
  chirpId: string,
  result: PipelineResult,
  predictedEngagement?: {
    expectedViews7d: number;
    expectedBookmarks7d: number;
    expectedRechirps7d: number;
    expectedComments7d: number;
    predictedAt: Date;
  }
): Promise<void> {
  await chirpService.updateChirpInsights(chirpId, {
    claims: result.claims,
    factChecks: result.factChecks,
    factCheckStatus: result.factCheckStatus,
    valueScore: result.valueScore,
    predictedEngagement,
    factCheckingStatus: null, // Delete field to mark as completed
    factCheckingStartedAt: null,
  });
}

/**
 * Save failed chirp status
 */
async function saveChirpFailure(chirpId: string, _result: PipelineResult): Promise<void> {
  await chirpService.updateChirpInsights(chirpId, {
    factCheckingStatus: 'failed',
    factCheckingStartedAt: null,
  });
}

/**
 * Atomic save of successful comment result
 */
async function saveCommentResult(commentId: string, result: PipelineResult): Promise<void> {
  await commentService.updateCommentAnalytics(commentId, {
    claims: result.claims,
    factChecks: result.factChecks,
    factCheckStatus: result.factCheckStatus,
    factCheckingStatus: null as any, // Delete field to mark as completed
    factCheckingStartedAt: null as any,
  });
}

/**
 * Save failed comment status
 */
async function saveCommentFailure(commentId: string, _result: PipelineResult): Promise<void> {
  await commentService.updateCommentAnalytics(commentId, {
    factCheckingStatus: 'failed',
    factCheckingStartedAt: null as any,
  });
}

// ============================================================================
// Exports
// ============================================================================

export * from './types';
export { runPreCheck } from './steps/precheck';
export { extractClaimsFromChirp, extractClaimsFromComment } from './steps/extractClaims';
export { verifyClaimsForChirp, determineFactCheckStatus } from './steps/verifyClaims';
export { scoreChirp } from './steps/scoreValue';

