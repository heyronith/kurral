import { useState } from 'react';
import { useFeedStore } from '../store/useFeedStore';
import { useUserStore } from '../store/useUserStore';
import { useThemeStore } from '../store/useThemeStore';
import ChirpCard from './ChirpCard';
import FollowSuggestionsModal from './FollowSuggestionsModal';
import { filterChirpsForViewer } from '../lib/utils/chirpVisibility';

const LatestFeed = () => {
  const chirps = useFeedStore((state) => state.chirps);
  const currentUser = useUserStore((state) => state.currentUser);
  const { theme } = useThemeStore();
  const [showFollowModal, setShowFollowModal] = useState(false);
  
  // Filter to followed users only (excluding own chirps), sort by createdAt DESC
  const latestChirps = currentUser
    ? filterChirpsForViewer(
        chirps.filter((chirp) =>
          chirp.authorId !== currentUser.id &&
          (currentUser.following || []).includes(chirp.authorId)
        ),
        currentUser.id
      ).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    : [];

  if (latestChirps.length === 0) {
    return (
      <div className={`p-8 text-center ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'}`}>
        <p>No posts yet. Follow some users to see their posts here.</p>
        <p className="text-sm mt-2">Because: Latest – pure chronological</p>
        <button
          onClick={() => setShowFollowModal(true)}
          className="mt-4 rounded-full border border-border px-4 py-2 text-xs font-semibold text-textPrimary hover:border-accent hover:text-accent transition-colors"
        >
          Find people to follow
        </button>
        <FollowSuggestionsModal open={showFollowModal} onClose={() => setShowFollowModal(false)} />
      </div>
    );
  }

  return (
    <div className="px-4 py-4">
      {latestChirps.map((chirp) => (
        <ChirpCard key={chirp.id} chirp={chirp} />
      ))}
    </div>
  );
};

export default LatestFeed;

