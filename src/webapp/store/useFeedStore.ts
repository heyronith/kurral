import { create } from 'zustand';
import type { Chirp, Comment, FeedType, CommentTreeNode } from '../types';
import { useUserStore } from './useUserStore';
import { useConfigStore } from './useConfigStore';
import { generateForYouFeed, type ChirpScore } from '../lib/algorithm';
import { chirpService, commentService, topicService, buildCommentTree } from '../lib/firestore';
import { processChirpValue, processCommentValue } from '../lib/services/valuePipelineService';

const mergeChirpLists = (existing: Chirp[], incoming: Chirp[]): Chirp[] => {
  const merged = new Map<string, Chirp>();
  [...incoming, ...existing].forEach((chirp) => {
    const current = merged.get(chirp.id);
    if (!current || current.createdAt < chirp.createdAt) {
      merged.set(chirp.id, chirp);
    }
  });
  return Array.from(merged.values()).sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );
};

interface FeedState {
  chirps: Chirp[];
  comments: Record<string, Comment[]>; // chirpId -> flat array of comments
  activeFeed: FeedType;
  setActiveFeed: (feed: FeedType) => void;
  addChirp: (chirp: Omit<Chirp, 'id' | 'createdAt' | 'commentCount'>) => Promise<Chirp>;
  addComment: (comment: Omit<Comment, 'id' | 'createdAt'>) => Promise<Comment>;
  getCommentsForChirp: (chirpId: string) => Comment[];
  getCommentTreeForChirp: (chirpId: string) => CommentTreeNode[];
  getLatestFeed: () => Chirp[];
  getForYouFeed: () => ChirpScore[];
  loadChirps: (chirps: Chirp[]) => void;
  upsertChirps: (chirps: Chirp[]) => void;
  loadComments: (chirpId: string, comments: Comment[]) => void;
  deleteChirp: (chirpId: string, authorId: string) => Promise<void>;
  deleteComment: (commentId: string, authorId: string) => Promise<void>;
}

export const useFeedStore = create<FeedState>((set, get) => ({
  chirps: [],
  comments: {},
  activeFeed: 'latest',

  setActiveFeed: (feed) => set({ activeFeed: feed }),

  addChirp: async (chirpData) => {
    try {
      // Create chirp in Firestore
      const newChirp = await chirpService.createChirp(chirpData);
      
      // Increment topic engagement (async, don't wait)
      topicService.incrementTopicEngagement(chirpData.topic).catch(error => {
        console.error('Error incrementing topic engagement:', error);
      });
      
      // Update local state
      set((state) => ({
        chirps: [newChirp, ...state.chirps],
      }));
      
      processChirpValue(newChirp)
        .then((enrichedChirp) => {
          set((state) => ({
            chirps: state.chirps.map((chirp) => (chirp.id === enrichedChirp.id ? enrichedChirp : chirp)),
          }));
        })
        .catch((error) => {
          console.error('[ValuePipeline] Failed to enrich chirp:', error);
        });
      
      return newChirp;
    } catch (error) {
      console.error('Error creating chirp:', error);
      throw error;
    }
  },

  addComment: async (commentData) => {
    try {
      // Create comment in Firestore
      const newComment = await commentService.createComment(commentData);
      
      // Update local state
      set((state) => {
        const existing = state.comments[newComment.chirpId] || [];
        const updatedComments = [...existing, newComment];
        
        // Only increment commentCount for top-level comments
        // (nested replies don't count toward chirp commentCount)
        const shouldIncrementCount = !newComment.parentCommentId;
        
        return {
          comments: {
            ...state.comments,
            [newComment.chirpId]: updatedComments,
          },
          chirps: state.chirps.map((c) =>
            c.id === newComment.chirpId && shouldIncrementCount
              ? { ...c, commentCount: c.commentCount + 1 }
              : c
          ),
        };
      });
      
      processCommentValue(newComment)
        .then((result) => {
          const insight = result.commentInsights?.[newComment.id];
          set((state) => {
            const chirpComments = state.comments[newComment.chirpId] || [];
            const updatedCommentList = insight
              ? chirpComments.map((comment) =>
                  comment.id === newComment.id
                    ? {
                        ...comment,
                        discussionRole: insight.role,
                        valueContribution: insight.contribution,
                      }
                    : comment
                )
              : chirpComments;

            return {
              comments: {
                ...state.comments,
                [newComment.chirpId]: updatedCommentList,
              },
              chirps: result.updatedChirp
                ? state.chirps.map((chirp) =>
                    chirp.id === result.updatedChirp?.id ? result.updatedChirp : chirp
                  )
                : state.chirps,
            };
          });
        })
        .catch((error) => {
          console.error('[ValuePipeline] Failed to process comment:', error);
      });
      
      return newComment;
    } catch (error) {
      console.error('Error creating comment:', error);
      throw error;
    }
  },

  getCommentsForChirp: (chirpId) => {
    return get().comments[chirpId] || [];
  },

  getCommentTreeForChirp: (chirpId) => {
    const flatComments = get().comments[chirpId] || [];
    return buildCommentTree(flatComments);
  },

  getLatestFeed: () => {
    const { chirps } = get();
    const currentUser = useUserStore.getState().currentUser;
    
    if (!currentUser) return [];
    
    // Filter to followed users only, sort by createdAt DESC
    return chirps
      .filter((chirp) => currentUser.following.includes(chirp.authorId))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  },

  getForYouFeed: () => {
    const { chirps } = get();
    const currentUser = useUserStore.getState().currentUser;
    const config = useConfigStore.getState().forYouConfig;
    const getUser = useUserStore.getState().getUser;
    
    if (!currentUser) return [];
    
    return generateForYouFeed(chirps, currentUser, config, getUser);
  },

  loadChirps: (chirps) => set({ chirps }),

  upsertChirps: (chirps) =>
    set((state) => ({
      chirps: mergeChirpLists(state.chirps, chirps),
    })),

  loadComments: (chirpId, comments) =>
    set((state) => ({
      comments: {
        ...state.comments,
        [chirpId]: comments,
      },
    })),

  deleteChirp: async (chirpId, authorId) => {
    try {
      await chirpService.deleteChirp(chirpId, authorId);
      
      // Remove from local state
      set((state) => ({
        chirps: state.chirps.filter((c) => c.id !== chirpId),
        comments: Object.fromEntries(
          Object.entries(state.comments).filter(([id]) => id !== chirpId)
        ),
      }));
    } catch (error) {
      console.error('Error deleting chirp:', error);
      throw error;
    }
  },

  deleteComment: async (commentId, authorId) => {
    try {
      // Get comment to find chirpId before deletion
      const comments = Object.values(get().comments).flat();
      const comment = comments.find((c) => c.id === commentId);
      if (!comment) {
        throw new Error('Comment not found in local state');
      }

      await commentService.deleteComment(commentId, authorId);
      
      // Remove from local state
      set((state) => {
        const chirpComments = state.comments[comment.chirpId] || [];
        const updatedComments = chirpComments.filter((c) => {
          // Remove the comment and all its replies recursively
          const shouldRemove = (c: Comment): boolean => {
            if (c.id === commentId) return true;
            if (c.parentCommentId === commentId) return true;
            // Check if parent is being removed
            const parent = chirpComments.find((pc) => pc.id === c.parentCommentId);
            return parent ? shouldRemove(parent) : false;
          };
          return !shouldRemove(c);
        });

        // Update chirp commentCount if this was a top-level comment
        const updatedChirps = state.chirps.map((c) => {
          if (c.id === comment.chirpId && !comment.parentCommentId) {
            return { ...c, commentCount: Math.max(0, c.commentCount - 1) };
          }
          return c;
        });

        return {
          comments: {
            ...state.comments,
            [comment.chirpId]: updatedComments,
          },
          chirps: updatedChirps,
        };
      });
    } catch (error) {
      console.error('Error deleting comment:', error);
      throw error;
    }
  },
}));

