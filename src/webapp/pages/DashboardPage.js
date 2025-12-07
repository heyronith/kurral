import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useUserStore } from '../store/useUserStore';
import { useThemeStore } from '../store/useThemeStore';
import { userService, chirpService, commentService } from '../lib/firestore';
import { initializeKurralScore } from '../lib/services/kurralScoreService';
import AppLayout from '../components/AppLayout';
const getKurralTier = (score) => {
    if (score >= 88)
        return 'Excellent';
    if (score >= 77)
        return 'Good';
    if (score >= 65)
        return 'Fair';
    if (score >= 53)
        return 'Poor';
    return 'Very Poor';
};
const getTierColor = (tier) => {
    switch (tier) {
        case 'Excellent': return 'text-green-600';
        case 'Good': return 'text-blue-600';
        case 'Fair': return 'text-yellow-600';
        case 'Poor': return 'text-orange-600';
        case 'Very Poor': return 'text-red-600';
        default: return 'text-textMuted';
    }
};
const DashboardPage = () => {
    const { currentUser, users } = useUserStore();
    const { theme } = useThemeStore();
    const [metrics, setMetrics] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    useEffect(() => {
        const loadDashboardData = async () => {
            if (!currentUser) {
                setIsLoading(false);
                return;
            }
            try {
                setIsLoading(true);
                // Ensure kurralScore is initialized
                let user = await userService.getUser(currentUser.id);
                if (!user) {
                    setIsLoading(false);
                    return;
                }
                if (!user.kurralScore) {
                    await initializeKurralScore(user.id);
                    user = await userService.getUser(currentUser.id);
                    if (!user) {
                        setIsLoading(false);
                        return;
                    }
                }
                // Load all posts and comments (limit to 500 for performance)
                const [allPosts, allComments] = await Promise.all([
                    chirpService.getChirpsByAuthor(currentUser.id, 500),
                    commentService.getCommentsByAuthor(currentUser.id, 500),
                ]);
                // Calculate followers count
                const followers = Object.values(users).filter(u => u.following && u.following.includes(currentUser.id));
                // Calculate recent activity (7 days)
                const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                const postsLast7d = allPosts.filter(p => p.createdAt >= sevenDaysAgo).length;
                const commentsLast7d = allComments.filter(c => c.createdAt >= sevenDaysAgo).length;
                const valueLast7d = allPosts
                    .filter(p => p.createdAt >= sevenDaysAgo && p.valueScore)
                    .reduce((sum, p) => sum + (p.valueScore?.total || 0), 0);
                // Content Quality Metrics
                const postsWithValue = allPosts.filter(p => p.valueScore);
                const averagePostValue = postsWithValue.length > 0
                    ? postsWithValue.reduce((sum, p) => sum + (p.valueScore?.total || 0), 0) / postsWithValue.length
                    : 0;
                const commentsWithValue = allComments.filter(c => c.valueContribution);
                const averageCommentValue = commentsWithValue.length > 0
                    ? commentsWithValue.reduce((sum, c) => sum + (c.valueContribution?.total || 0), 0) / commentsWithValue.length
                    : 0;
                const highValuePosts = postsWithValue.filter(p => (p.valueScore?.total || 0) > 0.7).length;
                const mediumValuePosts = postsWithValue.filter(p => {
                    const val = p.valueScore?.total || 0;
                    return val >= 0.4 && val <= 0.7;
                }).length;
                const lowValuePosts = postsWithValue.filter(p => (p.valueScore?.total || 0) < 0.4).length;
                // Fact-Check Metrics
                const cleanPosts = allPosts.filter(p => p.factCheckStatus === 'clean').length;
                const needsReviewPosts = allPosts.filter(p => p.factCheckStatus === 'needs_review').length;
                const blockedPosts = allPosts.filter(p => p.factCheckStatus === 'blocked').length;
                let verifiedClaims = 0;
                let falseClaims = 0;
                let unverifiedClaims = 0;
                allPosts.forEach(post => {
                    if (post.factChecks) {
                        post.factChecks.forEach(fc => {
                            if (fc.verdict === 'true')
                                verifiedClaims++;
                            else if (fc.verdict === 'false')
                                falseClaims++;
                            else if (fc.verdict === 'unknown' || fc.verdict === 'mixed')
                                unverifiedClaims++;
                        });
                    }
                });
                // Engagement Metrics
                const postsWithDiscussion = allPosts.filter(p => p.discussionQuality);
                const averageDiscussionQuality = postsWithDiscussion.length > 0
                    ? postsWithDiscussion.reduce((sum, p) => {
                        const dq = p.discussionQuality;
                        if (!dq)
                            return sum;
                        const avg = ((dq.informativeness || 0) + (dq.reasoningDepth || 0) +
                            (dq.crossPerspective || 0) + (dq.civility || 0)) / 4;
                        return sum + avg;
                    }, 0) / postsWithDiscussion.length
                    : 0;
                const highQualityDiscussions = postsWithDiscussion.filter(p => {
                    const dq = p.discussionQuality;
                    if (!dq)
                        return false;
                    const avg = ((dq.informativeness || 0) + (dq.reasoningDepth || 0) +
                        (dq.crossPerspective || 0) + (dq.civility || 0)) / 4;
                    return avg > 0.7;
                }).length;
                // Calculate total comments received on user's posts (use commentCount if available)
                const totalCommentsReceived = allPosts.reduce((sum, post) => sum + (post.commentCount || 0), 0);
                // Account age
                const accountAgeDays = Math.floor((Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24));
                // Monetization eligibility
                // Ensure score is clamped to 0-100 (safety check in case normalization didn't run)
                let kurralScoreValue = user.kurralScore?.score ?? 0;
                if (kurralScoreValue > 100) {
                    // Handle old scale migration
                    if (kurralScoreValue >= 300 && kurralScoreValue <= 850) {
                        kurralScoreValue = ((kurralScoreValue - 300) / (850 - 300)) * 100;
                    }
                    kurralScoreValue = Math.max(0, Math.min(100, kurralScoreValue));
                }
                kurralScoreValue = Math.max(0, Math.min(100, Math.round(kurralScoreValue)));
                const meetsScoreThreshold = kurralScoreValue >= 77;
                const meetsAccountAgeThreshold = accountAgeDays >= 30;
                const isMonetizationEligible = meetsScoreThreshold && meetsAccountAgeThreshold;
                // Value stats
                const valueStats = user.valueStats;
                const postValue30d = valueStats?.postValue30d ?? 0;
                const commentValue30d = valueStats?.commentValue30d ?? 0;
                const totalValue30d = postValue30d + commentValue30d;
                const lifetimePostValue = valueStats?.lifetimePostValue ?? 0;
                const lifetimeCommentValue = valueStats?.lifetimeCommentValue ?? 0;
                const totalLifetimeValue = lifetimePostValue + lifetimeCommentValue;
                // Kurral Score components
                const kurralComponents = user.kurralScore?.components || {
                    qualityHistory: 0,
                    violationHistory: 0,
                    engagementQuality: 0,
                    consistency: 0,
                    communityTrust: 0,
                };
                // Kurral Score history
                const kurralHistory = (user.kurralScore?.history || []).map(entry => ({
                    score: entry.score,
                    delta: entry.delta,
                    reason: entry.reason,
                    date: entry.date instanceof Date ? entry.date : new Date(entry.date),
                }));
                const dashboardMetrics = {
                    kurralScore: kurralScoreValue,
                    kurralTier: getKurralTier(kurralScoreValue),
                    kurralComponents,
                    kurralHistory,
                    postValue30d,
                    commentValue30d,
                    totalValue30d,
                    lifetimePostValue,
                    lifetimeCommentValue,
                    totalLifetimeValue,
                    totalPosts: allPosts.length,
                    totalComments: allComments.length,
                    followingCount: user.following?.length || 0,
                    followersCount: followers.length,
                    bookmarksCount: user.bookmarks?.length || 0,
                    accountAgeDays,
                    averagePostValue,
                    averageCommentValue,
                    highValuePosts,
                    mediumValuePosts,
                    lowValuePosts,
                    cleanPosts,
                    needsReviewPosts,
                    blockedPosts,
                    verifiedClaims,
                    falseClaims,
                    unverifiedClaims,
                    totalCommentsReceived,
                    averageDiscussionQuality,
                    highQualityDiscussions,
                    reputationByDomain: user.reputation || {},
                    isMonetizationEligible,
                    meetsScoreThreshold,
                    meetsAccountAgeThreshold,
                    postsLast7d,
                    commentsLast7d,
                    valueLast7d,
                };
                setMetrics(dashboardMetrics);
            }
            catch (error) {
                console.error('Error loading dashboard data:', error);
            }
            finally {
                setIsLoading(false);
            }
        };
        loadDashboardData();
    }, [currentUser, users]);
    if (isLoading) {
        return (_jsx(AppLayout, { pageTitle: "Dashboard", wrapContent: true, children: _jsx("div", { className: "min-h-screen flex items-center justify-center", children: _jsx("div", { className: theme === 'dark' ? 'text-white/70' : 'text-textMuted', children: "Loading dashboard..." }) }) }));
    }
    if (!metrics) {
        return (_jsx(AppLayout, { pageTitle: "Dashboard", wrapContent: true, children: _jsx("div", { className: "min-h-screen flex items-center justify-center", children: _jsx("div", { className: theme === 'dark' ? 'text-white/70' : 'text-textMuted', children: "No data available" }) }) }));
    }
    return (_jsx(AppLayout, { pageTitle: "Dashboard", wrapContent: true, children: _jsxs("div", { className: "max-w-7xl mx-auto px-4 py-8 space-y-8", children: [_jsxs("div", { className: "mb-8", children: [_jsx("h1", { className: `text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'} mb-2`, children: "Dashboard" }), _jsx("p", { className: theme === 'dark' ? 'text-white/70' : 'text-textMuted', children: "Your activity metrics and performance overview" })] }), _jsxs("section", { className: "grid grid-cols-1 md:grid-cols-3 gap-6", children: [_jsxs("div", { className: `${theme === 'dark' ? 'bg-transparent border-white/10' : 'bg-backgroundElevated border-border'} rounded-xl border p-6`, children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsx("h3", { className: `text-sm font-semibold ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'} uppercase tracking-wide`, children: "Kural Score" }), _jsx("span", { className: `text-xs font-semibold px-2 py-1 rounded-full ${getTierColor(metrics.kurralTier)} bg-opacity-10`, children: metrics.kurralTier })] }), _jsxs("div", { className: "mb-4", children: [_jsx("div", { className: `text-4xl font-bold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'} mb-2`, children: metrics.kurralScore.toFixed(0) }), _jsx("div", { className: `w-full h-3 ${theme === 'dark' ? 'bg-white/10' : 'bg-background'} rounded-full overflow-hidden`, children: _jsx("div", { className: "h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 transition-all duration-500", style: { width: `${metrics.kurralScore}%` } }) })] }), _jsxs("div", { className: "grid grid-cols-2 gap-2 text-xs", children: [_jsxs("div", { children: [_jsx("div", { className: theme === 'dark' ? 'text-white/70' : 'text-textMuted', children: "Quality" }), _jsx("div", { className: `font-semibold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`, children: metrics.kurralComponents.qualityHistory })] }), _jsxs("div", { children: [_jsx("div", { className: theme === 'dark' ? 'text-white/70' : 'text-textMuted', children: "Engagement" }), _jsx("div", { className: `font-semibold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`, children: metrics.kurralComponents.engagementQuality })] }), _jsxs("div", { children: [_jsx("div", { className: theme === 'dark' ? 'text-white/70' : 'text-textMuted', children: "Consistency" }), _jsx("div", { className: `font-semibold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`, children: metrics.kurralComponents.consistency })] }), _jsxs("div", { children: [_jsx("div", { className: theme === 'dark' ? 'text-white/70' : 'text-textMuted', children: "Trust" }), _jsx("div", { className: `font-semibold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`, children: metrics.kurralComponents.communityTrust })] })] })] }), _jsxs("div", { className: `${theme === 'dark' ? 'bg-transparent border-white/10' : 'bg-backgroundElevated border-border'} rounded-xl border p-6`, children: [_jsx("h3", { className: `text-sm font-semibold ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'} uppercase tracking-wide mb-4`, children: "Value (30d)" }), _jsxs("div", { className: "space-y-3", children: [_jsxs("div", { children: [_jsxs("div", { className: "flex justify-between text-sm mb-1", children: [_jsx("span", { className: theme === 'dark' ? 'text-white/70' : 'text-textMuted', children: "Posts" }), _jsx("span", { className: `font-semibold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`, children: (metrics.postValue30d * 100).toFixed(0) })] }), _jsx("div", { className: `w-full h-2 ${theme === 'dark' ? 'bg-white/10' : 'bg-background'} rounded-full overflow-hidden`, children: _jsx("div", { className: "h-full bg-accent transition-all duration-500", style: { width: `${Math.min(100, (metrics.postValue30d / Math.max(metrics.totalValue30d, 0.01)) * 100)}%` } }) })] }), _jsxs("div", { children: [_jsxs("div", { className: "flex justify-between text-sm mb-1", children: [_jsx("span", { className: theme === 'dark' ? 'text-white/70' : 'text-textMuted', children: "Comments" }), _jsx("span", { className: `font-semibold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`, children: (metrics.commentValue30d * 100).toFixed(0) })] }), _jsx("div", { className: `w-full h-2 ${theme === 'dark' ? 'bg-white/10' : 'bg-background'} rounded-full overflow-hidden`, children: _jsx("div", { className: "h-full bg-primary transition-all duration-500", style: { width: `${Math.min(100, (metrics.commentValue30d / Math.max(metrics.totalValue30d, 0.01)) * 100)}%` } }) })] }), _jsx("div", { className: `pt-2 border-t ${theme === 'dark' ? 'border-white/10' : 'border-border'}`, children: _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: `text-sm ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'}`, children: "Total" }), _jsx("span", { className: "text-lg font-bold text-accent", children: (metrics.totalValue30d * 100).toFixed(0) })] }) })] })] }), _jsxs("div", { className: `${theme === 'dark' ? 'bg-transparent border-white/10' : 'bg-backgroundElevated border-border'} rounded-xl border p-6`, children: [_jsx("h3", { className: `text-sm font-semibold ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'} uppercase tracking-wide mb-4`, children: "Monetization" }), _jsx("div", { className: "space-y-3", children: _jsxs("div", { className: `p-4 rounded-lg ${metrics.isMonetizationEligible ? 'bg-green-500/10 border border-green-500/20' : theme === 'dark' ? 'bg-transparent border-white/10' : 'bg-background border border-border'}`, children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsx("span", { className: `text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`, children: "Status" }), _jsx("span", { className: `text-xs font-semibold ${metrics.isMonetizationEligible ? 'text-green-600' : theme === 'dark' ? 'text-white/70' : 'text-textMuted'}`, children: metrics.isMonetizationEligible ? 'Eligible' : 'Not Eligible' })] }), _jsxs("div", { className: "space-y-1.5 text-xs", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: theme === 'dark' ? 'text-white/70' : 'text-textMuted', children: "Score \u2265 77" }), _jsxs("span", { className: metrics.meetsScoreThreshold ? 'text-green-600' : 'text-red-600', children: [metrics.meetsScoreThreshold ? '✓' : '✗', " ", metrics.kurralScore.toFixed(0)] })] }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: theme === 'dark' ? 'text-white/70' : 'text-textMuted', children: "Account Age \u2265 30d" }), _jsxs("span", { className: metrics.meetsAccountAgeThreshold ? 'text-green-600' : 'text-red-600', children: [metrics.meetsAccountAgeThreshold ? '✓' : '✗', " ", metrics.accountAgeDays, "d"] })] })] })] }) })] })] }), _jsxs("section", { className: `${theme === 'dark' ? 'bg-transparent border-white/10' : 'bg-backgroundElevated border-border'} rounded-xl border p-6`, children: [_jsx("h2", { className: `text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'} mb-6`, children: "Content Performance" }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6", children: [_jsxs("div", { children: [_jsx("div", { className: `text-sm ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'} mb-1`, children: "Total Posts" }), _jsx("div", { className: `text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`, children: metrics.totalPosts }), _jsxs("div", { className: `text-xs ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'} mt-1`, children: ["Avg Value: ", (metrics.averagePostValue * 100).toFixed(0)] })] }), _jsxs("div", { children: [_jsx("div", { className: `text-sm ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'} mb-1`, children: "Total Comments" }), _jsx("div", { className: `text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`, children: metrics.totalComments }), _jsxs("div", { className: `text-xs ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'} mt-1`, children: ["Avg Value: ", (metrics.averageCommentValue * 100).toFixed(0)] })] }), _jsxs("div", { children: [_jsx("div", { className: `text-sm ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'} mb-1`, children: "Comments Received" }), _jsx("div", { className: `text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`, children: metrics.totalCommentsReceived }), _jsx("div", { className: `text-xs ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'} mt-1`, children: "On your posts" })] }), _jsxs("div", { children: [_jsx("div", { className: `text-sm ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'} mb-1`, children: "Avg Discussion Quality" }), _jsx("div", { className: `text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`, children: (metrics.averageDiscussionQuality * 100).toFixed(0) }), _jsxs("div", { className: `text-xs ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'} mt-1`, children: [metrics.highQualityDiscussions, " high-quality"] })] })] }), _jsxs("div", { className: `mt-6 pt-6 border-t ${theme === 'dark' ? 'border-white/10' : 'border-border'}`, children: [_jsx("h3", { className: `text-sm font-semibold ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'} mb-4`, children: "Post Quality Distribution" }), _jsxs("div", { className: "grid grid-cols-3 gap-4", children: [_jsxs("div", { className: `text-center p-4 ${theme === 'dark' ? 'bg-transparent border-white/10' : 'bg-background'} rounded-lg border`, children: [_jsx("div", { className: "text-2xl font-bold text-green-600", children: metrics.highValuePosts }), _jsx("div", { className: `text-xs ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'} mt-1`, children: "High (70+)" })] }), _jsxs("div", { className: `text-center p-4 ${theme === 'dark' ? 'bg-transparent border-white/10' : 'bg-background'} rounded-lg border`, children: [_jsx("div", { className: "text-2xl font-bold text-yellow-600", children: metrics.mediumValuePosts }), _jsx("div", { className: `text-xs ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'} mt-1`, children: "Medium (40-70)" })] }), _jsxs("div", { className: `text-center p-4 ${theme === 'dark' ? 'bg-transparent border-white/10' : 'bg-background'} rounded-lg border`, children: [_jsx("div", { className: "text-2xl font-bold text-red-600", children: metrics.lowValuePosts }), _jsx("div", { className: `text-xs ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'} mt-1`, children: "Low (<40)" })] })] })] })] }), _jsxs("section", { className: `${theme === 'dark' ? 'bg-transparent border-white/10' : 'bg-backgroundElevated border-border'} rounded-xl border p-6`, children: [_jsx("h2", { className: `text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'} mb-6`, children: "Fact-Check & Policy Compliance" }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-6", children: [_jsxs("div", { children: [_jsx("h3", { className: `text-sm font-semibold ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'} mb-4`, children: "Post Status" }), _jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: `flex items-center justify-between p-3 ${theme === 'dark' ? 'bg-transparent border-white/10' : 'bg-background'} rounded-lg border`, children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "w-3 h-3 rounded-full bg-green-500" }), _jsx("span", { className: `text-sm ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`, children: "Clean" })] }), _jsx("span", { className: `font-semibold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`, children: metrics.cleanPosts })] }), _jsxs("div", { className: `flex items-center justify-between p-3 ${theme === 'dark' ? 'bg-transparent border-white/10' : 'bg-background'} rounded-lg border`, children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "w-3 h-3 rounded-full bg-yellow-500" }), _jsx("span", { className: `text-sm ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`, children: "Needs Review" })] }), _jsx("span", { className: `font-semibold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`, children: metrics.needsReviewPosts })] }), _jsxs("div", { className: `flex items-center justify-between p-3 ${theme === 'dark' ? 'bg-transparent border-white/10' : 'bg-background'} rounded-lg border`, children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "w-3 h-3 rounded-full bg-red-500" }), _jsx("span", { className: `text-sm ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`, children: "Blocked" })] }), _jsx("span", { className: `font-semibold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`, children: metrics.blockedPosts })] })] })] }), _jsxs("div", { children: [_jsx("h3", { className: `text-sm font-semibold ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'} mb-4`, children: "Claims Verification" }), _jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: `flex items-center justify-between p-3 ${theme === 'dark' ? 'bg-transparent border-white/10' : 'bg-background'} rounded-lg border`, children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "w-3 h-3 rounded-full bg-green-500" }), _jsx("span", { className: `text-sm ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`, children: "Verified" })] }), _jsx("span", { className: `font-semibold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`, children: metrics.verifiedClaims })] }), _jsxs("div", { className: `flex items-center justify-between p-3 ${theme === 'dark' ? 'bg-transparent border-white/10' : 'bg-background'} rounded-lg border`, children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "w-3 h-3 rounded-full bg-red-500" }), _jsx("span", { className: `text-sm ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`, children: "False" })] }), _jsx("span", { className: `font-semibold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`, children: metrics.falseClaims })] }), _jsxs("div", { className: `flex items-center justify-between p-3 ${theme === 'dark' ? 'bg-transparent border-white/10' : 'bg-background'} rounded-lg border`, children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "w-3 h-3 rounded-full bg-gray-500" }), _jsx("span", { className: `text-sm ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`, children: "Unverified" })] }), _jsx("span", { className: `font-semibold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`, children: metrics.unverifiedClaims })] })] })] })] })] }), _jsxs("section", { className: `${theme === 'dark' ? 'bg-transparent border-white/10' : 'bg-backgroundElevated border-border'} rounded-xl border p-6`, children: [_jsx("h2", { className: `text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'} mb-6`, children: "Activity & Social" }), _jsxs("div", { className: "grid grid-cols-2 md:grid-cols-4 gap-6", children: [_jsxs("div", { className: `text-center p-4 ${theme === 'dark' ? 'bg-transparent border-white/10' : 'bg-background'} rounded-lg border`, children: [_jsx("div", { className: `text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`, children: metrics.followingCount }), _jsx("div", { className: `text-xs ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'} mt-1`, children: "Following" })] }), _jsxs("div", { className: `text-center p-4 ${theme === 'dark' ? 'bg-transparent border-white/10' : 'bg-background'} rounded-lg border`, children: [_jsx("div", { className: `text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`, children: metrics.followersCount }), _jsx("div", { className: `text-xs ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'} mt-1`, children: "Followers" })] }), _jsxs("div", { className: `text-center p-4 ${theme === 'dark' ? 'bg-transparent border-white/10' : 'bg-background'} rounded-lg border`, children: [_jsx("div", { className: `text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`, children: metrics.bookmarksCount }), _jsx("div", { className: `text-xs ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'} mt-1`, children: "Bookmarks" })] }), _jsxs("div", { className: `text-center p-4 ${theme === 'dark' ? 'bg-transparent border-white/10' : 'bg-background'} rounded-lg border`, children: [_jsx("div", { className: `text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`, children: metrics.accountAgeDays }), _jsx("div", { className: `text-xs ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'} mt-1`, children: "Days Active" })] })] }), _jsxs("div", { className: `mt-6 pt-6 border-t ${theme === 'dark' ? 'border-white/10' : 'border-border'}`, children: [_jsx("h3", { className: `text-sm font-semibold ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'} mb-4`, children: "Recent Activity (Last 7 Days)" }), _jsxs("div", { className: "grid grid-cols-3 gap-4", children: [_jsxs("div", { className: `text-center p-4 ${theme === 'dark' ? 'bg-transparent border-white/10' : 'bg-background'} rounded-lg border`, children: [_jsx("div", { className: `text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`, children: metrics.postsLast7d }), _jsx("div", { className: `text-xs ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'} mt-1`, children: "Posts" })] }), _jsxs("div", { className: `text-center p-4 ${theme === 'dark' ? 'bg-transparent border-white/10' : 'bg-background'} rounded-lg border`, children: [_jsx("div", { className: `text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`, children: metrics.commentsLast7d }), _jsx("div", { className: `text-xs ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'} mt-1`, children: "Comments" })] }), _jsxs("div", { className: `text-center p-4 ${theme === 'dark' ? 'bg-transparent border-white/10' : 'bg-background'} rounded-lg border`, children: [_jsx("div", { className: "text-2xl font-bold text-accent", children: (metrics.valueLast7d * 100).toFixed(0) }), _jsx("div", { className: `text-xs ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'} mt-1`, children: "Value Generated" })] })] })] })] }), Object.keys(metrics.reputationByDomain).length > 0 && (_jsxs("section", { className: `${theme === 'dark' ? 'bg-transparent border-white/10' : 'bg-backgroundElevated border-border'} rounded-xl border p-6`, children: [_jsx("h2", { className: `text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'} mb-6`, children: "Reputation by Domain" }), _jsx("div", { className: "grid grid-cols-2 md:grid-cols-4 gap-4", children: Object.entries(metrics.reputationByDomain)
                                .sort(([, a], [, b]) => b - a)
                                .slice(0, 8)
                                .map(([domain, score]) => (_jsxs("div", { className: `p-4 ${theme === 'dark' ? 'bg-transparent border-white/10' : 'bg-background'} rounded-lg border`, children: [_jsx("div", { className: `text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'} capitalize mb-1`, children: domain }), _jsx("div", { className: "text-2xl font-bold text-accent", children: (score * 100).toFixed(0) })] }, domain))) })] }))] }) }));
};
export default DashboardPage;
