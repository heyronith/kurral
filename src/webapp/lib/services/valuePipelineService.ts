import type { Chirp, Comment, Claim, FactCheck, ValueScore, ValueVector, DiscussionQuality } from '../../types';
import { chirpService, commentService } from '../firestore';
import { extractClaimsForChirp } from './claimExtractionAgent';
import { factCheckClaims } from './factCheckAgent';
import { analyzeDiscussion, DiscussionAnalysis } from './discussionQualityAgent';
import { scoreChirpValue } from './valueScoringAgent';
import { generateValueExplanation } from './explainerAgent';
import { evaluatePolicy } from './policyEngine';
import { recordPostValue, recordCommentValue } from './reputationService';
import { updateKurralScore } from './kurralScoreService';

const DELTA_THRESHOLD = 0.01;
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second

const safeClaims = (chirp: Chirp) => chirp.claims || [];
const safeFactChecks = (chirp: Chirp) => chirp.factChecks || [];

const valueVectorToScore = (value?: ValueVector & { total: number }): ValueScore | undefined => {
  if (!value) {
    return undefined;
  }

  return {
    epistemic: value.epistemic ?? 0,
    insight: value.insight ?? 0,
    practical: value.practical ?? 0,
    relational: value.relational ?? 0,
    effort: value.effort ?? 0,
    total: value.total ?? 0,
    confidence: Math.min(1, Math.max(0.3, value.total)),
    updatedAt: new Date(),
  };
};

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
    const insights: {
      claims?: Claim[];
      factChecks?: FactCheck[];
      factCheckStatus?: 'clean' | 'needs_review' | 'blocked';
      valueScore?: ValueScore;
      valueExplanation?: string;
      discussionQuality?: DiscussionQuality;
    } = {};

  let discussion: DiscussionAnalysis | undefined;
  let latestValueScore: ValueScore | undefined;

  const safeExecute = async <T>(label: string, fn: () => Promise<T>): Promise<T | undefined> => {
    try {
      return await fn();
    } catch (error) {
      console.error(`[ValuePipeline] ${label} failed:`, error);
      return undefined;
    }
  };

  const claimsResult = await safeExecute('claim extraction', () =>
    withRetry(() => extractClaimsForChirp(chirp), 'claim extraction')
  );

  if (claimsResult && claimsResult.length > 0) {
    insights.claims = claimsResult;
    }

  const claimsForScoring = (): Claim[] => insights.claims ?? chirp.claims ?? [];
  const factChecksForScoring = (): FactCheck[] => insights.factChecks ?? chirp.factChecks ?? [];

  if (claimsForScoring().length > 0) {
    const factChecksResult = await safeExecute('fact checking', () =>
      withRetry(() => factCheckClaims(chirp, claimsForScoring()), 'fact checking')
    );

    if (factChecksResult && factChecksResult.length > 0) {
      insights.factChecks = factChecksResult;
    }
  }

  const comments = await safeExecute('comment loading', () => commentService.getCommentsForChirp(chirp.id));
  if (comments) {
    discussion = await safeExecute('discussion analysis', () =>
      withRetry(() => analyzeDiscussion(chirp, comments), 'discussion analysis')
    );

    if (discussion?.threadQuality) {
      insights.discussionQuality = discussion.threadQuality;
    }
  }

  const policyDecision = evaluatePolicy(claimsForScoring(), factChecksForScoring());
    if (policyDecision.status) {
      insights.factCheckStatus = policyDecision.status;
    }

  const computedValueScore = await safeExecute('value scoring', () =>
    withRetry(() => scoreChirpValue(chirp, claimsForScoring(), factChecksForScoring(), discussion), 'value scoring')
  );

  if (!computedValueScore) {
    console.log('[ValuePipeline] Value scoring skipped - agent not available');
  } else {
    latestValueScore = computedValueScore;
    insights.valueScore = computedValueScore;

    const explanation = await safeExecute('explanation generation', () =>
      withRetry(
        () =>
          generateValueExplanation(
            chirp,
            computedValueScore,
            claimsForScoring(),
            factChecksForScoring(),
            discussion?.threadQuality
          ),
        'explanation generation'
      )
    );

    if (explanation && explanation.trim().length > 0) {
      insights.valueExplanation = explanation;
    }
    }

    if (Object.keys(insights).length > 0) {
    await safeExecute('updating chirp insights', () => chirpService.updateChirpInsights(chirp.id, insights));
  }

  const updatedChirp: Chirp = {
    ...chirp,
    ...(insights.claims ? { claims: insights.claims } : {}),
    ...(insights.factChecks ? { factChecks: insights.factChecks } : {}),
    ...(insights.valueScore ? { valueScore: insights.valueScore } : {}),
    ...(insights.valueExplanation ? { valueExplanation: insights.valueExplanation } : {}),
    ...(insights.discussionQuality ? { discussionQuality: insights.discussionQuality } : {}),
    ...(insights.factCheckStatus ? { factCheckStatus: insights.factCheckStatus } : {}),
  };

  if (latestValueScore) {
    if (!chirp.valueScore) {
      await recordPostValue(updatedChirp, latestValueScore, claimsForScoring()).catch((error) => {
        console.error('[ValuePipeline] Failed to record post value:', error);
      });
    } else {
      const delta = latestValueScore.total - chirp.valueScore.total;
      if (delta > DELTA_THRESHOLD) {
        await recordPostValue(
          updatedChirp,
          {
            ...latestValueScore,
            total: delta,
          },
          claimsForScoring()
        ).catch((error) => {
          console.error('[ValuePipeline] Failed to record post value delta:', error);
        });
      } else {
        await recordPostValue(updatedChirp, latestValueScore, claimsForScoring()).catch((error) => {
          if (!error.message?.includes('permission')) {
            console.error('[ValuePipeline] Failed to record post value:', error);
          }
        });
      }
    }
  }

  const shouldUpdateKurral =
    Boolean(latestValueScore) ||
    Boolean(insights.factCheckStatus) ||
    Boolean(insights.discussionQuality) ||
    factChecksForScoring().length > 0;

  if (shouldUpdateKurral) {
    await updateKurralScore({
      userId: chirp.authorId,
      valueScore: latestValueScore,
      policyDecision,
      discussionQuality: discussion?.threadQuality,
      factChecks: factChecksForScoring(),
      reason: 'post_value_update',
    }).catch((error) => {
      console.error('[ValuePipeline] Failed to update Kurral Score for chirp author:', error);
    });
  }

  return Object.keys(insights).length > 0 ? updatedChirp : chirp;
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

      const commentValueScore = valueVectorToScore(commentInsight.contribution);
      if (commentValueScore) {
        await updateKurralScore({
          userId: comment.authorId,
          valueScore: commentValueScore,
          discussionQuality: discussion.threadQuality,
          reason: 'comment_value_update',
        }).catch((error) => {
          console.error('[ValuePipeline] Failed to update Kurral Score for commenter:', error);
        });
      }
    }

    const valueScore = await withRetry(
      () => scoreChirpValue(chirp, safeClaims(chirp), safeFactChecks(chirp), discussion),
      'value scoring'
    );

    // If value scoring is not available (agent unavailable), skip the rest
    if (!valueScore) {
      console.log('[ValuePipeline] Value scoring skipped for comment processing - agent not available');
      return {
        commentInsights: discussion.commentInsights,
      };
    }

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

    await updateKurralScore({
      userId: chirp.authorId,
      valueScore,
      policyDecision,
      discussionQuality: discussion.threadQuality,
      factChecks: safeFactChecks(chirp),
      reason: 'post_comment_update',
    }).catch((error) => {
      console.error('[ValuePipeline] Failed to refresh Kurral Score for chirp author:', error);
    });

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
