import { useFeedStore } from '../store/useFeedStore';
import { useUserStore } from '../store/useUserStore';
import ChirpCard from './ChirpCard';

const LatestFeed = () => {
  const chirps = useFeedStore((state) => state.chirps);
  const currentUser = useUserStore((state) => state.currentUser);
  
  // Filter to followed users only (including own chirps), sort by createdAt DESC
  const latestChirps = currentUser
    ? chirps
        .filter((chirp) => 
          chirp.authorId === currentUser.id || currentUser.following.includes(chirp.authorId)
        )
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    : [];

  if (latestChirps.length === 0) {
    return (
      <div className="p-8 text-center text-textMuted">
        <p>No chirps yet. Follow some users to see their posts here.</p>
        <p className="text-sm mt-2">Because: Latest – pure chronological</p>
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

