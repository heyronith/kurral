import { useEffect, useMemo, useRef } from 'react';
import { generateForYouFeed } from '../lib/algorithm';
import { useFeedStore } from '../store/useFeedStore';
import { useUserStore } from '../store/useUserStore';
import { useConfigStore } from '../store/useConfigStore';
import { useThemeStore } from '../store/useThemeStore';
import ChirpCard from './ChirpCard';

const ForYouFeed = () => {
  const chirps = useFeedStore((state) => state.chirps);
  const config = useConfigStore((state) => state.forYouConfig);
  const currentUser = useUserStore((state) => state.currentUser);
  const getUser = useUserStore((state) => state.getUser);
  const { theme } = useThemeStore();

  const scoredChirps = useMemo(() => {
    if (!currentUser) return [];
    return generateForYouFeed(chirps, currentUser, config, getUser);
  }, [chirps, currentUser, config, getUser]);

  const prevConfigRef = useRef(config);
  const prevCountRef = useRef(scoredChirps.length);

  useEffect(() => {
    const configChanged = JSON.stringify(prevConfigRef.current) !== JSON.stringify(config);
    const countChanged = prevCountRef.current !== scoredChirps.length;
    
    if (configChanged) {
      console.log('[ForYouFeed] Feed recalculated due to config change:', {
        config,
        postCount: scoredChirps.length,
        previousCount: prevCountRef.current,
      });
      prevConfigRef.current = config;
    }
    
    if (countChanged && !configChanged) {
      console.log('[ForYouFeed] Post count changed:', {
        previous: prevCountRef.current,
        current: scoredChirps.length,
      });
    }
    
    prevCountRef.current = scoredChirps.length;
  }, [config, scoredChirps.length]);

  const emptyReason = useMemo(() => {
    if (!currentUser) {
      return 'Log in to personalize your For You feed.';
    }

    if (chirps.length === 0) {
      return 'No posts have been published yet. Check back soon or invite a few people to post.';
    }

    const hasFollowing = (currentUser.following?.length || 0) > 0;
    const hasInterests = (currentUser.interests?.length || 0) > 0;

    if (!hasFollowing && !hasInterests) {
      return 'You are not following anyone and have no interests yet.';
    }

    if (config.mutedTopics.length >= 3) {
      return 'Your muted topics may be filtering out too much content.';
    }

    return 'Try adjusting your tuning controls or follow a few more creators.';
  }, [chirps.length, config.mutedTopics.length, currentUser]);

  if (scoredChirps.length === 0) {
    return (
      <div className="p-8 space-y-4">
        <div className={`text-center ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'}`}>
          <p className="text-sm font-medium mb-1">No posts match your For You settings.</p>
          <p className="text-xs mt-2">{emptyReason}</p>
          <p className="text-[10px] mt-1">Try adjusting your preferences in the controls above.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-4">
      {scoredChirps.map((scoredChirp) => (
        <div key={scoredChirp.chirp.id} className="mb-4">
          <div className={`mb-2 px-3 py-2 text-xs ${theme === 'dark' ? 'text-white/70 bg-transparent border border-white/20 rounded-lg' : 'text-textMuted'}`}>
            <span className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-textLabel'}`}>Why this post:</span>{' '}
            <span className={theme === 'dark' ? 'text-white/70' : 'text-textSecondary'}>{scoredChirp.explanation}</span>
          </div>
          <ChirpCard chirp={scoredChirp.chirp} />
        </div>
      ))}
    </div>
  );
};

export default ForYouFeed;
