import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Topic Detail View - Shows posts for a specific topic
import { useEffect, useState } from 'react';
import { useTopicStore } from '../store/useTopicStore';
import { getPostsByTopic } from '../lib/services/postAggregationService';
import ChirpCard from './ChirpCard';
import Composer from './Composer';
const TopicDetailView = () => {
    const { selectedTopic, clearTopicSelection } = useTopicStore();
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
                // Get posts from last 48 hours (wider window for topic view)
                const posts = await getPostsByTopic(selectedTopic, 48, 200);
                // Sort chronologically (oldest first)
                posts.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
                setTopicPosts(posts);
            }
            catch (error) {
                console.error('Error fetching topic posts:', error);
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
    return (_jsxs("div", { className: "w-full", children: [_jsx("div", { className: "mb-6 pb-4 border-b border-border/60", children: _jsxs("div", { className: "flex items-center gap-4", children: [_jsx("button", { onClick: clearTopicSelection, className: "flex items-center justify-center w-10 h-10 rounded-lg hover:bg-backgroundElevated/60 transition-colors", "aria-label": "Back", children: _jsx("svg", { className: "w-5 h-5 text-textPrimary", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M15 19l-7-7 7-7" }) }) }), _jsxs("div", { className: "flex-1", children: [_jsxs("h1", { className: "text-2xl font-bold text-textPrimary", children: ["#", selectedTopic] }), _jsx("p", { className: "text-sm text-textMuted mt-1", children: isLoading ? 'Loading...' : `${topicPosts.length} post${topicPosts.length !== 1 ? 's' : ''} about this topic` })] })] }) }), _jsx(Composer, {}), isLoading ? (_jsx("div", { className: "py-12 text-center", children: _jsx("p", { className: "text-textMuted", children: "Loading posts..." }) })) : topicPosts.length === 0 ? (_jsxs("div", { className: "py-12 text-center", children: [_jsx("p", { className: "text-textMuted", children: "No posts found for this topic yet." }), _jsxs("p", { className: "text-sm text-textMuted mt-2", children: ["Be the first to post about #", selectedTopic, "!"] })] })) : (_jsx("div", { className: "mt-6 space-y-4", children: topicPosts.map((post) => (_jsx(ChirpCard, { chirp: post }, post.id))) }))] }));
};
export default TopicDetailView;
