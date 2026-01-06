// Post Aggregation Service - Get posts by topic
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  Timestamp,
  type QueryConstraint,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { Chirp } from '../types';

// Get posts about a specific topic within a time window
export async function getPostsByTopic(
  topic: string,
  hours: number = 4,
  limitCount: number = 100
): Promise<Chirp[]> {
  const normalizedTopic = topic.trim().toLowerCase();
  if (!normalizedTopic) {
    return [];
  }

  const hoursAgo = Date.now() - hours * 60 * 60 * 1000;
  const timestamp = Timestamp.fromMillis(hoursAgo);

  const mapDocToChirp = (doc: any): Chirp => {
    const data = doc.data();
    const createdAt = data.createdAt?.toDate() || new Date();
    return {
      id: doc.id,
      authorId: data.authorId,
      text: data.text,
      topic: data.topic,
      semanticTopics: data.semanticTopics || [],
      entities: data.entities || [],
      intent: data.intent,
      analyzedAt: data.analyzedAt?.toDate(),
      reachMode: data.reachMode,
      tunedAudience: data.tunedAudience,
      createdAt: createdAt,
      rechirpOfId: data.rechirpOfId,
      commentCount: data.commentCount || 0,
      countryCode: data.countryCode,
      imageUrl: data.imageUrl,
      scheduledAt: data.scheduledAt?.toDate(),
      formattedText: data.formattedText,
      contentEmbedding: data.contentEmbedding,
      factCheckStatus: data.factCheckStatus,
      factCheck: data.factCheck,
      valueScore: data.valueScore,
      kurralScore: data.kurralScore,
    } as Chirp;
  };

  const fetchChirps = async (constraints: QueryConstraint[]): Promise<Chirp[]> => {
    const collectionRef = collection(db, 'chirps');
    try {
      const q = query(
        collectionRef,
        ...constraints,
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );
      const snapshot = await getDocs(q);
      const posts = snapshot.docs.map(mapDocToChirp);
      console.log(`[postAggregationService] Query succeeded: found ${posts.length} posts`);
      return posts;
    } catch (error: any) {
      console.warn('[postAggregationService] Ordered query failed (may need index):', error.message);
      try {
        const q = query(
          collectionRef,
          ...constraints,
          limit(limitCount)
        );
        const fallbackSnapshot = await getDocs(q);
        const posts = fallbackSnapshot.docs.map(mapDocToChirp);
        const sorted = posts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        console.log(`[postAggregationService] Fallback query succeeded: found ${sorted.length} posts`);
        return sorted;
      } catch (fallbackError: any) {
        console.error('[postAggregationService] Fallback query also failed:', fallbackError.message);
        return [];
      }
    }
  };

  const legacyConstraints = [
    where('topic', '==', normalizedTopic),
    where('createdAt', '>=', timestamp),
  ];

  const semanticConstraints = [
    where('semanticTopics', 'array-contains', normalizedTopic),
    where('createdAt', '>=', timestamp),
  ];

  const [legacyPosts, semanticPosts] = await Promise.all([
    fetchChirps(legacyConstraints),
    fetchChirps(semanticConstraints),
  ]);

  console.log(`[postAggregationService] Found ${legacyPosts.length} legacy posts and ${semanticPosts.length} semantic posts for topic "${normalizedTopic}" in last ${hours} hours`);

  const combined = [...legacyPosts, ...semanticPosts];
  const deduped = Array.from(
    combined.reduce<Map<string, Chirp>>((map, post) => {
      if (!map.has(post.id)) {
        map.set(post.id, post);
      }
      return map;
    }, new Map()).values()
  );

  return deduped;
}

