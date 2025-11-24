// Topic store for managing topic metadata and engagement data
import { create } from 'zustand';
import { topicService } from '../lib/firestore';
// Stale threshold: 4 hours for top engaged, 1 hour for trending
const STALE_THRESHOLD = 4 * 60 * 60 * 1000;
const TRENDING_STALE_THRESHOLD = 60 * 60 * 1000; // 1 hour for trending topics
const REFRESH_INTERVAL = 60 * 60 * 1000; // Refresh every hour
export const useTopicStore = create((set, get) => ({
    topEngagedTopics: [],
    trendingTopics: [],
    allTopics: [],
    selectedTopic: null,
    lastUpdated: null,
    trendingLastUpdated: null,
    isLoading: false,
    isLoadingTrending: false,
    loadTopEngagedTopics: async (limit = 30) => {
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
        }
        catch (error) {
            console.error('Error loading top engaged topics:', error);
            set({ isLoading: false });
        }
    },
    loadTrendingTopics: async (limit = 10) => {
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
        }
        catch (error) {
            console.error('Error loading trending topics:', error);
            set({ isLoadingTrending: false });
        }
    },
    loadTopicsForUser: async (userTopics) => {
        try {
            const topics = await topicService.getTopicsForUser(userTopics);
            // Update store with combined topics
            set({
                allTopics: topics,
                lastUpdated: new Date(),
            });
            return topics;
        }
        catch (error) {
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
            await topicService.refreshTopicEngagement();
            // Reload both top topics and trending topics after refresh
            await Promise.all([
                get().loadTopEngagedTopics(30),
                get().loadTrendingTopics(10),
            ]);
        }
        catch (error) {
            console.error('Error refreshing topic engagement:', error);
            set({ isLoading: false, isLoadingTrending: false });
        }
    },
    isStale: () => {
        const state = get();
        if (!state.lastUpdated)
            return true;
        const now = new Date();
        const age = now.getTime() - state.lastUpdated.getTime();
        return age > STALE_THRESHOLD;
    },
    isTrendingStale: () => {
        const state = get();
        if (!state.trendingLastUpdated)
            return true;
        const now = new Date();
        const age = now.getTime() - state.trendingLastUpdated.getTime();
        return age > TRENDING_STALE_THRESHOLD;
    },
    selectTopic: (topicName) => {
        set({ selectedTopic: topicName });
    },
    clearTopicSelection: () => {
        set({ selectedTopic: null });
    },
    // Start scheduled refresh for trending topics
    // Returns cleanup function to stop the interval
    startScheduledRefresh: () => {
        const refresh = async () => {
            const state = get();
            // Only refresh if data is stale or if we're actively using the app
            if (state.isTrendingStale() || state.trendingTopics.length === 0) {
                try {
                    // Refresh engagement metrics first, then reload trending topics
                    await topicService.refreshTopicEngagement();
                    await state.loadTrendingTopics(10);
                    // Also refresh top engaged topics periodically
                    if (state.isStale()) {
                        await state.loadTopEngagedTopics(30);
                    }
                }
                catch (error) {
                    console.error('[TopicStore] Error in scheduled refresh:', error);
                }
            }
        };
        // Run immediately on start
        refresh();
        // Then run every hour
        const intervalId = setInterval(refresh, REFRESH_INTERVAL);
        // Return cleanup function
        return () => {
            clearInterval(intervalId);
        };
    },
}));
