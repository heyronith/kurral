import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect } from 'react';
import { useFeedStore } from '../store/useFeedStore';
import { useUserStore } from '../store/useUserStore';
import { generateMockUsers, generateMockChirps } from '../data/mockData';
import Composer from './Composer';
import FeedTabs from './FeedTabs';
import LatestFeed from './LatestFeed';
import ForYouFeed from './ForYouFeed';
import ForYouControls from './ForYouControls';
const AppSection = () => {
    const { activeFeed, setActiveFeed, loadChirps } = useFeedStore();
    const { setCurrentUser } = useUserStore();
    // Initialize mock data on mount (for landing page demo)
    useEffect(() => {
        const users = generateMockUsers();
        const chirps = generateMockChirps(users);
        // Load all users into store
        const { addUser } = useUserStore.getState();
        users.forEach((user) => {
            addUser(user);
        });
        // Set first user as current user (after loading)
        if (users.length > 0) {
            setCurrentUser(users[0]);
        }
        // Load chirps
        loadChirps(chirps);
    }, [setCurrentUser, loadChirps]);
    return (_jsx("section", { id: "app", className: "section-container py-16 min-h-screen", children: _jsxs("div", { className: "max-w-4xl mx-auto", children: [_jsxs("div", { className: "text-center mb-12", children: [_jsx("h2", { className: "text-3xl font-semibold text-textPrimary mb-4", children: "Try Kurral" }), _jsx("p", { className: "text-lg text-textMuted", children: "Experience the minimalist social feed you control" })] }), _jsxs("div", { className: "border border-border rounded-lg bg-background/50 overflow-hidden", children: [_jsx(Composer, {}), _jsx(FeedTabs, { activeFeed: activeFeed, onFeedChange: setActiveFeed }), activeFeed === 'forYou' && _jsx(ForYouControls, {}), _jsx("div", { className: "min-h-[400px] max-h-[600px] overflow-y-auto", children: activeFeed === 'latest' ? _jsx(LatestFeed, {}) : _jsx(ForYouFeed, {}) })] })] }) }));
};
export default AppSection;
