import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Share, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import type { HomeStackParamList } from '../navigation/AppNavigator';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { Chirp, User } from '../types';
import { useTheme } from '../hooks/useTheme';
import { useUserStore } from '../stores/useUserStore';
import { useAuthStore } from '../stores/useAuthStore';
import { useFeedStore } from '../stores/useFeedStore';
import { useComposer } from '../context/ComposerContext';
import FactCheckStatusModal from './FactCheckStatusModal';
import RepostModal from './RepostModal';
import ActionModal from './ActionModal';
import BookmarkFolderModal from './BookmarkFolderModal';
import { renderFormattedText } from '../utils/formattedText';

type NavigationProp = NativeStackNavigationProp<HomeStackParamList>;

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

type Props = {
  chirp: Chirp;
};

const ChirpCard: React.FC<Props> = ({ chirp }) => {
  const navigation = useNavigation<NavigationProp>();
  const { colors } = useTheme();
  const loadUser = useUserStore((state) => state.loadUser);
  const {
    bookmarkChirp,
    unbookmarkChirp,
    isBookmarked,
    createBookmarkFolder,
    getBookmarkFolders,
    addBookmarkToFolder,
  } = useUserStore();
  const { user: currentUser } = useAuthStore();
  const { addChirp } = useFeedStore();
  const { openWithQuote, openForComment } = useComposer();
  const [showFactCheckModal, setShowFactCheckModal] = useState(false);
  const [showRepostModal, setShowRepostModal] = useState(false);
  const [showActionModal, setShowActionModal] = useState(false);
  const [showBookmarkFolderModal, setShowBookmarkFolderModal] = useState(false);
  const [actionModalConfig, setActionModalConfig] = useState<{
    title: string;
    message: string;
    type?: 'info' | 'success' | 'error' | 'warning';
  } | null>(null);
  
  // Subscribe to user from store (will update reactively)
  const author = useUserStore((state) => state.users[chirp.authorId]);

  // Load author if not in cache
  useEffect(() => {
    if (!author) {
      loadUser(chirp.authorId);
    }
  }, [chirp.authorId, author, loadUser]);

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
  
  // Use author info if available, fallback to defaults
  const displayName = author?.name || 'Unknown User';
  const displayHandle = author?.handle || chirp.authorId?.slice(0, 8) || 'unknown';
  const avatarLetter = getInitial(author?.name || author?.handle || chirp.authorId);

  const dynamicStyles = getStyles(colors);

  const renderFormattedTextContent = () => {
    const source = chirp.formattedText || chirp.text;
    // If no formattedText, return plain text
    if (!chirp.formattedText) {
      return <Text style={dynamicStyles.body}>{source}</Text>;
    }
    // Use the formatted text renderer
    return renderFormattedText(source, dynamicStyles.body);
  };

  const handleCardPress = () => {
    navigation.navigate('PostDetail', { postId: chirp.id });
  };

  const handleFactCheckPress = () => {
    setShowFactCheckModal(true);
  };

  const handleCommentClick = () => {
    // Open composer for comment
    openForComment(chirp);
  };

  const handleRepostClick = () => {
    if (!currentUser) return;
    setShowRepostModal(true);
  };

  const handleJustRepost = async () => {
    if (!currentUser) return;
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
    openWithQuote(chirp);
  };

  const handleBookmark = async () => {
    if (!currentUser || chirp.authorId === currentUser.id) return;

    if (isBookmarked(chirp.id)) {
      await unbookmarkChirp(chirp.id);
    } else {
      // Show folder selection modal
      setShowBookmarkFolderModal(true);
    }
  };

  const handleSelectFolder = async (folderId: string) => {
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

  const bookmarked = isBookmarked(chirp.id);
  const isCurrentUser = currentUser?.id === chirp.authorId;

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

  return (
    <TouchableOpacity style={dynamicStyles.card} onPress={handleCardPress} activeOpacity={0.7}>
      {/* Fact-check status badge - top right */}
      {chirp.factCheckStatus && factCheckStyle && (
        <TouchableOpacity
          style={[dynamicStyles.factCheckBadge, { backgroundColor: factCheckStyle.backgroundColor }]}
          onPress={handleFactCheckPress}
          activeOpacity={0.8}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={[dynamicStyles.factCheckIcon, { color: factCheckStyle.iconColor }]}>
            {factCheckStyle.icon}
          </Text>
        </TouchableOpacity>
      )}
      <View style={dynamicStyles.header}>
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
          <Text style={dynamicStyles.author}>{displayName}</Text>
          <Text style={dynamicStyles.handle}>
            @{displayHandle} · {formatTimeAgo(createdAt)}
          </Text>
        </View>
      </View>

      {renderFormattedTextContent()}

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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {chirp.scheduledAt && chirp.scheduledAt > new Date() && (
            <Text style={dynamicStyles.metaText}>Scheduled</Text>
          )}
        </View>
      </View>

      {/* Interaction Actions */}
      <View style={dynamicStyles.actions}>
        <TouchableOpacity
          onPress={handleCommentClick}
          style={dynamicStyles.actionButton}
          activeOpacity={0.8}
        >
          <Ionicons name="chatbubble-outline" size={20} color={colors.textMuted} />
          {(chirp.commentCount ?? 0) > 0 && (
            <Text style={dynamicStyles.actionCount}>{chirp.commentCount}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleRepostClick}
          style={dynamicStyles.actionButton}
          activeOpacity={0.8}
        >
          <Ionicons name="repeat-outline" size={20} color={colors.textMuted} />
        </TouchableOpacity>

        {!isCurrentUser && (
          <TouchableOpacity
            onPress={handleBookmark}
            style={dynamicStyles.actionButton}
            activeOpacity={0.8}
          >
            <Ionicons
              name={bookmarked ? "bookmark" : "bookmark-outline"}
              size={20}
              color={bookmarked ? colors.accent : colors.textMuted}
            />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          onPress={handleShare}
          style={dynamicStyles.actionButton}
          activeOpacity={0.8}
        >
          <Ionicons name="share-outline" size={20} color={colors.textMuted} />
        </TouchableOpacity>
      </View>
      
      {/* Fact-check status modal */}
      <FactCheckStatusModal
        visible={showFactCheckModal}
        onClose={() => setShowFactCheckModal(false)}
        chirp={chirp}
      />

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
    </TouchableOpacity>
  );
};

const getStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  card: {
    backgroundColor: colors.backgroundElevated,
    borderRadius: 14,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    marginBottom: 12,
    position: 'relative',
  },
  factCheckBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  factCheckIcon: {
    fontSize: 14,
    fontWeight: '700',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  meta: {
    marginLeft: 10,
  },
  author: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  handle: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  body: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  image: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginTop: 12,
    backgroundColor: colors.border,
  },
  footer: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badge: {
    paddingHorizontal: 10,
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
    fontSize: 13,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: 20,
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

export default ChirpCard;


