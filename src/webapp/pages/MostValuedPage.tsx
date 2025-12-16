import { useEffect, useMemo, useState } from 'react';
import AppLayout from '../components/AppLayout';
import ChirpCard from '../components/ChirpCard';
import { useMostValuedStore } from '../store/useMostValuedStore';
import { useUserStore } from '../store/useUserStore';
import { useThemeStore } from '../store/useThemeStore';
import { useConfigStore } from '../store/useConfigStore';
import { filterChirpsForMostValued } from '../lib/utils/mostValuedEligibility';

const timeframes: Array<{ id: 'today' | 'week' | 'month' | 'all'; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' },
  { id: 'all', label: 'All Time' },
];

const MostValuedPage = () => {
  const { theme } = useThemeStore();
  const { currentUser } = useUserStore();
  const forYouConfig = useConfigStore((state) => state.forYouConfig);
  const {
    valuedPosts,
    isLoadingList,
    isLoadingMore,
    hasMore,
    timeframe,
    filterByInterests,
    minValueThreshold,
    loadValuedPosts,
    loadMoreValuedPosts,
    setTimeframe,
    setFilterByInterests,
    setMinValueThreshold,
  } = useMostValuedStore();
  const [error, setError] = useState<string | null>(null);

  const interests = useMemo(() => {
    if (!filterByInterests) return undefined;
    const userInterests = currentUser?.interests || [];
    return userInterests.length > 0 ? userInterests : undefined;
  }, [filterByInterests, currentUser?.interests]);

  useEffect(() => {
    setError(null);
    loadValuedPosts({
      timeframe,
      interests,
      minValueThreshold,
      forceRefresh: false,
    }).catch((err) => {
      console.error('[MostValuedPage] Error loading posts:', err);
      setError('Failed to load valued posts. Please try again.');
    });
  }, [timeframe, interests, minValueThreshold, loadValuedPosts]);

  const visiblePosts = useMemo(() => {
    return filterChirpsForMostValued(valuedPosts, currentUser, forYouConfig);
  }, [valuedPosts, currentUser, forYouConfig]);

  return (
    <AppLayout pageTitle="Most Valued">
      <div className="p-6 space-y-6">
        <div className={`flex flex-wrap items-center gap-3 ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">Timeframe:</span>
            <div className="flex flex-wrap gap-2">
              {timeframes.map((option) => (
                <button
                  key={option.id}
                  onClick={() => setTimeframe(option.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                    timeframe === option.id
                      ? 'bg-accent text-white shadow-sm'
                      : theme === 'dark'
                      ? 'bg-white/10 text-white hover:bg-white/20'
                      : 'bg-backgroundSubtle text-textPrimary hover:bg-backgroundHover'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 text-xs font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={filterByInterests}
                onChange={(e) => setFilterByInterests(e.target.checked)}
                className="accent-accent"
              />
              <span className={theme === 'dark' ? 'text-white/80' : 'text-textPrimary'}>My interests only</span>
            </label>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold">
              Min value: {(minValueThreshold * 100).toFixed(0)}
            </label>
            <input
              type="range"
              min={0.3}
              max={0.9}
              step={0.05}
              value={minValueThreshold}
              onChange={(e) => setMinValueThreshold(Number(e.target.value))}
            />
          </div>
        </div>

        {error ? (
          <div className={`py-12 text-center ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`}>
            <p className="text-sm font-semibold mb-2">{error}</p>
            <button
              onClick={() => {
                setError(null);
                loadValuedPosts({
                  timeframe,
                  interests,
                  minValueThreshold,
                  forceRefresh: true,
                }).catch((err) => {
                  console.error('[MostValuedPage] Error retrying:', err);
                  setError('Failed to load valued posts. Please try again.');
                });
              }}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                theme === 'dark'
                  ? 'bg-white/10 text-white hover:bg-white/20'
                  : 'bg-backgroundHover text-textPrimary hover:bg-backgroundSubtle'
              }`}
            >
              Retry
            </button>
          </div>
        ) : isLoadingList && visiblePosts.length === 0 ? (
          <div className="space-y-4">
            {[...Array(4)].map((_, idx) => (
              <div
                key={idx}
                className={`h-32 rounded-xl animate-pulse ${theme === 'dark' ? 'bg-white/5' : 'bg-backgroundSubtle'}`}
              />
            ))}
          </div>
        ) : visiblePosts.length === 0 ? (
          <div className={`py-12 text-center ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'}`}>
            <p className="text-sm font-semibold">No valued posts found.</p>
            <p className="text-xs mt-2">Try adjusting timeframe or lowering the minimum value threshold.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {visiblePosts.map((post) => (
              <ChirpCard key={post.id} chirp={post} />
            ))}
          </div>
        )}

        <div className="flex justify-center pt-4">
          {hasMore ? (
            <button
              onClick={() => {
                loadMoreValuedPosts({
                  timeframe,
                  interests,
                  minValueThreshold,
                }).catch((err) => {
                  console.error('[MostValuedPage] Error loading more:', err);
                  setError('Failed to load more posts. Please try again.');
                });
              }}
              disabled={isLoadingMore}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                theme === 'dark'
                  ? 'bg-white/10 text-white hover:bg-white/20'
                  : 'bg-backgroundHover text-textPrimary hover:bg-backgroundSubtle'
              } disabled:opacity-50`}
            >
              {isLoadingMore ? 'Loading...' : 'Load more'}
            </button>
          ) : (
            visiblePosts.length > 0 && (
              <p className={`text-xs ${theme === 'dark' ? 'text-white/60' : 'text-textMuted'}`}>No more posts</p>
            )
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default MostValuedPage;

