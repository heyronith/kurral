import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { userService } from '../firestore';
import type { Chirp, User } from '../../types';

export interface ReviewRequest {
  chirp: Chirp;
  priority: 'high' | 'medium' | 'low';
}

// Helper function to convert Firestore document to Chirp
// This mirrors chirpFromFirestore from firestore.ts
const toDate = (timestamp: any): Date => {
  if (timestamp?.toDate) {
    return timestamp.toDate();
  }
  if (timestamp instanceof Date) {
    return timestamp;
  }
  return new Date(timestamp);
};

const normalizeNumber = (value: any, fallback = 0): number => {
  if (typeof value === 'number' && !Number.isNaN(value)) {
    return value;
  }
  return fallback;
};

const normalizeValueVector = (raw: any): any => {
  if (!raw) return undefined;
  return {
    epistemic: normalizeNumber(raw.epistemic),
    insight: normalizeNumber(raw.insight),
    practical: normalizeNumber(raw.practical),
    relational: normalizeNumber(raw.relational),
    effort: normalizeNumber(raw.effort),
  };
};

const normalizeValueScore = (raw: any, fallbackDate: Date): any => {
  const vector = normalizeValueVector(raw);
  if (!vector) {
    return undefined;
  }
  return {
    ...vector,
    total: normalizeNumber(raw.total),
    confidence: normalizeNumber(raw.confidence, 0.5),
    updatedAt: raw.updatedAt ? toDate(raw.updatedAt) : fallbackDate,
    drivers: Array.isArray(raw.drivers) ? raw.drivers.filter((driver: any) => typeof driver === 'string') : undefined,
  };
};

const normalizeClaims = (rawClaims: any, fallbackDate: Date): any[] => {
  if (!Array.isArray(rawClaims)) {
    return [];
  }
  return rawClaims
    .map((raw, index) => {
      if (!raw || typeof raw.text !== 'string') {
        return null;
      }
      return {
        id: raw.id || `claim-${index}`,
        text: raw.text,
        type: raw.type || 'fact',
        domain: raw.domain || 'general',
        riskLevel: raw.riskLevel || 'low',
        confidence: normalizeNumber(raw.confidence, 0.5),
        extractedAt: raw.extractedAt ? toDate(raw.extractedAt) : fallbackDate,
      };
    })
    .filter(Boolean);
};

const normalizeFactChecks = (rawFactChecks: any, fallbackDate: Date): any[] => {
  if (!Array.isArray(rawFactChecks)) {
    return [];
  }
  return rawFactChecks
    .map((raw, index) => {
      if (!raw || typeof raw.claimId !== 'string') {
        return null;
      }
      return {
        id: raw.id || `fact-check-${index}`,
        claimId: raw.claimId,
        verdict: raw.verdict || 'unknown',
        confidence: normalizeNumber(raw.confidence, 0.5),
        evidence: Array.isArray(raw.evidence) ? raw.evidence : [],
        caveats: Array.isArray(raw.caveats) ? raw.caveats.filter((c: any) => typeof c === 'string') : undefined,
        checkedAt: raw.checkedAt ? toDate(raw.checkedAt) : fallbackDate,
      };
    })
    .filter(Boolean);
};

const chirpFromFirestore = (doc: any): Chirp => {
  const data = doc.data();
  const createdAt = toDate(data.createdAt);
  const claims = normalizeClaims(data.claims, createdAt);
  const factChecks = normalizeFactChecks(data.factChecks, createdAt);

  return {
    id: doc.id,
    authorId: data.authorId,
    text: data.text,
    topic: data.topic,
    semanticTopics: data.semanticTopics || [],
    entities: data.entities || [],
    intent: data.intent,
    analyzedAt: data.analyzedAt ? toDate(data.analyzedAt) : undefined,
    reachMode: data.reachMode || 'forAll',
    tunedAudience: data.tunedAudience,
    contentEmbedding: data.contentEmbedding,
    createdAt,
    rechirpOfId: data.rechirpOfId,
    quotedChirpId: data.quotedChirpId,
    commentCount: data.commentCount || 0,
    countryCode: data.countryCode,
    imageUrl: data.imageUrl,
    scheduledAt: data.scheduledAt ? toDate(data.scheduledAt) : undefined,
    formattedText: data.formattedText,
    mentions: data.mentions || [],
    factCheckingStatus: data.factCheckingStatus,
    factCheckingStartedAt: data.factCheckingStartedAt ? toDate(data.factCheckingStartedAt) : undefined,
    claims,
    factChecks,
    factCheckStatus: data.factCheckStatus,
    valueScore: normalizeValueScore(data.valueScore, createdAt),
    valueExplanation: data.valueExplanation,
  };
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
      const allChirps = snapshot.docs.map(chirpFromFirestore);

      // Filter chirps that need review
      const chirpsNeedingReview = allChirps.filter(
        (chirp) => chirp.factCheckStatus === 'needs_review'
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
