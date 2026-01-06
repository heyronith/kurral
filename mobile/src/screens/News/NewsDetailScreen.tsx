import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { HomeStackParamList } from '../../navigation/AppNavigator';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNewsStore } from '../../stores/useNewsStore';
import { useFeedStore } from '../../stores/useFeedStore';
import { useUserStore } from '../../stores/useUserStore';
import { chirpService } from '../../services/chirpService';
import ChirpCard from '../../components/ChirpCard';
import { colors } from '../../theme/colors';
import { shouldDisplayChirp } from '../../utils/chirpVisibility';
import type { Chirp } from '../../types';

type NavigationProp = NativeStackNavigationProp<HomeStackParamList>;
type RouteProp = {
  key: string;
  name: 'NewsDetail';
  params: { newsId: string };
};

const formatTimeAgo = (date: Date | null | undefined): string => {
  if (!date) return 'Unknown';
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 0) return 'Just now';
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minutes ago`;
  if (diffHours < 24) return `${diffHours} hours ago`;
  return 'Earlier today';
};

const NewsDetailScreen = () => {
  const route = useRoute<RouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const { newsId } = route.params;
  const { selectedNews, selectNews, clearSelection } = useNewsStore();
  const currentUser = useUserStore((state) => state.currentUser);
  const { chirps } = useFeedStore();
  const [activeTab, setActiveTab] = useState<'top' | 'latest'>('top');
  const [fetchedStoryPosts, setFetchedStoryPosts] = useState<Chirp[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadNews = async () => {
      setIsLoading(true);
      try {
        await selectNews(newsId);
      } catch (error) {
        console.error('[NewsDetailScreen] Error loading news:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadNews();
  }, [newsId, selectNews]);

  // Fetch missing posts referenced by the news story
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
        console.error('[NewsDetailScreen] Error fetching story posts:', error);
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

    const ensureVisible = (posts: Chirp[]): Chirp[] =>
      posts.filter((post) => shouldDisplayChirp(post, currentUser?.id));

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
        return ensureVisible(sortByTab(ordered));
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

    return ensureVisible(sortByTab(matched));
  }, [selectedNews, chirps, fetchedStoryPosts, activeTab, currentUser?.id]);

  const handleBack = () => {
    clearSelection();
    navigation.goBack();
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.light.accent} />
          <Text style={styles.loadingText}>Loading news...</Text>
        </View>
      </View>
    );
  }

  if (!selectedNews) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>News not found</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* Title */}
          <Text style={styles.title}>{selectedNews.title}</Text>

          {/* Timestamp */}
          <Text style={styles.timestamp}>
            Last updated {formatTimeAgo(selectedNews.lastUpdated)}
          </Text>

          {/* Description */}
          <Text style={styles.description}>{selectedNews.description}</Text>

          {/* Disclaimer */}
          <View style={styles.disclaimer}>
            <Text style={styles.disclaimerText}>
              This story is a summary of posts on X and may evolve over time. Grok can make mistakes, verify its outputs.
            </Text>
          </View>

          {/* Tabs */}
          <View style={styles.tabs}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'top' && styles.activeTab]}
              onPress={() => setActiveTab('top')}
            >
              <Text style={[styles.tabText, activeTab === 'top' && styles.activeTabText]}>
                Top
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'latest' && styles.activeTab]}
              onPress={() => setActiveTab('latest')}
            >
              <Text style={[styles.tabText, activeTab === 'latest' && styles.activeTabText]}>
                Latest
              </Text>
            </TouchableOpacity>
          </View>

          {/* Related Posts */}
          {fetchError && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{fetchError}</Text>
            </View>
          )}
          {relatedPosts.length === 0 ? (
            <View style={styles.emptyPostsContainer}>
              <Text style={styles.emptyPostsText}>No related posts found for this news story.</Text>
              <Text style={styles.emptyPostsSubtext}>Be the first to post about it!</Text>
            </View>
          ) : (
            relatedPosts.map((chirp) => (
              <View key={chirp.id}>
                <View style={styles.postHeader}>
                  <Text style={styles.postHeaderText}>
                    {activeTab === 'top' ? 'Top post' : 'Latest post'} about this story
                  </Text>
                </View>
                <ChirpCard chirp={chirp} />
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.light.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.light.border,
    backgroundColor: colors.light.backgroundElevated,
  },
  backButton: {
    paddingVertical: 4,
  },
  backButtonText: {
    fontSize: 16,
    color: colors.light.accent,
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.light.textPrimary,
    marginBottom: 8,
    lineHeight: 32,
  },
  timestamp: {
    fontSize: 13,
    color: colors.light.textMuted,
    marginBottom: 16,
  },
  description: {
    fontSize: 15,
    color: colors.light.textSecondary,
    lineHeight: 22,
    marginBottom: 16,
  },
  disclaimer: {
    padding: 12,
    backgroundColor: colors.light.backgroundElevated,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.light.border,
    marginBottom: 24,
  },
  disclaimerText: {
    fontSize: 12,
    color: colors.light.textMuted,
    lineHeight: 18,
  },
  tabs: {
    flexDirection: 'row',
    marginBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.light.border,
  },
  tab: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    marginRight: 8,
  },
  activeTab: {
    borderBottomColor: colors.light.accent,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.light.textMuted,
  },
  activeTabText: {
    color: colors.light.accent,
    fontWeight: '600',
  },
  errorBanner: {
    padding: 12,
    backgroundColor: '#fef3c7',
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 13,
    color: '#92400e',
  },
  emptyPostsContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyPostsText: {
    fontSize: 15,
    color: colors.light.textMuted,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyPostsSubtext: {
    fontSize: 13,
    color: colors.light.textMuted,
    textAlign: 'center',
  },
  postHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.light.backgroundElevated,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.light.border,
  },
  postHeaderText: {
    fontSize: 12,
    color: colors.light.textMuted,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: colors.light.textMuted,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 15,
    color: colors.light.textMuted,
  },
});

export default NewsDetailScreen;

