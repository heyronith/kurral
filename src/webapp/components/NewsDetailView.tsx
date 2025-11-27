// News Detail View - Shows full news article with related posts
import { useEffect, useState, useMemo } from 'react';
import { useNewsStore } from '../store/useNewsStore';
import { useFeedStore } from '../store/useFeedStore';
import { useThemeStore } from '../store/useThemeStore';
import { chirpService } from '../lib/firestore';
import ChirpCard from './ChirpCard';
import Composer from './Composer';
import type { Chirp } from '../types';

const NewsDetailView = () => {
  const { selectedNews, clearSelection } = useNewsStore();
  const { chirps } = useFeedStore();
  const { theme } = useThemeStore();
  const [activeTab, setActiveTab] = useState<'top' | 'latest'>('top');
  const [fetchedStoryPosts, setFetchedStoryPosts] = useState<Chirp[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Ensure we have all posts referenced by the news story
  useEffect(() => {
    let isCancelled = false;

    const fetchMissingPosts = async () => {
      if (!selectedNews?.storyClusterPostIds || selectedNews.storyClusterPostIds.length === 0) {
        setFetchedStoryPosts([]);
        return;
      }

      const availableIds = new Set(chirps.map((chirp) => chirp.id));
      const missingIds = selectedNews.storyClusterPostIds.filter((id) => !availableIds.has(id));

      if (missingIds.length === 0) {
        setFetchedStoryPosts([]);
        return;
      }

      try {
        const results = await Promise.all(missingIds.map((id) => chirpService.getChirp(id)));
        if (!isCancelled) {
          setFetchedStoryPosts(results.filter((post): post is Chirp => Boolean(post)));
          setFetchError(null);
        }
      } catch (error) {
        console.error('Error fetching story posts:', error);
        if (!isCancelled) {
          setFetchedStoryPosts([]);
          setFetchError('Failed to load some related posts');
        }
      }
    };

    fetchMissingPosts();

    return () => {
      isCancelled = true;
    };
  }, [selectedNews?.storyClusterPostIds?.join(','), chirps]);

  // Filter and sort related posts
  const relatedPosts = useMemo(() => {
    if (!selectedNews) return [];

    const availablePosts = new Map<string, Chirp>();
    chirps.forEach((post) => availablePosts.set(post.id, post));
    fetchedStoryPosts.forEach((post) => availablePosts.set(post.id, post));

    const sortByTab = (posts: Chirp[]): Chirp[] => {
      if (activeTab === 'top') {
        return [...posts].sort((a, b) => {
          if (b.commentCount !== a.commentCount) {
            return b.commentCount - a.commentCount;
          }
          return b.createdAt.getTime() - a.createdAt.getTime();
        });
      }
      return [...posts].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    };

    if (selectedNews.storyClusterPostIds && selectedNews.storyClusterPostIds.length > 0) {
      const ordered = selectedNews.storyClusterPostIds
        .map((id) => availablePosts.get(id))
        .filter((post): post is Chirp => Boolean(post));
      if (ordered.length > 0) {
        return sortByTab(ordered);
      }
    }

    const keywords = selectedNews.keywords.map((k) => k.toLowerCase());
    const topics = selectedNews.relatedTopics.map((t) => t.toLowerCase());
    const titleWords = selectedNews.title.toLowerCase().split(/\s+/).filter((w) => w.length > 3);

    const pool = Array.from(availablePosts.values());
    const matched = pool.filter((chirp) => {
      const chirpText = chirp.text.toLowerCase();
      const chirpTopic = chirp.topic.toLowerCase();

      const matchesKeyword = keywords.some((keyword) => chirpText.includes(keyword));
      const matchesTitleWord = titleWords.some((word) => chirpText.includes(word));
      const matchesTopic = topics.includes(chirpTopic);

      return matchesKeyword || matchesTitleWord || matchesTopic;
    });

    return sortByTab(matched);
  }, [selectedNews, chirps, fetchedStoryPosts, activeTab]);

  // Format relative time
  const formatTimeAgo = (date: Date | null | undefined): string => {
    if (!date) return 'Unknown';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    if (diffMs < 0) return 'Just now'; // Handle future dates
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    return 'Earlier today';
  };

  if (!selectedNews) {
    return (
      <div className={`min-h-screen ${theme === 'dark' ? 'bg-black' : 'bg-background'} flex items-center justify-center`}>
        <div className="text-center">
          <p className={theme === 'dark' ? 'text-white/70' : 'text-textMuted mb-4'}>No news selected</p>
          <button
            onClick={clearSelection}
            className="text-primary hover:text-primaryHover transition-colors"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-black' : 'bg-background'}`}>
      {/* Header with navigation */}
      <header className={`sticky top-0 z-40 border-b-2 ${theme === 'dark' ? 'border-white/10 bg-black/98' : 'border-border/60 bg-background/98'} backdrop-blur-md py-3 px-4 shadow-elevated`}>
        <div className="flex items-center justify-between">
          <button
            onClick={clearSelection}
            className={`p-2 rounded-lg ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-backgroundElevated/50'} transition-colors`}
            aria-label="Go back"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={theme === 'dark' ? 'text-white' : 'text-textPrimary'}
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <button
              className={`p-2 rounded-lg ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-backgroundElevated/50'} transition-colors`}
              aria-label="Bookmark"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={theme === 'dark' ? 'text-white/70' : 'text-textMuted'}
              >
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
            </button>
            <button
              className={`p-2 rounded-lg ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-backgroundElevated/50'} transition-colors`}
              aria-label="Share"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={theme === 'dark' ? 'text-white/70' : 'text-textMuted'}
              >
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                <polyline points="16 6 12 2 8 6" />
                <line x1="12" y1="2" x2="12" y2="15" />
              </svg>
            </button>
            <button
              className={`p-2 rounded-lg ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-backgroundElevated/50'} transition-colors`}
              aria-label="More options"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={theme === 'dark' ? 'text-white/70' : 'text-textMuted'}
              >
                <circle cx="12" cy="12" r="1" />
                <circle cx="12" cy="5" r="1" />
                <circle cx="12" cy="19" r="1" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* News Content */}
      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Title */}
        <h1 className={`text-2xl md:text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'} mb-3 leading-tight`}>
          {selectedNews.title}
        </h1>

        {/* Timestamp */}
        <p className={`text-sm ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'} mb-6`}>
          Last updated {formatTimeAgo(selectedNews.lastUpdated)}
        </p>

        {/* Description */}
        <div className="prose prose-invert max-w-none mb-6">
          <p className={`text-base ${theme === 'dark' ? 'text-white/90' : 'text-textSecondary'} leading-relaxed whitespace-pre-line`}>
            {selectedNews.description}
          </p>
        </div>

        {/* Disclaimer */}
        <div className={`mb-6 p-3 ${theme === 'dark' ? 'bg-transparent border-white/10' : 'bg-backgroundElevated/30 border-border/50'} border rounded-lg`}>
          <p className={`text-xs ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'} leading-relaxed`}>
            This story is a summary of posts on X and may evolve over time. Grok can make mistakes, verify its outputs.
          </p>
        </div>

        {/* Composer - Above tabs */}
        <div className="mb-6">
          <Composer />
        </div>

        {/* Tabs */}
        <div className={`flex items-center gap-1 mb-4 border-b ${theme === 'dark' ? 'border-white/10' : 'border-border'}`}>
          <button
            onClick={() => setActiveTab('top')}
            className={`px-4 py-2 text-sm font-medium transition-colors relative ${
              activeTab === 'top'
                ? theme === 'dark' ? 'text-white' : 'text-textPrimary'
                : theme === 'dark' ? 'text-white/70 hover:text-white' : 'text-textMuted hover:text-textPrimary'
            }`}
          >
            Top
            {activeTab === 'top' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('latest')}
            className={`px-4 py-2 text-sm font-medium transition-colors relative ${
              activeTab === 'latest'
                ? theme === 'dark' ? 'text-white' : 'text-textPrimary'
                : theme === 'dark' ? 'text-white/70 hover:text-white' : 'text-textMuted hover:text-textPrimary'
            }`}
          >
            Latest
            {activeTab === 'latest' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
        </div>

        {/* Related Posts */}
        <div className="space-y-0">
          {fetchError && (
            <div className="p-4 mb-4 bg-warning/10 border-2 border-warning/30 rounded-lg">
              <p className="text-xs text-warning">{fetchError}</p>
            </div>
          )}
          {relatedPosts.length === 0 ? (
            <div className={`p-8 text-center ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'} border-t ${theme === 'dark' ? 'border-white/10' : 'border-border'}`}>
              <p className="text-sm">No related posts found for this news story.</p>
              <p className="text-xs mt-2">Be the first to post about it!</p>
            </div>
          ) : (
            relatedPosts.map((chirp) => (
              <div key={chirp.id}>
                <div className={`px-4 py-2 text-xs ${theme === 'dark' ? 'text-white/70 bg-transparent border-white/10' : 'text-textMuted bg-backgroundElevated/30 border-border'} border-b`}>
                  {activeTab === 'top' ? 'Top post' : 'Latest post'} about this story
                </div>
                <ChirpCard chirp={chirp} />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default NewsDetailView;

