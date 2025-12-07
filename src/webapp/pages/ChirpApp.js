import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useFeedStore } from '../store/useFeedStore';
import { useUserStore } from '../store/useUserStore';
import { useConfigStore } from '../store/useConfigStore';
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
import { findChirpsNeedingFactCheck, resumeFactChecking } from '../lib/services/factCheckResumeService';
import WelcomeScreen from '../components/WelcomeScreen';
import FirstTimeTooltips from '../components/FirstTimeTooltips';
const ChirpApp = () => {
    const { activeFeed, setActiveFeed, loadChirps, loadComments, upsertChirps } = useFeedStore();
    const { currentUser, loadUser } = useUserStore();
    const { query } = useSearchStore();
    const { loadTopEngagedTopics, refreshEngagement, isStale, selectedTopic } = useTopicStore();
    const { selectedNews, loadTrendingNews } = useNewsStore();
    const [isLoading, setIsLoading] = useState(true);
    const [showTuningModal, setShowTuningModal] = useState(false);
    const [showWelcomeOverlay, setShowWelcomeOverlay] = useState(false);
    const [showTooltips, setShowTooltips] = useState(false);
    const navigate = useNavigate();
    // Show search results if query is 2+ characters
    const shouldShowSearch = query.trim().length >= 2;
    // Setup notifications for current user
    useNotificationSetup(currentUser?.id || null);
    const initializeForYouConfig = useConfigStore((state) => state.initializeConfig);
    useEffect(() => {
        initializeForYouConfig(currentUser);
    }, [currentUser?.id, initializeForYouConfig]);
    useEffect(() => {
        if (currentUser?.firstTimeUser) {
            setShowWelcomeOverlay(true);
        }
    }, [currentUser?.firstTimeUser]);
    const handleWelcomeComplete = () => {
        setShowWelcomeOverlay(false);
        setShowTooltips(true);
        setTimeout(() => {
            setShowTooltips(false);
        }, 6000);
    };
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
        let isMounted = true;
        const unsubscribeFns = [];
        const commentUnsubscribes = new Map();
        const attachCommentListener = async (chirpId) => {
            if (commentUnsubscribes.has(chirpId) || !isMounted) {
                return;
            }
            const comments = await commentService.getCommentsForChirp(chirpId);
            if (!isMounted) {
                return;
            }
            loadComments(chirpId, comments);
            const unsubscribe = realtimeService.subscribeToComments(chirpId, (updatedComments) => {
                if (!isMounted) {
                    return;
                }
                loadComments(chirpId, updatedComments);
            });
            commentUnsubscribes.set(chirpId, unsubscribe);
        };
        const hydrateChirpMetadata = async (chirps) => {
            if (!isMounted || chirps.length === 0)
                return;
            const commentPromises = chirps.map((chirp) => attachCommentListener(chirp.id));
            await Promise.allSettled(commentPromises);
            const authorIds = new Set(chirps.map((chirp) => chirp.authorId));
            for (const authorId of authorIds) {
                if (!isMounted)
                    break;
                await loadUser(authorId);
            }
        };
        const setupRealtimeListeners = async () => {
            try {
                const personalizedChirps = await chirpService.getPersonalizedChirps(currentUser, 150);
                if (!isMounted)
                    return;
                loadChirps(personalizedChirps);
                await hydrateChirpMetadata(personalizedChirps);
                if (currentUser.interests && currentUser.interests.length > 0) {
                    const semanticUnsub = realtimeService.subscribeToSemanticTopics(currentUser.interests, async (chirps) => {
                        if (!isMounted || chirps.length === 0)
                            return;
                        upsertChirps(chirps);
                        await hydrateChirpMetadata(chirps);
                    }, 80);
                    if (semanticUnsub) {
                        unsubscribeFns.push(semanticUnsub);
                    }
                }
                const followingUnsub = realtimeService.subscribeToLatestChirps(currentUser.following.slice(0, 10), async (chirps) => {
                    if (!isMounted || chirps.length === 0)
                        return;
                    upsertChirps(chirps);
                    await hydrateChirpMetadata(chirps);
                });
                if (followingUnsub) {
                    unsubscribeFns.push(followingUnsub);
                }
                const recentUnsub = realtimeService.subscribeToRecentChirps(async (chirps) => {
                    if (!isMounted || chirps.length === 0)
                        return;
                    upsertChirps(chirps);
                    await hydrateChirpMetadata(chirps);
                }, 150);
                if (recentUnsub) {
                    unsubscribeFns.push(recentUnsub);
                }
            }
            catch (error) {
                console.error('Error loading data:', error);
            }
            finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };
        setupRealtimeListeners();
        return () => {
            isMounted = false;
            unsubscribeFns.forEach((unsub) => unsub());
            commentUnsubscribes.forEach((unsub) => unsub());
            commentUnsubscribes.clear();
        };
    }, [currentUser, loadChirps, loadComments, loadUser, upsertChirps]);
    // Load topics on mount and refresh engagement if stale
    useEffect(() => {
        if (!currentUser)
            return;
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
        if (!currentUser)
            return;
        // Start the tuning service
        tuningService.start();
        // Check for pending suggestions
        const checkForSuggestions = async () => {
            if (tuningService.shouldSuggestTuning()) {
                const suggestion = await tuningService.analyzeAndSuggest();
                if (suggestion && suggestion.confidence >= 0.5) {
                    setShowTuningModal(true);
                }
            }
            else {
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
    // Resume incomplete fact checks
    useEffect(() => {
        if (!currentUser)
            return;
        const resumeChecks = async () => {
            try {
                const chirps = await findChirpsNeedingFactCheck(currentUser.id);
                if (chirps.length > 0) {
                    console.log(`[ChirpApp] Found ${chirps.length} chirps needing fact check resume`);
                    chirps.forEach(chirp => {
                        resumeFactChecking(chirp).catch(err => console.error('Resume failed:', err));
                    });
                }
            }
            catch (error) {
                console.error('[ChirpApp] Error in resumeChecks:', error);
            }
        };
        // Small delay to not block initial load
        const timer = setTimeout(resumeChecks, 3000);
        return () => clearTimeout(timer);
    }, [currentUser]);
    // Process scheduled posts periodically
    // OPTIMIZED: Only runs when user is active, and less frequently
    useEffect(() => {
        if (!currentUser)
            return;
        // Process immediately on mount (user just logged in)
        chirpService.processScheduledPosts(currentUser.id);
        // Process every 5 minutes instead of every minute
        // This reduces costs by 80% while still being responsive
        const intervalId = setInterval(() => {
            chirpService.processScheduledPosts(currentUser.id);
        }, 5 * 60 * 1000); // Every 5 minutes
        return () => {
            clearInterval(intervalId);
        };
    }, [currentUser]);
    if (isLoading) {
        return (_jsx("div", { className: "min-h-screen flex items-center justify-center bg-background", children: _jsx("div", { className: "text-textMuted", children: "Loading..." }) }));
    }
    // If news is selected, show news detail view
    if (selectedNews) {
        return (_jsx(AppLayout, { wrapContent: false, children: _jsx(NewsDetailView, {}) }));
    }
    // If topic is selected, show topic detail view
    if (selectedTopic) {
        return (_jsx(AppLayout, { children: _jsx("div", { className: "p-6", children: _jsx(TopicDetailView, {}) }) }));
    }
    return (_jsxs(_Fragment, { children: [_jsxs(AppLayout, { pageTitle: "Kurals", pageTitleRight: _jsx(FeedTabs, { activeFeed: activeFeed, onFeedChange: setActiveFeed }), children: [_jsx("div", { className: "overflow-y-auto scroll-smooth pb-20", children: shouldShowSearch ? (_jsx(SearchResults, {})) : activeFeed === 'latest' ? (_jsx(LatestFeed, {})) : (_jsx(ForYouFeed, {})) }), showTuningModal && tuningService.getLastSuggestion() && (_jsx(TuningSuggestionModal, { suggestion: tuningService.getLastSuggestion(), onClose: () => {
                            setShowTuningModal(false);
                            localStorage.setItem('tuning_suggestion_dismissed', 'true');
                        }, onApply: () => {
                            setShowTuningModal(false);
                            localStorage.removeItem('tuning_suggestion_dismissed');
                        } }))] }), showTooltips && _jsx(FirstTimeTooltips, {}), showWelcomeOverlay && _jsx(WelcomeScreen, { onComplete: handleWelcomeComplete })] }));
};
export default ChirpApp;
