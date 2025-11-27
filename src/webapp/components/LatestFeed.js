import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useFeedStore } from '../store/useFeedStore';
import { useUserStore } from '../store/useUserStore';
import { useThemeStore } from '../store/useThemeStore';
import ChirpCard from './ChirpCard';
const LatestFeed = () => {
    const chirps = useFeedStore((state) => state.chirps);
    const currentUser = useUserStore((state) => state.currentUser);
    const { theme } = useThemeStore();
    // Filter to followed users only (excluding own chirps), sort by createdAt DESC
    const latestChirps = currentUser
        ? chirps
            .filter((chirp) => chirp.authorId !== currentUser.id && currentUser.following.includes(chirp.authorId))
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        : [];
    if (latestChirps.length === 0) {
        return (_jsxs("div", { className: `p-8 text-center ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'}`, children: [_jsx("p", { children: "No posts yet. Follow some users to see their posts here." }), _jsx("p", { className: "text-sm mt-2", children: "Because: Latest \u2013 pure chronological" })] }));
    }
    return (_jsx("div", { className: "px-4 py-4", children: latestChirps.map((chirp) => (_jsx(ChirpCard, { chirp: chirp }, chirp.id))) }));
};
export default LatestFeed;
