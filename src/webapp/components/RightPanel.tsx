import { useMemo, useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useUserStore } from '../store/useUserStore';
import { useSearchStore } from '../store/useSearchStore';
import { useTopicStore } from '../store/useTopicStore';
import { useThemeStore } from '../store/useThemeStore';
import { userService } from '../lib/firestore';
import TrendingNewsSection from './TrendingNewsSection';
import ReviewRequestsPanel from './ReviewRequestsPanel';
import type { User } from '../types';

const RightPanel = () => {
  const { users, currentUser, followUser, unfollowUser, isFollowing } = useUserStore();
  const { query, setQuery } = useSearchStore();
  const { theme } = useThemeStore();
  const navigate = useNavigate();
  const location = useLocation();
  const { 
    trendingTopics, 
    isLoading: topicsLoading, 
    loadTrendingTopics,
    startScheduledRefresh,
    selectTopic
  } = useTopicStore();

  // Load trending topics on mount and start scheduled refresh
  useEffect(() => {
    loadTrendingTopics(10);
    
    // Start scheduled refresh (returns cleanup function)
    const cleanup = startScheduledRefresh();
    
    // Cleanup on unmount
    return cleanup;
  }, [loadTrendingTopics, startScheduledRefresh]);

  // Format volume display
  const formatVolume = (count: number): string => {
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K kurals`;
    }
    return `${count} kurals`;
  };

  // Get top 5 trending topics for display, prioritizing user interests
  const displayTrendingTopics = useMemo(() => {
    if (trendingTopics.length === 0) {
      return [];
    }

    if (!currentUser || !currentUser.interests || currentUser.interests.length === 0) {
      // No personalization: show top 5 trending topics
      return trendingTopics.slice(0, 5).map((topic) => ({
        topic: topic.name,
        volume: formatVolume(topic.postsLast1h), // Use 1h for trending display
        matchesInterest: false,
      }));
    }

    // Personalize: prioritize topics that match user interests
    const userInterests = currentUser.interests.map((i) => i.toLowerCase());
    
    // Check which topics match user interests
    const topicsWithMatch = trendingTopics.map((topic) => {
      const topicName = topic.name.toLowerCase();
      const matchesInterest = userInterests.some((interest) => {
        // Check if topic name contains interest or vice versa
        return topicName.includes(interest) || interest.includes(topicName);
      });
      return {
        topic: topic,
        matchesInterest,
      };
    });

    // Sort: matching interests first, then by 1h engagement (trending velocity)
    topicsWithMatch.sort((a, b) => {
      if (a.matchesInterest !== b.matchesInterest) {
        return a.matchesInterest ? -1 : 1; // Matches first
      }
      return b.topic.postsLast1h - a.topic.postsLast1h; // Then by 1h posts (trending velocity)
    });

    return topicsWithMatch.slice(0, 5).map((item) => ({
      topic: item.topic.name,
      volume: formatVolume(item.topic.postsLast1h), // Use 1h for trending display
      matchesInterest: item.matchesInterest,
    }));
  }, [trendingTopics, currentUser]);

  const [suggestedUsers, setSuggestedUsers] = useState<User[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);

  // Load users with similar interests
  useEffect(() => {
    const loadUserSuggestions = async () => {
      if (!currentUser || !currentUser.interests || currentUser.interests.length === 0) {
        // Fallback: use users from store (no interest-based suggestions)
        const list = Object.values(users).filter((user) => user.id !== currentUser?.id);
        setSuggestedUsers(list.slice(0, 3));
        return;
      }

      setIsLoadingSuggestions(true);
      try {
        const similarUsers = await userService.getUsersWithSimilarInterests(
          currentUser.interests,
          currentUser.id,
          5 // Get top 5, display 3
        );

        if (similarUsers.length > 0) {
          setSuggestedUsers(similarUsers.slice(0, 3));
        } else {
          // Fallback: use users from store
          const list = Object.values(users).filter((user) => user.id !== currentUser?.id);
          setSuggestedUsers(list.slice(0, 3));
        }
      } catch (error) {
        console.error('Error loading user suggestions:', error);
        // Fallback: use users from store
        const list = Object.values(users).filter((user) => user.id !== currentUser?.id);
        setSuggestedUsers(list.slice(0, 3));
      } finally {
        setIsLoadingSuggestions(false);
      }
    };

    loadUserSuggestions();
  }, [currentUser?.id, currentUser?.interests, users]);

  const peopleToFollow = suggestedUsers;

  return (
    <aside className="sticky top-20 hidden xl:flex w-80 flex-col gap-5">
      <div className={`rounded-2xl p-5 ${theme === 'dark' ? 'border border-darkBorder bg-darkBgElevated/50' : 'bg-backgroundElevated shadow-sm'}`}>
        <label className={`mb-3 block text-xs font-semibold uppercase tracking-wide ${theme === 'dark' ? 'text-darkTextMuted' : 'text-textMuted'}`}>Search Kural</label>
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search topics or people"
            className={`w-full rounded-xl px-4 py-2.5 text-sm outline-none transition-all duration-200 focus:ring-2 focus:ring-accent/20 ${
              theme === 'dark' 
                ? 'bg-white/5 border border-darkBorder text-darkTextPrimary placeholder:text-darkTextMuted focus:border-accent/60' 
                : 'bg-backgroundSubtle text-textPrimary placeholder:text-textMuted focus:border-accent/60 focus:border'
            }`}
          />
          <span className={`absolute right-3 top-2.5 text-xs font-medium ${theme === 'dark' ? 'text-darkTextMuted' : 'text-textMuted'}`}>⌘ K</span>
        </div>
      </div>

      <ReviewRequestsPanel />

      <TrendingNewsSection />

      <div className={`rounded-2xl p-5 ${theme === 'dark' ? 'border border-darkBorder bg-darkBgElevated/50' : 'bg-backgroundElevated shadow-sm'}`}>
        <h3 className={`mb-4 text-sm font-bold ${theme === 'dark' ? 'text-darkTextPrimary' : 'text-textPrimary'}`}>Trending Topics</h3>
        {topicsLoading ? (
          <div className="py-4 text-center">
            <p className={`text-xs ${theme === 'dark' ? 'text-darkTextMuted' : 'text-textMuted'}`}>Loading trending topics...</p>
          </div>
        ) : displayTrendingTopics.length === 0 ? (
          <div className="py-4 text-center">
            <p className={`text-xs ${theme === 'dark' ? 'text-darkTextMuted' : 'text-textMuted'}`}>No trending topics yet</p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {displayTrendingTopics.map((item) => (
              <button
                key={item.topic}
                onClick={() => {
                  selectTopic(item.topic);
                  // Navigate to home if not already there
                  if (location.pathname !== '/') {
                    navigate('/');
                  }
                }}
                className={`inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200 active:scale-95 cursor-pointer ${
                  item.matchesInterest
                    ? 'bg-accent/10 hover:bg-accent/20 text-accent'
                    : theme === 'dark' 
                      ? 'bg-white/5 hover:bg-white/10 text-darkTextPrimary' 
                      : 'bg-backgroundSubtle hover:bg-backgroundHover text-textPrimary'
                }`}
              >
                {item.topic}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className={`rounded-2xl p-5 ${theme === 'dark' ? 'border border-darkBorder bg-darkBgElevated/50' : 'bg-backgroundElevated shadow-sm'}`}>
        <h3 className={`mb-4 text-sm font-bold ${theme === 'dark' ? 'text-darkTextPrimary' : 'text-textPrimary'}`}>
          {currentUser?.interests && currentUser.interests.length > 0
            ? 'People with similar interests'
            : 'People to follow'}
        </h3>
        {isLoadingSuggestions ? (
          <div className="py-4 text-center">
            <p className={`text-xs ${theme === 'dark' ? 'text-darkTextMuted' : 'text-textMuted'}`}>Loading suggestions...</p>
          </div>
        ) : peopleToFollow.length === 0 ? (
          <div className="py-4 text-center">
            <p className={`text-xs ${theme === 'dark' ? 'text-darkTextMuted' : 'text-textMuted'}`}>No suggestions yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {peopleToFollow.map((person) => {
              const following = isFollowing(person.id);
              // Extract similarity metadata if available
              const similarityMetadata = (person as any)._similarityMetadata;
              const matchingInterests = similarityMetadata?.matchingInterests || [];
              const overlapCount = similarityMetadata?.overlapCount || 0;
              
              const personInitials = person.name
                .split(' ')
                .map((part) => part[0]?.toUpperCase())
                .join('')
                .slice(0, 2);
              
              return (
                <div key={person.id} className={`rounded-xl px-3.5 py-3.5 transition-all duration-200 ${theme === 'dark' ? 'bg-white/5 hover:bg-white/10' : 'bg-backgroundSubtle hover:bg-backgroundHover'}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Link
                        to={`/app/profile/${person.id}`}
                        className={`flex-shrink-0 w-10 h-10 rounded-full overflow-hidden bg-primary/20 flex items-center justify-center transition-colors ${theme === 'dark' ? '' : ''}`}
                      >
                        {person.profilePictureUrl ? (
                          <img
                            src={person.profilePictureUrl}
                            alt={`${person.name}'s profile`}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-xs font-semibold text-primary">{personInitials}</span>
                        )}
                      </Link>
                      <div className="flex-1 min-w-0">
                        <Link
                          to={`/app/profile/${person.id}`}
                          className={`block text-sm font-bold truncate hover:text-accent transition-colors ${theme === 'dark' ? 'text-darkTextPrimary' : 'text-textPrimary'}`}
                        >
                          {person.name}
                        </Link>
                        <Link
                          to={`/app/profile/${person.id}`}
                          className={`block text-xs truncate hover:text-accent transition-colors ${theme === 'dark' ? 'text-darkTextMuted' : 'text-textMuted'}`}
                        >
                          @{person.handle}
                        </Link>
                        {matchingInterests.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {matchingInterests.slice(0, 2).map((interest: string, idx: number) => (
                              <span
                                key={idx}
                                className={`px-2 py-0.5 text-[10px] font-semibold bg-accent/20 text-accent rounded-md ${theme === 'dark' ? 'border border-accent/30' : ''}`}
                              >
                                {interest}
                              </span>
                            ))}
                            {matchingInterests.length > 2 && (
                              <span className={`px-2 py-0.5 text-[10px] ${theme === 'dark' ? 'text-darkTextMuted' : 'text-textMuted'}`}>
                                +{matchingInterests.length - 2} more
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => (following ? unfollowUser(person.id) : followUser(person.id))}
                      className={`ml-3 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all duration-200 whitespace-nowrap active:scale-95 ${
                        following 
                          ? theme === 'dark' ? 'bg-white/10 text-darkTextMuted' : 'bg-backgroundHover text-textMuted'
                          : 'bg-gradient-to-r from-primary to-accent text-white hover:from-primaryHover hover:to-accentHover shadow-sm hover:shadow-md'
                      }`}
                    >
                      {following ? 'Following' : 'Follow'}
                    </button>
                  </div>
                  {overlapCount > 0 && (
                    <p className={`text-[10px] mt-1.5 ${theme === 'dark' ? 'text-darkTextMuted' : 'text-textMuted'}`}>
                      {overlapCount} shared interest{overlapCount !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
};

export default RightPanel;

