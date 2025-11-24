import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { Chirp, CommentTreeNode } from '../types';
import { useFeedStore } from '../store/useFeedStore';
import { useUserStore } from '../store/useUserStore';
import { tuningService } from '../lib/services/tuningService';
import { commentService, realtimeService } from '../lib/firestore';
import { TrashIcon } from './Icon';
import ConfirmDialog from './ConfirmDialog';

interface CommentSectionProps {
  chirp: Chirp;
  initialExpanded?: boolean; // If true, section starts expanded with form visible
}

interface CommentItemProps {
  comment: CommentTreeNode;
  chirpId: string;
  chirpAuthorId: string; // Add chirp author ID to check if current user can delete
  depth: number;
  maxDepth?: number;
}

const CommentItem = ({ comment, chirpId, chirpAuthorId, depth, maxDepth = 5 }: CommentItemProps) => {
  const [isReplying, setIsReplying] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { addComment, deleteComment } = useFeedStore();
  const { currentUser, getUser } = useUserStore();
  const replyToUser = comment.replyToUserId ? getUser(comment.replyToUserId) : null;
  const author = getUser(comment.authorId);

  const formatTime = (date: Date): string => {
    const minutesAgo = Math.floor((Date.now() - date.getTime()) / 60000);
    if (minutesAgo < 1) return 'now';
    if (minutesAgo < 60) return `${minutesAgo}m`;
    const hoursAgo = Math.floor(minutesAgo / 60);
    if (hoursAgo < 24) return `${hoursAgo}h`;
    const daysAgo = Math.floor(hoursAgo / 24);
    return `${daysAgo}d`;
  };

  const handleReplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !currentUser || !author) return;

    try {
      await addComment({
        chirpId,
        authorId: currentUser.id,
        text: replyText.trim(),
        parentCommentId: comment.id,
        replyToUserId: comment.authorId,
      });

      tuningService.trackChirpEngagement(chirpId);
      setReplyText('');
      setIsReplying(false);
    } catch (error) {
      console.error('Error posting reply:', error);
    }
  };

  const handleDeleteClick = () => {
    if (!currentUser) return;
    // Allow delete if user is comment author OR chirp author
    if (currentUser.id !== comment.authorId && currentUser.id !== chirpAuthorId) return;
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    if (!currentUser) return;
    // Allow delete if user is comment author OR chirp author
    if (currentUser.id !== comment.authorId && currentUser.id !== chirpAuthorId) return;
    
    try {
      // Use current user's ID - security rules will verify permissions
      await deleteComment(comment.id, currentUser.id);
      setShowDeleteConfirm(false);
    } catch (error) {
      console.error('Error deleting comment:', error);
      setShowDeleteConfirm(false);
      alert('Failed to delete comment. Please try again.');
    }
  };

  const isCommentAuthor = currentUser?.id === comment.authorId;
  const isChirpAuthor = currentUser?.id === chirpAuthorId;
  const canDelete = isCommentAuthor || isChirpAuthor;

  if (!author) return null;

  const indentLevel = Math.min(depth, maxDepth);
  const indentPx = indentLevel * 24; // 24px per level
  const hasReplies = comment.replies.length > 0;

  return (
    <div className="relative">
      {/* Visual connector line for nested replies */}
      {depth > 0 && (
        <div
          className="absolute left-0 top-0 bottom-0 w-0.5 bg-border/40"
          style={{ left: `${indentPx - 12}px` }}
        />
      )}

      <div
        className="relative pl-4"
        style={{ paddingLeft: `${indentPx}px` }}
      >
        <div
          className={`rounded-lg p-3 transition-colors ${
            depth > 0
              ? 'bg-background/30 border border-border/30'
              : 'bg-transparent'
          }`}
        >
          {/* Comment header with profile picture */}
          <div className="flex items-start gap-2 mb-1.5">
            {/* Profile picture */}
            <div className="flex-shrink-0">
              {author.profilePictureUrl ? (
                <img
                  src={author.profilePictureUrl}
                  alt={author.name}
                  className="w-8 h-8 rounded-full object-cover border border-border/50"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center border border-border/50">
                  <span className="text-primary font-semibold text-xs">
                    {author.name.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </div>
            {/* Name and handle */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Link
                  to={`/profile/${author.id}`}
                  className="text-sm font-semibold text-textPrimary hover:text-primary transition-colors"
                >
                  {author.name}
                </Link>
                <Link
                  to={`/profile/${author.id}`}
                  className="text-xs text-textMuted hover:text-primary transition-colors"
                >
                  @{author.handle}
                </Link>
                <span className="text-xs text-textMuted">·</span>
                <span className="text-xs text-textMuted">{formatTime(comment.createdAt)}</span>
              </div>
            </div>
          </div>

          {/* Comment text */}
          <p className="text-sm text-textPrimary whitespace-pre-wrap mb-2 leading-relaxed">
            {comment.text}
          </p>

          {/* Value Contribution & Discussion Role */}
          {(comment.valueContribution || comment.discussionRole) && (
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {comment.valueContribution && (
                <div className="px-2 py-0.5 bg-accent/10 text-accent rounded border border-accent/20 text-xs flex items-center gap-1">
                  <span>⭐</span>
                  <span className="font-semibold">{(comment.valueContribution.total * 100).toFixed(0)}</span>
                </div>
              )}
              {comment.discussionRole && (
                <div className="px-2 py-0.5 bg-backgroundElevated/60 text-textMuted rounded border border-border/50 text-xs capitalize">
                  {comment.discussionRole}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 mt-2">
            {currentUser && depth < maxDepth && (
              <button
                onClick={() => setIsReplying(!isReplying)}
                className="text-xs text-textMuted hover:text-primary transition-colors font-medium"
              >
                Reply
              </button>
            )}
            {canDelete && (
              <>
                <button
                  onClick={handleDeleteClick}
                  className="text-xs text-textMuted hover:text-red-500 transition-colors font-medium flex items-center gap-1"
                  title={isChirpAuthor && !isCommentAuthor ? "Delete comment (as post author)" : "Delete your comment"}
                >
                  <TrashIcon size={12} />
                  Delete
                </button>
                <ConfirmDialog
                  isOpen={showDeleteConfirm}
                  title="Delete Comment"
                  message={
                    isChirpAuthor && !isCommentAuthor
                      ? "Are you sure you want to delete this comment from your post? This action cannot be undone."
                      : "Are you sure you want to delete this comment? This action cannot be undone."
                  }
                  confirmText="Delete"
                  cancelText="Cancel"
                  confirmVariant="danger"
                  onConfirm={handleDeleteConfirm}
                  onCancel={() => setShowDeleteConfirm(false)}
                />
              </>
            )}
            {(comment.replyCount ?? 0) > 0 && (
              <>
                <button
                  onClick={() => setIsCollapsed(!isCollapsed)}
                  className="text-xs text-textMuted hover:text-primary transition-colors font-medium"
                >
                  {isCollapsed
                    ? `Show ${comment.replyCount} repl${comment.replyCount !== 1 ? 'ies' : 'y'}`
                    : `Hide repl${comment.replyCount !== 1 ? 'ies' : 'y'}`}
                </button>
                {/* Show accurate reply count */}
                <span className="text-xs text-textMuted">
                  {comment.replyCount} repl{comment.replyCount !== 1 ? 'ies' : 'y'}
                </span>
              </>
            )}
          </div>

          {/* Reply form */}
          {isReplying && currentUser && (
            <form onSubmit={handleReplySubmit} className="mt-3 space-y-2">
              {/* Replying to indicator - only shown when typing */}
              {replyToUser && (
                <div className="mb-2 text-xs text-textMuted">
                  <span>Replying to </span>
                  <Link
                    to={`/profile/${replyToUser.id}`}
                    className="text-primary hover:text-accent font-medium"
                  >
                    @{replyToUser.handle}
                  </Link>
                </div>
              )}
              <div className="flex gap-3">
                {/* Profile picture */}
                <div className="flex-shrink-0">
                  {currentUser.profilePictureUrl ? (
                    <img
                      src={currentUser.profilePictureUrl}
                      alt={currentUser.name}
                      className="w-8 h-8 rounded-full object-cover border border-border/50"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center border border-border/50">
                      <span className="text-primary font-semibold text-xs">
                        {currentUser.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
                {/* Reply input */}
                <div className="flex-1">
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder={`Reply to @${author.handle}...`}
                    className="w-full bg-background/50 border border-border rounded-lg p-2.5 text-sm text-textPrimary placeholder-textMuted resize-none outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all"
                    rows={2}
                    autoFocus
                  />
                  <div className="flex items-center gap-2 justify-end mt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsReplying(false);
                        setReplyText('');
                      }}
                      className="px-3 py-1.5 text-xs rounded-lg transition-all duration-200 bg-background/50 text-textMuted hover:bg-backgroundHover"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!replyText.trim()}
                      className={`px-3 py-1.5 text-xs rounded-lg transition-all duration-200 ${
                        replyText.trim()
                          ? 'bg-primary text-white hover:bg-primary/90 active:scale-95'
                          : 'bg-background/50 text-textMuted cursor-not-allowed'
                      }`}
                    >
                      Reply
                    </button>
                  </div>
                </div>
              </div>
            </form>
          )}
        </div>

        {/* Nested replies */}
        {hasReplies && !isCollapsed && (
          <div className="mt-2 space-y-2">
            {comment.replies.map((reply) => (
              <CommentItem
                key={reply.id}
                comment={reply}
                chirpId={chirpId}
                chirpAuthorId={chirpAuthorId}
                depth={depth + 1}
                maxDepth={maxDepth}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const CommentSection = ({ chirp, initialExpanded = false }: CommentSectionProps) => {
  const [isExpanded, setIsExpanded] = useState(initialExpanded);
  const [commentText, setCommentText] = useState('');
  const { addComment, getCommentTreeForChirp, loadComments, comments } = useFeedStore();
  const { currentUser } = useUserStore();
  const commentTree = getCommentTreeForChirp(chirp.id);
  const { getUser } = useUserStore();

  // Ensure comments are loaded if chirp has comments but they're not in store
  useEffect(() => {
    if (chirp.commentCount > 0 && (!comments[chirp.id] || comments[chirp.id].length === 0)) {
      const loadChirpComments = async () => {
        try {
          const chirpComments = await commentService.getCommentsForChirp(chirp.id);
          if (chirpComments.length > 0) {
            loadComments(chirp.id, chirpComments);
            
            // Set up real-time listener
            realtimeService.subscribeToComments(chirp.id, (comments) => {
              loadComments(chirp.id, comments);
            });
          }
        } catch (error) {
          console.error(`Error loading comments for chirp ${chirp.id}:`, error);
        }
      };
      loadChirpComments();
    }
  }, [chirp.id, chirp.commentCount, comments, loadComments]);

  // Count total comments (including nested)
  const totalCommentCount = commentTree.reduce((count, comment) => {
    const countReplies = (node: CommentTreeNode): number => {
      return 1 + node.replies.reduce((sum, reply) => sum + countReplies(reply), 0);
    };
    return count + countReplies(comment);
  }, 0);

  // Count top-level comments only
  const topLevelCount = commentTree.length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !currentUser) return;

    try {
      await addComment({
        chirpId: chirp.id,
        authorId: currentUser.id,
        text: commentText.trim(),
      });

      tuningService.trackChirpEngagement(chirp.id);
      setCommentText('');
    } catch (error) {
      console.error('Error posting comment:', error);
    }
  };

  return (
    <div className="mt-3 pt-3 border-t border-border/60">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="text-sm text-textMuted hover:text-primary transition-colors mb-3 font-medium flex items-center gap-1"
      >
        <span>{isExpanded ? 'Hide comments' : 'Show comments'}</span>
        <span className="text-xs">{isExpanded ? '↑' : '↓'}</span>
      </button>

      {isExpanded && (
        <div className="space-y-4 transition-all duration-200">
          {/* Top-level comment form */}
          {currentUser && (
            <form onSubmit={handleSubmit} className="space-y-2">
              <div className="flex gap-3">
                {/* Profile picture */}
                <div className="flex-shrink-0">
                  {currentUser.profilePictureUrl ? (
                    <img
                      src={currentUser.profilePictureUrl}
                      alt={currentUser.name}
                      className="w-10 h-10 rounded-full object-cover border border-border/50"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center border border-border/50">
                      <span className="text-primary font-semibold text-sm">
                        {currentUser.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
                {/* Comment input */}
                <div className="flex-1">
                  <textarea
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Write a comment..."
                    className="w-full bg-background/50 border border-border rounded-lg p-3 text-sm text-textPrimary placeholder-textMuted resize-none outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all"
                    rows={3}
                    aria-label="Comment text"
                    autoFocus={initialExpanded}
                  />
                  <div className="flex justify-end mt-2">
                    <button
                      type="submit"
                      disabled={!commentText.trim()}
                      className={`px-4 py-2 text-sm rounded-lg transition-all duration-200 ${
                        commentText.trim()
                          ? 'bg-primary text-white hover:bg-primary/90 active:scale-95'
                          : 'bg-background/50 text-textMuted cursor-not-allowed'
                      }`}
                    >
                      Post
                    </button>
                  </div>
                </div>
              </div>
            </form>
          )}

          {/* Comments tree */}
          {commentTree.length > 0 && (
            <div className="space-y-3">
              {commentTree.map((comment) => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  chirpId={chirp.id}
                  chirpAuthorId={chirp.authorId}
                  depth={0}
                />
              ))}
            </div>
          )}

          {commentTree.length === 0 && (
            <div className="text-center py-6 text-textMuted text-sm">
              No comments yet. Be the first to comment!
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CommentSection;
