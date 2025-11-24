// Post Aggregation Service - Collects and analyzes posts for news generation
import { chirpService } from '../firestore';
import type { Chirp } from '../../types';
import { collection, query, where, orderBy, limit, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';

interface AggregatedPost {
  chirp: Chirp;
  engagement: number; // commentCount as engagement metric
  recency: number; // Minutes since posted
}

// Get posts about a specific topic within a time window
export async function getPostsByTopic(
  topic: string,
  hours: number = 4,
  limitCount: number = 100
): Promise<Chirp[]> {
  try {
    const hoursAgo = Date.now() - (hours * 60 * 60 * 1000);
    const timestamp = Timestamp.fromMillis(hoursAgo);

    const q = query(
      collection(db, 'chirps'),
      where('topic', '==', topic),
      where('createdAt', '>=', timestamp),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        authorId: data.authorId,
        text: data.text,
        topic: data.topic,
        reachMode: data.reachMode,
        tunedAudience: data.tunedAudience,
        createdAt: data.createdAt?.toDate() || new Date(),
        rechirpOfId: data.rechirpOfId,
        commentCount: data.commentCount || 0,
      } as Chirp;
    });
  } catch (error) {
    console.error(`Error fetching posts for topic ${topic}:`, error);
    // Fallback: try without orderBy if index doesn't exist
    try {
      const hoursAgo = Date.now() - (hours * 60 * 60 * 1000);
      const timestamp = Timestamp.fromMillis(hoursAgo);
      const q2 = query(
        collection(db, 'chirps'),
        where('topic', '==', topic),
        where('createdAt', '>=', timestamp),
        limit(limitCount)
      );
      const snapshot = await getDocs(q2);
      const posts = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          authorId: data.authorId,
          text: data.text,
          topic: data.topic,
          reachMode: data.reachMode,
          tunedAudience: data.tunedAudience,
          createdAt: data.createdAt?.toDate() || new Date(),
          rechirpOfId: data.rechirpOfId,
          commentCount: data.commentCount || 0,
        } as Chirp;
      });
      // Sort by createdAt desc manually
      return posts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } catch (fallbackError) {
      console.error('Error in fallback post fetch:', fallbackError);
      return [];
    }
  }
}

// Aggregate posts with engagement metrics for news generation
export async function aggregatePostsForNews(
  topic: string,
  hours: number = 4
): Promise<AggregatedPost[]> {
  const posts = await getPostsByTopic(topic, hours, 200);
  const now = Date.now();

  return posts.map((chirp) => {
    const recency = Math.floor((now - chirp.createdAt.getTime()) / 60000); // minutes
    return {
      chirp,
      engagement: chirp.commentCount,
      recency,
    };
  }).sort((a, b) => {
    // Sort by engagement first, then recency
    if (b.engagement !== a.engagement) {
      return b.engagement - a.engagement;
    }
    return a.recency - b.recency; // More recent first
  });
}

// Get top posts for a topic (for news generation)
export async function getTopPostsForTopic(
  topic: string,
  hours: number = 4,
  topN: number = 50
): Promise<Chirp[]> {
  const aggregated = await aggregatePostsForNews(topic, hours);
  return aggregated.slice(0, topN).map(item => item.chirp);
}

export async function getPostsForUserTopics(
  topics: string[],
  hours: number = 4,
  limitPerTopic: number = 40,
  maxTotal: number = 200
): Promise<Chirp[]> {
  if (!topics || topics.length === 0) {
    return [];
  }

  const promises = topics.map((topic) =>
    getTopPostsForTopic(topic, hours, limitPerTopic).catch((error) => {
      console.error(`[postAggregationService] Error fetching posts for ${topic}:`, error);
      return [];
    })
  );

  const results = await Promise.all(promises);
  const combined = results.flat();

  // Remove duplicates by post ID
  const dedupedMap = new Map<string, Chirp>();
  combined.forEach((post) => {
    if (!dedupedMap.has(post.id)) {
      dedupedMap.set(post.id, post);
    }
  });

  const deduped = Array.from(dedupedMap.values());

  deduped.sort((a, b) => {
    if (b.commentCount !== a.commentCount) {
      return b.commentCount - a.commentCount;
    }
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  return deduped.slice(0, Math.min(maxTotal, deduped.length));
}

