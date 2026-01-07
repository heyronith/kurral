/**
 * Pipeline Step 2: Claim Extraction
 * 
 * Extracts verifiable factual claims from text/images.
 * Reuses the existing claimExtractionAgent logic.
 */

import { logger } from 'firebase-functions';
import { extractClaimsForChirp, extractClaimsForComment } from '../../claimExtractionAgent';
import type { Chirp, Comment } from '../../../types';
import type { ClaimExtractionResult } from '../types';

/**
 * Extract claims from a chirp
 */
export async function extractClaimsFromChirp(chirp: Chirp): Promise<ClaimExtractionResult> {
  const startTime = Date.now();

  try {
    const claims = await extractClaimsForChirp(chirp, undefined);

    logger.info('[ExtractClaims] Chirp claims extracted', {
      chirpId: chirp.id,
      claimCount: claims.length,
      durationMs: Date.now() - startTime,
    });

    return {
      claims,
      extractedAt: new Date(),
    };
  } catch (error: any) {
    logger.error('[ExtractClaims] Failed to extract claims from chirp', {
      chirpId: chirp.id,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Extract claims from a comment
 */
export async function extractClaimsFromComment(comment: Comment): Promise<ClaimExtractionResult> {
  const startTime = Date.now();

  try {
    const claims = await extractClaimsForComment(comment);

    logger.info('[ExtractClaims] Comment claims extracted', {
      commentId: comment.id,
      claimCount: claims.length,
      durationMs: Date.now() - startTime,
    });

    return {
      claims,
      extractedAt: new Date(),
    };
  } catch (error: any) {
    logger.error('[ExtractClaims] Failed to extract claims from comment', {
      commentId: comment.id,
      error: error.message,
    });
    throw error;
  }
}

