import * as admin from 'firebase-admin';
import type { Chirp, Comment, Claim, FactCheck, ValueScore, DiscussionQuality, User } from '../types';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const { Timestamp, FieldValue } = admin.firestore;

const toDate = (value: any): Date => {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  if (value.toDate) return value.toDate();
  if (typeof value === 'number') return new Date(value);
  return new Date(value);
};

const serializeClaims = (claims?: Claim[]): any[] | undefined => {
  if (!claims) return undefined;
  return claims.map((claim) => ({
    ...claim,
    extractedAt: Timestamp.fromDate(toDate(claim.extractedAt)),
  }));
};

const serializeFactChecks = (factChecks?: FactCheck[]): any[] | undefined => {
  if (!factChecks) return undefined;
  return factChecks.map((factCheck) => ({
    ...factCheck,
    checkedAt: Timestamp.fromDate(toDate(factCheck.checkedAt)),
  }));
};

const serializeValueScore = (valueScore?: ValueScore): any | undefined => {
  if (!valueScore) return undefined;
  return {
    ...valueScore,
    updatedAt: Timestamp.fromDate(toDate(valueScore.updatedAt)),
  };
};

const serializeDiscussionQuality = (discussion?: DiscussionQuality): any | undefined => {
  if (!discussion) return undefined;
  return { ...discussion };
};

const deserializeChirp = (id: string, data: any): Chirp => ({
  id,
  authorId: data.authorId,
  text: data.text || '',
  topic: data.topic,
  semanticTopics: data.semanticTopics || [],
  semanticTopicBuckets: data.semanticTopicBuckets,
  entities: data.entities,
  intent: data.intent,
  analyzedAt: data.analyzedAt ? toDate(data.analyzedAt) : undefined,
  reachMode: data.reachMode || 'forAll',
  tunedAudience: data.tunedAudience,
  contentEmbedding: data.contentEmbedding,
  createdAt: toDate(data.createdAt),
  rechirpOfId: data.rechirpOfId,
  quotedChirpId: data.quotedChirpId,
  commentCount: data.commentCount ?? 0,
  bookmarkCount: data.bookmarkCount ?? 0,
  rechirpCount: data.rechirpCount ?? 0,
  countryCode: data.countryCode,
  imageUrl: data.imageUrl,
  scheduledAt: data.scheduledAt ? toDate(data.scheduledAt) : undefined,
  formattedText: data.formattedText,
  mentions: data.mentions,
  factCheckingStatus: data.factCheckingStatus,
  factCheckingStartedAt: data.factCheckingStartedAt ? toDate(data.factCheckingStartedAt) : undefined,
  claims: data.claims?.map((c: any) => ({ ...c, extractedAt: toDate(c.extractedAt) })),
  factChecks: data.factChecks?.map((f: any) => ({ ...f, checkedAt: toDate(f.checkedAt) })),
  factCheckStatus: data.factCheckStatus,
  valueScore: data.valueScore
    ? { ...data.valueScore, updatedAt: toDate(data.valueScore.updatedAt) }
    : undefined,
  valueExplanation: data.valueExplanation,
  discussionQuality: data.discussionQuality,
  qualityWeightedBookmarkScore: data.qualityWeightedBookmarkScore,
  qualityWeightedRechirpScore: data.qualityWeightedRechirpScore,
  qualityWeightedCommentScore: data.qualityWeightedCommentScore,
  qualityScoresLastUpdated: data.qualityScoresLastUpdated ? toDate(data.qualityScoresLastUpdated) : undefined,
  predictedEngagement: data.predictedEngagement
    ? {
        expectedViews7d: data.predictedEngagement.expectedViews7d ?? 0,
        expectedBookmarks7d: data.predictedEngagement.expectedBookmarks7d ?? 0,
        expectedRechirps7d: data.predictedEngagement.expectedRechirps7d ?? 0,
        expectedComments7d: data.predictedEngagement.expectedComments7d ?? 0,
        predictedAt: toDate(data.predictedEngagement.predictedAt),
      }
    : undefined,
  predictionValidation: data.predictionValidation
    ? {
        flaggedForReview: data.predictionValidation.flaggedForReview ?? false,
        overallError: data.predictionValidation.overallError ?? 0,
        validatedAt: toDate(data.predictionValidation.validatedAt),
      }
    : undefined,
});

const deserializeComment = (id: string, data: any): Comment => ({
  id,
  chirpId: data.chirpId,
  authorId: data.authorId,
  text: data.text || '',
  createdAt: toDate(data.createdAt),
  parentCommentId: data.parentCommentId,
  replyToUserId: data.replyToUserId,
  depth: data.depth,
  replyCount: data.replyCount,
  discussionRole: data.discussionRole,
  valueContribution: data.valueContribution,
  imageUrl: data.imageUrl,
  scheduledAt: data.scheduledAt ? toDate(data.scheduledAt) : undefined,
  formattedText: data.formattedText,
  factCheckingStatus: data.factCheckingStatus,
  factCheckingStartedAt: data.factCheckingStartedAt ? toDate(data.factCheckingStartedAt) : undefined,
  claims: data.claims?.map((c: any) => ({ ...c, extractedAt: toDate(c.extractedAt) })),
  factChecks: data.factChecks?.map((f: any) => ({ ...f, checkedAt: toDate(f.checkedAt) })),
  factCheckStatus: data.factCheckStatus,
});

const deserializeUser = (id: string, data: any): User => ({
  id,
  name: data.name,
  handle: data.handle,
  email: data.email,
  interests: data.interests || [],
  createdAt: toDate(data.createdAt),
  following: data.following || [],
  bookmarks: data.bookmarks || [],
  displayName: data.displayName,
  userId: data.userId,
  topics: data.topics || [],
  bio: data.bio,
  url: data.url,
  location: data.location,
  onboardingCompleted: data.onboardingCompleted,
  onboardingCompletedAt: data.onboardingCompletedAt ? toDate(data.onboardingCompletedAt) : undefined,
  firstTimeUser: data.firstTimeUser,
  autoFollowedAccounts: data.autoFollowedAccounts,
  profilePictureUrl: data.profilePictureUrl,
  coverPhotoUrl: data.coverPhotoUrl,
  reputation: data.reputation,
  valueStats: data.valueStats
    ? {
        postValue30d: data.valueStats.postValue30d ?? 0,
        commentValue30d: data.valueStats.commentValue30d ?? 0,
        lifetimePostValue: data.valueStats.lifetimePostValue ?? 0,
        lifetimeCommentValue: data.valueStats.lifetimeCommentValue ?? 0,
        lastUpdated: data.valueStats.lastUpdated ? toDate(data.valueStats.lastUpdated) : toDate(data.createdAt),
      }
    : undefined,
  kurralScore: data.kurralScore
    ? {
        ...data.kurralScore,
        lastUpdated: toDate(data.kurralScore.lastUpdated),
        history:
          data.kurralScore.history?.map((entry: any) => ({
            ...entry,
            date: toDate(entry.date),
          })) || [],
      }
    : undefined,
  forYouConfig: data.forYouConfig,
  profileSummary: data.profileSummary,
  profileSummaryVersion: data.profileSummaryVersion,
  profileSummaryUpdatedAt: data.profileSummaryUpdatedAt ? toDate(data.profileSummaryUpdatedAt) : undefined,
  profileEmbedding: data.profileEmbedding,
  profileEmbeddingVersion: data.profileEmbeddingVersion,
  semanticTopics: data.semanticTopics || [],
});

const cleanUndefined = (obj: any): any => {
  if (obj === null || obj === undefined) return undefined;
  if (obj instanceof Date || obj instanceof Timestamp) return obj;
  if (Array.isArray(obj)) return obj.map(cleanUndefined).filter((v) => v !== undefined);
  if (typeof obj !== 'object') return obj;
  const cleaned: Record<string, any> = {};
  Object.entries(obj).forEach(([key, value]) => {
    const cleanedValue = cleanUndefined(value);
    if (cleanedValue !== undefined) {
      cleaned[key] = cleanedValue;
    }
  });
  return cleaned;
};

export const chirpService = {
  async getChirp(chirpId: string): Promise<Chirp | null> {
    const docSnap = await db.collection('chirps').doc(chirpId).get();
    if (!docSnap.exists) return null;
    return deserializeChirp(docSnap.id, docSnap.data() || {});
  },

  async getRechirpsOfOriginal(originalChirpId: string): Promise<Chirp[]> {
    const snapshot = await db
      .collection('chirps')
      .where('rechirpOfId', '==', originalChirpId)
      .orderBy('createdAt', 'desc')
      .get();
    return snapshot.docs.map((doc) => deserializeChirp(doc.id, doc.data()));
  },

  async getPendingRechirps(limitCount: number = 50): Promise<Chirp[]> {
    const snapshot = await db
      .collection('chirps')
      .where('factCheckingStatus', '==', 'pending')
      .orderBy('createdAt', 'desc')
      .limit(limitCount * 2)
      .get();
    return snapshot.docs
      .map((doc) => deserializeChirp(doc.id, doc.data()))
      .filter((chirp) => !!chirp.rechirpOfId)
      .slice(0, limitCount);
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
      predictedEngagement?: {
        expectedViews7d: number;
        expectedBookmarks7d: number;
        expectedRechirps7d: number;
        expectedComments7d: number;
        predictedAt: Date;
      };
      predictionValidation?: {
        flaggedForReview: boolean;
        overallError: number;
        validatedAt: Date;
      };
    }
  ): Promise<void> {
    const updates: Record<string, any> = {};

    if (insights.claims !== undefined && insights.claims !== null) {
      updates.claims = serializeClaims(insights.claims);
    }
    if (insights.factChecks !== undefined && insights.factChecks !== null) {
      updates.factChecks = serializeFactChecks(insights.factChecks);
    }
    if (insights.factCheckStatus !== undefined && insights.factCheckStatus !== null) {
      updates.factCheckStatus = insights.factCheckStatus;
    }
    if (insights.factCheckingStatus !== undefined) {
      updates.factCheckingStatus =
        insights.factCheckingStatus === null ? FieldValue.delete() : insights.factCheckingStatus;
    }
    if (insights.factCheckingStartedAt !== undefined) {
      updates.factCheckingStartedAt =
        insights.factCheckingStartedAt === null
          ? FieldValue.delete()
          : Timestamp.fromDate(toDate(insights.factCheckingStartedAt));
    }
    if (insights.valueScore !== undefined && insights.valueScore !== null) {
      updates.valueScore = serializeValueScore(insights.valueScore);
    }
    if (typeof insights.valueExplanation === 'string' && insights.valueExplanation.trim().length > 0) {
      updates.valueExplanation = insights.valueExplanation;
    }
    if (insights.discussionQuality !== undefined && insights.discussionQuality !== null) {
      updates.discussionQuality = serializeDiscussionQuality(insights.discussionQuality);
    }
    if (insights.predictedEngagement !== undefined && insights.predictedEngagement !== null) {
      updates.predictedEngagement = {
        expectedViews7d: insights.predictedEngagement.expectedViews7d,
        expectedBookmarks7d: insights.predictedEngagement.expectedBookmarks7d,
        expectedRechirps7d: insights.predictedEngagement.expectedRechirps7d,
        expectedComments7d: insights.predictedEngagement.expectedComments7d,
        predictedAt: Timestamp.fromDate(toDate(insights.predictedEngagement.predictedAt)),
      };
    }
    if (insights.predictionValidation !== undefined && insights.predictionValidation !== null) {
      updates.predictionValidation = {
        flaggedForReview: insights.predictionValidation.flaggedForReview,
        overallError: insights.predictionValidation.overallError,
        validatedAt: Timestamp.fromDate(toDate(insights.predictionValidation.validatedAt)),
      };
    }

    const cleanedUpdates = cleanUndefined(updates);
    if (Object.keys(cleanedUpdates).length === 0) {
      return;
    }

    await db.collection('chirps').doc(chirpId).update(cleanedUpdates);
  },
};

export const commentService = {
  async getCommentsForChirp(chirpId: string): Promise<Comment[]> {
    const snapshot = await db
      .collection('comments')
      .where('chirpId', '==', chirpId)
      .orderBy('createdAt', 'asc')
      .get();
    return snapshot.docs.map((doc) => deserializeComment(doc.id, doc.data()));
  },

  async updateCommentAnalytics(commentId: string, updates: Partial<Comment>): Promise<void> {
    const payload: Record<string, any> = {};

    if (updates.discussionRole !== undefined) {
      payload.discussionRole = updates.discussionRole;
    }
    if (updates.valueContribution) {
      payload.valueContribution = updates.valueContribution;
    }
    if (updates.factCheckingStatus !== undefined) {
      payload.factCheckingStatus =
        updates.factCheckingStatus === null ? FieldValue.delete() : updates.factCheckingStatus;
    }
    if (updates.factCheckingStartedAt !== undefined) {
      payload.factCheckingStartedAt =
        updates.factCheckingStartedAt === null
          ? FieldValue.delete()
          : Timestamp.fromDate(toDate(updates.factCheckingStartedAt));
    }
    if (updates.claims !== undefined) {
      payload.claims = serializeClaims(updates.claims);
    }
    if (updates.factChecks !== undefined) {
      payload.factChecks = serializeFactChecks(updates.factChecks);
    }
    if (updates.factCheckStatus !== undefined) {
      payload.factCheckStatus = updates.factCheckStatus;
    }

    const cleaned = cleanUndefined(payload);
    if (Object.keys(cleaned).length === 0) return;

    await db.collection('comments').doc(commentId).update(cleaned);
  },
};

export const userService = {
  async getUser(userId: string): Promise<User | null> {
    const docSnap = await db.collection('users').doc(userId).get();
    if (!docSnap.exists) return null;
    return deserializeUser(docSnap.id, docSnap.data() || {});
  },

  async updateValueStats(userId: string, updates: Record<string, any>): Promise<void> {
    await db.collection('users').doc(userId).update(updates);
  },
};

export const timestampFromDate = (date: Date): admin.firestore.Timestamp =>
  Timestamp.fromDate(toDate(date));

export const increment = (value: number) => FieldValue.increment(value);


