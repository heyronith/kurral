import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useUserStore } from '../store/useUserStore';
import { useFeedStore } from '../store/useFeedStore';
import { useThemeStore } from '../store/useThemeStore';
import { tuningService } from '../lib/services/tuningService';
import CommentSection from './CommentSection';
import FactCheckStatusPopup from './FactCheckStatusPopup';
import { ReplyIcon, RepeatIcon, BookmarkIcon, BookmarkFilledIcon, TrashIcon } from './Icon';
import ConfirmDialog from './ConfirmDialog';
import { sanitizeHTML } from '../lib/utils/sanitize';
const ChirpCard = ({ chirp }) => {
    const navigate = useNavigate();
    const { getUser, currentUser, followUser, unfollowUser, isFollowing, bookmarkChirp, unbookmarkChirp, isBookmarked } = useUserStore();
    const { addChirp, deleteChirp } = useFeedStore();
    const { theme } = useThemeStore();
    const author = getUser(chirp.authorId) ?? {
        id: chirp.authorId,
        name: 'Deleted User',
        handle: 'deleted',
        createdAt: new Date(0),
        following: [],
    };
    const isCurrentUser = currentUser?.id === chirp.authorId;
    const following = isFollowing(chirp.authorId);
    const bookmarked = isBookmarked(chirp.id);
    const [showReply, setShowReply] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showFactCheckPopup, setShowFactCheckPopup] = useState(false);
    const [showAllTags, setShowAllTags] = useState(false);
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
    const getReachLabel = () => {
        if (chirp.reachMode === 'forAll') {
            return 'Reach: For All';
        }
        if (chirp.tunedAudience) {
            const parts = [];
            if (chirp.tunedAudience.allowFollowers)
                parts.push('followers');
            if (chirp.tunedAudience.allowNonFollowers)
                parts.push('non-followers');
            return `Reach: Tuned (${parts.join(', ')})`;
        }
        return 'Reach: Tuned';
    };
    const sanitizedFormattedText = useMemo(() => {
        if (!chirp.formattedText) {
            return null;
        }
        return sanitizeHTML(chirp.formattedText);
    }, [chirp.formattedText]);
    // Render formatted HTML or plain text
    const renderFormattedText = () => {
        if (sanitizedFormattedText) {
            return (_jsx("div", { className: "text-textPrimary mb-2 leading-relaxed whitespace-pre-wrap", dangerouslySetInnerHTML: { __html: sanitizedFormattedText } }));
        }
        // Fallback to plain text
        return (_jsx("p", { className: "text-textPrimary mb-2 leading-relaxed whitespace-pre-wrap", children: chirp.text }));
    };
    const handleRechirp = async (e) => {
        e.stopPropagation();
        if (!currentUser)
            return;
        try {
            await addChirp({
                authorId: currentUser.id,
                text: chirp.text,
                topic: chirp.topic,
                reachMode: 'forAll',
                rechirpOfId: chirp.id,
                semanticTopics: chirp.semanticTopics?.length ? chirp.semanticTopics : undefined,
            });
        }
        catch (error) {
            console.error('Error rechirping:', error);
        }
    };
    const handleBookmark = async (e) => {
        e.stopPropagation();
        if (!currentUser || isCurrentUser)
            return;
        if (bookmarked) {
            await unbookmarkChirp(chirp.id);
        }
        else {
            await bookmarkChirp(chirp.id);
        }
    };
    const handleFollow = async () => {
        if (following) {
            await unfollowUser(chirp.authorId);
        }
        else {
            await followUser(chirp.authorId);
        }
    };
    // Track chirp view for tuning service
    useEffect(() => {
        if (currentUser && !isCurrentUser) {
            tuningService.trackChirpView(chirp.id);
        }
    }, [chirp.id, currentUser, isCurrentUser]);
    // Track engagement when user replies
    const handleReplyClick = (e) => {
        e.stopPropagation(); // Prevent navigation when clicking reply
        if (currentUser && !isCurrentUser) {
            tuningService.trackChirpEngagement(chirp.id);
        }
        setShowReply(!showReply);
    };
    const handleCardClick = () => {
        navigate(`/post/${chirp.id}`);
    };
    const handleDeleteClick = (e) => {
        e.stopPropagation();
        if (!currentUser || !isCurrentUser)
            return;
        setShowDeleteConfirm(true);
    };
    const handleDeleteConfirm = async () => {
        if (!currentUser || !isCurrentUser)
            return;
        try {
            await deleteChirp(chirp.id, currentUser.id);
            setShowDeleteConfirm(false);
        }
        catch (error) {
            console.error('Error deleting chirp:', error);
            setShowDeleteConfirm(false);
            alert('Failed to delete post. Please try again.');
        }
    };
    // Determine card styling based on fact check status
    const getCardStyling = () => {
        if (theme === 'dark') {
            // Dark theme: no background, no border (or very subtle for fact-checked posts)
            if (!chirp.factCheckStatus) {
                return 'bg-transparent border-0';
            }
            switch (chirp.factCheckStatus) {
                case 'clean':
                    return 'bg-transparent border-0';
                case 'needs_review':
                    return 'bg-transparent border-0';
                default:
                    return 'bg-transparent border-0';
            }
        }
        // Light theme: keep original styling
        if (!chirp.factCheckStatus) {
            return 'bg-blue-50/30 border-2 border-blue-100/60 shadow-card hover:shadow-cardHover';
        }
        switch (chirp.factCheckStatus) {
            case 'clean':
                return 'bg-green-50/50 border-2 border-green-200/60';
            case 'needs_review':
                return 'bg-yellow-50/50 border-2 border-yellow-200/60';
            default:
                return 'bg-red-50/50 border-2 border-red-200/60';
        }
    };
    return (_jsxs("div", { className: `mb-4 rounded-2xl ${getCardStyling()} p-6 ${theme === 'dark' ? '' : 'shadow-card hover:shadow-cardHover'} transition-all duration-300 group cursor-pointer relative ${theme === 'dark' ? 'text-white' : ''}`, onClick: handleCardClick, children: [chirp.factCheckStatus && (_jsx("button", { onClick: (e) => {
                    e.stopPropagation();
                    setShowFactCheckPopup(true);
                }, className: `absolute top-4 right-4 w-5 h-5 rounded-full flex items-center justify-center text-sm font-semibold transition-all hover:scale-110 cursor-pointer z-10 ${chirp.factCheckStatus === 'clean'
                    ? 'bg-green-500/20 text-green-600 hover:bg-green-500/30'
                    : chirp.factCheckStatus === 'needs_review'
                        ? 'bg-yellow-500/20 text-yellow-600 hover:bg-yellow-500/30'
                        : 'bg-red-500/20 text-red-600 hover:bg-red-500/30'}`, title: `Fact-check: ${chirp.factCheckStatus.replace('_', ' ')}`, children: chirp.factCheckStatus === 'clean'
                    ? '✓'
                    : chirp.factCheckStatus === 'needs_review'
                        ? '⚠'
                        : '✗' })), _jsx("div", { className: "flex gap-3", children: _jsxs("div", { className: "flex-1 min-w-0", children: [chirp.rechirpOfId && (_jsxs("div", { className: "text-xs text-textMuted mb-1.5 flex items-center gap-1.5", children: [_jsx("span", { className: "text-textMuted", children: "\u21BB" }), _jsxs("span", { children: ["Reposted by ", author.name] })] })), _jsxs("div", { className: "flex items-center gap-2 mb-2 flex-wrap", children: [_jsx(Link, { to: `/profile/${author.id}`, className: "flex-shrink-0", onClick: (e) => e.stopPropagation(), children: author.profilePictureUrl ? (_jsx("img", { src: author.profilePictureUrl, alt: author.name, className: `w-8 h-8 rounded-full object-cover ${theme === 'dark' ? 'border border-white/10' : 'border border-border/50'}` })) : (_jsx("div", { className: `w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center ${theme === 'dark' ? 'border border-white/10' : 'border border-border/50'}`, children: _jsx("span", { className: "text-primary font-semibold text-xs", children: author.name.charAt(0).toUpperCase() }) })) }), _jsx(Link, { to: `/profile/${author.id}`, className: `font-semibold text-sm ${theme === 'dark' ? 'text-white' : 'text-textPrimary'} hover:text-accent transition-colors duration-200`, onClick: (e) => e.stopPropagation(), children: author.name }), _jsxs(Link, { to: `/profile/${author.id}`, className: `${theme === 'dark' ? 'text-white/70' : 'text-textMuted'} text-xs hover:text-accent transition-colors duration-200`, onClick: (e) => e.stopPropagation(), children: ["@", author.handle] }), _jsx("span", { className: `${theme === 'dark' ? 'text-white/50' : 'text-textLabel'} text-xs`, children: "\u00B7" }), _jsx("span", { className: `${theme === 'dark' ? 'text-white/70' : 'text-textMuted'} text-xs`, children: formatTime(chirp.createdAt) }), _jsx("div", { className: "flex items-center gap-1.5 flex-wrap", children: _jsxs("div", { className: `px-2 py-0.5 ${theme === 'dark' ? 'bg-transparent border-0' : 'bg-backgroundElevated/60 border-border/50'} rounded ${theme === 'dark' ? '' : 'border'} flex items-center gap-1.5`, children: [_jsxs("span", { className: `text-xs ${theme === 'dark' ? 'text-white' : 'text-textPrimary'} font-semibold`, children: ["#", chirp.topic] }), chirp.semanticTopics && chirp.semanticTopics.length > 0 && (_jsx(_Fragment, { children: showAllTags ? (_jsxs(_Fragment, { children: [chirp.semanticTopics.map((tag, idx) => (_jsxs("span", { className: `text-xs ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`, children: ["#", tag] }, idx))), chirp.semanticTopics.length > 1 && (_jsx("button", { onClick: (e) => {
                                                                e.stopPropagation();
                                                                setShowAllTags(false);
                                                            }, className: `text-xs ${theme === 'dark' ? 'text-white/70 hover:text-white' : 'text-textMuted hover:text-textPrimary'} transition-colors`, children: "\u2212" }))] })) : (_jsxs("button", { onClick: (e) => {
                                                        e.stopPropagation();
                                                        setShowAllTags(true);
                                                    }, className: `text-xs ${theme === 'dark' ? 'text-white/70 hover:text-white' : 'text-textMuted hover:text-textPrimary'} transition-colors`, children: ["+", chirp.semanticTopics.length] })) }))] }) }), _jsx("span", { className: `text-xs ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'} px-2 py-0.5 ${theme === 'dark' ? 'bg-transparent border-0' : 'bg-backgroundElevated/60 border-border/50'} rounded ${theme === 'dark' ? '' : 'border'}`, children: getReachLabel() })] }), _jsx("div", { className: theme === 'dark' ? 'text-white' : '', children: renderFormattedText() }), chirp.imageUrl && (_jsx("div", { className: `mb-4 rounded-xl overflow-hidden ${theme === 'dark' ? 'border-0' : 'border border-border/40 shadow-subtle'}`, children: _jsx("img", { src: chirp.imageUrl, alt: "Post attachment", className: "w-full max-h-96 object-cover", onError: (e) => {
                                    e.currentTarget.style.display = 'none';
                                } }) })), chirp.scheduledAt && chirp.scheduledAt > new Date() && (_jsxs("div", { className: `mb-2 text-xs ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'} flex items-center gap-1.5 px-2 py-0.5 ${theme === 'dark' ? 'bg-primary/10 rounded border-0' : 'bg-primary/10 rounded border border-primary/20'}`, children: [_jsx("span", { children: "\uD83D\uDCC5" }), _jsxs("span", { children: ["Scheduled for ", chirp.scheduledAt.toLocaleString()] })] })), (chirp.valueScore || chirp.factCheckStatus || (chirp.claims && chirp.claims.length > 0)) && (_jsxs("div", { className: "mb-2 flex flex-wrap items-center gap-2 text-xs", children: [chirp.valueScore && isCurrentUser && (_jsxs("div", { className: `px-2 py-1 bg-accent/10 text-accent rounded ${theme === 'dark' ? 'border-0' : 'border border-accent/20'} flex items-center gap-1`, children: [_jsx("span", { children: "\u2B50" }), _jsx("span", { className: "font-semibold", children: (chirp.valueScore.total * 100).toFixed(0) }), _jsx("span", { className: "text-accent/80", children: "value" })] })), chirp.claims && chirp.claims.length > 0 && (_jsxs("div", { className: `px-2 py-1 ${theme === 'dark' ? 'bg-transparent text-white/70 border-0' : 'bg-backgroundElevated/60 text-textMuted border border-border/50'} rounded flex items-center gap-1`, children: [_jsx("span", { children: "\uD83D\uDCCB" }), _jsxs("span", { children: [chirp.claims.length, " claim", chirp.claims.length !== 1 ? 's' : ''] })] }))] })), _jsxs("div", { className: `flex flex-wrap items-center gap-4 text-xs relative pt-4 mt-4 ${theme === 'dark' ? 'border-t border-white/10' : 'border-t border-border/40'}`, children: [!isCurrentUser && (_jsx("button", { onClick: (e) => {
                                        e.stopPropagation();
                                        handleFollow();
                                    }, className: `px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 ${following
                                        ? theme === 'dark'
                                            ? 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white border-0'
                                            : 'bg-backgroundElevated/80 text-textMuted hover:bg-backgroundHover hover:text-textSecondary border border-border/60 shadow-subtle'
                                        : 'bg-accent text-white hover:bg-accentHover active:scale-95 border border-accent/30 shadow-button hover:shadow-buttonHover'}`, "aria-label": following ? `Unfollow ${author.name}` : `Follow ${author.name}`, children: following ? 'Following' : 'Follow' })), _jsxs("button", { onClick: handleReplyClick, className: `flex items-center gap-2 px-3 py-2 ${theme === 'dark' ? 'text-white/70 hover:text-white hover:bg-white/10' : 'text-textMuted hover:text-accent hover:bg-backgroundElevated/60'} rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-accent/30 active:scale-95`, "aria-label": `Reply to ${author.name}'s chirp`, children: [_jsx(ReplyIcon, { size: 16 }), chirp.commentCount > 0 && (_jsx("span", { className: "text-xs", children: chirp.commentCount }))] }), _jsx("button", { onClick: handleRechirp, className: `flex items-center gap-2 px-3 py-2 ${theme === 'dark' ? 'text-white/70 hover:text-white hover:bg-white/10' : 'text-textMuted hover:text-accent hover:bg-backgroundElevated/60'} rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-accent/30 active:scale-95`, "aria-label": `Repost ${author.name}'s post`, children: _jsx(RepeatIcon, { size: 16 }) }), !isCurrentUser && (_jsx("button", { onClick: handleBookmark, className: `flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-accent/30 active:scale-95 ${theme === 'dark'
                                        ? bookmarked
                                            ? 'text-accent hover:text-accent/80 hover:bg-white/10'
                                            : 'text-white/70 hover:text-white hover:bg-white/10'
                                        : bookmarked
                                            ? 'text-accent hover:text-accent/80 hover:bg-backgroundElevated/60'
                                            : 'text-textMuted hover:text-accent hover:bg-backgroundElevated/60'}`, "aria-label": bookmarked ? `Remove bookmark` : `Bookmark ${author.name}'s post`, children: bookmarked ? _jsx(BookmarkFilledIcon, { size: 16 }) : _jsx(BookmarkIcon, { size: 16 }) })), isCurrentUser && (_jsx("button", { onClick: handleDeleteClick, className: `flex items-center gap-2 px-3 py-2 ${theme === 'dark' ? 'text-white/70 hover:text-red-400 hover:bg-white/10' : 'text-textMuted hover:text-red-500 hover:bg-backgroundElevated/60'} rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-500/30 active:scale-95`, "aria-label": "Delete your post", children: _jsx(TrashIcon, { size: 16 }) }))] }), showReply && (_jsx("div", { onClick: (e) => e.stopPropagation(), children: _jsx(CommentSection, { chirp: chirp, initialExpanded: true }) }))] }) }), _jsx(ConfirmDialog, { isOpen: showDeleteConfirm, title: "Delete Post", message: "Are you sure you want to delete this post? This action cannot be undone.", confirmText: "Delete", cancelText: "Cancel", confirmVariant: "danger", onConfirm: handleDeleteConfirm, onCancel: () => setShowDeleteConfirm(false) }), _jsx(FactCheckStatusPopup, { open: showFactCheckPopup, onClose: () => setShowFactCheckPopup(false), chirp: chirp })] }));
};
export default ChirpCard;
