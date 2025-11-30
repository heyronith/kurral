// Trending News Section - Displays top 3 trending news headlines
import { useEffect } from 'react';
import { useNewsStore } from '../store/useNewsStore';
import { useUserStore } from '../store/useUserStore';
import { useThemeStore } from '../store/useThemeStore';

const TrendingNewsSection = () => {
  const { trendingNews, isLoading, loadTrendingNews, selectNews, lastUpdated, refreshNews, error } = useNewsStore();
  const { currentUser } = useUserStore();
  const { theme } = useThemeStore();
  const interestsKey = currentUser?.interests?.join('|') ?? '';

  // Load trending news on mount and when interests change
  useEffect(() => {
    let isCancelled = false;
    const userId = currentUser?.id ?? null;
    
    const loadNews = async () => {
      if (!isCancelled) {
        await loadTrendingNews(userId, true);
      }
    };
    
    loadNews();
    
    return () => {
      isCancelled = true;
    };
  }, [loadTrendingNews, currentUser?.id, interestsKey]);

  // Show last updated time
  const getLastUpdatedText = () => {
    if (!lastUpdated) return '';
    const now = new Date();
    const diffMs = now.getTime() - lastUpdated.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    
    if (diffMins < 1) return 'Updated just now';
    if (diffMins < 60) return `Updated ${diffMins}m ago`;
    if (diffHours < 24) return `Updated ${diffHours}h ago`;
    return `Updated ${Math.floor(diffHours / 24)}d ago`;
  };

  // Format relative time
  const formatTimeAgo = (date: Date | null | undefined): string => {
    if (!date) return 'Unknown';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    if (diffMs < 0) return 'Just now'; // Handle future dates
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return '1 day ago';
    return `${diffDays} days ago`;
  };

  // Format engagement count
  const formatEngagement = (count: number): string => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M posts`;
    }
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K posts`;
    }
    return `${count} posts`;
  };

  // Get category color
  const getCategoryColor = (category: string): string => {
    const colors: Record<string, string> = {
      technology: 'bg-blue-500/20 text-blue-400',
      business: 'bg-green-500/20 text-green-400',
      entertainment: 'bg-purple-500/20 text-purple-400',
      sports: 'bg-orange-500/20 text-orange-400',
      health: 'bg-red-500/20 text-red-400',
      science: 'bg-cyan-500/20 text-cyan-400',
      general: 'bg-gray-500/20 text-gray-400',
    };
    return colors[category.toLowerCase()] || colors.general;
  };

  if (isLoading && trendingNews.length === 0) {
    return (
      <div className={`rounded-2xl p-4 ${theme === 'dark' ? 'border border-white/20 bg-transparent' : 'bg-backgroundElevated shadow-sm'}`}>
        <h3 className={`mb-3 text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>Today's News</h3>
        <div className="py-4 text-center">
          <p className={`text-xs ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'}`}>Loading trending news...</p>
        </div>
      </div>
    );
  }

  if (error && trendingNews.length === 0) {
    return (
      <div className={`rounded-2xl p-4 ${theme === 'dark' ? 'border border-white/20 bg-transparent' : 'bg-backgroundElevated shadow-sm'}`}>
        <h3 className={`mb-3 text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>Today's News</h3>
        <div className="py-4 text-center">
          <p className="text-xs text-error mb-2">{error}</p>
          <button
            onClick={() => refreshNews()}
            className="text-xs text-primary hover:text-primaryHover transition-colors"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (trendingNews.length === 0) {
    return (
      <div className={`rounded-2xl p-4 ${theme === 'dark' ? 'border border-white/20 bg-transparent' : 'bg-backgroundElevated shadow-sm'}`}>
        <h3 className={`mb-3 text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>Today's News</h3>
        <div className="py-4 text-center">
          <p className={`text-xs ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'}`}>No trending news available</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl p-4 ${theme === 'dark' ? 'border border-white/20 bg-transparent' : 'bg-backgroundElevated shadow-sm'}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className={`text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>Today's News</h3>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className={`text-[10px] ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'}`} title={`News refreshes every 3 hours. Last updated: ${lastUpdated.toLocaleString()}`}>
              {getLastUpdatedText()}
            </span>
          )}
          <button
            onClick={async () => {
              try {
                await refreshNews();
              } catch (error) {
                console.error('Error refreshing news:', error);
              }
            }}
            disabled={isLoading}
            className={`p-1 rounded ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-background/60'} transition-colors disabled:opacity-50`}
            title="Refresh news"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`${theme === 'dark' ? 'text-white/70' : 'text-textMuted'} ${isLoading ? 'animate-spin' : ''}`}
            >
              <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
            </svg>
          </button>
        </div>
      </div>
      <div className="space-y-3">
        {trendingNews.map((news, index) => {
          const isRecent = news.publishedAt && (Date.now() - news.publishedAt.getTime() < 2 * 60 * 60 * 1000); // Less than 2 hours
          
          return (
            <button
              key={news.id}
              onClick={() => selectNews(news.id)}
              className={`w-full rounded-xl px-3 py-2.5 text-left transition ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-background/60'} group`}
            >
              {/* Header with rank and trending badge */}
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className={`text-xs ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'}`}>#{index + 1}</span>
                  {isRecent && (
                    <span className="px-1.5 py-0.5 text-[10px] font-medium bg-primary/20 text-primary rounded">
                      Trending now
                    </span>
                  )}
                  {!isRecent && (
                    <span className={`text-xs ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'}`}>
                      {formatTimeAgo(news.publishedAt)}
                    </span>
                  )}
                </div>
                <span className={`px-2 py-0.5 text-[10px] font-medium rounded capitalize ${getCategoryColor(news.category)}`}>
                  {news.category}
                </span>
              </div>

              {/* Headline */}
              <p className={`text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'} mb-2 line-clamp-2 group-hover:text-primary transition-colors`}>
                {news.title}
              </p>

              {/* Metadata */}
              <div className="flex items-center justify-end">
                <p className={`text-xs ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'}`}>
                  {formatEngagement(news.engagementCount)}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default TrendingNewsSection;

