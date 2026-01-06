// Topic store for managing topic metadata and engagement data
import { create } from 'zustand';
import type { TopicMetadata } from '../types';
import { topicService } from '../services/topicService';

interface TopicState {
  topEngagedTopics: TopicMetadata[];
  trendingTopics: TopicMetadata[];
  allTopics: TopicMetadata[];
  selectedTopic: string | null;
  lastUpdated: Date | null;
  trendingLastUpdated: Date | null;
  isLoading: boolean;
  isLoadingTrending: boolean;
  loadTopEngagedTopics: (limit?: number) => Promise<void>;
  loadTrendingTopics: (limit?: number) => Promise<void>;
  loadTopicsForUser: (userTopics: string[]) => Promise<TopicMetadata[]>;
  refreshEngagement: () => Promise<void>;
  selectTopic: (topicName: string | null) => void;
  clearTopicSelection: () => void;
  isStale: () => boolean;
  isTrendingStale: () => boolean;
}

// Stale threshold: 4 hours for top engaged, 1 hour for trending
const STALE_THRESHOLD = 4 * 60 * 60 * 1000;
const TRENDING_STALE_THRESHOLD = 60 * 60 * 1000; // 1 hour for trending topics

export const useTopicStore = create<TopicState>((set, get) => ({
  topEngagedTopics: [],
  trendingTopics: [],
  allTopics: [],
  selectedTopic: null,
  lastUpdated: null,
  trendingLastUpdated: null,
  isLoading: false,
  isLoadingTrending: false,

  loadTopEngagedTopics: async (limit: number = 30) => {
    const state = get();
    
    // Check if data is fresh enough
    if (!state.isStale() && state.topEngagedTopics.length > 0) {
      return; // Use cached data
    }

    set({ isLoading: true });

    try {
      const topics = await topicService.getTopEngagedTopics(limit);
      set({
        topEngagedTopics: topics,
        allTopics: topics,
        lastUpdated: new Date(),
        isLoading: false,
      });
    } catch (error) {
      console.error('Error loading top engaged topics:', error);
      set({ isLoading: false });
    }
  },

  loadTrendingTopics: async (limit: number = 10) => {
    const state = get();
    
    // Check if trending data is fresh enough
    if (!state.isTrendingStale() && state.trendingTopics.length > 0) {
      return; // Use cached data
    }

    set({ isLoadingTrending: true });

    try {
      const topics = await topicService.getTrendingTopics(limit);
      set({
        trendingTopics: topics,
        trendingLastUpdated: new Date(),
        isLoadingTrending: false,
      });
    } catch (error) {
      console.error('Error loading trending topics:', error);
      set({ isLoadingTrending: false });
    }
  },

  loadTopicsForUser: async (userTopics: string[]) => {
    try {
      const topics = await topicService.getTopicsForUser(userTopics);
      
      // Update store with combined topics
      set({
        allTopics: topics,
        lastUpdated: new Date(),
      });
      
      return topics;
    } catch (error) {
      console.error('Error loading topics for user:', error);
      // Fallback to top engaged topics
      const topTopics = get().topEngagedTopics;
      if (topTopics.length === 0) {
        await get().loadTopEngagedTopics(30);
        return get().topEngagedTopics;
      }
      return topTopics;
    }
  },

  refreshEngagement: async () => {
    set({ isLoading: true, isLoadingTrending: true });
    
    try {
      // Note: topicService.refreshTopicEngagement doesn't exist in mobile yet
      // This would need to be implemented if needed
      
      // Reload both top topics and trending topics after refresh
      await Promise.all([
        get().loadTopEngagedTopics(30),
        get().loadTrendingTopics(10),
      ]);
    } catch (error) {
      console.error('Error refreshing topic engagement:', error);
      set({ isLoading: false, isLoadingTrending: false });
    }
  },

  isStale: () => {
    const state = get();
    if (!state.lastUpdated) return true;
    
    const now = new Date();
    const age = now.getTime() - state.lastUpdated.getTime();
    return age > STALE_THRESHOLD;
  },

  isTrendingStale: () => {
    const state = get();
    if (!state.trendingLastUpdated) return true;
    
    const now = new Date();
    const age = now.getTime() - state.trendingLastUpdated.getTime();
    return age > TRENDING_STALE_THRESHOLD;
  },

  selectTopic: (topicName: string | null) => {
    set({ selectedTopic: topicName });
  },

  clearTopicSelection: () => {
    set({ selectedTopic: null });
  },
}));

