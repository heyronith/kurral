import { useEffect } from 'react';
import { useFeedStore } from '../store/useFeedStore';
import { useUserStore } from '../store/useUserStore';
import { generateMockUsers, generateMockChirps } from '../data/mockData';
import Composer from './Composer';
import FeedTabs from './FeedTabs';
import LatestFeed from './LatestFeed';
import ForYouFeed from './ForYouFeed';
import ForYouControls from './ForYouControls';
import type { FeedType } from '../types';

const AppSection = () => {
  const { activeFeed, setActiveFeed, loadChirps } = useFeedStore();
  const { setCurrentUser } = useUserStore();

  // Initialize mock data on mount (for landing page demo)
  useEffect(() => {
    const users = generateMockUsers();
    const chirps = generateMockChirps(users);
    
    // Load all users into store
    const { addUser } = useUserStore.getState();
    users.forEach((user) => {
      addUser(user);
    });
    
    // Set first user as current user (after loading)
    if (users.length > 0) {
      setCurrentUser(users[0]);
    }
    
    // Load chirps
    loadChirps(chirps);
  }, [setCurrentUser, loadChirps]);

  return (
    <section id="app" className="section-container py-16 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-semibold text-textPrimary mb-4">
            Try Kural
          </h2>
          <p className="text-lg text-textMuted">
            Experience the minimalist social feed you control
          </p>
        </div>
        
        <div className="border border-border rounded-lg bg-background/50 overflow-hidden">
          {/* Composer */}
          <Composer />
          
          {/* Feed Tabs */}
          <FeedTabs activeFeed={activeFeed} onFeedChange={setActiveFeed} />
          
          {/* For You Controls (shown only when For You tab is active) */}
          {activeFeed === 'forYou' && <ForYouControls />}
          
          {/* Feed Content */}
          <div className="min-h-[400px] max-h-[600px] overflow-y-auto">
            {activeFeed === 'latest' ? <LatestFeed /> : <ForYouFeed />}
          </div>
        </div>
      </div>
    </section>
  );
};

export default AppSection;

