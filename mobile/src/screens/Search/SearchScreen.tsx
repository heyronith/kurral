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
import type { HomeStackParamList, SearchStackParamList } from '../../navigation/AppNavigator';
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
import { useTheme } from '../../hooks/useTheme';
import { shouldDisplayChirp } from '../../utils/chirpVisibility';
import { filterChirpsForViewer } from '../../utils/chirpVisibility';
import type { TopicMetadata, User, TrendingNews } from '../../types';

type NavigationProp = NativeStackNavigationProp<HomeStackParamList & SearchStackParamList>;

const SearchScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const { colors } = useTheme();
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

  const dynamicStyles = getStyles(colors);

  const getCategoryColor = (category: string): string => {
    const categoryColors: Record<string, string> = {
      technology: colors.accent,
      business: colors.success,
      entertainment: '#8B5CF6',
      sports: '#F59E0B',
      health: colors.error,
      science: '#06B6D4',
      general: colors.textMuted,
    };
    return categoryColors[category.toLowerCase()] || categoryColors.general;
  };

  const renderValueBadge = (value?: number) => {
    if (value === undefined || value === null) return null;
    const score = Math.round(value * 100);
    const color = score >= 90 ? colors.success : score >= 70 ? '#3B82F6' : colors.textMuted;
    return (
      <View style={[dynamicStyles.valueBadge, { backgroundColor: color + '20' }]}>
        <Text style={[dynamicStyles.valueBadgeText, { color }]}>{score} value</Text>
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
        style={dynamicStyles.mostValuedItem}
        onPress={() => navigation.navigate('PostDetail', { postId: chirp.id })}
        activeOpacity={0.7}
      >
        <View style={dynamicStyles.mostValuedHeader}>
          <View style={dynamicStyles.mostValuedAuthor}>
            <Text style={dynamicStyles.mostValuedAuthorName}>{authorName}</Text>
            {authorHandle && <Text style={dynamicStyles.mostValuedAuthorHandle}>{authorHandle}</Text>}
          </View>
          <View style={dynamicStyles.mostValuedMeta}>
            {renderValueBadge(chirp.valueScore?.total)}
            <Text style={dynamicStyles.mostValuedTime}>{timeAgo}</Text>
          </View>
        </View>
        {chirp.topic && (
          <Text style={dynamicStyles.mostValuedTopic}>#{chirp.topic}</Text>
        )}
        <Text style={dynamicStyles.mostValuedText} numberOfLines={2}>{preview}</Text>
      </TouchableOpacity>
    );
  };

  const renderTrendingNewsItem = (news: TrendingNews, index: number) => {
    const isRecent = news.publishedAt && (Date.now() - news.publishedAt.getTime() < 2 * 60 * 60 * 1000);
    const categoryColor = getCategoryColor(news.category);

    return (
      <TouchableOpacity
        key={news.id}
        style={dynamicStyles.newsItem}
        onPress={() => {
          selectNews(news.id);
          navigation.navigate('NewsDetail', { newsId: news.id });
        }}
        activeOpacity={0.7}
      >
        <View style={dynamicStyles.newsHeader}>
          <View style={dynamicStyles.newsRank}>
            <Text style={dynamicStyles.newsRankText}>#{index + 1}</Text>
            {isRecent && (
              <View style={dynamicStyles.trendingBadge}>
                <Text style={dynamicStyles.trendingBadgeText}>Trending</Text>
              </View>
            )}
            {!isRecent && (
              <Text style={dynamicStyles.newsTime}>{formatTimeAgo(news.publishedAt)}</Text>
            )}
          </View>
          <View style={[dynamicStyles.categoryBadge, { backgroundColor: categoryColor + '20' }]}>
            <Text style={[dynamicStyles.categoryText, { color: categoryColor }]}>{news.category}</Text>
          </View>
        </View>
        <Text style={dynamicStyles.newsTitle} numberOfLines={2}>{news.title}</Text>
        <Text style={dynamicStyles.newsEngagement}>{formatEngagement(news.engagementCount)}</Text>
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
      <View key={person.id} style={dynamicStyles.userSuggestion}>
        <TouchableOpacity
          style={dynamicStyles.userSuggestionContent}
          onPress={() => navigation.navigate('Profile', { userId: person.id })}
          activeOpacity={0.7}
        >
          <View style={dynamicStyles.userSuggestionAvatar}>
            {person.profilePictureUrl ? (
              <Image source={{ uri: person.profilePictureUrl }} style={dynamicStyles.userAvatarImage} />
            ) : (
              <View style={dynamicStyles.userAvatarPlaceholder}>
                <Text style={dynamicStyles.userAvatarText}>{personInitials}</Text>
              </View>
            )}
          </View>
          <View style={dynamicStyles.userSuggestionInfo}>
            <Text style={dynamicStyles.userSuggestionName}>{person.name}</Text>
            <Text style={dynamicStyles.userSuggestionHandle}>@{person.handle}</Text>
            {matchingInterests.length > 0 && (
              <View style={dynamicStyles.matchingInterests}>
                {matchingInterests.slice(0, 2).map((interest: string, idx: number) => (
                  <View key={idx} style={dynamicStyles.interestTag}>
                    <Text style={dynamicStyles.interestTagText}>{interest}</Text>
                  </View>
                ))}
                {matchingInterests.length > 2 && (
                  <Text style={dynamicStyles.moreInterests}>+{matchingInterests.length - 2} more</Text>
                )}
              </View>
            )}
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[dynamicStyles.followButton, following && dynamicStyles.followButtonActive]}
          onPress={() => {
            if (following) {
              useUserStore.getState().unfollowUser(person.id);
            } else {
              useUserStore.getState().followUser(person.id);
            }
          }}
          activeOpacity={0.7}
        >
          <Text style={[dynamicStyles.followButtonText, following && dynamicStyles.followButtonTextActive]}>
            {following ? 'Following' : 'Follow'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderChirpResult = ({ item }: { item: typeof results[0] }) => (
    <View>
      <View style={dynamicStyles.resultHeader}>
        <Text style={dynamicStyles.resultHeaderText}>
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
      style={dynamicStyles.topicResult}
      onPress={() => {
        selectTopic(item.name);
        navigation.navigate('TopicDetail', { topicName: item.name });
      }}
      activeOpacity={0.7}
    >
      <Text style={dynamicStyles.topicName}>#{item.name}</Text>
      <Text style={dynamicStyles.topicStats}>
        {item.postsLast48h} posts • {item.totalUsers} users
      </Text>
    </TouchableOpacity>
  );

  const renderExploreContent = () => (
    <ScrollView style={dynamicStyles.exploreContent} showsVerticalScrollIndicator={false}>
      {/* Most Valued Section */}
      <View style={dynamicStyles.section}>
        <View style={dynamicStyles.sectionHeader}>
          <View>
            <Text style={dynamicStyles.sectionTitle}>Most Valued</Text>
            <Text style={dynamicStyles.sectionSubtitle}>Top value-ranked posts</Text>
          </View>
          {currentUser?.interests && currentUser.interests.length > 0 && (
            <TouchableOpacity
              style={dynamicStyles.filterToggle}
              onPress={() => setFilterByInterests(!filterByInterests)}
              activeOpacity={0.7}
            >
              <Text style={[dynamicStyles.filterToggleText, filterByInterests && dynamicStyles.filterToggleTextActive]}>
                My interests
              </Text>
            </TouchableOpacity>
          )}
        </View>
        {isLoadingTop ? (
          <View style={dynamicStyles.loadingContainer}>
            <ActivityIndicator size="small" color={colors.accent} />
          </View>
        ) : visibleMostValued.length === 0 ? (
          <Text style={dynamicStyles.emptySectionText}>No high-value posts yet.</Text>
        ) : (
          <View style={dynamicStyles.mostValuedList}>
            {visibleMostValued.slice(0, 5).map((chirp) => renderMostValuedItem(chirp))}
          </View>
        )}
      </View>

      {/* Trending Topics Section */}
      <View style={dynamicStyles.section}>
        <Text style={dynamicStyles.sectionTitle}>Trending Topics</Text>
        {isLoadingTrending ? (
          <View style={dynamicStyles.loadingContainer}>
            <ActivityIndicator size="small" color={colors.accent} />
          </View>
        ) : displayTrendingTopics.length === 0 ? (
          <Text style={dynamicStyles.emptySectionText}>No trending topics yet</Text>
        ) : (
          <View style={dynamicStyles.trendingTopicsList}>
            {displayTrendingTopics.map((topic) => {
              const matchesInterest = currentUser?.interests?.some(interest =>
                topic.name.toLowerCase().includes(interest.toLowerCase()) ||
                interest.toLowerCase().includes(topic.name.toLowerCase())
              );
              return (
                <TouchableOpacity
                  key={topic.name}
                  style={[dynamicStyles.topicChip, matchesInterest && dynamicStyles.topicChipActive]}
                  onPress={() => {
                    selectTopic(topic.name);
                    navigation.navigate('TopicDetail', { topicName: topic.name });
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[dynamicStyles.topicChipText, matchesInterest && dynamicStyles.topicChipTextActive]}>
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
        <View style={dynamicStyles.section}>
          <Text style={dynamicStyles.sectionTitle}>Today's News</Text>
          <View style={dynamicStyles.newsList}>
            {trendingNews.slice(0, 3).map((news, index) => renderTrendingNewsItem(news, index))}
          </View>
        </View>
      )}

      {/* People to Follow Section */}
      {suggestedUsers.length > 0 && (
        <View style={dynamicStyles.section}>
          <Text style={dynamicStyles.sectionTitle}>
            {currentUser?.interests && currentUser.interests.length > 0
              ? 'People with similar interests'
              : 'People to follow'}
          </Text>
          {isLoadingSuggestions ? (
            <View style={dynamicStyles.loadingContainer}>
              <ActivityIndicator size="small" color={colors.accent} />
            </View>
          ) : (
            <View style={dynamicStyles.userSuggestionsList}>
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
        <View style={dynamicStyles.emptyContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={dynamicStyles.emptyText}>Searching...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={dynamicStyles.emptyContainer}>
          <Text style={dynamicStyles.errorText}>{error}</Text>
        </View>
      );
    }

    return (
      <View style={dynamicStyles.emptyContainer}>
        <Text style={dynamicStyles.emptyText}>No results found for "{query}"</Text>
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
    <SafeAreaView style={dynamicStyles.container} edges={['top']}>
      <View style={dynamicStyles.header}>
        <View style={dynamicStyles.searchContainer}>
          <Ionicons name="search" size={20} color={colors.textMuted} style={dynamicStyles.searchIcon} />
          <TextInput
            style={dynamicStyles.input}
            placeholder="Search people, topics, or kural"
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} style={dynamicStyles.clearButton}>
              <Ionicons name="close-circle" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {hasSearchQuery && (
          <View style={dynamicStyles.tabs}>
            <TouchableOpacity
              style={[dynamicStyles.tab, activeTab === 'kural' && dynamicStyles.activeTab]}
              onPress={() => setActiveTab('kural')}
            >
              <Text style={[dynamicStyles.tabText, activeTab === 'kural' && dynamicStyles.activeTabText]}>
                Kural
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[dynamicStyles.tab, activeTab === 'users' && dynamicStyles.activeTab]}
              onPress={() => setActiveTab('users')}
            >
              <Text style={[dynamicStyles.tabText, activeTab === 'users' && dynamicStyles.activeTabText]}>
                Users
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[dynamicStyles.tab, activeTab === 'topics' && dynamicStyles.activeTab]}
              onPress={() => setActiveTab('topics')}
            >
              <Text style={[dynamicStyles.tabText, activeTab === 'topics' && dynamicStyles.activeTabText]}>
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
          contentContainerStyle={dynamicStyles.listContent}
          style={dynamicStyles.list}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />
      ) : (
        renderExploreContent()
      )}
    </SafeAreaView>
  );
};

const getStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
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
    backgroundColor: colors.backgroundElevated,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: 40,
    paddingVertical: 12,
    color: colors.textPrimary,
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
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: colors.accent,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.textMuted,
  },
  activeTabText: {
    color: colors.accent,
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
    color: colors.textMuted,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 15,
    color: colors.error,
    textAlign: 'center',
  },
  resultHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.backgroundElevated,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  resultHeaderText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  topicResult: {
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  topicName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  topicStats: {
    fontSize: 13,
    color: colors.textMuted,
  },
  exploreContent: {
    flex: 1,
  },
  section: {
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
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
    color: colors.textPrimary,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
  },
  filterToggle: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.backgroundElevated,
  },
  filterToggleText: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '500',
  },
  filterToggleTextActive: {
    color: colors.accent,
    fontWeight: '600',
  },
  loadingContainer: {
    padding: 16,
    alignItems: 'center',
  },
  emptySectionText: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    padding: 16,
  },
  mostValuedList: {
    gap: 8,
  },
  mostValuedItem: {
    padding: 12,
    backgroundColor: colors.backgroundElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
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
    color: colors.textPrimary,
  },
  mostValuedAuthorHandle: {
    fontSize: 12,
    color: colors.textMuted,
  },
  mostValuedMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mostValuedTime: {
    fontSize: 11,
    color: colors.textMuted,
  },
  mostValuedTopic: {
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 6,
  },
  mostValuedText: {
    fontSize: 14,
    color: colors.textPrimary,
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
    backgroundColor: colors.backgroundElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  topicChipActive: {
    backgroundColor: colors.accent + '20',
    borderColor: colors.accent + '40',
  },
  topicChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  topicChipTextActive: {
    color: colors.accent,
    fontWeight: '600',
  },
  newsList: {
    gap: 12,
  },
  newsItem: {
    padding: 12,
    backgroundColor: colors.backgroundElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
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
    color: colors.textMuted,
  },
  trendingBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: colors.accent + '20',
  },
  trendingBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.accent,
  },
  newsTime: {
    fontSize: 11,
    color: colors.textMuted,
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
    color: colors.textPrimary,
    marginBottom: 6,
    lineHeight: 20,
  },
  newsEngagement: {
    fontSize: 11,
    color: colors.textMuted,
  },
  userSuggestionsList: {
    gap: 12,
  },
  userSuggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: colors.backgroundElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
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
    backgroundColor: colors.accent + '20',
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
    color: colors.accent,
  },
  userSuggestionInfo: {
    flex: 1,
  },
  userSuggestionName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  userSuggestionHandle: {
    fontSize: 12,
    color: colors.textMuted,
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
    backgroundColor: colors.accent + '20',
    borderWidth: 1,
    borderColor: colors.accent + '30',
  },
  interestTagText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.accent,
  },
  moreInterests: {
    fontSize: 10,
    color: colors.textMuted,
  },
  followButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: colors.accent,
  },
  followButtonActive: {
    backgroundColor: colors.backgroundElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  followButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  followButtonTextActive: {
    color: colors.textMuted,
  },
});

export default SearchScreen;
