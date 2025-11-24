// Search store for managing search state and results
import { create } from 'zustand';
export const useSearchStore = create((set) => ({
    query: '',
    results: [],
    isSearching: false,
    lastSearchTime: null,
    setQuery: (query) => set({ query }),
    setResults: (results) => set({
        results,
        isSearching: false,
        lastSearchTime: Date.now(),
    }),
    setIsSearching: (isSearching) => set({ isSearching }),
    clearSearch: () => set({
        query: '',
        results: [],
        isSearching: false,
        lastSearchTime: null,
    }),
}));
