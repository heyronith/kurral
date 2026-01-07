/**
 * Pipeline Step 4: Value Scoring
 * 
 * Scores content on 5 value dimensions.
 * Reuses the existing valueScoringAgent logic.
 */

import { logger } from 'firebase-functions';
import { scoreChirpValue } from '../../valueScoringAgent';
import type { Chirp, Claim, FactCheck } from '../../../types';
import type { ValueScoreResult } from '../types';

/**
 * Score the value of a chirp
 */
export async function scoreChirp(
  chirp: Chirp,
  claims: Claim[],
  factChecks: FactCheck[]
): Promise<ValueScoreResult | null> {
  const startTime = Date.now();

  try {
    // Call the existing value scoring agent (without discussion analysis)
    const valueScore = await scoreChirpValue(chirp, claims, factChecks, undefined);

    if (!valueScore) {
      logger.warn('[ScoreValue] Value scoring returned null', { chirpId: chirp.id });
      return null;
    }

    // Track penalties applied
    const penaltiesApplied: string[] = [];

    // Check if fact-check penalties were applied
    const confidentFalseCount = factChecks.filter(
      (fc) => fc.verdict === 'false' && fc.confidence > 0.7
    ).length;

    if (confidentFalseCount > 0) {
      penaltiesApplied.push(`false_claims_penalty_${confidentFalseCount}`);
    }

    if (claims.length > 0 && factChecks.length === 0) {
      penaltiesApplied.push('no_fact_checks_penalty');
    }

    logger.info('[ScoreValue] Value scored', {
      chirpId: chirp.id,
      total: valueScore.total,
      epistemic: valueScore.epistemic,
      insight: valueScore.insight,
      practical: valueScore.practical,
      relational: valueScore.relational,
      effort: valueScore.effort,
      penaltiesApplied,
      durationMs: Date.now() - startTime,
    });

    return {
      valueScore,
      penaltiesApplied,
    };
  } catch (error: any) {
    logger.error('[ScoreValue] Failed to score value', {
      chirpId: chirp.id,
      error: error.message,
    });
    throw error;
  }
}

