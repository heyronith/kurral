import type { Chirp, Comment, Claim, FactCheck, ValueScore, ValueVector, DiscussionQuality } from '../types';
import { logger } from 'firebase-functions';
import { chirpService, commentService } from './firestoreService';
import { extractClaimsForChirp, extractClaimsForComment } from './claimExtractionAgent';
import { factCheckClaims } from './factCheckAgent';
import { analyzeDiscussion, DiscussionAnalysis } from './discussionQualityAgent';
import { scoreChirpValue } from './valueScoringAgent';
import { generateValueExplanation } from './explainerAgent';
import { evaluatePolicy } from './policyEngine';
import { recordPostValue, recordCommentValue } from './reputationService';
import { updateKurralScore } from './kurralScoreService';
import { preCheckChirp, preCheckComment, calculateContentRiskScore, type PreCheckResult } from './factCheckPreCheckAgent';
import { isAuthenticationError } from '../agents/baseAgent';

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
      
      // Authentication errors should NOT be retried - they're not transient
      if (isAuthenticationError(error)) {
        console.error(
          `[ValuePipeline] ${operation} failed due to authentication error - API key is invalid or expired. This error will NOT be retried.`,
          error
        );
        throw error; // Fail immediately, don't retry
      }
      
      const isRateLimit =
        error?.message?.includes('rate limit') ||
        error?.message?.includes('RATE_LIMIT') ||
        error?.status === 429;
      const isRetryable =
        isRateLimit ||
        error?.message?.includes('network') ||
        error?.message?.includes('timeout') ||
        error?.code === 'unavailable';

      if (!isRetryable || attempt === retries) {
        console.error(`[ValuePipeline] ${operation} failed after ${attempt + 1} attempts:`, error);
        throw error;
      }

      console.warn(
        `[ValuePipeline] ${operation} failed (attempt ${attempt + 1}/${retries}), retrying in ${delay}ms...`
      );
      await sleep(delay);
      delay *= 2; // Exponential backoff
    }
  }

  throw lastError || new Error(`${operation} failed after ${retries} retries`);
}

async function saveChirpProgress(
  chirpId: string,
  partialInsights: any,
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
): Promise<void> {
  const updates: any = { ...partialInsights };

  if (status === 'completed') {
    updates.factCheckingStatus = null;
    updates.factCheckingStartedAt = null;
  } else {
    updates.factCheckingStatus = status;
    if (status === 'in_progress') {
      updates.factCheckingStartedAt = new Date();
    }
  }

  await chirpService.updateChirpInsights(chirpId, updates);
}

async function saveCommentProgress(
  commentId: string,
  partialInsights: any,
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
): Promise<void> {
  const updates: any = { ...partialInsights };

  if (status === 'completed') {
    updates.factCheckingStatus = null;
    updates.factCheckingStartedAt = null;
  } else {
    updates.factCheckingStatus = status;
    if (status === 'in_progress') {
      updates.factCheckingStartedAt = new Date();
    }
  }

  await commentService.updateCommentAnalytics(commentId, updates);
}

function hasCompleteFactCheckData(chirp: Chirp): boolean {
  const isCompleted = chirp.factCheckingStatus === 'completed';
  const hasFinalStatus = !!chirp.factCheckStatus;
  const hasFactCheckResults =
    !!(chirp.claims && chirp.claims.length > 0) &&
    (!!(chirp.factChecks && chirp.factChecks.length > 0) || hasFinalStatus);

  return isCompleted || hasFinalStatus || hasFactCheckResults;
}

function isStillProcessingFactCheck(chirp: Chirp): boolean {
  return chirp.factCheckingStatus === 'pending' || chirp.factCheckingStatus === 'in_progress';
}

function inheritFactCheckData(originalChirp: Chirp): {
  claims?: Claim[];
  factChecks?: FactCheck[];
  factCheckStatus?: 'clean' | 'needs_review' | 'blocked';
} {
  const inherited: {
    claims?: Claim[];
    factChecks?: FactCheck[];
    factCheckStatus?: 'clean' | 'needs_review' | 'blocked';
  } = {};

  if (originalChirp.claims && originalChirp.claims.length > 0) {
    inherited.claims = originalChirp.claims;
  }

  if (originalChirp.factChecks && originalChirp.factChecks.length > 0) {
    inherited.factChecks = originalChirp.factChecks;
  }

  if (originalChirp.factCheckStatus) {
    inherited.factCheckStatus = originalChirp.factCheckStatus;
  }

  return inherited;
}

function calculateTextSimilarity(text1: string, text2: string): number {
  const normalize = (text: string): string => {
    return text.toLowerCase().trim().replace(/[^\w\s]/g, ' ');
  };

  const normalized1 = normalize(text1);
  const normalized2 = normalize(text2);

  if (normalized1 === normalized2) {
    return 1.0;
  }

  const words1 = new Set(normalized1.split(/\s+/).filter((w) => w.length > 0));
  const words2 = new Set(normalized2.split(/\s+/).filter((w) => w.length > 0));

  if (words1.size === 0 || words2.size === 0) {
    return 0;
  }

  const intersection = new Set([...words1].filter((w) => words2.has(w)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
}

function matchClaimsToOriginal(
  extractedClaims: Claim[],
  originalClaims: Claim[],
  originalFactChecks: FactCheck[]
): Map<string, { originalClaim: Claim; originalFactCheck?: FactCheck; similarity: number }> {
  const matches = new Map<
    string,
    { originalClaim: Claim; originalFactCheck?: FactCheck; similarity: number }
  >();

  const factCheckMap = new Map<string, FactCheck>();
  for (const factCheck of originalFactChecks) {
    factCheckMap.set(factCheck.claimId, factCheck);
  }

  for (const extractedClaim of extractedClaims) {
    let bestMatch: { originalClaim: Claim; originalFactCheck?: FactCheck; similarity: number } | null = null;
    let bestSimilarity = 0.7;

    for (const originalClaim of originalClaims) {
      const similarity = calculateTextSimilarity(extractedClaim.text, originalClaim.text);

      if (similarity > bestSimilarity && (!bestMatch || similarity > bestMatch.similarity)) {
        const originalFactCheck = factCheckMap.get(originalClaim.id);
        bestMatch = {
          originalClaim,
          originalFactCheck,
          similarity,
        };
        bestSimilarity = similarity;
      }
    }

    if (bestMatch) {
      matches.set(extractedClaim.id, bestMatch);
    }
  }

  return matches;
}

async function extractClaimsFromUserText(chirp: Chirp): Promise<Claim[]> {
  const userChirp: Chirp = {
    ...chirp,
    quotedChirpId: undefined,
  };

  return extractClaimsForChirp(userChirp, undefined);
}

export async function processChirpValue(
  chirp: Chirp,
  options?: { skipFactCheck?: boolean }
): Promise<Chirp> {
  // Debug: log presence of OPENAI_API_KEY once per cold start
  if (!process.env.__OPENAI_ENV_LOGGED) {
    logger.warn('[ValuePipeline] OPENAI_API_KEY present:', !!process.env.OPENAI_API_KEY);
    logger.warn(
      '[ValuePipeline] Env keys containing OPENAI:',
      Object.keys(process.env).filter((k) => k.includes('OPENAI'))
    );
    process.env.__OPENAI_ENV_LOGGED = '1';
  }

  await saveChirpProgress(chirp.id, {}, 'in_progress');

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
  const shouldFactCheck = !options?.skipFactCheck;

  const safeExecute = async <T>(label: string, fn: () => Promise<T>): Promise<T | undefined> => {
    try {
      return await fn();
    } catch (error) {
      console.error(`[ValuePipeline] ${label} failed:`, error);
      return undefined;
    }
  };

  const riskScore = calculateContentRiskScore({
    text: chirp.text,
    topic: chirp.topic,
    semanticTopics: chirp.semanticTopics,
    entities: chirp.entities,
    imageUrl: chirp.imageUrl,
  });
  logger.info('[ValuePipeline] Risk score', {
    chirpId: chirp.id,
    riskScore,
    topic: chirp.topic,
    semanticTopicsCount: chirp.semanticTopics?.length || 0,
    entitiesCount: chirp.entities?.length || 0,
    textLength: chirp.text?.length || 0,
    textPreview: chirp.text?.substring(0, 100) || '',
  });

  let preCheckResult: PreCheckResult | undefined;
  let shouldProceedWithFactCheck = false;

  if (chirp.rechirpOfId) {
    try {
      const originalChirp = await chirpService.getChirp(chirp.rechirpOfId);
      if (originalChirp) {
        if (hasCompleteFactCheckData(originalChirp)) {
          const inheritedData = inheritFactCheckData(originalChirp);

          insights.claims = inheritedData.claims;
          insights.factChecks = inheritedData.factChecks;
          insights.factCheckStatus = inheritedData.factCheckStatus;

          await saveChirpProgress(chirp.id, inheritedData, 'in_progress');

          console.log(
            `[ValuePipeline] Rechirp ${chirp.id} inherited fact-check data from original ${chirp.rechirpOfId} (status: ${
              originalChirp.factCheckStatus || 'N/A'
            })`
          );
          shouldProceedWithFactCheck = false;
        } else if (isStillProcessingFactCheck(originalChirp)) {
          await saveChirpProgress(chirp.id, {}, 'pending');

          console.log(
            `[ValuePipeline] Rechirp ${chirp.id} marked as pending - original ${chirp.rechirpOfId} is still processing (status: ${originalChirp.factCheckingStatus})`
          );

          const pendingChirp: Chirp = {
            ...chirp,
            factCheckingStatus: 'pending',
          };
          return pendingChirp;
        } else {
          preCheckResult = await safeExecute('pre-check (rechirp original incomplete)', () =>
            withRetry(() => preCheckChirp(originalChirp), 'pre-check')
          );
          shouldProceedWithFactCheck = preCheckResult?.needsFactCheck ?? false;

          if (shouldProceedWithFactCheck) {
            console.log(
              `[ValuePipeline] Rechirp ${chirp.id} - original ${chirp.rechirpOfId} needs fact-checking but incomplete, proceeding with rechirp`
            );
          }
        }
      } else {
        if (chirp.claims && chirp.claims.length > 0) {
          console.log(
            `[ValuePipeline] Rechirp ${chirp.id} - original ${chirp.rechirpOfId} not found but rechirp has inherited data, keeping it`
          );
          insights.claims = chirp.claims;
          insights.factChecks = chirp.factChecks;
          insights.factCheckStatus = chirp.factCheckStatus;
          shouldProceedWithFactCheck = false;
        } else {
          console.log(
            `[ValuePipeline] Rechirp ${chirp.id} - original ${chirp.rechirpOfId} not found and no inherited data, treating as new post`
          );
          preCheckResult = await safeExecute('pre-check (rechirp original not found)', () =>
            withRetry(() => preCheckChirp(chirp), 'pre-check')
          );
          shouldProceedWithFactCheck = preCheckResult?.needsFactCheck ?? false;
        }
      }
    } catch (error) {
      console.error('[ValuePipeline] Error fetching original chirp for rechirp:', error);
      if (chirp.claims && chirp.claims.length > 0) {
        console.log(
          `[ValuePipeline] Rechirp ${chirp.id} - error fetching original but has inherited data, keeping it`
        );
        insights.claims = chirp.claims;
        insights.factChecks = chirp.factChecks;
        insights.factCheckStatus = chirp.factCheckStatus;
        shouldProceedWithFactCheck = false;
      } else {
        preCheckResult = await safeExecute('pre-check (rechirp error)', () =>
          withRetry(() => preCheckChirp(chirp), 'pre-check')
        );
        shouldProceedWithFactCheck = preCheckResult?.needsFactCheck ?? false;
      }
    }
  } else {
    preCheckResult = await safeExecute('pre-check', () => withRetry(() => preCheckChirp(chirp), 'pre-check'));
    shouldProceedWithFactCheck = preCheckResult?.needsFactCheck ?? false;
  }

  logger.info('[ValuePipeline] Pre-check decision', {
    chirpId: chirp.id,
    preCheck: preCheckResult?.needsFactCheck,
    riskScore,
    shouldProceedWithFactCheck,
  });

  let claimsResult = chirp.claims;
  let quotedChirp: Chirp | null | undefined;
  let quotedClaims: Claim[] = [];
  let quotedFactChecks: FactCheck[] = [];
  let claimMatches:
    | Map<string, { originalClaim: Claim; originalFactCheck?: FactCheck; similarity: number }>
    | undefined;

  if (chirp.quotedChirpId && (!claimsResult || claimsResult.length === 0) && shouldProceedWithFactCheck) {
    try {
      quotedChirp = await chirpService.getChirp(chirp.quotedChirpId);
      if (quotedChirp) {
        if (hasCompleteFactCheckData(quotedChirp)) {
          quotedClaims = quotedChirp.claims || [];
          quotedFactChecks = quotedChirp.factChecks || [];

          console.log(
            `[ValuePipeline] Quoted post ${chirp.quotedChirpId} has complete fact-check data (${quotedClaims.length} claims, ${quotedFactChecks.length} fact-checks)`
          );

          const userClaimsResult = await safeExecute('claim extraction (user text only)', () =>
            withRetry(() => extractClaimsFromUserText(chirp), 'claim extraction')
          );

          if (userClaimsResult && userClaimsResult.length > 0) {
            claimMatches = matchClaimsToOriginal(userClaimsResult, quotedClaims, quotedFactChecks);

            claimsResult = [...userClaimsResult, ...quotedClaims];

            console.log(
              `[ValuePipeline] Matched ${claimMatches.size} user claims to original claims out of ${
                userClaimsResult.length
              } total`
            );
          } else {
            claimsResult = quotedClaims;
          }

          if (claimsResult && claimsResult.length > 0) {
            insights.claims = claimsResult;
            await saveChirpProgress(chirp.id, { claims: claimsResult }, 'in_progress');
          }
        } else if (isStillProcessingFactCheck(quotedChirp)) {
          console.log(
            `[ValuePipeline] Quoted post ${chirp.quotedChirpId} is still processing, extracting claims from both texts`
          );

          if (shouldFactCheck && shouldProceedWithFactCheck) {
            claimsResult = await safeExecute('claim extraction (quoted post processing)', () =>
              withRetry(() => extractClaimsForChirp(chirp, quotedChirp ?? undefined), 'claim extraction')
            );

            if (claimsResult && claimsResult.length > 0) {
              insights.claims = claimsResult;
              await saveChirpProgress(chirp.id, { claims: claimsResult }, 'in_progress');
            }
          }
        } else {
          console.log(
            `[ValuePipeline] Quoted post ${chirp.quotedChirpId} doesn't have complete fact-check data, extracting from both texts`
          );

          if (shouldFactCheck && shouldProceedWithFactCheck) {
            claimsResult = await safeExecute('claim extraction (quoted post incomplete)', () =>
              withRetry(() => extractClaimsForChirp(chirp, quotedChirp ?? undefined), 'claim extraction')
            );

            if (claimsResult && claimsResult.length > 0) {
              insights.claims = claimsResult;
              await saveChirpProgress(chirp.id, { claims: claimsResult }, 'in_progress');
            }
          }
        }
      }
    } catch (error) {
      console.error('[ValuePipeline] Error fetching quoted chirp:', error);
      if (shouldFactCheck && shouldProceedWithFactCheck) {
        claimsResult = await safeExecute('claim extraction (quoted chirp error)', () =>
          withRetry(() => extractClaimsFromUserText(chirp), 'claim extraction')
        );

        if (claimsResult && claimsResult.length > 0) {
          insights.claims = claimsResult;
          await saveChirpProgress(chirp.id, { claims: claimsResult }, 'in_progress');
        }
      }
    }
  } else if (!claimsResult || claimsResult.length === 0) {
    if (shouldFactCheck && shouldProceedWithFactCheck) {
      claimsResult = await safeExecute('claim extraction', () =>
        withRetry(() => extractClaimsForChirp(chirp, undefined), 'claim extraction')
      );

      if (claimsResult && claimsResult.length > 0) {
        insights.claims = claimsResult;
        await saveChirpProgress(chirp.id, { claims: claimsResult }, 'in_progress');
      }
    } else if (shouldFactCheck && !shouldProceedWithFactCheck) {
      console.log(
        `[ValuePipeline] Pre-check determined chirp ${chirp.id} does not need fact-checking (${preCheckResult?.contentType || 'unknown'})`
      );
      insights.factCheckStatus = 'clean';
      await saveChirpProgress(chirp.id, { factCheckStatus: 'clean' }, 'in_progress');
    }
  } else {
    insights.claims = claimsResult;
  }

  const claimsForScoring = (): Claim[] => insights.claims ?? chirp.claims ?? [];
  const currentClaims = claimsForScoring();
  let factChecksResult = chirp.factChecks;

  if (shouldFactCheck && shouldProceedWithFactCheck && currentClaims.length > 0) {
    if (!factChecksResult || factChecksResult.length === 0) {
      if (
        chirp.quotedChirpId &&
        quotedChirp &&
        hasCompleteFactCheckData(quotedChirp) &&
        claimMatches &&
        claimMatches.size > 0
      ) {
        const reusedFactChecks: FactCheck[] = [];
        const claimsToCheck: Claim[] = [];

        for (const claim of currentClaims) {
          const match = claimMatches.get(claim.id);
          if (match && match.originalFactCheck) {
            const reusedFactCheck: FactCheck = {
              ...match.originalFactCheck,
              id: `${claim.id}-fact-check`,
              claimId: claim.id,
            };
            reusedFactChecks.push(reusedFactCheck);
          } else {
            claimsToCheck.push(claim);
          }
        }

        console.log(
          `[ValuePipeline] Quoted post optimization: reusing ${reusedFactChecks.length} fact-checks, checking ${claimsToCheck.length} new claims`
        );

        let newFactChecks: FactCheck[] = [];
        if (claimsToCheck.length > 0) {
          newFactChecks =
            (await safeExecute('fact checking (new claims only)', () =>
              withRetry(() => factCheckClaims(chirp, claimsToCheck), 'fact checking')
            )) || [];
        }

        factChecksResult = [...reusedFactChecks, ...newFactChecks];

        if (factChecksResult && factChecksResult.length > 0) {
          insights.factChecks = factChecksResult;
          await saveChirpProgress(chirp.id, { factChecks: factChecksResult }, 'in_progress');
        }
      } else {
        factChecksResult = await safeExecute('fact checking', () =>
          withRetry(() => factCheckClaims(chirp, currentClaims), 'fact checking')
        );

        if (factChecksResult && factChecksResult.length > 0) {
          insights.factChecks = factChecksResult;
          await saveChirpProgress(chirp.id, { factChecks: factChecksResult }, 'in_progress');
        }
      }
    } else {
      insights.factChecks = factChecksResult;
    }
  } else if (!shouldFactCheck || !shouldProceedWithFactCheck) {
    if (!insights.factCheckStatus) {
      insights.factCheckStatus = 'clean';
    }
  }

  const factChecksForScoring = (): FactCheck[] => insights.factChecks ?? chirp.factChecks ?? [];

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
    await saveChirpProgress(chirp.id, { factCheckStatus: policyDecision.status }, 'in_progress');
  }

  const computedValueScore = await safeExecute('value scoring', () =>
    withRetry(() => scoreChirpValue(chirp, claimsForScoring(), factChecksForScoring(), discussion), 'value scoring')
  );

  if (!computedValueScore || Number.isNaN(computedValueScore.total)) {
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

    await saveChirpProgress(
      chirp.id,
      {
        valueScore: computedValueScore,
        valueExplanation: explanation || undefined,
        discussionQuality: insights.discussionQuality,
      },
      'in_progress'
    );
  }

  await saveChirpProgress(chirp.id, {}, 'completed');

  const updatedChirp: Chirp = {
    ...chirp,
    ...(insights.claims ? { claims: insights.claims } : {}),
    ...(insights.factChecks ? { factChecks: insights.factChecks } : {}),
    ...(insights.valueScore ? { valueScore: insights.valueScore } : {}),
    ...(insights.valueExplanation ? { valueExplanation: insights.valueExplanation } : {}),
    ...(insights.discussionQuality ? { discussionQuality: insights.discussionQuality } : {}),
    ...(insights.factCheckStatus ? { factCheckStatus: insights.factCheckStatus } : {}),
    factCheckingStatus: undefined,
    factCheckingStartedAt: undefined,
  };

  const hasCompleteData =
    (insights.claims &&
      insights.claims.length > 0 &&
      (insights.factChecks && insights.factChecks.length > 0 || insights.factCheckStatus)) ||
    insights.factCheckStatus === 'clean';

  if (!chirp.rechirpOfId && hasCompleteData) {
    syncRechirpStatusFromOriginal(chirp.id).catch((error) => {
      console.error(`[ValuePipeline] Failed to sync rechirp status from original ${chirp.id}:`, error);
    });
  }

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

  return updatedChirp;
}

export async function syncRechirpStatusFromOriginal(originalChirpId: string): Promise<void> {
  try {
    const originalChirp = await chirpService.getChirp(originalChirpId);
    if (!originalChirp) {
      console.log(`[ValuePipeline] Original chirp ${originalChirpId} not found, skipping rechirp sync`);
      return;
    }

    if (!hasCompleteFactCheckData(originalChirp)) {
      console.log(
        `[ValuePipeline] Original chirp ${originalChirpId} doesn't have complete fact-check data yet, skipping rechirp sync`
      );
      return;
    }

    const rechirps = await chirpService.getRechirpsOfOriginal(originalChirpId);
    if (rechirps.length === 0) {
      return;
    }

    console.log(`[ValuePipeline] Syncing fact-check data from original ${originalChirpId} to ${rechirps.length} rechirps`);

    const inheritedData = inheritFactCheckData(originalChirp);

    const updatePromises = rechirps.map(async (rechirp) => {
      try {
        if (rechirp.factCheckingStatus === 'pending' || !hasCompleteFactCheckData(rechirp)) {
          await saveChirpProgress(rechirp.id, inheritedData, 'in_progress');

          if (hasCompleteFactCheckData({ ...rechirp, ...inheritedData })) {
            await saveChirpProgress(rechirp.id, {}, 'completed');
          }

          console.log(
            `[ValuePipeline] Synced fact-check data to rechirp ${rechirp.id} from original ${originalChirpId}`
          );
        }
      } catch (error) {
        console.error(`[ValuePipeline] Error syncing rechirp ${rechirp.id}:`, error);
      }
    });

    await Promise.all(updatePromises);
    console.log(
      `[ValuePipeline] Completed syncing fact-check data to ${rechirps.length} rechirps from original ${originalChirpId}`
    );
  } catch (error) {
    console.error(`[ValuePipeline] Error syncing rechirp status from original ${originalChirpId}:`, error);
  }
}

export async function processPendingRechirps(limitCount: number = 50): Promise<void> {
  try {
    const pendingRechirps = await chirpService.getPendingRechirps(limitCount);

    if (pendingRechirps.length === 0) {
      return;
    }

    console.log(`[ValuePipeline] Processing ${pendingRechirps.length} pending rechirps`);

    const processPromises = pendingRechirps.map(async (rechirp) => {
      if (!rechirp.rechirpOfId) {
        return;
      }

      try {
        await processChirpValue(rechirp);
      } catch (error) {
        console.error(`[ValuePipeline] Error processing pending rechirp ${rechirp.id}:`, error);
      }
    });

    await Promise.all(processPromises);
    console.log(`[ValuePipeline] Completed processing ${pendingRechirps.length} pending rechirps`);
  } catch (error) {
    console.error('[ValuePipeline] Error processing pending rechirps:', error);
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

    await saveCommentProgress(comment.id, {}, 'in_progress');

    const safeExecute = async <T>(label: string, fn: () => Promise<T>): Promise<T | undefined> => {
      try {
        return await fn();
      } catch (error) {
        // Log authentication errors prominently
        if (isAuthenticationError(error)) {
          console.error(
            `[ValuePipeline] ⚠️ CRITICAL: ${label} failed due to authentication error - OpenAI API key is invalid or expired. Please update the OPENAI_API_KEY secret.`,
            error
          );
        } else {
          console.error(`[ValuePipeline] ${label} failed:`, error);
        }
        return undefined;
      }
    };

    const commentInsights: {
      claims?: Claim[];
      factChecks?: FactCheck[];
      factCheckStatus?: 'clean' | 'needs_review' | 'blocked';
    } = {};

    let preCheckResult: PreCheckResult | undefined;
    let shouldProceedWithFactCheck = false;

    let claimsResult = comment.claims;

    if (!claimsResult || claimsResult.length === 0) {
      preCheckResult = await safeExecute('pre-check (comment)', () =>
        withRetry(() => preCheckComment(comment), 'pre-check')
      );
      shouldProceedWithFactCheck = preCheckResult?.needsFactCheck ?? false;
    } else {
      shouldProceedWithFactCheck = true;
      commentInsights.claims = claimsResult;
    }

    if (!claimsResult || claimsResult.length === 0) {
      if (shouldProceedWithFactCheck) {
        claimsResult = await safeExecute('claim extraction (comment)', () =>
          withRetry(() => extractClaimsForComment(comment), 'claim extraction')
        );

        if (claimsResult && claimsResult.length > 0) {
          commentInsights.claims = claimsResult;
          await saveCommentProgress(comment.id, { claims: claimsResult }, 'in_progress');
        }
      } else {
        console.log(
          `[ValuePipeline] Pre-check determined comment ${comment.id} does not need fact-checking (${preCheckResult?.contentType || 'unknown'})`
        );
        commentInsights.factCheckStatus = 'clean';
        await saveCommentProgress(comment.id, { factCheckStatus: 'clean' }, 'in_progress');
      }
    }

    const claimsForScoring = (): Claim[] => commentInsights.claims ?? comment.claims ?? [];
    const currentClaims = claimsForScoring();
    let factChecksResult = comment.factChecks;

    if (shouldProceedWithFactCheck && currentClaims.length > 0) {
      if (!factChecksResult || factChecksResult.length === 0) {
        const commentAsChirp: Chirp = {
          id: comment.id,
          authorId: comment.authorId,
          text: comment.text,
          topic: chirp.topic,
          reachMode: 'forAll',
          createdAt: comment.createdAt,
          commentCount: 0,
          imageUrl: comment.imageUrl,
        };

        factChecksResult = await safeExecute('fact checking (comment)', () =>
          withRetry(() => factCheckClaims(commentAsChirp, currentClaims), 'fact checking')
        );

        if (factChecksResult && factChecksResult.length > 0) {
          commentInsights.factChecks = factChecksResult;
          await saveCommentProgress(comment.id, { factChecks: factChecksResult }, 'in_progress');
        }
      } else {
        commentInsights.factChecks = factChecksResult;
      }
    } else if (!shouldProceedWithFactCheck) {
      if (!commentInsights.factCheckStatus) {
        commentInsights.factCheckStatus = 'clean';
      }
    }

    const factChecksForScoring = (): FactCheck[] => commentInsights.factChecks ?? comment.factChecks ?? [];

    const policyDecision = evaluatePolicy(claimsForScoring(), factChecksForScoring());
    if (policyDecision.status) {
      commentInsights.factCheckStatus = policyDecision.status;
      await saveCommentProgress(comment.id, { factCheckStatus: policyDecision.status }, 'in_progress');
    }

    const comments = await commentService.getCommentsForChirp(comment.chirpId);
    const discussion = await safeExecute('discussion analysis', () =>
      withRetry(() => analyzeDiscussion(chirp, comments), 'discussion analysis')
    );

    const commentInsight = discussion?.commentInsights?.[comment.id];

    if (commentInsight) {
      await commentService
        .updateCommentAnalytics(comment.id, {
          discussionRole: commentInsight.role,
          valueContribution: commentInsight.contribution as ValueVector & { total: number },
        })
        .catch((error) => {
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
          discussionQuality: discussion?.threadQuality,
          factChecks: factChecksForScoring(),
          reason: 'comment_value_update',
        }).catch((error) => {
          console.error('[ValuePipeline] Failed to update Kurral Score for commenter:', error);
        });
      }
    }

    const allClaims = [...safeClaims(chirp), ...claimsForScoring()];
    const allFactChecks = [...safeFactChecks(chirp), ...factChecksForScoring()];

    const valueScore = await safeExecute('value scoring', () =>
      withRetry(() => scoreChirpValue(chirp, allClaims, allFactChecks, discussion), 'value scoring')
    );

    if (!valueScore) {
      console.log('[ValuePipeline] Value scoring skipped for comment processing - agent not available');
      await saveCommentProgress(comment.id, {}, 'completed');
      return {
        commentInsights: discussion?.commentInsights || {},
      };
    }

    const explanation = await safeExecute('explanation generation', () =>
      withRetry(
        () =>
          generateValueExplanation(
            chirp,
            valueScore,
            allClaims,
            allFactChecks,
            discussion?.threadQuality
          ),
        'explanation generation'
      )
    );

    const insightsToUpdate: {
      valueScore?: ValueScore;
      valueExplanation?: string;
      discussionQuality?: DiscussionQuality;
      factCheckStatus?: 'clean' | 'needs_review' | 'blocked';
    } = {};

    if (valueScore !== undefined && valueScore !== null) {
      insightsToUpdate.valueScore = valueScore;
    }
    if (explanation !== undefined && explanation !== null && typeof explanation === 'string' && explanation.trim().length > 0) {
      insightsToUpdate.valueExplanation = explanation;
    }
    if (discussion?.threadQuality !== undefined && discussion.threadQuality !== null) {
      insightsToUpdate.discussionQuality = discussion.threadQuality;
    }
    if (policyDecision?.status !== undefined && policyDecision.status !== null) {
      insightsToUpdate.factCheckStatus = policyDecision.status;
    }

    if (Object.keys(insightsToUpdate).length > 0) {
      await safeExecute('updating chirp insights', () =>
        withRetry(() => chirpService.updateChirpInsights(chirp.id, insightsToUpdate), 'updating chirp insights')
      );
    }

    await updateKurralScore({
      userId: chirp.authorId,
      valueScore,
      policyDecision,
      discussionQuality: discussion?.threadQuality,
      factChecks: allFactChecks,
      reason: 'post_comment_update',
    }).catch((error) => {
      console.error('[ValuePipeline] Failed to refresh Kurral Score for chirp author:', error);
    });

    await saveCommentProgress(comment.id, {}, 'completed');

    return {
      commentInsights: discussion?.commentInsights || {},
      updatedChirp: {
        ...chirp,
        valueScore,
        valueExplanation: explanation,
        discussionQuality: discussion?.threadQuality,
        factCheckStatus: policyDecision.status,
      },
    };
  } catch (error) {
    console.error('[ValuePipeline] Failed to process comment:', error);
    await saveCommentProgress(comment.id, {}, 'failed').catch((err) => {
      console.error('[ValuePipeline] Failed to mark comment as failed:', err);
    });
    return {};
  }
}
