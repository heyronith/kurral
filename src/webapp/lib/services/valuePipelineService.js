import { chirpService, commentService } from '../firestore';
import { extractClaimsForChirp } from './claimExtractionAgent';
import { factCheckClaims } from './factCheckAgent';
import { analyzeDiscussion } from './discussionQualityAgent';
import { scoreChirpValue } from './valueScoringAgent';
import { generateValueExplanation } from './explainerAgent';
import { evaluatePolicy } from './policyEngine';
import { recordPostValue, recordCommentValue } from './reputationService';
import { updateKurralScore } from './kurralScoreService';
const DELTA_THRESHOLD = 0.01;
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second
const safeClaims = (chirp) => chirp.claims || [];
const safeFactChecks = (chirp) => chirp.factChecks || [];
const valueVectorToScore = (value) => {
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
async function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
async function withRetry(fn, operation, retries = MAX_RETRIES) {
    let lastError = null;
    let delay = INITIAL_RETRY_DELAY;
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await fn();
        }
        catch (error) {
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
// Helper to save progress
async function saveChirpProgress(chirpId, partialInsights, status) {
    const updates = { ...partialInsights };
    if (status === 'completed') {
        // CLEAR tracking fields after completion as requested
        updates.factCheckingStatus = null;
        updates.factCheckingStartedAt = null;
    }
    else {
        updates.factCheckingStatus = status;
        if (status === 'in_progress') {
            // Update timestamp to indicate activity
            updates.factCheckingStartedAt = new Date();
        }
    }
    await chirpService.updateChirpInsights(chirpId, updates);
}
export async function processChirpValue(chirp, options) {
    // 1. Mark as in-progress immediately
    await saveChirpProgress(chirp.id, {}, 'in_progress');
    const insights = {};
    let discussion;
    let latestValueScore;
    const shouldFactCheck = !options?.skipFactCheck;
    const safeExecute = async (label, fn) => {
        try {
            return await fn();
        }
        catch (error) {
            console.error(`[ValuePipeline] ${label} failed:`, error);
            return undefined;
        }
    };
    // 2. Claims Extraction
    // Check if we already have claims from a previous run (resume capability)
    let claimsResult = chirp.claims;
    if (!claimsResult || claimsResult.length === 0) {
        claimsResult = await safeExecute('claim extraction', () => withRetry(() => extractClaimsForChirp(chirp), 'claim extraction'));
        if (claimsResult && claimsResult.length > 0) {
            insights.claims = claimsResult;
            // CHECKPOINT: Save claims
            await saveChirpProgress(chirp.id, { claims: claimsResult }, 'in_progress');
        }
    }
    else {
        insights.claims = claimsResult;
    }
    const claimsForScoring = () => insights.claims ?? chirp.claims ?? [];
    const currentClaims = claimsForScoring();
    let factChecksResult = chirp.factChecks;
    if (shouldFactCheck && currentClaims.length > 0) {
        // Only run if we don't have fact checks matching current claims
        if (!factChecksResult || factChecksResult.length === 0) {
            factChecksResult = await safeExecute('fact checking', () => withRetry(() => factCheckClaims(chirp, currentClaims), 'fact checking'));
            if (factChecksResult && factChecksResult.length > 0) {
                insights.factChecks = factChecksResult;
                // CHECKPOINT: Save fact checks
                await saveChirpProgress(chirp.id, { factChecks: factChecksResult }, 'in_progress');
            }
        }
        else {
            insights.factChecks = factChecksResult;
        }
    }
    else if (!shouldFactCheck) {
        insights.factCheckStatus = insights.factCheckStatus ?? 'clean';
    }
    const factChecksForScoring = () => insights.factChecks ?? chirp.factChecks ?? [];
    // 4. Discussion Analysis
    const comments = await safeExecute('comment loading', () => commentService.getCommentsForChirp(chirp.id));
    if (comments) {
        discussion = await safeExecute('discussion analysis', () => withRetry(() => analyzeDiscussion(chirp, comments), 'discussion analysis'));
        if (discussion?.threadQuality) {
            insights.discussionQuality = discussion.threadQuality;
        }
    }
    // 5. Policy Evaluation
    const policyDecision = evaluatePolicy(claimsForScoring(), factChecksForScoring());
    if (policyDecision.status) {
        insights.factCheckStatus = policyDecision.status;
        // CHECKPOINT: Save status
        await saveChirpProgress(chirp.id, { factCheckStatus: policyDecision.status }, 'in_progress');
    }
    // 6. Value Scoring
    const computedValueScore = await safeExecute('value scoring', () => withRetry(() => scoreChirpValue(chirp, claimsForScoring(), factChecksForScoring(), discussion), 'value scoring'));
    if (!computedValueScore) {
        console.log('[ValuePipeline] Value scoring skipped - agent not available');
    }
    else {
        latestValueScore = computedValueScore;
        insights.valueScore = computedValueScore;
        const explanation = await safeExecute('explanation generation', () => withRetry(() => generateValueExplanation(chirp, computedValueScore, claimsForScoring(), factChecksForScoring(), discussion?.threadQuality), 'explanation generation'));
        if (explanation && explanation.trim().length > 0) {
            insights.valueExplanation = explanation;
        }
        // CHECKPOINT: Save score and explanation
        await saveChirpProgress(chirp.id, {
            valueScore: computedValueScore,
            valueExplanation: explanation || undefined,
            discussionQuality: insights.discussionQuality
        }, 'in_progress');
    }
    // 7. Final Save & Completion (Clears tracking fields)
    await saveChirpProgress(chirp.id, {}, 'completed');
    const updatedChirp = {
        ...chirp,
        ...(insights.claims ? { claims: insights.claims } : {}),
        ...(insights.factChecks ? { factChecks: insights.factChecks } : {}),
        ...(insights.valueScore ? { valueScore: insights.valueScore } : {}),
        ...(insights.valueExplanation ? { valueExplanation: insights.valueExplanation } : {}),
        ...(insights.discussionQuality ? { discussionQuality: insights.discussionQuality } : {}),
        ...(insights.factCheckStatus ? { factCheckStatus: insights.factCheckStatus } : {}),
        // Clear tracking fields in returned object
        factCheckingStatus: undefined,
        factCheckingStartedAt: undefined
    };
    if (latestValueScore) {
        if (!chirp.valueScore) {
            await recordPostValue(updatedChirp, latestValueScore, claimsForScoring()).catch((error) => {
                console.error('[ValuePipeline] Failed to record post value:', error);
            });
        }
        else {
            const delta = latestValueScore.total - chirp.valueScore.total;
            if (delta > DELTA_THRESHOLD) {
                await recordPostValue(updatedChirp, {
                    ...latestValueScore,
                    total: delta,
                }, claimsForScoring()).catch((error) => {
                    console.error('[ValuePipeline] Failed to record post value delta:', error);
                });
            }
            else {
                await recordPostValue(updatedChirp, latestValueScore, claimsForScoring()).catch((error) => {
                    if (!error.message?.includes('permission')) {
                        console.error('[ValuePipeline] Failed to record post value:', error);
                    }
                });
            }
        }
    }
    const shouldUpdateKurral = Boolean(latestValueScore) ||
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
export async function processCommentValue(comment) {
    try {
        const chirp = await chirpService.getChirp(comment.chirpId);
        if (!chirp) {
            return {};
        }
        const comments = await commentService.getCommentsForChirp(comment.chirpId);
        const discussion = await withRetry(() => analyzeDiscussion(chirp, comments), 'discussion analysis');
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
        const valueScore = await withRetry(() => scoreChirpValue(chirp, safeClaims(chirp), safeFactChecks(chirp), discussion), 'value scoring');
        // If value scoring is not available (agent unavailable), skip the rest
        if (!valueScore) {
            console.log('[ValuePipeline] Value scoring skipped for comment processing - agent not available');
            return {
                commentInsights: discussion.commentInsights,
            };
        }
        const explanation = await withRetry(() => generateValueExplanation(chirp, valueScore, safeClaims(chirp), safeFactChecks(chirp), discussion.threadQuality), 'explanation generation');
        const policyDecision = evaluatePolicy(safeClaims(chirp), safeFactChecks(chirp));
        // Build insights object, only including defined values
        const insightsToUpdate = {};
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
            await withRetry(() => chirpService.updateChirpInsights(chirp.id, insightsToUpdate), 'updating chirp insights');
        }
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
    }
    catch (error) {
        console.error('[ValuePipeline] Failed to process comment:', error);
        return {};
    }
}
