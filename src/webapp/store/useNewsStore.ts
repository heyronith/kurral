// News store for managing trending news data
import { create } from 'zustand';
import type { TrendingNews } from '../types';
import { newsService } from '../lib/services/newsService';

interface NewsState {
  trendingNews: TrendingNews[];
  selectedNews: TrendingNews | null;
  isLoading: boolean;
  lastUpdated: Date | null;
  error: string | null;
  currentUserId: string | null;
  loadTrendingNews: (userId?: string | null, forceRefresh?: boolean) => Promise<void>;
  selectNews: (newsId: string) => Promise<void>;
  clearSelection: () => void;
  isStale: () => boolean;
  refreshNews: () => Promise<void>;
}

// Stale threshold: 3 hours
const STALE_THRESHOLD = 3 * 60 * 60 * 1000;

export const useNewsStore = create<NewsState>((set, get) => ({
  trendingNews: [],
  selectedNews: null,
  isLoading: false,
  lastUpdated: null,
  error: null,
  currentUserId: null,

  loadTrendingNews: async (userId?: string | null, forceRefresh: boolean = false) => {
    const state = get();
    
    // Check if data is fresh enough and not forcing refresh
    // Note: The service also checks Firestore cache, so we pass forceRefresh to it
    if (!forceRefresh && !state.isStale() && state.trendingNews.length > 0) {
      // Still check with service in case Firestore has newer data
      // But don't force refresh if local state is fresh
    }

    const scopedUserId = userId ?? null;

    set({ isLoading: true, error: null, currentUserId: scopedUserId });

    try {
      const news = await newsService.fetchTrendingNews(scopedUserId, forceRefresh);
      set({
        trendingNews: news,
        lastUpdated: new Date(),
        isLoading: false,
        error: null,
      });
    } catch (error: any) {
      console.error('Error loading trending news:', error);
      set({
        isLoading: false,
        error: error.message || 'Failed to load trending news',
      });
    }
  },

  selectNews: async (newsId: string) => {
    const state = get();
    
    // Check if news is already in trendingNews
    const news = state.trendingNews.find(n => n.id === newsId);
    if (news) {
      set({ selectedNews: news });
      return;
    }

    // If not found, try to fetch from Firestore
    set({ isLoading: true });
    try {
      const fetchedNews = await newsService.getNewsById(newsId);
      if (fetchedNews) {
        set({ selectedNews: fetchedNews, isLoading: false });
      } else {
        set({ 
          selectedNews: null, 
          isLoading: false,
          error: 'News not found',
        });
      }
    } catch (error: any) {
      console.error('Error fetching news:', error);
      set({ 
        selectedNews: null, 
        isLoading: false,
        error: error.message || 'Failed to load news',
      });
    }
  },

  clearSelection: () => {
    set({ selectedNews: null, error: null });
  },

  isStale: () => {
    const state = get();
    if (!state.lastUpdated) return true;
    
    const now = new Date();
    const age = now.getTime() - state.lastUpdated.getTime();
    return age > STALE_THRESHOLD;
  },

  refreshNews: async () => {
    const state = get();
    await state.loadTrendingNews(state.currentUserId, true);
  },
}));

