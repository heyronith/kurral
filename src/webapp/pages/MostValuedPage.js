import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import AppLayout from '../components/AppLayout';
import ChirpCard from '../components/ChirpCard';
import { useMostValuedStore } from '../store/useMostValuedStore';
import { useUserStore } from '../store/useUserStore';
import { useThemeStore } from '../store/useThemeStore';
import { useConfigStore } from '../store/useConfigStore';
import { filterChirpsForMostValued } from '../lib/utils/mostValuedEligibility';
const timeframes = [
    { id: 'today', label: 'Today' },
    { id: 'week', label: 'This Week' },
    { id: 'month', label: 'This Month' },
    { id: 'all', label: 'All Time' },
];
const MostValuedPage = () => {
    const { theme } = useThemeStore();
    const { currentUser } = useUserStore();
    const forYouConfig = useConfigStore((state) => state.forYouConfig);
    const { valuedPosts, isLoadingList, isLoadingMore, hasMore, timeframe, filterByInterests, minValueThreshold, loadValuedPosts, loadMoreValuedPosts, setTimeframe, setFilterByInterests, setMinValueThreshold, } = useMostValuedStore();
    const [error, setError] = useState(null);
    const interests = useMemo(() => {
        if (!filterByInterests)
            return undefined;
        const userInterests = currentUser?.interests || [];
        return userInterests.length > 0 ? userInterests : undefined;
    }, [filterByInterests, currentUser?.interests]);
    useEffect(() => {
        setError(null);
        loadValuedPosts({
            timeframe,
            interests,
            minValueThreshold,
            forceRefresh: false,
        }).catch((err) => {
            console.error('[MostValuedPage] Error loading posts:', err);
            setError('Failed to load valued posts. Please try again.');
        });
    }, [timeframe, interests, minValueThreshold, loadValuedPosts]);
    const visiblePosts = useMemo(() => {
        return filterChirpsForMostValued(valuedPosts, currentUser, forYouConfig);
    }, [valuedPosts, currentUser, forYouConfig]);
    return (_jsx(AppLayout, { pageTitle: "Most Valued", children: _jsxs("div", { className: "p-6 space-y-6", children: [_jsxs("div", { className: `flex flex-wrap items-center gap-3 ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`, children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-sm font-semibold", children: "Timeframe:" }), _jsx("div", { className: "flex flex-wrap gap-2", children: timeframes.map((option) => (_jsx("button", { onClick: () => setTimeframe(option.id), className: `px-3 py-1.5 text-xs font-semibold rounded-lg transition ${timeframe === option.id
                                            ? 'bg-accent text-white shadow-sm'
                                            : theme === 'dark'
                                                ? 'bg-white/10 text-white hover:bg-white/20'
                                                : 'bg-backgroundSubtle text-textPrimary hover:bg-backgroundHover'}`, children: option.label }, option.id))) })] }), _jsx("div", { className: "flex items-center gap-2", children: _jsxs("label", { className: "flex items-center gap-1 text-xs font-semibold cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: filterByInterests, onChange: (e) => setFilterByInterests(e.target.checked), className: "accent-accent" }), _jsx("span", { className: theme === 'dark' ? 'text-white/80' : 'text-textPrimary', children: "My interests only" })] }) }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsxs("label", { className: "text-xs font-semibold", children: ["Min value: ", (minValueThreshold * 100).toFixed(0)] }), _jsx("input", { type: "range", min: 0.3, max: 0.9, step: 0.05, value: minValueThreshold, onChange: (e) => setMinValueThreshold(Number(e.target.value)) })] })] }), error ? (_jsxs("div", { className: `py-12 text-center ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`, children: [_jsx("p", { className: "text-sm font-semibold mb-2", children: error }), _jsx("button", { onClick: () => {
                                setError(null);
                                loadValuedPosts({
                                    timeframe,
                                    interests,
                                    minValueThreshold,
                                    forceRefresh: true,
                                }).catch((err) => {
                                    console.error('[MostValuedPage] Error retrying:', err);
                                    setError('Failed to load valued posts. Please try again.');
                                });
                            }, className: `px-4 py-2 rounded-lg text-sm font-semibold transition ${theme === 'dark'
                                ? 'bg-white/10 text-white hover:bg-white/20'
                                : 'bg-backgroundHover text-textPrimary hover:bg-backgroundSubtle'}`, children: "Retry" })] })) : isLoadingList && visiblePosts.length === 0 ? (_jsx("div", { className: "space-y-4", children: [...Array(4)].map((_, idx) => (_jsx("div", { className: `h-32 rounded-xl animate-pulse ${theme === 'dark' ? 'bg-white/5' : 'bg-backgroundSubtle'}` }, idx))) })) : visiblePosts.length === 0 ? (_jsxs("div", { className: `py-12 text-center ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'}`, children: [_jsx("p", { className: "text-sm font-semibold", children: "No valued posts found." }), _jsx("p", { className: "text-xs mt-2", children: "Try adjusting timeframe or lowering the minimum value threshold." })] })) : (_jsx("div", { className: "space-y-4", children: visiblePosts.map((post) => (_jsx(ChirpCard, { chirp: post }, post.id))) })), _jsx("div", { className: "flex justify-center pt-4", children: hasMore ? (_jsx("button", { onClick: () => {
                            loadMoreValuedPosts({
                                timeframe,
                                interests,
                                minValueThreshold,
                            }).catch((err) => {
                                console.error('[MostValuedPage] Error loading more:', err);
                                setError('Failed to load more posts. Please try again.');
                            });
                        }, disabled: isLoadingMore, className: `px-4 py-2 rounded-lg text-sm font-semibold transition ${theme === 'dark'
                            ? 'bg-white/10 text-white hover:bg-white/20'
                            : 'bg-backgroundHover text-textPrimary hover:bg-backgroundSubtle'} disabled:opacity-50`, children: isLoadingMore ? 'Loading...' : 'Load more' })) : (visiblePosts.length > 0 && (_jsx("p", { className: `text-xs ${theme === 'dark' ? 'text-white/60' : 'text-textMuted'}`, children: "No more posts" }))) })] }) }));
};
export default MostValuedPage;
