import { useEffect, useState } from 'react';
import { useFeedStore } from '../store/useFeedStore';
import { useUserStore } from '../store/useUserStore';
import { chirpService, commentService, realtimeService } from '../lib/firestore';
import FeedTabs from '../components/FeedTabs';
import LatestFeed from '../components/LatestFeed';
import ForYouFeed from '../components/ForYouFeed';
import SearchResults from '../components/SearchResults';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import { useSearchStore } from '../store/useSearchStore';
import { useTopicStore } from '../store/useTopicStore';
import { useNewsStore } from '../store/useNewsStore';
import { tuningService } from '../lib/services/tuningService';
import TuningSuggestionModal from '../components/TuningSuggestionModal';
import NewsDetailView from '../components/NewsDetailView';
import TopicDetailView from '../components/TopicDetailView';
import { useNotificationSetup } from '../store/useNotificationStore';
import { startPeriodicRecalculation } from '../lib/services/reputationRecalculationService';
import type { Chirp, Comment } from '../types';

const ChirpApp = () => {
  const { activeFeed, setActiveFeed, loadChirps, loadComments, upsertChirps } = useFeedStore();
  const { currentUser, loadUser } = useUserStore();
  const { query } = useSearchStore();
  const { loadTopEngagedTopics, refreshEngagement, isStale, selectedTopic } = useTopicStore();
  const { selectedNews, loadTrendingNews } = useNewsStore();
  const [isLoading, setIsLoading] = useState(true);
  const [showTuningModal, setShowTuningModal] = useState(false);
  const navigate = useNavigate();
  // Show search results if query is 2+ characters
  const shouldShowSearch = query.trim().length >= 2;
  
  // Setup notifications for current user
  useNotificationSetup(currentUser?.id || null);

  // Initialize background reputation recalculation job (runs daily)
  useEffect(() => {
    const stopRecalculation = startPeriodicRecalculation(24 * 60 * 60 * 1000);
    return stopRecalculation;
  }, []);

  // Load data from Firestore on mount
  useEffect(() => {
    if (!currentUser) {
      setIsLoading(false);
      return;
    }

    let unsubscribeFollowing: (() => void) | null = null;
    let unsubscribeSemantic: (() => void) | null = null;
    let unsubscribeComments: Record<string, () => void> = {};

    const setupRealtimeListeners = async () => {
      try {
        // Load personalized chirps for For You feed
        const personalizedChirps = await chirpService.getPersonalizedChirps(currentUser, 150);
        loadChirps(personalizedChirps);

        // Set up semantic topic listener
        if (currentUser.interests && currentUser.interests.length > 0) {
          const semanticUnsub = realtimeService.subscribeToSemanticTopics(
            currentUser.interests,
            async (chirps) => {
              if (chirps.length > 0) {
                upsertChirps(chirps);
                chirps.forEach((chirp) => {
                  loadUser(chirp.authorId);
                });
                // Load comments for new chirps
                for (const chirp of chirps) {
                  if (!unsubscribeComments[chirp.id]) {
                    const comments = await commentService.getCommentsForChirp(chirp.id);
                    loadComments(chirp.id, comments);
                    unsubscribeComments[chirp.id] = realtimeService.subscribeToComments(
                      chirp.id,
                      (comments) => {
                        loadComments(chirp.id, comments);
                      }
                    );
                  }
                }
              }
            },
            80
          );
          if (semanticUnsub) {
            unsubscribeSemantic = semanticUnsub;
          }
        }

        // Set up following listener
        unsubscribeFollowing = realtimeService.subscribeToLatestChirps(
          currentUser.following.slice(0, 10),
          async (chirps) => {
            if (chirps.length > 0) {
              upsertChirps(chirps);
              chirps.forEach((chirp) => {
                loadUser(chirp.authorId);
              });
              // Load comments for new chirps
              for (const chirp of chirps) {
                if (!unsubscribeComments[chirp.id]) {
                  const comments = await commentService.getCommentsForChirp(chirp.id);
                  loadComments(chirp.id, comments);
                  unsubscribeComments[chirp.id] = realtimeService.subscribeToComments(
                    chirp.id,
                    (comments) => {
                      loadComments(chirp.id, comments);
                    }
                  );
                }
              }
            }
          }
        );

        // Load comments for all chirps
        for (const chirp of personalizedChirps) {
          const comments = await commentService.getCommentsForChirp(chirp.id);
          loadComments(chirp.id, comments);

          // Set up real-time listener for comments
          unsubscribeComments[chirp.id] = realtimeService.subscribeToComments(
            chirp.id,
            (comments) => {
              loadComments(chirp.id, comments);
            }
          );
        }

        // Load user data for authors
        const authorIds = new Set<string>(personalizedChirps.map((c) => c.authorId));
        for (const authorId of authorIds) {
          await loadUser(authorId);
        }
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    setupRealtimeListeners();

    // Cleanup listeners on unmount
    return () => {
      if (unsubscribeFollowing) {
        unsubscribeFollowing();
      }
      if (unsubscribeSemantic) {
        unsubscribeSemantic();
      }
      Object.values(unsubscribeComments).forEach((unsub) => unsub());
    };
  }, [currentUser, loadChirps, loadComments, loadUser, upsertChirps]);

  // Load topics on mount and refresh engagement if stale
  useEffect(() => {
    if (!currentUser) return;

    const initializeTopics = async () => {
      // Load top engaged topics
      await loadTopEngagedTopics(30);
      
      // Refresh engagement if stale (every 4 hours)
      if (isStale()) {
        // Refresh in background (don't block)
        refreshEngagement().catch(error => {
          console.error('Error refreshing topic engagement:', error);
        });
      }
    };

    initializeTopics();
  }, [currentUser, loadTopEngagedTopics, refreshEngagement, isStale]);

  // Load personalized trending news on mount and when user changes
  useEffect(() => {
    const userId = currentUser?.id ?? null;
    loadTrendingNews(userId);
  }, [currentUser?.id, loadTrendingNews]);

  // Start tuning service and check for suggestions
  useEffect(() => {
    if (!currentUser) return;

    // Start the tuning service
    tuningService.start();

    // Check for pending suggestions
    const checkForSuggestions = async () => {
      if (tuningService.shouldSuggestTuning()) {
        const suggestion = await tuningService.analyzeAndSuggest();
        if (suggestion && suggestion.confidence >= 0.5) {
          setShowTuningModal(true);
        }
      } else {
        // Check if there's a saved suggestion to show
        const lastSuggestion = tuningService.getLastSuggestion();
        if (lastSuggestion && !localStorage.getItem('tuning_suggestion_dismissed')) {
          setShowTuningModal(true);
        }
      }
    };

    // Check after a delay to let data load
    const timeoutId = setTimeout(checkForSuggestions, 5000);
    
    // Check periodically (every hour)
    const intervalId = setInterval(checkForSuggestions, 60 * 60 * 1000);

    return () => {
      clearTimeout(timeoutId);
      clearInterval(intervalId);
      tuningService.stop();
    };
  }, [currentUser]);

  // Process scheduled posts periodically
  // OPTIMIZED: Only runs when user is active, and less frequently
  useEffect(() => {
    if (!currentUser) return;

    // Process immediately on mount (user just logged in)
    chirpService.processScheduledPosts();

    // Process every 5 minutes instead of every minute
    // This reduces costs by 80% while still being responsive
    const intervalId = setInterval(() => {
      chirpService.processScheduledPosts();
    }, 5 * 60 * 1000); // Every 5 minutes

    return () => {
      clearInterval(intervalId);
    };
  }, [currentUser]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-textMuted">Loading...</div>
      </div>
    );
  }

  // If news is selected, show news detail view
  if (selectedNews) {
    return (
      <AppLayout wrapContent={false}>
        <NewsDetailView />
      </AppLayout>
    );
  }

  // If topic is selected, show topic detail view
  if (selectedTopic) {
    return (
      <AppLayout>
        <div className="p-6">
          <TopicDetailView />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout pageTitle="Feeds" pageTitleRight={<FeedTabs activeFeed={activeFeed} onFeedChange={setActiveFeed} />}>
      {/* Feed Content - Posts */}
      <div className="overflow-y-auto scroll-smooth pb-20">
        {shouldShowSearch ? (
          <SearchResults />
        ) : activeFeed === 'latest' ? (
          <LatestFeed />
        ) : (
          <ForYouFeed />
        )}
      </div>

      {/* Tuning Suggestion Modal */}
      {showTuningModal && tuningService.getLastSuggestion() && (
        <TuningSuggestionModal
          suggestion={tuningService.getLastSuggestion()!}
          onClose={() => {
            setShowTuningModal(false);
            localStorage.setItem('tuning_suggestion_dismissed', 'true');
          }}
          onApply={() => {
            setShowTuningModal(false);
            localStorage.removeItem('tuning_suggestion_dismissed');
          }}
        />
      )}
    </AppLayout>
  );
};

export default ChirpApp;

