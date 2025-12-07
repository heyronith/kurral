import { useEffect, useState } from 'react';
import { useUserStore } from '../store/useUserStore';
import { useThemeStore } from '../store/useThemeStore';
import { userService, chirpService, commentService } from '../lib/firestore';
import { initializeKurralScore } from '../lib/services/kurralScoreService';
import type { User, Chirp, Comment } from '../types';
import AppLayout from '../components/AppLayout';

interface DashboardMetrics {
  // Kurral Score
  kurralScore: number;
  kurralTier: string;
  kurralComponents: {
    qualityHistory: number;
    violationHistory: number;
    engagementQuality: number;
    consistency: number;
    communityTrust: number;
  };
  kurralHistory: Array<{
    score: number;
    delta: number;
    reason: string;
    date: Date;
  }>;
  
  // Value Stats
  postValue30d: number;
  commentValue30d: number;
  totalValue30d: number;
  lifetimePostValue: number;
  lifetimeCommentValue: number;
  totalLifetimeValue: number;
  
  // Activity
  totalPosts: number;
  totalComments: number;
  followingCount: number;
  followersCount: number;
  bookmarksCount: number;
  accountAgeDays: number;
  
  // Content Quality
  averagePostValue: number;
  averageCommentValue: number;
  highValuePosts: number;
  mediumValuePosts: number;
  lowValuePosts: number;
  
  // Fact-Check Metrics
  cleanPosts: number;
  needsReviewPosts: number;
  blockedPosts: number;
  verifiedClaims: number;
  falseClaims: number;
  unverifiedClaims: number;
  
  // Engagement
  totalCommentsReceived: number;
  averageDiscussionQuality: number;
  highQualityDiscussions: number;
  
  // Reputation
  reputationByDomain: Record<string, number>;
  
  // Monetization
  isMonetizationEligible: boolean;
  meetsScoreThreshold: boolean;
  meetsAccountAgeThreshold: boolean;
  
  // Recent Activity (7 days)
  postsLast7d: number;
  commentsLast7d: number;
  valueLast7d: number;
}

const getKurralTier = (score: number): string => {
  if (score >= 88) return 'Excellent';
  if (score >= 77) return 'Good';
  if (score >= 65) return 'Fair';
  if (score >= 53) return 'Poor';
  return 'Very Poor';
};

const getTierColor = (tier: string): string => {
  switch (tier) {
    case 'Excellent': return 'text-green-600';
    case 'Good': return 'text-blue-600';
    case 'Fair': return 'text-yellow-600';
    case 'Poor': return 'text-orange-600';
    case 'Very Poor': return 'text-red-600';
    default: return 'text-textMuted';
  }
};

const DashboardPage = () => {
  const { currentUser, users } = useUserStore();
  const { theme } = useThemeStore();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadDashboardData = async () => {
      if (!currentUser) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        
        // Ensure kurralScore is initialized
        let user = await userService.getUser(currentUser.id);
        if (!user) {
          setIsLoading(false);
          return;
        }

        if (!user.kurralScore) {
          await initializeKurralScore(user.id);
          user = await userService.getUser(currentUser.id);
          if (!user) {
            setIsLoading(false);
            return;
          }
        }

        // Load all posts and comments (limit to 500 for performance)
        const [allPosts, allComments] = await Promise.all([
          chirpService.getChirpsByAuthor(currentUser.id, 500),
          commentService.getCommentsByAuthor(currentUser.id, 500),
        ]);

        // Calculate followers count
        const followers = Object.values(users).filter(
          u => u.following && u.following.includes(currentUser.id)
        );

        // Calculate recent activity (7 days)
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const postsLast7d = allPosts.filter(p => p.createdAt >= sevenDaysAgo).length;
        const commentsLast7d = allComments.filter(c => c.createdAt >= sevenDaysAgo).length;
        const valueLast7d = allPosts
          .filter(p => p.createdAt >= sevenDaysAgo && p.valueScore)
          .reduce((sum, p) => sum + (p.valueScore?.total || 0), 0);

        // Content Quality Metrics
        const postsWithValue = allPosts.filter(p => p.valueScore);
        const averagePostValue = postsWithValue.length > 0
          ? postsWithValue.reduce((sum, p) => sum + (p.valueScore?.total || 0), 0) / postsWithValue.length
          : 0;
        
        const commentsWithValue = allComments.filter(c => c.valueContribution);
        const averageCommentValue = commentsWithValue.length > 0
          ? commentsWithValue.reduce((sum, c) => sum + (c.valueContribution?.total || 0), 0) / commentsWithValue.length
          : 0;

        const highValuePosts = postsWithValue.filter(p => (p.valueScore?.total || 0) > 0.7).length;
        const mediumValuePosts = postsWithValue.filter(p => {
          const val = p.valueScore?.total || 0;
          return val >= 0.4 && val <= 0.7;
        }).length;
        const lowValuePosts = postsWithValue.filter(p => (p.valueScore?.total || 0) < 0.4).length;

        // Fact-Check Metrics
        const cleanPosts = allPosts.filter(p => p.factCheckStatus === 'clean').length;
        const needsReviewPosts = allPosts.filter(p => p.factCheckStatus === 'needs_review').length;
        const blockedPosts = allPosts.filter(p => p.factCheckStatus === 'blocked').length;

        let verifiedClaims = 0;
        let falseClaims = 0;
        let unverifiedClaims = 0;
        allPosts.forEach(post => {
          if (post.factChecks) {
            post.factChecks.forEach(fc => {
              if (fc.verdict === 'true') verifiedClaims++;
              else if (fc.verdict === 'false') falseClaims++;
              else if (fc.verdict === 'unknown' || fc.verdict === 'mixed') unverifiedClaims++;
            });
          }
        });

        // Engagement Metrics
        const postsWithDiscussion = allPosts.filter(p => p.discussionQuality);
        const averageDiscussionQuality = postsWithDiscussion.length > 0
          ? postsWithDiscussion.reduce((sum, p) => {
              const dq = p.discussionQuality;
              if (!dq) return sum;
              const avg = ((dq.informativeness || 0) + (dq.reasoningDepth || 0) + 
                          (dq.crossPerspective || 0) + (dq.civility || 0)) / 4;
              return sum + avg;
            }, 0) / postsWithDiscussion.length
          : 0;

        const highQualityDiscussions = postsWithDiscussion.filter(p => {
          const dq = p.discussionQuality;
          if (!dq) return false;
          const avg = ((dq.informativeness || 0) + (dq.reasoningDepth || 0) + 
                      (dq.crossPerspective || 0) + (dq.civility || 0)) / 4;
          return avg > 0.7;
        }).length;

        // Calculate total comments received on user's posts (use commentCount if available)
        const totalCommentsReceived = allPosts.reduce((sum, post) => sum + (post.commentCount || 0), 0);

        // Account age
        const accountAgeDays = Math.floor(
          (Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24)
        );

        // Monetization eligibility
        // Ensure score is clamped to 0-100 (safety check in case normalization didn't run)
        let kurralScoreValue = user.kurralScore?.score ?? 0;
        if (kurralScoreValue > 100) {
          // Handle old scale migration
          if (kurralScoreValue >= 300 && kurralScoreValue <= 850) {
            kurralScoreValue = ((kurralScoreValue - 300) / (850 - 300)) * 100;
          }
          kurralScoreValue = Math.max(0, Math.min(100, kurralScoreValue));
        }
        kurralScoreValue = Math.max(0, Math.min(100, Math.round(kurralScoreValue)));
        const meetsScoreThreshold = kurralScoreValue >= 77;
        const meetsAccountAgeThreshold = accountAgeDays >= 30;
        const isMonetizationEligible = meetsScoreThreshold && meetsAccountAgeThreshold;

        // Value stats
        const valueStats = user.valueStats;
        const postValue30d = valueStats?.postValue30d ?? 0;
        const commentValue30d = valueStats?.commentValue30d ?? 0;
        const totalValue30d = postValue30d + commentValue30d;
        const lifetimePostValue = valueStats?.lifetimePostValue ?? 0;
        const lifetimeCommentValue = valueStats?.lifetimeCommentValue ?? 0;
        const totalLifetimeValue = lifetimePostValue + lifetimeCommentValue;

        // Kurral Score components
        const kurralComponents = user.kurralScore?.components || {
          qualityHistory: 0,
          violationHistory: 0,
          engagementQuality: 0,
          consistency: 0,
          communityTrust: 0,
        };

        // Kurral Score history
        const kurralHistory = (user.kurralScore?.history || []).map(entry => ({
          score: entry.score,
          delta: entry.delta,
          reason: entry.reason,
          date: entry.date instanceof Date ? entry.date : new Date(entry.date),
        }));

        const dashboardMetrics: DashboardMetrics = {
          kurralScore: kurralScoreValue,
          kurralTier: getKurralTier(kurralScoreValue),
          kurralComponents,
          kurralHistory,
          postValue30d,
          commentValue30d,
          totalValue30d,
          lifetimePostValue,
          lifetimeCommentValue,
          totalLifetimeValue,
          totalPosts: allPosts.length,
          totalComments: allComments.length,
          followingCount: user.following?.length || 0,
          followersCount: followers.length,
          bookmarksCount: user.bookmarks?.length || 0,
          accountAgeDays,
          averagePostValue,
          averageCommentValue,
          highValuePosts,
          mediumValuePosts,
          lowValuePosts,
          cleanPosts,
          needsReviewPosts,
          blockedPosts,
          verifiedClaims,
          falseClaims,
          unverifiedClaims,
          totalCommentsReceived,
          averageDiscussionQuality,
          highQualityDiscussions,
          reputationByDomain: user.reputation || {},
          isMonetizationEligible,
          meetsScoreThreshold,
          meetsAccountAgeThreshold,
          postsLast7d,
          commentsLast7d,
          valueLast7d,
        };

        setMetrics(dashboardMetrics);
      } catch (error) {
        console.error('Error loading dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboardData();
  }, [currentUser, users]);

  if (isLoading) {
    return (
      <AppLayout pageTitle="Dashboard" wrapContent={true}>
        <div className="min-h-screen flex items-center justify-center">
          <div className={theme === 'dark' ? 'text-white/70' : 'text-textMuted'}>Loading dashboard...</div>
        </div>
      </AppLayout>
    );
  }

  if (!metrics) {
    return (
      <AppLayout pageTitle="Dashboard" wrapContent={true}>
        <div className="min-h-screen flex items-center justify-center">
          <div className={theme === 'dark' ? 'text-white/70' : 'text-textMuted'}>No data available</div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout pageTitle="Dashboard" wrapContent={true}>
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'} mb-2`}>Dashboard</h1>
          <p className={theme === 'dark' ? 'text-white/70' : 'text-textMuted'}>Your activity metrics and performance overview</p>
        </div>

        {/* Overview Section */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Kurral Score Card */}
          <div className={`${theme === 'dark' ? 'bg-transparent border-white/10' : 'bg-backgroundElevated border-border'} rounded-xl border p-6`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-sm font-semibold ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'} uppercase tracking-wide`}>Kural Score</h3>
              <span className={`text-xs font-semibold px-2 py-1 rounded-full ${getTierColor(metrics.kurralTier)} bg-opacity-10`}>
                {metrics.kurralTier}
              </span>
            </div>
            <div className="mb-4">
              <div className={`text-4xl font-bold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'} mb-2`}>{metrics.kurralScore.toFixed(0)}</div>
              <div className={`w-full h-3 ${theme === 'dark' ? 'bg-white/10' : 'bg-background'} rounded-full overflow-hidden`}>
                <div
                  className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 transition-all duration-500"
                  style={{ width: `${metrics.kurralScore}%` }}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <div className={theme === 'dark' ? 'text-white/70' : 'text-textMuted'}>Quality</div>
                <div className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>{metrics.kurralComponents.qualityHistory}</div>
              </div>
              <div>
                <div className={theme === 'dark' ? 'text-white/70' : 'text-textMuted'}>Engagement</div>
                <div className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>{metrics.kurralComponents.engagementQuality}</div>
              </div>
              <div>
                <div className={theme === 'dark' ? 'text-white/70' : 'text-textMuted'}>Consistency</div>
                <div className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>{metrics.kurralComponents.consistency}</div>
              </div>
              <div>
                <div className={theme === 'dark' ? 'text-white/70' : 'text-textMuted'}>Trust</div>
                <div className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>{metrics.kurralComponents.communityTrust}</div>
              </div>
            </div>
          </div>

          {/* Value Stats Card */}
          <div className={`${theme === 'dark' ? 'bg-transparent border-white/10' : 'bg-backgroundElevated border-border'} rounded-xl border p-6`}>
            <h3 className={`text-sm font-semibold ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'} uppercase tracking-wide mb-4`}>Value (30d)</h3>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className={theme === 'dark' ? 'text-white/70' : 'text-textMuted'}>Posts</span>
                  <span className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>{(metrics.postValue30d * 100).toFixed(0)}</span>
                </div>
                <div className={`w-full h-2 ${theme === 'dark' ? 'bg-white/10' : 'bg-background'} rounded-full overflow-hidden`}>
                  <div
                    className="h-full bg-accent transition-all duration-500"
                    style={{ width: `${Math.min(100, (metrics.postValue30d / Math.max(metrics.totalValue30d, 0.01)) * 100)}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className={theme === 'dark' ? 'text-white/70' : 'text-textMuted'}>Comments</span>
                  <span className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>{(metrics.commentValue30d * 100).toFixed(0)}</span>
                </div>
                <div className={`w-full h-2 ${theme === 'dark' ? 'bg-white/10' : 'bg-background'} rounded-full overflow-hidden`}>
                  <div
                    className="h-full bg-primary transition-all duration-500"
                    style={{ width: `${Math.min(100, (metrics.commentValue30d / Math.max(metrics.totalValue30d, 0.01)) * 100)}%` }}
                  />
                </div>
              </div>
              <div className={`pt-2 border-t ${theme === 'dark' ? 'border-white/10' : 'border-border'}`}>
                <div className="flex justify-between">
                  <span className={`text-sm ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'}`}>Total</span>
                  <span className="text-lg font-bold text-accent">{(metrics.totalValue30d * 100).toFixed(0)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Monetization Status Card */}
          <div className={`${theme === 'dark' ? 'bg-transparent border-white/10' : 'bg-backgroundElevated border-border'} rounded-xl border p-6`}>
            <h3 className={`text-sm font-semibold ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'} uppercase tracking-wide mb-4`}>Monetization</h3>
            <div className="space-y-3">
              <div className={`p-4 rounded-lg ${metrics.isMonetizationEligible ? 'bg-green-500/10 border border-green-500/20' : theme === 'dark' ? 'bg-transparent border-white/10' : 'bg-background border border-border'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>Status</span>
                  <span className={`text-xs font-semibold ${metrics.isMonetizationEligible ? 'text-green-600' : theme === 'dark' ? 'text-white/70' : 'text-textMuted'}`}>
                    {metrics.isMonetizationEligible ? 'Eligible' : 'Not Eligible'}
                  </span>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className={theme === 'dark' ? 'text-white/70' : 'text-textMuted'}>Score ≥ 77</span>
                    <span className={metrics.meetsScoreThreshold ? 'text-green-600' : 'text-red-600'}>
                      {metrics.meetsScoreThreshold ? '✓' : '✗'} {metrics.kurralScore.toFixed(0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={theme === 'dark' ? 'text-white/70' : 'text-textMuted'}>Account Age ≥ 30d</span>
                    <span className={metrics.meetsAccountAgeThreshold ? 'text-green-600' : 'text-red-600'}>
                      {metrics.meetsAccountAgeThreshold ? '✓' : '✗'} {metrics.accountAgeDays}d
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Content Performance Section */}
        <section className={`${theme === 'dark' ? 'bg-transparent border-white/10' : 'bg-backgroundElevated border-border'} rounded-xl border p-6`}>
          <h2 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'} mb-6`}>Content Performance</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <div className={`text-sm ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'} mb-1`}>Total Posts</div>
              <div className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>{metrics.totalPosts}</div>
              <div className={`text-xs ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'} mt-1`}>Avg Value: {(metrics.averagePostValue * 100).toFixed(0)}</div>
            </div>
            <div>
              <div className={`text-sm ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'} mb-1`}>Total Comments</div>
              <div className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>{metrics.totalComments}</div>
              <div className={`text-xs ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'} mt-1`}>Avg Value: {(metrics.averageCommentValue * 100).toFixed(0)}</div>
            </div>
            <div>
              <div className={`text-sm ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'} mb-1`}>Comments Received</div>
              <div className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>{metrics.totalCommentsReceived}</div>
              <div className={`text-xs ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'} mt-1`}>On your posts</div>
            </div>
            <div>
              <div className={`text-sm ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'} mb-1`}>Avg Discussion Quality</div>
              <div className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>{(metrics.averageDiscussionQuality * 100).toFixed(0)}</div>
              <div className={`text-xs ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'} mt-1`}>{metrics.highQualityDiscussions} high-quality</div>
            </div>
          </div>

          {/* Quality Distribution */}
          <div className={`mt-6 pt-6 border-t ${theme === 'dark' ? 'border-white/10' : 'border-border'}`}>
            <h3 className={`text-sm font-semibold ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'} mb-4`}>Post Quality Distribution</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className={`text-center p-4 ${theme === 'dark' ? 'bg-transparent border-white/10' : 'bg-background'} rounded-lg border`}>
                <div className="text-2xl font-bold text-green-600">{metrics.highValuePosts}</div>
                <div className={`text-xs ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'} mt-1`}>High (70+)</div>
              </div>
              <div className={`text-center p-4 ${theme === 'dark' ? 'bg-transparent border-white/10' : 'bg-background'} rounded-lg border`}>
                <div className="text-2xl font-bold text-yellow-600">{metrics.mediumValuePosts}</div>
                <div className={`text-xs ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'} mt-1`}>Medium (40-70)</div>
              </div>
              <div className={`text-center p-4 ${theme === 'dark' ? 'bg-transparent border-white/10' : 'bg-background'} rounded-lg border`}>
                <div className="text-2xl font-bold text-red-600">{metrics.lowValuePosts}</div>
                <div className={`text-xs ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'} mt-1`}>Low (&lt;40)</div>
              </div>
            </div>
          </div>
        </section>

        {/* Fact-Check & Policy Section */}
        <section className={`${theme === 'dark' ? 'bg-transparent border-white/10' : 'bg-backgroundElevated border-border'} rounded-xl border p-6`}>
          <h2 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'} mb-6`}>Fact-Check & Policy Compliance</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className={`text-sm font-semibold ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'} mb-4`}>Post Status</h3>
              <div className="space-y-3">
                <div className={`flex items-center justify-between p-3 ${theme === 'dark' ? 'bg-transparent border-white/10' : 'bg-background'} rounded-lg border`}>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <span className={`text-sm ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>Clean</span>
                  </div>
                  <span className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>{metrics.cleanPosts}</span>
                </div>
                <div className={`flex items-center justify-between p-3 ${theme === 'dark' ? 'bg-transparent border-white/10' : 'bg-background'} rounded-lg border`}>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    <span className={`text-sm ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>Needs Review</span>
                  </div>
                  <span className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>{metrics.needsReviewPosts}</span>
                </div>
                <div className={`flex items-center justify-between p-3 ${theme === 'dark' ? 'bg-transparent border-white/10' : 'bg-background'} rounded-lg border`}>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <span className={`text-sm ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>Blocked</span>
                  </div>
                  <span className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>{metrics.blockedPosts}</span>
                </div>
              </div>
            </div>
            <div>
              <h3 className={`text-sm font-semibold ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'} mb-4`}>Claims Verification</h3>
              <div className="space-y-3">
                <div className={`flex items-center justify-between p-3 ${theme === 'dark' ? 'bg-transparent border-white/10' : 'bg-background'} rounded-lg border`}>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <span className={`text-sm ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>Verified</span>
                  </div>
                  <span className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>{metrics.verifiedClaims}</span>
                </div>
                <div className={`flex items-center justify-between p-3 ${theme === 'dark' ? 'bg-transparent border-white/10' : 'bg-background'} rounded-lg border`}>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <span className={`text-sm ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>False</span>
                  </div>
                  <span className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>{metrics.falseClaims}</span>
                </div>
                <div className={`flex items-center justify-between p-3 ${theme === 'dark' ? 'bg-transparent border-white/10' : 'bg-background'} rounded-lg border`}>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-gray-500" />
                    <span className={`text-sm ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>Unverified</span>
                  </div>
                  <span className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>{metrics.unverifiedClaims}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Activity & Social Section */}
        <section className={`${theme === 'dark' ? 'bg-transparent border-white/10' : 'bg-backgroundElevated border-border'} rounded-xl border p-6`}>
          <h2 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'} mb-6`}>Activity & Social</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className={`text-center p-4 ${theme === 'dark' ? 'bg-transparent border-white/10' : 'bg-background'} rounded-lg border`}>
              <div className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>{metrics.followingCount}</div>
              <div className={`text-xs ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'} mt-1`}>Following</div>
            </div>
            <div className={`text-center p-4 ${theme === 'dark' ? 'bg-transparent border-white/10' : 'bg-background'} rounded-lg border`}>
              <div className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>{metrics.followersCount}</div>
              <div className={`text-xs ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'} mt-1`}>Followers</div>
            </div>
            <div className={`text-center p-4 ${theme === 'dark' ? 'bg-transparent border-white/10' : 'bg-background'} rounded-lg border`}>
              <div className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>{metrics.bookmarksCount}</div>
              <div className={`text-xs ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'} mt-1`}>Bookmarks</div>
            </div>
            <div className={`text-center p-4 ${theme === 'dark' ? 'bg-transparent border-white/10' : 'bg-background'} rounded-lg border`}>
              <div className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>{metrics.accountAgeDays}</div>
              <div className={`text-xs ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'} mt-1`}>Days Active</div>
            </div>
          </div>

          {/* Recent Activity (7 days) */}
          <div className={`mt-6 pt-6 border-t ${theme === 'dark' ? 'border-white/10' : 'border-border'}`}>
            <h3 className={`text-sm font-semibold ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'} mb-4`}>Recent Activity (Last 7 Days)</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className={`text-center p-4 ${theme === 'dark' ? 'bg-transparent border-white/10' : 'bg-background'} rounded-lg border`}>
                <div className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>{metrics.postsLast7d}</div>
                <div className={`text-xs ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'} mt-1`}>Posts</div>
              </div>
              <div className={`text-center p-4 ${theme === 'dark' ? 'bg-transparent border-white/10' : 'bg-background'} rounded-lg border`}>
                <div className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>{metrics.commentsLast7d}</div>
                <div className={`text-xs ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'} mt-1`}>Comments</div>
              </div>
              <div className={`text-center p-4 ${theme === 'dark' ? 'bg-transparent border-white/10' : 'bg-background'} rounded-lg border`}>
                <div className="text-2xl font-bold text-accent">{(metrics.valueLast7d * 100).toFixed(0)}</div>
                <div className={`text-xs ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'} mt-1`}>Value Generated</div>
              </div>
            </div>
          </div>
        </section>

        {/* Reputation Section */}
        {Object.keys(metrics.reputationByDomain).length > 0 && (
          <section className={`${theme === 'dark' ? 'bg-transparent border-white/10' : 'bg-backgroundElevated border-border'} rounded-xl border p-6`}>
            <h2 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'} mb-6`}>Reputation by Domain</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(metrics.reputationByDomain)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 8)
                .map(([domain, score]) => (
                  <div key={domain} className={`p-4 ${theme === 'dark' ? 'bg-transparent border-white/10' : 'bg-background'} rounded-lg border`}>
                    <div className={`text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'} capitalize mb-1`}>{domain}</div>
                    <div className="text-2xl font-bold text-accent">{(score * 100).toFixed(0)}</div>
                  </div>
                ))}
            </div>
          </section>
        )}

      </div>
    </AppLayout>
  );
};

export default DashboardPage;

