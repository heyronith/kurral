import { useEffect, useRef } from 'react';
import { useFeedStore } from '../store/useFeedStore';
import { useConfigStore } from '../store/useConfigStore';
import ChirpCard from './ChirpCard';

const ForYouFeed = () => {
  const getForYouFeed = useFeedStore((state) => state.getForYouFeed);
  const config = useConfigStore((state) => state.forYouConfig);
  const scoredChirps = getForYouFeed();
  const prevConfigRef = useRef(config);
  const prevCountRef = useRef(scoredChirps.length);

  // Log when feed recalculates
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

  if (scoredChirps.length === 0) {
    return (
      <div className="p-8 space-y-4">
        <div className="text-center text-textMuted">
          <p className="text-sm font-medium mb-1">No chirps match your For You settings.</p>
          <p className="text-xs mt-2">Try adjusting your preferences in the controls above.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-4">
      {scoredChirps.map((scoredChirp) => (
        <div key={scoredChirp.chirp.id} className="mb-4">
          <div className="mb-2 px-3 py-2 text-xs text-textMuted bg-backgroundElevated/50 rounded-lg border border-border/40">
            <span className="font-medium text-textLabel">Why this post:</span>{' '}
            <span className="text-textSecondary">{scoredChirp.explanation}</span>
          </div>
          <ChirpCard chirp={scoredChirp.chirp} />
        </div>
      ))}
    </div>
  );
};

export default ForYouFeed;
