import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import type { Chirp } from '../types';
import { useUserStore } from '../store/useUserStore';
import { useFeedStore } from '../store/useFeedStore';
import { useThemeStore } from '../store/useThemeStore';
import { useComposer } from '../context/ComposerContext';
import { tuningService } from '../lib/services/tuningService';
import { chirpService, commentService, realtimeService } from '../lib/firestore';
import CommentSection from './CommentSection';
import AppLayout from './AppLayout';
import ReviewContextModal from './ReviewContextModal';
import FactCheckStatusPopup from './FactCheckStatusPopup';
import { ReplyIcon, RepeatIcon, BookmarkIcon, BookmarkFilledIcon, ComposeIcon } from './Icon';
import { linkifyMentions } from '../lib/utils/mentions';
import { sanitizeHTML } from '../lib/utils/sanitize';

const PostDetailView = () => {
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();
  const { getUser, currentUser, followUser, unfollowUser, isFollowing, loadUser, bookmarkChirp, unbookmarkChirp, isBookmarked } = useUserStore();
  const { chirps, addChirp, loadChirps, loadComments } = useFeedStore();
  const { theme } = useThemeStore();
  const { openComposerWithQuote } = useComposer();
  const [chirp, setChirp] = useState<Chirp | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showReply, setShowReply] = useState(false);
  const [showReviewContextModal, setShowReviewContextModal] = useState(false);
  const [showFactCheckPopup, setShowFactCheckPopup] = useState(false);
  const [showAllTags, setShowAllTags] = useState(false);
  const [showRepostMenu, setShowRepostMenu] = useState(false);
  const repostMenuRef = useRef<HTMLDivElement>(null);
  const storedChirp = postId ? chirps.find((c) => c.id === postId) ?? null : null;

  // Load chirp data
  useEffect(() => {
    if (!postId) {
      setIsLoading(false);
      return;
    }

    const loadPost = async () => {
      try {
        // First check if chirp is already in store
        if (storedChirp) {
          setChirp(storedChirp);
          setIsLoading(false);
        } else {
          // Load from Firestore
          const loadedChirp = await chirpService.getChirp(postId);
          if (loadedChirp) {
            setChirp(loadedChirp);
            loadChirps([loadedChirp]);
            // Load author if not in store
            const author = getUser(loadedChirp.authorId);
            if (!author) {
              await loadUser(loadedChirp.authorId);
            }
          } else {
            // Chirp not found
            setChirp(null);
          }
          setIsLoading(false);
        }

        // Load comments for this chirp
        const comments = await commentService.getCommentsForChirp(postId);
        loadComments(postId, comments);

        // Set up real-time listener for comments
        realtimeService.subscribeToComments(postId, (comments) => {
          loadComments(postId, comments);
        });
      } catch (error) {
        console.error('Error loading post:', error);
        setIsLoading(false);
      }
    };

    loadPost();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  // Keep local chirp state in sync with store updates (e.g., new comments)
  // Also check if chirp becomes blocked while viewing
  useEffect(() => {
    if (storedChirp) {
      setChirp(storedChirp);
      // If chirp becomes blocked and user is not author, they should be redirected
      // This is handled in the render check below
    }
  }, [storedChirp]);

  // Track chirp view for tuning service
  useEffect(() => {
    if (currentUser && chirp && chirp.authorId !== currentUser.id) {
      tuningService.trackChirpView(chirp.id);
    }
  }, [chirp?.id, currentUser, chirp?.authorId]);

  // Close repost menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (repostMenuRef.current && !repostMenuRef.current.contains(event.target as Node)) {
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

  const formatTime = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h`;
    
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d`;
    
    // Format full date for older posts
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];
    const day = date.getDate();
    const year = date.getFullYear();
    const currentYear = now.getFullYear();
    
    if (year === currentYear) {
      return `${month} ${day}`;
    }
    return `${month} ${day}, ${year}`;
  };

  const formatFullTimestamp = (date: Date): string => {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes.toString().padStart(2, '0');
    
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];
    const day = date.getDate();
    const year = date.getFullYear();
    
    return `${displayHours}:${displayMinutes} ${ampm} • ${month} ${day}, ${year}`;
  };

  const getReachLabel = (): string => {
    if (!chirp) return '';
    if (chirp.reachMode === 'forAll') {
      return 'Reach: For All';
    }
    if (chirp.tunedAudience) {
      const parts: string[] = [];
      if (chirp.tunedAudience.allowFollowers) parts.push('followers');
      if (chirp.tunedAudience.allowNonFollowers) parts.push('non-followers');
      return `Reach: Tuned (${parts.join(', ')})`;
    }
    return 'Reach: Tuned';
  };

  const renderFormattedText = (): React.ReactNode => {
    if (!chirp) return null;
    
    const content = chirp.formattedText 
      ? sanitizeHTML(linkifyMentions(chirp.formattedText))
      : sanitizeHTML(linkifyMentions(chirp.text));

      return (
        <div
          className={`${theme === 'dark' ? 'text-white' : 'text-textPrimary'} mb-2 leading-relaxed whitespace-pre-wrap text-[15px]`}
        dangerouslySetInnerHTML={{ __html: content }}
        />
    );
  };

  const handleRechirp = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowRepostMenu(false);
    if (!currentUser || !chirp) return;

    try {
      await addChirp({
        authorId: currentUser.id,
        text: chirp.text,
        topic: chirp.topic,
        reachMode: 'forAll',
        rechirpOfId: chirp.id,
        semanticTopics: chirp.semanticTopics?.length ? chirp.semanticTopics : undefined,
      });
    } catch (error) {
      console.error('Error rechirping:', error);
    }
  };

  const handleQuoteRepost = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowRepostMenu(false);
    if (!chirp) return;
    openComposerWithQuote(chirp);
  };

  const handleFollow = async () => {
    if (!chirp) return;
    if (isFollowing(chirp.authorId)) {
      await unfollowUser(chirp.authorId);
    } else {
      await followUser(chirp.authorId);
    }
  };

  const handleReplyClick = () => {
    if (currentUser && chirp && chirp.authorId !== currentUser.id) {
      tuningService.trackChirpEngagement(chirp.id);
    }
    setShowReply(true);
  };

  const handleBookmark = async () => {
    if (!currentUser || !chirp || isCurrentUser) return;
    
    if (isBookmarked(chirp.id)) {
      await unbookmarkChirp(chirp.id);
    } else {
      await bookmarkChirp(chirp.id);
    }
  };

  if (isLoading) {
    return (
      <AppLayout wrapContent={false}>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-textMuted">Loading...</div>
        </div>
      </AppLayout>
    );
  }

  if (!chirp) {
    return (
      <AppLayout wrapContent={false}>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-textMuted">Post not found</div>
        </div>
      </AppLayout>
    );
  }

  const isAuthor = currentUser?.id === chirp.authorId;
  if (chirp.factCheckStatus === 'blocked' && !isAuthor) {
    return (
      <AppLayout wrapContent={false}>
        <div className={`min-h-screen flex items-center justify-center ${theme === 'dark' ? 'bg-black' : 'bg-background'}`}>
          <div className={`max-w-md p-8 rounded-2xl border ${theme === 'dark' ? 'border-white/10 bg-white/5' : 'border-border bg-backgroundElevated'} text-center`}>
            <p className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>Post unavailable</p>
            <p className={`mt-2 text-sm ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'}`}>
              This post was blocked by the fact-checking system and can only be viewed by the author on their profile.
            </p>
          </div>
        </div>
      </AppLayout>
    );
  }

  const author = getUser(chirp.authorId);
  if (!author) return null;

  const isCurrentUser = currentUser?.id === chirp.authorId;
  const following = isFollowing(chirp.authorId);
  const bookmarked = isBookmarked(chirp.id);

  return (
    <AppLayout wrapContent={false}>
      <div className={`min-h-screen ${theme === 'dark' ? 'bg-black' : 'bg-background'}`}>
        {/* Header - X-style */}
        <header className={`sticky top-0 z-30 ${theme === 'dark' ? 'border-b border-white/10 bg-black/95' : 'border-b border-border/60 bg-background/95'} backdrop-blur-lg px-4 py-3`}>
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate(-1)}
              className={`w-9 h-9 flex items-center justify-center rounded-full ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-backgroundElevated/60'} transition-colors`}
              aria-label="Back"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className={`w-5 h-5 ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}
              >
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>Post</h1>
            <div className="w-9 h-9" /> {/* Spacer for centering */}
          </div>
        </header>

        {/* Main Post */}
        <div className={`${theme === 'dark' ? 'border-b border-white/5' : 'border-b border-border/20'}`}>
          {chirp.rechirpOfId && (
            <div className="px-4 pt-3 pb-1">
              <div className={`text-xs ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'} flex items-center gap-1.5`}>
                <span className="text-accent">↻</span>
                <span>Reposted by {author.name}</span>
              </div>
            </div>
          )}

          <div className="px-4 pt-3 pb-4">
            {/* Author info */}
            <div className="flex items-start justify-between mb-3 relative">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <Link to={`/profile/${author.id}`} className="flex-shrink-0">
                  {author.profilePictureUrl ? (
                    <img
                      src={author.profilePictureUrl}
                      alt={author.name}
                      className={`w-12 h-12 rounded-full object-cover ${theme === 'dark' ? '' : 'border border-border/50'}`}
                    />
                  ) : (
                    <div className={`w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center ${theme === 'dark' ? '' : 'border border-border/50'}`}>
                      <span className="text-primary font-semibold text-base">
                        {author.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                </Link>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      to={`/profile/${author.id}`}
                      className={`font-bold text-[15px] ${theme === 'dark' ? 'text-white' : 'text-textPrimary'} hover:underline`}
                    >
                      {author.name}
                    </Link>
                    <Link
                      to={`/profile/${author.id}`}
                      className={`text-[15px] ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'} hover:underline`}
                    >
                      @{author.handle}
                    </Link>
                  </div>
                </div>
              </div>
              
              {/* Fact-check status icon - top right */}
              {chirp.factCheckStatus && (
                <button
                  onClick={() => setShowFactCheckPopup(true)}
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-base font-semibold transition-all hover:scale-110 cursor-pointer ${
                    chirp.factCheckStatus === 'clean'
                      ? 'bg-green-500/20 text-green-600 hover:bg-green-500/30'
                      : chirp.factCheckStatus === 'needs_review'
                      ? 'bg-yellow-500/20 text-yellow-600 hover:bg-yellow-500/30'
                      : 'bg-red-500/20 text-red-600 hover:bg-red-500/30'
                  }`}
                  title={`Fact-check: ${chirp.factCheckStatus.replace('_', ' ')}`}
                >
                  {chirp.factCheckStatus === 'clean'
                    ? '✓'
                    : chirp.factCheckStatus === 'needs_review'
                    ? '⚠'
                    : '✗'}
                </button>
              )}
            </div>

            {/* Post content */}
            <div className="mb-4">
              {renderFormattedText()}
            </div>

            {/* Image - 4:3 aspect ratio, full image visible */}
            {chirp.imageUrl && (
              <div className={`mb-4 rounded-2xl overflow-hidden ${theme === 'dark' ? 'bg-black/20 border-0' : 'bg-gray-50 border border-border/40'} aspect-[4/3] flex items-center justify-center`}>
                <img
                  src={chirp.imageUrl}
                  alt="Post attachment"
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
            )}

            {/* Timestamp and topic */}
            <div className={`mb-4 pb-4 ${theme === 'dark' ? 'border-b border-white/5' : 'border-b border-border/20'}`}>
              <div className={`text-[15px] ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'} mb-3`}>
                {formatFullTimestamp(chirp.createdAt)}
              </div>
              <div className="flex items-center gap-2 flex-wrap text-sm mb-3">
                <div className={`px-2 py-1 ${theme === 'dark' ? 'bg-transparent border-0' : 'bg-backgroundElevated/60 border-border/50'} rounded ${theme === 'dark' ? '' : 'border'} flex items-center gap-1.5`}>
                  <span className={`${theme === 'dark' ? 'text-white' : 'text-textPrimary'} font-semibold`}>
                    #{chirp.topic}
                  </span>
                  {chirp.semanticTopics && chirp.semanticTopics.length > 0 && (
                    <>
                      {showAllTags ? (
                        <>
                          {chirp.semanticTopics.map((tag, idx) => (
                            <span 
                              key={idx}
                              className={theme === 'dark' ? 'text-white' : 'text-textPrimary'}
                            >
                              #{tag}
                            </span>
                          ))}
                          {chirp.semanticTopics.length > 1 && (
                            <button
                              onClick={() => setShowAllTags(false)}
                              className={`${theme === 'dark' ? 'text-white/70 hover:text-white' : 'text-textMuted hover:text-textPrimary'} transition-colors`}
                            >
                              −
                            </button>
                          )}
                        </>
                      ) : (
                        <button
                          onClick={() => setShowAllTags(true)}
                          className={`${theme === 'dark' ? 'text-white/70 hover:text-white' : 'text-textMuted hover:text-textPrimary'} transition-colors`}
                        >
                          +{chirp.semanticTopics.length}
                        </button>
                      )}
                    </>
                  )}
                </div>
                <span className={`px-2 py-1 ${theme === 'dark' ? 'bg-transparent text-white/70 border-0' : 'bg-backgroundElevated/60 text-textMuted border-border/50'} rounded ${theme === 'dark' ? '' : 'border'}`}>
                  {getReachLabel()}
                </span>
              </div>

              {/* Value Score & Fact-Check Status */}
              {(chirp.valueScore || chirp.factCheckStatus) && (
                <div className="flex flex-wrap items-center gap-2 text-sm mb-3">
                  {chirp.valueScore && currentUser?.id === chirp.authorId && (
                    <div className={`px-3 py-1.5 bg-accent/10 text-accent rounded-lg ${theme === 'dark' ? 'border-0' : 'border border-accent/20'} flex items-center gap-2`}>
                      <span className="text-base">⭐</span>
                      <span className="font-semibold">Value: {(chirp.valueScore.total * 100).toFixed(0)}</span>
                      {chirp.valueExplanation && (
                        <span className="text-xs text-accent/80 ml-1">({chirp.valueExplanation.substring(0, 50)}...)</span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Claims & Fact Checks */}
              {chirp.claims && chirp.claims.length > 0 && (
                <div className="mt-4 space-y-3">
                  <h3 className={`text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'} mb-2`}>Claims & Verification</h3>
                  {chirp.claims.map((claim) => {
                    const factCheck = chirp.factChecks?.find((fc) => fc.claimId === claim.id);
                    return (
                      <div
                        key={claim.id}
                        className={`p-3 ${theme === 'dark' ? 'bg-transparent border-white/10' : 'bg-backgroundElevated/40 border-border/50'} rounded-lg border`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <p className={`text-sm ${theme === 'dark' ? 'text-white' : 'text-textPrimary'} flex-1`}>{claim.text}</p>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className={`text-xs px-2 py-0.5 ${theme === 'dark' ? 'bg-transparent text-white/70 border-white/10' : 'bg-backgroundElevated/60 text-textMuted border-border/50'} rounded border`}>
                              {claim.type}
                            </span>
                            <span className={`text-xs px-2 py-0.5 ${theme === 'dark' ? 'bg-transparent text-white/70 border-white/10' : 'bg-backgroundElevated/60 text-textMuted border-border/50'} rounded border`}>
                              {claim.domain}
                            </span>
                          </div>
                        </div>
                        {factCheck && (
                          <div className={`mt-2 pt-2 border-t ${theme === 'dark' ? 'border-white/10' : 'border-border/50'}`}>
                            <div className="flex items-center gap-2 mb-1">
                              <span
                                className={`text-xs font-semibold ${
                                  factCheck.verdict === 'true'
                                    ? 'text-green-600'
                                    : factCheck.verdict === 'false'
                                    ? 'text-red-600'
                                    : factCheck.verdict === 'mixed'
                                    ? 'text-yellow-600'
                                    : 'text-textMuted'
                                }`}
                              >
                                {factCheck.verdict.toUpperCase()}
                              </span>
                              <span className="text-xs text-textMuted">
                                ({(factCheck.confidence * 100).toFixed(0)}% confidence)
                              </span>
                            </div>
                            {factCheck.evidence && factCheck.evidence.length > 0 && (
                              <div className="mt-2 space-y-1">
                                {factCheck.evidence.slice(0, 2).map((evidence, idx) => (
                                  <div key={idx} className={`text-xs ${theme === 'dark' ? 'text-white/70 bg-transparent border-white/10' : 'text-textMuted bg-background/50 border-border/30'} p-2 rounded border`}>
                                    <div className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-textSecondary'} mb-0.5`}>{evidence.source}</div>
                                    <div className={theme === 'dark' ? 'text-white/70' : 'text-textMuted'}>{evidence.snippet.substring(0, 100)}...</div>
                                    {evidence.url && (
                                      <a
                                        href={evidence.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-accent hover:underline mt-1 inline-block"
                                      >
                                        View source →
                                      </a>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                            {factCheck.caveats && factCheck.caveats.length > 0 && (
                              <div className={`mt-2 text-xs ${theme === 'dark' ? 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' : 'text-yellow-600 bg-yellow-500/10 border-yellow-500/20'} p-2 rounded border`}>
                                <strong>Note:</strong> {factCheck.caveats.join(' ')}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Discussion Quality - Only visible to poster */}
              {chirp.discussionQuality && currentUser?.id === chirp.authorId && (
                <div className={`mt-4 p-3 ${theme === 'dark' ? 'bg-transparent border-white/10' : 'bg-backgroundElevated/40 border-border/50'} rounded-lg border`}>
                  <h3 className={`text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'} mb-2`}>Discussion Quality</h3>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className={theme === 'dark' ? 'text-white/70' : 'text-textMuted'}>Informativeness:</span>
                      <span className={`ml-2 font-semibold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>
                        {(chirp.discussionQuality.informativeness * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div>
                      <span className={theme === 'dark' ? 'text-white/70' : 'text-textMuted'}>Civility:</span>
                      <span className={`ml-2 font-semibold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>
                        {(chirp.discussionQuality.civility * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div>
                      <span className={theme === 'dark' ? 'text-white/70' : 'text-textMuted'}>Reasoning:</span>
                      <span className={`ml-2 font-semibold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>
                        {(chirp.discussionQuality.reasoningDepth * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div>
                      <span className={theme === 'dark' ? 'text-white/70' : 'text-textMuted'}>Cross-Perspective:</span>
                      <span className={`ml-2 font-semibold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>
                        {(chirp.discussionQuality.crossPerspective * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                  {chirp.discussionQuality.summary && (
                    <p className={`mt-2 text-xs ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'}`}>{chirp.discussionQuality.summary}</p>
                  )}
                </div>
              )}
            </div>

            {/* Engagement metrics */}
            <div className={`flex items-center gap-4 text-[15px] ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'} ${theme === 'dark' ? 'border-b border-white/5' : 'border-b border-border/20'} pb-4`}>
              <button
                onClick={handleReplyClick}
                className="hover:text-accent transition-colors"
              >
                <span className="font-semibold">{chirp.commentCount || 0}</span>
                <span className="ml-1">replies</span>
              </button>
              <div>
                <span className="font-semibold">0</span>
                <span className="ml-1">reposts</span>
              </div>
              <div>
                <span className="font-semibold">0</span>
                <span className="ml-1">bookmarks</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-4 pt-4">
              {!isCurrentUser && (
                <button
                  onClick={handleFollow}
                  className={`px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 ${
                    following
                      ? theme === 'dark' 
                        ? 'bg-white/10 text-white hover:bg-white/20 border-0'
                        : 'bg-backgroundElevated/80 text-textPrimary hover:bg-backgroundHover border border-border/60'
                      : 'bg-primary text-white hover:bg-primary/90 active:scale-95'
                  }`}
                >
                  {following ? 'Following' : 'Follow'}
                </button>
              )}
              <button
                onClick={handleReplyClick}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-[15px] ${theme === 'dark' ? 'text-white/70 hover:text-white hover:bg-white/10' : 'text-textMuted hover:text-primary hover:bg-backgroundElevated/60'} transition-all duration-200`}
              >
                <ReplyIcon size={18} />
              </button>
              <div className="relative" ref={repostMenuRef}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowRepostMenu(!showRepostMenu);
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-[15px] ${theme === 'dark' ? 'text-white/70 hover:text-white hover:bg-white/10' : 'text-textMuted hover:text-primary hover:bg-backgroundElevated/60'} transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-accent/30 active:scale-95 ${showRepostMenu ? 'text-accent' : ''}`}
                  aria-label={`Repost ${author.name}'s post`}
                >
                  <RepeatIcon size={18} />
                </button>
                
                {/* Repost Menu */}
                {showRepostMenu && (
                  <div className={`absolute bottom-full right-0 mb-2 z-50 min-w-[160px] overflow-hidden rounded-xl border shadow-xl backdrop-blur-xl transition-all duration-200 ${theme === 'dark' ? 'bg-black/90 border-white/20 text-white' : 'bg-white/95 border-border/60 text-textPrimary'}`}>
                    <button
                      onClick={handleRechirp}
                      className={`w-full px-4 py-3 text-left text-sm font-medium flex items-center gap-3 transition-colors ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-backgroundElevated/70'}`}
                    >
                      <RepeatIcon size={16} />
                      <span>Just repost</span>
                    </button>
                    <div className={`h-px ${theme === 'dark' ? 'bg-white/10' : 'bg-border/40'}`} />
                    <button
                      onClick={handleQuoteRepost}
                      className={`w-full px-4 py-3 text-left text-sm font-medium flex items-center gap-3 transition-colors ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-backgroundElevated/70'}`}
                    >
                      <ComposeIcon size={16} />
                      <span>Add thoughts</span>
                    </button>
                  </div>
                )}
              </div>
              {!isCurrentUser && (
                <button
                  onClick={handleBookmark}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-[15px] transition-all duration-200 ${
                    theme === 'dark'
                      ? bookmarked
                        ? 'text-accent hover:text-accent/80 hover:bg-white/10'
                        : 'text-white/70 hover:text-white hover:bg-white/10'
                      : bookmarked
                      ? 'text-accent hover:text-accent/80 hover:bg-backgroundElevated/60'
                      : 'text-textMuted hover:text-primary hover:bg-backgroundElevated/60'
                  }`}
                  aria-label={bookmarked ? 'Remove bookmark' : 'Bookmark post'}
                >
                  {bookmarked ? <BookmarkFilledIcon size={18} /> : <BookmarkIcon size={18} />}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Reply Section - Always expanded */}
        <div className="px-4 py-4">
          <CommentSection chirp={chirp} initialExpanded={true} />
        </div>
      </div>

      {/* Review Context Modal */}
      {chirp && (
        <>
          <ReviewContextModal
            open={showReviewContextModal}
            onClose={() => setShowReviewContextModal(false)}
            chirp={chirp}
            onSubmitted={async () => {
              console.log('[PostDetailView] Review context submitted, reloading chirp...');
              // Reload the chirp to get updated fact-check status
              if (postId) {
                try {
                  const updatedChirp = await chirpService.getChirp(postId);
                  if (updatedChirp) {
                    setChirp(updatedChirp);
                    // Also update in store
                    loadChirps([updatedChirp]);
                  }
                } catch (error) {
                  console.error('[PostDetailView] Error reloading chirp:', error);
                }
              }
            }}
          />
          <FactCheckStatusPopup
            open={showFactCheckPopup}
            onClose={() => setShowFactCheckPopup(false)}
            chirp={chirp}
            onChirpUpdated={async (updatedChirp) => {
              // Reload the chirp to get updated fact-check status
              if (postId) {
                try {
                  const reloadedChirp = await chirpService.getChirp(postId);
                  if (reloadedChirp) {
                    setChirp(reloadedChirp);
                    loadChirps([reloadedChirp]);
                  }
                } catch (error) {
                  console.error('[PostDetailView] Error reloading chirp:', error);
                }
              }
            }}
          />
        </>
      )}
    </AppLayout>
  );
};

export default PostDetailView;

