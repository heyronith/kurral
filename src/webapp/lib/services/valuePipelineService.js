import { chirpService, commentService } from '../firestore';
import { extractClaimsForChirp, extractClaimsForComment } from './claimExtractionAgent';
import { factCheckClaims } from './factCheckAgent';
import { analyzeDiscussion } from './discussionQualityAgent';
import { scoreChirpValue } from './valueScoringAgent';
import { generateValueExplanation } from './explainerAgent';
import { evaluatePolicy } from './policyEngine';
import { recordPostValue, recordCommentValue } from './reputationService';
import { updateKurralScore } from './kurralScoreService';
import { preCheckChirp, preCheckComment } from './factCheckPreCheckAgent';
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
// Helper to save comment progress
async function saveCommentProgress(commentId, partialInsights, status) {
    const updates = { ...partialInsights };
    if (status === 'completed') {
        // Clear tracking fields after completion
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
    await commentService.updateCommentAnalytics(commentId, updates);
}
/**
 * Check if original chirp has complete fact-check data that can be inherited
 */
function hasCompleteFactCheckData(chirp) {
    // Original is considered complete if:
    // 1. factCheckingStatus is 'completed' (processing finished), OR
    // 2. factCheckStatus exists (has final status: 'clean' | 'needs_review' | 'blocked'), OR
    // 3. Has claims AND (has factChecks OR factCheckStatus) - has meaningful fact-check results
    const isCompleted = chirp.factCheckingStatus === 'completed';
    const hasFinalStatus = !!chirp.factCheckStatus;
    const hasFactCheckResults = !!(chirp.claims && chirp.claims.length > 0) &&
        (!!(chirp.factChecks && chirp.factChecks.length > 0) || hasFinalStatus);
    return isCompleted || hasFinalStatus || hasFactCheckResults;
}
/**
 * Check if original chirp is still processing fact-checking
 */
function isStillProcessingFactCheck(chirp) {
    return chirp.factCheckingStatus === 'pending' || chirp.factCheckingStatus === 'in_progress';
}
/**
 * Inherit fact-check data from original chirp to rechirp
 */
function inheritFactCheckData(originalChirp) {
    const inherited = {};
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
/**
 * Calculate text similarity between two strings using a simple word-based approach
 * Returns a similarity score between 0 and 1
 */
function calculateTextSimilarity(text1, text2) {
    const normalize = (text) => {
        return text.toLowerCase().trim().replace(/[^\w\s]/g, ' ');
    };
    const normalized1 = normalize(text1);
    const normalized2 = normalize(text2);
    // Exact match
    if (normalized1 === normalized2) {
        return 1.0;
    }
    // Word-based similarity (Jaccard similarity)
    const words1 = new Set(normalized1.split(/\s+/).filter(w => w.length > 0));
    const words2 = new Set(normalized2.split(/\s+/).filter(w => w.length > 0));
    if (words1.size === 0 || words2.size === 0) {
        return 0;
    }
    const intersection = new Set([...words1].filter(w => words2.has(w)));
    const union = new Set([...words1, ...words2]);
    return intersection.size / union.size;
}
/**
 * Match extracted claims to original claims by text similarity
 * Returns a map of new claim ID -> { originalClaim, originalFactCheck, similarity }
 */
function matchClaimsToOriginal(extractedClaims, originalClaims, originalFactChecks) {
    const matches = new Map();
    // Create a map of original claim ID -> fact check
    const factCheckMap = new Map();
    for (const factCheck of originalFactChecks) {
        factCheckMap.set(factCheck.claimId, factCheck);
    }
    // For each extracted claim, find the best matching original claim
    for (const extractedClaim of extractedClaims) {
        let bestMatch = null;
        let bestSimilarity = 0.7; // Minimum similarity threshold
        for (const originalClaim of originalClaims) {
            const similarity = calculateTextSimilarity(extractedClaim.text, originalClaim.text);
            if (similarity > bestSimilarity && (!bestMatch || similarity > bestMatch.similarity)) {
                const originalFactCheck = factCheckMap.get(originalClaim.id);
                bestMatch = {
                    originalClaim,
                    originalFactCheck,
                    similarity
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
/**
 * Extract claims from user's new text only (excluding quoted post)
 */
async function extractClaimsFromUserText(chirp) {
    // Create a copy of chirp without quoted content for claim extraction
    const userChirp = {
        ...chirp,
        quotedChirpId: undefined, // Remove quoted reference
    };
    return extractClaimsForChirp(userChirp, undefined);
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
    // 2. Pre-Check Gate: Determine if fact-checking is needed
    let preCheckResult;
    let shouldProceedWithFactCheck = false;
    // Handle rechirps: Check if original post exists and has fact-check data
    if (chirp.rechirpOfId) {
        try {
            const originalChirp = await chirpService.getChirp(chirp.rechirpOfId);
            if (originalChirp) {
                // Check if original has complete fact-check data that can be inherited
                if (hasCompleteFactCheckData(originalChirp)) {
                    // Original has complete fact-check data - inherit it
                    const inheritedData = inheritFactCheckData(originalChirp);
                    insights.claims = inheritedData.claims;
                    insights.factChecks = inheritedData.factChecks;
                    insights.factCheckStatus = inheritedData.factCheckStatus;
                    // Save inherited data
                    await saveChirpProgress(chirp.id, inheritedData, 'in_progress');
                    console.log(`[ValuePipeline] Rechirp ${chirp.id} inherited fact-check data from original ${chirp.rechirpOfId} (status: ${originalChirp.factCheckStatus || 'N/A'})`);
                    // Skip pre-check and claim extraction for rechirps with inherited data
                    shouldProceedWithFactCheck = false;
                }
                else if (isStillProcessingFactCheck(originalChirp)) {
                    // Original is still processing fact-checking
                    // Mark rechirp as pending and skip processing - will inherit when original completes
                    await saveChirpProgress(chirp.id, {}, 'pending');
                    console.log(`[ValuePipeline] Rechirp ${chirp.id} marked as pending - original ${chirp.rechirpOfId} is still processing (status: ${originalChirp.factCheckingStatus})`);
                    // Return early - rechirp will be processed later when original completes
                    // Note: In production, you'd want a mechanism to retry/reprocess pending rechirps
                    // For now, we return the chirp as-is with pending status
                    const pendingChirp = {
                        ...chirp,
                        factCheckingStatus: 'pending',
                    };
                    return pendingChirp;
                }
                else {
                    // Original doesn't have fact-check data yet (or failed)
                    // Check if original needs fact-checking based on its content
                    preCheckResult = await safeExecute('pre-check (rechirp original incomplete)', () => withRetry(() => preCheckChirp(originalChirp), 'pre-check'));
                    shouldProceedWithFactCheck = preCheckResult?.needsFactCheck ?? false;
                    // If original needs fact-checking but doesn't have it, we should wait for it
                    // OR proceed with fact-checking on rechirp (since text is identical)
                    // For now, we proceed with rechirp processing since text is the same
                    if (shouldProceedWithFactCheck) {
                        console.log(`[ValuePipeline] Rechirp ${chirp.id} - original ${chirp.rechirpOfId} needs fact-checking but incomplete, proceeding with rechirp`);
                    }
                }
            }
            else {
                // Original not found - this could mean:
                // 1. Original was deleted
                // 2. Original doesn't exist (data inconsistency)
                // Strategy: If rechirp already has inherited data, keep it. Otherwise, pre-check rechirp.
                if (chirp.claims && chirp.claims.length > 0) {
                    // Rechirp already has inherited data - keep it and mark as completed
                    console.log(`[ValuePipeline] Rechirp ${chirp.id} - original ${chirp.rechirpOfId} not found but rechirp has inherited data, keeping it`);
                    insights.claims = chirp.claims;
                    insights.factChecks = chirp.factChecks;
                    insights.factCheckStatus = chirp.factCheckStatus;
                    shouldProceedWithFactCheck = false;
                }
                else {
                    // No inherited data - treat rechirp as new post
                    console.log(`[ValuePipeline] Rechirp ${chirp.id} - original ${chirp.rechirpOfId} not found and no inherited data, treating as new post`);
                    preCheckResult = await safeExecute('pre-check (rechirp original not found)', () => withRetry(() => preCheckChirp(chirp), 'pre-check'));
                    shouldProceedWithFactCheck = preCheckResult?.needsFactCheck ?? false;
                }
            }
        }
        catch (error) {
            console.error('[ValuePipeline] Error fetching original chirp for rechirp:', error);
            // Fallback: If rechirp has inherited data, keep it. Otherwise, pre-check rechirp.
            if (chirp.claims && chirp.claims.length > 0) {
                console.log(`[ValuePipeline] Rechirp ${chirp.id} - error fetching original but has inherited data, keeping it`);
                insights.claims = chirp.claims;
                insights.factChecks = chirp.factChecks;
                insights.factCheckStatus = chirp.factCheckStatus;
                shouldProceedWithFactCheck = false;
            }
            else {
                // Pre-check the rechirp itself as fallback
                preCheckResult = await safeExecute('pre-check (rechirp error)', () => withRetry(() => preCheckChirp(chirp), 'pre-check'));
                shouldProceedWithFactCheck = preCheckResult?.needsFactCheck ?? false;
            }
        }
    }
    else {
        // Not a rechirp, run pre-check on this chirp
        preCheckResult = await safeExecute('pre-check', () => withRetry(() => preCheckChirp(chirp), 'pre-check'));
        shouldProceedWithFactCheck = preCheckResult?.needsFactCheck ?? false;
    }
    // 3. Claims Extraction (only if pre-check says we need fact-checking OR if we already have claims)
    let claimsResult = chirp.claims;
    let quotedChirp;
    let quotedClaims = [];
    let quotedFactChecks = [];
    let claimMatches;
    // Handle quoted posts: check if original has fact-check data and optimize accordingly
    if (chirp.quotedChirpId && (!claimsResult || claimsResult.length === 0) && shouldProceedWithFactCheck) {
        try {
            quotedChirp = await chirpService.getChirp(chirp.quotedChirpId);
            if (quotedChirp) {
                // Check if quoted chirp has complete fact-check data
                if (hasCompleteFactCheckData(quotedChirp)) {
                    // Original has complete fact-check data - we can reuse it
                    quotedClaims = quotedChirp.claims || [];
                    quotedFactChecks = quotedChirp.factChecks || [];
                    console.log(`[ValuePipeline] Quoted post ${chirp.quotedChirpId} has complete fact-check data (${quotedClaims.length} claims, ${quotedFactChecks.length} fact-checks)`);
                    // Extract claims from user's NEW text only (excluding quoted content)
                    const userClaimsResult = await safeExecute('claim extraction (user text only)', () => withRetry(() => extractClaimsFromUserText(chirp), 'claim extraction'));
                    if (userClaimsResult && userClaimsResult.length > 0) {
                        // Match user's claims to original's claims to see if we can reuse fact-checks
                        claimMatches = matchClaimsToOriginal(userClaimsResult, quotedClaims, quotedFactChecks);
                        // Combine all claims (user's new claims + quoted post's claims for reference)
                        claimsResult = [...userClaimsResult, ...quotedClaims];
                        console.log(`[ValuePipeline] Matched ${claimMatches.size} user claims to original claims out of ${userClaimsResult.length} total`);
                    }
                    else {
                        // No new claims from user, just use quoted post's claims
                        claimsResult = quotedClaims;
                    }
                    if (claimsResult && claimsResult.length > 0) {
                        insights.claims = claimsResult;
                        await saveChirpProgress(chirp.id, { claims: claimsResult }, 'in_progress');
                    }
                }
                else if (isStillProcessingFactCheck(quotedChirp)) {
                    // Quoted chirp is still processing - extract claims from both texts for now
                    // We'll fact-check everything, but could optimize later when original completes
                    console.log(`[ValuePipeline] Quoted post ${chirp.quotedChirpId} is still processing, extracting claims from both texts`);
                    if (shouldFactCheck && shouldProceedWithFactCheck) {
                        claimsResult = await safeExecute('claim extraction (quoted post processing)', () => withRetry(() => extractClaimsForChirp(chirp, quotedChirp ?? undefined), 'claim extraction'));
                        if (claimsResult && claimsResult.length > 0) {
                            insights.claims = claimsResult;
                            await saveChirpProgress(chirp.id, { claims: claimsResult }, 'in_progress');
                        }
                    }
                }
                else {
                    // Quoted chirp doesn't have complete fact-check data - extract from both texts
                    console.log(`[ValuePipeline] Quoted post ${chirp.quotedChirpId} doesn't have complete fact-check data, extracting from both texts`);
                    if (shouldFactCheck && shouldProceedWithFactCheck) {
                        claimsResult = await safeExecute('claim extraction (quoted post incomplete)', () => withRetry(() => extractClaimsForChirp(chirp, quotedChirp ?? undefined), 'claim extraction'));
                        if (claimsResult && claimsResult.length > 0) {
                            insights.claims = claimsResult;
                            await saveChirpProgress(chirp.id, { claims: claimsResult }, 'in_progress');
                        }
                    }
                }
            }
        }
        catch (error) {
            console.error('[ValuePipeline] Error fetching quoted chirp:', error);
            // Fallback: extract claims from user's text only
            if (shouldFactCheck && shouldProceedWithFactCheck) {
                claimsResult = await safeExecute('claim extraction (quoted chirp error)', () => withRetry(() => extractClaimsFromUserText(chirp), 'claim extraction'));
                if (claimsResult && claimsResult.length > 0) {
                    insights.claims = claimsResult;
                    await saveChirpProgress(chirp.id, { claims: claimsResult }, 'in_progress');
                }
            }
        }
    }
    else if (!claimsResult || claimsResult.length === 0) {
        // Not a quoted post or already processed - normal flow
        // Only extract claims if pre-check says we need fact-checking AND shouldFactCheck is true
        if (shouldFactCheck && shouldProceedWithFactCheck) {
            claimsResult = await safeExecute('claim extraction', () => withRetry(() => extractClaimsForChirp(chirp, undefined), 'claim extraction'));
            if (claimsResult && claimsResult.length > 0) {
                insights.claims = claimsResult;
                // CHECKPOINT: Save claims
                await saveChirpProgress(chirp.id, { claims: claimsResult }, 'in_progress');
            }
        }
        else if (shouldFactCheck && !shouldProceedWithFactCheck) {
            // Pre-check said no fact-checking needed
            console.log(`[ValuePipeline] Pre-check determined chirp ${chirp.id} does not need fact-checking (${preCheckResult?.contentType || 'unknown'})`);
            insights.factCheckStatus = 'clean';
            await saveChirpProgress(chirp.id, { factCheckStatus: 'clean' }, 'in_progress');
        }
    }
    else {
        insights.claims = claimsResult;
    }
    const claimsForScoring = () => insights.claims ?? chirp.claims ?? [];
    const currentClaims = claimsForScoring();
    let factChecksResult = chirp.factChecks;
    // 4. Fact-Checking (only if we have claims AND pre-check said we need fact-checking)
    if (shouldFactCheck && shouldProceedWithFactCheck && currentClaims.length > 0) {
        // Only run if we don't have fact checks matching current claims
        if (!factChecksResult || factChecksResult.length === 0) {
            // For quoted posts with matched claims, reuse original fact-checks and only check new claims
            if (chirp.quotedChirpId && quotedChirp && hasCompleteFactCheckData(quotedChirp) && claimMatches && claimMatches.size > 0) {
                // We have matches - reuse original fact-checks for matched claims, only fact-check unmatched ones
                const reusedFactChecks = [];
                const claimsToCheck = [];
                // Separate matched and unmatched claims
                for (const claim of currentClaims) {
                    const match = claimMatches.get(claim.id);
                    if (match && match.originalFactCheck) {
                        // Reuse original fact-check, but update the claimId to point to new claim's ID
                        const reusedFactCheck = {
                            ...match.originalFactCheck,
                            id: `${claim.id}-fact-check`,
                            claimId: claim.id, // Update to point to new claim
                        };
                        reusedFactChecks.push(reusedFactCheck);
                    }
                    else {
                        // No match or no fact-check available - need to fact-check this claim
                        claimsToCheck.push(claim);
                    }
                }
                console.log(`[ValuePipeline] Quoted post optimization: reusing ${reusedFactChecks.length} fact-checks, checking ${claimsToCheck.length} new claims`);
                // Fact-check only the unmatched/new claims
                let newFactChecks = [];
                if (claimsToCheck.length > 0) {
                    newFactChecks = await safeExecute('fact checking (new claims only)', () => withRetry(() => factCheckClaims(chirp, claimsToCheck), 'fact checking')) || [];
                }
                // Combine reused and new fact-checks
                factChecksResult = [...reusedFactChecks, ...newFactChecks];
                if (factChecksResult && factChecksResult.length > 0) {
                    insights.factChecks = factChecksResult;
                    // CHECKPOINT: Save fact checks
                    await saveChirpProgress(chirp.id, { factChecks: factChecksResult }, 'in_progress');
                }
            }
            else {
                // Normal flow: fact-check all claims
                factChecksResult = await safeExecute('fact checking', () => withRetry(() => factCheckClaims(chirp, currentClaims), 'fact checking'));
                if (factChecksResult && factChecksResult.length > 0) {
                    insights.factChecks = factChecksResult;
                    // CHECKPOINT: Save fact checks
                    await saveChirpProgress(chirp.id, { factChecks: factChecksResult }, 'in_progress');
                }
            }
        }
        else {
            insights.factChecks = factChecksResult;
        }
    }
    else if (!shouldFactCheck || !shouldProceedWithFactCheck) {
        // Either explicitly skipped or pre-check said no
        if (!insights.factCheckStatus) {
            insights.factCheckStatus = 'clean';
        }
    }
    const factChecksForScoring = () => insights.factChecks ?? chirp.factChecks ?? [];
    // 5. Discussion Analysis
    const comments = await safeExecute('comment loading', () => commentService.getCommentsForChirp(chirp.id));
    if (comments) {
        discussion = await safeExecute('discussion analysis', () => withRetry(() => analyzeDiscussion(chirp, comments), 'discussion analysis'));
        if (discussion?.threadQuality) {
            insights.discussionQuality = discussion.threadQuality;
        }
    }
    // 6. Policy Evaluation
    const policyDecision = evaluatePolicy(claimsForScoring(), factChecksForScoring());
    if (policyDecision.status) {
        insights.factCheckStatus = policyDecision.status;
        // CHECKPOINT: Save status
        await saveChirpProgress(chirp.id, { factCheckStatus: policyDecision.status }, 'in_progress');
    }
    // 7. Value Scoring
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
    // 8. Final Save & Completion (Clears tracking fields)
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
    // 9. If this chirp has rechirps, sync fact-check status to them (async, don't wait)
    // Only sync if this is NOT a rechirp itself and we have complete fact-check data
    // Check insights for complete data since updatedChirp has tracking fields cleared
    const hasCompleteData = (insights.claims && insights.claims.length > 0 &&
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
/**
 * Sync fact-check status from original chirp to all its rechirps
 * This should be called when an original chirp's fact-check status changes
 */
export async function syncRechirpStatusFromOriginal(originalChirpId) {
    try {
        // Get the original chirp
        const originalChirp = await chirpService.getChirp(originalChirpId);
        if (!originalChirp) {
            console.log(`[ValuePipeline] Original chirp ${originalChirpId} not found, skipping rechirp sync`);
            return;
        }
        // Check if original has complete fact-check data
        if (!hasCompleteFactCheckData(originalChirp)) {
            console.log(`[ValuePipeline] Original chirp ${originalChirpId} doesn't have complete fact-check data yet, skipping rechirp sync`);
            return;
        }
        // Get all rechirps of this original
        const rechirps = await chirpService.getRechirpsOfOriginal(originalChirpId);
        if (rechirps.length === 0) {
            return; // No rechirps to update
        }
        console.log(`[ValuePipeline] Syncing fact-check data from original ${originalChirpId} to ${rechirps.length} rechirps`);
        // Inherit fact-check data for each rechirp
        const inheritedData = inheritFactCheckData(originalChirp);
        // Update each rechirp with inherited data
        const updatePromises = rechirps.map(async (rechirp) => {
            try {
                // Only update rechirps that are pending or don't have complete data yet
                if (rechirp.factCheckingStatus === 'pending' || !hasCompleteFactCheckData(rechirp)) {
                    await saveChirpProgress(rechirp.id, inheritedData, 'in_progress');
                    // Mark as completed if we have complete data
                    if (hasCompleteFactCheckData({ ...rechirp, ...inheritedData })) {
                        await saveChirpProgress(rechirp.id, {}, 'completed');
                    }
                    console.log(`[ValuePipeline] Synced fact-check data to rechirp ${rechirp.id} from original ${originalChirpId}`);
                }
            }
            catch (error) {
                console.error(`[ValuePipeline] Error syncing rechirp ${rechirp.id}:`, error);
            }
        });
        await Promise.all(updatePromises);
        console.log(`[ValuePipeline] Completed syncing fact-check data to ${rechirps.length} rechirps from original ${originalChirpId}`);
    }
    catch (error) {
        console.error(`[ValuePipeline] Error syncing rechirp status from original ${originalChirpId}:`, error);
    }
}
/**
 * Process pending rechirps that were waiting for their original to complete
 * This can be called periodically or after original completes processing
 */
export async function processPendingRechirps(limitCount = 50) {
    try {
        const pendingRechirps = await chirpService.getPendingRechirps(limitCount);
        if (pendingRechirps.length === 0) {
            return;
        }
        console.log(`[ValuePipeline] Processing ${pendingRechirps.length} pending rechirps`);
        // Process each pending rechirp
        const processPromises = pendingRechirps.map(async (rechirp) => {
            if (!rechirp.rechirpOfId) {
                return; // Should not happen, but guard anyway
            }
            try {
                // Re-run processChirpValue which will check if original is now complete
                await processChirpValue(rechirp);
            }
            catch (error) {
                console.error(`[ValuePipeline] Error processing pending rechirp ${rechirp.id}:`, error);
            }
        });
        await Promise.all(processPromises);
        console.log(`[ValuePipeline] Completed processing ${pendingRechirps.length} pending rechirps`);
    }
    catch (error) {
        console.error('[ValuePipeline] Error processing pending rechirps:', error);
    }
}
export async function processCommentValue(comment) {
    try {
        const chirp = await chirpService.getChirp(comment.chirpId);
        if (!chirp) {
            return {};
        }
        // 1. Mark comment as in-progress immediately
        await saveCommentProgress(comment.id, {}, 'in_progress');
        const safeExecute = async (label, fn) => {
            try {
                return await fn();
            }
            catch (error) {
                console.error(`[ValuePipeline] ${label} failed:`, error);
                return undefined;
            }
        };
        const commentInsights = {};
        // 2. Pre-Check Gate: Determine if fact-checking is needed
        let preCheckResult;
        let shouldProceedWithFactCheck = false;
        // Check if we already have claims from a previous run (resume capability)
        let claimsResult = comment.claims;
        if (!claimsResult || claimsResult.length === 0) {
            // Run pre-check to determine if fact-checking is needed
            preCheckResult = await safeExecute('pre-check (comment)', () => withRetry(() => preCheckComment(comment), 'pre-check'));
            shouldProceedWithFactCheck = preCheckResult?.needsFactCheck ?? false;
        }
        else {
            // We have existing claims, so fact-checking was needed before
            shouldProceedWithFactCheck = true;
            commentInsights.claims = claimsResult;
        }
        // 3. Claims Extraction (only if pre-check says we need fact-checking)
        if (!claimsResult || claimsResult.length === 0) {
            if (shouldProceedWithFactCheck) {
                claimsResult = await safeExecute('claim extraction (comment)', () => withRetry(() => extractClaimsForComment(comment), 'claim extraction'));
                if (claimsResult && claimsResult.length > 0) {
                    commentInsights.claims = claimsResult;
                    // CHECKPOINT: Save claims
                    await saveCommentProgress(comment.id, { claims: claimsResult }, 'in_progress');
                }
            }
            else {
                // Pre-check said no fact-checking needed
                console.log(`[ValuePipeline] Pre-check determined comment ${comment.id} does not need fact-checking (${preCheckResult?.contentType || 'unknown'})`);
                commentInsights.factCheckStatus = 'clean';
                await saveCommentProgress(comment.id, { factCheckStatus: 'clean' }, 'in_progress');
            }
        }
        const claimsForScoring = () => commentInsights.claims ?? comment.claims ?? [];
        const currentClaims = claimsForScoring();
        let factChecksResult = comment.factChecks;
        // 4. Fact-Checking (only if we have claims AND pre-check said we need fact-checking)
        if (shouldProceedWithFactCheck && currentClaims.length > 0) {
            // Only run if we don't have fact checks matching current claims
            if (!factChecksResult || factChecksResult.length === 0) {
                // Create a minimal chirp-like object for fact-checking (which expects a Chirp)
                const commentAsChirp = {
                    id: comment.id,
                    authorId: comment.authorId,
                    text: comment.text,
                    topic: chirp.topic, // Use parent chirp's topic
                    reachMode: 'forAll',
                    createdAt: comment.createdAt,
                    commentCount: 0,
                    imageUrl: comment.imageUrl,
                };
                factChecksResult = await safeExecute('fact checking (comment)', () => withRetry(() => factCheckClaims(commentAsChirp, currentClaims), 'fact checking'));
                if (factChecksResult && factChecksResult.length > 0) {
                    commentInsights.factChecks = factChecksResult;
                    // CHECKPOINT: Save fact checks
                    await saveCommentProgress(comment.id, { factChecks: factChecksResult }, 'in_progress');
                }
            }
            else {
                commentInsights.factChecks = factChecksResult;
            }
        }
        else if (!shouldProceedWithFactCheck) {
            // Pre-check said no, ensure status is clean
            if (!commentInsights.factCheckStatus) {
                commentInsights.factCheckStatus = 'clean';
            }
        }
        const factChecksForScoring = () => commentInsights.factChecks ?? comment.factChecks ?? [];
        // 5. Policy Evaluation
        const policyDecision = evaluatePolicy(claimsForScoring(), factChecksForScoring());
        if (policyDecision.status) {
            commentInsights.factCheckStatus = policyDecision.status;
            // CHECKPOINT: Save status
            await saveCommentProgress(comment.id, { factCheckStatus: policyDecision.status }, 'in_progress');
        }
        // 6. Discussion Analysis
        const comments = await commentService.getCommentsForChirp(comment.chirpId);
        const discussion = await safeExecute('discussion analysis', () => withRetry(() => analyzeDiscussion(chirp, comments), 'discussion analysis'));
        const commentInsight = discussion?.commentInsights?.[comment.id];
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
                    factChecks: factChecksForScoring(), // Include comment's fact-checks in reputation calculation
                    reason: 'comment_value_update',
                }).catch((error) => {
                    console.error('[ValuePipeline] Failed to update Kurral Score for commenter:', error);
                });
            }
        }
        // 7. Value Scoring (for parent chirp, considering comment's claims/fact-checks)
        // Combine parent chirp's claims and fact-checks with comment's for scoring
        const allClaims = [...safeClaims(chirp), ...claimsForScoring()];
        const allFactChecks = [...safeFactChecks(chirp), ...factChecksForScoring()];
        const valueScore = await safeExecute('value scoring', () => withRetry(() => scoreChirpValue(chirp, allClaims, allFactChecks, discussion), 'value scoring'));
        // If value scoring is not available (agent unavailable), skip the rest
        if (!valueScore) {
            console.log('[ValuePipeline] Value scoring skipped for comment processing - agent not available');
            // Mark comment as completed even if value scoring failed
            await saveCommentProgress(comment.id, {}, 'completed');
            return {
                commentInsights: discussion?.commentInsights || {},
            };
        }
        const explanation = await safeExecute('explanation generation', () => withRetry(() => generateValueExplanation(chirp, valueScore, allClaims, allFactChecks, discussion?.threadQuality), 'explanation generation'));
        // Build insights object for parent chirp update
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
        // Use policy decision from combined claims/fact-checks
        if (policyDecision?.status !== undefined && policyDecision.status !== null) {
            insightsToUpdate.factCheckStatus = policyDecision.status;
        }
        if (Object.keys(insightsToUpdate).length > 0) {
            await safeExecute('updating chirp insights', () => withRetry(() => chirpService.updateChirpInsights(chirp.id, insightsToUpdate), 'updating chirp insights'));
        }
        await updateKurralScore({
            userId: chirp.authorId,
            valueScore,
            policyDecision,
            discussionQuality: discussion?.threadQuality,
            factChecks: allFactChecks, // Include comment fact-checks in parent chirp author's score
            reason: 'post_comment_update',
        }).catch((error) => {
            console.error('[ValuePipeline] Failed to refresh Kurral Score for chirp author:', error);
        });
        // 8. Final Save & Completion (Clears tracking fields)
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
    }
    catch (error) {
        console.error('[ValuePipeline] Failed to process comment:', error);
        // Mark as failed
        await saveCommentProgress(comment.id, {}, 'failed').catch((err) => {
            console.error('[ValuePipeline] Failed to mark comment as failed:', err);
        });
        return {};
    }
}
