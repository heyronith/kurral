import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useUserStore } from '../store/useUserStore';
import { useFeedStore } from '../store/useFeedStore';
import { chirpService } from '../lib/firestore';
import ChirpCard from '../components/ChirpCard';
import AppLayout from '../components/AppLayout';
const BookmarksPage = () => {
    const { currentUser } = useUserStore();
    const { loadChirps } = useFeedStore();
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
                setBookmarkedChirps(validChirps);
                loadChirps(validChirps);
                // Load authors for chirps
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
        return (_jsx(AppLayout, { wrapContent: true, children: _jsx("div", { className: "p-8 text-center text-textMuted", children: _jsx("p", { children: "Loading bookmarks..." }) }) }));
    }
    return (_jsxs(AppLayout, { wrapContent: true, children: [_jsxs("div", { className: "border-b border-border/60 px-4 py-4", children: [_jsx("h1", { className: "text-xl font-bold text-textPrimary", children: "Bookmarks" }), _jsx("p", { className: "text-sm text-textMuted mt-1", children: bookmarkedChirps.length === 0
                            ? 'No bookmarks yet'
                            : `${bookmarkedChirps.length} ${bookmarkedChirps.length === 1 ? 'bookmark' : 'bookmarks'}` })] }), _jsx("div", { children: bookmarkedChirps.length === 0 ? (_jsxs("div", { className: "p-8 text-center text-textMuted", children: [_jsx("p", { children: "You haven't bookmarked any posts yet." }), _jsx("p", { className: "text-sm mt-2", children: "Bookmark posts to save them for later." })] })) : (bookmarkedChirps.map((chirp) => _jsx(ChirpCard, { chirp: chirp }, chirp.id))) })] }));
};
export default BookmarksPage;
