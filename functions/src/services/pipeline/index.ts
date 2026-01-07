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
    let needsFactCheck = true;
    let preCheck;

    if (!skipPreCheck) {
      preCheck = await runPreCheck(chirp.text, chirp.imageUrl);
      needsFactCheck = preCheck.needsFactCheck;
      stepsCompleted.push('precheck');

      logger.info('[Pipeline] Pre-check complete', {
        chirpId: chirp.id,
        needsFactCheck,
        contentType: preCheck.contentType,
      });
    } else {
      stepsCompleted.push('precheck_skipped');
    }

    // If no fact-check needed, return early with clean status
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

      // Atomic save
      await saveChirpResult(chirp.id, result);
      
      // Queue side effects (async, non-blocking)
      queueSideEffects(chirp, result).catch((err) => {
        logger.error('[Pipeline] Failed to queue side effects', { error: err.message });
      });

      return result;
    }

    // ========================================================================
    // STEP 2: Extract claims
    // ========================================================================
    const { claims } = await extractClaimsFromChirp(chirp);
    stepsCompleted.push('extract_claims');

    logger.info('[Pipeline] Claims extracted', {
      chirpId: chirp.id,
      claimCount: claims.length,
    });

    // If no claims found, return clean status
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

      await saveChirpResult(chirp.id, result);
      queueSideEffects(chirp, result).catch((err) => {
        logger.error('[Pipeline] Failed to queue side effects', { error: err.message });
      });

      return result;
    }

    // ========================================================================
    // STEP 3: Verify claims (fact-check)
    // ========================================================================
    const factCheckResults = await verifyClaimsForChirp(chirp, claims);
    const factChecks = factCheckResults.map((r) => r.factCheck);
    const factCheckStatus = determineFactCheckStatus(factChecks);
    stepsCompleted.push('verify_claims');

    logger.info('[Pipeline] Claims verified', {
      chirpId: chirp.id,
      factCheckCount: factChecks.length,
      factCheckStatus,
      verdicts: factChecks.map((fc) => fc.verdict),
    });

    // ========================================================================
    // STEP 4: Score value
    // ========================================================================
    let valueScore;

    if (!opts.skipValueScoring) {
      const scoreResult = await scoreChirp(chirp, claims, factChecks);
      valueScore = scoreResult?.valueScore;
      stepsCompleted.push('score_value');

      logger.info('[Pipeline] Value scored', {
        chirpId: chirp.id,
        total: valueScore?.total,
      });
    } else {
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

    // Atomic save - single write with all data
    await saveChirpResult(chirp.id, result);

    // Queue side effects (async, non-blocking)
    queueSideEffects(chirp, result).catch((err) => {
      logger.error('[Pipeline] Failed to queue side effects', { error: err.message });
    });

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
async function saveChirpResult(chirpId: string, result: PipelineResult): Promise<void> {
  await chirpService.updateChirpInsights(chirpId, {
    claims: result.claims,
    factChecks: result.factChecks,
    factCheckStatus: result.factCheckStatus,
    valueScore: result.valueScore,
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

