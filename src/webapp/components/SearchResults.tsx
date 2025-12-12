// Search Results Component
import { useEffect, useState, useRef, useMemo } from 'react';
import { useSearchStore } from '../store/useSearchStore';
import { useFeedStore } from '../store/useFeedStore';
import { useUserStore } from '../store/useUserStore';
import type { SearchResult } from '../lib/agents/searchAgent';
import { getSearchAgent } from '../lib/agents/searchAgent';
import ChirpCard from './ChirpCard';
import { shouldDisplayChirp } from '../lib/utils/chirpVisibility';

const SearchResults = () => {
  const { query, results, isSearching, setResults, setIsSearching } = useSearchStore();
  const { chirps } = useFeedStore();
  const getUser = useUserStore((state) => state.getUser);
  const currentUser = useUserStore((state) => state.currentUser);
  const [error, setError] = useState<string | null>(null);
  
  // Use ref to avoid including getUser in dependencies (it changes on every render)
  const getUserRef = useRef(getUser);
  useEffect(() => {
    getUserRef.current = getUser;
  }, [getUser]);

  const setFilteredResults = (items: SearchResult[]) => {
    const filtered = items.filter((result) => shouldDisplayChirp(result.chirp, currentUser?.id));
    setResults(filtered);
  };

  useEffect(() => {
    const performSearch = async () => {
      console.log('[SearchResults] performSearch called', { 
        query, 
        queryLength: query.length, 
        chirpsCount: chirps.length 
      });
      
      if (!query.trim() || query.length < 2) {
        console.log('[SearchResults] Query too short, clearing results');
        setResults([]);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      setError(null);

      try {
        const searchAgent = getSearchAgent();
        console.log('[SearchResults] Search agent available:', !!searchAgent);
        console.log('[SearchResults] Chirps available:', chirps.length);
        
        if (chirps.length === 0) {
          console.warn('[SearchResults] No chirps available to search');
          setResults([]);
          setError('No posts available to search. Please wait for content to load.');
          return;
        }
        
        if (searchAgent) {
          // Use AI agent for semantic search
          console.log('[SearchResults] Using AI search agent');
          const response = await searchAgent.rankResults(
            query,
            chirps,
            getUserRef.current,
            20
          );

          console.log('[SearchResults] AI search response:', { 
            success: response.success, 
            hasData: !!response.data, 
            hasFallback: !!response.fallback,
            dataLength: response.data?.length || 0,
            fallbackLength: response.fallback?.length || 0
          });

          if (response.success && response.data && response.data.length > 0) {
            console.log('[SearchResults] Setting AI search results:', response.data.length);
            setFilteredResults(response.data);
          } else if (response.fallback && response.fallback.length > 0) {
            console.log('[SearchResults] Using AI fallback results:', response.fallback.length);
            setFilteredResults(response.fallback);
          } else {
            // Fallback to keyword search
            console.log('[SearchResults] AI search returned no results, using keyword fallback');
            const keywordResults = performKeywordSearch(query, chirps);
            console.log('[SearchResults] Keyword search results:', keywordResults.length);
            setFilteredResults(keywordResults);
          }
        } else {
          // Fallback to keyword search if AI is not available
          console.log('[SearchResults] AI not available, using keyword search');
          const keywordResults = performKeywordSearch(query, chirps);
          console.log('[SearchResults] Keyword search results:', keywordResults.length);
          setFilteredResults(keywordResults);
        }
      } catch (err: any) {
        console.error('[SearchResults] Search error:', err);
        // Always try keyword fallback on error
        try {
          const keywordResults = performKeywordSearch(query, chirps);
          console.log('[SearchResults] Error fallback keyword results:', keywordResults.length);
          if (keywordResults.length > 0) {
            setFilteredResults(keywordResults);
            setError(null); // Clear error if fallback worked
          } else {
            setError(err.message || 'Failed to perform search');
            setResults([]);
          }
        } catch (fallbackErr: any) {
          console.error('[SearchResults] Fallback search also failed:', fallbackErr);
          setError(err.message || 'Failed to perform search');
          setResults([]);
        }
      } finally {
        setIsSearching(false);
      }
    };

    // Helper function for keyword search
    const performKeywordSearch = (searchQuery: string, chirpsToSearch: typeof chirps) => {
      const keywords = searchQuery.toLowerCase().split(/\s+/).filter(w => w.length > 2);
      if (keywords.length === 0) {
        return [];
      }
      
      const filtered = chirpsToSearch
        .filter(chirp => {
          const text = chirp.text.toLowerCase();
          const topic = chirp.topic.toLowerCase();
          return keywords.some(keyword => text.includes(keyword) || topic.includes(keyword));
        })
        .slice(0, 20)
        .map(chirp => ({
          chirp,
          relevanceScore: 0.5,
          explanation: 'Matches search keywords',
        }));
      
      return filtered;
    };

    // Debounce search
    const timeoutId = setTimeout(performSearch, 500);
    return () => clearTimeout(timeoutId);
  }, [query, chirps, setResults, setIsSearching, currentUser?.id]); // Depend on query, chirps and viewer

  // Results are already filtered in setFilteredResults, but filter again in case currentUser changes
  const visibleResults = useMemo(
    () => results.filter((result) => shouldDisplayChirp(result.chirp, currentUser?.id)),
    [results, currentUser?.id]
  );

  if (!query.trim() || query.length < 2) {
    return null;
  }

  if (isSearching) {
    return (
      <div className="p-8 text-center text-textMuted">
        <p>Searching...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-500 text-sm">{error}</p>
      </div>
    );
  }

  if (visibleResults.length === 0) {
    return (
      <div className="p-8 text-center text-textMuted">
        <p>No results found for "{query}"</p>
      </div>
    );
  }

  return (
    <div className="border-t border-border">
      <div className="px-4 py-3 bg-background/30 border-b border-border">
        <p className="text-sm text-textMuted">
          Found {visibleResults.length} result{visibleResults.length !== 1 ? 's' : ''} for "{query}"
        </p>
      </div>
      <div>
        {visibleResults.map((result) => (
          <div key={result.chirp.id}>
            <div className="px-4 py-2 text-xs text-textMuted border-b border-border bg-background/30">
              {result.explanation} (Relevance: {(result.relevanceScore * 100).toFixed(0)}%)
            </div>
            <ChirpCard chirp={result.chirp} />
          </div>
        ))}
      </div>
    </div>
  );
};

export default SearchResults;

