import type { Chirp, User, ForYouConfig } from '../../types';
import { cosineSimilarity } from './similarity';

const getSimilarityThreshold = (config: ForYouConfig): number => {
  return config.semanticSimilarityThreshold ?? 0.7;
};

const normalizeTopicValue = (value?: string): string => {
  return value ? value.toLowerCase().trim() : '';
};

const topicsOverlap = (topicA: string, topicB: string): boolean => {
  return (
    topicA === topicB ||
    topicA.includes(topicB) ||
    topicB.includes(topicA)
  );
};

const findMatchingTopic = (chirp: Chirp, topics: string[]): string | undefined => {
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

const matchesTopic = (chirp: Chirp, topics: string[]): boolean => {
  return Boolean(findMatchingTopic(chirp, topics));
};

/**
 * Check if a chirp is eligible to be shown in Most Valued feed based on reach settings.
 * Unlike isChirpEligibleForViewer, this allows the viewer's own posts to be shown.
 * 
 * @param chirp - The chirp to check
 * @param viewer - The user viewing the feed
 * @param config - The ForYouConfig for muted topics and similarity threshold
 * @param options - Optional settings (ignoreMuted)
 * @returns true if the chirp should be shown
 */
export const isChirpEligibleForMostValued = (
  chirp: Chirp,
  viewer: User | null | undefined,
  config: ForYouConfig,
  options?: { ignoreMuted?: boolean }
): boolean => {
  // If no viewer, only show posts with 'forAll' reach
  if (!viewer) {
    return chirp.reachMode === 'forAll';
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
      console.warn(`[MostValued] Chirp ${chirp.id} uses tuned reach without audience settings`);
      return false;
    }

    // Always show own posts in Most Valued (unlike ForYouFeed)
    if (viewer.id === chirp.authorId) {
      return true;
    }

    const isFollowing = viewer.following?.includes(chirp.authorId) ?? false;

    // Check if followers are allowed and viewer is following
    if (chirp.tunedAudience.allowFollowers && isFollowing) {
      return true;
    }

    // Check if non-followers are allowed and viewer is not following
    if (chirp.tunedAudience.allowNonFollowers && !isFollowing) {
      return true;
    }

    // Check semantic similarity if embeddings are available
    const similarityThreshold = getSimilarityThreshold(config);
    if (chirp.tunedAudience.targetAudienceEmbedding && viewer.profileEmbedding) {
      const similarity = cosineSimilarity(
        chirp.tunedAudience.targetAudienceEmbedding,
        viewer.profileEmbedding
      );
      if (similarity >= similarityThreshold) {
        return true;
      }
    }

    // Post is not eligible for this viewer
    return false;
  }

  return true;
};

/**
 * Filter chirps for Most Valued feed based on reach eligibility and fact-check status
 */
export const filterChirpsForMostValued = (
  chirps: Chirp[],
  viewer: User | null | undefined,
  config: ForYouConfig,
  options?: { ignoreMuted?: boolean }
): Chirp[] => {
  return chirps.filter((chirp) => {
    // First check fact-check status (blocked posts)
    if (chirp.factCheckStatus === 'blocked') {
      // Only show blocked posts to the author
      if (viewer?.id === chirp.authorId) {
        return true;
      }
      return false;
    }

    // Then check reach eligibility
    return isChirpEligibleForMostValued(chirp, viewer, config, options);
  });
};
