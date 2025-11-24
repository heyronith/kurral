// Search store for managing search state and results
import { create } from 'zustand';
import type { Chirp } from '../types';
import type { SearchResult } from '../lib/agents/searchAgent';

interface SearchState {
  query: string;
  results: SearchResult[];
  isSearching: boolean;
  lastSearchTime: number | null;
  setQuery: (query: string) => void;
  setResults: (results: SearchResult[]) => void;
  setIsSearching: (isSearching: boolean) => void;
  clearSearch: () => void;
}

export const useSearchStore = create<SearchState>((set) => ({
  query: '',
  results: [],
  isSearching: false,
  lastSearchTime: null,

  setQuery: (query) => set({ query }),

  setResults: (results) =>
    set({
      results,
      isSearching: false,
      lastSearchTime: Date.now(),
    }),

  setIsSearching: (isSearching) => set({ isSearching }),

  clearSearch: () =>
    set({
      query: '',
      results: [],
      isSearching: false,
      lastSearchTime: null,
    }),
}));

