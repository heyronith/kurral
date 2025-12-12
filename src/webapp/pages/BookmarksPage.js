import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useUserStore } from '../store/useUserStore';
import { useFeedStore } from '../store/useFeedStore';
import { useThemeStore } from '../store/useThemeStore';
import { chirpService } from '../lib/firestore';
import { filterChirpsForViewer } from '../lib/utils/chirpVisibility';
import ChirpCard from '../components/ChirpCard';
import AppLayout from '../components/AppLayout';
const BookmarksPage = () => {
    const { currentUser } = useUserStore();
    const { loadChirps } = useFeedStore();
    const { theme } = useThemeStore();
    const [bookmarkedChirps, setBookmarkedChirps] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    useEffect(() => {
        const loadBookmarks = async () => {
            if (!currentUser) {
                setIsLoading(false);
                return;
            }
            try {
                setIsLoading(true);
                const bookmarkIds = currentUser.bookmarks || [];
                if (bookmarkIds.length === 0) {
                    setBookmarkedChirps([]);
                    setIsLoading(false);
                    return;
                }
                // Load all bookmarked chirps
                const chirps = await Promise.all(bookmarkIds.map((id) => chirpService.getChirp(id)));
                // Filter out nulls and sort by creation date (newest first)
                const validChirps = chirps
                    .filter((chirp) => chirp !== null)
                    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
                const visibleChirps = filterChirpsForViewer(validChirps, currentUser?.id);
                setBookmarkedChirps(visibleChirps);
                // Load all chirps (including blocked) into store for potential author access
                loadChirps(validChirps);
                // Load authors for chirps (use validChirps to ensure we load all authors)
                const authorIds = new Set(validChirps.map((c) => c.authorId));
                const { loadUser } = useUserStore.getState();
                for (const authorId of authorIds) {
                    await loadUser(authorId);
                }
            }
            catch (error) {
                console.error('Error loading bookmarks:', error);
            }
            finally {
                setIsLoading(false);
            }
        };
        loadBookmarks();
    }, [currentUser, loadChirps]);
    if (isLoading) {
        return (_jsx(AppLayout, { wrapContent: true, children: _jsx("div", { className: `p-8 text-center ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'}`, children: _jsx("p", { children: "Loading bookmarks..." }) }) }));
    }
    return (_jsxs(AppLayout, { wrapContent: true, children: [_jsxs("div", { className: `border-b ${theme === 'dark' ? 'border-white/10' : 'border-border/60'} px-4 py-4`, children: [_jsx("h1", { className: `text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`, children: "Bookmarks" }), _jsx("p", { className: `text-sm ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'} mt-1`, children: bookmarkedChirps.length === 0
                            ? 'No bookmarks yet'
                            : `${bookmarkedChirps.length} ${bookmarkedChirps.length === 1 ? 'bookmark' : 'bookmarks'}` })] }), _jsx("div", { children: bookmarkedChirps.length === 0 ? (_jsxs("div", { className: `p-8 text-center ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'}`, children: [_jsx("p", { children: "You haven't bookmarked any posts yet." }), _jsx("p", { className: "text-sm mt-2", children: "Bookmark posts to save them for later." })] })) : (bookmarkedChirps.map((chirp) => _jsx(ChirpCard, { chirp: chirp }, chirp.id))) })] }));
};
export default BookmarksPage;
