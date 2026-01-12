import type { ValueScore, Claim, FactCheck } from '../types';

/**
 * Generate engagement predictions based on value score and fact-check status
 * Simple heuristic-based predictions for MVP
 */
export function generateEngagementPrediction(
  valueScore: ValueScore,
  claims: Claim[],
  factChecks: FactCheck[]
): {
  expectedViews7d: number;
  expectedBookmarks7d: number;
  expectedRechirps7d: number;
  expectedComments7d: number;
  predictedAt: Date;
} {
  const valueTotal = valueScore.total;
  const confidence = valueScore.confidence ?? 0.5;

  // Base multipliers (high value = more engagement expected)
  let viewsMultiplier = 100;
  let bookmarksMultiplier = 5;
  let rechirpsMultiplier = 3;
  let commentsMultiplier = 10;

  // Adjust based on fact-check status
  const hasFalseClaims = factChecks.some(
    (fc) => fc.verdict === 'false' && fc.confidence > 0.7
  );
  const isBlocked = factChecks.some((fc) => fc.verdict === 'false' && fc.confidence > 0.9);

  if (isBlocked) {
    // Blocked posts get heavily penalized predictions
    viewsMultiplier *= 0.2;
    bookmarksMultiplier *= 0.1;
    rechirpsMultiplier *= 0.1;
    commentsMultiplier *= 0.3;
  } else if (hasFalseClaims) {
    // False claims reduce expected engagement
    viewsMultiplier *= 0.5;
    bookmarksMultiplier *= 0.3;
    rechirpsMultiplier *= 0.3;
    commentsMultiplier *= 0.6;
  }

  // Apply value score (0-1) to multipliers
  // High value scores (0.8+) get full multiplier, lower scores scale down
  const valueFactor = Math.max(0.1, valueTotal); // Minimum 10% of base
  const confidenceFactor = Math.max(0.5, confidence); // Minimum 50% confidence adjustment

  // Calculate predictions
  const expectedViews7d = Math.round(valueFactor * viewsMultiplier * confidenceFactor);
  const expectedBookmarks7d = Math.round(valueFactor * bookmarksMultiplier * confidenceFactor);
  const expectedRechirps7d = Math.round(valueFactor * rechirpsMultiplier * confidenceFactor);
  const expectedComments7d = Math.round(valueFactor * commentsMultiplier * confidenceFactor);

  return {
    expectedViews7d,
    expectedBookmarks7d,
    expectedRechirps7d,
    expectedComments7d,
    predictedAt: new Date(),
  };
}

