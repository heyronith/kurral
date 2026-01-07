import { create } from 'zustand';
import type { Chirp, FeedType, ForYouConfig, Comment, CommentTreeNode } from '../types';
import { DEFAULT_FOR_YOU_CONFIG } from '../types';
import { chirpService } from '../services/chirpService';
import { topicService } from '../services/topicService';
import { commentService } from '../services/commentService';
import { processChirpValue } from '../services/valuePipelineService';

type FeedState = {
  activeFeed: FeedType;
  latest: Chirp[];
  forYou: Chirp[]; // All chirps for For You feed (algorithm will filter/score)
  latestLoading: boolean;
  forYouLoading: boolean;
  error: string | null;
  latestUnsubscribe?: () => void;
  forYouUnsubscribe?: () => void;
  comments: Record<string, Comment[]>; // Comments by chirpId
  commentTrees: Record<string, CommentTreeNode[]>; // Comment trees by chirpId
  commentUnsubscribes: Record<string, () => void>; // Unsubscribers by chirpId
  setActiveFeed: (feed: FeedType) => void;
  addChirp: (
    chirp: Omit<Chirp, 'id' | 'createdAt' | 'commentCount'>,
    options?: { waitForProcessing?: boolean }
  ) => Promise<Chirp>;
  addComment: (
    chirpId: string,
    comment: Omit<Comment, 'id' | 'chirpId' | 'createdAt'>
  ) => Promise<Comment>;
  deleteComment: (commentId: string, chirpId: string, authorId?: string) => Promise<void>;
  loadComments: (chirpId: string, comments: Comment[]) => void;
  getCommentTreeForChirp: (chirpId: string) => CommentTreeNode[];
  startCommentListener: (chirpId: string) => () => void;
  startLatestListener: (
    followingIds: string[] | undefined | null,
    currentUserId: string,
    max?: number
  ) => () => void;
  startForYouListener: (
    userId: string,
    config?: ForYouConfig,
    max?: number
  ) => () => void;
  refreshLatest: (
    followingIds: string[] | undefined | null,
    currentUserId: string,
    max?: number
  ) => Promise<void>;
  refreshForYou: (
    userId: string,
    config?: ForYouConfig,
    max?: number
  ) => Promise<void>;
  clear: () => void;
};

export const useFeedStore = create<FeedState>((set, get) => ({
  activeFeed: 'latest',
  latest: [],
  forYou: [],
  latestLoading: false,
  forYouLoading: false,
  error: null,
  latestUnsubscribe: undefined,
  forYouUnsubscribe: undefined,
  comments: {},
  commentTrees: {},
  commentUnsubscribes: {},

  setActiveFeed: (feed) => set({ activeFeed: feed }),

  addChirp: async (chirpData, options) => {
    try {
      // Create chirp in Firestore
      const newChirp = await chirpService.createChirp(chirpData);
      
      // Increment topic engagement (async, don't wait)
      const engagementTopics = new Set(
        [
          chirpData.topic,
          ...(chirpData.semanticTopics || []),
        ]
          .map((topic) => topic?.toString().trim().toLowerCase())
          .filter((topic): topic is string => Boolean(topic))
      );

      if (engagementTopics.size > 0) {
        topicService.incrementTopicEngagement(Array.from(engagementTopics)).catch((error) => {
          console.error('Error incrementing topic engagement:', error);
        });
      }
      
      // Optionally wait for processing before showing in feeds
      let processedChirp: Chirp = newChirp;
      if (options?.waitForProcessing) {
        try {
          processedChirp = await processChirpValue(newChirp);
          
          // If processing failed or returned without factCheckStatus, mark as needs_review
          if (!processedChirp.factCheckStatus) {
            console.warn('[ValuePipeline] Processing returned without factCheckStatus, marking as needs_review');
            processedChirp = {
              ...processedChirp,
              factCheckStatus: 'needs_review',
              factCheckingStatus: 'failed',
            };
          }
        } catch (error) {
          console.error('[ValuePipeline] Failed to process chirp before publish:', error);
          // On error, mark as needs_review to prevent auto-approval
          processedChirp = {
            ...newChirp,
            factCheckStatus: 'needs_review',
            factCheckingStatus: 'failed',
          };
          // Don't throw - let the post be created but marked for review
          // The Firestore trigger will retry processing
        }
      } else {
        // Fire-and-forget fallback (legacy)
        processChirpValue(newChirp).catch((error) => {
          console.error('[ValuePipeline] Failed to enrich chirp:', error);
        });
      }

      // Visibility rules:
      // - Hide blocked posts from feeds (will only be visible in author profile)
      // - Hide posts still in fact-checking (pending/in_progress)
      const isBlocked = processedChirp.factCheckStatus === 'blocked';
      const isProcessing =
        processedChirp.factCheckingStatus === 'pending' ||
        processedChirp.factCheckingStatus === 'in_progress';

      const canShowInFeed = !isBlocked && !isProcessing;

      if (canShowInFeed) {
      set((state) => ({
          latest: [processedChirp, ...state.latest.filter((c) => c.id !== processedChirp.id)],
          forYou: [processedChirp, ...state.forYou.filter((c) => c.id !== processedChirp.id)],
        }));
      }
      
      return processedChirp;
    } catch (error) {
      console.error('Error creating chirp:', error);
      throw error;
    }
  },

  addComment: async (chirpId, commentData) => {
    try {
      const newComment = await commentService.addComment(chirpId, commentData);

      // Optimistic update: Only increment commentCount for top-level comments
      // commentService already updated Firestore counts, this is just for UI responsiveness
      if (!commentData.parentCommentId) {
        set((state) => {
          const updatedChirps = [...state.latest, ...state.forYou].map(chirp =>
            chirp.id === chirpId
              ? { ...chirp, commentCount: (chirp.commentCount || 0) + 1 }
              : chirp
          );

          return {
            latest: updatedChirps.filter(chirp => state.latest.some(c => c.id === chirp.id)),
            forYou: updatedChirps.filter(chirp => state.forYou.some(c => c.id === chirp.id)),
          };
        });
      } else {
        // For replies, update parent comment's replyCount in cache
        set((state) => {
          const comments = state.comments[chirpId] || [];
          const updatedComments = comments.map(comment =>
            comment.id === commentData.parentCommentId
              ? { ...comment, replyCount: (comment.replyCount || 0) + 1 }
              : comment
          );

          return {
            comments: {
              ...state.comments,
              [chirpId]: updatedComments,
            },
            commentTrees: {
              ...state.commentTrees,
              [chirpId]: commentService.buildCommentTree([...updatedComments, newComment]),
            },
          };
        });
      }

      // Add to local comments cache (avoid duplicates)
      set((state) => {
        const existingComments = state.comments[chirpId] || [];
        // Check if comment already exists to avoid duplicates
        const commentExists = existingComments.some(c => c.id === newComment.id);
        if (commentExists) {
          return state; // Don't update if comment already exists
        }
        const updatedComments = [...existingComments, newComment];
        return {
          comments: {
            ...state.comments,
            [chirpId]: updatedComments,
          },
          commentTrees: {
            ...state.commentTrees,
            [chirpId]: commentService.buildCommentTree(updatedComments),
          },
        };
      });

      return newComment;
    } catch (error) {
      console.error('Error adding comment:', error);
      throw error;
    }
  },

  deleteComment: async (commentId, chirpId, authorId) => {
    try {
      // Get the comment to find all replies before deletion
      const comments = get().comments[chirpId] || [];
      const commentToDelete = comments.find(c => c.id === commentId);
      
      // Delete comment and all replies (commentService handles count updates)
      await commentService.deleteComment(commentId, authorId);

      // Find all reply IDs to remove from cache (recursively)
      const getAllReplyIds = (parentId: string, allComments: Comment[]): string[] => {
        const replyIds: string[] = [];
        const directReplies = allComments.filter(c => c.parentCommentId === parentId);
        directReplies.forEach(reply => {
          replyIds.push(reply.id);
          const nestedReplies = getAllReplyIds(reply.id, allComments);
          replyIds.push(...nestedReplies);
        });
        return replyIds;
      };

      const allReplyIds = commentToDelete ? getAllReplyIds(commentId, comments) : [];
      const allIdsToRemove = [commentId, ...allReplyIds];

      // Remove from local comments cache (including all replies)
      set((state) => ({
        comments: {
          ...state.comments,
          [chirpId]: (state.comments[chirpId] || []).filter(comment => !allIdsToRemove.includes(comment.id)),
        },
        commentTrees: {
          ...state.commentTrees,
          [chirpId]: commentService.buildCommentTree(
            (state.comments[chirpId] || []).filter(comment => !allIdsToRemove.includes(comment.id))
          ),
        },
      }));

      // Update comment count in chirps (commentService already updated Firestore, but we need to update local state)
      // Note: We need to get the updated count from Firestore or calculate it
      // For now, we'll let the real-time listener update it, but we can do optimistic update
      const deletedCount = allIdsToRemove.length;
      set((state) => {
        const updatedChirps = [...state.latest, ...state.forYou].map(chirp =>
          chirp.id === chirpId
            ? { ...chirp, commentCount: Math.max(0, (chirp.commentCount || 0) - deletedCount) }
            : chirp
        );

        return {
          latest: updatedChirps.filter(chirp => state.latest.some(c => c.id === chirp.id)),
          forYou: updatedChirps.filter(chirp => state.forYou.some(c => c.id === chirp.id)),
        };
      });
    } catch (error) {
      console.error('Error deleting comment:', error);
      throw error;
    }
  },

  loadComments: (chirpId, comments) => {
    set((state) => ({
      comments: {
        ...state.comments,
        [chirpId]: comments,
      },
      commentTrees: {
        ...state.commentTrees,
        [chirpId]: commentService.buildCommentTree(comments),
      },
    }));
  },

  getCommentTreeForChirp: (chirpId) => {
    const { commentTrees } = get();
    return commentTrees[chirpId] || [];
  },

  startCommentListener: (chirpId) => {
    const { commentUnsubscribes } = get();

    // Unsubscribe existing listener
    commentUnsubscribes[chirpId]?.();

    const unsubscribe = commentService.listen(
      chirpId,
      (comments) => {
        get().loadComments(chirpId, comments);
      },
      (error) => {
        console.error(`Error listening to comments for chirp ${chirpId}:`, error);
      }
    );

    set((state) => ({
      commentUnsubscribes: {
        ...state.commentUnsubscribes,
        [chirpId]: unsubscribe,
      },
    }));

    return unsubscribe;
  },

  startLatestListener: (followingIds, currentUserId, max) => {
    const filterVisibleChirps = (chirps: Chirp[]): Chirp[] =>
      chirps.filter((chirp) => {
        const isProcessing =
          chirp.factCheckingStatus === 'pending' || chirp.factCheckingStatus === 'in_progress';
        const isBlocked = chirp.factCheckStatus === 'blocked';
        if (isProcessing) return false;
        if (isBlocked && chirp.authorId !== currentUserId) return false;
        return true;
      });

    const { latestUnsubscribe } = get();
    latestUnsubscribe?.();
    set({ latestLoading: true, error: null });

    const unsubscribe = chirpService.listenLatest(
      followingIds,
      currentUserId,
      (chirps) => set({ latest: filterVisibleChirps(chirps), latestLoading: false }),
      (err) => set({ error: err?.message ?? 'Failed to load latest feed' }),
      max
    );

    set({ latestUnsubscribe: unsubscribe });
    return unsubscribe;
  },

  startForYouListener: (userId, config, max) => {
    const filterVisibleChirps = (chirps: Chirp[]): Chirp[] =>
      chirps.filter((chirp) => {
        const isProcessing =
          chirp.factCheckingStatus === 'pending' || chirp.factCheckingStatus === 'in_progress';
        const isBlocked = chirp.factCheckStatus === 'blocked';
        if (isProcessing) return false;
        if (isBlocked && chirp.authorId !== userId) return false;
        return true;
      });

    const { forYouUnsubscribe } = get();
    forYouUnsubscribe?.();
    set({ forYouLoading: true, error: null });

    const unsubscribe = chirpService.listenForYou(
      userId,
      config ?? DEFAULT_FOR_YOU_CONFIG,
      (chirps) => set({ forYou: filterVisibleChirps(chirps), forYouLoading: false }),
      (err) => set({ error: err?.message ?? 'Failed to load For You feed' }),
      max
    );

    set({ forYouUnsubscribe: unsubscribe });
    return unsubscribe;
  },

  refreshLatest: async (followingIds, currentUserId, max) => {
    const filterVisibleChirps = (chirps: Chirp[]): Chirp[] =>
      chirps.filter((chirp) => {
        const isProcessing =
          chirp.factCheckingStatus === 'pending' || chirp.factCheckingStatus === 'in_progress';
        const isBlocked = chirp.factCheckStatus === 'blocked';
        if (isProcessing) return false;
        if (isBlocked && chirp.authorId !== currentUserId) return false;
        return true;
      });

    try {
      set({ latestLoading: true, error: null });
      const chirps = await chirpService.fetchLatest(followingIds, currentUserId, max);
      set({ latest: filterVisibleChirps(chirps), latestLoading: false });
    } catch (err: any) {
      set({
        error: err?.message ?? 'Failed to refresh latest feed',
        latestLoading: false,
      });
    }
  },

  refreshForYou: async (userId, config, max) => {
    const filterVisibleChirps = (chirps: Chirp[]): Chirp[] =>
      chirps.filter((chirp) => {
        const isProcessing =
          chirp.factCheckingStatus === 'pending' || chirp.factCheckingStatus === 'in_progress';
        const isBlocked = chirp.factCheckStatus === 'blocked';
        if (isProcessing) return false;
        if (isBlocked && chirp.authorId !== userId) return false;
        return true;
      });

    try {
      set({ forYouLoading: true, error: null });
      const chirps = await chirpService.fetchForYou(
        userId,
        config ?? DEFAULT_FOR_YOU_CONFIG,
        max
      );
      set({ forYou: filterVisibleChirps(chirps), forYouLoading: false });
    } catch (err: any) {
      set({
        error: err?.message ?? 'Failed to refresh For You feed',
        forYouLoading: false,
      });
    }
  },

  clear: () => {
    const { latestUnsubscribe, forYouUnsubscribe, commentUnsubscribes } = get();
    latestUnsubscribe?.();
    forYouUnsubscribe?.();

    // Unsubscribe from all comment listeners
    Object.values(commentUnsubscribes).forEach(unsubscribe => unsubscribe?.());

    set({
      latest: [],
      forYou: [],
      latestLoading: false,
      forYouLoading: false,
      error: null,
      latestUnsubscribe: undefined,
      forYouUnsubscribe: undefined,
      comments: {},
      commentTrees: {},
      commentUnsubscribes: {},
    });
  },
}));


