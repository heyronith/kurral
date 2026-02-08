/**
 * Server-side topic helpers for pipeline and news.
 * Loads top topics from Firestore for semantic analysis (ReachAgent).
 */

import * as admin from 'firebase-admin';

export type TopicMetadata = {
  name: string;
  postsLast48h?: number;
  totalUsers?: number;
};

const db = admin.firestore();

/**
 * Load top engaged topics for semantic analysis (e.g. bucket suggestions).
 * Uses `topics` collection, ordered by postsLast48h desc.
 */
export async function getTopTopicsForAnalysis(limit: number = 30): Promise<TopicMetadata[]> {
  try {
    const snapshot = await db
      .collection('topics')
      .orderBy('postsLast48h', 'desc')
      .limit(limit)
      .get();

    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        name: data.name || doc.id,
        postsLast48h: data.postsLast48h ?? 0,
        totalUsers: data.totalUsers ?? 0,
      };
    });
  } catch (err) {
    // Index may not exist; fallback without orderBy
    try {
      const snapshot = await db.collection('topics').limit(limit * 2).get();
      const list = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          name: data.name || doc.id,
          postsLast48h: data.postsLast48h ?? 0,
          totalUsers: data.totalUsers ?? 0,
        };
      });
      list.sort((a, b) => (b.postsLast48h ?? 0) - (a.postsLast48h ?? 0));
      return list.slice(0, limit);
    } catch (fallbackErr) {
      console.warn('[TopicService] getTopTopicsForAnalysis failed:', fallbackErr);
      return [];
    }
  }
}
