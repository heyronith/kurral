import {
  addDoc,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { PostReviewContext } from '../types';

const REVIEW_CONTEXTS_COLLECTION = 'postReviews';

export const reviewContextService = {
  async createReviewContext(
    chirpId: string,
    submittedBy: string,
    action: 'validate' | 'invalidate',
    sources: string[],
    context: string
  ): Promise<void> {
    try {
      await addDoc(collection(db, REVIEW_CONTEXTS_COLLECTION), {
        chirpId,
        submittedBy,
        action,
        sources,
        context,
        createdAt: Timestamp.now(),
      });
    } catch (error) {
      console.error('[reviewContextService] Error creating review context:', error);
      throw new Error('Failed to submit review. Please try again.');
    }
  },

  async getReviewContextsForChirp(chirpId: string): Promise<PostReviewContext[]> {
    try {
      const q = query(
        collection(db, REVIEW_CONTEXTS_COLLECTION),
        where('chirpId', '==', chirpId),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          chirpId: data.chirpId,
          submittedBy: data.submittedBy,
          action: data.action,
          sources: data.sources || [],
          context: data.context,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
        } as PostReviewContext;
      });
    } catch (error) {
      console.error('[reviewContextService] Error fetching review contexts:', error);
      return []; // Return empty array on error to avoid breaking the UI
    }
  },
};
