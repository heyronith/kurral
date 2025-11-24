import type { Chirp, Comment, Claim, FactCheck, ValueScore, DiscussionQuality } from '../../types';
import { chirpService, commentService } from '../firestore';
import { extractClaimsForChirp } from './claimExtractionAgent';
import { factCheckClaims } from './factCheckAgent';
import { analyzeDiscussion, DiscussionAnalysis } from './discussionQualityAgent';
import { scoreChirpValue } from './valueScoringAgent';
import { generateValueExplanation } from './explainerAgent';
import { evaluatePolicy } from './policyEngine';
import { recordPostValue, recordCommentValue } from './reputationService';

const DELTA_THRESHOLD = 0.01;
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second

const safeClaims = (chirp: Chirp) => chirp.claims || [];
const safeFactChecks = (chirp: Chirp) => chirp.factChecks || [];

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(
  fn: () => Promise<T>,
  operation: string,
  retries = MAX_RETRIES
): Promise<T> {
  let lastError: Error | null = null;
  let delay = INITIAL_RETRY_DELAY;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const isRateLimit = error?.message?.includes('rate limit') || 
                         error?.message?.includes('RATE_LIMIT') ||
                         error?.status === 429;
      const isRetryable = isRateLimit || 
                         error?.message?.includes('network') ||
                         error?.message?.includes('timeout') ||
                         error?.code === 'unavailable';

      if (!isRetryable || attempt === retries) {
        console.error(`[ValuePipeline] ${operation} failed after ${attempt + 1} attempts:`, error);
        throw error;
      }

      console.warn(`[ValuePipeline] ${operation} failed (attempt ${attempt + 1}/${retries}), retrying in ${delay}ms...`);
      await sleep(delay);
      delay *= 2; // Exponential backoff
    }
  }

  throw lastError || new Error(`${operation} failed after ${retries} retries`);
}

export async function processChirpValue(chirp: Chirp): Promise<Chirp> {
  try {
    const claims = await withRetry(
      () => extractClaimsForChirp(chirp),
      'claim extraction'
    );

    const factChecks = await withRetry(
      () => factCheckClaims(chirp, claims),
      'fact checking'
    );

    const comments = await commentService.getCommentsForChirp(chirp.id);
    const discussion = await withRetry(
      () => analyzeDiscussion(chirp, comments),
      'discussion analysis'
    );

    const valueScore = await withRetry(
      () => scoreChirpValue(chirp, claims, factChecks, discussion),
      'value scoring'
    );

    const explanation = await withRetry(
      () => generateValueExplanation(chirp, valueScore, claims, factChecks, discussion.threadQuality),
      'explanation generation'
    );

    const policyDecision = evaluatePolicy(claims, factChecks);

    // Build insights object, only including defined values
    const insights: {
      claims?: Claim[];
      factChecks?: FactCheck[];
      factCheckStatus?: 'clean' | 'needs_review' | 'blocked';
      valueScore?: ValueScore;
      valueExplanation?: string;
      discussionQuality?: DiscussionQuality;
    } = {};

    if (claims && claims.length > 0) {
      insights.claims = claims;
    }
    if (factChecks && factChecks.length > 0) {
      insights.factChecks = factChecks;
    }
    if (policyDecision.status) {
      insights.factCheckStatus = policyDecision.status;
    }
    if (valueScore) {
      insights.valueScore = valueScore;
    }
    if (explanation && explanation.trim().length > 0) {
      insights.valueExplanation = explanation;
    }
    if (discussion && discussion.threadQuality) {
      insights.discussionQuality = discussion.threadQuality;
    }

    if (Object.keys(insights).length > 0) {
    await withRetry(
        () => chirpService.updateChirpInsights(chirp.id, insights),
      'updating chirp insights'
    );
    }

    // Record value contribution:
    // 1. If post doesn't have valueScore yet (first time processing), record full value
    // 2. If post has valueScore and value changed significantly, record delta
    // 3. If post has valueScore but contribution might not exist (e.g., from before system was set up),
    //    recordPostValue will check if contribution exists and skip if it does
    if (!chirp.valueScore) {
      // First time processing - record full value
      await recordPostValue(chirp, valueScore, claims).catch((error) => {
        console.error('[ValuePipeline] Failed to record post value:', error);
      });
    } else {
      // Post already has valueScore - check if value changed significantly
      const delta = valueScore.total - chirp.valueScore.total;
      if (delta > DELTA_THRESHOLD) {
        // Value changed significantly - record the delta
        // Note: recordPostValue checks if contribution exists to avoid duplicates
        await recordPostValue(
          chirp,
          {
            ...valueScore,
            total: delta,
          },
          claims
        ).catch((error) => {
          console.error('[ValuePipeline] Failed to record post value delta:', error);
        });
      } else {
        // Value hasn't changed much, but contribution might not exist
        // (e.g., if post was processed before valueContributions were set up)
        // recordPostValue will check if contribution exists and only record if missing
        await recordPostValue(chirp, valueScore, claims).catch((error) => {
          // Silently handle - recordPostValue already logs if contribution exists
          if (!error.message?.includes('permission')) {
            console.error('[ValuePipeline] Failed to record post value:', error);
          }
        });
      }
    }

    return {
      ...chirp,
      claims,
      factChecks,
      factCheckStatus: policyDecision.status,
      valueScore,
      valueExplanation: explanation,
      discussionQuality: discussion.threadQuality,
    };
  } catch (error) {
    console.error('[ValuePipeline] Failed to process chirp:', error);
    return chirp;
  }
}

export async function processCommentValue(comment: Comment): Promise<{
  commentInsights?: Record<string, DiscussionAnalysis['commentInsights'][string]>;
  updatedChirp?: Chirp;
}> {
  try {
    const chirp = await chirpService.getChirp(comment.chirpId);
    if (!chirp) {
      return {};
    }

    const comments = await commentService.getCommentsForChirp(comment.chirpId);
    const discussion = await withRetry(
      () => analyzeDiscussion(chirp, comments),
      'discussion analysis'
    );

    const commentInsight = discussion.commentInsights[comment.id];

    if (commentInsight) {
      await commentService.updateCommentAnalytics(comment.id, {
        discussionRole: commentInsight.role,
        valueContribution: commentInsight.contribution,
      }).catch((error) => {
        console.error('[ValuePipeline] Failed to update comment analytics:', error);
      });

      await recordCommentValue(comment, commentInsight.contribution, chirp.topic).catch((error) => {
        console.error('[ValuePipeline] Failed to record comment value:', error);
      });
    }

    const valueScore = await withRetry(
      () => scoreChirpValue(chirp, safeClaims(chirp), safeFactChecks(chirp), discussion),
      'value scoring'
    );

    const explanation = await withRetry(
      () => generateValueExplanation(
        chirp,
        valueScore,
        safeClaims(chirp),
        safeFactChecks(chirp),
        discussion.threadQuality
      ),
      'explanation generation'
    );

    const policyDecision = evaluatePolicy(safeClaims(chirp), safeFactChecks(chirp));

    await withRetry(
      () => chirpService.updateChirpInsights(chirp.id, {
        valueScore,
        valueExplanation: explanation,
        discussionQuality: discussion.threadQuality,
        factCheckStatus: policyDecision.status,
      }),
      'updating chirp insights'
    );

    return {
      commentInsights: discussion.commentInsights,
      updatedChirp: {
        ...chirp,
        valueScore,
        valueExplanation: explanation,
        discussionQuality: discussion.threadQuality,
        factCheckStatus: policyDecision.status,
      },
    };
  } catch (error) {
    console.error('[ValuePipeline] Failed to process comment:', error);
    return {};
  }
}
