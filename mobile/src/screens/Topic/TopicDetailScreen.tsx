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
import type { HomeStackParamList } from '../../navigation/AppNavigator';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTopicStore } from '../../stores/useTopicStore';
import { useUserStore } from '../../stores/useUserStore';
import { getPostsByTopic } from '../../services/postAggregationService';
import ChirpCard from '../../components/ChirpCard';
import { colors } from '../../theme/colors';
import { filterChirpsForViewer } from '../../utils/chirpVisibility';
import type { Chirp } from '../../types';

type NavigationProp = NativeStackNavigationProp<HomeStackParamList>;
type RouteProp = {
  key: string;
  name: 'TopicDetail';
  params: { topicName: string };
};

const TopicDetailScreen = () => {
  const route = useRoute<RouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const { topicName } = route.params;
  const { clearTopicSelection } = useTopicStore();
  const currentUser = useUserStore((state) => state.currentUser);
  const [topicPosts, setTopicPosts] = useState<Chirp[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>#{topicName}</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.light.accent} />
          <Text style={styles.loadingText}>Loading posts...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>#{topicName}</Text>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
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
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>#{topicName}</Text>
          <Text style={styles.headerSubtitle}>
            {topicPosts.length} post{topicPosts.length !== 1 ? 's' : ''} about this topic
          </Text>
        </View>
      </View>

      {topicPosts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No posts found for this topic yet.</Text>
          <Text style={styles.emptySubtext}>Be the first to post about #{topicName}!</Text>
        </View>
      ) : (
        <FlatList
          data={topicPosts}
          renderItem={({ item }) => <ChirpCard chirp={item} />}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
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
    marginRight: 12,
    paddingVertical: 4,
  },
  backButtonText: {
    fontSize: 16,
    color: colors.light.accent,
    fontWeight: '500',
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.light.textPrimary,
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 13,
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    fontSize: 15,
    color: '#ef4444',
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
    color: colors.light.textMuted,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 13,
    color: colors.light.textMuted,
    textAlign: 'center',
  },
  listContent: {
    paddingTop: 8,
  },
});

export default TopicDetailScreen;

