import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useUserStore } from '../store/useUserStore';
import { useFeedStore } from '../store/useFeedStore';
import { useThemeStore } from '../store/useThemeStore';
import { useComposer } from '../context/ComposerContext';
import { tuningService } from '../lib/services/tuningService';
import { chirpService } from '../lib/firestore';
import CommentSection from './CommentSection';
import FactCheckStatusPopup from './FactCheckStatusPopup';
import { ReplyIcon, RepeatIcon, BookmarkIcon, BookmarkFilledIcon, TrashIcon, ComposeIcon } from './Icon';
import ConfirmDialog from './ConfirmDialog';
import { sanitizeHTML } from '../lib/utils/sanitize';
import { linkifyMentions } from '../lib/utils/mentions';
const ChirpCard = ({ chirp }) => {
    const navigate = useNavigate();
    const { getUser, currentUser, followUser, unfollowUser, isFollowing, bookmarkChirp, unbookmarkChirp, isBookmarked } = useUserStore();
    const { addChirp, deleteChirp } = useFeedStore();
    const { theme } = useThemeStore();
    const { openComposerWithQuote } = useComposer();
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
    const [showRepostMenu, setShowRepostMenu] = useState(false);
    const [quotedChirp, setQuotedChirp] = useState(null);
    const repostMenuRef = useRef(null);
    // Fetch quoted chirp if needed
    useEffect(() => {
        if (chirp.quotedChirpId && !quotedChirp) {
            chirpService.getChirp(chirp.quotedChirpId).then(fetchedChirp => {
                if (fetchedChirp)
                    setQuotedChirp(fetchedChirp);
            });
        }
    }, [chirp.quotedChirpId, quotedChirp]);
    // Close repost menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (repostMenuRef.current && !repostMenuRef.current.contains(event.target)) {
                setShowRepostMenu(false);
            }
        };
        if (showRepostMenu) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => {
                document.removeEventListener('mousedown', handleClickOutside);
            };
        }
    }, [showRepostMenu]);
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
        if (chirp.formattedText) {
            return sanitizeHTML(linkifyMentions(chirp.formattedText));
        }
        return sanitizeHTML(linkifyMentions(chirp.text));
    }, [chirp.formattedText, chirp.text]);
    // Render formatted HTML or plain text
    const renderFormattedText = () => {
        const textColorClass = theme === 'dark' ? 'text-darkTextPrimary' : 'text-textPrimary';
        return (_jsx("div", { className: `${textColorClass} mb-2 leading-relaxed whitespace-pre-wrap`, dangerouslySetInnerHTML: { __html: sanitizedFormattedText } }));
    };
    const handleRechirp = async (e) => {
        e.stopPropagation();
        setShowRepostMenu(false);
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
    const handleQuoteRepost = (e) => {
        e.stopPropagation();
        setShowRepostMenu(false);
        openComposerWithQuote(chirp);
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
        navigate(`/app/post/${chirp.id}`);
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
    // Always returns a rounded border container with fact-check-based colors
    const getCardStyling = () => {
        // Base styling: rounded container with padding
        const baseClasses = 'rounded-xl p-4';
        // Determine border color based on fact check status
        let borderColor;
        let bgColor;
        if (theme === 'dark') {
            // Dark theme styling
            if (!chirp.factCheckStatus) {
                borderColor = 'border-darkBorder';
                bgColor = 'bg-darkBgElevated/30';
            }
            else {
                switch (chirp.factCheckStatus) {
                    case 'clean':
                        borderColor = 'border-green-500/40';
                        bgColor = 'bg-darkBgElevated/30';
                        break;
                    case 'needs_review':
                        borderColor = 'border-yellow-500/40';
                        bgColor = 'bg-darkBgElevated/30';
                        break;
                    default: // blocked
                        borderColor = 'border-red-500/40';
                        bgColor = 'bg-darkBgElevated/30';
                        break;
                }
            }
        }
        else {
            // Light theme styling
            if (!chirp.factCheckStatus) {
                borderColor = 'border-border';
                bgColor = 'bg-backgroundElevated';
            }
            else {
                switch (chirp.factCheckStatus) {
                    case 'clean':
                        borderColor = 'border-green-500/50';
                        bgColor = 'bg-backgroundElevated';
                        break;
                    case 'needs_review':
                        borderColor = 'border-yellow-500/50';
                        bgColor = 'bg-backgroundElevated';
                        break;
                    default: // blocked
                        borderColor = 'border-red-500/50';
                        bgColor = 'bg-backgroundElevated';
                        break;
                }
            }
        }
        return `${baseClasses} border ${borderColor} ${bgColor}`;
    };
    return (_jsxs("div", { className: `${getCardStyling()} transition-all duration-300 group cursor-pointer relative ${theme === 'dark' ? 'text-darkTextPrimary' : 'text-textPrimary'}`, onClick: handleCardClick, children: [chirp.factCheckStatus && (_jsx("button", { onClick: (e) => {
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
                        : '✗' })), _jsx("div", { className: "flex gap-3", children: _jsxs("div", { className: "flex-1 min-w-0", children: [chirp.rechirpOfId && (_jsxs("div", { className: `text-xs mb-1.5 flex items-center gap-1.5 ${theme === 'dark' ? 'text-darkTextMuted' : 'text-textMuted'}`, children: [_jsx("span", { children: "\u21BB" }), _jsxs("span", { children: ["Reposted by ", author.name] })] })), _jsxs("div", { className: "flex items-center gap-2 mb-2 flex-wrap", children: [_jsx(Link, { to: `/profile/${author.id}`, className: "flex-shrink-0", onClick: (e) => e.stopPropagation(), children: author.profilePictureUrl ? (_jsx("img", { src: author.profilePictureUrl, alt: author.name, className: `w-8 h-8 rounded-full object-cover ${theme === 'dark' ? 'border border-white/10' : ''}` })) : (_jsx("div", { className: `w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center ${theme === 'dark' ? 'border border-white/10' : ''}`, children: _jsx("span", { className: "text-primary font-semibold text-xs", children: author.name.charAt(0).toUpperCase() }) })) }), _jsx(Link, { to: `/profile/${author.id}`, className: `font-semibold text-sm hover:text-accent transition-colors duration-200 ${theme === 'dark' ? 'text-darkTextPrimary' : 'text-textPrimary'}`, onClick: (e) => e.stopPropagation(), children: author.name }), _jsxs(Link, { to: `/profile/${author.id}`, className: `text-xs hover:text-accent transition-colors duration-200 ${theme === 'dark' ? 'text-darkTextMuted' : 'text-textMuted'}`, onClick: (e) => e.stopPropagation(), children: ["@", author.handle] }), _jsx("span", { className: `text-xs ${theme === 'dark' ? 'text-darkTextLabel' : 'text-textLabel'}`, children: "\u00B7" }), _jsx("span", { className: `text-xs ${theme === 'dark' ? 'text-darkTextMuted' : 'text-textMuted'}`, children: formatTime(chirp.createdAt) }), _jsx("div", { className: "flex items-center gap-1.5 flex-wrap", children: _jsxs("div", { className: `flex items-center gap-1.5 ${theme === 'dark' ? 'px-2 py-0.5 rounded bg-white/5' : ''}`, children: [_jsxs("span", { className: `text-xs font-semibold ${theme === 'dark' ? 'text-darkTextPrimary' : 'text-textPrimary'}`, children: ["#", chirp.topic] }), chirp.semanticTopics && chirp.semanticTopics.length > 0 && (_jsx(_Fragment, { children: showAllTags ? (_jsxs(_Fragment, { children: [chirp.semanticTopics.map((tag, idx) => (_jsxs("span", { className: `text-xs ${theme === 'dark' ? 'text-darkTextPrimary' : 'text-textPrimary'}`, children: ["#", tag] }, idx))), chirp.semanticTopics.length > 1 && (_jsx("button", { onClick: (e) => {
                                                                e.stopPropagation();
                                                                setShowAllTags(false);
                                                            }, className: `text-xs transition-colors ${theme === 'dark' ? 'text-darkTextMuted hover:text-darkTextPrimary' : 'text-textMuted hover:text-textPrimary'}`, children: "\u2212" }))] })) : (_jsxs("button", { onClick: (e) => {
                                                        e.stopPropagation();
                                                        setShowAllTags(true);
                                                    }, className: `text-xs transition-colors ${theme === 'dark' ? 'text-darkTextMuted hover:text-darkTextPrimary' : 'text-textMuted hover:text-textPrimary'}`, children: ["+", chirp.semanticTopics.length] })) }))] }) }), _jsx("span", { className: `text-xs ${theme === 'dark' ? 'px-2 py-0.5 rounded text-darkTextMuted bg-white/5' : 'text-textMuted'}`, children: getReachLabel() })] }), renderFormattedText(), chirp.quotedChirpId && quotedChirp && (_jsxs("div", { className: `mt-2 mb-3 rounded-xl border p-3 cursor-pointer hover:bg-opacity-80 transition-colors ${theme === 'dark' ? 'border-white/10 bg-white/5' : 'border-border/60 bg-backgroundElevated/30'}`, onClick: (e) => {
                                e.stopPropagation();
                                navigate(`/app/post/${quotedChirp.id}`);
                            }, children: [_jsxs("div", { className: "flex items-center gap-2 mb-2", children: [getUser(quotedChirp.authorId)?.profilePictureUrl ? (_jsx("img", { src: getUser(quotedChirp.authorId)?.profilePictureUrl, alt: getUser(quotedChirp.authorId)?.name || 'User', className: "w-5 h-5 rounded-full object-cover" })) : (_jsx("div", { className: `w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center`, children: _jsx("span", { className: "text-primary font-bold text-[10px]", children: (getUser(quotedChirp.authorId)?.name || 'U').charAt(0).toUpperCase() }) })), _jsxs("div", { className: "flex items-center gap-1 overflow-hidden", children: [_jsx("span", { className: `text-sm font-semibold truncate ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`, children: getUser(quotedChirp.authorId)?.name || 'Unknown User' }), _jsxs("span", { className: `text-xs truncate ${theme === 'dark' ? 'text-white/50' : 'text-textMuted'}`, children: ["@", getUser(quotedChirp.authorId)?.handle || 'unknown'] }), _jsx("span", { className: `text-xs ${theme === 'dark' ? 'text-white/30' : 'text-textMuted'}`, children: "\u00B7" }), _jsx("span", { className: `text-xs ${theme === 'dark' ? 'text-white/50' : 'text-textMuted'}`, children: formatTime(quotedChirp.createdAt) })] })] }), _jsx("p", { className: `text-sm line-clamp-3 ${theme === 'dark' ? 'text-white/90' : 'text-textSecondary'}`, children: quotedChirp.text }), quotedChirp.imageUrl && (_jsx("div", { className: "mt-2 rounded-lg overflow-hidden h-32 relative", children: _jsx("img", { src: quotedChirp.imageUrl, alt: "Quoted content", className: "w-full h-full object-cover" }) }))] })), chirp.imageUrl && (_jsx("div", { className: `mb-4 rounded-xl overflow-hidden ${theme === 'dark' ? 'bg-black/20' : 'bg-gray-50'} aspect-square flex items-center justify-center`, children: _jsx("img", { src: chirp.imageUrl, alt: "Post attachment", className: "w-full h-full object-contain", onError: (e) => {
                                    e.currentTarget.style.display = 'none';
                                } }) })), chirp.scheduledAt && chirp.scheduledAt > new Date() && (_jsxs("div", { className: `mb-2 text-xs flex items-center gap-1.5 ${theme === 'dark' ? 'px-2 py-0.5 rounded text-darkTextMuted bg-primary/10' : 'text-textMuted'}`, children: [_jsx("span", { children: "\uD83D\uDCC5" }), _jsxs("span", { children: ["Scheduled for ", chirp.scheduledAt.toLocaleString()] })] })), (chirp.valueScore || chirp.factCheckStatus || (chirp.claims && chirp.claims.length > 0)) && (_jsxs("div", { className: "mb-2 flex flex-wrap items-center gap-2 text-xs", children: [chirp.valueScore && isCurrentUser && (_jsxs("div", { className: `flex items-center gap-1 ${theme === 'dark' ? 'px-2 py-1 bg-accent/10 text-accent rounded' : 'text-accent'}`, children: [_jsx("span", { children: "\u2B50" }), _jsx("span", { className: "font-semibold", children: (chirp.valueScore.total * 100).toFixed(0) }), _jsx("span", { className: theme === 'dark' ? 'text-accent/80' : 'text-accent/70', children: "value" })] })), chirp.claims && chirp.claims.length > 0 && (_jsxs("div", { className: `flex items-center gap-1 ${theme === 'dark' ? 'px-2 py-1 rounded bg-white/5 text-darkTextMuted' : 'text-textMuted'}`, children: [_jsx("span", { children: "\uD83D\uDCCB" }), _jsxs("span", { children: [chirp.claims.length, " claim", chirp.claims.length !== 1 ? 's' : ''] })] }))] })), _jsxs("div", { className: `flex flex-wrap items-center gap-4 text-xs relative pt-4 mt-4 ${theme === 'dark' ? 'border-t border-white/10' : ''}`, children: [!isCurrentUser && (_jsx("button", { onClick: (e) => {
                                        e.stopPropagation();
                                        handleFollow();
                                    }, className: `px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 ${following
                                        ? theme === 'dark'
                                            ? 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white border-0'
                                            : 'text-textMuted hover:text-textPrimary'
                                        : 'bg-accent text-white hover:bg-accentHover active:scale-95 shadow-sm hover:shadow-md'}`, "aria-label": following ? `Unfollow ${author.name}` : `Follow ${author.name}`, children: following ? 'Following' : 'Follow' })), _jsxs("button", { onClick: handleReplyClick, className: `flex items-center gap-2 px-3 py-2 ${theme === 'dark' ? 'text-white/70 hover:text-white hover:bg-white/10' : 'text-textMuted hover:text-accent hover:bg-backgroundElevated/60'} rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-accent/30 active:scale-95`, "aria-label": `Reply to ${author.name}'s chirp`, children: [_jsx(ReplyIcon, { size: 16 }), chirp.commentCount > 0 && (_jsx("span", { className: "text-xs", children: chirp.commentCount }))] }), _jsxs("div", { className: "relative", ref: repostMenuRef, children: [_jsx("button", { onClick: (e) => {
                                                e.stopPropagation();
                                                setShowRepostMenu(!showRepostMenu);
                                            }, className: `flex items-center gap-2 px-3 py-2 ${theme === 'dark' ? 'text-white/70 hover:text-white hover:bg-white/10' : 'text-textMuted hover:text-accent hover:bg-backgroundElevated/60'} rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-accent/30 active:scale-95 ${showRepostMenu ? 'text-accent' : ''}`, "aria-label": `Repost ${author.name}'s post`, children: _jsx(RepeatIcon, { size: 16 }) }), showRepostMenu && (_jsxs("div", { className: `absolute bottom-full right-0 mb-2 z-50 min-w-[160px] overflow-hidden rounded-xl border shadow-xl backdrop-blur-xl transition-all duration-200 ${theme === 'dark' ? 'bg-black/90 border-white/20 text-white' : 'bg-white/95 border-border/60 text-textPrimary'}`, children: [_jsxs("button", { onClick: handleRechirp, className: `w-full px-4 py-3 text-left text-sm font-medium flex items-center gap-3 transition-colors ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-backgroundElevated/70'}`, children: [_jsx(RepeatIcon, { size: 16 }), _jsx("span", { children: "Just repost" })] }), _jsx("div", { className: `h-px ${theme === 'dark' ? 'bg-white/10' : 'bg-border/40'}` }), _jsxs("button", { onClick: handleQuoteRepost, className: `w-full px-4 py-3 text-left text-sm font-medium flex items-center gap-3 transition-colors ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-backgroundElevated/70'}`, children: [_jsx(ComposeIcon, { size: 16 }), _jsx("span", { children: "Add thoughts" })] })] }))] }), !isCurrentUser && (_jsx("button", { onClick: handleBookmark, className: `flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-accent/30 active:scale-95 ${theme === 'dark'
                                        ? bookmarked
                                            ? 'text-accent hover:text-accent/80 hover:bg-white/10'
                                            : 'text-white/70 hover:text-white hover:bg-white/10'
                                        : bookmarked
                                            ? 'text-accent hover:text-accent/80 hover:bg-backgroundElevated/60'
                                            : 'text-textMuted hover:text-accent hover:bg-backgroundElevated/60'}`, "aria-label": bookmarked ? `Remove bookmark` : `Bookmark ${author.name}'s post`, children: bookmarked ? _jsx(BookmarkFilledIcon, { size: 16 }) : _jsx(BookmarkIcon, { size: 16 }) })), isCurrentUser && (_jsx("button", { onClick: handleDeleteClick, className: `flex items-center gap-2 px-3 py-2 ${theme === 'dark' ? 'text-white/70 hover:text-red-400 hover:bg-white/10' : 'text-textMuted hover:text-red-500 hover:bg-backgroundElevated/60'} rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-500/30 active:scale-95`, "aria-label": "Delete your post", children: _jsx(TrashIcon, { size: 16 }) }))] }), showReply && (_jsx("div", { onClick: (e) => e.stopPropagation(), children: _jsx(CommentSection, { chirp: chirp, initialExpanded: true }) }))] }) }), _jsx(ConfirmDialog, { isOpen: showDeleteConfirm, title: "Delete Post", message: "Are you sure you want to delete this post? This action cannot be undone.", confirmText: "Delete", cancelText: "Cancel", confirmVariant: "danger", onConfirm: handleDeleteConfirm, onCancel: () => setShowDeleteConfirm(false) }), _jsx(FactCheckStatusPopup, { open: showFactCheckPopup, onClose: () => setShowFactCheckPopup(false), chirp: chirp })] }));
};
export default ChirpCard;
