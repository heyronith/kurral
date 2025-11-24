import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Search Results Component
import { useEffect, useState, useRef } from 'react';
import { useSearchStore } from '../store/useSearchStore';
import { useFeedStore } from '../store/useFeedStore';
import { useUserStore } from '../store/useUserStore';
import { getSearchAgent } from '../lib/agents/searchAgent';
import ChirpCard from './ChirpCard';
const SearchResults = () => {
    const { query, results, isSearching, setResults, setIsSearching } = useSearchStore();
    const { chirps } = useFeedStore();
    const { getUser } = useUserStore();
    const [error, setError] = useState(null);
    // Use ref to avoid including getUser in dependencies (it changes on every render)
    const getUserRef = useRef(getUser);
    useEffect(() => {
        getUserRef.current = getUser;
    }, [getUser]);
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
                    const response = await searchAgent.rankResults(query, chirps, getUserRef.current, 20);
                    console.log('[SearchResults] AI search response:', {
                        success: response.success,
                        hasData: !!response.data,
                        hasFallback: !!response.fallback,
                        dataLength: response.data?.length || 0,
                        fallbackLength: response.fallback?.length || 0
                    });
                    if (response.success && response.data && response.data.length > 0) {
                        console.log('[SearchResults] Setting AI search results:', response.data.length);
                        setResults(response.data);
                    }
                    else if (response.fallback && response.fallback.length > 0) {
                        console.log('[SearchResults] Using AI fallback results:', response.fallback.length);
                        setResults(response.fallback);
                    }
                    else {
                        // Fallback to keyword search
                        console.log('[SearchResults] AI search returned no results, using keyword fallback');
                        const keywordResults = performKeywordSearch(query, chirps);
                        console.log('[SearchResults] Keyword search results:', keywordResults.length);
                        setResults(keywordResults);
                    }
                }
                else {
                    // Fallback to keyword search if AI is not available
                    console.log('[SearchResults] AI not available, using keyword search');
                    const keywordResults = performKeywordSearch(query, chirps);
                    console.log('[SearchResults] Keyword search results:', keywordResults.length);
                    setResults(keywordResults);
                }
            }
            catch (err) {
                console.error('[SearchResults] Search error:', err);
                // Always try keyword fallback on error
                try {
                    const keywordResults = performKeywordSearch(query, chirps);
                    console.log('[SearchResults] Error fallback keyword results:', keywordResults.length);
                    if (keywordResults.length > 0) {
                        setResults(keywordResults);
                        setError(null); // Clear error if fallback worked
                    }
                    else {
                        setError(err.message || 'Failed to perform search');
                        setResults([]);
                    }
                }
                catch (fallbackErr) {
                    console.error('[SearchResults] Fallback search also failed:', fallbackErr);
                    setError(err.message || 'Failed to perform search');
                    setResults([]);
                }
            }
            finally {
                setIsSearching(false);
            }
        };
        // Helper function for keyword search
        const performKeywordSearch = (searchQuery, chirpsToSearch) => {
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
    }, [query, chirps, setResults, setIsSearching]); // Depend on query and chirps array
    if (!query.trim() || query.length < 2) {
        return null;
    }
    if (isSearching) {
        return (_jsx("div", { className: "p-8 text-center text-textMuted", children: _jsx("p", { children: "Searching..." }) }));
    }
    if (error) {
        return (_jsx("div", { className: "p-8 text-center", children: _jsx("p", { className: "text-red-500 text-sm", children: error }) }));
    }
    if (results.length === 0) {
        return (_jsx("div", { className: "p-8 text-center text-textMuted", children: _jsxs("p", { children: ["No results found for \"", query, "\""] }) }));
    }
    return (_jsxs("div", { className: "border-t border-border", children: [_jsx("div", { className: "px-4 py-3 bg-background/30 border-b border-border", children: _jsxs("p", { className: "text-sm text-textMuted", children: ["Found ", results.length, " result", results.length !== 1 ? 's' : '', " for \"", query, "\""] }) }), _jsx("div", { children: results.map((result) => (_jsxs("div", { children: [_jsxs("div", { className: "px-4 py-2 text-xs text-textMuted border-b border-border bg-background/30", children: [result.explanation, " (Relevance: ", (result.relevanceScore * 100).toFixed(0), "%)"] }), _jsx(ChirpCard, { chirp: result.chirp })] }, result.chirp.id))) })] }));
};
export default SearchResults;
