import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentSnapshot,
  type QuerySnapshot,
} from 'firebase/firestore';
import { db, auth } from '../config/firebase';
import type { Comment, FirestoreComment, Claim, FactCheck, CommentTreeNode } from '../types';

const COMMENTS_COLLECTION = 'comments';
const DEFAULT_LIMIT = 200;

const toComment = (
  snapshot: QuerySnapshot['docs'][number] | DocumentSnapshot
): Comment => {
  const data = snapshot.data() as FirestoreComment;

  return {
    ...data,
    id: snapshot.id,
    createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
    scheduledAt: data.scheduledAt?.toDate
      ? data.scheduledAt.toDate()
      : undefined,
    factCheckingStartedAt: data.factCheckingStartedAt?.toDate
      ? data.factCheckingStartedAt.toDate()
      : undefined,
  } as Comment;
};

export const commentService = {
  listen(
    chirpId: string,
    onUpdate: (comments: Comment[]) => void,
    onError?: (err: any) => void,
    max: number = DEFAULT_LIMIT
  ): () => void {
    const q = query(
      collection(db, COMMENTS_COLLECTION),
      where('chirpId', '==', chirpId),
      orderBy('createdAt', 'asc'),
      limit(max)
    );

    return onSnapshot(
      q,
      (snapshot) => {
        onUpdate(snapshot.docs.map(toComment));
      },
      (err) => {
        console.error('[commentService] listen failed', err, { chirpId });
        onError?.(err);
      }
    );
  },

  async fetch(chirpId: string, max: number = DEFAULT_LIMIT): Promise<Comment[]> {
    const q = query(
      collection(db, COMMENTS_COLLECTION),
      where('chirpId', '==', chirpId),
      orderBy('createdAt', 'asc'),
      limit(max)
    );
    const snap = await getDocs(q);
    return snap.docs.map(toComment);
  },

  async add(
    chirpId: string,
    data: Omit<Comment, 'id' | 'createdAt'>
  ): Promise<string> {
    const ref = await addDoc(collection(db, COMMENTS_COLLECTION), {
      ...data,
      chirpId,
      createdAt: serverTimestamp(),
    });
    return ref.id;
  },

  async remove(id: string): Promise<void> {
    const ref = doc(db, COMMENTS_COLLECTION, id);
    await deleteDoc(ref);
  },

  async getCommentsForChirp(chirpId: string): Promise<Comment[]> {
    return this.fetch(chirpId);
  },

  async addComment(
    chirpId: string,
    data: Omit<Comment, 'id' | 'chirpId' | 'createdAt'>
  ): Promise<Comment> {
    try {
      // Verify user is authenticated
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('User must be authenticated to post comments');
      }
      
      // Ensure authorId matches the authenticated user
      if (data.authorId !== currentUser.uid) {
        throw new Error('Author ID must match authenticated user');
      }

      // Calculate depth if this is a reply
      let depth = 0;
      if (data.parentCommentId) {
        // Get parent comment to calculate depth
        const parentDoc = await getDoc(doc(db, COMMENTS_COLLECTION, data.parentCommentId));
        if (!parentDoc.exists()) {
          throw new Error('Parent comment not found');
        }
        const parentData = parentDoc.data() as FirestoreComment;
        depth = (parentData.depth || 0) + 1;

        // Limit nesting depth to prevent abuse
        if (depth > 10) {
          throw new Error('Maximum reply depth exceeded');
        }
      }

      // Build comment data, excluding undefined fields
      const commentData: any = {
        chirpId,
        authorId: data.authorId,
        text: data.text,
        depth,
        replyCount: 0,
        createdAt: serverTimestamp(),
      };

      // Initialize fact checking status for resume capability
      commentData.factCheckingStatus = 'pending';
      commentData.factCheckingStartedAt = serverTimestamp();

      // Only include optional fields if they have values
      if (data.parentCommentId) {
        commentData.parentCommentId = data.parentCommentId;
      }
      if (data.replyToUserId) {
        commentData.replyToUserId = data.replyToUserId;
      }
      if (data.discussionRole) {
        commentData.discussionRole = data.discussionRole;
      }
      if (data.valueContribution) {
        commentData.valueContribution = data.valueContribution;
      }
      if (data.imageUrl) {
        commentData.imageUrl = data.imageUrl;
      }
      if (data.formattedText) {
        commentData.formattedText = data.formattedText;
      }
      if (data.scheduledAt) {
        commentData.scheduledAt = Timestamp.fromDate(data.scheduledAt);
      }

      // Include fact-check fields if provided (for migration/resume)
      if (data.claims && data.claims.length > 0) {
        commentData.claims = data.claims.map((claim) => ({
          ...claim,
          extractedAt: claim.extractedAt ? Timestamp.fromDate(claim.extractedAt) : undefined,
        }));
      }
      if (data.factChecks && data.factChecks.length > 0) {
        commentData.factChecks = data.factChecks.map((factCheck) => ({
          ...factCheck,
          checkedAt: factCheck.checkedAt ? Timestamp.fromDate(factCheck.checkedAt) : undefined,
        }));
      }
      if (data.factCheckStatus) {
        commentData.factCheckStatus = data.factCheckStatus;
      }

      // Create the comment document
      const docRef = await addDoc(collection(db, COMMENTS_COLLECTION), commentData);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        throw new Error('Failed to create comment');
      }
      const newComment = toComment(docSnap);

      // Use batch for atomic updates
      const batch = writeBatch(db);

      // If this is a top-level comment, increment chirp comment count
      if (!data.parentCommentId) {
        batch.update(doc(db, 'chirps', chirpId), {
          commentCount: increment(1),
        });
      }

      // If this is a reply, increment parent comment's reply count
      if (data.parentCommentId) {
        batch.update(doc(db, COMMENTS_COLLECTION, data.parentCommentId), {
          replyCount: increment(1),
        });
      }

      await batch.commit();

      return newComment;
    } catch (error) {
      console.error('[commentService] Error adding comment:', error);
      throw error;
    }
  },

  async deleteComment(commentId: string, authorId?: string): Promise<void> {
    try {
      // Verify the comment exists
      const commentDoc = await getDoc(doc(db, COMMENTS_COLLECTION, commentId));
      if (!commentDoc.exists()) {
        throw new Error('Comment not found');
      }

      const commentData = commentDoc.data() as FirestoreComment;

      // Verify authorization if authorId is provided
      if (authorId && commentData.authorId !== authorId) {
        // Check if user is the chirp author (chirp authors can delete any comment on their post)
        const chirpDoc = await getDoc(doc(db, 'chirps', commentData.chirpId));
        if (!chirpDoc.exists()) {
          throw new Error('Chirp not found');
        }
        const chirpData = chirpDoc.data();
        if (chirpData?.authorId !== authorId) {
          throw new Error('Unauthorized: Only the author or post owner can delete this comment');
        }
      }

      // Get all replies to this comment (recursively)
      const getAllReplies = async (parentId: string): Promise<string[]> => {
        const repliesQuery = query(
          collection(db, COMMENTS_COLLECTION),
          where('parentCommentId', '==', parentId)
        );
        const repliesSnapshot = await getDocs(repliesQuery);
        const replyIds: string[] = [];

        for (const replyDoc of repliesSnapshot.docs) {
          const replyId = replyDoc.id;
          replyIds.push(replyId);
          // Recursively get replies to this reply
          const nestedReplies = await getAllReplies(replyId);
          replyIds.push(...nestedReplies);
        }

        return replyIds;
      };

      const allReplyIds = await getAllReplies(commentId);
      const totalCommentsToDelete = 1 + allReplyIds.length; // Main comment + all replies

      // Use batch to delete comment and all replies atomically
      const batch = writeBatch(db);

      // Delete the main comment
      batch.delete(doc(db, COMMENTS_COLLECTION, commentId));

      // Delete all replies
      allReplyIds.forEach((replyId) => {
        batch.delete(doc(db, COMMENTS_COLLECTION, replyId));
      });

      // Update parent comment's replyCount if this is a reply
      if (commentData.parentCommentId) {
        const parentCommentDoc = await getDoc(doc(db, COMMENTS_COLLECTION, commentData.parentCommentId));
        if (parentCommentDoc.exists()) {
          const currentReplyCount = parentCommentDoc.data().replyCount || 0;
          const newReplyCount = Math.max(0, currentReplyCount - 1);
          batch.update(doc(db, COMMENTS_COLLECTION, commentData.parentCommentId), {
            replyCount: newReplyCount,
          });
        }
      } else {
        // This is a top-level comment, decrement chirp's commentCount
        const chirpDoc = await getDoc(doc(db, 'chirps', commentData.chirpId));
        if (chirpDoc.exists()) {
          const currentCommentCount = chirpDoc.data().commentCount || 0;
          const newCommentCount = Math.max(0, currentCommentCount - totalCommentsToDelete);
          batch.update(doc(db, 'chirps', commentData.chirpId), {
            commentCount: newCommentCount,
          });
        }
      }

      await batch.commit();
    } catch (error) {
      console.error('[commentService] Error deleting comment:', error);
      throw error;
    }
  },

  async updateCommentReplyCount(commentId: string, newCount: number): Promise<void> {
    const commentRef = doc(db, COMMENTS_COLLECTION, commentId);
    await updateDoc(commentRef, {
      replyCount: newCount,
    });
  },

  async updateCommentAnalytics(
    commentId: string,
    updates: {
      discussionRole?: Comment['discussionRole'];
      valueContribution?: any & { total: number };
      claims?: Claim[];
      factChecks?: FactCheck[];
      factCheckStatus?: 'clean' | 'needs_review' | 'blocked';
      factCheckingStatus?: 'pending' | 'in_progress' | 'completed' | 'failed';
      factCheckingStartedAt?: Date;
    }
  ): Promise<void> {
    const commentRef = doc(db, COMMENTS_COLLECTION, commentId);
    const firestoreUpdates: Record<string, any> = {};

    if (updates.discussionRole) {
      firestoreUpdates.discussionRole = updates.discussionRole;
    }
    if (updates.valueContribution) {
      firestoreUpdates.valueContribution = updates.valueContribution;
    }
    if (updates.claims !== undefined) {
      firestoreUpdates.claims = updates.claims.map((claim) => ({
        ...claim,
        extractedAt: updates.claims?.[0]?.extractedAt ? Timestamp.fromDate(updates.claims[0].extractedAt) : undefined,
      }));
    }
    if (updates.factChecks !== undefined) {
      firestoreUpdates.factChecks = updates.factChecks.map((factCheck) => ({
        ...factCheck,
        checkedAt: factCheck.checkedAt ? Timestamp.fromDate(factCheck.checkedAt) : undefined,
      }));
    }
    if (updates.factCheckStatus !== undefined) {
      firestoreUpdates.factCheckStatus = updates.factCheckStatus;
    }
    if (updates.factCheckingStatus !== undefined) {
      firestoreUpdates.factCheckingStatus = updates.factCheckingStatus;
    }
    if (updates.factCheckingStartedAt !== undefined) {
      firestoreUpdates.factCheckingStartedAt = updates.factCheckingStartedAt
        ? Timestamp.fromDate(updates.factCheckingStartedAt)
        : null;
    }

    await updateDoc(commentRef, firestoreUpdates);
  },

  async getCommentsByAuthor(authorId: string, limitCount: number = 500): Promise<Comment[]> {
    try {
      const q = query(
        collection(db, COMMENTS_COLLECTION),
        where('authorId', '==', authorId),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(toComment);
    } catch (error) {
      console.error('[commentService] Error fetching comments by author:', error);
      return [];
    }
  },

  /**
   * Builds a comment tree from a flat list of comments
   */
  buildCommentTree(comments: Comment[]): CommentTreeNode[] {
    const commentMap = new Map<string, CommentTreeNode>();
    const rootComments: CommentTreeNode[] = [];

    // First pass: create all comment nodes
    comments.forEach(comment => {
      commentMap.set(comment.id, {
        ...comment,
        replies: [],
      });
    });

    // Second pass: build the tree
    comments.forEach(comment => {
      const node = commentMap.get(comment.id)!;

      if (comment.parentCommentId) {
        // This is a reply
        const parent = commentMap.get(comment.parentCommentId);
        if (parent) {
          parent.replies.push(node);
        } else {
          // Parent not found, treat as root
          rootComments.push(node);
        }
      } else {
        // This is a root comment
        rootComments.push(node);
      }
    });

    // Sort replies by creation time
    const sortReplies = (nodes: CommentTreeNode[]) => {
      nodes.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      nodes.forEach(node => {
        if (node.replies.length > 0) {
          sortReplies(node.replies);
        }
      });
    };

    sortReplies(rootComments);
    return rootComments;
  },
};


