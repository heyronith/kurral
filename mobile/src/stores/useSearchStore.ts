// Search store for managing search state and results
import { create } from 'zustand';
import type { Chirp, User, TopicMetadata } from '../types';
import type { SearchResult } from '../services/searchAgent';

interface SearchState {
  query: string;
  results: SearchResult[];
  userResults: User[];
  topicResults: TopicMetadata[];
  activeTab: 'kural' | 'users' | 'topics';
  isSearching: boolean;
  lastSearchTime: number | null;
  setQuery: (query: string) => void;
  setResults: (results: SearchResult[]) => void;
  setUserResults: (users: User[]) => void;
  setTopicResults: (topics: TopicMetadata[]) => void;
  setActiveTab: (tab: 'kural' | 'users' | 'topics') => void;
  setIsSearching: (isSearching: boolean) => void;
  clearSearch: () => void;
}

export const useSearchStore = create<SearchState>((set) => ({
  query: '',
  results: [],
  userResults: [],
  topicResults: [],
  activeTab: 'kural',
  isSearching: false,
  lastSearchTime: null,

  setQuery: (query) => set({ query }),

  setResults: (results) =>
    set({
      results,
      isSearching: false,
      lastSearchTime: Date.now(),
    }),

  setUserResults: (userResults) =>
    set({
      userResults,
      isSearching: false,
      lastSearchTime: Date.now(),
    }),

  setTopicResults: (topicResults) =>
    set({
      topicResults,
      isSearching: false,
      lastSearchTime: Date.now(),
    }),

  setActiveTab: (activeTab) => set({ activeTab }),

  setIsSearching: (isSearching) => set({ isSearching }),

  clearSearch: () =>
    set({
      query: '',
      results: [],
      userResults: [],
      topicResults: [],
      isSearching: false,
      lastSearchTime: null,
    }),
}));

