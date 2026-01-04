import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { Chirp, User } from '../../types';
import { colors } from '../../theme/colors';
import { chirpService } from '../../services/chirpService';
import { useUserStore } from '../../stores/useUserStore';
import { useFeedStore } from '../../stores/useFeedStore';
import { useAuthStore } from '../../stores/useAuthStore';

type RouteParams = {
  postId: string;
};

const formatTimeAgo = (date: Date) => {
  const now = Date.now();
  const diffMs = Math.max(0, now - date.getTime());
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m`;
  if (diffHours < 24) return `${diffHours}h`;
  return `${diffDays}d`;
};

const getInitial = (value?: string) =>
  value?.charAt(0)?.toUpperCase() || 'U';

const PostDetailScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { postId } = (route.params as RouteParams) || {};
  const { getUser, loadUser } = useUserStore();
  const { latest, forYou } = useFeedStore();
  const { user: currentUser } = useAuthStore();
  const [chirp, setChirp] = useState<Chirp | null>(null);
  const [author, setAuthor] = useState<User | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!postId) {
      setIsLoading(false);
      return;
    }

    const loadPost = async () => {
      try {
        // First check if chirp is in store (check both latest and forYou arrays)
        const storedChirp = latest.find((c) => c.id === postId) || forYou.find((c) => c.id === postId);
        
        if (storedChirp) {
          setChirp(storedChirp);
          const authorData = getUser(storedChirp.authorId);
          if (authorData) {
            setAuthor(authorData);
          } else {
            await loadUser(storedChirp.authorId);
            const loadedAuthor = getUser(storedChirp.authorId);
            if (loadedAuthor) {
              setAuthor(loadedAuthor);
            }
          }
          setIsLoading(false);
        } else {
          // Load from Firestore
          const loadedChirp = await chirpService.getChirp(postId);
          if (loadedChirp) {
            setChirp(loadedChirp);
            // Load author
            const authorData = getUser(loadedChirp.authorId);
            if (authorData) {
              setAuthor(authorData);
            } else {
              await loadUser(loadedChirp.authorId);
              const loadedAuthor = getUser(loadedChirp.authorId);
              if (loadedAuthor) {
                setAuthor(loadedAuthor);
              }
            }
          }
          setIsLoading(false);
        }
      } catch (error) {
        console.error('[PostDetailScreen] Error loading post:', error);
        setIsLoading(false);
      }
    };

    loadPost();
  }, [postId, latest, forYou, getUser, loadUser]);

  // Update author if it gets loaded
  useEffect(() => {
    if (chirp) {
      const cachedAuthor = getUser(chirp.authorId);
      if (cachedAuthor && cachedAuthor !== author) {
        setAuthor(cachedAuthor);
      }
    }
  }, [chirp, getUser]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={colors.light.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Post</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.light.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (!chirp) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={colors.light.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Post</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Post not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const createdAt =
    chirp.createdAt instanceof Date
      ? chirp.createdAt
      : new Date(chirp.createdAt);
  const topicLabel = chirp.topic || 'general';
  const displayName = author?.name || 'Unknown User';
  const displayHandle = author?.handle || chirp.authorId?.slice(0, 8) || 'unknown';
  const avatarLetter = getInitial(author?.name || author?.handle || chirp.authorId);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.light.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Post</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.postCard}>
          <View style={styles.postHeader}>
            <View style={styles.avatar}>
              {author?.profilePictureUrl ? (
                <Image
                  source={{ uri: author.profilePictureUrl }}
                  style={styles.avatarImage}
                />
              ) : (
                <Text style={styles.avatarText}>{avatarLetter}</Text>
              )}
            </View>
            <View style={styles.meta}>
              <Text style={styles.author}>{displayName}</Text>
              <Text style={styles.handle}>
                @{displayHandle} · {formatTimeAgo(createdAt)}
              </Text>
            </View>
          </View>

          <Text style={styles.body}>{chirp.text}</Text>

          {chirp.imageUrl ? (
            <Image
              source={{ uri: chirp.imageUrl }}
              style={styles.image}
              resizeMode="cover"
            />
          ) : null}

          <View style={styles.footer}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>#{topicLabel}</Text>
            </View>
            <Text style={styles.metaText}>
              {chirp.commentCount ?? 0} { (chirp.commentCount ?? 0) === 1 ? 'comment' : 'comments' }
            </Text>
          </View>
        </View>

        <View style={styles.commentsPlaceholder}>
          <Text style={styles.commentsPlaceholderText}>
            Comments will be available in Phase 4
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.light.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.light.textPrimary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    color: colors.light.textMuted,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  postCard: {
    backgroundColor: colors.light.backgroundElevated,
    borderRadius: 14,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.light.border,
    marginBottom: 16,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.light.accent,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 20,
  },
  meta: {
    marginLeft: 12,
    flex: 1,
  },
  author: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.light.textPrimary,
  },
  handle: {
    fontSize: 14,
    color: colors.light.textMuted,
    marginTop: 2,
  },
  body: {
    fontSize: 16,
    color: colors.light.textSecondary,
    lineHeight: 24,
    marginBottom: 12,
  },
  image: {
    width: '100%',
    height: 300,
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: '#f2f2f2',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(124, 58, 237, 0.08)',
  },
  badgeText: {
    color: colors.light.accent,
    fontWeight: '600',
    fontSize: 13,
  },
  metaText: {
    color: colors.light.textMuted,
    fontSize: 14,
  },
  commentsPlaceholder: {
    padding: 24,
    alignItems: 'center',
  },
  commentsPlaceholderText: {
    fontSize: 14,
    color: colors.light.textMuted,
    fontStyle: 'italic',
  },
});

export default PostDetailScreen;

