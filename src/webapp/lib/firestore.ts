// Firestore service layer - abstracts data access
// For MVP, we'll use mock data, but structure allows easy swap to Firestore
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  addDoc,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  increment,
  Timestamp,
  QueryConstraint,
  onSnapshot,
  Unsubscribe,
  deleteField,
  writeBatch,
  startAfter,
} from 'firebase/firestore';
import { db } from './firebase';
import type {
  Chirp,
  Comment,
  User,
  FirestoreChirp,
  FirestoreComment,
  FirestoreUser,
  TopicMetadata,
  FirestoreTopicMetadata,
  Topic,
  CommentTreeNode,
  PostReviewContext,
  FirestorePostReviewContext,
  PostReviewAction,
  Claim,
  FactCheck,
  ValueScore,
  DiscussionQuality,
  ValueVector,
  KurralScore,
  KurralScoreHistoryEntry,
} from '../types';
import { DEFAULT_FOR_YOU_CONFIG } from '../types';
import { notificationService } from './services/notificationService';
import { processChirpValue } from './services/valuePipelineService';

// Helper to convert Firestore Timestamp to Date
const toDate = (timestamp: any): Date => {
  if (timestamp?.toDate) {
    return timestamp.toDate();
  }
  if (timestamp instanceof Date) {
    return timestamp;
  }
  return new Date(timestamp);
};

const chunkArray = <T>(items: T[], chunkSize: number): T[][] => {
  if (chunkSize <= 0) {
    return [items];
  }

  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
};

const dedupeChirps = (chirps: Chirp[]): Chirp[] => {
  const map = new Map<string, Chirp>();
  chirps.forEach((chirp) => {
    const existing = map.get(chirp.id);
    if (!existing || existing.createdAt < chirp.createdAt) {
      map.set(chirp.id, chirp);
    }
  });
  return Array.from(map.values()).sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );
};

const normalizeNumber = (value: any, fallback = 0): number => {
  if (typeof value === 'number' && !Number.isNaN(value)) {
    return value;
  }
  return fallback;
};

const normalizeValueVector = (raw: any): ValueVector | undefined => {
  if (!raw) return undefined;
  const vector = {
    epistemic: normalizeNumber(raw.epistemic),
    insight: normalizeNumber(raw.insight),
    practical: normalizeNumber(raw.practical),
    relational: normalizeNumber(raw.relational),
    effort: normalizeNumber(raw.effort),
  };

  const hasSignal = Object.values(vector).some((num) => num > 0);
  return hasSignal ? vector : undefined;
};

const normalizeClaims = (rawClaims: any, fallbackDate: Date): Claim[] => {
  if (!Array.isArray(rawClaims)) {
    return [];
  }

  return rawClaims
    .map((raw, index) => {
      if (!raw || typeof raw.text !== 'string') {
        return null;
      }
      const evidence = Array.isArray(raw.evidence)
        ? raw.evidence
            .filter((item: any) => item && typeof item.source === 'string' && typeof item.snippet === 'string')
            .map((item: any) => ({
              source: item.source,
              url: typeof item.url === 'string' ? item.url : undefined,
              snippet: item.snippet,
              quality: normalizeNumber(item.quality, 0.5),
            }))
        : undefined;

      return {
        id: raw.id || `claim-${index}`,
        text: raw.text,
        type: raw.type || 'fact',
        domain: raw.domain || 'general',
        riskLevel: raw.riskLevel || 'low',
        confidence: normalizeNumber(raw.confidence, 0.5),
        extractedAt: raw.extractedAt ? toDate(raw.extractedAt) : fallbackDate,
        evidence,
      } as Claim;
    })
    .filter((claim): claim is Claim => Boolean(claim));
};

const normalizeFactChecks = (rawFactChecks: any, fallbackDate: Date): FactCheck[] => {
  if (!Array.isArray(rawFactChecks)) {
    return [];
  }

  return rawFactChecks
    .map((raw, index) => {
      if (!raw || typeof raw.claimId !== 'string') {
        return null;
      }

      const evidence = Array.isArray(raw.evidence)
        ? raw.evidence
            .filter((item: any) => item && typeof item.source === 'string' && typeof item.snippet === 'string')
            .map((item: any) => ({
              source: item.source,
              url: typeof item.url === 'string' ? item.url : undefined,
              snippet: item.snippet,
              quality: normalizeNumber(item.quality, 0.5),
            }))
        : [];

      return {
        id: raw.id || `fact-check-${index}`,
        claimId: raw.claimId,
        verdict: raw.verdict || 'unknown',
        confidence: normalizeNumber(raw.confidence, 0.5),
        evidence,
        caveats: Array.isArray(raw.caveats) ? raw.caveats.filter((c: any) => typeof c === 'string') : undefined,
        checkedAt: raw.checkedAt ? toDate(raw.checkedAt) : fallbackDate,
      } as FactCheck;
    })
    .filter((factCheck): factCheck is FactCheck => Boolean(factCheck));
};

const normalizeValueScore = (raw: any, fallbackDate: Date): ValueScore | undefined => {
  const vector = normalizeValueVector(raw);
  if (!vector) {
    return undefined;
  }

  const total = normalizeNumber(raw.total, Object.values(vector).reduce((sum, val) => sum + val, 0));
  const confidence = normalizeNumber(raw.confidence, 0.5);
  return {
    ...vector,
    total,
    confidence,
    updatedAt: raw.updatedAt ? toDate(raw.updatedAt) : fallbackDate,
    drivers: Array.isArray(raw.drivers) ? raw.drivers.filter((driver: any) => typeof driver === 'string') : undefined,
  };
};

const normalizeDiscussionQuality = (raw: any): DiscussionQuality | undefined => {
  if (!raw) return undefined;
  const quality: DiscussionQuality = {
    informativeness: normalizeNumber(raw.informativeness),
    civility: normalizeNumber(raw.civility),
    reasoningDepth: normalizeNumber(raw.reasoningDepth),
    crossPerspective: normalizeNumber(raw.crossPerspective),
    summary: raw.summary || '',
  };
  const hasSignal = Object.values(quality).some((value) => (typeof value === 'number' ? value > 0 : Boolean(value)));
  return hasSignal ? quality : undefined;
};

const normalizeValueContribution = (raw: any): (ValueVector & { total: number }) | undefined => {
  const vector = normalizeValueVector(raw);
  if (!vector) return undefined;
  const total = normalizeNumber(raw.total, Object.values(vector).reduce((sum, val) => sum + val, 0));
  return {
    ...vector,
    total,
  };
};

const timestampField = (value?: Date): any => {
  if (!value) return undefined;
  return Timestamp.fromDate(value);
};

const serializeClaims = (claims?: Claim[]) => {
  if (!claims || claims.length === 0) return undefined;
  return claims.map((claim) => ({
    ...claim,
    extractedAt: timestampField(claim.extractedAt),
    evidence: claim.evidence?.map((evidence) => ({
      ...evidence,
    })),
  }));
};

const serializeFactChecks = (factChecks?: FactCheck[]) => {
  if (!factChecks || factChecks.length === 0) return undefined;
  return factChecks.map((factCheck) => ({
    ...factCheck,
    checkedAt: timestampField(factCheck.checkedAt),
    evidence: factCheck.evidence?.map((evidence) => ({
      ...evidence,
    })),
  }));
};

const serializeValueScore = (valueScore?: ValueScore) => {
  if (!valueScore) return undefined;
  const { updatedAt, ...rest } = valueScore;
  return {
    ...rest,
    updatedAt: timestampField(updatedAt),
  };
};

const serializeDiscussionQuality = (quality?: DiscussionQuality) => {
  if (!quality) return undefined;
  return { ...quality };
};

const serializeValueContribution = (value?: ValueVector & { total: number }) => {
  if (!value) return undefined;
  return { ...value };
};

const normalizeKurralScoreHistory = (history?: any[]): KurralScoreHistoryEntry[] => {
  if (!Array.isArray(history)) {
    return [];
  }
  return history.map((entry) => {
    let score = normalizeNumber(entry?.score);
    // Clamp score to 0-100 range (migration from old 300-850 scale)
    if (score > 100) {
      if (score >= 300 && score <= 850) {
        score = ((score - 300) / (850 - 300)) * 100;
      }
      score = Math.max(0, Math.min(100, score));
    } else {
      score = Math.max(0, Math.min(100, score));
    }
    return {
      score: Math.round(score),
      delta: normalizeNumber(entry?.delta),
      reason: entry?.reason || 'score_update',
      date: entry?.date ? toDate(entry.date) : new Date(),
    };
  });
};

const normalizeKurralScore = (raw?: any): KurralScore | undefined => {
  if (!raw) {
    return undefined;
  }

  const components = raw.components || {};
  let score = normalizeNumber(raw.score);

  // Clamp score to 0-100 range (migration from old 300-850 scale)
  // If score is > 100, it's likely from old scale, so convert it
  if (score > 100) {
    // Old scale was 300-850, new scale is 0-100
    // Convert: (oldScore - 300) / (850 - 300) * 100
    // But also handle any score > 100 by clamping
    if (score >= 300 && score <= 850) {
      score = ((score - 300) / (850 - 300)) * 100;
    }
    // Clamp to 0-100 regardless
    score = Math.max(0, Math.min(100, score));
  } else {
    // Ensure it's in 0-100 range
    score = Math.max(0, Math.min(100, score));
  }

  // Clamp components to 0-100 range as well
  const clampComponent = (val: number) => Math.max(0, Math.min(100, val));

  return {
    score: Math.round(score),
    lastUpdated: raw.lastUpdated ? toDate(raw.lastUpdated) : new Date(),
    components: {
      qualityHistory: clampComponent(normalizeNumber(components.qualityHistory)),
      violationHistory: clampComponent(normalizeNumber(components.violationHistory)),
      engagementQuality: clampComponent(normalizeNumber(components.engagementQuality)),
      consistency: clampComponent(normalizeNumber(components.consistency)),
      communityTrust: clampComponent(normalizeNumber(components.communityTrust)),
    },
    history: normalizeKurralScoreHistory(raw.history),
  };
};

// Convert Firestore document to app type
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
    semanticTopicBuckets: data.semanticTopicBuckets || {},
    entities: data.entities || [],
    intent: data.intent,
    analyzedAt: data.analyzedAt ? toDate(data.analyzedAt) : undefined,
    reachMode: data.reachMode,
    tunedAudience: data.tunedAudience,
    createdAt: toDate(data.createdAt),
    rechirpOfId: data.rechirpOfId,
    quotedChirpId: data.quotedChirpId,
    commentCount: data.commentCount || 0,
    countryCode: data.countryCode,
    imageUrl: data.imageUrl,
    scheduledAt: data.scheduledAt ? toDate(data.scheduledAt) : undefined,
    formattedText: data.formattedText,
    mentions: data.mentions || [],
    contentEmbedding: data.contentEmbedding,
    claims,
    factChecks,
    factCheckStatus: data.factCheckStatus,
    factCheckingStatus: data.factCheckingStatus,
    factCheckingStartedAt: data.factCheckingStartedAt ? toDate(data.factCheckingStartedAt) : undefined,
    valueScore: normalizeValueScore(data.valueScore, createdAt),
    valueExplanation: data.valueExplanation,
    discussionQuality: normalizeDiscussionQuality(data.discussionQuality),
  };
};

const commentFromFirestore = (doc: any): Comment => {
  const data = doc.data();
  const createdAt = toDate(data.createdAt);
  const claims = normalizeClaims(data.claims, createdAt);
  const factChecks = normalizeFactChecks(data.factChecks, createdAt);
  return {
    id: doc.id,
    chirpId: data.chirpId,
    authorId: data.authorId,
    text: data.text,
    createdAt: createdAt,
    parentCommentId: data.parentCommentId || undefined,
    replyToUserId: data.replyToUserId || undefined,
    depth: data.depth !== undefined ? data.depth : undefined,
    replyCount: data.replyCount || 0,
    discussionRole: data.discussionRole,
    valueContribution: normalizeValueContribution(data.valueContribution),
    imageUrl: data.imageUrl || undefined,
    formattedText: data.formattedText || undefined,
    scheduledAt: data.scheduledAt ? toDate(data.scheduledAt) : undefined,
    factCheckingStatus: data.factCheckingStatus,
    factCheckingStartedAt: data.factCheckingStartedAt ? toDate(data.factCheckingStartedAt) : undefined,
    claims,
    factChecks,
    factCheckStatus: data.factCheckStatus,
  };
};

const userFromFirestore = (doc: any): User => {
  const data = doc.data();
  return {
    id: doc.id,
    name: data.name,
    handle: data.handle,
    email: data.email,
    createdAt: toDate(data.createdAt),
    following: data.following || [],
    bookmarks: data.bookmarks || [],
    interests: data.interests || [],
    displayName: data.displayName,
    userId: data.userId,
    topics: data.topics || [],
    bio: data.bio,
    url: data.url,
    location: data.location,
    onboardingCompleted: data.onboardingCompleted || false,
    onboardingCompletedAt: data.onboardingCompletedAt ? toDate(data.onboardingCompletedAt) : undefined,
    firstTimeUser: data.firstTimeUser !== undefined ? data.firstTimeUser : true,
    autoFollowedAccounts: data.autoFollowedAccounts || [],
    profilePictureUrl: data.profilePictureUrl,
    coverPhotoUrl: data.coverPhotoUrl,
    reputation: data.reputation || {},
    valueStats: data.valueStats
      ? {
          postValue30d: normalizeNumber(data.valueStats.postValue30d),
          commentValue30d: normalizeNumber(data.valueStats.commentValue30d),
          lifetimePostValue: normalizeNumber(data.valueStats.lifetimePostValue),
          lifetimeCommentValue: normalizeNumber(data.valueStats.lifetimeCommentValue),
          lastUpdated: data.valueStats.lastUpdated ? toDate(data.valueStats.lastUpdated) : toDate(data.createdAt),
        }
      : undefined,
    kurralScore: normalizeKurralScore(data.kurralScore),
    forYouConfig: data.forYouConfig
      ? {
          ...DEFAULT_FOR_YOU_CONFIG,
          ...data.forYouConfig,
        }
      : undefined,
    profileSummary: data.profileSummary,
    profileSummaryVersion: data.profileSummaryVersion,
    profileSummaryUpdatedAt: data.profileSummaryUpdatedAt ? toDate(data.profileSummaryUpdatedAt) : undefined,
    profileEmbedding: data.profileEmbedding,
    profileEmbeddingVersion: data.profileEmbeddingVersion,
    semanticTopics: data.semanticTopics || [],
  };
};

// Chirp operations
export const chirpService = {
  // Get chirps from followed users, sorted by createdAt DESC
  async getLatestChirps(followingIds: string[], limitCount: number = 50): Promise<Chirp[]> {
    if (followingIds.length === 0) return [];
    
    try {
      const constraints: QueryConstraint[] = [
        where('authorId', 'in', followingIds),
        orderBy('createdAt', 'desc'),
        limit(limitCount),
      ];
      
      const q = query(collection(db, 'chirps'), ...constraints);
      const snapshot = await getDocs(q);
      const now = new Date();
      return snapshot.docs
        .map(chirpFromFirestore)
        .filter(chirp => {
          // Filter out scheduled posts that haven't been published yet
          if (chirp.scheduledAt && chirp.scheduledAt > now) {
            return false;
          }
          return true;
        });
    } catch (error) {
      console.error('Error fetching latest chirps:', error);
      return [];
    }
  },

  // Get all recent chirps (for For You feed candidate pool)
  async getRecentChirps(limitCount: number = 100): Promise<Chirp[]> {
    try {
      const q = query(
        collection(db, 'chirps'),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );
      const snapshot = await getDocs(q);
      const now = new Date();
      return snapshot.docs
        .map(chirpFromFirestore)
        .filter(chirp => {
          // Filter out scheduled posts that haven't been published yet
          if (chirp.scheduledAt && chirp.scheduledAt > now) {
            return false;
          }
          return true;
        });
    } catch (error) {
      console.error('Error fetching recent chirps:', error);
      return [];
    }
  },

  async getChirpsBySemanticTopics(
    topics: string[],
    limitPerBatch: number = 50
  ): Promise<Chirp[]> {
    const normalizedTopics = Array.from(
      new Set(
        topics
          .map((topic) => topic?.trim().toLowerCase())
          .filter((topic): topic is string => Boolean(topic))
      )
    );

    if (normalizedTopics.length === 0) {
      return [];
    }

    const batches = chunkArray(normalizedTopics, 10);
    const now = new Date();

    try {
      const results = await Promise.all(
        batches.map(async (batch) => {
          const q = query(
            collection(db, 'chirps'),
            where('semanticTopics', 'array-contains-any', batch),
            orderBy('createdAt', 'desc'),
            limit(limitPerBatch)
          );
          const snapshot = await getDocs(q);
          return snapshot.docs
            .map(chirpFromFirestore)
            .filter((chirp) => {
              if (chirp.scheduledAt && chirp.scheduledAt > now) {
                return false;
              }
              return true;
            });
        })
      );

      return dedupeChirps(results.flat());
    } catch (error) {
      console.error('Error fetching semantic topic chirps:', error);
      return [];
    }
  },

  async getPersonalizedChirps(
    user: User,
    limitCount: number = 120
  ): Promise<Chirp[]> {
    const interests = user.interests || [];
    const followingIds = user.following || [];

    // If no personalization data exists, fall back to recent posts
    if (interests.length === 0 && followingIds.length === 0) {
      return this.getRecentChirps(limitCount);
    }

    const interestLimit = Math.max(Math.floor(limitCount * 0.6), 40);
    const followingLimit = Math.max(Math.floor(limitCount * 0.4), 40);

    try {
      const [interestChirps, followingChirps] = await Promise.all([
        interests.length > 0
          ? this.getChirpsBySemanticTopics(interests, interestLimit)
          : Promise.resolve<Chirp[]>([]),
        followingIds.length > 0
          ? Promise.all(
              chunkArray(followingIds, 10).map((chunk) =>
                this.getLatestChirps(chunk, Math.ceil(followingLimit / (chunk.length || 1)))
              )
            ).then((chunks) => dedupeChirps(chunks.flat()))
          : Promise.resolve<Chirp[]>([]),
      ]);

      const combined = dedupeChirps([...interestChirps, ...followingChirps]);
      return combined.slice(0, limitCount);
    } catch (error) {
      console.error('Error fetching personalized chirps:', error);
      return this.getRecentChirps(limitCount);
    }
  },

  // Get chirps by author
  async getChirpsByAuthor(authorId: string, limitCount: number = 50): Promise<Chirp[]> {
    try {
      const q = query(
        collection(db, 'chirps'),
        where('authorId', '==', authorId),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );
      const snapshot = await getDocs(q);
      const now = new Date();
      return snapshot.docs
        .map(chirpFromFirestore)
        .filter(chirp => {
          // Filter out scheduled posts that haven't been published yet
          if (chirp.scheduledAt && chirp.scheduledAt > now) {
            return false;
          }
          return true;
        });
    } catch (error) {
      console.error('Error fetching chirps by author:', error);
      return [];
    }
  },

  // Get a single chirp by ID
  async getChirp(chirpId: string): Promise<Chirp | null> {
    try {
      const docSnap = await getDoc(doc(db, 'chirps', chirpId));
      if (!docSnap.exists()) return null;
      return chirpFromFirestore(docSnap);
    } catch (error) {
      console.error('Error fetching chirp:', error);
      return null;
    }
  },

  // Get chirps that need fact-checking (pending or in_progress)
  async getChirpsNeedingFactCheck(authorId: string): Promise<Chirp[]> {
    try {
      const q = query(
        collection(db, 'chirps'),
        where('authorId', '==', authorId),
        where('factCheckingStatus', 'in', ['pending', 'in_progress']),
        orderBy('createdAt', 'desc'),
        limit(10)
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(chirpFromFirestore);
    } catch (error) {
      console.error('Error getting chirps needing fact check:', error);
      return [];
    }
  },

  // Get all rechirps (reposts) of a specific original chirp
  async getRechirpsOfOriginal(originalChirpId: string): Promise<Chirp[]> {
    try {
      const q = query(
        collection(db, 'chirps'),
        where('rechirpOfId', '==', originalChirpId),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(chirpFromFirestore);
    } catch (error) {
      console.error('Error getting rechirps of original:', error);
      return [];
    }
  },

  // Get all pending rechirps waiting for their original to complete fact-checking
  // Note: Firestore doesn't support != null queries, so we query by status and filter client-side
  async getPendingRechirps(limitCount: number = 50): Promise<Chirp[]> {
    try {
      const q = query(
        collection(db, 'chirps'),
        where('factCheckingStatus', '==', 'pending'),
        orderBy('createdAt', 'desc'),
        limit(limitCount * 2) // Get more to filter, since some might not be rechirps
      );

      const snapshot = await getDocs(q);
      // Filter to only rechirps (those with rechirpOfId)
      return snapshot.docs
        .map(chirpFromFirestore)
        .filter(chirp => !!chirp.rechirpOfId)
        .slice(0, limitCount);
    } catch (error) {
      console.error('Error getting pending rechirps:', error);
      return [];
    }
  },

  // Create a new chirp
  async createChirp(chirp: Omit<Chirp, 'id' | 'createdAt' | 'commentCount'>): Promise<Chirp> {
    try {
      // Remove undefined fields - Firestore doesn't allow undefined values
      const chirpData: any = {
        authorId: chirp.authorId,
        text: chirp.text,
        topic: chirp.topic,
        reachMode: chirp.reachMode,
        createdAt: Timestamp.now(),
        commentCount: 0,
      };
      
      // Only include tunedAudience if it exists and is not undefined
      if (chirp.tunedAudience) {
        chirpData.tunedAudience = chirp.tunedAudience;
      }
      
      // Only include rechirpOfId if it exists
      if (chirp.rechirpOfId) {
        chirpData.rechirpOfId = chirp.rechirpOfId;
      }

      // Only include quotedChirpId if it exists
      if (chirp.quotedChirpId) {
        chirpData.quotedChirpId = chirp.quotedChirpId;
      }
      
      // Initialize fact checking status for resume capability
      chirpData.factCheckingStatus = 'pending';
      chirpData.factCheckingStartedAt = Timestamp.now();

      // Include new optional fields
      if (chirp.imageUrl) {
        chirpData.imageUrl = chirp.imageUrl;
      }
      if (chirp.countryCode) {
        chirpData.countryCode = chirp.countryCode;
      }
      
      if (chirp.scheduledAt) {
        chirpData.scheduledAt = Timestamp.fromDate(chirp.scheduledAt);
      }
      
      if (chirp.formattedText) {
        chirpData.formattedText = chirp.formattedText;
      }

      if (chirp.mentions && chirp.mentions.length > 0) {
        chirpData.mentions = chirp.mentions;
      }

      if (chirp.semanticTopics && chirp.semanticTopics.length > 0) {
        chirpData.semanticTopics = chirp.semanticTopics;
      }

      if (chirp.semanticTopicBuckets && Object.keys(chirp.semanticTopicBuckets).length > 0) {
        chirpData.semanticTopicBuckets = chirp.semanticTopicBuckets;
      }

      if (chirp.entities && chirp.entities.length > 0) {
        chirpData.entities = chirp.entities;
      }

      if (chirp.intent) {
        chirpData.intent = chirp.intent;
      }

      if (chirp.analyzedAt) {
        chirpData.analyzedAt = Timestamp.fromDate(chirp.analyzedAt);
      }

      // Initialize fact checking status for resume capability
      chirpData.factCheckingStatus = 'pending';
      chirpData.factCheckingStartedAt = Timestamp.now();

      if (chirp.claims && chirp.claims.length > 0) {
        chirpData.claims = serializeClaims(chirp.claims);
      }

      if (chirp.factChecks && chirp.factChecks.length > 0) {
        chirpData.factChecks = serializeFactChecks(chirp.factChecks);
      }

      if (chirp.factCheckStatus) {
        chirpData.factCheckStatus = chirp.factCheckStatus;
      }

      if (chirp.valueScore) {
        chirpData.valueScore = serializeValueScore(chirp.valueScore);
      }

      if (chirp.valueExplanation) {
        chirpData.valueExplanation = chirp.valueExplanation;
      }

      if (chirp.discussionQuality) {
        chirpData.discussionQuality = serializeDiscussionQuality(chirp.discussionQuality);
      }

      // Include content embedding if available
      if (chirp.contentEmbedding && chirp.contentEmbedding.length > 0) {
        chirpData.contentEmbedding = chirp.contentEmbedding;
      }
      
      const docRef = await addDoc(collection(db, 'chirps'), chirpData);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        throw new Error('Failed to create chirp');
      }
      const newChirp = chirpFromFirestore(docSnap);

      // Create notifications for mentions
      if (chirp.mentions && chirp.mentions.length > 0) {
        chirp.mentions.forEach(mentionedUserId => {
          if (mentionedUserId !== chirp.authorId) {
            notificationService.createNotification({
              userId: mentionedUserId,
              type: 'mention',
              actorId: chirp.authorId,
              chirpId: newChirp.id,
            }).catch(err => {
              // Silently fail - notification errors shouldn't block posting
              if (!err.message?.includes('disabled') && !err.message?.includes('muted')) {
                console.error('Error creating mention notification:', err);
              }
            });
          }
        });
      }
      
      // Create notification if this is a rechirp
      if (chirp.rechirpOfId && chirp.authorId) {
        try {
          const originalChirpDoc = await getDoc(doc(db, 'chirps', chirp.rechirpOfId));
          const originalChirpData = originalChirpDoc.data();
          if (originalChirpData && originalChirpData.authorId !== chirp.authorId) {
            await notificationService.createNotification({
              userId: originalChirpData.authorId,
              type: 'rechirp',
              actorId: chirp.authorId,
              chirpId: chirp.rechirpOfId, // Original chirp ID
              metadata: {
                originalChirpId: chirp.rechirpOfId,
              },
            }).catch(err => {
              // Silently fail - notification errors shouldn't block rechirps
              if (!err.message?.includes('disabled') && !err.message?.includes('muted')) {
                console.error('Error creating rechirp notification:', err);
              }
            });
          }
        } catch (notifError: any) {
          // Don't let notification errors break rechirp creation
          if (!notifError.message?.includes('disabled') && !notifError.message?.includes('muted')) {
            console.error('Error creating rechirp notification:', notifError);
          }
        }
      }
      
      return newChirp;
    } catch (error) {
      console.error('Error creating chirp:', error);
      throw error;
    }
  },

  async updateChirpInsights(
    chirpId: string,
    insights: {
      claims?: Claim[];
      factChecks?: FactCheck[];
      factCheckStatus?: 'clean' | 'needs_review' | 'blocked';
      valueScore?: ValueScore;
      valueExplanation?: string;
      discussionQuality?: DiscussionQuality;
      factCheckingStatus?: 'pending' | 'in_progress' | 'completed' | 'failed' | null;
      factCheckingStartedAt?: Date | null;
    }
  ): Promise<void> {
    const updates: Record<string, any> = {};

    if (insights.claims !== undefined && insights.claims !== null) {
      const serialized = serializeClaims(insights.claims);
      if (serialized !== undefined && serialized !== null) {
        updates.claims = serialized;
      }
    }
    if (insights.factChecks !== undefined && insights.factChecks !== null) {
      const serialized = serializeFactChecks(insights.factChecks);
      if (serialized !== undefined && serialized !== null) {
        updates.factChecks = serialized;
      }
    }
    if (insights.factCheckStatus !== undefined && insights.factCheckStatus !== null) {
      updates.factCheckStatus = insights.factCheckStatus;
    }
    if (insights.factCheckingStatus !== undefined) {
      if (insights.factCheckingStatus === null) {
        updates.factCheckingStatus = deleteField();
      } else {
        updates.factCheckingStatus = insights.factCheckingStatus;
      }
    }
    if (insights.factCheckingStartedAt !== undefined) {
      if (insights.factCheckingStartedAt === null) {
        updates.factCheckingStartedAt = deleteField();
      } else {
        updates.factCheckingStartedAt = insights.factCheckingStartedAt;
      }
    }
    if (insights.valueScore !== undefined && insights.valueScore !== null) {
      const serialized = serializeValueScore(insights.valueScore);
      if (serialized !== undefined && serialized !== null) {
        updates.valueScore = serialized;
      }
    }
    if (typeof insights.valueExplanation === 'string' && insights.valueExplanation.trim().length > 0) {
      updates.valueExplanation = insights.valueExplanation;
    }
    if (insights.discussionQuality !== undefined && insights.discussionQuality !== null) {
      const serialized = serializeDiscussionQuality(insights.discussionQuality);
      if (serialized !== undefined && serialized !== null) {
        updates.discussionQuality = serialized;
      }
    }

    // Remove any undefined values from updates (safety check)
    // Also recursively clean nested objects
    const cleanUpdates = (obj: any): any => {
      if (obj === null || typeof obj !== 'object' || obj instanceof Date) {
        return obj;
      }
      if (Array.isArray(obj)) {
        return obj.map(cleanUpdates).filter(item => item !== undefined);
      }
      const cleaned: Record<string, any> = {};
      for (const [key, value] of Object.entries(obj)) {
        if (value !== undefined) {
          const cleanedValue = cleanUpdates(value);
          if (cleanedValue !== undefined) {
            cleaned[key] = cleanedValue;
      }
        }
      }
      return cleaned;
    };
    
    const cleanedUpdates = cleanUpdates(updates);

    if (Object.keys(cleanedUpdates).length === 0) {
      return;
    }

    await updateDoc(doc(db, 'chirps', chirpId), cleanedUpdates);
  },

  // Delete a chirp and all its comments
  async deleteChirp(chirpId: string, authorId: string): Promise<void> {
    try {
      // Verify the chirp exists and user is the author
      const chirpDoc = await getDoc(doc(db, 'chirps', chirpId));
      if (!chirpDoc.exists()) {
        throw new Error('Chirp not found');
      }
      const chirpData = chirpDoc.data();
      if (chirpData.authorId !== authorId) {
        throw new Error('Unauthorized: Only the author can delete this chirp');
      }

      // Get all comments for this chirp (including nested replies)
      const commentsQuery = query(
        collection(db, 'comments'),
        where('chirpId', '==', chirpId)
      );
      const commentsSnapshot = await getDocs(commentsQuery);

      // Use batch to delete chirp and all comments atomically
      const batch = writeBatch(db);
      
      // Delete the chirp
      batch.delete(doc(db, 'chirps', chirpId));
      
      // Delete all comments
      commentsSnapshot.docs.forEach((commentDoc) => {
        batch.delete(commentDoc.ref);
      });

      await batch.commit();
    } catch (error) {
      console.error('Error deleting chirp:', error);
      throw error;
    }
  },

  // Process scheduled posts for a specific author
  async processScheduledPosts(authorId?: string | null): Promise<void> {
    if (!authorId) {
      return;
    }

    try {
      const now = Timestamp.now();
      const q = query(
        collection(db, 'chirps'),
        where('authorId', '==', authorId),
        where('scheduledAt', '<=', now),
        orderBy('scheduledAt', 'asc'),
        limit(50)
      );
      
      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        return;
      }
      
      const batch = writeBatch(db);
      snapshot.docs.forEach((docSnap) => {
        batch.update(docSnap.ref, {
              scheduledAt: deleteField(),
            });
      });
      
        await batch.commit();
      console.log(`[ScheduledPosts] Published scheduled chirps for user ${authorId}`);

      // Trigger fact-checking for published posts
      // We do this after commit so the post is officially "live" without scheduledAt
      // We use fire-and-forget pattern so we don't block or throw if AI fails
      snapshot.docs.forEach(async (docSnap) => {
        try {
          // We can construct the Chirp object from the docSnap
          // The scheduledAt field is technically deleted in DB but still in docSnap data
          // We should construct it and manually ensure scheduledAt is undefined for processing
          const chirp = chirpFromFirestore(docSnap);
          
          // Manually clear scheduledAt as it's now published
          const liveChirp = {
            ...chirp,
            scheduledAt: undefined
          };

          console.log(`[ScheduledPosts] Triggering fact-checking for published post ${liveChirp.id}`);
          await processChirpValue(liveChirp);
        } catch (error) {
          console.error(`[ScheduledPosts] Error triggering fact-check for post ${docSnap.id}:`, error);
        }
      });
    } catch (error) {
      console.error('Error processing scheduled posts:', error);
    }
  },
};

// User operations
export const userService = {
  async getUser(userId: string): Promise<User | null> {
    try {
      const docSnap = await getDoc(doc(db, 'users', userId));
      if (!docSnap.exists()) return null;
      return userFromFirestore(docSnap);
    } catch (error) {
      console.error('Error fetching user:', error);
      return null;
    }
  },

  async getUserByHandle(handle: string): Promise<User | null> {
    try {
      const q = query(collection(db, 'users'), where('handle', '==', handle.toLowerCase()), limit(1));
      const snapshot = await getDocs(q);
      if (snapshot.empty) return null;
      return userFromFirestore(snapshot.docs[0]);
    } catch (error) {
      console.error('Error fetching user by handle:', error);
      return null;
    }
  },

  async getBots(limitCount: number = 20): Promise<User[]> {
    try {
      const botsQuery = query(
        collection(db, 'users'),
        where('isBot', '==', true),
        limit(limitCount)
      );
      const snapshot = await getDocs(botsQuery);
      return snapshot.docs.map(userFromFirestore);
    } catch (error) {
      console.error('Error fetching bot profiles:', error);
      return [];
    }
  },

  async searchUsers(searchQuery: string, limitCount: number = 5): Promise<User[]> {
    if (!searchQuery.trim()) {
      // For empty query, return recent users (limit to 10 for performance)
      try {
        const recentQuery = query(
          collection(db, 'users'),
          orderBy('createdAt', 'desc'),
          limit(10)
        );
        const snapshot = await getDocs(recentQuery);
        return snapshot.docs.map(userFromFirestore).slice(0, limitCount);
      } catch (error: any) {
        // If orderBy fails (no index), fallback to simple limit query
        if (error.code === 'failed-precondition') {
          try {
            const fallbackQuery = query(
              collection(db, 'users'),
              limit(10)
            );
            const snapshot = await getDocs(fallbackQuery);
            return snapshot.docs.map(userFromFirestore).slice(0, limitCount);
          } catch (fallbackError) {
            console.error('Error fetching recent users (fallback):', fallbackError);
            return [];
          }
        }
        console.error('Error fetching recent users:', error);
        return [];
      }
    }

    const term = searchQuery.toLowerCase().trim();

    try {
      // ENHANCED HYBRID APPROACH FOR FIRST/LAST NAME SEARCH:
      // 1. Fetch candidates from Firestore by handle prefix (primary source)
      // 2. Also fetch recent users as additional candidates (for name-based matching)
      // 3. Combine and deduplicate candidates
      // 4. Filter client-side by handle, first name, last name, and full name
      // 5. Score with priority: handle > first name > last name > full name
      // 6. Return top matches
      
      const firestoreLimit = Math.max(limitCount * 4, 30); // Fetch 4x more for filtering
      const candidatesSet = new Map<string, User>(); // Use Map to deduplicate by user ID
      
      // Primary: Fetch by handle prefix (most efficient)
      try {
        const handleQuery = query(
          collection(db, 'users'),
          where('handle', '>=', term),
          where('handle', '<', term + '\uf8ff'),
          limit(firestoreLimit)
        );
        const handleSnapshot = await getDocs(handleQuery);
        handleSnapshot.docs.forEach(doc => {
          const user = userFromFirestore(doc);
          candidatesSet.set(user.id, user);
        });
      } catch (handleError) {
        console.warn('Error fetching users by handle prefix:', handleError);
      }
      
      // Secondary: Fetch recent users as additional candidates (for name-based search)
      // This helps find users whose name matches but handle doesn't start with term
      try {
        const recentQuery = query(
          collection(db, 'users'),
          orderBy('createdAt', 'desc'),
          limit(50) // Fetch 50 recent users as additional candidates
        );
        const recentSnapshot = await getDocs(recentQuery);
        recentSnapshot.docs.forEach(doc => {
          const user = userFromFirestore(doc);
          // Only add if not already in set (deduplicate)
          if (!candidatesSet.has(user.id)) {
            candidatesSet.set(user.id, user);
          }
        });
      } catch (recentError: any) {
        // If orderBy fails (no index), silently continue with handle results only
        if (recentError.code !== 'failed-precondition') {
          console.warn('Error fetching recent users for name search:', recentError);
        }
      }
      
      const candidates = Array.from(candidatesSet.values());
      
      // Enhanced client-side filtering and scoring with first/last name support
      const scoredUsers = candidates.map((user) => {
        const handle = (user.handle || '').toLowerCase();
        const fullName = (user.displayName || user.name || '').toLowerCase();
        const userId = (user.userId || '').toLowerCase();
        
        // Split name into words to identify first and last name
        const nameWords = fullName.split(/\s+/).filter(w => w.length > 0);
        const firstName = nameWords.length > 0 ? nameWords[0] : '';
        const lastName = nameWords.length > 1 ? nameWords[nameWords.length - 1] : '';
        const middleNames = nameWords.length > 2 ? nameWords.slice(1, -1) : [];
        
        let score = 0;
        const matchDetails: string[] = [];
        
        // ===== HANDLE MATCHES (Highest Priority) =====
        // Handle prefix match (highest priority - exact start)
        if (handle.startsWith(term)) {
          score += 100;
          matchDetails.push('handle-prefix');
          // Bonus for exact match
          if (handle === term) {
            score += 50;
            matchDetails.push('handle-exact');
          }
        }
        // Handle contains match (medium priority)
        else if (handle.includes(term)) {
          score += 50;
          matchDetails.push('handle-contains');
        }
        
        // Alternative handle/userId match
        if (userId) {
          if (userId.startsWith(term)) {
            score += 40;
            matchDetails.push('userId-prefix');
          } else if (userId.includes(term)) {
            score += 20;
            matchDetails.push('userId-contains');
          }
        }
        
        // ===== FIRST NAME MATCHES (High Priority) =====
        if (firstName) {
          // First name exact match (very high priority)
          if (firstName === term) {
            score += 80;
            matchDetails.push('first-name-exact');
          }
          // First name starts with term
          else if (firstName.startsWith(term)) {
            score += 60;
            matchDetails.push('first-name-prefix');
          }
          // First name contains term
          else if (firstName.includes(term)) {
            score += 40;
            matchDetails.push('first-name-contains');
          }
        }
        
        // ===== LAST NAME MATCHES (Medium Priority) =====
        if (lastName) {
          // Last name exact match
          if (lastName === term) {
            score += 70;
            matchDetails.push('last-name-exact');
          }
          // Last name starts with term
          else if (lastName.startsWith(term)) {
            score += 50;
            matchDetails.push('last-name-prefix');
          }
          // Last name contains term
          else if (lastName.includes(term)) {
            score += 35;
            matchDetails.push('last-name-contains');
          }
        }
        
        // ===== MIDDLE NAME MATCHES (Lower Priority) =====
        for (const middleName of middleNames) {
          if (middleName.startsWith(term)) {
            score += 30;
            matchDetails.push('middle-name-match');
            break; // Only count once
          }
        }
        
        // ===== FULL NAME MATCHES (Lower Priority) =====
        // Full name contains match (fallback)
        if (fullName.includes(term) && !matchDetails.some(d => d.includes('name'))) {
          score += 30;
          matchDetails.push('full-name-contains');
        }
        // Full name starts with term (bonus)
        if (fullName.startsWith(term)) {
          score += 25;
          matchDetails.push('full-name-prefix');
        }
        
        // ===== WORD-LEVEL MATCHING (Additional Scoring) =====
        // Check if search term matches any word in the name (for partial matches)
        const termWords = term.split(/\s+/).filter(w => w.length >= 2);
        for (const word of nameWords) {
          for (const tWord of termWords) {
            if (word.startsWith(tWord)) {
              // Give bonus points based on which word matched
              if (word === firstName) {
                score += 20; // First name word match
                matchDetails.push('first-name-word');
              } else if (word === lastName) {
                score += 15; // Last name word match
                matchDetails.push('last-name-word');
              } else {
                score += 10; // Other name word match
                matchDetails.push('name-word-match');
              }
            }
          }
        }
        
        return {
          user,
          score,
          matchDetails,
        };
      });
      
      // Filter out zero-score matches and sort by score (descending)
      const filtered = scoredUsers
        .filter((item) => item.score > 0)
        .sort((a, b) => {
          // Primary sort: by score (highest first)
          if (b.score !== a.score) {
            return b.score - a.score;
          }
          
          // Secondary sort: prioritize match types in order:
          // 1. Handle matches (highest)
          // 2. First name matches
          // 3. Last name matches
          // 4. Other name matches
          const getMatchPriority = (details: string[]): number => {
            if (details.some(d => d.includes('handle') || d.includes('userId'))) return 4;
            if (details.some(d => d.includes('first-name'))) return 3;
            if (details.some(d => d.includes('last-name'))) return 2;
            if (details.some(d => d.includes('name'))) return 1;
            return 0;
          };
          
          const aPriority = getMatchPriority(a.matchDetails);
          const bPriority = getMatchPriority(b.matchDetails);
          if (bPriority !== aPriority) {
            return bPriority - aPriority;
          }
          
          // Tertiary sort: prefer exact matches over prefix matches
          const aHasExact = a.matchDetails.some(d => d.includes('exact'));
          const bHasExact = b.matchDetails.some(d => d.includes('exact'));
          if (aHasExact !== bHasExact) {
            return bHasExact ? 1 : -1;
          }
          
          // Quaternary sort: by handle length (shorter handles first for exact matches)
          return (a.user.handle || '').length - (b.user.handle || '').length;
        })
        .slice(0, limitCount)
        .map((item) => item.user);
      
      return filtered;
    } catch (error) {
      console.error('Error searching users:', error);
      return [];
    }
  },

  async createUser(user: Omit<User, 'id' | 'createdAt'>, userId?: string): Promise<User> {
    try {
      const now = Timestamp.now();
      const userData = {
        ...user,
        createdAt: now,
        following: user.following || [],
        bookmarks: user.bookmarks || [],
        interests: user.interests || [],
        semanticTopics: user.semanticTopics || [],
        onboardingCompleted: user.onboardingCompleted ?? false,
        onboardingCompletedAt: user.onboardingCompletedAt,
        firstTimeUser: user.firstTimeUser ?? true,
        autoFollowedAccounts: user.autoFollowedAccounts || [],
        profilePictureUrl: user.profilePictureUrl,
        coverPhotoUrl: user.coverPhotoUrl,
        kurralScore: user.kurralScore || {
          score: 65,
          lastUpdated: now,
          components: {
            qualityHistory: 0,
            violationHistory: 0,
            engagementQuality: 0,
            consistency: 0,
            communityTrust: 0,
          },
          history: [],
        },
        forYouConfig: user.forYouConfig
          ? {
              ...DEFAULT_FOR_YOU_CONFIG,
              ...user.forYouConfig,
            }
          : DEFAULT_FOR_YOU_CONFIG,
      };

      if (!user.onboardingCompletedAt) {
        delete userData.onboardingCompletedAt;
      }
      // Filter out undefined values - Firestore doesn't accept undefined
      const cleanUserData: any = {};
      for (const [key, value] of Object.entries(userData)) {
        if (value !== undefined) {
          cleanUserData[key] = value;
        }
      }

      if (userId) {
        // Create user with specific ID (for Firebase Auth UID)
        await setDoc(doc(db, 'users', userId), cleanUserData);
        const docSnap = await getDoc(doc(db, 'users', userId));
        if (!docSnap.exists()) {
          throw new Error('Failed to create user');
        }
        return userFromFirestore(docSnap);
      } else {
        // Create user with auto-generated ID
        const docRef = await addDoc(collection(db, 'users'), cleanUserData);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) {
          throw new Error('Failed to create user');
        }
        return userFromFirestore(docSnap);
      }
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  },

  async updateUser(userId: string, updates: Partial<Omit<User, 'id' | 'createdAt'>>): Promise<void> {
    try {
      // Filter out undefined values - Firestore doesn't accept undefined
      const cleanUpdates: any = {};
      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) {
          cleanUpdates[key] = value;
        }
      }
      await updateDoc(doc(db, 'users', userId), cleanUpdates);
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  },

  async updateFollowing(userId: string, followingIds: string[]): Promise<void> {
    try {
      await updateDoc(doc(db, 'users', userId), { following: followingIds });
    } catch (error) {
      console.error('Error updating following:', error);
      throw error;
    }
  },

  async updateBookmarks(userId: string, bookmarkIds: string[]): Promise<void> {
    try {
      await updateDoc(doc(db, 'users', userId), { bookmarks: bookmarkIds });
    } catch (error) {
      console.error('Error updating bookmarks:', error);
      throw error;
    }
  },

  async getPopularAccounts(limitCount: number = 5): Promise<User[]> {
    try {
      const recentChirps = await chirpService.getRecentChirps(150);
      const authorStats = new Map<string, { count: number; lastPosted: Date }>();

      recentChirps.forEach((chirp) => {
        const existing = authorStats.get(chirp.authorId);
        if (!existing) {
          authorStats.set(chirp.authorId, { count: 1, lastPosted: chirp.createdAt });
        } else {
          existing.count += 1;
          if (chirp.createdAt > existing.lastPosted) {
            existing.lastPosted = chirp.createdAt;
          }
          authorStats.set(chirp.authorId, existing);
        }
      });

      const sortedAuthorIds = Array.from(authorStats.entries())
        .sort(([, a], [, b]) => {
          if (b.count !== a.count) {
            return b.count - a.count;
          }
          return b.lastPosted.getTime() - a.lastPosted.getTime();
        })
        .map(([authorId]) => authorId)
        .slice(0, limitCount);

      if (sortedAuthorIds.length === 0) {
        return [];
      }

      const snapshots = await Promise.all(
        sortedAuthorIds.map((authorId) => getDoc(doc(db, 'users', authorId)))
      );

      return snapshots
        .filter((snap) => snap.exists())
        .map((snap) => userFromFirestore(snap));
    } catch (error) {
      console.error('Error fetching popular accounts:', error);
      return [];
    }
  },

  async autoFollowAccounts(userId: string, accountIds: string[]): Promise<User | null> {
    if (accountIds.length === 0) {
      return this.getUser(userId);
    }

    try {
      const userSnap = await getDoc(doc(db, 'users', userId));
      if (!userSnap.exists()) {
        return null;
      }

      const currentUserData = userFromFirestore(userSnap);
      const toFollow = Array.from(
        new Set(accountIds.filter((id) => id !== userId && !currentUserData.following.includes(id)))
      );

      if (toFollow.length === 0) {
        return currentUserData;
      }

      const newFollowing = Array.from(new Set([...currentUserData.following, ...toFollow]));
      const newAutoFollowed = Array.from(
        new Set([...(currentUserData.autoFollowedAccounts || []), ...toFollow])
      );

      await updateDoc(doc(db, 'users', userId), {
        following: newFollowing,
        autoFollowedAccounts: newAutoFollowed,
      });

      const refreshed = await getDoc(doc(db, 'users', userId));
      if (!refreshed.exists()) {
        return currentUserData;
      }

      return userFromFirestore(refreshed);
    } catch (error) {
      console.error('Error auto-following accounts:', error);
      return this.getUser(userId);
    }
  },

  // Get users with similar interests (client-side matching)
  // Note: This works best with a limited set of users (e.g., from store cache)
  // For production, consider adding a Firestore index or separate interest index collection
  async getUsersWithSimilarInterests(
    userInterests: string[],
    excludeUserId: string,
    limitCount: number = 10
  ): Promise<User[]> {
    if (!userInterests || userInterests.length === 0) {
      return [];
    }

    try {
      // Get recent users (limit to 100 for performance)
      // Filter client-side for users with interests (Firestore doesn't support != [] queries)
      const q = query(
        collection(db, 'users'),
        orderBy('createdAt', 'desc'),
        limit(100)
      );
      
      const snapshot = await getDocs(q);
      const allUsers = snapshot.docs
        .map(userFromFirestore)
        .filter((user) => user.id !== excludeUserId && user.interests && user.interests.length > 0);

      // Calculate similarity for each user
      const normalizedUserInterests = userInterests.map((i) => i.toLowerCase());
      
      const usersWithSimilarity = allUsers.map((user) => {
        const normalizedOtherInterests = (user.interests || []).map((i) => i.toLowerCase());
        
        // Calculate overlap (matching interests) with exact matches
        const exactMatches: string[] = [];
        const partialMatches: string[] = [];
        
        normalizedUserInterests.forEach((interest) => {
          const exactMatch = normalizedOtherInterests.find((otherInterest) => interest === otherInterest);
          if (exactMatch) {
            exactMatches.push(exactMatch);
          } else {
            // Check for partial matches (substring)
            const partialMatch = normalizedOtherInterests.find((otherInterest) => 
              interest.includes(otherInterest) || otherInterest.includes(interest)
            );
            if (partialMatch) {
              partialMatches.push(partialMatch);
            }
          }
        });

        const totalMatches = exactMatches.length + partialMatches.length;
        const overlap = [...exactMatches, ...partialMatches];

        // Similarity score: overlap count / max interests count (Jaccard-like)
        // Weight exact matches higher
        const similarity = totalMatches / Math.max(normalizedUserInterests.length, normalizedOtherInterests.length);

        return {
          user,
          similarity,
          overlapCount: totalMatches,
          matchingInterests: overlap, // Store matching interests for display
        };
      });

      // Sort by similarity (highest first), then by overlap count
      usersWithSimilarity.sort((a, b) => {
        if (b.similarity !== a.similarity) {
          return b.similarity - a.similarity;
        }
        return b.overlapCount - a.overlapCount;
      });

      // Return top matches with similarity metadata
      const topMatches = usersWithSimilarity
        .filter((item) => item.similarity > 0) // Only users with at least one matching interest
        .slice(0, limitCount);

      // Attach similarity metadata to user object (for display in UI)
      // Using type assertion since we're adding temporary metadata for UI display
      return topMatches.map((item) => {
        const userWithMetadata = item.user as User & {
          _similarityMetadata?: {
            similarity: number;
            overlapCount: number;
            matchingInterests: string[];
          };
        };
        userWithMetadata._similarityMetadata = {
          similarity: item.similarity,
          overlapCount: item.overlapCount,
          matchingInterests: item.matchingInterests,
        };
        return userWithMetadata as User;
      });
    } catch (error) {
      console.error('Error fetching users with similar interests:', error);
      // If query fails (e.g., no index), return empty array
      return [];
    }
  },
};

// Comment operations
export const commentService = {
  async getCommentsForChirp(chirpId: string): Promise<Comment[]> {
    try {
      const q = query(
        collection(db, 'comments'),
        where('chirpId', '==', chirpId),
        orderBy('createdAt', 'asc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(commentFromFirestore);
    } catch (error) {
      console.error('Error fetching comments:', error);
      return [];
    }
  },

  async createComment(comment: Omit<Comment, 'id' | 'createdAt'>): Promise<Comment> {
    try {
      // Calculate depth if this is a reply
      let depth = 0;
      if (comment.parentCommentId) {
        // Get parent comment to calculate depth
        const parentDoc = await getDoc(doc(db, 'comments', comment.parentCommentId));
        if (!parentDoc.exists()) {
          throw new Error('Parent comment not found');
        }
        const parentComment = commentFromFirestore(parentDoc);
        depth = (parentComment.depth || 0) + 1;
        
        // Limit nesting depth to prevent abuse
        if (depth > 10) {
          throw new Error('Maximum reply depth exceeded');
        }
      }

      // Build comment data, excluding undefined fields
      const commentData: any = {
        chirpId: comment.chirpId,
        authorId: comment.authorId,
        text: comment.text,
        depth,
        replyCount: 0,
        createdAt: Timestamp.now(),
      };
      
      // Initialize fact checking status for resume capability
      commentData.factCheckingStatus = 'pending';
      commentData.factCheckingStartedAt = Timestamp.now();
      
      // Only include optional fields if they have values
      if (comment.parentCommentId) {
        commentData.parentCommentId = comment.parentCommentId;
      }
      if (comment.replyToUserId) {
        commentData.replyToUserId = comment.replyToUserId;
      }
      if (comment.discussionRole) {
        commentData.discussionRole = comment.discussionRole;
      }
      if (comment.valueContribution) {
        commentData.valueContribution = serializeValueContribution(comment.valueContribution);
      }
      if (comment.imageUrl) {
        commentData.imageUrl = comment.imageUrl;
      }
      if (comment.formattedText) {
        commentData.formattedText = comment.formattedText;
      }
      if (comment.scheduledAt) {
        commentData.scheduledAt = Timestamp.fromDate(comment.scheduledAt);
      }
      
      // Include fact-check fields if provided (for migration/resume)
      if (comment.claims && comment.claims.length > 0) {
        commentData.claims = serializeClaims(comment.claims);
      }
      if (comment.factChecks && comment.factChecks.length > 0) {
        commentData.factChecks = serializeFactChecks(comment.factChecks);
      }
      if (comment.factCheckStatus) {
        commentData.factCheckStatus = comment.factCheckStatus;
      }

      const docRef = await addDoc(collection(db, 'comments'), commentData);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        throw new Error('Failed to create comment');
      }
      const newComment = commentFromFirestore(docSnap);
      
      // Use batch for atomic updates
      const batch = writeBatch(db);
      
      // If this is a top-level comment, increment chirp comment count
      if (!comment.parentCommentId) {
        batch.update(doc(db, 'chirps', comment.chirpId), {
          commentCount: increment(1),
        });
      }
      
      // If this is a reply, increment parent comment's reply count
      if (comment.parentCommentId) {
        batch.update(doc(db, 'comments', comment.parentCommentId), {
          replyCount: increment(1),
        });
      }
      
      await batch.commit();
      
      // Create notifications asynchronously (don't block comment creation)
      // Notify post author if this is a top-level comment
      if (!comment.parentCommentId) {
        try {
          const chirpDoc = await getDoc(doc(db, 'chirps', comment.chirpId));
          const chirpData = chirpDoc.data();
          if (chirpData && chirpData.authorId !== comment.authorId) {
            await notificationService.createNotification({
              userId: chirpData.authorId,
              type: 'comment',
              actorId: comment.authorId,
              chirpId: comment.chirpId,
              commentId: newComment.id,
            }).catch(err => {
              // Silently fail - notification errors shouldn't block comments
              if (!err.message?.includes('disabled') && !err.message?.includes('muted')) {
                console.error('Error creating comment notification:', err);
              }
            });
          }
        } catch (notifError: any) {
          // Don't let notification errors break comment creation
          if (!notifError.message?.includes('disabled') && !notifError.message?.includes('muted')) {
            console.error('Error creating comment notification:', notifError);
          }
        }
      } else {
        // This is a reply - notify parent comment author
        try {
          const parentCommentDoc = await getDoc(doc(db, 'comments', comment.parentCommentId));
          const parentCommentData = parentCommentDoc.data();
          if (parentCommentData && parentCommentData.authorId !== comment.authorId) {
            // Get original chirp for metadata
            const chirpDoc = await getDoc(doc(db, 'chirps', comment.chirpId));
            const chirpData = chirpDoc.data();
            
            await notificationService.createNotification({
              userId: parentCommentData.authorId,
              type: 'reply',
              actorId: comment.authorId,
              chirpId: comment.chirpId,
              commentId: newComment.id,
              metadata: {
                parentCommentId: comment.parentCommentId,
                originalPostAuthorId: chirpData?.authorId,
              },
            }).catch(err => {
              // Silently fail - notification errors shouldn't block replies
              if (!err.message?.includes('disabled') && !err.message?.includes('muted')) {
                console.error('Error creating reply notification:', err);
              }
            });
          }
        } catch (notifError: any) {
          // Don't let notification errors break reply creation
          if (!notifError.message?.includes('disabled') && !notifError.message?.includes('muted')) {
            console.error('Error creating reply notification:', notifError);
          }
        }
      }
      
      return newComment;
    } catch (error) {
      console.error('Error creating comment:', error);
      throw error;
    }
  },

  async getCommentsByAuthor(authorId: string, limitCount: number = 50): Promise<Comment[]> {
    try {
      const q = query(
        collection(db, 'comments'),
        where('authorId', '==', authorId),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(commentFromFirestore);
    } catch (error) {
      console.error('Error fetching comments by author:', error);
      return [];
    }
  },

  async updateCommentAnalytics(
    commentId: string,
    updates: {
      discussionRole?: Comment['discussionRole'];
      valueContribution?: ValueVector & { total: number };
      claims?: Claim[];
      factChecks?: FactCheck[];
      factCheckStatus?: 'clean' | 'needs_review' | 'blocked';
      factCheckingStatus?: 'pending' | 'in_progress' | 'completed' | 'failed';
      factCheckingStartedAt?: Date;
    }
  ): Promise<void> {
    const firestoreUpdates: Record<string, any> = {};
    if (updates.discussionRole) {
      firestoreUpdates.discussionRole = updates.discussionRole;
    }
    if (updates.valueContribution) {
      firestoreUpdates.valueContribution = serializeValueContribution(updates.valueContribution);
    }
    if (updates.claims !== undefined) {
      const serialized = serializeClaims(updates.claims);
      if (serialized !== undefined && serialized !== null) {
        firestoreUpdates.claims = serialized;
      } else {
        firestoreUpdates.claims = null; // Allow clearing claims
      }
    }
    if (updates.factChecks !== undefined) {
      const serialized = serializeFactChecks(updates.factChecks);
      if (serialized !== undefined && serialized !== null) {
        firestoreUpdates.factChecks = serialized;
      } else {
        firestoreUpdates.factChecks = null; // Allow clearing fact-checks
      }
    }
    if (updates.factCheckStatus !== undefined) {
      firestoreUpdates.factCheckStatus = updates.factCheckStatus;
    }
    if (updates.factCheckingStatus !== undefined) {
      firestoreUpdates.factCheckingStatus = updates.factCheckingStatus;
    }
    if (updates.factCheckingStartedAt !== undefined) {
      firestoreUpdates.factCheckingStartedAt = updates.factCheckingStartedAt ? Timestamp.fromDate(updates.factCheckingStartedAt) : null;
    }

    if (Object.keys(firestoreUpdates).length === 0) {
      return;
    }

    await updateDoc(doc(db, 'comments', commentId), firestoreUpdates);
  },

  // Delete a comment and all its replies
  async deleteComment(commentId: string, authorId: string): Promise<void> {
    try {
      // Verify the comment exists and user is the author
      const commentDoc = await getDoc(doc(db, 'comments', commentId));
      if (!commentDoc.exists()) {
        throw new Error('Comment not found');
      }
      const commentData = commentDoc.data();
      if (commentData.authorId !== authorId) {
        throw new Error('Unauthorized: Only the author can delete this comment');
      }

      // Get all replies to this comment (recursively)
      const getAllReplies = async (parentId: string): Promise<string[]> => {
        const repliesQuery = query(
          collection(db, 'comments'),
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

      // Use batch to delete comment and all replies atomically
      const batch = writeBatch(db);
      
      // Delete the main comment
      batch.delete(doc(db, 'comments', commentId));
      
      // Delete all replies
      allReplyIds.forEach((replyId) => {
        batch.delete(doc(db, 'comments', replyId));
      });

      // Update parent comment's replyCount if this is a reply
      if (commentData.parentCommentId) {
        const parentCommentDoc = await getDoc(doc(db, 'comments', commentData.parentCommentId));
        if (parentCommentDoc.exists()) {
          const currentReplyCount = parentCommentDoc.data().replyCount || 0;
          const newReplyCount = Math.max(0, currentReplyCount - 1);
          batch.update(doc(db, 'comments', commentData.parentCommentId), {
            replyCount: newReplyCount,
          });
        }
      } else {
        // This is a top-level comment, decrement chirp's commentCount
        const chirpDoc = await getDoc(doc(db, 'chirps', commentData.chirpId));
        if (chirpDoc.exists()) {
          const currentCommentCount = chirpDoc.data().commentCount || 0;
          const newCommentCount = Math.max(0, currentCommentCount - 1);
          batch.update(doc(db, 'chirps', commentData.chirpId), {
            commentCount: newCommentCount,
          });
        }
      }

      await batch.commit();
    } catch (error) {
      console.error('Error deleting comment:', error);
      throw error;
    }
  },
};

// Utility function to build comment tree from flat array
export const buildCommentTree = (comments: Comment[]): CommentTreeNode[] => {
  // Create a map of all comments by ID for quick lookup
  const commentMap = new Map<string, CommentTreeNode>();
  
  // Initialize all comments as tree nodes
  comments.forEach(comment => {
    commentMap.set(comment.id, {
      ...comment,
      replies: [],
    });
  });
  
  // Build the tree structure
  const rootComments: CommentTreeNode[] = [];
  
  comments.forEach(comment => {
    const node = commentMap.get(comment.id)!;
    
    if (comment.parentCommentId) {
      // This is a reply - add it to parent's replies
      const parent = commentMap.get(comment.parentCommentId);
      if (parent) {
        parent.replies.push(node);
      } else {
        // Parent not found (shouldn't happen, but handle gracefully)
        rootComments.push(node);
      }
    } else {
      // This is a top-level comment
      rootComments.push(node);
    }
  });
  
  // Sort replies within each node by createdAt
  const sortReplies = (node: CommentTreeNode) => {
    node.replies.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    node.replies.forEach(sortReplies);
  };
  
  rootComments.forEach(sortReplies);
  
  // Sort root comments by createdAt
  rootComments.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  
  return rootComments;
};

// Real-time listeners
export const realtimeService = {
  // Subscribe to chirps from followed users
  subscribeToLatestChirps(
    followingIds: string[],
    callback: (chirps: Chirp[]) => void
  ): Unsubscribe {
    if (followingIds.length === 0) {
      callback([]);
      return () => {}; // Return no-op unsubscribe
    }

    const constraints: QueryConstraint[] = [
      where('authorId', 'in', followingIds),
      orderBy('createdAt', 'desc'),
      limit(50),
    ];

    const q = query(collection(db, 'chirps'), ...constraints);
    return onSnapshot(q, (snapshot) => {
      const now = new Date();
      const chirps = snapshot.docs
        .map(chirpFromFirestore)
        .filter(chirp => {
          // Filter out scheduled posts that haven't been published yet
          if (chirp.scheduledAt && chirp.scheduledAt > now) {
            return false;
          }
          return true;
        });
      callback(chirps);
    }, (error) => {
      console.error('Error in latest chirps subscription:', error);
      callback([]);
    });
  },

  // Subscribe to all recent chirps (for For You feed)
  subscribeToRecentChirps(
    callback: (chirps: Chirp[]) => void,
    limitCount: number = 100
  ): Unsubscribe {
    const q = query(
      collection(db, 'chirps'),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    return onSnapshot(q, (snapshot) => {
      const now = new Date();
      const chirps = snapshot.docs
        .map(chirpFromFirestore)
        .filter(chirp => {
          // Filter out scheduled posts that haven't been published yet
          if (chirp.scheduledAt && chirp.scheduledAt > now) {
            return false;
          }
          return true;
        });
      callback(chirps);
    }, (error) => {
      console.error('Error in recent chirps subscription:', error);
      callback([]);
    });
  },

  subscribeToSemanticTopics(
    topics: string[],
    callback: (chirps: Chirp[]) => void,
    limitCount: number = 50
  ): Unsubscribe | null {
    const normalizedTopics = Array.from(
      new Set(
        topics
          .map((topic) => topic?.trim().toLowerCase())
          .filter((topic): topic is string => Boolean(topic))
      )
    );

    if (normalizedTopics.length === 0) {
      callback([]);
      return null;
    }

    const batches = chunkArray(normalizedTopics, 10);
    const unsubscribes: Unsubscribe[] = [];

    batches.forEach((batch) => {
      const q = query(
        collection(db, 'chirps'),
        where('semanticTopics', 'array-contains-any', batch),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );

      const unsub = onSnapshot(
        q,
        (snapshot) => {
          const now = new Date();
          const chirps = snapshot.docs
            .map(chirpFromFirestore)
            .filter((chirp) => {
              if (chirp.scheduledAt && chirp.scheduledAt > now) {
                return false;
              }
              return true;
            });
          callback(chirps);
        },
        (error) => {
          console.error('Error in semantic topics subscription:', error);
        }
      );

      unsubscribes.push(unsub);
    });

    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
  },

  // Subscribe to comments for a chirp
  subscribeToComments(
    chirpId: string,
    callback: (comments: Comment[]) => void
  ): Unsubscribe {
    const q = query(
      collection(db, 'comments'),
      where('chirpId', '==', chirpId),
      orderBy('createdAt', 'asc')
    );
    return onSnapshot(q, (snapshot) => {
      const comments = snapshot.docs.map(commentFromFirestore);
      callback(comments);
    }, (error) => {
      console.error('Error in comments subscription:', error);
      callback([]);
    });
  },

  // Subscribe to user updates
  subscribeToUser(
    userId: string,
    callback: (user: User | null) => void
  ): Unsubscribe {
    return onSnapshot(doc(db, 'users', userId), (docSnap) => {
      if (!docSnap.exists()) {
        callback(null);
        return;
      }
      callback(userFromFirestore(docSnap));
    }, (error) => {
      console.error('Error in user subscription:', error);
      callback(null);
    });
  },
};

// Helper to convert Firestore topic metadata
const normalizeTopicName = (name?: string | null): string => {
  if (!name) return '';
  return name.trim().toLowerCase();
};

const ensureValidTopicName = (name?: string | null): string | null => {
  const normalized = normalizeTopicName(name);
  return normalized || null;
};

const normalizeTopicInput = (input: string | string[]): string[] => {
  const rawList = Array.isArray(input) ? input : [input];
  const normalized = rawList
    .map((topic) => ensureValidTopicName(topic))
    .filter(Boolean) as string[];
  return Array.from(new Set(normalized));
};

const fetchChirpsWithConstraints = async (constraints: QueryConstraint[]): Promise<Chirp[]> => {
  const collectionRef = collection(db, 'chirps');
  try {
    const q = query(collectionRef, ...constraints, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(chirpFromFirestore);
  } catch (error) {
    console.warn('[topicService] Ordered topic query failed:', error);
    try {
      const fallback = query(collectionRef, ...constraints);
      const snapshot = await getDocs(fallback);
      const posts = snapshot.docs.map(chirpFromFirestore);
      return posts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } catch (fallbackError) {
      console.error('[topicService] Fallback topic query failed:', fallbackError);
      return [];
    }
  }
};

const fetchChirpsForTopicWindow = async (topicName: string, since: Timestamp): Promise<Chirp[]> => {
  const constraintSets: QueryConstraint[][] = [
    [where('topic', '==', topicName), where('createdAt', '>=', since)],
    [where('semanticTopics', 'array-contains', topicName), where('createdAt', '>=', since)],
  ];

  const collected: Chirp[] = [];
  for (const constraints of constraintSets) {
    const results = await fetchChirpsWithConstraints(constraints);
    collected.push(...results);
  }
  return dedupeChirps(collected);
};

const topicMetadataFromFirestore = (doc: any): TopicMetadata => {
  const data = doc.data();
  return {
    name: data.name || doc.id,
    postsLast48h: data.postsLast48h || 0,
    postsLast1h: data.postsLast1h || 0,
    postsLast4h: data.postsLast4h || 0,
    totalUsers: data.totalUsers || 0,
    lastEngagementUpdate: data.lastEngagementUpdate ? toDate(data.lastEngagementUpdate) : new Date(0),
    averageVelocity1h: data.averageVelocity1h || 0,
    isTrending: data.isTrending || false,
    lastNewsGeneratedAt: data.lastNewsGeneratedAt ? toDate(data.lastNewsGeneratedAt) : undefined,
  };
};

// Topic operations
export const topicService = {
  // Get topic metadata by name
  async getTopic(topicName: string): Promise<TopicMetadata | null> {
    try {
      const normalizedName = ensureValidTopicName(topicName);
      if (!normalizedName) {
        return null;
      }
      const topicRef = doc(db, 'topics', normalizedName);
      const docSnap = await getDoc(topicRef);
      if (!docSnap.exists()) {
        await this.createTopic(normalizedName);
        const newDocSnap = await getDoc(topicRef);
        if (!newDocSnap.exists()) return null;
        return topicMetadataFromFirestore(newDocSnap);
      }
      return topicMetadataFromFirestore(docSnap);
    } catch (error) {
      console.error('Error fetching topic:', error);
      return null;
    }
  },

  // Create topic with default values (only if it doesn't exist - prevents duplication/overwrite)
  async createTopic(topicName: string): Promise<void> {
    try {
      const normalizedName = ensureValidTopicName(topicName);
      if (!normalizedName) return;
      const topicRef = doc(db, 'topics', normalizedName);
      const topicSnap = await getDoc(topicRef);
      
      if (!topicSnap.exists()) {
        await setDoc(topicRef, {
          name: normalizedName,
          postsLast48h: 0,
          postsLast1h: 0,
          postsLast4h: 0,
          totalUsers: 0,
          lastEngagementUpdate: Timestamp.now(),
          averageVelocity1h: 0,
          isTrending: false,
        });
      }
    } catch (error) {
      console.error('Error creating topic:', error);
    }
  },

  // Get top engaged topics
  async getTopEngagedTopics(limitCount: number = 30): Promise<TopicMetadata[]> {
    try {
      const q = query(
        collection(db, 'topics'),
        orderBy('postsLast48h', 'desc'),
        limit(limitCount)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(topicMetadataFromFirestore);
    } catch (error) {
      console.error('Error fetching top engaged topics:', error);
      // If index doesn't exist, try without ordering
      try {
        const snapshot = await getDocs(collection(db, 'topics'));
        const topics = snapshot.docs.map(topicMetadataFromFirestore);
        return topics.sort((a, b) => b.postsLast48h - a.postsLast48h).slice(0, limitCount);
      } catch (fallbackError) {
        console.error('Error in fallback topic fetch:', fallbackError);
        return [];
      }
    }
  },

  // Get trending topics (with velocity spikes)
  async getTrendingTopics(limitCount: number = 10): Promise<TopicMetadata[]> {
    try {
      const trendingQuery = query(
        collection(db, 'topics'),
        where('isTrending', '==', true),
        orderBy('postsLast1h', 'desc'),
        limit(limitCount)
      );
      const topQuery = query(
        collection(db, 'topics'),
        orderBy('postsLast1h', 'desc'),
        limit(limitCount)
      );

      const [trendingSnapshot, topSnapshot] = await Promise.all([
        getDocs(trendingQuery),
        getDocs(topQuery),
      ]);

      const combined = [
        ...trendingSnapshot.docs.map(topicMetadataFromFirestore),
        ...topSnapshot.docs.map(topicMetadataFromFirestore),
      ];

      const deduped = Array.from(
        new Map(combined.map((topic) => [topic.name, topic])).values()
      );

      deduped.sort((a, b) => b.postsLast1h - a.postsLast1h);
      return deduped.slice(0, limitCount);
    } catch (error) {
      console.error('Error fetching trending topics:', error);
      try {
        const snapshot = await getDocs(collection(db, 'topics'));
        const topics = snapshot.docs
          .map(topicMetadataFromFirestore)
          .sort((a, b) => b.postsLast1h - a.postsLast1h)
          .slice(0, limitCount);
        return topics;
      } catch (fallbackError) {
        console.error('Error in fallback trending topics fetch:', fallbackError);
        return [];
      }
    }
  },

  // Mark that AI news was generated for a topic
  async markNewsGenerated(topicName: string): Promise<void> {
    try {
      await updateDoc(doc(db, 'topics', topicName), {
        lastNewsGeneratedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error('Error marking news generated for topic:', error);
    }
  },

  // Get topics for user (top 30 + user's topics)
  async getTopicsForUser(userTopics: string[]): Promise<TopicMetadata[]> {
    try {
      // Get top 30 engaged topics
      const top30 = await this.getTopEngagedTopics(30);
      
      // Get user's topics (if they exist)
      const userTopicMetadatas: TopicMetadata[] = [];
      for (const topicName of userTopics) {
        const topic = await this.getTopic(topicName);
        if (topic) {
          userTopicMetadatas.push(topic);
        }
      }
      
      // Combine: top 30 + user's topics (remove duplicates)
      const combined: TopicMetadata[] = [...top30];
      const existingNames = new Set(top30.map(t => t.name));
      
      userTopicMetadatas.forEach(topic => {
        if (!existingNames.has(topic.name)) {
          combined.push(topic);
        }
      });
      
      return combined;
    } catch (error) {
      console.error('Error fetching topics for user:', error);
      return [];
    }
  },

  // Refresh topic engagement (count posts in last 48 hours, 4 hours, and 1 hour)
  async refreshTopicEngagement(): Promise<void> {
    try {
      const now = Date.now();
      const fortyEightHoursAgo = now - 48 * 60 * 60 * 1000;
      const fourHoursAgo = now - 4 * 60 * 60 * 1000;
      const oneHourAgo = now - 60 * 60 * 1000;
      const timestamp48h = Timestamp.fromMillis(fortyEightHoursAgo);
      
      const topicCounts48h: Record<string, number> = {};
      const topicCounts4h: Record<string, number> = {};
      const topicCounts1h: Record<string, number> = {};
      
      const incrementCounts = (rawTopic: string | undefined | null, postTime: number) => {
        const normalizedTopic = ensureValidTopicName(rawTopic);
        if (!normalizedTopic) return;

        topicCounts48h[normalizedTopic] = (topicCounts48h[normalizedTopic] || 0) + 1;
        if (postTime >= fourHoursAgo) {
          topicCounts4h[normalizedTopic] = (topicCounts4h[normalizedTopic] || 0) + 1;
        }
        if (postTime >= oneHourAgo) {
          topicCounts1h[normalizedTopic] = (topicCounts1h[normalizedTopic] || 0) + 1;
        }
      };

      const BATCH_SIZE = 500;
      let lastDoc: any = null;
      let hasMore = true;
      let totalProcessed = 0;
      
      while (hasMore) {
        let q;
        try {
          q = lastDoc
            ? query(
              collection(db, 'chirps'),
              where('createdAt', '>=', timestamp48h),
              orderBy('createdAt', 'desc'),
              startAfter(lastDoc),
              limit(BATCH_SIZE)
              )
            : query(
              collection(db, 'chirps'),
              where('createdAt', '>=', timestamp48h),
              orderBy('createdAt', 'desc'),
              limit(BATCH_SIZE)
            );
        } catch (error: any) {
          console.warn('Index for createdAt not found, fetching without orderBy:', error);
          q = lastDoc
            ? query(
              collection(db, 'chirps'),
              where('createdAt', '>=', timestamp48h),
              limit(BATCH_SIZE)
              )
            : query(
              collection(db, 'chirps'),
              where('createdAt', '>=', timestamp48h),
              limit(BATCH_SIZE)
            );
        }
        
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
          hasMore = false;
          break;
        }
        
        snapshot.docs.forEach((doc) => {
          try {
            const chirp = chirpFromFirestore(doc);
            const postTime = chirp.createdAt.getTime();
            incrementCounts(chirp.topic, postTime);
            chirp.semanticTopics?.forEach((semanticTopic) => incrementCounts(semanticTopic, postTime));
          } catch (error) {
            console.error('Error processing chirp:', error);
          }
        });
        
        totalProcessed += snapshot.docs.length;
        lastDoc = snapshot.docs[snapshot.docs.length - 1];
        hasMore = snapshot.docs.length === BATCH_SIZE;
      }
      
      console.log(`[TopicRefresh] Processed ${totalProcessed} posts for topic engagement`);
      
      const topicNames = Object.keys(topicCounts48h);
      const BATCH_WRITE_SIZE = 500;
      const batches: string[][] = [];
      
      for (let i = 0; i < topicNames.length; i += BATCH_WRITE_SIZE) {
        batches.push(topicNames.slice(i, i + BATCH_WRITE_SIZE));
      }
      
      for (const batch of batches) {
        const batchWrite = writeBatch(db);
        
        for (const topicName of batch) {
          const topicRef = doc(db, 'topics', topicName);
          const count48h = topicCounts48h[topicName] || 0;
          const count4h = topicCounts4h[topicName] || 0;
          const count1h = topicCounts1h[topicName] || 0;
          const averageVelocity = count4h / 4;
          const isTrending = averageVelocity > 0 && count1h >= averageVelocity * 2;
          
          batchWrite.set(
            topicRef,
            {
            name: topicName,
            postsLast48h: count48h,
            postsLast4h: count4h,
            postsLast1h: count1h,
            totalUsers: 0, // Required by Firestore rules for create
            averageVelocity1h: averageVelocity,
              isTrending,
            lastEngagementUpdate: Timestamp.now(),
            },
            { merge: true }
          );
        }
        
        await batchWrite.commit();
      }
      
      const allTopicNames = new Set(topicNames);
      let allTopicsLastDoc: any = null;
      let hasMoreTopics = true;
      
      while (hasMoreTopics) {
        const topicsQuery = allTopicsLastDoc
          ? query(collection(db, 'topics'), startAfter(allTopicsLastDoc), limit(BATCH_SIZE))
          : query(collection(db, 'topics'), limit(BATCH_SIZE));
        
        const topicsSnapshot = await getDocs(topicsQuery);
        
        if (topicsSnapshot.empty) {
          hasMoreTopics = false;
          break;
        }
        
        const zeroUpdateBatch = writeBatch(db);
        let hasZeroUpdates = false;
        
        topicsSnapshot.docs.forEach((docSnap) => {
          const topicName = docSnap.id;
          if (!allTopicNames.has(topicName)) {
            const topicRef = doc(db, 'topics', topicName);
            zeroUpdateBatch.update(topicRef, {
              postsLast48h: 0,
              postsLast4h: 0,
              postsLast1h: 0,
              averageVelocity1h: 0,
              isTrending: false,
              lastEngagementUpdate: Timestamp.now(),
            });
            hasZeroUpdates = true;
          }
        });
        
        if (hasZeroUpdates) {
          await zeroUpdateBatch.commit();
        }
        
        allTopicsLastDoc = topicsSnapshot.docs[topicsSnapshot.docs.length - 1];
        hasMoreTopics = topicsSnapshot.docs.length === BATCH_SIZE;
      }
      
      console.log(`[TopicRefresh] Completed refresh for ${topicNames.length} topics`);
    } catch (error) {
      console.error('Error refreshing topic engagement:', error);
      throw error;
    }
  },

  // Increment topic engagement when chirp is created
  // FIXED: Now properly handles time-windowed metrics by triggering recalculation
  async incrementTopicEngagement(topicNames: string | string[]): Promise<void> {
    const normalizedTopics = normalizeTopicInput(topicNames);
    if (normalizedTopics.length === 0) {
      return;
    }

    const processTopic = async (topicName: string) => {
    try {
      const topicRef = doc(db, 'topics', topicName);
      const topicSnap = await getDoc(topicRef);
      const now = Timestamp.now();
      const nowMs = Date.now();
      
      if (topicSnap.exists()) {
        const data = topicSnap.data();
        const lastUpdate = data.lastEngagementUpdate?.toDate() || new Date(0);
        const hoursSinceUpdate = (nowMs - lastUpdate.getTime()) / (60 * 60 * 1000);
        
        if (hoursSinceUpdate >= 1) {
          await this.recalculateTopicMetrics(topicName);
        } else {
          await updateDoc(topicRef, {
            postsLast48h: increment(1),
            postsLast1h: increment(1),
            postsLast4h: increment(1),
            lastEngagementUpdate: now,
          });
          await this.recalculateVelocity(topicName);
        }
      } else {
        await this.createTopic(topicName);
          await updateDoc(topicRef, {
          postsLast48h: 1,
          postsLast1h: 1,
          postsLast4h: 1,
          lastEngagementUpdate: now,
        });
      }
    } catch (error) {
        console.error('Error incrementing topic engagement for', topicName, error);
      }
    };

    for (const topicName of normalizedTopics) {
      await processTopic(topicName);
    }
  },

  // Recalculate metrics for a specific topic (used when time windows need updating)
  async recalculateTopicMetrics(topicName: string): Promise<void> {
    try {
      const normalizedTopic = ensureValidTopicName(topicName);
      if (!normalizedTopic) {
        return;
      }

      const now = Date.now();
      const fortyEightHoursAgo = now - 48 * 60 * 60 * 1000;
      const fourHoursAgo = now - 4 * 60 * 60 * 1000;
      const oneHourAgo = now - 60 * 60 * 1000;
      const timestamp48h = Timestamp.fromMillis(fortyEightHoursAgo);
      
      const chirps = await fetchChirpsForTopicWindow(normalizedTopic, timestamp48h);
      
      let count48h = 0;
      let count4h = 0;
      let count1h = 0;
      
      chirps.forEach((chirp) => {
          const postTime = chirp.createdAt.getTime();
          count48h++;
          
          if (postTime >= fourHoursAgo) {
            count4h++;
          }
          
          if (postTime >= oneHourAgo) {
            count1h++;
        }
      });
      
      const averageVelocity = count4h / 4;
      const isTrending = averageVelocity > 0 && count1h >= averageVelocity * 2;
      
      const topicRef = doc(db, 'topics', normalizedTopic);
      await updateDoc(topicRef, {
        postsLast48h: count48h,
        postsLast4h: count4h,
        postsLast1h: count1h,
        averageVelocity1h: averageVelocity,
        isTrending,
        lastEngagementUpdate: Timestamp.now(),
      });
    } catch (error) {
      console.error('Error recalculating topic metrics:', error);
      try {
        const normalizedTopic = ensureValidTopicName(topicName);
        if (!normalizedTopic) return;
        const topicRef = doc(db, 'topics', normalizedTopic);
        await updateDoc(topicRef, {
          postsLast48h: increment(1),
          postsLast1h: increment(1),
          postsLast4h: increment(1),
          lastEngagementUpdate: Timestamp.now(),
        });
        await this.recalculateVelocity(normalizedTopic);
      } catch (fallbackError) {
        console.error('Error in fallback increment:', fallbackError);
      }
    }
  },

  // Recalculate velocity and detect spikes
  async recalculateVelocity(topicName: string): Promise<void> {
    try {
      const normalizedTopic = ensureValidTopicName(topicName);
      if (!normalizedTopic) {
        return;
      }
      const topicRef = doc(db, 'topics', normalizedTopic);
      const topicSnap = await getDoc(topicRef);
      if (!topicSnap.exists()) return;

      const data = topicSnap.data();
      const postsLast1h = data.postsLast1h || 0;
      const postsLast4h = data.postsLast4h || 0;
      
      // Calculate average velocity (posts per hour over last 4h)
      const averageVelocity = postsLast4h / 4;
      
      // Detect spike: if current 1h rate is 2x the average
      const currentVelocity = postsLast1h;
      const isTrending = averageVelocity > 0 && currentVelocity >= averageVelocity * 2;
      
      await updateDoc(topicRef, {
        averageVelocity1h: averageVelocity,
        isTrending: isTrending,
      });
    } catch (error) {
      console.error('Error recalculating velocity:', error);
    }
  },

  // Increment user count for a topic (when user selects topic in profile)
  async incrementTopicUserCount(topicName: string): Promise<void> {
    try {
      const normalizedTopic = ensureValidTopicName(topicName);
      if (!normalizedTopic) {
        return;
      }
      const topicRef = doc(db, 'topics', normalizedTopic);
      const topicSnap = await getDoc(topicRef);
      
      if (topicSnap.exists()) {
        await updateDoc(topicRef, {
          totalUsers: increment(1),
        });
      } else {
        await setDoc(topicRef, {
          name: normalizedTopic,
          postsLast48h: 0,
          totalUsers: 1,
          lastEngagementUpdate: Timestamp.now(),
        });
      }
    } catch (error) {
      console.error('Error incrementing topic user count:', error);
    }
  },

  // Decrement user count for a topic (when user removes topic from profile)
  async decrementTopicUserCount(topicName: string): Promise<void> {
    try {
      const normalizedTopic = ensureValidTopicName(topicName);
      if (!normalizedTopic) {
        return;
      }
      const topicRef = doc(db, 'topics', normalizedTopic);
      const topicSnap = await getDoc(topicRef);
      
      if (topicSnap.exists()) {
        const currentData = topicSnap.data();
        const currentCount = currentData?.totalUsers || 0;
        
        if (currentCount > 0) {
          await updateDoc(topicRef, {
            totalUsers: Math.max(0, currentCount - 1),
          });
        }
      }
    } catch (error) {
      console.error('Error decrementing topic user count:', error);
    }
  },
};

// Post Review Context operations - for users to add context to posts marked "needs_review"
export const reviewContextService = {
  async createReviewContext(
    chirpId: string,
    submittedBy: string,
    action: PostReviewAction,
    sources: string[],
    context: string
  ): Promise<PostReviewContext> {
    try {
      // Validate context (required, 20-500 chars)
      const trimmedContext = context.trim();
      if (trimmedContext.length < 20) {
        throw new Error('Context must be at least 20 characters');
      }
      if (trimmedContext.length > 500) {
        throw new Error('Context must be at most 500 characters');
      }

      // Validate sources
      if (!sources || sources.length === 0) {
        throw new Error('At least one source URL is required');
      }
      if (sources.length > 10) {
        throw new Error('Maximum 10 source URLs allowed');
      }

      // Check if user already submitted a review for this chirp
      const existingQuery = query(
        collection(db, 'postReviews'),
        where('chirpId', '==', chirpId),
        where('submittedBy', '==', submittedBy)
      );
      const existingSnapshot = await getDocs(existingQuery);
      if (!existingSnapshot.empty) {
        throw new Error('You have already submitted a review for this post');
      }

      // Create review context
      const reviewData: any = {
        chirpId,
        submittedBy,
        action,
        sources,
        context: trimmedContext,
        createdAt: Timestamp.now(),
      };

      const docRef = await addDoc(collection(db, 'postReviews'), reviewData);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        throw new Error('Failed to create review context');
      }

      // Check for consensus after adding review (async, don't wait)
      // Use setTimeout to avoid blocking the response
      setTimeout(async () => {
        try {
          const { checkAndUpdateConsensus } = await import('./services/reviewConsensusService');
          await checkAndUpdateConsensus(chirpId);
        } catch (error) {
          console.error('[ReviewContextService] Error checking consensus:', error);
      }
      }, 0);

      return reviewContextFromFirestore(docSnap);
    } catch (error) {
      console.error('[ReviewContextService] Error creating review context:', error);
      throw error;
    }
  },

  async getReviewContextsForChirp(chirpId: string): Promise<PostReviewContext[]> {
    try {
      const q = query(
        collection(db, 'postReviews'),
        where('chirpId', '==', chirpId),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => reviewContextFromFirestore(doc));
    } catch (error) {
      console.error('[ReviewContextService] Error getting review contexts:', error);
      return [];
    }
  },

  async hasUserSubmittedContext(chirpId: string, userId: string): Promise<boolean> {
    try {
      const q = query(
        collection(db, 'postReviews'),
        where('chirpId', '==', chirpId),
        where('submittedBy', '==', userId)
      );
      const snapshot = await getDocs(q);
      return !snapshot.empty;
    } catch (error) {
      console.error('[ReviewContextService] Error checking if user has submitted context:', error);
      return false;
    }
  },
};

// Convert Firestore document to PostReviewContext type
const reviewContextFromFirestore = (doc: any): PostReviewContext => {
  const data = doc.data();
  return {
    id: doc.id,
    chirpId: data.chirpId,
    submittedBy: data.submittedBy,
    action: data.action || 'validate', // Default for backwards compatibility
    sources: data.sources || [],
    context: data.context,
    createdAt: toDate(data.createdAt),
  };
};

