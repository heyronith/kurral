import { doc, Timestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { userService } from '../firestore';
const SCORE_WEIGHTS = {
    quality: 0.4,
    violations: 0.25,
    engagement: 0.15,
    consistency: 0.1,
    trust: 0.1,
};
const START_SCORE = 65;
const MIN_SCORE = 0;
const MAX_SCORE = 100;
const SCORE_RANGE = MAX_SCORE - MIN_SCORE;
const HISTORY_LIMIT = 20;
const clampScore = (value) => Math.max(MIN_SCORE, Math.min(MAX_SCORE, value));
const getQualityScore = (valueScore) => {
    if (!valueScore) {
        return 0.5; // Neutral baseline
    }
    const weighted = (valueScore.epistemic ?? 0.5) * 0.3 +
        (valueScore.insight ?? 0.5) * 0.2 +
        (valueScore.practical ?? 0.5) * 0.2 +
        (valueScore.relational ?? 0.5) * 0.2 +
        (valueScore.effort ?? 0.5) * 0.1;
    return Math.max(0, Math.min(1, weighted));
};
const getViolationPenalty = (policyDecision, factChecks) => {
    let penalty = 0;
    if (policyDecision?.status === 'blocked') {
        penalty += 1; // Max penalty
    }
    else if (policyDecision?.status === 'needs_review') {
        penalty += 0.4;
    }
    if (factChecks && factChecks.length > 0) {
        const falseClaims = factChecks.filter((check) => check.verdict === 'false' && check.confidence > 0.7).length;
        if (falseClaims > 0) {
            penalty += Math.min(1, falseClaims * 0.25);
        }
    }
    return Math.max(0, Math.min(1, penalty));
};
const getEngagementScore = (discussion) => {
    if (!discussion) {
        return 0.4;
    }
    const avg = ((discussion.informativeness ?? 0) +
        (discussion.reasoningDepth ?? 0) +
        (discussion.crossPerspective ?? 0) +
        (discussion.civility ?? 0)) /
        4;
    return Math.max(0, Math.min(1, avg));
};
const getConsistencyScore = (totalValue) => {
    // Normalize assuming 5 value points per 30d is solid consistency
    const normalized = Math.min(1, totalValue / 5);
    return Math.max(0, normalized);
};
const getTrustScore = (policyDecision, hasRecentViolations) => {
    if (policyDecision?.status === 'blocked') {
        return 0;
    }
    if (hasRecentViolations) {
        return 0.3;
    }
    if (policyDecision?.status === 'needs_review') {
        return 0.6;
    }
    return 1; // Clean default
};
const serializeHistory = (entries) => {
    return entries.map((entry) => ({
        score: entry.score,
        delta: entry.delta,
        reason: entry.reason,
        date: Timestamp.fromDate(entry.date),
    }));
};
export async function updateKurralScore(context) {
    const user = await userService.getUser(context.userId);
    if (!user) {
        return;
    }
    const valueStats = user.valueStats;
    const totalRollingValue = (valueStats?.postValue30d ?? 0) + (valueStats?.commentValue30d ?? 0);
    const previousScore = user.kurralScore?.score ?? START_SCORE;
    const previousComponents = user.kurralScore?.components;
    const qualityScore = context.valueScore !== undefined
        ? getQualityScore(context.valueScore)
        : (previousComponents?.qualityHistory ?? 50) / 100;
    const violationPenalty = getViolationPenalty(context.policyDecision, context.factChecks);
    const engagementScore = context.discussionQuality !== undefined
        ? getEngagementScore(context.discussionQuality)
        : (previousComponents?.engagementQuality ?? 40) / 100;
    const consistencyScore = getConsistencyScore(totalRollingValue);
    const trustScore = getTrustScore(context.policyDecision, violationPenalty > 0.4);
    const positivePoints = qualityScore * SCORE_WEIGHTS.quality +
        engagementScore * SCORE_WEIGHTS.engagement +
        consistencyScore * SCORE_WEIGHTS.consistency +
        trustScore * SCORE_WEIGHTS.trust;
    const penaltyPoints = violationPenalty * SCORE_WEIGHTS.violations;
    const netScore = positivePoints - penaltyPoints;
    const normalizedScore = Math.max(-0.25, Math.min(0.75, netScore));
    const scaledScore = ((normalizedScore + 0.25) / 1) * SCORE_RANGE;
    const nextScore = clampScore(Math.round(scaledScore));
    const delta = nextScore - previousScore;
    const components = {
        qualityHistory: Math.round(qualityScore * 100),
        violationHistory: Math.round(violationPenalty * 100),
        engagementQuality: Math.round(engagementScore * 100),
        consistency: Math.round(consistencyScore * 100),
        communityTrust: Math.round(trustScore * 100),
    };
    const newEntry = {
        score: nextScore,
        delta,
        reason: context.reason || 'score_update',
        date: new Date(),
    };
    const existingHistory = user.kurralScore?.history ?? [];
    const combinedHistory = [newEntry, ...existingHistory]
        .slice(0, HISTORY_LIMIT)
        .map((entry) => ({
        score: entry.score,
        delta: entry.delta,
        reason: entry.reason,
        date: entry.date,
    }));
    await updateDoc(doc(db, 'users', context.userId), {
        kurralScore: {
            score: nextScore,
            lastUpdated: Timestamp.now(),
            components,
            history: serializeHistory(combinedHistory),
        },
    });
}
/**
 * Initialize kurralScore for a user who doesn't have it yet
 * This is called for existing users who were created before kurralScore was implemented
 */
export async function initializeKurralScore(userId) {
    const user = await userService.getUser(userId);
    if (!user) {
        return;
    }
    // If user already has kurralScore, don't reinitialize
    if (user.kurralScore) {
        return;
    }
    // Initialize with default starting score
    const valueStats = user.valueStats;
    const totalRollingValue = (valueStats?.postValue30d ?? 0) + (valueStats?.commentValue30d ?? 0);
    const qualityScore = 0.5; // Neutral baseline
    const violationPenalty = 0; // No violations yet
    const engagementScore = 0.4; // Default engagement
    const consistencyScore = getConsistencyScore(totalRollingValue);
    const trustScore = 1; // Clean default
    const positivePoints = qualityScore * SCORE_WEIGHTS.quality +
        engagementScore * SCORE_WEIGHTS.engagement +
        consistencyScore * SCORE_WEIGHTS.consistency +
        trustScore * SCORE_WEIGHTS.trust;
    const penaltyPoints = violationPenalty * SCORE_WEIGHTS.violations;
    const netScore = positivePoints - penaltyPoints;
    const normalizedScore = Math.max(-0.25, Math.min(0.75, netScore));
    const scaledScore = ((normalizedScore + 0.25) / 1) * SCORE_RANGE;
    const initialScore = clampScore(Math.round(scaledScore));
    const components = {
        qualityHistory: Math.round(qualityScore * 100),
        violationHistory: Math.round(violationPenalty * 100),
        engagementQuality: Math.round(engagementScore * 100),
        consistency: Math.round(consistencyScore * 100),
        communityTrust: Math.round(trustScore * 100),
    };
    await updateDoc(doc(db, 'users', userId), {
        kurralScore: {
            score: initialScore,
            lastUpdated: Timestamp.now(),
            components,
            history: [],
        },
    });
    console.log(`[KurralScore] Initialized kurralScore for user ${userId} with score ${initialScore}`);
}
