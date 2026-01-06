import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import type { HomeStackParamList } from '../../navigation/AppNavigator';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSearchStore } from '../../stores/useSearchStore';
import { useFeedStore } from '../../stores/useFeedStore';
import { useUserStore } from '../../stores/useUserStore';
import { useTopicStore } from '../../stores/useTopicStore';
import { useMostValuedStore } from '../../stores/useMostValuedStore';
import { useNewsStore } from '../../stores/useNewsStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { getSearchAgent } from '../../services/searchAgent';
import { userService } from '../../services/userService';
import { topicService } from '../../services/topicService';
import ChirpCard from '../../components/ChirpCard';
import UserSearchResult from '../../components/UserSearchResult';
import { colors } from '../../theme/colors';
import { shouldDisplayChirp } from '../../utils/chirpVisibility';
import { filterChirpsForViewer } from '../../utils/chirpVisibility';
import type { TopicMetadata, User, TrendingNews } from '../../types';

type NavigationProp = NativeStackNavigationProp<HomeStackParamList>;

const SearchScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const { query, setQuery, results, userResults, topicResults, activeTab, setActiveTab, setResults, setUserResults, setTopicResults, setIsSearching, isSearching } = useSearchStore();
  const { chirps } = useFeedStore();
  const getUser = useUserStore((state) => state.getUser);
  const currentUser = useUserStore((state) => state.currentUser);
  const { user: authUser } = useAuthStore();
  const { selectTopic, trendingTopics, loadTrendingTopics, isLoadingTrending } = useTopicStore();
  const { topValuedPosts, isLoadingTop, loadTopValuedPosts } = useMostValuedStore();
  const { trendingNews, isLoading: newsLoading, loadTrendingNews, selectNews } = useNewsStore();
  const [suggestedUsers, setSuggestedUsers] = useState<User[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [filterByInterests, setFilterByInterests] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const getUserRef = useRef(getUser);
  useEffect(() => {
    getUserRef.current = getUser;
  }, [getUser]);

  const hasSearchQuery = query.trim().length >= 2;

  // Load explore content when no search query
  useEffect(() => {
    if (hasSearchQuery) return;

    const loadExploreContent = async () => {
      // Load trending topics
      loadTrendingTopics(10);

      // Load most valued posts
      const interests = filterByInterests && currentUser?.interests ? currentUser.interests : undefined;
      loadTopValuedPosts({
        timeframe: 'week',
        interests,
        minValueThreshold: 0.5,
        forceRefresh: false,
      }).catch((err) => {
        console.error('[SearchScreen] Error loading most valued:', err);
      });

      // Load trending news
      const userId = currentUser?.id ?? null;
      loadTrendingNews(userId, false).catch((err) => {
        console.error('[SearchScreen] Error loading news:', err);
      });

      // Load user suggestions
      if (currentUser?.interests && currentUser.interests.length > 0) {
        setIsLoadingSuggestions(true);
        try {
          const similarUsers = await userService.getUsersWithSimilarInterests(
            currentUser.interests,
            currentUser.id,
            5
          );
          setSuggestedUsers(similarUsers.slice(0, 3));
        } catch (err) {
          console.error('[SearchScreen] Error loading user suggestions:', err);
        } finally {
          setIsLoadingSuggestions(false);
        }
      } else {
        setSuggestedUsers([]);
      }
    };

    loadExploreContent();
  }, [hasSearchQuery, currentUser?.id, currentUser?.interests, filterByInterests, loadTrendingTopics, loadTopValuedPosts, loadTrendingNews]);

  // Search kural
  useEffect(() => {
    if (!hasSearchQuery || activeTab !== 'kural') {
      if (!hasSearchQuery) {
        setResults([]);
        setIsSearching(false);
      }
      return;
    }
    
    const performSearch = async () => {
      setIsSearching(true);
      setError(null);

      try {
        const searchAgent = getSearchAgent();
        
        if (chirps.length === 0) {
          setResults([]);
          setError('No posts available to search. Please wait for content to load.');
          setIsSearching(false);
          return;
        }
        
        if (searchAgent) {
          const response = await searchAgent.rankResults(
            query,
            chirps,
            getUserRef.current,
            20
          );

          if (response.success && response.data && response.data.length > 0) {
            const filtered = response.data.filter((result) => shouldDisplayChirp(result.chirp, currentUser?.id));
            setResults(filtered);
          } else if (response.fallback && response.fallback.length > 0) {
            const filtered = response.fallback.filter((result) => shouldDisplayChirp(result.chirp, currentUser?.id));
            setResults(filtered);
          } else {
            const keywordResults = performKeywordSearch(query, chirps);
            setResults(keywordResults);
          }
        } else {
          const keywordResults = performKeywordSearch(query, chirps);
          setResults(keywordResults);
        }
      } catch (err: any) {
        console.error('[SearchScreen] Search error:', err);
        try {
          const keywordResults = performKeywordSearch(query, chirps);
          if (keywordResults.length > 0) {
            setResults(keywordResults);
            setError(null);
          } else {
            setError(err.message || 'Failed to perform search');
            setResults([]);
          }
        } catch (fallbackErr: any) {
          console.error('[SearchScreen] Fallback search also failed:', fallbackErr);
          setError(err.message || 'Failed to perform search');
          setResults([]);
        }
      } finally {
        setIsSearching(false);
      }
    };

    const performKeywordSearch = (searchQuery: string, chirpsToSearch: typeof chirps) => {
      if (!chirpsToSearch || !Array.isArray(chirpsToSearch)) {
        return [];
      }
      
      const keywords = searchQuery.toLowerCase().split(/\s+/).filter(w => w.length > 2);
      if (keywords.length === 0) {
        return [];
      }
      
      const filtered = chirpsToSearch
        .filter(chirp => {
          const text = chirp.text.toLowerCase();
          const topic = chirp.topic.toLowerCase();
          return keywords.some(keyword => text.includes(keyword) || topic.includes(keyword));
        })
        .slice(0, 20)
        .map(chirp => ({
          chirp,
          relevanceScore: 0.5,
          explanation: 'Matches search keywords',
        }));
      
      return filtered.filter((result) => shouldDisplayChirp(result.chirp, currentUser?.id));
    };

    const timeoutId = setTimeout(performSearch, 500);
    return () => clearTimeout(timeoutId);
  }, [query, chirps, activeTab, currentUser?.id, hasSearchQuery, setResults, setIsSearching]);

  // Search users
  useEffect(() => {
    if (!hasSearchQuery || activeTab !== 'users') {
      if (!hasSearchQuery) {
        setUserResults([]);
        setIsSearching(false);
      }
      return;
    }
    
    const performUserSearch = async () => {
      setIsSearching(true);
      setError(null);

      try {
        const users = await userService.searchUsers(query, 20);
        setUserResults(users);
      } catch (err: any) {
        console.error('[SearchScreen] User search error:', err);
        setError(err.message || 'Failed to search users');
        setUserResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    const timeoutId = setTimeout(performUserSearch, 500);
    return () => clearTimeout(timeoutId);
  }, [query, activeTab, hasSearchQuery, setUserResults, setIsSearching]);

  // Search topics
  useEffect(() => {
    if (!hasSearchQuery || activeTab !== 'topics') {
      if (!hasSearchQuery) {
        setTopicResults([]);
        setIsSearching(false);
      }
      return;
    }
    
    const performTopicSearch = async () => {
      setIsSearching(true);
      setError(null);

      try {
        const allTopics = await topicService.getTopEngagedTopics(100);
        const searchTerm = query.toLowerCase().trim();
        const matched = allTopics.filter(topic => 
          topic.name.toLowerCase().includes(searchTerm)
        ).slice(0, 20);
        setTopicResults(matched);
      } catch (err: any) {
        console.error('[SearchScreen] Topic search error:', err);
        setError(err.message || 'Failed to search topics');
        setTopicResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    const timeoutId = setTimeout(performTopicSearch, 500);
    return () => clearTimeout(timeoutId);
  }, [query, activeTab, hasSearchQuery, setTopicResults, setIsSearching]);

  // Filter most valued posts for visibility
  const visibleMostValued = useMemo(() => {
    if (!currentUser) return topValuedPosts;
    return filterChirpsForViewer(topValuedPosts, currentUser.id);
  }, [topValuedPosts, currentUser]);

  // Get personalized trending topics
  const displayTrendingTopics = useMemo(() => {
    if (trendingTopics.length === 0) return [];

    if (!currentUser || !currentUser.interests || currentUser.interests.length === 0) {
      return trendingTopics.slice(0, 5);
    }

    const userInterests = currentUser.interests.map((i) => i.toLowerCase());
    
    const topicsWithMatch = trendingTopics.map((topic) => {
      const topicName = topic.name.toLowerCase();
      const matchesInterest = userInterests.some((interest) => {
        return topicName.includes(interest) || interest.includes(topicName);
      });
      return { topic, matchesInterest };
    });

    topicsWithMatch.sort((a, b) => {
      if (a.matchesInterest !== b.matchesInterest) {
        return a.matchesInterest ? -1 : 1;
      }
      return b.topic.postsLast1h - a.topic.postsLast1h;
    });

    return topicsWithMatch.slice(0, 5).map((item) => item.topic);
  }, [trendingTopics, currentUser]);

  const formatVolume = (count: number): string => {
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K kurals`;
    }
    return `${count} kurals`;
  };

  const formatTimeAgo = (date: Date | null | undefined): string => {
    if (!date) return 'Unknown';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    if (diffMs < 0) return 'Just now';
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return '1 day ago';
    return `${diffDays} days ago`;
  };

  const formatEngagement = (count: number): string => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M posts`;
    }
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K posts`;
    }
    return `${count} posts`;
  };

  const getCategoryColor = (category: string): string => {
    const colors: Record<string, string> = {
      technology: colors.light.accent,
      business: colors.light.success,
      entertainment: '#8B5CF6',
      sports: '#F59E0B',
      health: colors.light.error,
      science: '#06B6D4',
      general: colors.light.textMuted,
    };
    return colors[category.toLowerCase()] || colors.general;
  };

  const renderValueBadge = (value?: number) => {
    if (value === undefined || value === null) return null;
    const score = Math.round(value * 100);
    const color = score >= 90 ? colors.light.success : score >= 70 ? '#3B82F6' : colors.light.textMuted;
    return (
      <View style={[styles.valueBadge, { backgroundColor: color + '20' }]}>
        <Text style={[styles.valueBadgeText, { color }]}>{score} value</Text>
      </View>
    );
  };

  const renderMostValuedItem = (chirp: typeof topValuedPosts[0]) => {
    const author = getUser(chirp.authorId);
    const authorName = author?.name || 'Unknown';
    const authorHandle = author?.handle ? `@${author.handle}` : '';
    const preview = chirp.text?.slice(0, 120) || '';
    const timeAgo = formatTimeAgo(chirp.createdAt);

    return (
      <TouchableOpacity
        key={chirp.id}
        style={styles.mostValuedItem}
        onPress={() => navigation.navigate('PostDetail', { postId: chirp.id })}
        activeOpacity={0.7}
      >
        <View style={styles.mostValuedHeader}>
          <View style={styles.mostValuedAuthor}>
            <Text style={styles.mostValuedAuthorName}>{authorName}</Text>
            {authorHandle && <Text style={styles.mostValuedAuthorHandle}>{authorHandle}</Text>}
          </View>
          <View style={styles.mostValuedMeta}>
            {renderValueBadge(chirp.valueScore?.total)}
            <Text style={styles.mostValuedTime}>{timeAgo}</Text>
          </View>
        </View>
        {chirp.topic && (
          <Text style={styles.mostValuedTopic}>#{chirp.topic}</Text>
        )}
        <Text style={styles.mostValuedText} numberOfLines={2}>{preview}</Text>
      </TouchableOpacity>
    );
  };

  const renderTrendingNewsItem = (news: TrendingNews, index: number) => {
    const isRecent = news.publishedAt && (Date.now() - news.publishedAt.getTime() < 2 * 60 * 60 * 1000);
    const categoryColor = getCategoryColor(news.category);

    return (
      <TouchableOpacity
        key={news.id}
        style={styles.newsItem}
        onPress={() => {
          selectNews(news.id);
          navigation.navigate('NewsDetail', { newsId: news.id });
        }}
        activeOpacity={0.7}
      >
        <View style={styles.newsHeader}>
          <View style={styles.newsRank}>
            <Text style={styles.newsRankText}>#{index + 1}</Text>
            {isRecent && (
              <View style={styles.trendingBadge}>
                <Text style={styles.trendingBadgeText}>Trending</Text>
              </View>
            )}
            {!isRecent && (
              <Text style={styles.newsTime}>{formatTimeAgo(news.publishedAt)}</Text>
            )}
          </View>
          <View style={[styles.categoryBadge, { backgroundColor: categoryColor + '20' }]}>
            <Text style={[styles.categoryText, { color: categoryColor }]}>{news.category}</Text>
          </View>
        </View>
        <Text style={styles.newsTitle} numberOfLines={2}>{news.title}</Text>
        <Text style={styles.newsEngagement}>{formatEngagement(news.engagementCount)}</Text>
      </TouchableOpacity>
    );
  };

  const renderUserSuggestion = (person: User) => {
    const following = useUserStore.getState().isFollowing(person.id);
    const similarityMetadata = (person as any)._similarityMetadata;
    const matchingInterests = similarityMetadata?.matchingInterests || [];
    const overlapCount = similarityMetadata?.overlapCount || 0;
    
    const personInitials = person.name
      .split(' ')
      .map((part) => part[0]?.toUpperCase())
      .join('')
      .slice(0, 2);

    return (
      <View key={person.id} style={styles.userSuggestion}>
        <TouchableOpacity
          style={styles.userSuggestionContent}
          onPress={() => navigation.navigate('Profile', { userId: person.id })}
          activeOpacity={0.7}
        >
          <View style={styles.userSuggestionAvatar}>
            {person.profilePictureUrl ? (
              <Image source={{ uri: person.profilePictureUrl }} style={styles.userAvatarImage} />
            ) : (
              <View style={styles.userAvatarPlaceholder}>
                <Text style={styles.userAvatarText}>{personInitials}</Text>
              </View>
            )}
          </View>
          <View style={styles.userSuggestionInfo}>
            <Text style={styles.userSuggestionName}>{person.name}</Text>
            <Text style={styles.userSuggestionHandle}>@{person.handle}</Text>
            {matchingInterests.length > 0 && (
              <View style={styles.matchingInterests}>
                {matchingInterests.slice(0, 2).map((interest: string, idx: number) => (
                  <View key={idx} style={styles.interestTag}>
                    <Text style={styles.interestTagText}>{interest}</Text>
                  </View>
                ))}
                {matchingInterests.length > 2 && (
                  <Text style={styles.moreInterests}>+{matchingInterests.length - 2} more</Text>
                )}
              </View>
            )}
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.followButton, following && styles.followButtonActive]}
          onPress={() => {
            if (following) {
              useUserStore.getState().unfollowUser(person.id);
            } else {
              useUserStore.getState().followUser(person.id);
            }
          }}
          activeOpacity={0.7}
        >
          <Text style={[styles.followButtonText, following && styles.followButtonTextActive]}>
            {following ? 'Following' : 'Follow'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderChirpResult = ({ item }: { item: typeof results[0] }) => (
    <View>
      <View style={styles.resultHeader}>
        <Text style={styles.resultHeaderText}>
          {item.explanation} ({(item.relevanceScore * 100).toFixed(0)}%)
        </Text>
      </View>
      <ChirpCard chirp={item.chirp} />
    </View>
  );

  const renderUserResult = ({ item }: { item: typeof userResults[0] }) => (
    <UserSearchResult user={item} />
  );

  const renderTopicResult = ({ item }: { item: TopicMetadata }) => (
    <TouchableOpacity
      style={styles.topicResult}
      onPress={() => {
        selectTopic(item.name);
        navigation.navigate('TopicDetail', { topicName: item.name });
      }}
      activeOpacity={0.7}
    >
      <Text style={styles.topicName}>#{item.name}</Text>
      <Text style={styles.topicStats}>
        {item.postsLast48h} posts • {item.totalUsers} users
      </Text>
    </TouchableOpacity>
  );

  const renderExploreContent = () => (
    <ScrollView style={styles.exploreContent} showsVerticalScrollIndicator={false}>
      {/* Most Valued Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Most Valued</Text>
            <Text style={styles.sectionSubtitle}>Top value-ranked posts</Text>
          </View>
          {currentUser?.interests && currentUser.interests.length > 0 && (
            <TouchableOpacity
              style={styles.filterToggle}
              onPress={() => setFilterByInterests(!filterByInterests)}
              activeOpacity={0.7}
            >
              <Text style={[styles.filterToggleText, filterByInterests && styles.filterToggleTextActive]}>
                My interests
              </Text>
            </TouchableOpacity>
          )}
        </View>
        {isLoadingTop ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={colors.light.accent} />
          </View>
        ) : visibleMostValued.length === 0 ? (
          <Text style={styles.emptySectionText}>No high-value posts yet.</Text>
        ) : (
          <View style={styles.mostValuedList}>
            {visibleMostValued.slice(0, 5).map((chirp) => renderMostValuedItem(chirp))}
          </View>
        )}
      </View>

      {/* Trending Topics Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Trending Topics</Text>
        {isLoadingTrending ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={colors.light.accent} />
          </View>
        ) : displayTrendingTopics.length === 0 ? (
          <Text style={styles.emptySectionText}>No trending topics yet</Text>
        ) : (
          <View style={styles.trendingTopicsList}>
            {displayTrendingTopics.map((topic) => {
              const matchesInterest = currentUser?.interests?.some(interest =>
                topic.name.toLowerCase().includes(interest.toLowerCase()) ||
                interest.toLowerCase().includes(topic.name.toLowerCase())
              );
              return (
                <TouchableOpacity
                  key={topic.name}
                  style={[styles.topicChip, matchesInterest && styles.topicChipActive]}
                  onPress={() => {
                    selectTopic(topic.name);
                    navigation.navigate('TopicDetail', { topicName: topic.name });
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.topicChipText, matchesInterest && styles.topicChipTextActive]}>
                    {topic.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

      {/* Trending News Section */}
      {trendingNews.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Today's News</Text>
          <View style={styles.newsList}>
            {trendingNews.slice(0, 3).map((news, index) => renderTrendingNewsItem(news, index))}
          </View>
        </View>
      )}

      {/* People to Follow Section */}
      {suggestedUsers.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {currentUser?.interests && currentUser.interests.length > 0
              ? 'People with similar interests'
              : 'People to follow'}
          </Text>
          {isLoadingSuggestions ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={colors.light.accent} />
            </View>
          ) : (
            <View style={styles.userSuggestionsList}>
              {suggestedUsers.map((person) => renderUserSuggestion(person))}
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );

  const renderEmpty = () => {
    if (isSearching) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={colors.light.accent} />
          <Text style={styles.emptyText}>Searching...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No results found for "{query}"</Text>
      </View>
    );
  };

  const getData = () => {
    if (activeTab === 'kural') return results;
    if (activeTab === 'users') return userResults;
    return topicResults;
  };

  const renderItem = ({ item }: any) => {
    if (activeTab === 'kural') return renderChirpResult({ item });
    if (activeTab === 'users') return renderUserResult({ item });
    return renderTopicResult({ item });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={colors.light.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.input}
            placeholder="Search people, topics, or kural"
            placeholderTextColor={colors.light.textMuted}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} style={styles.clearButton}>
              <Ionicons name="close-circle" size={20} color={colors.light.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {hasSearchQuery && (
          <View style={styles.tabs}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'kural' && styles.activeTab]}
              onPress={() => setActiveTab('kural')}
            >
              <Text style={[styles.tabText, activeTab === 'kural' && styles.activeTabText]}>
                Kural
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'users' && styles.activeTab]}
              onPress={() => setActiveTab('users')}
            >
              <Text style={[styles.tabText, activeTab === 'users' && styles.activeTabText]}>
                Users
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'topics' && styles.activeTab]}
              onPress={() => setActiveTab('topics')}
            >
              <Text style={[styles.tabText, activeTab === 'topics' && styles.activeTabText]}>
                Topics
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {hasSearchQuery ? (
        <FlatList
          data={getData()}
          renderItem={renderItem}
          keyExtractor={(item, index) => {
            if (activeTab === 'kural') return item.chirp.id;
            if (activeTab === 'users') return item.id;
            return item.name;
          }}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={styles.listContent}
          style={styles.list}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />
      ) : (
        renderExploreContent()
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.light.background,
  },
  header: {
    backgroundColor: colors.light.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.light.border,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  searchIcon: {
    position: 'absolute',
    left: 28,
    zIndex: 1,
  },
  input: {
    flex: 1,
    backgroundColor: colors.light.backgroundElevated,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.light.border,
    paddingHorizontal: 40,
    paddingVertical: 12,
    color: colors.light.textPrimary,
    fontSize: 15,
  },
  clearButton: {
    position: 'absolute',
    right: 28,
    zIndex: 1,
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.light.border,
    backgroundColor: colors.light.background,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
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
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 24,
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    minHeight: 300,
  },
  emptyText: {
    fontSize: 15,
    color: colors.light.textMuted,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 15,
    color: colors.light.error,
    textAlign: 'center',
  },
  resultHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.light.backgroundElevated,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.light.border,
  },
  resultHeaderText: {
    fontSize: 12,
    color: colors.light.textMuted,
  },
  topicResult: {
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.light.border,
    backgroundColor: colors.light.background,
  },
  topicName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.light.textPrimary,
    marginBottom: 4,
  },
  topicStats: {
    fontSize: 13,
    color: colors.light.textMuted,
  },
  exploreContent: {
    flex: 1,
  },
  section: {
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.light.border,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.light.textPrimary,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: colors.light.textMuted,
  },
  filterToggle: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.light.backgroundElevated,
  },
  filterToggleText: {
    fontSize: 11,
    color: colors.light.textMuted,
    fontWeight: '500',
  },
  filterToggleTextActive: {
    color: colors.light.accent,
    fontWeight: '600',
  },
  loadingContainer: {
    padding: 16,
    alignItems: 'center',
  },
  emptySectionText: {
    fontSize: 14,
    color: colors.light.textMuted,
    textAlign: 'center',
    padding: 16,
  },
  mostValuedList: {
    gap: 8,
  },
  mostValuedItem: {
    padding: 12,
    backgroundColor: colors.light.backgroundElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  mostValuedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  mostValuedAuthor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  mostValuedAuthorName: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.light.textPrimary,
  },
  mostValuedAuthorHandle: {
    fontSize: 12,
    color: colors.light.textMuted,
  },
  mostValuedMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mostValuedTime: {
    fontSize: 11,
    color: colors.light.textMuted,
  },
  mostValuedTopic: {
    fontSize: 11,
    color: colors.light.textMuted,
    marginBottom: 6,
  },
  mostValuedText: {
    fontSize: 14,
    color: colors.light.textPrimary,
    lineHeight: 20,
  },
  valueBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  valueBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  trendingTopicsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  topicChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: colors.light.backgroundElevated,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  topicChipActive: {
    backgroundColor: colors.light.accent + '20',
    borderColor: colors.light.accent + '40',
  },
  topicChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.light.textPrimary,
  },
  topicChipTextActive: {
    color: colors.light.accent,
    fontWeight: '600',
  },
  newsList: {
    gap: 12,
  },
  newsItem: {
    padding: 12,
    backgroundColor: colors.light.backgroundElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  newsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  newsRank: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  newsRankText: {
    fontSize: 12,
    color: colors.light.textMuted,
  },
  trendingBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: colors.light.accent + '20',
  },
  trendingBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.light.accent,
  },
  newsTime: {
    fontSize: 11,
    color: colors.light.textMuted,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  categoryText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  newsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.light.textPrimary,
    marginBottom: 6,
    lineHeight: 20,
  },
  newsEngagement: {
    fontSize: 11,
    color: colors.light.textMuted,
  },
  userSuggestionsList: {
    gap: 12,
  },
  userSuggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: colors.light.backgroundElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  userSuggestionContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  userSuggestionAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: colors.light.accent + '20',
  },
  userAvatarImage: {
    width: '100%',
    height: '100%',
  },
  userAvatarPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userAvatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.light.accent,
  },
  userSuggestionInfo: {
    flex: 1,
  },
  userSuggestionName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.light.textPrimary,
    marginBottom: 2,
  },
  userSuggestionHandle: {
    fontSize: 12,
    color: colors.light.textMuted,
    marginBottom: 6,
  },
  matchingInterests: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  interestTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: colors.light.accent + '20',
    borderWidth: 1,
    borderColor: colors.light.accent + '30',
  },
  interestTagText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.light.accent,
  },
  moreInterests: {
    fontSize: 10,
    color: colors.light.textMuted,
  },
  followButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: colors.light.accent,
  },
  followButtonActive: {
    backgroundColor: colors.light.backgroundElevated,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  followButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  followButtonTextActive: {
    color: colors.light.textMuted,
  },
});

export default SearchScreen;
