import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../stores/useAuthStore';
import { useUserStore } from '../../stores/useUserStore';
import { userService } from '../../services/userService';
import { chirpService } from '../../services/chirpService';
import { commentService } from '../../services/commentService';
import { colors } from '../../theme/colors';
import type { User, Chirp, Comment } from '../../types';

interface DashboardMetrics {
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
  postValue30d: number;
  commentValue30d: number;
  totalValue30d: number;
  lifetimePostValue: number;
  lifetimeCommentValue: number;
  totalLifetimeValue: number;
  totalPosts: number;
  totalComments: number;
  followingCount: number;
  followersCount: number;
  bookmarksCount: number;
  accountAgeDays: number;
  averagePostValue: number;
  averageCommentValue: number;
  highValuePosts: number;
  mediumValuePosts: number;
  lowValuePosts: number;
  cleanPosts: number;
  needsReviewPosts: number;
  blockedPosts: number;
  verifiedClaims: number;
  falseClaims: number;
  unverifiedClaims: number;
  totalCommentsReceived: number;
  averageDiscussionQuality: number;
  highQualityDiscussions: number;
  reputationByDomain: Record<string, number>;
  isMonetizationEligible: boolean;
  meetsScoreThreshold: boolean;
  meetsAccountAgeThreshold: boolean;
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
    case 'Excellent': return colors.light.success;
    case 'Good': return '#3B82F6';
    case 'Fair': return '#F59E0B';
    case 'Poor': return '#F97316';
    case 'Very Poor': return colors.light.error;
    default: return colors.light.textMuted;
  }
};

const DashboardScreen = () => {
  const navigation = useNavigation();
  const { user: currentUser } = useAuthStore();
  const { users } = useUserStore();
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

        let user = await userService.getUser(currentUser.id);
        if (!user) {
          setIsLoading(false);
          return;
        }

        if (!user.kurralScore) {
          // Initialize kurralScore if missing
          const valueStats = user.valueStats;
          const totalRollingValue = (valueStats?.postValue30d ?? 0) + (valueStats?.commentValue30d ?? 0);
          const initialScore = Math.min(100, Math.max(0, 50 + Math.floor(totalRollingValue / 10)));
          
          await userService.updateUser(user.id, {
            kurralScore: {
              score: initialScore,
              lastUpdated: new Date(),
              components: {
                qualityHistory: 50,
                violationHistory: 0,
                engagementQuality: 40,
                consistency: Math.min(100, Math.floor(totalRollingValue / 5)),
                communityTrust: 100,
              },
              history: [],
            },
          });
          user = await userService.getUser(currentUser.id);
          if (!user) {
            setIsLoading(false);
            return;
          }
        }

        const [allPosts, allComments] = await Promise.all([
          chirpService.getChirpsByAuthor(currentUser.id, 500),
          commentService.getCommentsByAuthor(currentUser.id, 500),
        ]);

        const followers = Object.values(users).filter(
          u => u.following && u.following.includes(currentUser.id)
        );

        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const postsLast7d = allPosts.filter(p => p.createdAt >= sevenDaysAgo).length;
        const commentsLast7d = allComments.filter(c => c.createdAt >= sevenDaysAgo).length;
        const valueLast7d = allPosts
          .filter(p => p.createdAt >= sevenDaysAgo && p.valueScore)
          .reduce((sum, p) => sum + (p.valueScore?.total || 0), 0);

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

        const totalCommentsReceived = allPosts.reduce((sum, post) => sum + (post.commentCount || 0), 0);

        const accountAgeDays = Math.floor(
          (Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24)
        );

        let kurralScoreValue = user.kurralScore?.score ?? 0;
        if (kurralScoreValue > 100) {
          if (kurralScoreValue >= 300 && kurralScoreValue <= 850) {
            kurralScoreValue = ((kurralScoreValue - 300) / (850 - 300)) * 100;
          }
          kurralScoreValue = Math.max(0, Math.min(100, kurralScoreValue));
        }
        kurralScoreValue = Math.max(0, Math.min(100, Math.round(kurralScoreValue)));
        const meetsScoreThreshold = kurralScoreValue >= 77;
        const meetsAccountAgeThreshold = accountAgeDays >= 30;
        const isMonetizationEligible = meetsScoreThreshold && meetsAccountAgeThreshold;

        const valueStats = user.valueStats;
        const postValue30d = valueStats?.postValue30d ?? 0;
        const commentValue30d = valueStats?.commentValue30d ?? 0;
        const totalValue30d = postValue30d + commentValue30d;
        const lifetimePostValue = valueStats?.lifetimePostValue ?? 0;
        const lifetimeCommentValue = valueStats?.lifetimeCommentValue ?? 0;
        const totalLifetimeValue = lifetimePostValue + lifetimeCommentValue;

        const kurralComponents = user.kurralScore?.components || {
          qualityHistory: 0,
          violationHistory: 0,
          engagementQuality: 0,
          consistency: 0,
          communityTrust: 0,
        };

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
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.light.accent} />
          <Text style={styles.loadingText}>Loading dashboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!metrics) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>No data available</Text>
        </View>
      </SafeAreaView>
    );
  }

  const tierColor = getTierColor(metrics.kurralTier);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.light.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Dashboard</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Overview Section */}
        <View style={styles.section}>
          {/* Kurral Score Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Kurral Score</Text>
              <View style={[styles.tierBadge, { backgroundColor: tierColor + '20' }]}>
                <Text style={[styles.tierText, { color: tierColor }]}>{metrics.kurralTier}</Text>
              </View>
            </View>
            <Text style={styles.scoreValue}>{metrics.kurralScore.toFixed(0)}</Text>
            <View style={styles.progressBarContainer}>
              <View
                style={[
                  styles.progressBar,
                  { width: `${metrics.kurralScore}%`, backgroundColor: tierColor },
                ]}
              />
            </View>
            <View style={styles.componentsGrid}>
              <View style={styles.componentItem}>
                <Text style={styles.componentLabel}>Quality</Text>
                <Text style={styles.componentValue}>{metrics.kurralComponents.qualityHistory}</Text>
              </View>
              <View style={styles.componentItem}>
                <Text style={styles.componentLabel}>Engagement</Text>
                <Text style={styles.componentValue}>{metrics.kurralComponents.engagementQuality}</Text>
              </View>
              <View style={styles.componentItem}>
                <Text style={styles.componentLabel}>Consistency</Text>
                <Text style={styles.componentValue}>{metrics.kurralComponents.consistency}</Text>
              </View>
              <View style={styles.componentItem}>
                <Text style={styles.componentLabel}>Trust</Text>
                <Text style={styles.componentValue}>{metrics.kurralComponents.communityTrust}</Text>
              </View>
            </View>
          </View>

          {/* Value Stats Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Value (30d)</Text>
            <View style={styles.valueItem}>
              <Text style={styles.valueLabel}>Posts</Text>
              <Text style={styles.valueNumber}>{(metrics.postValue30d * 100).toFixed(0)}</Text>
            </View>
            <View style={styles.progressBarContainer}>
              <View
                style={[
                  styles.progressBar,
                  {
                    width: `${Math.min(100, (metrics.postValue30d / Math.max(metrics.totalValue30d, 0.01)) * 100)}%`,
                    backgroundColor: colors.light.accent,
                  },
                ]}
              />
            </View>
            <View style={styles.valueItem}>
              <Text style={styles.valueLabel}>Comments</Text>
              <Text style={styles.valueNumber}>{(metrics.commentValue30d * 100).toFixed(0)}</Text>
            </View>
            <View style={styles.progressBarContainer}>
              <View
                style={[
                  styles.progressBar,
                  {
                    width: `${Math.min(100, (metrics.commentValue30d / Math.max(metrics.totalValue30d, 0.01)) * 100)}%`,
                    backgroundColor: colors.light.accent,
                  },
                ]}
              />
            </View>
            <View style={[styles.valueItem, styles.valueTotal]}>
              <Text style={styles.valueLabel}>Total</Text>
              <Text style={[styles.valueNumber, { color: colors.light.accent }]}>
                {(metrics.totalValue30d * 100).toFixed(0)}
              </Text>
            </View>
          </View>

          {/* Monetization Status Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Monetization</Text>
            <View style={[styles.monetizationBox, metrics.isMonetizationEligible && styles.monetizationBoxEligible]}>
              <Text style={styles.monetizationStatus}>
                {metrics.isMonetizationEligible ? 'Eligible' : 'Not Eligible'}
              </Text>
              <View style={styles.monetizationCriteria}>
                <View style={styles.criteriaRow}>
                  <Text style={styles.criteriaLabel}>Score ≥ 77</Text>
                  <Text style={[styles.criteriaValue, metrics.meetsScoreThreshold && styles.criteriaMet]}>
                    {metrics.meetsScoreThreshold ? '✓' : '✗'} {metrics.kurralScore.toFixed(0)}
                  </Text>
                </View>
                <View style={styles.criteriaRow}>
                  <Text style={styles.criteriaLabel}>Account Age ≥ 30d</Text>
                  <Text style={[styles.criteriaValue, metrics.meetsAccountAgeThreshold && styles.criteriaMet]}>
                    {metrics.meetsAccountAgeThreshold ? '✓' : '✗'} {metrics.accountAgeDays}d
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Content Performance Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Content Performance</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{metrics.totalPosts}</Text>
              <Text style={styles.statLabel}>Total Posts</Text>
              <Text style={styles.statSubtext}>Avg: {(metrics.averagePostValue * 100).toFixed(0)}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{metrics.totalComments}</Text>
              <Text style={styles.statLabel}>Total Comments</Text>
              <Text style={styles.statSubtext}>Avg: {(metrics.averageCommentValue * 100).toFixed(0)}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{metrics.totalCommentsReceived}</Text>
              <Text style={styles.statLabel}>Comments Received</Text>
              <Text style={styles.statSubtext}>On your posts</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{(metrics.averageDiscussionQuality * 100).toFixed(0)}</Text>
              <Text style={styles.statLabel}>Avg Discussion Quality</Text>
              <Text style={styles.statSubtext}>{metrics.highQualityDiscussions} high-quality</Text>
            </View>
          </View>

          <View style={styles.qualityDistribution}>
            <Text style={styles.subsectionTitle}>Post Quality Distribution</Text>
            <View style={styles.qualityGrid}>
              <View style={styles.qualityCard}>
                <Text style={[styles.qualityNumber, { color: colors.light.success }]}>
                  {metrics.highValuePosts}
                </Text>
                <Text style={styles.qualityLabel}>High (70+)</Text>
              </View>
              <View style={styles.qualityCard}>
                <Text style={[styles.qualityNumber, { color: '#F59E0B' }]}>
                  {metrics.mediumValuePosts}
                </Text>
                <Text style={styles.qualityLabel}>Medium (40-70)</Text>
              </View>
              <View style={styles.qualityCard}>
                <Text style={[styles.qualityNumber, { color: colors.light.error }]}>
                  {metrics.lowValuePosts}
                </Text>
                <Text style={styles.qualityLabel}>Low (&lt;40)</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Fact-Check & Policy Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Fact-Check & Policy Compliance</Text>
          <View style={styles.factCheckGrid}>
            <View style={styles.factCheckColumn}>
              <Text style={styles.subsectionTitle}>Post Status</Text>
              <View style={styles.factCheckItem}>
                <View style={[styles.factCheckDot, { backgroundColor: colors.light.success }]} />
                <Text style={styles.factCheckLabel}>Clean</Text>
                <Text style={styles.factCheckValue}>{metrics.cleanPosts}</Text>
              </View>
              <View style={styles.factCheckItem}>
                <View style={[styles.factCheckDot, { backgroundColor: '#F59E0B' }]} />
                <Text style={styles.factCheckLabel}>Needs Review</Text>
                <Text style={styles.factCheckValue}>{metrics.needsReviewPosts}</Text>
              </View>
              <View style={styles.factCheckItem}>
                <View style={[styles.factCheckDot, { backgroundColor: colors.light.error }]} />
                <Text style={styles.factCheckLabel}>Blocked</Text>
                <Text style={styles.factCheckValue}>{metrics.blockedPosts}</Text>
              </View>
            </View>
            <View style={styles.factCheckColumn}>
              <Text style={styles.subsectionTitle}>Claims Verification</Text>
              <View style={styles.factCheckItem}>
                <View style={[styles.factCheckDot, { backgroundColor: colors.light.success }]} />
                <Text style={styles.factCheckLabel}>Verified</Text>
                <Text style={styles.factCheckValue}>{metrics.verifiedClaims}</Text>
              </View>
              <View style={styles.factCheckItem}>
                <View style={[styles.factCheckDot, { backgroundColor: colors.light.error }]} />
                <Text style={styles.factCheckLabel}>False</Text>
                <Text style={styles.factCheckValue}>{metrics.falseClaims}</Text>
              </View>
              <View style={styles.factCheckItem}>
                <View style={[styles.factCheckDot, { backgroundColor: colors.light.textMuted }]} />
                <Text style={styles.factCheckLabel}>Unverified</Text>
                <Text style={styles.factCheckValue}>{metrics.unverifiedClaims}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Activity & Social Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Activity & Social</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{metrics.followingCount}</Text>
              <Text style={styles.statLabel}>Following</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{metrics.followersCount}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{metrics.bookmarksCount}</Text>
              <Text style={styles.statLabel}>Bookmarks</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{metrics.accountAgeDays}</Text>
              <Text style={styles.statLabel}>Days Active</Text>
            </View>
          </View>

          <View style={styles.recentActivity}>
            <Text style={styles.subsectionTitle}>Recent Activity (Last 7 Days)</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>{metrics.postsLast7d}</Text>
                <Text style={styles.statLabel}>Posts</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>{metrics.commentsLast7d}</Text>
                <Text style={styles.statLabel}>Comments</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={[styles.statNumber, { color: colors.light.accent }]}>
                  {(metrics.valueLast7d * 100).toFixed(0)}
                </Text>
                <Text style={styles.statLabel}>Value Generated</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Reputation Section */}
        {Object.keys(metrics.reputationByDomain).length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Reputation by Domain</Text>
            <View style={styles.reputationGrid}>
              {Object.entries(metrics.reputationByDomain)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 8)
                .map(([domain, score]) => (
                  <View key={domain} style={styles.reputationCard}>
                    <Text style={styles.reputationDomain}>{domain}</Text>
                    <Text style={[styles.reputationScore, { color: colors.light.accent }]}>
                      {(score * 100).toFixed(0)}
                    </Text>
                  </View>
                ))}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.light.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: colors.light.textMuted,
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: colors.light.textMuted,
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
    backgroundColor: colors.light.backgroundElevated,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.light.textPrimary,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    padding: 16,
    gap: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.light.textPrimary,
    marginBottom: 8,
  },
  subsectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.light.textMuted,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: colors.light.backgroundElevated,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.light.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  tierBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  tierText: {
    fontSize: 11,
    fontWeight: '600',
  },
  scoreValue: {
    fontSize: 36,
    fontWeight: '700',
    color: colors.light.textPrimary,
    marginBottom: 12,
  },
  progressBarContainer: {
    width: '100%',
    height: 8,
    backgroundColor: colors.light.border,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  componentsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  componentItem: {
    flex: 1,
    minWidth: '45%',
  },
  componentLabel: {
    fontSize: 11,
    color: colors.light.textMuted,
    marginBottom: 4,
  },
  componentValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.light.textPrimary,
  },
  valueItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  valueTotal: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.light.border,
  },
  valueLabel: {
    fontSize: 14,
    color: colors.light.textMuted,
  },
  valueNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.light.textPrimary,
  },
  monetizationBox: {
    padding: 16,
    borderRadius: 8,
    backgroundColor: colors.light.background,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  monetizationBoxEligible: {
    backgroundColor: colors.light.success + '10',
    borderColor: colors.light.success + '30',
  },
  monetizationStatus: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.light.textPrimary,
    marginBottom: 12,
  },
  monetizationCriteria: {
    gap: 8,
  },
  criteriaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  criteriaLabel: {
    fontSize: 12,
    color: colors.light.textMuted,
  },
  criteriaValue: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.light.error,
  },
  criteriaMet: {
    color: colors.light.success,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.light.backgroundElevated,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.light.border,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.light.textPrimary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: colors.light.textMuted,
    textAlign: 'center',
  },
  statSubtext: {
    fontSize: 10,
    color: colors.light.textMuted,
    marginTop: 4,
    textAlign: 'center',
  },
  qualityDistribution: {
    marginTop: 16,
  },
  qualityGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  qualityCard: {
    flex: 1,
    backgroundColor: colors.light.backgroundElevated,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.light.border,
    alignItems: 'center',
  },
  qualityNumber: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  qualityLabel: {
    fontSize: 10,
    color: colors.light.textMuted,
    textAlign: 'center',
  },
  factCheckGrid: {
    flexDirection: 'row',
    gap: 16,
  },
  factCheckColumn: {
    flex: 1,
  },
  factCheckItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: colors.light.backgroundElevated,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.light.border,
    marginBottom: 8,
  },
  factCheckDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  factCheckLabel: {
    flex: 1,
    fontSize: 14,
    color: colors.light.textPrimary,
  },
  factCheckValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.light.textPrimary,
  },
  recentActivity: {
    marginTop: 16,
  },
  reputationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  reputationCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.light.backgroundElevated,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  reputationDomain: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.light.textPrimary,
    marginBottom: 8,
    textTransform: 'capitalize',
  },
  reputationScore: {
    fontSize: 20,
    fontWeight: '700',
  },
});

export default DashboardScreen;

