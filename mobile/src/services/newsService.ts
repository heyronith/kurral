// News Service for mobile - Fetches cached trending news from Firestore
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { TrendingNews } from '../types';

const GLOBAL_USER_ID = '__global__';
const STALE_THRESHOLD = 3 * 60 * 60 * 1000; // 3 hours

// Helper to convert Firestore Timestamp to Date
const toDate = (timestamp: any): Date => {
  if (!timestamp) {
    return new Date();
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
      return new Date();
    }
    return date;
  } catch {
    return new Date();
  }
};

// Convert Firestore document to app type
const newsFromFirestore = (doc: any): TrendingNews => {
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

const isDeletedDoc = (doc: any): boolean => {
  const data = doc?.data ? doc.data() : null;
  return Boolean(data && data._deleted);
};

const getScopedUserId = (userId?: string | null): string => userId ?? GLOBAL_USER_ID;

export const newsService = {
  // Fetch cached trending news from Firestore
  async fetchTrendingNews(userId?: string | null, forceRefresh: boolean = false): Promise<TrendingNews[]> {
    const scopedUserId = getScopedUserId(userId);
    
    try {
      // First try to get user-specific news
      const userQuery = query(
        collection(db, 'trendingNews'),
        where('userId', '==', scopedUserId),
        orderBy('lastUpdated', 'desc'),
        limit(3)
      );
      
      let snapshot;
      try {
        snapshot = await getDocs(userQuery);
      } catch (error: any) {
        // If query fails (e.g., missing index), fall back to global news
        console.warn('[NewsService] User-specific query failed, falling back to global:', error.message);
        const globalQuery = query(
          collection(db, 'trendingNews'),
          where('userId', '==', GLOBAL_USER_ID),
          orderBy('lastUpdated', 'desc'),
          limit(3)
        );
        snapshot = await getDocs(globalQuery);
      }
      
      const news = snapshot.docs
        .filter((doc) => !isDeletedDoc(doc))
        .map((doc) => {
          try {
            return newsFromFirestore(doc);
          } catch (error) {
            console.error('[NewsService] Error converting news document:', doc.id, error);
            return null;
          }
        })
        .filter((news): news is TrendingNews => news !== null);
      
      // Filter out stale news if not forcing refresh
      if (!forceRefresh) {
        const now = Date.now();
        return news.filter(n => {
          const age = now - n.lastUpdated.getTime();
          return age < STALE_THRESHOLD;
        });
      }
      
      return news;
    } catch (error) {
      console.error('[NewsService] Error fetching trending news:', error);
      return [];
    }
  },

  // Get news by ID
  async getNewsById(newsId: string): Promise<TrendingNews | null> {
    try {
      const newsRef = doc(db, 'trendingNews', newsId);
      const newsSnap = await getDoc(newsRef);
      
      if (!newsSnap.exists()) {
        return null;
      }
      
      if (isDeletedDoc(newsSnap)) {
        return null;
      }
      
      return newsFromFirestore(newsSnap);
    } catch (error) {
      console.error('[NewsService] Error fetching news by ID:', error);
      return null;
    }
  },
};

