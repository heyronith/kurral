import { DEFAULT_FOR_YOU_CONFIG } from '../types';
import { cosineSimilarity } from './utils/similarity';
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DEFAULT_TIE_THRESHOLD = 2;
const TIE_PERCENTAGE = 0.05;
const AUTHOR_TOP_WINDOW_COUNT = 20;
const AUTHOR_TOP_WINDOW_LIMIT = 3;
const AUTHOR_TOTAL_LIMIT = 5;
const MAX_TIME_WINDOW_DAYS = 30;
const clamp01 = (value) => Math.max(0, Math.min(1, value));
const clampTimeWindowDays = (value) => {
    if (typeof value !== 'number' || Number.isNaN(value)) {
        return DEFAULT_FOR_YOU_CONFIG.timeWindowDays ?? 7;
    }
    const floored = Math.max(1, Math.floor(value));
    return Math.min(floored, MAX_TIME_WINDOW_DAYS);
};
const buildWindowSequence = (baseDays) => {
    const windows = [];
    const pushWindow = (days) => {
        const clamped = clampTimeWindowDays(days);
        if (!windows.includes(clamped)) {
            windows.push(clamped);
        }
    };
    [0, 3, 7, 14, 21, 28].forEach((increment) => pushWindow(baseDays + increment));
    pushWindow(MAX_TIME_WINDOW_DAYS);
    return windows;
};
const getSimilarityThreshold = (config) => {
    return config.semanticSimilarityThreshold ?? DEFAULT_FOR_YOU_CONFIG.semanticSimilarityThreshold ?? 0.7;
};
const normalizeTopicValue = (value) => {
    return value ? value.toLowerCase().trim() : '';
};
const topicsOverlap = (topicA, topicB) => {
    return (topicA === topicB ||
        topicA.includes(topicB) ||
        topicB.includes(topicA));
};
const findMatchingTopic = (chirp, topics) => {
    if (!topics || topics.length === 0) {
        return undefined;
    }
    const normalizedChirpTopic = normalizeTopicValue(chirp.topic);
    const normalizedSemanticTopics = chirp.semanticTopics
        ? chirp.semanticTopics.map((topic) => normalizeTopicValue(topic)).filter(Boolean)
        : [];
    for (const configTopic of topics) {
        const normalizedConfig = normalizeTopicValue(configTopic);
        if (!normalizedConfig) {
            continue;
        }
        if (normalizedChirpTopic && normalizedChirpTopic === normalizedConfig) {
            return configTopic;
        }
        for (const semanticTopic of normalizedSemanticTopics) {
            if (topicsOverlap(semanticTopic, normalizedConfig)) {
                return configTopic;
            }
        }
    }
    return undefined;
};
const matchesTopic = (chirp, topics) => {
    return Boolean(findMatchingTopic(chirp, topics));
};
const sortByScoreThenRecency = (a, b) => {
    const scoreDiff = Math.abs(a.score - b.score);
    const maxScore = Math.max(Math.abs(a.score), Math.abs(b.score));
    const threshold = Math.max(DEFAULT_TIE_THRESHOLD, maxScore * TIE_PERCENTAGE);
    if (scoreDiff < threshold) {
        return b.chirp.createdAt.getTime() - a.chirp.createdAt.getTime();
    }
    return b.score - a.score;
};
const applyDiversityLimits = (scoredChirps, limit) => {
    if (scoredChirps.length === 0) {
        return [];
    }
    const results = [];
    const authorCounters = new Map();
    for (const scored of scoredChirps) {
        if (results.length >= limit) {
            break;
        }
        const authorId = scored.chirp.authorId;
        const currentCount = authorCounters.get(authorId) || 0;
        const maxPerAuthor = results.length < AUTHOR_TOP_WINDOW_COUNT
            ? AUTHOR_TOP_WINDOW_LIMIT
            : AUTHOR_TOTAL_LIMIT;
        if (currentCount >= maxPerAuthor) {
            continue;
        }
        results.push(scored);
        authorCounters.set(authorId, currentCount + 1);
    }
    return results;
};
/**
 * Check if a chirp is eligible to be shown to the viewer
 */
export const isChirpEligibleForViewer = (chirp, viewer, config, options) => {
    // Exclude viewer's own posts
    if (viewer.id === chirp.authorId) {
        return false;
    }
    // Check muted topics (legacy topic field and semantic topics)
    if (!options?.ignoreMuted && matchesTopic(chirp, config.mutedTopics)) {
        return false;
    }
    // Check reach settings
    if (chirp.reachMode === 'forAll') {
        return true;
    }
    // Tuned mode - check audience settings
    if (chirp.reachMode === 'tuned') {
        if (!chirp.tunedAudience) {
            console.warn(`[ForYouFeed] Chirp ${chirp.id} uses tuned reach without audience settings`);
            return false;
        }
        const isFollowing = viewer.following.includes(chirp.authorId);
        // Check if followers are allowed and viewer is following
        if (chirp.tunedAudience.allowFollowers && isFollowing) {
            return true;
        }
        // Check if non-followers are allowed and viewer is not following
        if (chirp.tunedAudience.allowNonFollowers && !isFollowing) {
            return true;
        }
        const similarityThreshold = getSimilarityThreshold(config);
        if (chirp.tunedAudience.targetAudienceEmbedding && viewer.profileEmbedding) {
            const similarity = cosineSimilarity(chirp.tunedAudience.targetAudienceEmbedding, viewer.profileEmbedding);
            if (similarity >= similarityThreshold) {
                return true;
            }
        }
        const similarityHint = chirp.tunedAudience.targetAudienceEmbedding && viewer.profileEmbedding
            ? 'profile summary mismatch'
            : 'audience explicitly hides this viewer';
        console.warn(`[ForYouFeed] Chirp ${chirp.id} tuned audience ${similarityHint}`);
        return false;
    }
    return true;
};
/**
 * Score a chirp for the viewer based on algorithm
 */
export const scoreChirpForViewer = (chirp, viewer, config, allChirps, getAuthor) => {
    let score = 0;
    const reasons = [];
    const isFollowing = viewer.following.includes(chirp.authorId);
    const author = getAuthor(chirp.authorId);
    // Following weight (4 levels: none, light, medium, heavy)
    if (isFollowing) {
        const weightMap = {
            none: 0,
            light: 10,
            medium: 30,
            heavy: 50,
        };
        const followingScore = weightMap[config.followingWeight];
        score += followingScore;
        if (followingScore > 0 && author) {
            reasons.push(`you follow @${author.handle}`);
        }
    }
    const viewerInterests = viewer.interests || [];
    if (viewerInterests.length > 0 && chirp.semanticTopics && chirp.semanticTopics.length > 0) {
        const semanticMatches = chirp.semanticTopics.filter((topic) => viewerInterests.some((interest) => {
            const normalizedInterest = interest.toLowerCase();
            const normalizedTopic = topic.toLowerCase();
            return (normalizedInterest.includes(normalizedTopic) ||
                normalizedTopic.includes(normalizedInterest));
        }));
        if (semanticMatches.length > 0) {
            const interestScore = 30 + Math.min(semanticMatches.length * 5, 25);
            score += interestScore;
            reasons.push(`matches your interest "${semanticMatches[0]}"`);
        }
    }
    // Profile summary matching (enhanced personalization)
    if (viewer.profileEmbedding && chirp.tunedAudience?.targetAudienceEmbedding) {
        const similarity = cosineSimilarity(chirp.tunedAudience.targetAudienceEmbedding, viewer.profileEmbedding);
        if (similarity > 0) {
            const similarityBoost = Math.min(35, Math.round(similarity * 35));
            score += similarityBoost;
            reasons.push(`aligns with your profile (${Math.round(similarity * 100)}% similarity)`);
        }
    }
    // Topic preferences (legacy topic field and semantic topics)
    const matchedLikedTopic = findMatchingTopic(chirp, config.likedTopics);
    if (matchedLikedTopic) {
        score += 25;
        reasons.push(`topic #${matchedLikedTopic} you like`);
    }
    if (matchesTopic(chirp, config.mutedTopics)) {
        score -= 100; // Heavy penalty, but should be filtered out by eligibility anyway
    }
    // Active conversations boost
    if (config.boostActiveConversations && chirp.commentCount > 0) {
        // Boost based on comment count (logarithmic scale)
        const commentBoost = Math.min(20, Math.log10(chirp.commentCount + 1) * 5);
        score += commentBoost;
        if (commentBoost > 5) {
            reasons.push('active conversation');
        }
    }
    // Recency decay (newer = higher score)
    const hoursAgo = (Date.now() - chirp.createdAt.getTime()) / (1000 * 60 * 60);
    const recencyScore = Math.max(0, 15 - hoursAgo * 0.5); // Decay over 30 hours
    score += recencyScore;
    // Value score integration (quality-aware boost/penalty)
    if (chirp.valueScore) {
        const valueTotal = clamp01(chirp.valueScore.total);
        const confidence = clamp01(chirp.valueScore.confidence ?? 0);
        const qualityBoost = valueTotal * 40 * Math.max(0.5, confidence);
        score += qualityBoost;
        if (valueTotal >= 0.7) {
            reasons.push('high value content');
        }
        else if (valueTotal < 0.35) {
            const lowPenalty = (0.35 - valueTotal) * 30;
            score -= lowPenalty;
            reasons.push('low value content');
        }
    }
    // Fact-check status penalties (keeps in sync with value scoring signals)
    if (chirp.factCheckStatus === 'blocked') {
        score -= 50;
        reasons.push('blocked by fact-check');
    }
    else if (chirp.factCheckStatus === 'needs_review') {
        score -= 20;
        reasons.push('fact-check needs review');
    }
    // Generate explanation
    let explanation = 'Because: ';
    if (reasons.length > 0) {
        explanation += reasons.join(' + ');
    }
    else {
        explanation += 'recent post';
    }
    return {
        chirp,
        score,
        explanation,
    };
};
/**
 * Generate For You feed with scoring and explanations
 */
export const generateForYouFeed = (allChirps, viewer, config, getAuthor, limit = 50) => {
    if (!viewer) {
        return [];
    }
    // Exclude viewer's own posts
    const otherChirps = allChirps.filter((chirp) => chirp.authorId !== viewer.id);
    const baseWindowDays = clampTimeWindowDays(config.timeWindowDays ?? DEFAULT_FOR_YOU_CONFIG.timeWindowDays);
    const windowSequence = buildWindowSequence(baseWindowDays);
    const attemptFeed = (days, ignoreMuted = false) => {
        const cutoff = Date.now() - days * MS_PER_DAY;
        const recent = otherChirps.filter((chirp) => chirp.createdAt.getTime() > cutoff);
        const eligible = recent.filter((chirp) => isChirpEligibleForViewer(chirp, viewer, config, ignoreMuted ? { ignoreMuted: true } : undefined));
        if (eligible.length === 0) {
            return [];
        }
        const scored = eligible
            .map((chirp) => scoreChirpForViewer(chirp, viewer, config, allChirps, getAuthor))
            .sort(sortByScoreThenRecency);
        return applyDiversityLimits(scored, limit);
    };
    for (const days of windowSequence) {
        const scored = attemptFeed(days);
        if (scored.length > 0) {
            return scored;
        }
        const relaxed = attemptFeed(days, true);
        if (relaxed.length > 0) {
            return relaxed;
        }
    }
    const fallback = otherChirps
        .slice()
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .map((chirp) => ({
        chirp,
        score: 0,
        explanation: 'Recent post (fallback)',
    }));
    return applyDiversityLimits(fallback, limit);
};
