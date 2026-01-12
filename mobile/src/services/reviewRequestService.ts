import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { userService } from './userService';
import { chirpService } from './chirpService';
import type { Chirp, User, Claim, FactCheck } from '../types';

export interface ReviewRequest {
  chirp: Chirp;
  priority: 'high' | 'medium' | 'low';
}

// Helper to convert Firestore timestamps to Date objects (same as chirpService)
const toDate = (value: any): Date | undefined => {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  if (value.toDate && typeof value.toDate === 'function') return value.toDate();
  if (typeof value === 'number') return new Date(value);
  if (typeof value === 'string') return new Date(value);
  return undefined;
};

// Normalize claims array (same as chirpService)
const normalizeClaims = (claims?: Claim[]): Claim[] | undefined => {
  if (!claims || !Array.isArray(claims)) return undefined;
  return claims.map((claim) => ({
    ...claim,
    extractedAt: toDate((claim as any).extractedAt) || new Date(),
  }));
};

// Normalize factChecks array (same as chirpService)
const normalizeFactChecks = (factChecks?: FactCheck[]): FactCheck[] | undefined => {
  if (!factChecks || !Array.isArray(factChecks)) return undefined;
  return factChecks.map((factCheck) => ({
    ...factCheck,
    checkedAt: toDate((factCheck as any).checkedAt) || new Date(),
  }));
};

// Convert Firestore document to Chirp (same logic as chirpService.toChirp)
const toChirp = (docSnap: any): Chirp => {
  const data = docSnap.data();

  return {
    ...data,
    id: docSnap.id,
    createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
    scheduledAt: data.scheduledAt?.toDate ? data.scheduledAt.toDate() : undefined,
    analyzedAt: data.analyzedAt?.toDate ? data.analyzedAt.toDate() : undefined,
    commentCount: data.commentCount ?? 0,
    claims: normalizeClaims(data.claims),
    factChecks: normalizeFactChecks(data.factChecks),
  } as Chirp;
};

const calculatePriority = (chirp: Chirp, user: User): 'high' | 'medium' | 'low' => {
  // High priority: Chirp matches user's semantic topics or interests
  if (chirp.semanticTopics && user.semanticTopics) {
    const matchingTopics = chirp.semanticTopics.filter((topic) =>
      user.semanticTopics?.some((userTopic) =>
        userTopic.toLowerCase().includes(topic.toLowerCase()) ||
        topic.toLowerCase().includes(userTopic.toLowerCase())
      )
    );
    if (matchingTopics.length > 0) {
      return 'high';
    }
  }

  // Medium priority: Chirp topic matches user's topics
  if (chirp.topic && user.topics) {
    if (user.topics.includes(chirp.topic)) {
      return 'medium';
    }
  }

  // Low priority: Default for all other chirps
  return 'low';
};

export const reviewRequestService = {
  async getPendingReviewRequests(userId: string): Promise<ReviewRequest[]> {
    try {
      // Get user to match interests
      const user = await userService.getUser(userId);
      if (!user) {
        return [];
      }

      // Query recent chirps (we'll filter for needs_review status client-side)
      // Note: Firestore composite indexes would be needed to query factCheckStatus directly with orderBy
      // For MVP, we fetch recent chirps and filter
      const q = query(
        collection(db, 'chirps'),
        orderBy('createdAt', 'desc'),
        limit(100) // Fetch more than needed, then filter
      );

      const snapshot = await getDocs(q);
      const allChirps = snapshot.docs.map(toChirp);

      // Filter chirps that need review and exclude author's own posts
      const chirpsNeedingReview = allChirps.filter(
        (chirp) => 
          chirp.factCheckStatus === 'needs_review' &&
          chirp.authorId !== userId
      );

      // Convert to ReviewRequest format with priority
      const reviewRequests: ReviewRequest[] = chirpsNeedingReview.map((chirp) => ({
        chirp,
        priority: calculatePriority(chirp, user),
      }));

      // Sort by priority (high > medium > low) and return top 20
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return reviewRequests
        .sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority])
        .slice(0, 20);
    } catch (error) {
      console.error('[ReviewRequestService] Error getting pending review requests:', error);
      return [];
    }
  },
};

