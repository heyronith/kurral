import { collection, query, where, orderBy, limit, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
// Get posts about a specific topic within a time window
export async function getPostsByTopic(topic, hours = 4, limitCount = 100) {
    const normalizedTopic = topic.trim().toLowerCase();
    if (!normalizedTopic) {
        return [];
    }
    const hoursAgo = Date.now() - hours * 60 * 60 * 1000;
    const timestamp = Timestamp.fromMillis(hoursAgo);
    const mapDocToChirp = (doc) => {
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
        };
    };
    const fetchChirps = async (constraints) => {
        const collectionRef = collection(db, 'chirps');
        try {
            const q = query(collectionRef, ...constraints, orderBy('createdAt', 'desc'), limit(limitCount));
            const snapshot = await getDocs(q);
            const posts = snapshot.docs.map(mapDocToChirp);
            console.log(`[postAggregationService] Query succeeded: found ${posts.length} posts`);
            return posts;
        }
        catch (error) {
            console.warn('[postAggregationService] Ordered query failed (may need index):', error.message);
            try {
                const q = query(collectionRef, ...constraints, limit(limitCount));
                const fallbackSnapshot = await getDocs(q);
                const posts = fallbackSnapshot.docs.map(mapDocToChirp);
                const sorted = posts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
                console.log(`[postAggregationService] Fallback query succeeded: found ${sorted.length} posts`);
                return sorted;
            }
            catch (fallbackError) {
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
    const deduped = Array.from(combined.reduce((acc, chirp) => {
        if (!acc.has(chirp.id)) {
            acc.set(chirp.id, chirp);
        }
        return acc;
    }, new Map())
        .values());
    deduped.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const result = deduped.slice(0, limitCount);
    console.log(`[postAggregationService] Returning ${result.length} unique posts for topic "${normalizedTopic}"`);
    return result;
}
// Aggregate posts with engagement metrics for news generation
export async function aggregatePostsForNews(topic, hours = 4) {
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
export async function getTopPostsForTopic(topic, hours = 4, topN = 50) {
    const aggregated = await aggregatePostsForNews(topic, hours);
    return aggregated.slice(0, topN).map(item => item.chirp);
}
export async function getPostsForUserTopics(topics, hours = 4, limitPerTopic = 40, maxTotal = 200) {
    if (!topics || topics.length === 0) {
        return [];
    }
    const promises = topics.map((topic) => getTopPostsForTopic(topic, hours, limitPerTopic).catch((error) => {
        console.error(`[postAggregationService] Error fetching posts for ${topic}:`, error);
        return [];
    }));
    const results = await Promise.all(promises);
    const combined = results.flat();
    // Remove duplicates by post ID
    const dedupedMap = new Map();
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
