import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useRef } from 'react';
import { generateForYouFeed } from '../lib/algorithm';
import { useFeedStore } from '../store/useFeedStore';
import { useUserStore } from '../store/useUserStore';
import { useConfigStore } from '../store/useConfigStore';
import { useThemeStore } from '../store/useThemeStore';
import ChirpCard from './ChirpCard';
const ForYouFeed = () => {
    const chirps = useFeedStore((state) => state.chirps);
    const config = useConfigStore((state) => state.forYouConfig);
    const currentUser = useUserStore((state) => state.currentUser);
    const getUser = useUserStore((state) => state.getUser);
    const { theme } = useThemeStore();
    const scoredChirps = useMemo(() => {
        if (!currentUser)
            return [];
        return generateForYouFeed(chirps, currentUser, config, getUser);
    }, [chirps, currentUser, config, getUser]);
    const prevConfigRef = useRef(config);
    const prevCountRef = useRef(scoredChirps.length);
    useEffect(() => {
        const configChanged = JSON.stringify(prevConfigRef.current) !== JSON.stringify(config);
        const countChanged = prevCountRef.current !== scoredChirps.length;
        if (configChanged) {
            console.log('[ForYouFeed] Feed recalculated due to config change:', {
                config,
                postCount: scoredChirps.length,
                previousCount: prevCountRef.current,
            });
            prevConfigRef.current = config;
        }
        if (countChanged && !configChanged) {
            console.log('[ForYouFeed] Post count changed:', {
                previous: prevCountRef.current,
                current: scoredChirps.length,
            });
        }
        prevCountRef.current = scoredChirps.length;
    }, [config, scoredChirps.length]);
    const emptyReason = useMemo(() => {
        if (!currentUser) {
            return 'Log in to personalize your For You feed.';
        }
        if (chirps.length === 0) {
            return 'No posts have been published yet. Check back soon or invite a few people to post.';
        }
        const hasFollowing = (currentUser.following?.length || 0) > 0;
        const hasInterests = (currentUser.interests?.length || 0) > 0;
        if (!hasFollowing && !hasInterests) {
            return 'You are not following anyone and have no interests yet.';
        }
        if (config.mutedTopics.length >= 3) {
            return 'Your muted topics may be filtering out too much content.';
        }
        return 'Try adjusting your tuning controls or follow a few more creators.';
    }, [chirps.length, config.mutedTopics.length, currentUser]);
    if (scoredChirps.length === 0) {
        return (_jsx("div", { className: "p-8 space-y-4", children: _jsxs("div", { className: `text-center ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'}`, children: [_jsx("p", { className: "text-sm font-medium mb-1", children: "No posts match your For You settings." }), _jsx("p", { className: "text-xs mt-2", children: emptyReason }), _jsx("p", { className: "text-[10px] mt-1", children: "Try adjusting your preferences in the controls above." })] }) }));
    }
    return (_jsx("div", { className: "px-4 py-4", children: scoredChirps.map((scoredChirp) => (_jsxs("div", { className: "mb-4", children: [_jsxs("div", { className: `mb-2 px-3 py-2 text-xs ${theme === 'dark' ? 'text-white/70 bg-transparent border-white/20' : 'text-textMuted bg-backgroundElevated/50 border-border/40'} rounded-lg border`, children: [_jsx("span", { className: `font-medium ${theme === 'dark' ? 'text-white' : 'text-textLabel'}`, children: "Why this post:" }), ' ', _jsx("span", { className: theme === 'dark' ? 'text-white/70' : 'text-textSecondary', children: scoredChirp.explanation })] }), _jsx(ChirpCard, { chirp: scoredChirp.chirp })] }, scoredChirp.chirp.id))) }));
};
export default ForYouFeed;
