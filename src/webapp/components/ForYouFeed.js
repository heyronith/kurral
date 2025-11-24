import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef } from 'react';
import { useFeedStore } from '../store/useFeedStore';
import { useConfigStore } from '../store/useConfigStore';
import ChirpCard from './ChirpCard';
const ForYouFeed = () => {
    const getForYouFeed = useFeedStore((state) => state.getForYouFeed);
    const config = useConfigStore((state) => state.forYouConfig);
    const scoredChirps = getForYouFeed();
    const prevConfigRef = useRef(config);
    const prevCountRef = useRef(scoredChirps.length);
    // Log when feed recalculates
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
    if (scoredChirps.length === 0) {
        return (_jsx("div", { className: "p-8 space-y-4", children: _jsxs("div", { className: "text-center text-textMuted", children: [_jsx("p", { className: "text-sm font-medium mb-1", children: "No chirps match your For You settings." }), _jsx("p", { className: "text-xs mt-2", children: "Try adjusting your preferences in the controls above." })] }) }));
    }
    return (_jsx("div", { className: "px-4 py-4", children: scoredChirps.map((scoredChirp) => (_jsxs("div", { className: "mb-4", children: [_jsxs("div", { className: "mb-2 px-3 py-2 text-xs text-textMuted bg-backgroundElevated/50 rounded-lg border border-border/40", children: [_jsx("span", { className: "font-medium text-textLabel", children: "Why this post:" }), ' ', _jsx("span", { className: "text-textSecondary", children: scoredChirp.explanation })] }), _jsx(ChirpCard, { chirp: scoredChirp.chirp })] }, scoredChirp.chirp.id))) }));
};
export default ForYouFeed;
