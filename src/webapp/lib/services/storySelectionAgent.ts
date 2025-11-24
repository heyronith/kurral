import type { StoryCluster } from './storyDiscoveryAgent';
import type { TrendingNews } from '../../types';

export type StorySelectionResult = {
  selectedStory: StoryCluster | null;
  alternativeStories: StoryCluster[];
  reason: string;
};

const STORY_DUPLICATE_WINDOW_MS = 3 * 60 * 60 * 1000; // 3 hours

const clampScore = (value: number | undefined, fallback = 0.5): number => {
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback;
  return Math.max(0, Math.min(1, value));
};

export function selectBestStory(
  stories: StoryCluster[],
  existingNews: TrendingNews[],
  userId: string | null
): StorySelectionResult {
  if (stories.length === 0) {
    return { selectedStory: null, alternativeStories: [], reason: 'No stories discovered' };
  }

  const now = Date.now();
  const existingSignatures = new Map<string, TrendingNews>();

  existingNews.forEach((news) => {
    const signature = news.storySignature;
    if (!signature) return;
    const isRecent =
      now - news.lastUpdated.getTime() < STORY_DUPLICATE_WINDOW_MS &&
      (userId ? news.userId === userId : true);
    if (isRecent) {
      existingSignatures.set(signature, news);
    }
  });

  const scoredStories = stories
    .map((story) => {
      // base on newsworthiness + confidence + engagement (proxy using number of posts)
      const newsworthiness = clampScore(story.newsworthinessScore, 0.5);
      const confidence = clampScore(story.confidence, 0.7);
      const engagementBonus = Math.min(1, story.postIds.length / 15);
      const diversityBonus = story.topics.length > 1 ? 0.05 : 0;

      let duplicatePenalty = 0;
      if (story.storyId && existingSignatures.has(story.storyId)) {
        duplicatePenalty = 0.5;
      }

      const score =
        newsworthiness * 0.5 +
        confidence * 0.25 +
        engagementBonus * 0.2 +
        diversityBonus -
        duplicatePenalty;

      return { story, score };
    })
    .sort((a, b) => b.score - a.score);

  if (scoredStories.length === 0) {
    return { selectedStory: null, alternativeStories: [], reason: 'No eligible stories' };
  }

  const bestStory = scoredStories[0].story;
  const alternatives = scoredStories.slice(1).map((entry) => entry.story);
  const reason = `Highest combined score (${scoredStories[0].score.toFixed(
    2
  )}) based on newsworthiness, confidence, and engagement`;

  return {
    selectedStory: bestStory,
    alternativeStories: alternatives,
    reason,
  };
}

