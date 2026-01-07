/**
 * Side Effects Service
 * 
 * Handles async side effects that shouldn't block the main pipeline:
 * - Reputation updates
 * - Kurral score updates
 * 
 * These are queued and processed separately from the main pipeline.
 */

import { logger } from 'firebase-functions';
import { recordPostValue } from '../reputationService';
import { updateKurralScore } from '../kurralScoreService';
import type { Chirp } from '../../types';
import type { PipelineResult } from './types';

/**
 * Queue side effects for processing after pipeline completion
 * 
 * This function is intentionally fire-and-forget.
 * Side effects should not block the main pipeline response.
 */
export async function queueSideEffects(
  chirp: Chirp,
  result: PipelineResult
): Promise<void> {
  if (!result.success) {
    logger.info('[SideEffects] Skipping side effects for failed pipeline', {
      chirpId: chirp.id,
    });
    return;
  }

  // Process side effects in parallel, catch individual errors
  await Promise.all([
    updateReputation(chirp, result).catch((err) => {
      logger.error('[SideEffects] Reputation update failed', {
        chirpId: chirp.id,
        error: err.message,
      });
    }),
    updateKurral(chirp, result).catch((err) => {
      logger.error('[SideEffects] Kurral score update failed', {
        chirpId: chirp.id,
        error: err.message,
      });
    }),
  ]);

  logger.info('[SideEffects] Side effects processed', { chirpId: chirp.id });
}

/**
 * Update user reputation based on post value
 */
async function updateReputation(
  chirp: Chirp,
  result: PipelineResult
): Promise<void> {
  if (!result.valueScore) {
    return;
  }

  const chirpWithScore = {
    ...chirp,
    claims: result.claims,
    factChecks: result.factChecks,
    valueScore: result.valueScore,
    factCheckStatus: result.factCheckStatus,
  };

  await recordPostValue(chirpWithScore, result.valueScore, result.claims);
}

/**
 * Update Kurral score based on pipeline results
 */
async function updateKurral(
  chirp: Chirp,
  result: PipelineResult
): Promise<void> {
  const hasUpdates = Boolean(
    result.valueScore || 
    result.factCheckStatus || 
    result.factChecks.length > 0
  );

  if (!hasUpdates) {
    return;
  }

  await updateKurralScore({
    userId: chirp.authorId,
    valueScore: result.valueScore,
    policyDecision: {
      status: result.factCheckStatus,
      reasons: [],
      escalateToHuman: result.factCheckStatus === 'blocked',
    },
    factChecks: result.factChecks,
    reason: 'post_value_update',
  });
}

