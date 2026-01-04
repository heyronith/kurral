import { create } from 'zustand';
import type { Chirp, FeedType, ForYouConfig } from '../types';
import { DEFAULT_FOR_YOU_CONFIG } from '../types';
import { chirpService } from '../services/chirpService';
import { topicService } from '../services/topicService';

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
  addChirp: (chirp: Omit<Chirp, 'id' | 'createdAt' | 'commentCount'>) => Promise<Chirp>;
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

  addChirp: async (chirpData) => {
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
      
      // Update local state
      set((state) => ({
        latest: [newChirp, ...state.latest.filter((c) => c.id !== newChirp.id)],
        forYou: [newChirp, ...state.forYou.filter((c) => c.id !== newChirp.id)],
      }));
      
      // Trigger value pipeline processing (async, don't block)
      // Import processChirpValue from mobile wrapper (uses dynamic import to avoid Metro issues)
      import('../services/valuePipelineService').then(({ processChirpValue }) => {
        processChirpValue(newChirp)
          .then((enrichedChirp) => {
            set((state) => ({
              latest: state.latest.map((chirp) => (chirp.id === enrichedChirp.id ? enrichedChirp : chirp)),
              forYou: state.forYou.map((chirp) => (chirp.id === enrichedChirp.id ? enrichedChirp : chirp)),
            }));
          })
          .catch((error) => {
            console.error('[ValuePipeline] Failed to enrich chirp:', error);
          });
      }).catch((error) => {
        console.error('[ValuePipeline] Failed to import processChirpValue:', error);
      });
      
      return newChirp;
    } catch (error) {
      console.error('Error creating chirp:', error);
      throw error;
    }
  },

  startLatestListener: (followingIds, currentUserId, max) => {
    const { latestUnsubscribe } = get();
    latestUnsubscribe?.();
    set({ latestLoading: true, error: null });

    const unsubscribe = chirpService.listenLatest(
      followingIds,
      currentUserId,
      (chirps) => set({ latest: chirps, latestLoading: false }),
      (err) => set({ error: err?.message ?? 'Failed to load latest feed' }),
      max
    );

    set({ latestUnsubscribe: unsubscribe });
    return unsubscribe;
  },

  startForYouListener: (userId, config, max) => {
    const { forYouUnsubscribe } = get();
    forYouUnsubscribe?.();
    set({ forYouLoading: true, error: null });

    const unsubscribe = chirpService.listenForYou(
      userId,
      config ?? DEFAULT_FOR_YOU_CONFIG,
      (chirps) => set({ forYou: chirps, forYouLoading: false }),
      (err) => set({ error: err?.message ?? 'Failed to load For You feed' }),
      max
    );

    set({ forYouUnsubscribe: unsubscribe });
    return unsubscribe;
  },

  refreshLatest: async (followingIds, currentUserId, max) => {
    try {
      set({ latestLoading: true, error: null });
      const chirps = await chirpService.fetchLatest(followingIds, currentUserId, max);
      set({ latest: chirps, latestLoading: false });
    } catch (err: any) {
      set({
        error: err?.message ?? 'Failed to refresh latest feed',
        latestLoading: false,
      });
    }
  },

  refreshForYou: async (userId, config, max) => {
    try {
      set({ forYouLoading: true, error: null });
      const chirps = await chirpService.fetchForYou(
        userId,
        config ?? DEFAULT_FOR_YOU_CONFIG,
        max
      );
      set({ forYou: chirps, forYouLoading: false });
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


