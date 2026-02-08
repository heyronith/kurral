import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  addDoc,
  deleteDoc,
  updateDoc,
  Timestamp,
  where,
  deleteField,
  increment,
  type DocumentData,
  type QueryConstraint,
  type QuerySnapshot,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { Chirp, FirestoreChirp, ForYouConfig, Claim, FactCheck, ValueScore, DiscussionQuality } from '../types';

const CHIRPS_COLLECTION = 'chirps';
const DEFAULT_LIMIT = 50;

// Helper to convert Firestore timestamps to Date objects
const toDate = (value: any): Date | undefined => {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  if (value.toDate && typeof value.toDate === 'function') return value.toDate();
  if (typeof value === 'number') return new Date(value);
  if (typeof value === 'string') return new Date(value);
  return undefined;
};

// Normalize claims array (convert Firestore timestamps to Date objects)
const normalizeClaims = (claims?: Claim[]): Claim[] | undefined => {
  if (!claims || !Array.isArray(claims)) return undefined;
  return claims.map((claim) => ({
    ...claim,
    extractedAt: toDate((claim as any).extractedAt) || new Date(),
  }));
};

// Normalize factChecks array (convert Firestore timestamps to Date objects)
const normalizeFactChecks = (factChecks?: FactCheck[]): FactCheck[] | undefined => {
  if (!factChecks || !Array.isArray(factChecks)) return undefined;
  return factChecks.map((factCheck) => ({
    ...factCheck,
    checkedAt: toDate((factCheck as any).checkedAt) || new Date(),
  }));
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

const toChirp = (docSnap: QuerySnapshot<DocumentData>['docs'][number] | any): Chirp => {
  const data = docSnap.data() as FirestoreChirp;

  return {
    ...data,
    id: docSnap.id,
    createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
    scheduledAt: data.scheduledAt?.toDate
      ? data.scheduledAt.toDate()
      : undefined,
    analyzedAt: data.analyzedAt?.toDate ? data.analyzedAt.toDate() : undefined,
    commentCount: data.commentCount ?? 0,
    // Normalize claims and factChecks to ensure dates are properly converted
    claims: normalizeClaims(data.claims),
    factChecks: normalizeFactChecks(data.factChecks),
  } as Chirp;
};

const buildTopicQuery = (topics: string[], max: number) => {
  const constraints: QueryConstraint[] = [
    where('topic', 'in', topics.slice(0, 10)),
    orderBy('createdAt', 'desc'),
    limit(max),
  ];

  return query(collection(db, CHIRPS_COLLECTION), ...constraints);
};

const buildLatestQuery = (followingIds: string[] | undefined | null, max: number) => {
  // Handle undefined/null/empty followingIds - ensure it's always an array
  const safeFollowingIds = Array.isArray(followingIds) ? followingIds : [];
  // Firestore 'in' query has a limit of 10 items
  const idsToQuery = safeFollowingIds.slice(0, 10);

  if (idsToQuery.length === 0) {
    // Return empty query result if no following - use a query that will return no results
    // We can't use limit(0), so we use a where clause that will never match
    return query(
      collection(db, CHIRPS_COLLECTION),
      where('authorId', '==', '__no_matches__'), // This will return no results
      limit(1) // Use limit(1) instead of limit(0) - it will just return empty
    );
  }

  return query(
    collection(db, CHIRPS_COLLECTION),
    where('authorId', 'in', idsToQuery),
    orderBy('createdAt', 'desc'),
    limit(max)
  );
};

const buildAllRecentQuery = (max: number) =>
  query(
    collection(db, CHIRPS_COLLECTION),
    orderBy('createdAt', 'desc'),
    limit(max)
  );

export const chirpService = {
  listenLatest(
    followingIds: string[] | undefined | null,
    currentUserId: string,
    onUpdate: (chirps: Chirp[]) => void,
    onError?: (err: any) => void,
    max: number = DEFAULT_LIMIT
  ): () => void {
    const q = buildLatestQuery(followingIds, max);
    return onSnapshot(
      q,
      (snapshot) => {
        // Filter out own posts and sort (matching webapp behavior)
        const chirps = snapshot.docs
          .map(toChirp)
          .filter((chirp) => chirp.authorId !== currentUserId)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        onUpdate(chirps);
      },
      (err) => {
        console.error('[chirpService] listenLatest failed', err);
        onError?.(err);
      }
    );
  },

  listenForYou(
    userId: string,
    config: ForYouConfig | undefined,
    onUpdate: (chirps: Chirp[]) => void,
    onError?: (err: any) => void,
    max: number = DEFAULT_LIMIT
  ): () => void {
    // For You feed: Load ALL recent chirps (algorithm will filter/score them)
    const q = buildAllRecentQuery(max);

    return onSnapshot(
      q,
      (snapshot) => {
        onUpdate(snapshot.docs.map(toChirp));
      },
      (err) => {
        console.error('[chirpService] listenForYou failed', err, { userId });
        onError?.(err);
      }
    );
  },

  listenToChirp(
    chirpId: string,
    onUpdate: (chirp: Chirp) => void,
    onError?: (err: any) => void
  ): () => void {
    const docRef = doc(db, CHIRPS_COLLECTION, chirpId);
    return onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          onUpdate(toChirp(snapshot));
        } else {
          onError?.(new Error('Chirp not found'));
        }
      },
      (err) => {
        console.error('[chirpService] listenToChirp failed', err, { chirpId });
        onError?.(err);
      }
    );
  },

  async fetchLatest(
    followingIds: string[] | undefined | null,
    currentUserId: string,
    max: number = DEFAULT_LIMIT
  ): Promise<Chirp[]> {
    const snap = await getDocs(buildLatestQuery(followingIds, max));
    // Filter out own posts and sort (matching webapp behavior)
    return snap.docs
      .map(toChirp)
      .filter((chirp) => chirp.authorId !== currentUserId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  },

  async fetchForYou(
    userId: string,
    config: ForYouConfig | undefined,
    max: number = DEFAULT_LIMIT
  ): Promise<Chirp[]> {
    // For You feed: Load ALL recent chirps (algorithm will filter/score them)
    const q = buildAllRecentQuery(max);
    const snap = await getDocs(q);
    return snap.docs.map(toChirp);
  },

  async createChirp(
    chirp: Omit<Chirp, 'id' | 'createdAt' | 'commentCount'>
  ): Promise<Chirp> {
    const payload: any = {
      authorId: chirp.authorId,
      text: chirp.text,
      topic: chirp.topic,
      reachMode: chirp.reachMode,
      createdAt: Timestamp.now(),
      commentCount: 0,
      bookmarkCount: 0,
      rechirpCount: 0,
      // Initialize fact checking status for resume capability
      factCheckingStatus: 'pending',
      factCheckingStartedAt: Timestamp.now(),
    };

    if (chirp.tunedAudience) payload.tunedAudience = chirp.tunedAudience;
    if (chirp.rechirpOfId) payload.rechirpOfId = chirp.rechirpOfId;
    if (chirp.quotedChirpId) payload.quotedChirpId = chirp.quotedChirpId;
    if (chirp.imageUrl) payload.imageUrl = chirp.imageUrl;
    if (chirp.countryCode) payload.countryCode = chirp.countryCode;
    if (chirp.scheduledAt) payload.scheduledAt = Timestamp.fromDate(chirp.scheduledAt);
    if (chirp.formattedText) payload.formattedText = chirp.formattedText;
    if (chirp.mentions && chirp.mentions.length > 0) payload.mentions = chirp.mentions;
    if (chirp.semanticTopics && chirp.semanticTopics.length > 0) payload.semanticTopics = chirp.semanticTopics;
    if (chirp.semanticTopicBuckets && Object.keys(chirp.semanticTopicBuckets).length > 0) {
      payload.semanticTopicBuckets = chirp.semanticTopicBuckets;
    }
    if (chirp.entities && chirp.entities.length > 0) payload.entities = chirp.entities;
    if (chirp.intent) payload.intent = chirp.intent;
    if (chirp.analyzedAt) payload.analyzedAt = Timestamp.fromDate(chirp.analyzedAt);
    if (chirp.contentEmbedding && chirp.contentEmbedding.length > 0) {
      payload.contentEmbedding = chirp.contentEmbedding;
    }

    const docRef = await addDoc(collection(db, CHIRPS_COLLECTION), payload);
    const created = await getDoc(docRef);
    if (!created.exists()) {
      throw new Error('Failed to create chirp');
    }
    const newChirp = toChirp(created as any);

    // Create notifications for mentions (fire-and-forget, don't block posting)
    if (chirp.mentions && chirp.mentions.length > 0) {
      // Use dynamic import to avoid circular dependencies
      import('./notificationService').then(({ notificationService }) => {
        chirp.mentions!.forEach(mentionedUserId => {
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
      }).catch(err => {
        console.error('Error importing notificationService:', err);
      });
    }

    // Create notification if this is a rechirp (fire-and-forget)
    if (chirp.rechirpOfId && chirp.authorId) {
      import('./notificationService').then(async ({ notificationService }) => {
        try {
          const originalChirpDoc = await getDoc(doc(db, CHIRPS_COLLECTION, chirp.rechirpOfId!));
          const originalChirpData = originalChirpDoc.data();
          if (originalChirpData && originalChirpData.authorId !== chirp.authorId) {
            await notificationService.createNotification({
              userId: originalChirpData.authorId,
              type: 'rechirp',
              actorId: chirp.authorId,
              chirpId: chirp.rechirpOfId!,
              metadata: {
                originalChirpId: chirp.rechirpOfId!,
              },
            }).catch(err => {
              // Silently fail - notification errors shouldn't block rechirps
              if (!err.message?.includes('disabled') && !err.message?.includes('muted')) {
                console.error('Error creating rechirp notification:', err);
              }
            });
          }
          // Increment rechirp count on original chirp (non-blocking)
          chirpService.updateRechirpCount(chirp.rechirpOfId!, 1).catch((error: any) => {
            console.error('Error incrementing rechirp count:', error);
          });
        } catch (notifError: any) {
          // Don't let notification errors break rechirp creation
          if (!notifError.message?.includes('disabled') && !notifError.message?.includes('muted')) {
            console.error('Error creating rechirp notification:', notifError);
          }
        }
      }).catch(err => {
        console.error('Error importing notificationService:', err);
      });
    }

    return newChirp;
  },

  async updateBookmarkCount(chirpId: string, delta: number): Promise<void> {
    try {
      const chirpRef = doc(db, CHIRPS_COLLECTION, chirpId);
      await updateDoc(chirpRef, {
        bookmarkCount: increment(delta),
      });
    } catch (error) {
      console.error(`Error updating bookmark count for chirp ${chirpId}:`, error);
    }
  },

  async updateRechirpCount(chirpId: string, delta: number): Promise<void> {
    try {
      const chirpRef = doc(db, CHIRPS_COLLECTION, chirpId);
      await updateDoc(chirpRef, {
        rechirpCount: increment(delta),
      });
    } catch (error) {
      console.error(`Error updating rechirp count for chirp ${chirpId}:`, error);
    }
  },

  async deleteChirp(chirpId: string, authorId: string): Promise<void> {
    const docRef = doc(db, CHIRPS_COLLECTION, chirpId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return;
    const data = snap.data() as FirestoreChirp;
    if (data.authorId !== authorId) {
      throw new Error('Cannot delete chirp that is not yours');
    }
    await deleteDoc(docRef);
  },

  async getChirp(id: string): Promise<Chirp | null> {
    const ref = doc(db, CHIRPS_COLLECTION, id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return toChirp(snap);
  },

  async getChirpsByAuthor(authorId: string, limitCount: number = 50): Promise<Chirp[]> {
    try {
      const q = query(
        collection(db, CHIRPS_COLLECTION),
        where('authorId', '==', authorId),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );
      const snapshot = await getDocs(q);
      const now = new Date();
      return snapshot.docs
        .map(toChirp)
        .filter((chirp) => {
          // Filter out scheduled posts that haven't been published yet
          if (chirp.scheduledAt && chirp.scheduledAt > now) {
            return false;
          }
          return true;
        });
    } catch (error) {
      console.error('[chirpService] Error fetching chirps by author:', error);
      return [];
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

    // Helper to serialize dates to Firestore Timestamps
    const timestampField = (value?: Date | null): any => {
      if (!value) return undefined;
      return Timestamp.fromDate(value);
    };

    if (insights.claims !== undefined && insights.claims !== null) {
      updates.claims = insights.claims.map((claim) => ({
        ...claim,
        extractedAt: timestampField(claim.extractedAt),
        evidence: claim.evidence?.map((evidence) => ({ ...evidence })),
      }));
    }
    if (insights.factChecks !== undefined && insights.factChecks !== null) {
      updates.factChecks = insights.factChecks.map((factCheck) => ({
        ...factCheck,
        checkedAt: timestampField(factCheck.checkedAt),
        evidence: factCheck.evidence?.map((evidence) => ({ ...evidence })),
      }));
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
        updates.factCheckingStartedAt = timestampField(insights.factCheckingStartedAt);
      }
    }
    if (insights.valueScore !== undefined && insights.valueScore !== null) {
      const { updatedAt, ...rest } = insights.valueScore;
      updates.valueScore = {
        ...rest,
        updatedAt: timestampField(updatedAt),
      };
    }
    if (typeof insights.valueExplanation === 'string' && insights.valueExplanation.trim().length > 0) {
      updates.valueExplanation = insights.valueExplanation;
    }
    if (insights.discussionQuality !== undefined && insights.discussionQuality !== null) {
      updates.discussionQuality = { ...insights.discussionQuality };
    }

    // Remove any undefined values from updates
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

    await updateDoc(doc(db, CHIRPS_COLLECTION, chirpId), cleanedUpdates);
  },

  async getLatestChirps(followingIds: string[], limitCount: number = 50): Promise<Chirp[]> {
    if (followingIds.length === 0) return [];

    try {
      const constraints: QueryConstraint[] = [
        where('authorId', 'in', followingIds),
        orderBy('createdAt', 'desc'),
        limit(limitCount),
      ];

      const q = query(collection(db, CHIRPS_COLLECTION), ...constraints);
      const snapshot = await getDocs(q);
      const now = new Date();
      return snapshot.docs
        .map(toChirp)
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

  async getRecentChirps(limitCount: number = 100): Promise<Chirp[]> {
    try {
      const q = query(
        collection(db, CHIRPS_COLLECTION),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );
      const snapshot = await getDocs(q);
      const now = new Date();
      return snapshot.docs
        .map(toChirp)
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
            collection(db, CHIRPS_COLLECTION),
            where('semanticTopics', 'array-contains-any', batch),
            orderBy('createdAt', 'desc'),
            limit(limitPerBatch)
          );
          const snapshot = await getDocs(q);
          return snapshot.docs
            .map(toChirp)
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
    user: any,
    limitCount: number = 120
  ): Promise<Chirp[]> {
    const interests = (user.interests || []) as string[];
    const followingIds = (user.following || []) as string[];

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
};


