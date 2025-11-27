import { db } from '../firebase';
import { collection, doc, getDoc, setDoc, getDocs, query, orderBy, limit, Timestamp, where, } from 'firebase/firestore';
import { topicService, userService, chirpService } from '../firestore';
import { getPostsForUserTopics } from './postAggregationService';
import { generateNewsFromPosts } from './newsGenerationAgent';
import { discoverStories } from './storyDiscoveryAgent';
import { selectBestStory } from './storySelectionAgent';
// Stale threshold: 3 hours
const STALE_THRESHOLD = 3 * 60 * 60 * 1000;
const MIN_STORY_POSTS_FOR_NEWS = 5;
const GLOBAL_USER_ID = '__global__';
// In-memory lock to prevent concurrent news generation for same user
const generationLocks = new Map();
// Helper to convert Firestore Timestamp to Date
const toDate = (timestamp) => {
    if (!timestamp) {
        return new Date(); // Fallback to current date if missing
    }
    if (timestamp?.toDate) {
        return timestamp.toDate();
    }
    if (timestamp instanceof Date) {
        return timestamp;
    }
    try {
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) {
            return new Date(); // Invalid date, fallback to current date
        }
        return date;
    }
    catch {
        return new Date(); // Fallback to current date on error
    }
};
// Convert Firestore document to app type
const newsFromFirestore = (doc) => {
    const data = doc.data();
    if (!data) {
        throw new Error('Document data is missing');
    }
    return {
        id: doc.id,
        title: data.title || 'Untitled',
        description: data.description || data.summary || '',
        summary: data.summary || data.description || '',
        source: data.source || 'Platform Discussion',
        sources: data.sources || [data.source || 'Platform Discussion'],
        category: data.category || 'general',
        publishedAt: toDate(data.publishedAt),
        imageUrl: data.imageUrl,
        url: data.url,
        relatedTopics: data.relatedTopics || [],
        keywords: data.keywords || [],
        engagementCount: data.engagementCount || 0,
        lastUpdated: toDate(data.lastUpdated),
        userId: data.userId,
        storyClusterPostIds: data.storyClusterPostIds || [],
        storySignature: data.storySignature,
        sourceTopics: data.sourceTopics || [],
        confidence: data.confidence,
    };
};
// Helper to remove undefined values from an object
function removeUndefinedFields(obj) {
    const cleaned = {};
    for (const key in obj) {
        if (obj[key] !== undefined) {
            cleaned[key] = obj[key];
        }
    }
    return cleaned;
}
const simpleHash = (text) => {
    let hash = 0;
    for (let i = 0; i < text.length; i += 1) {
        hash = (hash << 5) - hash + text.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash).toString(36);
};
const createStorySignature = (story) => {
    const base = `${story.summary || ''}::${(story.keyEntities || []).join(',')}::${story.topics.join(',')}`;
    return simpleHash(base).slice(0, 16);
};
const getScopedUserId = (userId) => userId ?? GLOBAL_USER_ID;
const mapPostsById = (posts) => new Map(posts.map((post) => [post.id, post]));
const isDeletedDoc = (doc) => {
    const data = doc?.data ? doc.data() : null;
    return Boolean(data && data._deleted);
};
const ensureMinimumTopics = (topics, fallback) => {
    if (topics.length > 0) {
        return topics;
    }
    return fallback;
};
const sanitizeTopics = (topics) => Array.from(new Set(topics.map((topic) => topic.trim()).filter(Boolean)));
const DEFAULT_TOPICS = ['dev', 'startups', 'music', 'sports', 'productivity', 'design', 'politics', 'crypto'];
const getTrendingTopicNames = async (limit = 5) => {
    try {
        const trending = await topicService.getTrendingTopics(limit);
        if (trending.length > 0) {
            return trending.map((topic) => topic.name);
        }
    }
    catch (error) {
        console.error('[NewsService] Error fetching trending topics:', error);
    }
    return DEFAULT_TOPICS;
};
const resolveTopicsForUser = async (userId) => {
    if (userId) {
        try {
            const user = await userService.getUser(userId);
            // Prioritize semantic interests over legacy topics
            const semanticInterests = sanitizeTopics(user?.interests || []);
            const legacyTopics = sanitizeTopics(user?.topics || []);
            // If user has semantic interests, use those; otherwise fall back to legacy topics
            if (semanticInterests.length > 0) {
                return {
                    legacyTopics: [],
                    semanticInterests,
                };
            }
            if (legacyTopics.length > 0) {
                return {
                    legacyTopics,
                    semanticInterests: [],
                };
            }
        }
        catch (error) {
            console.error('[NewsService] Error fetching user topics:', error);
        }
    }
    // Fallback to trending topics (as legacy topics for backward compatibility)
    const trending = await getTrendingTopicNames();
    return {
        legacyTopics: trending,
        semanticInterests: [],
    };
};
// News Service
export const newsService = {
    // Fetch personalized trending news (AI-generated from user topics)
    async fetchTrendingNews(userId, forceRefresh = false) {
        const scopedUserId = getScopedUserId(userId);
        // Check if generation is already in progress for this user
        const existingLock = generationLocks.get(scopedUserId);
        if (existingLock) {
            console.log('[NewsService] Generation already in progress for scope:', scopedUserId, '- waiting...');
            return existingLock;
        }
        // Create new generation promise
        const generationPromise = this._generateNewsInternal(scopedUserId, userId, forceRefresh);
        generationLocks.set(scopedUserId, generationPromise);
        try {
            const result = await generationPromise;
            return result;
        }
        finally {
            // Remove lock after completion
            generationLocks.delete(scopedUserId);
        }
    },
    // Internal method to generate news (called with lock)
    async _generateNewsInternal(scopedUserId, userId, forceRefresh) {
        try {
            let cachedNews = await this.getCachedNews(scopedUserId);
            if (!forceRefresh && cachedNews.length > 0) {
                const newestNews = cachedNews[0];
                const age = Date.now() - newestNews.lastUpdated.getTime();
                if (age < STALE_THRESHOLD) {
                    console.log('[NewsService] Using cached news for scope:', scopedUserId);
                    return cachedNews;
                }
            }
            console.log('[NewsService] Generating personalized news for scope:', scopedUserId);
            const { legacyTopics, semanticInterests } = await resolveTopicsForUser(userId);
            let posts = [];
            let topicsForDiscovery = [];
            // Prioritize semantic interests for news generation
            if (semanticInterests.length > 0) {
                console.log('[NewsService] Using semantic interests for news generation:', semanticInterests);
                // Use semantic topic queries (more recent and relevant posts)
                // Query last 24 hours, limit per interest, max 200 total
                const interestLimit = Math.max(Math.floor(200 / semanticInterests.length), 30);
                posts = await chirpService.getChirpsBySemanticTopics(semanticInterests, interestLimit);
                // Filter to last 24 hours for news relevance
                const hours24Ago = Date.now() - (24 * 60 * 60 * 1000);
                posts = posts.filter((post) => post.createdAt.getTime() >= hours24Ago);
                // Sort by engagement (commentCount) and recency
                posts.sort((a, b) => {
                    if (b.commentCount !== a.commentCount) {
                        return b.commentCount - a.commentCount;
                    }
                    return b.createdAt.getTime() - a.createdAt.getTime();
                });
                // Limit to top 200
                posts = posts.slice(0, 200);
                // Use semantic interests for story discovery
                topicsForDiscovery = semanticInterests;
            }
            else if (legacyTopics.length > 0) {
                console.log('[NewsService] Using legacy topics for news generation:', legacyTopics);
                const sanitizedTopics = ensureMinimumTopics(legacyTopics, await getTrendingTopicNames());
                posts = await getPostsForUserTopics(sanitizedTopics, 4, 40, 200);
                topicsForDiscovery = sanitizedTopics;
            }
            else {
                // Fallback to trending topics
                const trendingTopics = await getTrendingTopicNames();
                posts = await getPostsForUserTopics(trendingTopics, 4, 40, 200);
                topicsForDiscovery = trendingTopics;
            }
            if (posts.length === 0) {
                console.warn('[NewsService] No posts available for personalized news');
                return cachedNews;
            }
            const stories = await discoverStories(posts, topicsForDiscovery);
            if (stories.length === 0) {
                console.warn('[NewsService] No stories discovered for personalized feed');
                return cachedNews;
            }
            const selection = selectBestStory(stories, cachedNews, scopedUserId);
            if (!selection.selectedStory) {
                console.warn('[NewsService] No story selected for personalized feed');
                return cachedNews;
            }
            const postMap = mapPostsById(posts);
            const storyPosts = selection.selectedStory.postIds
                .map((id) => postMap.get(id))
                .filter((post) => Boolean(post));
            if (storyPosts.length < MIN_STORY_POSTS_FOR_NEWS) {
                console.warn('[NewsService] Selected story lacks sufficient posts');
                return cachedNews;
            }
            let summary;
            try {
                summary = await generateNewsFromPosts(storyPosts, selection.selectedStory.topics[0] || topicsForDiscovery[0] || 'general', {
                    summary: selection.selectedStory.summary,
                    headlineIdea: selection.selectedStory.headlineIdea,
                    keyEntities: selection.selectedStory.keyEntities,
                    keywords: selection.selectedStory.keywords,
                    relatedTopics: selection.selectedStory.topics,
                });
            }
            catch (error) {
                console.error('[NewsService] Error generating news from posts:', error);
                // Return cached news if generation fails
                return cachedNews;
            }
            const storySignature = selection.selectedStory.storyId || createStorySignature(selection.selectedStory);
            // Check if news with this signature already exists (prevent duplicates)
            const existingNewsWithSignature = await this.checkExistingNewsBySignature(storySignature, scopedUserId);
            if (existingNewsWithSignature) {
                console.log('[NewsService] Story already covered, skipping generation. Signature:', storySignature);
                // Return existing news plus cached news, ensuring no duplicates by both ID and signature
                const seenIds = new Set();
                const seenSignatures = new Set();
                const combined = [];
                // Add existing news first if not already in cache
                if (existingNewsWithSignature.id && !seenIds.has(existingNewsWithSignature.id)) {
                    combined.push(existingNewsWithSignature);
                    seenIds.add(existingNewsWithSignature.id);
                    if (existingNewsWithSignature.storySignature) {
                        seenSignatures.add(existingNewsWithSignature.storySignature);
                    }
                }
                // Add cached news, avoiding duplicates by ID or signature
                for (const news of cachedNews) {
                    const isDuplicateById = news.id && seenIds.has(news.id);
                    const isDuplicateBySignature = news.storySignature && seenSignatures.has(news.storySignature);
                    if (!isDuplicateById && !isDuplicateBySignature) {
                        combined.push(news);
                        if (news.id)
                            seenIds.add(news.id);
                        if (news.storySignature)
                            seenSignatures.add(news.storySignature);
                    }
                }
                return combined.slice(0, 3);
            }
            const newsId = `ai_news_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            const relatedTopics = Array.from(new Set([
                ...(selection.selectedStory.topics || []),
                ...(summary.relatedTopics || []),
            ]));
            const keywords = Array.from(new Set([
                ...(selection.selectedStory.keywords || []),
                ...(summary.keywords || []),
            ]));
            const engagementCount = storyPosts.reduce((sum, post) => sum + post.commentCount, 0) || storyPosts.length;
            const news = {
                id: newsId,
                title: summary.headline,
                description: summary.fullDescription,
                summary: summary.summary,
                source: 'Platform Discussion',
                sources: ['Platform Discussion'],
                category: (selection.selectedStory.topics[0] || topicsForDiscovery[0] || 'general').toLowerCase(),
                publishedAt: new Date(),
                relatedTopics,
                keywords,
                engagementCount,
                lastUpdated: new Date(),
                userId: scopedUserId,
                storyClusterPostIds: selection.selectedStory.postIds,
                storySignature,
                sourceTopics: selection.selectedStory.topics,
                confidence: summary.confidence,
            };
            const newsRef = doc(db, 'trendingNews', newsId);
            const newsData = {
                title: news.title,
                description: news.description,
                summary: news.summary,
                source: news.source,
                sources: news.sources,
                category: news.category,
                publishedAt: Timestamp.fromDate(news.publishedAt),
                relatedTopics: news.relatedTopics,
                keywords: news.keywords,
                engagementCount: news.engagementCount,
                lastUpdated: Timestamp.now(),
                userId: scopedUserId,
                storyClusterPostIds: news.storyClusterPostIds,
                storySignature: news.storySignature,
                sourceTopics: news.sourceTopics,
                confidence: news.confidence,
            };
            if (news.imageUrl !== undefined && news.imageUrl !== null) {
                newsData.imageUrl = news.imageUrl;
            }
            if (news.url !== undefined && news.url !== null) {
                newsData.url = news.url;
            }
            const cleanedData = removeUndefinedFields(newsData);
            await setDoc(newsRef, cleanedData);
            const topicToMark = selection.selectedStory.topics[0] || news.category;
            if (topicToMark) {
                await topicService.markNewsGenerated(topicToMark);
            }
            await this.cleanupOldNews(scopedUserId);
            cachedNews = await this.getCachedNews(scopedUserId);
            // Combine new news with cached news, ensuring no duplicates by both ID and signature
            const seenIds = new Set();
            const seenSignatures = new Set();
            const combined = [];
            // Add new news first
            combined.push(news);
            seenIds.add(news.id);
            if (news.storySignature) {
                seenSignatures.add(news.storySignature);
            }
            // Add cached news, avoiding duplicates by ID or signature
            for (const existing of cachedNews) {
                const isDuplicateById = existing.id && seenIds.has(existing.id);
                const isDuplicateBySignature = existing.storySignature && seenSignatures.has(existing.storySignature);
                if (!isDuplicateById && !isDuplicateBySignature) {
                    combined.push(existing);
                    if (existing.id)
                        seenIds.add(existing.id);
                    if (existing.storySignature)
                        seenSignatures.add(existing.storySignature);
                }
            }
            return combined.slice(0, 3);
        }
        catch (error) {
            console.error('Error fetching personalized news:', error);
            const fallback = await this.getCachedNews(scopedUserId);
            if (fallback.length > 0) {
                return fallback;
            }
            throw error;
        }
    },
    // Get cached news from Firestore
    async getCachedNews(scopedUserId = GLOBAL_USER_ID) {
        try {
            const q = query(collection(db, 'trendingNews'), where('userId', '==', scopedUserId), orderBy('lastUpdated', 'desc'), limit(3));
            const snapshot = await getDocs(q);
            return snapshot.docs
                .filter((doc) => !isDeletedDoc(doc))
                .map((doc) => {
                try {
                    return newsFromFirestore(doc);
                }
                catch (error) {
                    console.error('[NewsService] Error converting news document:', doc.id, error);
                    return null;
                }
            })
                .filter((news) => news !== null);
        }
        catch (error) {
            console.error('Error fetching cached news:', error);
            return [];
        }
    },
    // Check if news with given signature already exists for this user
    async checkExistingNewsBySignature(storySignature, scopedUserId) {
        try {
            const now = Date.now();
            // Try querying with index first
            try {
                const q = query(collection(db, 'trendingNews'), where('userId', '==', scopedUserId), where('storySignature', '==', storySignature), orderBy('lastUpdated', 'desc'), limit(1));
                const snapshot = await getDocs(q);
                if (!snapshot.empty) {
                    const newsDoc = snapshot.docs.find((doc) => !isDeletedDoc(doc));
                    if (!newsDoc) {
                        return null;
                    }
                    const news = newsFromFirestore(newsDoc);
                    // Only consider it a duplicate if it's within the stale threshold
                    const age = now - news.lastUpdated.getTime();
                    if (age < STALE_THRESHOLD) {
                        return news;
                    }
                }
            }
            catch (indexError) {
                // Index might not exist yet, fallback to checking all news
                console.warn('[NewsService] Index query failed, using fallback:', indexError?.message || String(indexError));
            }
            // Fallback: check all cached news (we only keep 3 max, so this is efficient)
            const allNews = await this.getCachedNews(scopedUserId);
            const matching = allNews.find(n => n.storySignature === storySignature);
            if (matching) {
                const age = Date.now() - matching.lastUpdated.getTime();
                if (age < STALE_THRESHOLD) {
                    return matching;
                }
            }
            return null;
        }
        catch (error) {
            console.error('[NewsService] Error checking existing news by signature:', error);
            return null;
        }
    },
    // Get a specific news item by ID
    async getNewsById(newsId) {
        try {
            if (!newsId || newsId.trim() === '') {
                return null;
            }
            const newsRef = doc(db, 'trendingNews', newsId);
            const newsSnap = await getDoc(newsRef);
            if (!newsSnap.exists() || isDeletedDoc(newsSnap)) {
                return null;
            }
            return newsFromFirestore(newsSnap);
        }
        catch (error) {
            console.error('Error fetching news by ID:', error);
            return null;
        }
    },
    // Cleanup old news (keep only latest 3 per scope)
    async cleanupOldNews(scopedUserId = GLOBAL_USER_ID) {
        try {
            const q = query(collection(db, 'trendingNews'), where('userId', '==', scopedUserId), orderBy('lastUpdated', 'desc'));
            const snapshot = await getDocs(q);
            // Delete all except the latest 3
            const docsToDelete = snapshot.docs.slice(3);
            for (const docToDelete of docsToDelete) {
                await setDoc(doc(db, 'trendingNews', docToDelete.id), {
                    ...docToDelete.data(),
                    _deleted: true,
                });
            }
        }
        catch (error) {
            console.error('Error cleaning up old news:', error);
        }
    },
    // Clear cached news for a user scope from Firestore
    async clearCache(scopedUserId = GLOBAL_USER_ID) {
        try {
            const snapshot = await getDocs(query(collection(db, 'trendingNews'), where('userId', '==', scopedUserId)));
            const deletePromises = snapshot.docs.map(doc => setDoc(doc.ref, { _deleted: true }, { merge: true }));
            await Promise.all(deletePromises);
            console.log('[NewsService] Cache cleared');
        }
        catch (error) {
            console.error('Error clearing cache:', error);
        }
    },
    // Update engagement count for a news item
    async updateEngagementCount(newsId, increment = 1) {
        try {
            const newsRef = doc(db, 'trendingNews', newsId);
            const newsSnap = await getDoc(newsRef);
            if (newsSnap.exists()) {
                const currentCount = newsSnap.data().engagementCount || 0;
                await setDoc(newsRef, {
                    engagementCount: currentCount + increment,
                }, { merge: true });
            }
        }
        catch (error) {
            console.error('Error updating engagement count:', error);
        }
    },
};
