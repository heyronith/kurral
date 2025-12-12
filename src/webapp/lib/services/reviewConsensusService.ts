import { reviewContextService } from '../firestore';
import { userService } from '../firestore';
import { chirpService } from '../firestore';
import { decideFinalStatus } from './aiReviewDecisionService';
import type { PostReviewContext } from '../../types';

const MIN_REVIEWS_REQUIRED = 50;
const CONSENSUS_THRESHOLD = 0.6; // 60% weighted majority required

interface WeightedReview {
  review: PostReviewContext;
  weight: number; // Based on kurralScore (0-100 scale, normalized to 0-1)
}

interface ConsensusResult {
  hasConsensus: boolean;
  newStatus?: 'clean' | 'blocked';
  validateWeight: number;
  invalidateWeight: number;
  totalWeight: number;
  reviewCount: number;
  confidence: number; // 0-1, how confident we are in the decision
}

/**
 * Calculate weight for a review based on reviewer's kurralScore
 * KurralScore is 0-100, we normalize to 0-1 for weighting
 * Minimum weight is 0.1 (even low scores contribute)
 * Maximum weight is 1.0 (perfect score)
 */
function calculateReviewWeight(kurralScore: number): number {
  // Normalize 0-100 to 0-1, with minimum of 0.1
  const normalized = Math.max(0.1, Math.min(1.0, kurralScore / 100));
  return normalized;
}

/**
 * Evaluate consensus for a chirp's reviews
 * Returns whether consensus is reached and what the new status should be
 */
export async function evaluateReviewConsensus(chirpId: string): Promise<ConsensusResult> {
  try {
    // Get all reviews for this chirp
    const reviews = await reviewContextService.getReviewContextsForChirp(chirpId);
    
    if (reviews.length < MIN_REVIEWS_REQUIRED) {
      return {
        hasConsensus: false,
        validateWeight: 0,
        invalidateWeight: 0,
        totalWeight: 0,
        reviewCount: reviews.length,
        confidence: 0,
      };
    }

    // Get kurralScore for each reviewer and calculate weighted reviews
    const weightedReviews: WeightedReview[] = [];
    
    for (const review of reviews) {
      try {
        const user = await userService.getUser(review.submittedBy);
        const kurralScore = user?.kurralScore?.score ?? 50; // Default to 50 if no score
        const weight = calculateReviewWeight(kurralScore);
        
        weightedReviews.push({
          review,
          weight,
        });
      } catch (error) {
        console.error(`[ReviewConsensus] Error getting user ${review.submittedBy}:`, error);
        // Use default weight if user lookup fails
        weightedReviews.push({
          review,
          weight: 0.5, // Default weight
        });
      }
    }

    // Calculate weighted totals
    let validateWeight = 0;
    let invalidateWeight = 0;
    let totalWeight = 0;

    for (const weightedReview of weightedReviews) {
      const weight = weightedReview.weight;
      totalWeight += weight;
      
      if (weightedReview.review.action === 'validate') {
        validateWeight += weight;
      } else if (weightedReview.review.action === 'invalidate') {
        invalidateWeight += weight;
      }
    }

    // Calculate confidence (difference between validate and invalidate weights)
    const weightDifference = Math.abs(validateWeight - invalidateWeight);
    const confidence = totalWeight > 0 ? weightDifference / totalWeight : 0;

    // Check if we have consensus (60% weighted majority)
    const validateRatio = totalWeight > 0 ? validateWeight / totalWeight : 0;
    const invalidateRatio = totalWeight > 0 ? invalidateWeight / totalWeight : 0;

    let hasConsensus = false;
    let newStatus: 'clean' | 'blocked' | undefined = undefined;

    if (validateRatio >= CONSENSUS_THRESHOLD) {
      hasConsensus = true;
      newStatus = 'clean';
    } else if (invalidateRatio >= CONSENSUS_THRESHOLD) {
      hasConsensus = true;
      newStatus = 'blocked';
    }
    // If neither reaches 60%, no consensus (keep as needs_review)

    return {
      hasConsensus,
      newStatus,
      validateWeight,
      invalidateWeight,
      totalWeight,
      reviewCount: reviews.length,
      confidence,
    };
  } catch (error) {
    console.error('[ReviewConsensus] Error evaluating consensus:', error);
    return {
      hasConsensus: false,
      validateWeight: 0,
      invalidateWeight: 0,
      totalWeight: 0,
      reviewCount: 0,
      confidence: 0,
    };
  }
}

/**
 * Check and update chirp status based on review consensus
 * This should be called after a new review is submitted
 */
export async function checkAndUpdateConsensus(chirpId: string): Promise<void> {
  try {
    const consensus = await evaluateReviewConsensus(chirpId);

    // If we don't even meet the 50-review minimum, skip AI decision and return
    if (!consensus.hasConsensus) {
      console.log(`[ReviewConsensus] No consensus yet for chirp ${chirpId}:`, {
        reviewCount: consensus.reviewCount,
        validateWeight: consensus.validateWeight,
        invalidateWeight: consensus.invalidateWeight,
        confidence: consensus.confidence,
      });
      return;
    }

    // Get current chirp to check if it still needs review
    const currentChirp = await chirpService.getChirp(chirpId);
    if (!currentChirp) {
      console.warn(`[ReviewConsensus] Chirp ${chirpId} not found, skipping consensus update`);
      return;
    }

    // Only process if post is still in needs_review status
    if (currentChirp.factCheckStatus !== 'needs_review') {
      console.log(`[ReviewConsensus] Chirp ${chirpId} is no longer needs_review (current: ${currentChirp.factCheckStatus}), skipping consensus update`);
      return;
    }

    // AI-style final decision that blends fact checks + weighted reviews
    const finalStatus = await decideFinalStatus(chirpId, {
      validateWeight: consensus.validateWeight,
      invalidateWeight: consensus.invalidateWeight,
      totalWeight: consensus.totalWeight,
      reviewCount: consensus.reviewCount,
      confidence: consensus.confidence,
    });

    // Only update if status actually changed
    if (finalStatus !== currentChirp.factCheckStatus) {
      await chirpService.updateChirpInsights(chirpId, {
        factCheckStatus: finalStatus,
      });
      console.log(`[ReviewConsensus] Updated chirp ${chirpId} from ${currentChirp.factCheckStatus} to ${finalStatus}`, {
        reviewCount: consensus.reviewCount,
        validateWeight: consensus.validateWeight,
        invalidateWeight: consensus.invalidateWeight,
        confidence: consensus.confidence,
      });
    } else {
      console.log(`[ReviewConsensus] Chirp ${chirpId} status unchanged (${finalStatus})`, {
        reviewCount: consensus.reviewCount,
        validateWeight: consensus.validateWeight,
        invalidateWeight: consensus.invalidateWeight,
        confidence: consensus.confidence,
      });
    }

    console.log(`[ReviewConsensus] Final status for chirp ${chirpId}: ${finalStatus}`, {
      reviewCount: consensus.reviewCount,
      validateWeight: consensus.validateWeight,
      invalidateWeight: consensus.invalidateWeight,
      confidence: consensus.confidence,
    });
  } catch (error) {
    console.error('[ReviewConsensus] Error checking and updating consensus:', error);
  }
}
