import { create } from 'zustand';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import type { Chirp } from '../types';
import { mostValuedService, type MostValuedQueryOptions } from '../lib/services/mostValuedService';

type Timeframe = 'today' | 'week' | 'month' | 'all';

interface MostValuedState {
  topValuedPosts: Chirp[];
  valuedPosts: Chirp[];
  isLoadingTop: boolean;
  isLoadingList: boolean;
  isLoadingMore: boolean;
  lastUpdatedTop: Date | null;
  lastUpdatedList: Date | null;
  lastListCursor: QueryDocumentSnapshot | null;
  timeframe: Timeframe;
  filterByInterests: boolean;
  minValueThreshold: number;
  hasMore: boolean;
  lastListParamsKey: string | null;
  lastTopParamsKey: string | null;
  loadTopValuedPosts: (opts: { timeframe?: Timeframe; interests?: string[]; minValueThreshold?: number; forceRefresh?: boolean }) => Promise<void>;
  loadValuedPosts: (opts: { timeframe?: Timeframe; interests?: string[]; minValueThreshold?: number; forceRefresh?: boolean }) => Promise<void>;
  loadMoreValuedPosts: (opts: { timeframe?: Timeframe; interests?: string[]; minValueThreshold?: number }) => Promise<void>;
  setTimeframe: (timeframe: Timeframe) => void;
  setFilterByInterests: (enabled: boolean) => void;
  setMinValueThreshold: (value: number) => void;
}

const SIDEBAR_STALE_MS = 5 * 60 * 1000; // 5 minutes
const LIST_STALE_MS = 2 * 60 * 60 * 1000; // 2 hours
const LIST_PAGE_SIZE = 30;

const buildParamsKey = (opts: { timeframe?: Timeframe; interests?: string[]; minValueThreshold?: number }) => {
  const tf = opts.timeframe ?? 'week';
  const interestsKey = (opts.interests || []).join('|') || 'all';
  const threshold = opts.minValueThreshold ?? 0.5;
  return `${tf}::${interestsKey}::${threshold}`;
};

export const useMostValuedStore = create<MostValuedState>((set, get) => ({
  topValuedPosts: [],
  valuedPosts: [],
  isLoadingTop: false,
  isLoadingList: false,
  isLoadingMore: false,
  lastUpdatedTop: null,
  lastUpdatedList: null,
  lastListCursor: null,
  timeframe: 'week',
  filterByInterests: false,
  minValueThreshold: 0.5,
  hasMore: false,
  lastListParamsKey: null,
  lastTopParamsKey: null,

  setTimeframe: (timeframe) => set({ timeframe }),
  setFilterByInterests: (enabled) => set({ filterByInterests: enabled }),
  setMinValueThreshold: (value) => set({ minValueThreshold: value }),

  loadTopValuedPosts: async ({ timeframe = 'week', interests, minValueThreshold = 0.5, forceRefresh = false }) => {
    const state = get();
    const now = Date.now();
    const isStale = !state.lastUpdatedTop || now - state.lastUpdatedTop.getTime() > SIDEBAR_STALE_MS;
    const paramsKey = buildParamsKey({ timeframe, interests, minValueThreshold });

    if (!forceRefresh && !isStale && state.lastTopParamsKey === paramsKey && state.topValuedPosts.length > 0) {
      return;
    }

    set({ isLoadingTop: true });
    try {
      const { posts } = await mostValuedService.getTopValuedPosts(timeframe, interests, minValueThreshold, 5);
      set({
        topValuedPosts: posts,
        lastUpdatedTop: new Date(),
        lastTopParamsKey: paramsKey,
      });
    } catch (error) {
      console.error('[useMostValuedStore] Error loading top valued posts:', error);
      set({ topValuedPosts: [], lastTopParamsKey: paramsKey });
      throw error; // Re-throw so components can handle it
    } finally {
      set({ isLoadingTop: false });
    }
  },

  loadValuedPosts: async ({ timeframe = 'week', interests, minValueThreshold = 0.5, forceRefresh = false }) => {
    const state = get();
    const now = Date.now();
    const isStale = !state.lastUpdatedList || now - state.lastUpdatedList.getTime() > LIST_STALE_MS;
    const paramsKey = buildParamsKey({ timeframe, interests, minValueThreshold });

    if (!forceRefresh && !isStale && state.lastListParamsKey === paramsKey && state.valuedPosts.length > 0) {
      return;
    }

    set({ isLoadingList: true, hasMore: false });
    try {
      const { posts, cursor, hasMore } = await mostValuedService.getValuedPosts({
        timeframe,
        interests,
        minValueThreshold,
        limit: LIST_PAGE_SIZE,
      });
      set({
        valuedPosts: posts,
        lastListCursor: cursor,
        hasMore,
        lastUpdatedList: new Date(),
        lastListParamsKey: paramsKey,
      });
    } catch (error) {
      console.error('[useMostValuedStore] Error loading valued posts:', error);
      set({ valuedPosts: [], lastListCursor: null, hasMore: false, lastListParamsKey: paramsKey });
      throw error; // Re-throw so components can handle it
    } finally {
      set({ isLoadingList: false });
    }
  },

  loadMoreValuedPosts: async ({ timeframe = 'week', interests, minValueThreshold = 0.5 }) => {
    const state = get();
    if (!state.hasMore || !state.lastListCursor || state.isLoadingMore) {
      return;
    }

    set({ isLoadingMore: true });
    try {
      const { posts, cursor, hasMore } = await mostValuedService.getValuedPosts({
        timeframe,
        interests,
        minValueThreshold,
        limit: LIST_PAGE_SIZE,
        startAfterDoc: state.lastListCursor,
      } as MostValuedQueryOptions);

      set({
        valuedPosts: [...state.valuedPosts, ...posts],
        lastListCursor: cursor,
        hasMore,
      });
    } catch (error) {
      console.error('[useMostValuedStore] Error loading more valued posts:', error);
      throw error; // Re-throw so components can handle it
    } finally {
      set({ isLoadingMore: false });
    }
  },
}));

