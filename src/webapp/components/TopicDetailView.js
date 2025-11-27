import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Topic Detail View - Shows posts for a specific topic
import { useEffect, useState } from 'react';
import { useTopicStore } from '../store/useTopicStore';
import { useThemeStore } from '../store/useThemeStore';
import { getPostsByTopic } from '../lib/services/postAggregationService';
import ChirpCard from './ChirpCard';
import Composer from './Composer';
const TopicDetailView = () => {
    const { selectedTopic, clearTopicSelection } = useTopicStore();
    const { theme } = useThemeStore();
    const [topicPosts, setTopicPosts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    // Fetch posts for the topic
    useEffect(() => {
        if (!selectedTopic) {
            setTopicPosts([]);
            setIsLoading(false);
            return;
        }
        const fetchTopicPosts = async () => {
            setIsLoading(true);
            try {
                // Get posts from last 7 days (wider window for topic view to ensure we show posts)
                // Trending topics might have recent activity but posts could be spread over days
                const posts = await getPostsByTopic(selectedTopic, 168, 200); // 168 hours = 7 days
                // Sort chronologically (oldest first)
                posts.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
                console.log(`[TopicDetailView] Loaded ${posts.length} posts for topic "${selectedTopic}"`);
                setTopicPosts(posts);
            }
            catch (error) {
                console.error('[TopicDetailView] Error fetching topic posts:', error);
                setTopicPosts([]);
            }
            finally {
                setIsLoading(false);
            }
        };
        fetchTopicPosts();
    }, [selectedTopic]);
    // Comments will be loaded automatically by ChirpCard components
    if (!selectedTopic) {
        return null;
    }
    return (_jsxs("div", { className: "w-full", children: [_jsx("div", { className: `mb-6 pb-4 border-b ${theme === 'dark' ? 'border-white/10' : 'border-border/60'}`, children: _jsxs("div", { className: "flex items-center gap-4", children: [_jsx("button", { onClick: clearTopicSelection, className: `flex items-center justify-center w-10 h-10 rounded-lg ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-backgroundElevated/60'} transition-colors`, "aria-label": "Back", children: _jsx("svg", { className: `w-5 h-5 ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`, fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M15 19l-7-7 7-7" }) }) }), _jsxs("div", { className: "flex-1", children: [_jsxs("h1", { className: `text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`, children: ["#", selectedTopic] }), _jsx("p", { className: `text-sm ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'} mt-1`, children: isLoading ? 'Loading...' : `${topicPosts.length} post${topicPosts.length !== 1 ? 's' : ''} about this topic` })] })] }) }), _jsx(Composer, {}), isLoading ? (_jsx("div", { className: "py-12 text-center", children: _jsx("p", { className: theme === 'dark' ? 'text-white/70' : 'text-textMuted', children: "Loading posts..." }) })) : topicPosts.length === 0 ? (_jsxs("div", { className: "py-12 text-center", children: [_jsx("p", { className: theme === 'dark' ? 'text-white/70' : 'text-textMuted', children: "No posts found for this topic yet." }), _jsxs("p", { className: `text-sm ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'} mt-2`, children: ["Be the first to post about #", selectedTopic, "!"] })] })) : (_jsx("div", { className: "mt-6 space-y-4", children: topicPosts.map((post) => (_jsx(ChirpCard, { chirp: post }, post.id))) }))] }));
};
export default TopicDetailView;
