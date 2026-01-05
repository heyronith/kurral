import { create } from 'zustand';
import type { Chirp, FeedType, ForYouConfig } from '../types';
import { DEFAULT_FOR_YOU_CONFIG } from '../types';
import { chirpService } from '../services/chirpService';
import { topicService } from '../services/topicService';
import { processChirpValue } from '../services/valuePipelineService';

type FeedState = {
  activeFeed: FeedType;
  latest: Chirp[];
  forYou: Chirp[]; // All chirps for For You feed (algorithm will filter/score)
  latestLoading: boolean;
  forYouLoading: boolean;
  error: string | null;
  latestUnsubscribe?: () => void;
  forYouUnsubscribe?: () => void;
  setActiveFeed: (feed: FeedType) => void;
  addChirp: (
    chirp: Omit<Chirp, 'id' | 'createdAt' | 'commentCount'>,
    options?: { waitForProcessing?: boolean }
  ) => Promise<Chirp>;
  startLatestListener: (
    followingIds: string[] | undefined | null,
    currentUserId: string,
    max?: number
  ) => () => void;
  startForYouListener: (
    userId: string,
    config?: ForYouConfig,
    max?: number
  ) => () => void;
  refreshLatest: (
    followingIds: string[] | undefined | null,
    currentUserId: string,
    max?: number
  ) => Promise<void>;
  refreshForYou: (
    userId: string,
    config?: ForYouConfig,
    max?: number
  ) => Promise<void>;
  clear: () => void;
};

export const useFeedStore = create<FeedState>((set, get) => ({
  activeFeed: 'latest',
  latest: [],
  forYou: [],
  latestLoading: false,
  forYouLoading: false,
  error: null,
  latestUnsubscribe: undefined,
  forYouUnsubscribe: undefined,

  setActiveFeed: (feed) => set({ activeFeed: feed }),

  addChirp: async (chirpData, options) => {
    try {
      // Create chirp in Firestore
      const newChirp = await chirpService.createChirp(chirpData);
      
      // Increment topic engagement (async, don't wait)
      const engagementTopics = new Set(
        [
          chirpData.topic,
          ...(chirpData.semanticTopics || []),
        ]
          .map((topic) => topic?.toString().trim().toLowerCase())
          .filter((topic): topic is string => Boolean(topic))
      );

      if (engagementTopics.size > 0) {
        topicService.incrementTopicEngagement(Array.from(engagementTopics)).catch((error) => {
          console.error('Error incrementing topic engagement:', error);
        });
      }
      
      // Optionally wait for processing before showing in feeds
      let processedChirp: Chirp = newChirp;
      if (options?.waitForProcessing) {
        try {
          processedChirp = await processChirpValue(newChirp);
        } catch (error) {
          console.error('[ValuePipeline] Failed to process chirp before publish:', error);
          throw error;
        }
      } else {
        // Fire-and-forget fallback (legacy)
        processChirpValue(newChirp).catch((error) => {
          console.error('[ValuePipeline] Failed to enrich chirp:', error);
        });
      }

      // Visibility rules:
      // - Hide blocked posts from feeds (will only be visible in author profile)
      // - Hide posts still in fact-checking (pending/in_progress)
      const isBlocked = processedChirp.factCheckStatus === 'blocked';
      const isProcessing =
        processedChirp.factCheckingStatus === 'pending' ||
        processedChirp.factCheckingStatus === 'in_progress';

      const canShowInFeed = !isBlocked && !isProcessing;

      if (canShowInFeed) {
      set((state) => ({
          latest: [processedChirp, ...state.latest.filter((c) => c.id !== processedChirp.id)],
          forYou: [processedChirp, ...state.forYou.filter((c) => c.id !== processedChirp.id)],
        }));
      }
      
      return processedChirp;
    } catch (error) {
      console.error('Error creating chirp:', error);
      throw error;
    }
  },

  startLatestListener: (followingIds, currentUserId, max) => {
    const filterVisibleChirps = (chirps: Chirp[]): Chirp[] =>
      chirps.filter((chirp) => {
        const isProcessing =
          chirp.factCheckingStatus === 'pending' || chirp.factCheckingStatus === 'in_progress';
        const isBlocked = chirp.factCheckStatus === 'blocked';
        if (isProcessing) return false;
        if (isBlocked && chirp.authorId !== currentUserId) return false;
        return true;
      });

    const { latestUnsubscribe } = get();
    latestUnsubscribe?.();
    set({ latestLoading: true, error: null });

    const unsubscribe = chirpService.listenLatest(
      followingIds,
      currentUserId,
      (chirps) => set({ latest: filterVisibleChirps(chirps), latestLoading: false }),
      (err) => set({ error: err?.message ?? 'Failed to load latest feed' }),
      max
    );

    set({ latestUnsubscribe: unsubscribe });
    return unsubscribe;
  },

  startForYouListener: (userId, config, max) => {
    const filterVisibleChirps = (chirps: Chirp[]): Chirp[] =>
      chirps.filter((chirp) => {
        const isProcessing =
          chirp.factCheckingStatus === 'pending' || chirp.factCheckingStatus === 'in_progress';
        const isBlocked = chirp.factCheckStatus === 'blocked';
        if (isProcessing) return false;
        if (isBlocked && chirp.authorId !== userId) return false;
        return true;
      });

    const { forYouUnsubscribe } = get();
    forYouUnsubscribe?.();
    set({ forYouLoading: true, error: null });

    const unsubscribe = chirpService.listenForYou(
      userId,
      config ?? DEFAULT_FOR_YOU_CONFIG,
      (chirps) => set({ forYou: filterVisibleChirps(chirps), forYouLoading: false }),
      (err) => set({ error: err?.message ?? 'Failed to load For You feed' }),
      max
    );

    set({ forYouUnsubscribe: unsubscribe });
    return unsubscribe;
  },

  refreshLatest: async (followingIds, currentUserId, max) => {
    const filterVisibleChirps = (chirps: Chirp[]): Chirp[] =>
      chirps.filter((chirp) => {
        const isProcessing =
          chirp.factCheckingStatus === 'pending' || chirp.factCheckingStatus === 'in_progress';
        const isBlocked = chirp.factCheckStatus === 'blocked';
        if (isProcessing) return false;
        if (isBlocked && chirp.authorId !== currentUserId) return false;
        return true;
      });

    try {
      set({ latestLoading: true, error: null });
      const chirps = await chirpService.fetchLatest(followingIds, currentUserId, max);
      set({ latest: filterVisibleChirps(chirps), latestLoading: false });
    } catch (err: any) {
      set({
        error: err?.message ?? 'Failed to refresh latest feed',
        latestLoading: false,
      });
    }
  },

  refreshForYou: async (userId, config, max) => {
    const filterVisibleChirps = (chirps: Chirp[]): Chirp[] =>
      chirps.filter((chirp) => {
        const isProcessing =
          chirp.factCheckingStatus === 'pending' || chirp.factCheckingStatus === 'in_progress';
        const isBlocked = chirp.factCheckStatus === 'blocked';
        if (isProcessing) return false;
        if (isBlocked && chirp.authorId !== userId) return false;
        return true;
      });

    try {
      set({ forYouLoading: true, error: null });
      const chirps = await chirpService.fetchForYou(
        userId,
        config ?? DEFAULT_FOR_YOU_CONFIG,
        max
      );
      set({ forYou: filterVisibleChirps(chirps), forYouLoading: false });
    } catch (err: any) {
      set({
        error: err?.message ?? 'Failed to refresh For You feed',
        forYouLoading: false,
      });
    }
  },

  clear: () => {
    const { latestUnsubscribe, forYouUnsubscribe } = get();
    latestUnsubscribe?.();
    forYouUnsubscribe?.();
    set({
      latest: [],
      forYou: [],
      latestLoading: false,
      forYouLoading: false,
      error: null,
      latestUnsubscribe: undefined,
      forYouUnsubscribe: undefined,
    });
  },
}));


