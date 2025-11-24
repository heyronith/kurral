/**
 * Check if a chirp is eligible to be shown to the viewer
 */
export const isChirpEligibleForViewer = (chirp, viewer, config) => {
    // Check muted topics
    if (config.mutedTopics.includes(chirp.topic)) {
        return false;
    }
    // Check reach settings
    if (chirp.reachMode === 'forAll') {
        return true;
    }
    // Tuned mode - check audience settings
    if (chirp.reachMode === 'tuned' && chirp.tunedAudience) {
        const isFollowing = viewer.following.includes(chirp.authorId);
        const isSelf = viewer.id === chirp.authorId;
        // If it's the viewer's own chirp, always show
        if (isSelf)
            return true;
        // Check if followers are allowed and viewer is following
        if (chirp.tunedAudience.allowFollowers && isFollowing) {
            return true;
        }
        // Check if non-followers are allowed and viewer is not following
        if (chirp.tunedAudience.allowNonFollowers && !isFollowing) {
            return true;
        }
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
    const isSelf = viewer.id === chirp.authorId;
    const author = getAuthor(chirp.authorId);
    // Following weight (4 levels: none, light, medium, heavy)
    if (isFollowing || isSelf) {
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
    // Topic preferences
    if (config.likedTopics.includes(chirp.topic)) {
        score += 25;
        reasons.push(`topic #${chirp.topic} you like`);
    }
    if (config.mutedTopics.includes(chirp.topic)) {
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
    // Get recent chirps (last 7 days)
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recentChirps = allChirps.filter((chirp) => chirp.createdAt.getTime() > sevenDaysAgo);
    // Filter by eligibility
    const eligibleChirps = recentChirps.filter((chirp) => isChirpEligibleForViewer(chirp, viewer, config));
    // Score all eligible chirps
    const scoredChirps = eligibleChirps.map((chirp) => scoreChirpForViewer(chirp, viewer, config, allChirps, getAuthor));
    // Sort by score DESC, then createdAt DESC
    scoredChirps.sort((a, b) => {
        if (Math.abs(a.score - b.score) < 0.1) {
            // If scores are very close, sort by recency
            return b.chirp.createdAt.getTime() - a.chirp.createdAt.getTime();
        }
        return b.score - a.score;
    });
    // Return top N
    return scoredChirps.slice(0, limit);
};
