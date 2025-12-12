// Core Data Types
// Legacy topic buckets (fixed set)
export const LEGACY_TOPICS = [
    'dev',
    'startups',
    'music',
    'sports',
    'productivity',
    'design',
    'politics',
    'crypto',
];
export const DEFAULT_FOR_YOU_CONFIG = {
    followingWeight: 'medium',
    boostActiveConversations: true,
    likedTopics: [],
    mutedTopics: [],
    timeWindowDays: 7,
    semanticSimilarityThreshold: 0.7,
};
export const ALL_TOPICS = [...LEGACY_TOPICS];
// Helpers to validate topic values
export const isLegacyTopic = (value) => {
    if (!value)
        return false;
    return LEGACY_TOPICS.includes(value);
};
export const isValidTopic = (value) => {
    if (!value)
        return false;
    const normalized = value.trim().toLowerCase();
    if (isLegacyTopic(normalized))
        return true;
    // Allow dynamic buckets: lowercase, alphanumeric + hyphen, 2-50 chars
    return /^[a-z0-9-]{2,50}$/.test(normalized);
};
