import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMostValuedStore } from '../store/useMostValuedStore';
import { useUserStore } from '../store/useUserStore';
import { useThemeStore } from '../store/useThemeStore';
import { useConfigStore } from '../store/useConfigStore';
import { useFeedStore } from '../store/useFeedStore';
import { filterChirpsForMostValued } from '../lib/utils/mostValuedEligibility';

const MostValuedSection = () => {
  const navigate = useNavigate();
  const { theme } = useThemeStore();
  const { currentUser, getUser } = useUserStore();
  const { chirps } = useFeedStore();
  const forYouConfig = useConfigStore((state) => state.forYouConfig);
  const {
    topValuedPosts,
    isLoadingTop,
    loadTopValuedPosts,
  } = useMostValuedStore();
  const [filterByInterests, setFilterByInterests] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const interests = useMemo(() => {
    if (!filterByInterests) return undefined;
    const userInterests = currentUser?.interests || [];
    return userInterests.length > 0 ? userInterests : undefined;
  }, [filterByInterests, currentUser?.interests]);

  useEffect(() => {
    setError(null);
    loadTopValuedPosts({
      timeframe: 'week',
      interests,
      minValueThreshold: 0.5,
      forceRefresh: false,
    }).catch((err) => {
      console.error('[MostValuedSection] Error loading posts:', err);
      setError('Failed to load valued posts. Please try again.');
    });
  }, [interests, loadTopValuedPosts]);

  const visibleChirps = useMemo(() => {
    return filterChirpsForMostValued(topValuedPosts, currentUser, forYouConfig);
  }, [topValuedPosts, currentUser, forYouConfig]);

  const renderValueBadge = (value?: number) => {
    if (value === undefined || value === null) {
      return null;
    }
    const score = Math.round(value * 100);
    const colorClass =
      score >= 90
        ? 'bg-green-500/15 text-green-600'
        : score >= 70
        ? 'bg-blue-500/15 text-blue-600'
        : 'bg-gray-500/15 text-gray-600';

    return (
      <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${colorClass}`}>
        {score} value
      </span>
    );
  };

  const renderItem = (chirpId: string) => {
    const chirp =
      visibleChirps.find((c) => c.id === chirpId) ||
      chirps.find((c) => c.id === chirpId);

    if (!chirp) return null;

    const author = getUser(chirp.authorId);
    const authorName = author?.name || 'Unknown';
    const authorHandle = author?.handle ? `@${author.handle}` : '';
    const preview = chirp.text?.slice(0, 120) || '';
    const timeAgo = (() => {
      const diffMs = Date.now() - chirp.createdAt.getTime();
      const mins = Math.floor(diffMs / 60000);
      if (mins < 1) return 'now';
      if (mins < 60) return `${mins}m`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours}h`;
      const days = Math.floor(hours / 24);
      return `${days}d`;
    })();

    return (
      <button
        key={chirp.id}
        onClick={() => navigate(`/app/post/${chirp.id}`)}
        className={`w-full text-left rounded-xl px-3 py-3 transition ${
          theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-background/60'
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-semibold ${theme === 'dark' ? 'text-white/60' : 'text-textMuted'}`}>
              {authorName}
            </span>
            {authorHandle && (
              <span className={`text-[10px] ${theme === 'dark' ? 'text-white/50' : 'text-textMuted'}`}>
                {authorHandle}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {renderValueBadge(chirp.valueScore?.total)}
            <span className={`text-[10px] ${theme === 'dark' ? 'text-white/60' : 'text-textMuted'}`}>{timeAgo}</span>
          </div>
        </div>
        {chirp.topic && (
          <div className={`text-[10px] mb-1 ${theme === 'dark' ? 'text-white/60' : 'text-textMuted'}`}>
            #{chirp.topic}
          </div>
        )}
        <p className={`text-sm line-clamp-2 ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>{preview}</p>
      </button>
    );
  };

  return (
    <div className={`rounded-2xl p-4 ${theme === 'dark' ? 'border border-white/20 bg-transparent' : 'bg-backgroundElevated shadow-sm'}`}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className={`text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>Most Valued</h3>
          <p className={`text-[10px] ${theme === 'dark' ? 'text-white/60' : 'text-textMuted'}`}>Top value-ranked posts</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-[10px] font-medium cursor-pointer">
            <input
              type="checkbox"
              checked={filterByInterests}
              onChange={(e) => setFilterByInterests(e.target.checked)}
              className="accent-accent"
            />
            <span className={theme === 'dark' ? 'text-white/70' : 'text-textMuted'}>My interests</span>
          </label>
        </div>
      </div>

      {error ? (
        <div className={`py-4 text-center ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`}>
          <p className="text-xs font-medium mb-1">{error}</p>
          <button
            onClick={() => {
              setError(null);
              loadTopValuedPosts({
                timeframe: 'week',
                interests,
                minValueThreshold: 0.5,
                forceRefresh: true,
              }).catch((err) => {
                console.error('[MostValuedSection] Error retrying:', err);
                setError('Failed to load valued posts. Please try again.');
              });
            }}
            className={`text-[10px] underline ${theme === 'dark' ? 'text-red-300' : 'text-red-500'}`}
          >
            Retry
          </button>
        </div>
      ) : isLoadingTop ? (
        <div className="space-y-3">
          {[0, 1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className={`h-14 rounded-xl animate-pulse ${theme === 'dark' ? 'bg-white/5' : 'bg-backgroundSubtle'}`}
            />
          ))}
        </div>
      ) : visibleChirps.length === 0 ? (
        <div className={`py-4 text-center ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'}`}>
          No high-value posts yet.
        </div>
      ) : (
        <div className="space-y-2">
          {visibleChirps.slice(0, 5).map((chirp) => renderItem(chirp.id))}
        </div>
      )}

      <div className="mt-4 flex justify-end">
        <button
          onClick={() => navigate('/app/most-valued')}
          className={`text-xs font-semibold rounded-lg px-3 py-2 transition ${
            theme === 'dark'
              ? 'text-white hover:bg-white/10'
              : 'text-textPrimary hover:bg-backgroundHover'
          }`}
        >
          See more
        </button>
      </div>
    </div>
  );
};

export default MostValuedSection;

