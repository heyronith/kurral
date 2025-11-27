import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useUserStore } from '../store/useUserStore';
import { useSearchStore } from '../store/useSearchStore';
import { useTopicStore } from '../store/useTopicStore';
import { useThemeStore } from '../store/useThemeStore';
import { userService } from '../lib/firestore';
import TrendingNewsSection from './TrendingNewsSection';
const RightPanel = () => {
    const { users, currentUser, followUser, unfollowUser, isFollowing } = useUserStore();
    const { query, setQuery } = useSearchStore();
    const { theme } = useThemeStore();
    const { trendingTopics, isLoading: topicsLoading, loadTrendingTopics, startScheduledRefresh, selectTopic } = useTopicStore();
    // Load trending topics on mount and start scheduled refresh
    useEffect(() => {
        loadTrendingTopics(10);
        // Start scheduled refresh (returns cleanup function)
        const cleanup = startScheduledRefresh();
        // Cleanup on unmount
        return cleanup;
    }, [loadTrendingTopics, startScheduledRefresh]);
    // Format volume display
    const formatVolume = (count) => {
        if (count >= 1000) {
            return `${(count / 1000).toFixed(1)}K chirps`;
        }
        return `${count} chirps`;
    };
    // Get top 5 trending topics for display, prioritizing user interests
    const displayTrendingTopics = useMemo(() => {
        if (trendingTopics.length === 0) {
            return [];
        }
        if (!currentUser || !currentUser.interests || currentUser.interests.length === 0) {
            // No personalization: show top 5 trending topics
            return trendingTopics.slice(0, 5).map((topic) => ({
                topic: topic.name,
                volume: formatVolume(topic.postsLast1h), // Use 1h for trending display
                matchesInterest: false,
            }));
        }
        // Personalize: prioritize topics that match user interests
        const userInterests = currentUser.interests.map((i) => i.toLowerCase());
        // Check which topics match user interests
        const topicsWithMatch = trendingTopics.map((topic) => {
            const topicName = topic.name.toLowerCase();
            const matchesInterest = userInterests.some((interest) => {
                // Check if topic name contains interest or vice versa
                return topicName.includes(interest) || interest.includes(topicName);
            });
            return {
                topic: topic,
                matchesInterest,
            };
        });
        // Sort: matching interests first, then by 1h engagement (trending velocity)
        topicsWithMatch.sort((a, b) => {
            if (a.matchesInterest !== b.matchesInterest) {
                return a.matchesInterest ? -1 : 1; // Matches first
            }
            return b.topic.postsLast1h - a.topic.postsLast1h; // Then by 1h posts (trending velocity)
        });
        return topicsWithMatch.slice(0, 5).map((item) => ({
            topic: item.topic.name,
            volume: formatVolume(item.topic.postsLast1h), // Use 1h for trending display
            matchesInterest: item.matchesInterest,
        }));
    }, [trendingTopics, currentUser]);
    const [suggestedUsers, setSuggestedUsers] = useState([]);
    const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
    // Load users with similar interests
    useEffect(() => {
        const loadUserSuggestions = async () => {
            if (!currentUser || !currentUser.interests || currentUser.interests.length === 0) {
                // Fallback: use users from store (no interest-based suggestions)
                const list = Object.values(users).filter((user) => user.id !== currentUser?.id);
                setSuggestedUsers(list.slice(0, 3));
                return;
            }
            setIsLoadingSuggestions(true);
            try {
                const similarUsers = await userService.getUsersWithSimilarInterests(currentUser.interests, currentUser.id, 5 // Get top 5, display 3
                );
                if (similarUsers.length > 0) {
                    setSuggestedUsers(similarUsers.slice(0, 3));
                }
                else {
                    // Fallback: use users from store
                    const list = Object.values(users).filter((user) => user.id !== currentUser?.id);
                    setSuggestedUsers(list.slice(0, 3));
                }
            }
            catch (error) {
                console.error('Error loading user suggestions:', error);
                // Fallback: use users from store
                const list = Object.values(users).filter((user) => user.id !== currentUser?.id);
                setSuggestedUsers(list.slice(0, 3));
            }
            finally {
                setIsLoadingSuggestions(false);
            }
        };
        loadUserSuggestions();
    }, [currentUser?.id, currentUser?.interests, users]);
    const peopleToFollow = suggestedUsers;
    return (_jsxs("aside", { className: "sticky top-20 hidden xl:flex w-80 flex-col gap-5", children: [_jsxs("div", { className: `rounded-2xl border-2 ${theme === 'dark' ? 'border-white/20 bg-transparent' : 'border-border/60 bg-card/60 shadow-card backdrop-blur-md'} p-5`, children: [_jsx("label", { className: `mb-3 block text-xs font-semibold uppercase tracking-wide ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'}`, children: "Search Kurral" }), _jsxs("div", { className: "relative", children: [_jsx("input", { type: "text", value: query, onChange: (e) => setQuery(e.target.value), placeholder: "Search topics or people", className: `input-field ${theme === 'dark' ? 'bg-white/5 border-white/20 text-white placeholder:text-white/50 focus:border-accent/60 focus:ring-accent/20' : ''}` }), _jsx("span", { className: `absolute right-3 top-2.5 text-xs ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'} font-medium`, children: "\u2318 K" })] })] }), _jsx(TrendingNewsSection, {}), _jsxs("div", { className: `rounded-2xl border-2 ${theme === 'dark' ? 'border-white/20 bg-transparent' : 'border-border/60 bg-card/60 shadow-card backdrop-blur-md'} p-5`, children: [_jsx("h3", { className: `mb-4 text-sm font-bold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`, children: "Trending Topics" }), topicsLoading ? (_jsx("div", { className: "py-4 text-center", children: _jsx("p", { className: `text-xs ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'}`, children: "Loading trending topics..." }) })) : displayTrendingTopics.length === 0 ? (_jsx("div", { className: "py-4 text-center", children: _jsx("p", { className: `text-xs ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'}`, children: "No trending topics yet" }) })) : (_jsx("div", { className: "flex flex-wrap gap-2", children: displayTrendingTopics.map((item) => (_jsx("button", { onClick: () => selectTopic(item.topic), className: `inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-sm font-medium ${theme === 'dark' ? 'text-white' : 'text-textPrimary'} border transition-all duration-200 active:scale-95 cursor-pointer ${item.matchesInterest
                                ? theme === 'dark' ? 'border-accent/40 bg-accent/20 hover:bg-accent/30' : 'border-accent/40 bg-accent/10 hover:bg-accent/15'
                                : theme === 'dark' ? 'border-white/20 bg-transparent hover:border-white/40 hover:bg-white/10' : 'border-border/60 bg-transparent hover:border-border/80 hover:bg-backgroundElevated/40'}`, children: item.topic }, item.topic))) }))] }), _jsxs("div", { className: `rounded-2xl border-2 ${theme === 'dark' ? 'border-white/20 bg-transparent' : 'border-border/60 bg-card/60 shadow-card backdrop-blur-md'} p-5`, children: [_jsx("h3", { className: `mb-4 text-sm font-bold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`, children: currentUser?.interests && currentUser.interests.length > 0
                            ? 'People with similar interests'
                            : 'People to follow' }), isLoadingSuggestions ? (_jsx("div", { className: "py-4 text-center", children: _jsx("p", { className: `text-xs ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'}`, children: "Loading suggestions..." }) })) : peopleToFollow.length === 0 ? (_jsx("div", { className: "py-4 text-center", children: _jsx("p", { className: `text-xs ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'}`, children: "No suggestions yet" }) })) : (_jsx("div", { className: "space-y-3", children: peopleToFollow.map((person) => {
                            const following = isFollowing(person.id);
                            // Extract similarity metadata if available
                            const similarityMetadata = person._similarityMetadata;
                            const matchingInterests = similarityMetadata?.matchingInterests || [];
                            const overlapCount = similarityMetadata?.overlapCount || 0;
                            const personInitials = person.name
                                .split(' ')
                                .map((part) => part[0]?.toUpperCase())
                                .join('')
                                .slice(0, 2);
                            return (_jsxs("div", { className: `rounded-xl px-3.5 py-3.5 border ${theme === 'dark' ? 'border-white/20 hover:bg-white/10 hover:border-white/40' : 'border-border/50 hover:bg-backgroundElevated/60 hover:border-border/70'} transition-all duration-200`, children: [_jsxs("div", { className: "flex items-start justify-between mb-2", children: [_jsxs("div", { className: "flex items-center gap-3 flex-1 min-w-0", children: [_jsx(Link, { to: `/profile/${person.id}`, className: `flex-shrink-0 w-10 h-10 rounded-full overflow-hidden ${theme === 'dark' ? '' : 'border-2 border-border'} bg-primary/20 flex items-center justify-center ${theme === 'dark' ? '' : 'hover:border-accent'} transition-colors`, children: person.profilePictureUrl ? (_jsx("img", { src: person.profilePictureUrl, alt: `${person.name}'s profile`, className: "w-full h-full object-cover" })) : (_jsx("span", { className: "text-xs font-semibold text-primary", children: personInitials })) }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx(Link, { to: `/profile/${person.id}`, className: `block text-sm font-bold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'} truncate hover:text-accent transition-colors`, children: person.name }), _jsxs(Link, { to: `/profile/${person.id}`, className: `block text-xs ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'} truncate hover:text-accent transition-colors`, children: ["@", person.handle] }), matchingInterests.length > 0 && (_jsxs("div", { className: "mt-2 flex flex-wrap gap-1.5", children: [matchingInterests.slice(0, 2).map((interest, idx) => (_jsx("span", { className: "px-2 py-0.5 text-[10px] font-semibold bg-accent/20 text-accent rounded-md border border-accent/30", children: interest }, idx))), matchingInterests.length > 2 && (_jsxs("span", { className: `px-2 py-0.5 text-[10px] ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'}`, children: ["+", matchingInterests.length - 2, " more"] }))] }))] })] }), _jsx("button", { onClick: () => (following ? unfollowUser(person.id) : followUser(person.id)), className: `ml-3 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all duration-200 whitespace-nowrap active:scale-95 ${following
                                                    ? theme === 'dark' ? 'bg-white/10 text-white/70 border border-white/20' : 'bg-backgroundElevated/80 text-textMuted border border-border/60 shadow-subtle'
                                                    : 'bg-gradient-to-r from-primary to-accent text-white hover:from-primaryHover hover:to-accentHover shadow-button hover:shadow-buttonHover'}`, children: following ? 'Following' : 'Follow' })] }), overlapCount > 0 && (_jsxs("p", { className: `text-[10px] ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'} mt-1.5`, children: [overlapCount, " shared interest", overlapCount !== 1 ? 's' : ''] }))] }, person.id));
                        }) }))] })] }));
};
export default RightPanel;
