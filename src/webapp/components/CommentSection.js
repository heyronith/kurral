import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useFeedStore } from '../store/useFeedStore';
import { useUserStore } from '../store/useUserStore';
import { tuningService } from '../lib/services/tuningService';
import { commentService, realtimeService } from '../lib/firestore';
import { TrashIcon } from './Icon';
import ConfirmDialog from './ConfirmDialog';
const CommentItem = ({ comment, chirpId, chirpAuthorId, depth, maxDepth = 5 }) => {
    const [isReplying, setIsReplying] = useState(false);
    const [replyText, setReplyText] = useState('');
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const { addComment, deleteComment } = useFeedStore();
    const { currentUser, getUser } = useUserStore();
    const replyToUser = comment.replyToUserId ? getUser(comment.replyToUserId) : null;
    const author = getUser(comment.authorId);
    const formatTime = (date) => {
        const minutesAgo = Math.floor((Date.now() - date.getTime()) / 60000);
        if (minutesAgo < 1)
            return 'now';
        if (minutesAgo < 60)
            return `${minutesAgo}m`;
        const hoursAgo = Math.floor(minutesAgo / 60);
        if (hoursAgo < 24)
            return `${hoursAgo}h`;
        const daysAgo = Math.floor(hoursAgo / 24);
        return `${daysAgo}d`;
    };
    const handleReplySubmit = async (e) => {
        e.preventDefault();
        if (!replyText.trim() || !currentUser || !author)
            return;
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
        }
        catch (error) {
            console.error('Error posting reply:', error);
        }
    };
    const handleDeleteClick = () => {
        if (!currentUser)
            return;
        // Allow delete if user is comment author OR chirp author
        if (currentUser.id !== comment.authorId && currentUser.id !== chirpAuthorId)
            return;
        setShowDeleteConfirm(true);
    };
    const handleDeleteConfirm = async () => {
        if (!currentUser)
            return;
        // Allow delete if user is comment author OR chirp author
        if (currentUser.id !== comment.authorId && currentUser.id !== chirpAuthorId)
            return;
        try {
            // Use current user's ID - security rules will verify permissions
            await deleteComment(comment.id, currentUser.id);
            setShowDeleteConfirm(false);
        }
        catch (error) {
            console.error('Error deleting comment:', error);
            setShowDeleteConfirm(false);
            alert('Failed to delete comment. Please try again.');
        }
    };
    const isCommentAuthor = currentUser?.id === comment.authorId;
    const isChirpAuthor = currentUser?.id === chirpAuthorId;
    const canDelete = isCommentAuthor || isChirpAuthor;
    if (!author)
        return null;
    const indentLevel = Math.min(depth, maxDepth);
    const indentPx = indentLevel * 24; // 24px per level
    const hasReplies = comment.replies.length > 0;
    return (_jsxs("div", { className: "relative", children: [depth > 0 && (_jsx("div", { className: "absolute left-0 top-0 bottom-0 w-0.5 bg-border/40", style: { left: `${indentPx - 12}px` } })), _jsxs("div", { className: "relative pl-4", style: { paddingLeft: `${indentPx}px` }, children: [_jsxs("div", { className: `rounded-lg p-3 transition-colors ${depth > 0
                            ? 'bg-background/30 border border-border/30'
                            : 'bg-transparent'}`, children: [_jsxs("div", { className: "flex items-start gap-2 mb-1.5", children: [_jsx("div", { className: "flex-shrink-0", children: author.profilePictureUrl ? (_jsx("img", { src: author.profilePictureUrl, alt: author.name, className: "w-8 h-8 rounded-full object-cover border border-border/50" })) : (_jsx("div", { className: "w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center border border-border/50", children: _jsx("span", { className: "text-primary font-semibold text-xs", children: author.name.charAt(0).toUpperCase() }) })) }), _jsx("div", { className: "flex-1 min-w-0", children: _jsxs("div", { className: "flex items-center gap-2 flex-wrap", children: [_jsx(Link, { to: `/profile/${author.id}`, className: "text-sm font-semibold text-textPrimary hover:text-primary transition-colors", children: author.name }), _jsxs(Link, { to: `/profile/${author.id}`, className: "text-xs text-textMuted hover:text-primary transition-colors", children: ["@", author.handle] }), _jsx("span", { className: "text-xs text-textMuted", children: "\u00B7" }), _jsx("span", { className: "text-xs text-textMuted", children: formatTime(comment.createdAt) })] }) })] }), _jsx("p", { className: "text-sm text-textPrimary whitespace-pre-wrap mb-2 leading-relaxed", children: comment.text }), (comment.valueContribution || comment.discussionRole) && (_jsxs("div", { className: "mb-2 flex flex-wrap items-center gap-2", children: [comment.valueContribution && (_jsxs("div", { className: "px-2 py-0.5 bg-accent/10 text-accent rounded border border-accent/20 text-xs flex items-center gap-1", children: [_jsx("span", { children: "\u2B50" }), _jsx("span", { className: "font-semibold", children: (comment.valueContribution.total * 100).toFixed(0) })] })), comment.discussionRole && (_jsx("div", { className: "px-2 py-0.5 bg-backgroundElevated/60 text-textMuted rounded border border-border/50 text-xs capitalize", children: comment.discussionRole }))] })), _jsxs("div", { className: "flex items-center gap-3 mt-2", children: [currentUser && depth < maxDepth && (_jsx("button", { onClick: () => setIsReplying(!isReplying), className: "text-xs text-textMuted hover:text-primary transition-colors font-medium", children: "Reply" })), canDelete && (_jsxs(_Fragment, { children: [_jsxs("button", { onClick: handleDeleteClick, className: "text-xs text-textMuted hover:text-red-500 transition-colors font-medium flex items-center gap-1", title: isChirpAuthor && !isCommentAuthor ? "Delete comment (as post author)" : "Delete your comment", children: [_jsx(TrashIcon, { size: 12 }), "Delete"] }), _jsx(ConfirmDialog, { isOpen: showDeleteConfirm, title: "Delete Comment", message: isChirpAuthor && !isCommentAuthor
                                                    ? "Are you sure you want to delete this comment from your post? This action cannot be undone."
                                                    : "Are you sure you want to delete this comment? This action cannot be undone.", confirmText: "Delete", cancelText: "Cancel", confirmVariant: "danger", onConfirm: handleDeleteConfirm, onCancel: () => setShowDeleteConfirm(false) })] })), (comment.replyCount ?? 0) > 0 && (_jsxs(_Fragment, { children: [_jsx("button", { onClick: () => setIsCollapsed(!isCollapsed), className: "text-xs text-textMuted hover:text-primary transition-colors font-medium", children: isCollapsed
                                                    ? `Show ${comment.replyCount} repl${comment.replyCount !== 1 ? 'ies' : 'y'}`
                                                    : `Hide repl${comment.replyCount !== 1 ? 'ies' : 'y'}` }), _jsxs("span", { className: "text-xs text-textMuted", children: [comment.replyCount, " repl", comment.replyCount !== 1 ? 'ies' : 'y'] })] }))] }), isReplying && currentUser && (_jsxs("form", { onSubmit: handleReplySubmit, className: "mt-3 space-y-2", children: [replyToUser && (_jsxs("div", { className: "mb-2 text-xs text-textMuted", children: [_jsx("span", { children: "Replying to " }), _jsxs(Link, { to: `/profile/${replyToUser.id}`, className: "text-primary hover:text-accent font-medium", children: ["@", replyToUser.handle] })] })), _jsxs("div", { className: "flex gap-3", children: [_jsx("div", { className: "flex-shrink-0", children: currentUser.profilePictureUrl ? (_jsx("img", { src: currentUser.profilePictureUrl, alt: currentUser.name, className: "w-8 h-8 rounded-full object-cover border border-border/50" })) : (_jsx("div", { className: "w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center border border-border/50", children: _jsx("span", { className: "text-primary font-semibold text-xs", children: currentUser.name.charAt(0).toUpperCase() }) })) }), _jsxs("div", { className: "flex-1", children: [_jsx("textarea", { value: replyText, onChange: (e) => setReplyText(e.target.value), placeholder: `Reply to @${author.handle}...`, className: "w-full bg-background/50 border border-border rounded-lg p-2.5 text-sm text-textPrimary placeholder-textMuted resize-none outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all", rows: 2, autoFocus: true }), _jsxs("div", { className: "flex items-center gap-2 justify-end mt-2", children: [_jsx("button", { type: "button", onClick: () => {
                                                                    setIsReplying(false);
                                                                    setReplyText('');
                                                                }, className: "px-3 py-1.5 text-xs rounded-lg transition-all duration-200 bg-background/50 text-textMuted hover:bg-backgroundHover", children: "Cancel" }), _jsx("button", { type: "submit", disabled: !replyText.trim(), className: `px-3 py-1.5 text-xs rounded-lg transition-all duration-200 ${replyText.trim()
                                                                    ? 'bg-primary text-white hover:bg-primary/90 active:scale-95'
                                                                    : 'bg-background/50 text-textMuted cursor-not-allowed'}`, children: "Reply" })] })] })] })] }))] }), hasReplies && !isCollapsed && (_jsx("div", { className: "mt-2 space-y-2", children: comment.replies.map((reply) => (_jsx(CommentItem, { comment: reply, chirpId: chirpId, chirpAuthorId: chirpAuthorId, depth: depth + 1, maxDepth: maxDepth }, reply.id))) }))] })] }));
};
const CommentSection = ({ chirp, initialExpanded = false }) => {
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
                }
                catch (error) {
                    console.error(`Error loading comments for chirp ${chirp.id}:`, error);
                }
            };
            loadChirpComments();
        }
    }, [chirp.id, chirp.commentCount, comments, loadComments]);
    // Count total comments (including nested)
    const totalCommentCount = commentTree.reduce((count, comment) => {
        const countReplies = (node) => {
            return 1 + node.replies.reduce((sum, reply) => sum + countReplies(reply), 0);
        };
        return count + countReplies(comment);
    }, 0);
    // Count top-level comments only
    const topLevelCount = commentTree.length;
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!commentText.trim() || !currentUser)
            return;
        try {
            await addComment({
                chirpId: chirp.id,
                authorId: currentUser.id,
                text: commentText.trim(),
            });
            tuningService.trackChirpEngagement(chirp.id);
            setCommentText('');
        }
        catch (error) {
            console.error('Error posting comment:', error);
        }
    };
    return (_jsxs("div", { className: "mt-3 pt-3 border-t border-border/60", children: [_jsxs("button", { onClick: () => setIsExpanded(!isExpanded), className: "text-sm text-textMuted hover:text-primary transition-colors mb-3 font-medium flex items-center gap-1", children: [_jsx("span", { children: isExpanded ? 'Hide comments' : 'Show comments' }), _jsx("span", { className: "text-xs", children: isExpanded ? '↑' : '↓' })] }), isExpanded && (_jsxs("div", { className: "space-y-4 transition-all duration-200", children: [currentUser && (_jsx("form", { onSubmit: handleSubmit, className: "space-y-2", children: _jsxs("div", { className: "flex gap-3", children: [_jsx("div", { className: "flex-shrink-0", children: currentUser.profilePictureUrl ? (_jsx("img", { src: currentUser.profilePictureUrl, alt: currentUser.name, className: "w-10 h-10 rounded-full object-cover border border-border/50" })) : (_jsx("div", { className: "w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center border border-border/50", children: _jsx("span", { className: "text-primary font-semibold text-sm", children: currentUser.name.charAt(0).toUpperCase() }) })) }), _jsxs("div", { className: "flex-1", children: [_jsx("textarea", { value: commentText, onChange: (e) => setCommentText(e.target.value), placeholder: "Write a comment...", className: "w-full bg-background/50 border border-border rounded-lg p-3 text-sm text-textPrimary placeholder-textMuted resize-none outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all", rows: 3, "aria-label": "Comment text", autoFocus: initialExpanded }), _jsx("div", { className: "flex justify-end mt-2", children: _jsx("button", { type: "submit", disabled: !commentText.trim(), className: `px-4 py-2 text-sm rounded-lg transition-all duration-200 ${commentText.trim()
                                                    ? 'bg-primary text-white hover:bg-primary/90 active:scale-95'
                                                    : 'bg-background/50 text-textMuted cursor-not-allowed'}`, children: "Post" }) })] })] }) })), commentTree.length > 0 && (_jsx("div", { className: "space-y-3", children: commentTree.map((comment) => (_jsx(CommentItem, { comment: comment, chirpId: chirp.id, chirpAuthorId: chirp.authorId, depth: 0 }, comment.id))) })), commentTree.length === 0 && (_jsx("div", { className: "text-center py-6 text-textMuted text-sm", children: "No comments yet. Be the first to comment!" }))] }))] }));
};
export default CommentSection;
