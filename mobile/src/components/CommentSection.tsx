import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  ScrollView,
  NativeSyntheticEvent,
  TextInputSelectionChangeEventData,
  Alert,
} from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { extractMentionHandles, linkifyMentions } from '../utils/mentions';
import { userService } from '../services/userService';
import type { Chirp, Comment, CommentTreeNode, User } from '../types';
import { useFeedStore } from '../stores/useFeedStore';
import { useUserStore } from '../stores/useUserStore';
import { useAuthStore } from '../stores/useAuthStore';

type MentionCandidate = {
  id: string;
  name: string;
  handle: string;
  profilePictureUrl?: string;
};

type CommentSectionProps = {
  chirp: Chirp;
  initialExpanded?: boolean;
};

type CommentEditorProps = {
  chirpId: string;
  parentCommentId?: string;
  replyToUserId?: string;
  replyToHandle?: string;
  onSubmit: (text: string, formattedText: string, mentions: string[]) => Promise<void>;
  onCancel?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
};

type CommentItemProps = {
  comment: CommentTreeNode;
  chirpId: string;
  chirpAuthorId: string;
  depth: number;
  maxDepth?: number;
};

// Comment Editor Component
const CommentEditor: React.FC<CommentEditorProps> = ({
  chirpId,
  parentCommentId,
  replyToUserId,
  replyToHandle,
  onSubmit,
  onCancel,
  placeholder = 'Write a comment...',
  autoFocus = false,
}) => {
  const [text, setText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionResults, setMentionResults] = useState<MentionCandidate[]>([]);
  const [selection, setSelection] = useState<{ start: number; end: number }>({
    start: 0,
    end: 0,
  });
  const mentionStartRef = useRef<number | null>(null);
  const mentionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mentionCache = useRef<Map<string, string>>(new Map());
  const textInputRef = useRef<TextInput>(null);

  // Initialize text with @mention if replying
  useEffect(() => {
    if (replyToHandle) {
      setText(`@${replyToHandle} `);
      setSelection({ start: `@${replyToHandle} `.length, end: `@${replyToHandle} `.length });
    }
  }, [replyToHandle]);

  // Handle auto-focus when prop changes
  useEffect(() => {
    if (autoFocus && textInputRef.current) {
      // Small delay to ensure the input is fully rendered
      const timer = setTimeout(() => {
        textInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [autoFocus]);

  // Search for users when mention query changes
  useEffect(() => {
    if (mentionQuery === null) {
      setMentionResults([]);
      return;
    }

    if (mentionTimer.current) {
      clearTimeout(mentionTimer.current);
    }

    mentionTimer.current = setTimeout(async () => {
      const results = await userService.searchUsers(mentionQuery, 5);
      setMentionResults(
        results
          .filter((u) => u.id !== replyToUserId) // Filter out the user being replied to
          .map((u) => ({
            id: u.id,
            name: u.name,
            handle: u.handle,
            profilePictureUrl: u.profilePictureUrl,
          }))
      );
    }, mentionQuery.length === 0 ? 0 : 250);
  }, [mentionQuery, replyToUserId]);

  const updateMentionState = (currentText: string, cursorPos: number) => {
    const beforeCursor = currentText.slice(0, cursorPos);
    const match = beforeCursor.match(/@(\w*)$/);
    if (match) {
      setMentionQuery(match[1]);
      mentionStartRef.current = match.index ?? null;
    } else {
      setMentionQuery(null);
      mentionStartRef.current = null;
    }
  };

  const handleSelectionChange = (
    e: NativeSyntheticEvent<TextInputSelectionChangeEventData>
  ) => {
    const sel = e.nativeEvent.selection;
    setSelection(sel);
    updateMentionState(text, sel.start);
  };

  const handleTextChange = (value: string) => {
    setText(value);
    updateMentionState(value, selection.start);
  };

  const handleMentionSelect = (candidate: MentionCandidate) => {
    if (mentionStartRef.current === null) return;
    const start = mentionStartRef.current;
    const { end } = selection;
    const before = text.slice(0, start);
    const after = text.slice(end);
    const mentionText = `@${candidate.handle} `;
    const next = before + mentionText + after;
    const newPos = (before + mentionText).length;
    setText(next);
    setSelection({ start: newPos, end: newPos });
    setMentionQuery(null);
    mentionStartRef.current = null;
    mentionCache.current.set(candidate.handle, candidate.id);
  };

  const resolveMentions = async (handles: string[]): Promise<string[]> => {
    const ids: string[] = [];
    for (const handle of handles) {
      if (mentionCache.current.has(handle)) {
        ids.push(mentionCache.current.get(handle)!);
      } else {
        const found = await userService.getUserByHandle(handle);
        if (found) {
          ids.push(found.id);
          mentionCache.current.set(handle, found.id);
        }
      }
    }
    return Array.from(new Set(ids));
  };

  const handleSubmit = async () => {
    const trimmed = text.trim();
    if (!trimmed || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const formatted = markdownToHtml(trimmed);
      const handles = extractMentionHandles(trimmed);
      const mentionIds = await resolveMentions(handles);
      await onSubmit(trimmed, formatted, mentionIds);
      setText('');
      setMentionQuery(null);
      mentionStartRef.current = null;
    } catch (error) {
      console.error('[CommentEditor] Submit error:', error);
      Alert.alert('Error', 'Failed to post comment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = text.trim().length > 0 && !isSubmitting;
  const dynamicStyles = getEditorStyles(colors);

  return (
    <View style={dynamicStyles.editorContainer}>
      <View style={dynamicStyles.inputContainer}>
        <TextInput
          ref={textInputRef}
          style={dynamicStyles.input}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          multiline
          value={text}
          onChangeText={handleTextChange}
          selection={selection}
          onSelectionChange={handleSelectionChange}
          autoFocus={autoFocus}
          maxLength={500}
        />

        {/* Mention Dropdown */}
        {mentionQuery !== null && mentionResults.length > 0 && (
          <View style={dynamicStyles.mentionDropdown}>
            {mentionResults.map((candidate) => (
              <TouchableOpacity
                key={candidate.id}
                style={dynamicStyles.mentionItem}
                onPress={() => handleMentionSelect(candidate)}
              >
                {candidate.profilePictureUrl ? (
                  <Image
                    source={{ uri: candidate.profilePictureUrl }}
                    style={dynamicStyles.mentionAvatar}
                  />
                ) : (
                  <View style={dynamicStyles.mentionAvatarPlaceholder}>
                    <Text style={dynamicStyles.mentionAvatarText}>
                      {candidate.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={dynamicStyles.mentionInfo}>
                  <Text style={dynamicStyles.mentionName} numberOfLines={1}>
                    {candidate.name}
                  </Text>
                  <Text style={dynamicStyles.mentionHandle} numberOfLines={1}>
                    @{candidate.handle}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <View style={dynamicStyles.editorActions}>
        {onCancel && (
          <TouchableOpacity onPress={onCancel} style={dynamicStyles.cancelButton}>
            <Text style={dynamicStyles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={handleSubmit}
          style={[dynamicStyles.submitButton, !canSubmit && dynamicStyles.submitButtonDisabled]}
          disabled={!canSubmit}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={dynamicStyles.submitText}>Post</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Comment Item Component
const CommentItem: React.FC<CommentItemProps> = ({
  comment,
  chirpId,
  chirpAuthorId,
  depth,
  maxDepth = 5
}) => {
  const { colors } = useTheme();
  const [isReplying, setIsReplying] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { deleteComment } = useFeedStore();
  const { user: currentUser } = useAuthStore();
  const users = useUserStore((state) => state.users);
  const { loadUser } = useUserStore();
  const dynamicStyles = getCommentStyles(colors);
  
  // Get users from store state (read-only, no setState during render)
  const author = users[comment.authorId];
  const replyToUser = comment.replyToUserId ? users[comment.replyToUserId] : undefined;

  // Load users in useEffect if they're not in cache
  useEffect(() => {
    if (!author) {
      loadUser(comment.authorId).catch(console.error);
    }
  }, [comment.authorId, author, loadUser]);

  useEffect(() => {
    if (comment.replyToUserId && !replyToUser) {
      loadUser(comment.replyToUserId).catch(console.error);
    }
  }, [comment.replyToUserId, replyToUser, loadUser]);

  const formatTime = (date: Date): string => {
    const minutesAgo = Math.floor((Date.now() - date.getTime()) / 60000);
    if (minutesAgo < 1) return 'now';
    if (minutesAgo < 60) return `${minutesAgo}m`;
    const hoursAgo = Math.floor(minutesAgo / 60);
    if (hoursAgo < 24) return `${hoursAgo}h`;
    const daysAgo = Math.floor(hoursAgo / 24);
    return `${daysAgo}d`;
  };

  const handleReplySubmit = async (text: string, formattedText: string, mentions: string[]) => {
    if (!currentUser || !author) return;

    try {
      await useFeedStore.getState().addComment(chirpId, {
        authorId: currentUser.id,
        text,
        formattedText,
        // Mentions are parsed from text, not stored separately
        parentCommentId: comment.id,
        replyToUserId: comment.authorId,
        // Depth will be calculated by commentService
      });
      setIsReplying(false);
    } catch (error) {
      console.error('Error posting reply:', error);
      throw error;
    }
  };

  const handleDeleteClick = () => {
    if (!currentUser) return;
    if (currentUser.id !== comment.authorId && currentUser.id !== chirpAuthorId) return;
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    if (!currentUser) return;
    if (currentUser.id !== comment.authorId && currentUser.id !== chirpAuthorId) return;

    try {
      await deleteComment(comment.id, chirpId, currentUser.id);
      setShowDeleteConfirm(false);
    } catch (error) {
      console.error('Error deleting comment:', error);
      setShowDeleteConfirm(false);
      Alert.alert('Error', 'Failed to delete comment. Please try again.');
    }
  };

  // Render formatted text or plain text
  const renderCommentText = () => {
    if (comment.formattedText) {
      return (
        <Text style={dynamicStyles.commentText}>
          {comment.formattedText}
        </Text>
      );
    }
    return (
      <Text style={dynamicStyles.commentText}>
        {comment.text}
      </Text>
    );
  };

  const isCommentAuthor = currentUser?.id === comment.authorId;
  const isChirpAuthor = currentUser?.id === chirpAuthorId;
  const canDelete = isCommentAuthor || isChirpAuthor;

  if (!author) return null;

  const indentLevel = Math.min(depth, maxDepth);
  const indentPx = indentLevel * 16;
  const hasReplies = comment.replies.length > 0;

  return (
    <View style={{ marginLeft: indentPx }}>
      {depth > 0 && (
        <View
          style={dynamicStyles.replyLine}
        />
      )}

      <View style={dynamicStyles.commentCard}>
        {/* Comment header */}
        <View style={dynamicStyles.commentHeader}>
          <View style={dynamicStyles.authorInfo}>
            <View style={dynamicStyles.avatar}>
              {author.profilePictureUrl ? (
                <Image
                  source={{ uri: author.profilePictureUrl }}
                  style={dynamicStyles.avatarImage}
                />
              ) : (
                <View style={dynamicStyles.avatarPlaceholder}>
                  <Text style={dynamicStyles.avatarText}>
                    {author.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
            <View style={dynamicStyles.authorMeta}>
              <Text style={dynamicStyles.authorName}>{author.name}</Text>
              <Text style={dynamicStyles.authorHandle}>@{author.handle}</Text>
              <Text style={dynamicStyles.commentTime}>· {formatTime(comment.createdAt)}</Text>
            </View>
          </View>
        </View>

        {/* Comment text */}
        {renderCommentText()}

        {/* Comment image */}
        {comment.imageUrl && (
          <Image
            source={{ uri: comment.imageUrl }}
            style={dynamicStyles.commentImage}
            resizeMode="cover"
          />
        )}

        {/* Value Contribution & Discussion Role */}
        {(comment.valueContribution || comment.discussionRole) && (
          <View style={dynamicStyles.commentMeta}>
            {comment.valueContribution && (
              <View style={dynamicStyles.valueBadge}>
                <Text style={dynamicStyles.valueText}>⭐ {(comment.valueContribution.total * 100).toFixed(0)}</Text>
              </View>
            )}
            {comment.discussionRole && (
              <View style={dynamicStyles.roleBadge}>
                <Text style={dynamicStyles.roleText}>{comment.discussionRole}</Text>
              </View>
            )}
          </View>
        )}

        {/* Actions */}
        <View style={dynamicStyles.commentActions}>
          {currentUser && depth < maxDepth && (
            <TouchableOpacity
              onPress={() => setIsReplying(!isReplying)}
              style={dynamicStyles.actionButton}
            >
              <Text style={dynamicStyles.actionText}>Reply</Text>
            </TouchableOpacity>
          )}
          {canDelete && (
            <>
              <TouchableOpacity
                onPress={handleDeleteClick}
                style={dynamicStyles.actionButton}
              >
                <Text style={dynamicStyles.deleteText}>Delete</Text>
              </TouchableOpacity>
              {showDeleteConfirm && (
                <View style={dynamicStyles.confirmDialog}>
                  <Text style={dynamicStyles.confirmText}>
                    {isChirpAuthor && !isCommentAuthor
                      ? "Are you sure you want to delete this comment from your post?"
                      : "Are you sure you want to delete this comment?"}
                  </Text>
                  <View style={dynamicStyles.confirmActions}>
                    <TouchableOpacity
                      onPress={() => setShowDeleteConfirm(false)}
                      style={dynamicStyles.cancelConfirmButton}
                    >
                      <Text style={dynamicStyles.cancelConfirmText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleDeleteConfirm}
                      style={dynamicStyles.confirmButton}
                    >
                      <Text style={dynamicStyles.confirmButtonText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </>
          )}
          {(comment.replyCount ?? 0) > 0 && (
            <>
              <TouchableOpacity
                onPress={() => setIsCollapsed(!isCollapsed)}
                style={dynamicStyles.actionButton}
              >
                <Text style={dynamicStyles.actionText}>
                  {isCollapsed
                    ? `Show ${comment.replyCount} repl${comment.replyCount !== 1 ? 'ies' : 'y'}`
                    : `Hide repl${comment.replyCount !== 1 ? 'ies' : 'y'}`}
                </Text>
              </TouchableOpacity>
              <Text style={dynamicStyles.replyCount}>
                {comment.replyCount} repl{comment.replyCount !== 1 ? 'ies' : 'y'}
              </Text>
            </>
          )}
        </View>

        {/* Reply form */}
        {isReplying && currentUser && (
          <View style={dynamicStyles.replyForm}>
            <View style={dynamicStyles.replyHeader}>
              <View style={dynamicStyles.avatar}>
                {currentUser.profilePictureUrl ? (
                  <Image
                    source={{ uri: currentUser.profilePictureUrl }}
                    style={dynamicStyles.avatarImage}
                  />
                ) : (
                  <View style={dynamicStyles.avatarPlaceholder}>
                    <Text style={dynamicStyles.avatarText}>
                      {currentUser.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
              </View>
              <View style={dynamicStyles.replyEditor}>
                <CommentEditor
                  chirpId={chirpId}
                  parentCommentId={comment.id}
                  replyToUserId={comment.authorId}
                  replyToHandle={author.handle}
                  onSubmit={handleReplySubmit}
                  onCancel={() => setIsReplying(false)}
                  placeholder={`Reply to @${author.handle}...`}
                  autoFocus
                />
              </View>
            </View>
          </View>
        )}
      </View>

      {/* Nested replies */}
      {hasReplies && !isCollapsed && (
        <View style={dynamicStyles.repliesContainer}>
          {comment.replies.map((reply, index) => (
            <CommentItem
              key={`${reply.id}-${depth}-${index}`}
              comment={reply}
              chirpId={chirpId}
              chirpAuthorId={chirpAuthorId}
              depth={depth + 1}
              maxDepth={maxDepth}
            />
          ))}
        </View>
      )}
    </View>
  );
};

// Main Comment Section Component
const CommentSection: React.FC<CommentSectionProps> = ({ chirp, initialExpanded = false }) => {
  const { colors } = useTheme();
  const [isExpanded, setIsExpanded] = useState(initialExpanded);
  const getCommentTreeForChirp = useFeedStore((state) => state.getCommentTreeForChirp);
  const startCommentListener = useFeedStore((state) => state.startCommentListener);
  const commentTree = getCommentTreeForChirp(chirp.id);
  const listenerStartedRef = useRef<Set<string>>(new Set());
  const dynamicStyles = getSectionStyles(colors);

  // Sync with initialExpanded prop changes
  useEffect(() => {
    if (initialExpanded) {
      setIsExpanded(true);
    }
  }, [initialExpanded]);

  // Start comment listener when expanded and comments haven't been loaded yet
  useEffect(() => {
    if (isExpanded && chirp.commentCount > 0 && !listenerStartedRef.current.has(chirp.id)) {
      listenerStartedRef.current.add(chirp.id);
      try {
        // Start comment listener which will load and listen to comments
        startCommentListener(chirp.id);
      } catch (error) {
        console.error(`Error loading comments for chirp ${chirp.id}:`, error);
        listenerStartedRef.current.delete(chirp.id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chirp.id, chirp.commentCount, isExpanded]);

  return (
    <View style={dynamicStyles.container}>
      <TouchableOpacity
        onPress={() => setIsExpanded(!isExpanded)}
        style={dynamicStyles.toggleButton}
      >
        <Text style={dynamicStyles.toggleText}>
          {isExpanded ? 'Hide comments' : 'Show comments'}
        </Text>
        <Text style={dynamicStyles.arrowText}>{isExpanded ? '↑' : '↓'}</Text>
      </TouchableOpacity>

      {isExpanded && (
        <View style={dynamicStyles.expandedContainer}>
          {/* Comments tree */}
          {commentTree.length > 0 && (
            <View style={dynamicStyles.commentsList}>
              {commentTree.map((comment, index) => (
                <CommentItem
                  key={`${comment.id}-${index}`}
                  comment={comment}
                  chirpId={chirp.id}
                  chirpAuthorId={chirp.authorId}
                  depth={0}
                />
              ))}
            </View>
          )}

          {commentTree.length === 0 && (
            <View style={dynamicStyles.emptyContainer}>
              <Text style={dynamicStyles.emptyText}>
                No comments yet. Be the first to comment!
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

// Helper function to convert markdown to HTML (same as ComposerModal)
const markdownToHtml = (text: string): string => {
  const escapeHtml = (input: string): string =>
    input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  let html = escapeHtml(text);
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/_(.+?)_/g, '<em>$1</em>');
  html = html.replace(/\n/g, '<br />');
  html = linkifyMentions(html);
  return html;
};

const getSectionStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  container: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  toggleText: {
    fontSize: 14,
    color: colors.textMuted,
    marginRight: 4,
  },
  arrowText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  expandedContainer: {
    marginTop: 16,
  },
  commentsList: {
    gap: 8,
  },
  emptyContainer: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
});

const getEditorStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  editorContainer: {
    padding: 12,
    backgroundColor: colors.backgroundElevated,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  inputContainer: {
    position: 'relative',
  },
  input: {
    minHeight: 60,
    maxHeight: 150,
    backgroundColor: colors.backgroundElevated,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: colors.textPrimary,
    textAlignVertical: 'top',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  mentionDropdown: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    backgroundColor: colors.backgroundElevated,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    maxHeight: 200,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  mentionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  mentionAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 10,
  },
  mentionAvatarPlaceholder: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.accent + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  mentionAvatarText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
  },
  mentionInfo: {
    flex: 1,
    minWidth: 0,
  },
  mentionName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  mentionHandle: {
    fontSize: 11,
    color: colors.textMuted,
  },
  editorActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  cancelText: {
    color: colors.textMuted,
    fontWeight: '600',
  },
  submitButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.accent,
  },
  submitButtonDisabled: {
    backgroundColor: colors.border,
  },
  submitText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
});

const getCommentStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  commentCard: {
    backgroundColor: colors.backgroundElevated,
    borderRadius: 12,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    marginBottom: 8,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  authorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  avatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.accent + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  authorMeta: {
    marginLeft: 8,
    flex: 1,
  },
  authorName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  authorHandle: {
    fontSize: 12,
    color: colors.textMuted,
  },
  commentTime: {
    fontSize: 12,
    color: colors.textMuted,
  },
  commentText: {
    fontSize: 14,
    color: colors.textPrimary,
    lineHeight: 20,
    marginBottom: 8,
  },
  commentImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 8,
  },
  commentMeta: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  valueBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: colors.accent + '14',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.accent + '33',
  },
  valueText: {
    fontSize: 11,
    color: colors.accent,
    fontWeight: '600',
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: colors.border + '33',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  roleText: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  commentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  actionButton: {
    paddingVertical: 4,
  },
  actionText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
  },
  deleteText: {
    fontSize: 12,
    color: colors.error,
    fontWeight: '600',
  },
  replyCount: {
    fontSize: 12,
    color: colors.textMuted,
  },
  confirmDialog: {
    position: 'absolute',
    top: '100%',
    right: 0,
    backgroundColor: colors.backgroundElevated,
    borderRadius: 8,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    minWidth: 200,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  confirmText: {
    fontSize: 14,
    color: colors.textPrimary,
    marginBottom: 12,
  },
  confirmActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  cancelConfirmButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  cancelConfirmText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
  },
  confirmButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.error,
    borderRadius: 6,
  },
  confirmButtonText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  replyForm: {
    marginTop: 12,
  },
  replyHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  replyEditor: {
    flex: 1,
    marginLeft: 12,
  },
  replyLine: {
    position: 'absolute',
    left: -8,
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: colors.border,
  },
  repliesContainer: {
    marginTop: 8,
    marginLeft: 16,
  },
});

export default CommentSection;
