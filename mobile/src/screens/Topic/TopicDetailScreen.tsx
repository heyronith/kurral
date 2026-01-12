import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { HomeStackParamList } from '../../navigation/AppNavigator';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTopicStore } from '../../stores/useTopicStore';
import { useUserStore } from '../../stores/useUserStore';
import { getPostsByTopic } from '../../services/postAggregationService';
import ChirpCard from '../../components/ChirpCard';
import { useTheme } from '../../hooks/useTheme';
import { filterChirpsForViewer } from '../../utils/chirpVisibility';
import type { Chirp } from '../../types';

type NavigationProp = NativeStackNavigationProp<HomeStackParamList>;
type RouteProp = {
  key: string;
  name: 'TopicDetail';
  params: { topicName: string };
};

const TopicDetailScreen = () => {
  const { colors } = useTheme();
  const route = useRoute<RouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const { topicName } = route.params;
  const { clearTopicSelection } = useTopicStore();
  const currentUser = useUserStore((state) => state.currentUser);
  const [topicPosts, setTopicPosts] = useState<Chirp[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const dynamicStyles = getStyles(colors);

  useEffect(() => {
    if (!topicName) {
      setTopicPosts([]);
      setIsLoading(false);
      return;
    }

    const fetchTopicPosts = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Get posts from last 7 days (wider window for topic view)
        const posts = await getPostsByTopic(topicName, 168, 200); // 168 hours = 7 days
        
        // Sort chronologically (oldest first)
        posts.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        
        const visiblePosts = filterChirpsForViewer(posts, currentUser?.id);
        console.log(`[TopicDetailScreen] Loaded ${visiblePosts.length} posts for topic "${topicName}"`);
        setTopicPosts(visiblePosts);
      } catch (err: any) {
        console.error('[TopicDetailScreen] Error fetching topic posts:', err);
        setError(err.message || 'Failed to load topic posts');
        setTopicPosts([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTopicPosts();
  }, [topicName, currentUser?.id]);

  const handleBack = () => {
    clearTopicSelection();
    navigation.goBack();
  };

  if (isLoading) {
    return (
      <SafeAreaView style={dynamicStyles.container} edges={['top']}>
        <View style={dynamicStyles.header}>
          <TouchableOpacity onPress={handleBack} style={dynamicStyles.backButton}>
            <Text style={dynamicStyles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={dynamicStyles.headerTitle}>#{topicName}</Text>
        </View>
        <View style={dynamicStyles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={dynamicStyles.loadingText}>Loading posts...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={dynamicStyles.container} edges={['top']}>
        <View style={dynamicStyles.header}>
          <TouchableOpacity onPress={handleBack} style={dynamicStyles.backButton}>
            <Text style={dynamicStyles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={dynamicStyles.headerTitle}>#{topicName}</Text>
        </View>
        <View style={dynamicStyles.errorContainer}>
          <Text style={dynamicStyles.errorText}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={dynamicStyles.container} edges={['top']}>
      <View style={dynamicStyles.header}>
        <TouchableOpacity onPress={handleBack} style={dynamicStyles.backButton}>
          <Text style={dynamicStyles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <View style={dynamicStyles.headerContent}>
          <Text style={dynamicStyles.headerTitle}>#{topicName}</Text>
          <Text style={dynamicStyles.headerSubtitle}>
            {topicPosts.length} post{topicPosts.length !== 1 ? 's' : ''} about this topic
          </Text>
        </View>
      </View>

      {topicPosts.length === 0 ? (
        <View style={dynamicStyles.emptyContainer}>
          <Text style={dynamicStyles.emptyText}>No posts found for this topic yet.</Text>
          <Text style={dynamicStyles.emptySubtext}>Be the first to post about #{topicName}!</Text>
        </View>
      ) : (
        <FlatList
          data={topicPosts}
          renderItem={({ item }) => <ChirpCard chirp={item} />}
          keyExtractor={(item) => item.id}
          contentContainerStyle={dynamicStyles.listContent}
          style={dynamicStyles.list}
          showsVerticalScrollIndicator={false}
        />
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.backgroundElevated,
  },
  backButton: {
    marginRight: 12,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  backButtonText: {
    fontSize: 16,
    color: colors.accent,
    fontWeight: '500',
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
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
    color: colors.textMuted,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    fontSize: 15,
    color: colors.error,
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
});

export default TopicDetailScreen;

