import { useEffect, useState } from 'react';
import { useUserStore } from '../store/useUserStore';
import { useFeedStore } from '../store/useFeedStore';
import { useThemeStore } from '../store/useThemeStore';
import { chirpService } from '../lib/firestore';
import ChirpCard from '../components/ChirpCard';
import AppLayout from '../components/AppLayout';
import type { Chirp } from '../types';

const BookmarksPage = () => {
  const { currentUser } = useUserStore();
  const { loadChirps } = useFeedStore();
  const { theme } = useThemeStore();
  const [bookmarkedChirps, setBookmarkedChirps] = useState<Chirp[]>([]);
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
        const chirps = await Promise.all(
          bookmarkIds.map((id) => chirpService.getChirp(id))
        );

        // Filter out nulls and sort by creation date (newest first)
        const validChirps = chirps
          .filter((chirp): chirp is Chirp => chirp !== null)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

        setBookmarkedChirps(validChirps);
        loadChirps(validChirps);

        // Load authors for chirps
        const authorIds = new Set(validChirps.map((c) => c.authorId));
        const { loadUser } = useUserStore.getState();
        for (const authorId of authorIds) {
          await loadUser(authorId);
        }
      } catch (error) {
        console.error('Error loading bookmarks:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadBookmarks();
  }, [currentUser, loadChirps]);

  if (isLoading) {
    return (
      <AppLayout wrapContent={true}>
        <div className={`p-8 text-center ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'}`}>
          <p>Loading bookmarks...</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout wrapContent={true}>
      <div className={`border-b ${theme === 'dark' ? 'border-white/10' : 'border-border/60'} px-4 py-4`}>
        <h1 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>Bookmarks</h1>
        <p className={`text-sm ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'} mt-1`}>
          {bookmarkedChirps.length === 0
            ? 'No bookmarks yet'
            : `${bookmarkedChirps.length} ${bookmarkedChirps.length === 1 ? 'bookmark' : 'bookmarks'}`}
        </p>
      </div>

      <div>
        {bookmarkedChirps.length === 0 ? (
          <div className={`p-8 text-center ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'}`}>
            <p>You haven't bookmarked any posts yet.</p>
            <p className="text-sm mt-2">Bookmark posts to save them for later.</p>
          </div>
        ) : (
          bookmarkedChirps.map((chirp) => <ChirpCard key={chirp.id} chirp={chirp} />)
        )}
      </div>
    </AppLayout>
  );
};

export default BookmarksPage;

