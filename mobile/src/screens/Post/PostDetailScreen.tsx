import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  TouchableOpacity,
  Share,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { Chirp, User } from '../../types';
import { useTheme } from '../../hooks/useTheme';
import { chirpService } from '../../services/chirpService';
import { useUserStore } from '../../stores/useUserStore';
import { useFeedStore } from '../../stores/useFeedStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { useComposer } from '../../context/ComposerContext';
import FactCheckStatusModal from '../../components/FactCheckStatusModal';
import RepostModal from '../../components/RepostModal';
import ActionModal from '../../components/ActionModal';
import BookmarkFolderModal from '../../components/BookmarkFolderModal';
import CommentSection from '../../components/CommentSection';
import { renderFormattedText } from '../../utils/formattedText';

type RouteParams = {
  postId: string;
};

const formatTimeAgo = (date: Date) => {
  // Validate date
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    return 'recently';
  }
  
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
  const { colors } = useTheme();
  const route = useRoute();
  const navigation = useNavigation();
  const { postId } = (route.params as RouteParams) || {};
  const {
    getUser,
    loadUser,
    followUser,
    unfollowUser,
    isFollowing,
    bookmarkChirp,
    unbookmarkChirp,
    isBookmarked,
    createBookmarkFolder,
    getBookmarkFolders,
    addBookmarkToFolder,
  } = useUserStore();
  const { latest, forYou, addChirp } = useFeedStore();
  const { user: currentUser } = useAuthStore();
  const { openWithQuote, openForComment } = useComposer();
  const scrollViewRef = useRef<ScrollView>(null);
  const [chirp, setChirp] = useState<Chirp | null>(null);
  const [author, setAuthor] = useState<User | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [showFactCheckModal, setShowFactCheckModal] = useState(false);
  const [showRepostModal, setShowRepostModal] = useState(false);
  const [showActionModal, setShowActionModal] = useState(false);
  const [showBookmarkFolderModal, setShowBookmarkFolderModal] = useState(false);
  const [actionModalConfig, setActionModalConfig] = useState<{
    title: string;
    message: string;
    type?: 'info' | 'success' | 'error' | 'warning';
  } | null>(null);

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

  const dynamicStyles = getStyles(colors);

  if (isLoading) {
    return (
      <SafeAreaView style={dynamicStyles.container}>
        <View style={dynamicStyles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={dynamicStyles.headerTitle}>Post</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={dynamicStyles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (!chirp) {
    return (
      <SafeAreaView style={dynamicStyles.container}>
        <View style={dynamicStyles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={dynamicStyles.headerTitle}>Post</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={dynamicStyles.errorContainer}>
          <Text style={dynamicStyles.errorText}>Post not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Safely convert createdAt to Date, with fallback
  let createdAt: Date;
  if (chirp.createdAt instanceof Date) {
    createdAt = chirp.createdAt;
  } else if (chirp.createdAt) {
    createdAt = new Date(chirp.createdAt);
    // If conversion failed, use current date as fallback
    if (isNaN(createdAt.getTime())) {
      createdAt = new Date();
    }
  } else {
    // If createdAt is missing, use current date as fallback
    createdAt = new Date();
  }
  const topicLabel = chirp.topic || 'general';
  const displayName = author?.name || 'Unknown User';
  const displayHandle = author?.handle || chirp.authorId?.slice(0, 8) || 'unknown';
  const avatarLetter = getInitial(author?.name || author?.handle || chirp.authorId);

  const getFactCheckStyle = () => {
    if (!chirp.factCheckStatus) return null;
    switch (chirp.factCheckStatus) {
      case 'clean':
        return {
          backgroundColor: 'rgba(16, 185, 129, 0.2)',
          iconColor: '#10B981',
          icon: '✓',
        };
      case 'needs_review':
        return {
          backgroundColor: 'rgba(245, 158, 11, 0.2)',
          iconColor: '#F59E0B',
          icon: '⚠',
        };
      case 'blocked':
        return {
          backgroundColor: 'rgba(239, 68, 68, 0.2)',
          iconColor: '#EF4444',
          icon: '✗',
        };
      default:
        return null;
    }
  };

  const factCheckStyle = getFactCheckStyle();

  const handleFollow = async () => {
    if (!chirp) return;
    if (isFollowing(chirp.authorId)) {
      await unfollowUser(chirp.authorId);
    } else {
      await followUser(chirp.authorId);
    }
  };

  const handleBookmark = async () => {
    if (!currentUser || !chirp || chirp.authorId === currentUser.id) return;

    if (isBookmarked(chirp.id)) {
      await unbookmarkChirp(chirp.id);
    } else {
      // Show folder selection modal
      setShowBookmarkFolderModal(true);
    }
  };

  const handleSelectFolder = async (folderId: string) => {
    if (!chirp) return;
    try {
      await addBookmarkToFolder(chirp.id, folderId);
      setActionModalConfig({
        title: 'Success',
        message: 'Post saved to folder!',
        type: 'success',
      });
      setShowActionModal(true);
    } catch (error) {
      console.error('Error adding bookmark to folder:', error);
      setActionModalConfig({
        title: 'Error',
        message: 'Failed to save bookmark. Please try again.',
        type: 'error',
      });
      setShowActionModal(true);
    }
  };

  const handleCreateFolder = async (folderName: string) => {
    if (!chirp) return;
    try {
      const folderId = await createBookmarkFolder(folderName);
      await addBookmarkToFolder(chirp.id, folderId);
      setActionModalConfig({
        title: 'Success',
        message: 'Folder created and post saved!',
        type: 'success',
      });
      setShowActionModal(true);
    } catch (error) {
      console.error('Error creating folder:', error);
      setActionModalConfig({
        title: 'Error',
        message: 'Failed to create folder. Please try again.',
        type: 'error',
      });
      setShowActionModal(true);
    }
  };

  const handleShare = async () => {
    if (!chirp) return;

    try {
      const message = `Check out this post by @${author?.handle || 'unknown'}: "${chirp.text}"`;
      await Share.share({
        message,
      });
    } catch (error) {
      console.error('Error sharing post:', error);
      setActionModalConfig({
        title: 'Error',
        message: 'Failed to share post',
        type: 'error',
      });
      setShowActionModal(true);
    }
  };


  const handleCommentClick = () => {
    if (!chirp) return;
    
    // Open composer for comment
    openForComment(chirp);
  };

  const handleRepostClick = () => {
    if (!chirp || !currentUser) return;
    setShowRepostModal(true);
  };

  const handleJustRepost = async () => {
    if (!chirp || !currentUser) return;
    try {
      await addChirp({
        authorId: currentUser.id,
        text: chirp.text,
        topic: chirp.topic,
        reachMode: 'forAll',
        rechirpOfId: chirp.id,
        semanticTopics: chirp.semanticTopics?.length ? chirp.semanticTopics : undefined,
      });
      setActionModalConfig({
        title: 'Success',
        message: 'Post reposted successfully!',
        type: 'success',
      });
      setShowActionModal(true);
    } catch (error) {
      console.error('Error reposting:', error);
      setActionModalConfig({
        title: 'Error',
        message: 'Failed to repost. Please try again.',
        type: 'error',
      });
      setShowActionModal(true);
    }
  };

  const handleAddThoughts = () => {
    if (!chirp) return;
    openWithQuote(chirp);
  };

  const following = chirp ? isFollowing(chirp.authorId) : false;
  const bookmarked = chirp ? isBookmarked(chirp.id) : false;
  const isCurrentUser = currentUser?.id === chirp?.authorId;

  return (
    <SafeAreaView style={dynamicStyles.container}>
      <View style={dynamicStyles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={dynamicStyles.headerTitle}>Post</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView 
        ref={scrollViewRef}
        style={dynamicStyles.content} 
        contentContainerStyle={dynamicStyles.contentContainer}
      >
        <View style={dynamicStyles.postCard}>
          <View style={dynamicStyles.postHeader}>
            <View style={dynamicStyles.avatar}>
              {author?.profilePictureUrl ? (
                <Image
                  source={{ uri: author.profilePictureUrl }}
                  style={dynamicStyles.avatarImage}
                />
              ) : (
                <Text style={dynamicStyles.avatarText}>{avatarLetter}</Text>
              )}
            </View>
            <View style={dynamicStyles.meta}>
              <View style={dynamicStyles.metaRow}>
                <Text style={dynamicStyles.author}>{displayName}</Text>
                {!isCurrentUser && (
                  <TouchableOpacity
                    onPress={handleFollow}
                    style={[dynamicStyles.followButtonInline, following && dynamicStyles.followingButtonInline]}
                    activeOpacity={0.8}
                  >
                    <Text style={[dynamicStyles.followButtonTextInline, following && dynamicStyles.followingButtonTextInline]}>
                      {following ? 'Following' : 'Follow'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              <Text style={dynamicStyles.handle}>
                @{displayHandle} · {formatTimeAgo(createdAt)}
              </Text>
            </View>
            
            {/* Fact-check status badge - top right */}
            {chirp.factCheckStatus && factCheckStyle && (
              <TouchableOpacity
                style={[dynamicStyles.factCheckBadge, { backgroundColor: factCheckStyle.backgroundColor }]}
                onPress={() => setShowFactCheckModal(true)}
                activeOpacity={0.8}
              >
                <Text style={[dynamicStyles.factCheckIcon, { color: factCheckStyle.iconColor }]}>
                  {factCheckStyle.icon}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {chirp.formattedText ? (
            renderFormattedText(chirp.formattedText, dynamicStyles.body)
          ) : (
            <Text style={dynamicStyles.body}>{chirp.text}</Text>
          )}

          {chirp.imageUrl ? (
            <Image
              source={{ uri: chirp.imageUrl }}
              style={dynamicStyles.image}
              resizeMode="cover"
            />
          ) : null}

          <View style={dynamicStyles.footer}>
            <View style={dynamicStyles.badge}>
              <Text style={dynamicStyles.badgeText}>#{topicLabel}</Text>
            </View>
          </View>

          {/* Interaction Actions */}
          <View style={dynamicStyles.actions}>
            <TouchableOpacity
              onPress={handleCommentClick}
              style={dynamicStyles.actionButton}
              activeOpacity={0.8}
            >
              <Ionicons name="chatbubble-outline" size={22} color={colors.textMuted} />
              {(chirp.commentCount ?? 0) > 0 && (
                <Text style={dynamicStyles.actionCount}>{chirp.commentCount}</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleRepostClick}
              style={dynamicStyles.actionButton}
              activeOpacity={0.8}
            >
              <Ionicons name="repeat-outline" size={22} color={colors.textMuted} />
            </TouchableOpacity>

            {!isCurrentUser && (
              <TouchableOpacity
                onPress={handleBookmark}
                style={dynamicStyles.actionButton}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={bookmarked ? "bookmark" : "bookmark-outline"}
                  size={22}
                  color={bookmarked ? colors.accent : colors.textMuted}
                />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={handleShare}
              style={dynamicStyles.actionButton}
              activeOpacity={0.8}
            >
              <Ionicons name="share-outline" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Comment Section */}
        <CommentSection 
          chirp={chirp} 
          initialExpanded={false}
        />
      </ScrollView>
      
      {/* Fact-check status modal */}
      {chirp && (
        <FactCheckStatusModal
          visible={showFactCheckModal}
          onClose={() => setShowFactCheckModal(false)}
          chirp={chirp}
        />
      )}

      {/* Repost modal */}
      <RepostModal
        visible={showRepostModal}
        onClose={() => setShowRepostModal(false)}
        onJustRepost={handleJustRepost}
        onAddThoughts={handleAddThoughts}
      />

      {/* Action modal for success/error messages */}
      {actionModalConfig && (
        <ActionModal
          visible={showActionModal}
          onClose={() => {
            setShowActionModal(false);
            setActionModalConfig(null);
          }}
          title={actionModalConfig.title}
          message={actionModalConfig.message}
          type={actionModalConfig.type}
        />
      )}

      {/* Bookmark folder modal */}
      <BookmarkFolderModal
        visible={showBookmarkFolderModal}
        onClose={() => setShowBookmarkFolderModal(false)}
        folders={getBookmarkFolders()}
        onSelectFolder={handleSelectFolder}
        onCreateFolder={handleCreateFolder}
      />
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
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
    color: colors.textMuted,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  postCard: {
    backgroundColor: colors.backgroundElevated,
    borderRadius: 14,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    marginBottom: 16,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    position: 'relative',
  },
  factCheckBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  factCheckIcon: {
    fontSize: 16,
    fontWeight: '700',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.accent,
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
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  author: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  handle: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 2,
  },
  followButtonInline: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    backgroundColor: colors.accent,
  },
  followingButtonInline: {
    backgroundColor: colors.border + '80',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  followButtonTextInline: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  followingButtonTextInline: {
    color: colors.textPrimary,
  },
  body: {
    fontSize: 16,
    color: colors.textSecondary,
    lineHeight: 24,
    marginBottom: 12,
  },
  image: {
    width: '100%',
    height: 300,
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: colors.border,
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
    backgroundColor: colors.accent + '14',
  },
  badgeText: {
    color: colors.accent,
    fontWeight: '600',
    fontSize: 13,
  },
  metaText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: 24,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  actionCount: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '600',
    marginLeft: 2,
  },
});

export default PostDetailScreen;

