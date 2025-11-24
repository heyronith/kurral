import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Trending News Section - Displays top 3 trending news headlines
import { useEffect } from 'react';
import { useNewsStore } from '../store/useNewsStore';
import { useUserStore } from '../store/useUserStore';
const TrendingNewsSection = () => {
    const { trendingNews, isLoading, loadTrendingNews, selectNews, lastUpdated, refreshNews, error } = useNewsStore();
    const { currentUser } = useUserStore();
    const interestsKey = currentUser?.interests?.join('|') ?? '';
    // Load trending news on mount and when interests change
    useEffect(() => {
        let isCancelled = false;
        const userId = currentUser?.id ?? null;
        const loadNews = async () => {
            if (!isCancelled) {
                await loadTrendingNews(userId, true);
            }
        };
        loadNews();
        return () => {
            isCancelled = true;
        };
    }, [loadTrendingNews, currentUser?.id, interestsKey]);
    // Show last updated time
    const getLastUpdatedText = () => {
        if (!lastUpdated)
            return '';
        const now = new Date();
        const diffMs = now.getTime() - lastUpdated.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        if (diffMins < 1)
            return 'Updated just now';
        if (diffMins < 60)
            return `Updated ${diffMins}m ago`;
        if (diffHours < 24)
            return `Updated ${diffHours}h ago`;
        return `Updated ${Math.floor(diffHours / 24)}d ago`;
    };
    // Format relative time
    const formatTimeAgo = (date) => {
        if (!date)
            return 'Unknown';
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        if (diffMs < 0)
            return 'Just now'; // Handle future dates
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        if (diffMins < 1)
            return 'Just now';
        if (diffMins < 60)
            return `${diffMins}m ago`;
        if (diffHours < 24)
            return `${diffHours}h ago`;
        if (diffDays === 1)
            return '1 day ago';
        return `${diffDays} days ago`;
    };
    // Format engagement count
    const formatEngagement = (count) => {
        if (count >= 1000000) {
            return `${(count / 1000000).toFixed(1)}M posts`;
        }
        if (count >= 1000) {
            return `${(count / 1000).toFixed(1)}K posts`;
        }
        return `${count} posts`;
    };
    // Get category color
    const getCategoryColor = (category) => {
        const colors = {
            technology: 'bg-blue-500/20 text-blue-400',
            business: 'bg-green-500/20 text-green-400',
            entertainment: 'bg-purple-500/20 text-purple-400',
            sports: 'bg-orange-500/20 text-orange-400',
            health: 'bg-red-500/20 text-red-400',
            science: 'bg-cyan-500/20 text-cyan-400',
            general: 'bg-gray-500/20 text-gray-400',
        };
        return colors[category.toLowerCase()] || colors.general;
    };
    if (isLoading && trendingNews.length === 0) {
        return (_jsxs("div", { className: "rounded-2xl border-2 border-border/60 bg-background/70 p-4 shadow-sm backdrop-blur", children: [_jsx("h3", { className: "mb-3 text-sm font-semibold text-textPrimary", children: "Today's News" }), _jsx("div", { className: "py-4 text-center", children: _jsx("p", { className: "text-xs text-textMuted", children: "Loading trending news..." }) })] }));
    }
    if (error && trendingNews.length === 0) {
        return (_jsxs("div", { className: "rounded-2xl border-2 border-border/60 bg-background/70 p-4 shadow-sm backdrop-blur", children: [_jsx("h3", { className: "mb-3 text-sm font-semibold text-textPrimary", children: "Today's News" }), _jsxs("div", { className: "py-4 text-center", children: [_jsx("p", { className: "text-xs text-error mb-2", children: error }), _jsx("button", { onClick: () => refreshNews(), className: "text-xs text-primary hover:text-primaryHover transition-colors", children: "Try again" })] })] }));
    }
    if (trendingNews.length === 0) {
        return (_jsxs("div", { className: "rounded-2xl border-2 border-border/60 bg-background/70 p-4 shadow-sm backdrop-blur", children: [_jsx("h3", { className: "mb-3 text-sm font-semibold text-textPrimary", children: "Today's News" }), _jsx("div", { className: "py-4 text-center", children: _jsx("p", { className: "text-xs text-textMuted", children: "No trending news available" }) })] }));
    }
    return (_jsxs("div", { className: "rounded-2xl border-2 border-border/60 bg-background/70 p-4 shadow-sm backdrop-blur", children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsx("h3", { className: "text-sm font-semibold text-textPrimary", children: "Today's News" }), _jsxs("div", { className: "flex items-center gap-2", children: [lastUpdated && (_jsx("span", { className: "text-[10px] text-textMuted", title: `News refreshes every 3 hours. Last updated: ${lastUpdated.toLocaleString()}`, children: getLastUpdatedText() })), _jsx("button", { onClick: async () => {
                                    try {
                                        await refreshNews();
                                    }
                                    catch (error) {
                                        console.error('Error refreshing news:', error);
                                    }
                                }, disabled: isLoading, className: "p-1 rounded hover:bg-background/60 transition-colors disabled:opacity-50", title: "Refresh news", children: _jsx("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", className: `text-textMuted ${isLoading ? 'animate-spin' : ''}`, children: _jsx("path", { d: "M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" }) }) })] })] }), _jsx("div", { className: "space-y-3", children: trendingNews.map((news, index) => {
                    const isRecent = news.publishedAt && (Date.now() - news.publishedAt.getTime() < 2 * 60 * 60 * 1000); // Less than 2 hours
                    return (_jsxs("button", { onClick: () => selectNews(news.id), className: "w-full rounded-xl px-3 py-2.5 text-left transition hover:bg-background/60 group", children: [_jsxs("div", { className: "flex items-center justify-between mb-1.5", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsxs("span", { className: "text-xs text-textMuted", children: ["#", index + 1] }), isRecent && (_jsx("span", { className: "px-1.5 py-0.5 text-[10px] font-medium bg-primary/20 text-primary rounded", children: "Trending now" })), !isRecent && (_jsx("span", { className: "text-xs text-textMuted", children: formatTimeAgo(news.publishedAt) }))] }), _jsx("span", { className: `px-2 py-0.5 text-[10px] font-medium rounded capitalize ${getCategoryColor(news.category)}`, children: news.category })] }), _jsx("p", { className: "text-sm font-semibold text-textPrimary mb-2 line-clamp-2 group-hover:text-primary transition-colors", children: news.title }), _jsx("div", { className: "flex items-center justify-end", children: _jsx("p", { className: "text-xs text-textMuted", children: formatEngagement(news.engagementCount) }) })] }, news.id));
                }) })] }));
};
export default TrendingNewsSection;
