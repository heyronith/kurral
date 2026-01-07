/**
 * Pipeline Step 3: Claim Verification (Fact-Checking)
 * 
 * Verifies claims using web search + LLM analysis.
 * Reuses the existing factCheckAgent logic.
 */

import { logger } from 'firebase-functions';
import { factCheckClaims } from '../../factCheckAgent';
import type { Chirp, Claim, FactCheck } from '../../../types';
import type { FactCheckResult } from '../types';

/**
 * Verify all claims for a chirp
 */
export async function verifyClaimsForChirp(
  chirp: Chirp,
  claims: Claim[]
): Promise<FactCheckResult[]> {
  if (claims.length === 0) {
    logger.info('[VerifyClaims] No claims to verify', { chirpId: chirp.id });
    return [];
  }

  const startTime = Date.now();

  try {
    const factChecks = await factCheckClaims(chirp, claims);

    const results: FactCheckResult[] = factChecks.map((factCheck) => ({
      factCheck,
      usedEvidence: factCheck.evidence.map((e) => ({
        ...e,
        fetchedAt: new Date(),
      })),
    }));

    logger.info('[VerifyClaims] Claims verified', {
      chirpId: chirp.id,
      claimCount: claims.length,
      factCheckCount: factChecks.length,
      verdicts: factChecks.map((fc) => fc.verdict),
      durationMs: Date.now() - startTime,
    });

    return results;
  } catch (error: any) {
    logger.error('[VerifyClaims] Failed to verify claims', {
      chirpId: chirp.id,
      claimCount: claims.length,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Determine overall fact-check status from individual verdicts
 */
export function determineFactCheckStatus(
  factChecks: FactCheck[]
): 'clean' | 'needs_review' | 'blocked' {
  if (factChecks.length === 0) {
    return 'clean';
  }

  // Count verdicts
  const verdicts = factChecks.map((fc) => fc.verdict);
  const falseCount = verdicts.filter((v) => v === 'false').length;
  const unknownCount = verdicts.filter((v) => v === 'unknown').length;
  const mixedCount = verdicts.filter((v) => v === 'mixed').length;

  // Check confidence levels for false claims
  // (kept for potential future policy tuning)
  // const confidentFalseCount = factChecks.filter(
  //   (fc) => fc.verdict === 'false' && fc.confidence >= 0.7
  // ).length;

  // Block if ANY single claim is confidently false (>= 0.85)
  // This prioritizes safety for high-confidence misinformation
  const hasHighConfidenceFalse = factChecks.some(
    (fc) => fc.verdict === 'false' && fc.confidence >= 0.85
  );
  if (hasHighConfidenceFalse) {
    return 'blocked';
  }

  // Needs review: Any false claim, or too many unknown/mixed
  if (falseCount > 0 || unknownCount >= 2 || mixedCount >= 2) {
    return 'needs_review';
  }

  // Clean: All true/mixed with good confidence
  return 'clean';
}

