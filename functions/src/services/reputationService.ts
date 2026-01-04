import * as admin from 'firebase-admin';
import type { Chirp, Comment, ValueScore, ValueVector, Claim } from '../types';

const db = admin.firestore();
const { Timestamp, FieldValue } = admin.firestore;

const CONTRIBUTIONS_COLLECTION = db.collection('valueContributions');
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

type ContributionRecord = {
  userId: string;
  type: 'post' | 'comment';
  value: number;
  domain?: string;
  chirpId?: string;
  commentId?: string;
};

const dominantDomain = (domains: Array<string | undefined>): string | undefined => {
  const counts = new Map<string, number>();
  domains.filter(Boolean).forEach((domain) => {
    const lower = (domain || 'general').toLowerCase();
    counts.set(lower, (counts.get(lower) || 0) + 1);
  });
  let best: string | undefined;
  let bestCount = 0;
  counts.forEach((count, domain) => {
    if (count > bestCount) {
      best = domain;
      bestCount = count;
    }
  });
  return best;
};

const ensureValueStatsInitialized = async (userId: string): Promise<void> => {
  const userDocRef = db.collection('users').doc(userId);
  const userDoc = await userDocRef.get();
  if (!userDoc.exists) {
    return;
  }
  const userData = userDoc.data() || {};
  if (
    !userData.valueStats ||
    userData.valueStats.postValue30d === undefined ||
    userData.valueStats.commentValue30d === undefined
  ) {
    const now = Timestamp.now();
    await userDocRef.set(
      {
        valueStats: {
          postValue30d: userData.valueStats?.postValue30d ?? 0,
          commentValue30d: userData.valueStats?.commentValue30d ?? 0,
          lifetimePostValue: userData.valueStats?.lifetimePostValue ?? 0,
          lifetimeCommentValue: userData.valueStats?.lifetimeCommentValue ?? 0,
          lastUpdated: now,
        },
      },
      { merge: true }
    );
  }
};

const recordContribution = async (contribution: ContributionRecord): Promise<void> => {
  const now = Timestamp.now();
  await CONTRIBUTIONS_COLLECTION.add({
    ...contribution,
    createdAt: now,
  });

  await ensureValueStatsInitialized(contribution.userId);

  const userDocRef = db.collection('users').doc(contribution.userId);
  const lifetimeField =
    contribution.type === 'post' ? 'valueStats.lifetimePostValue' : 'valueStats.lifetimeCommentValue';

  await userDocRef
    .update({
      [lifetimeField]: FieldValue.increment(contribution.value),
      'valueStats.lastUpdated': now,
    })
    .catch((error) => {
      console.error('[ReputationService] Failed to update lifetime stats:', error);
    });

  await recalcRollingStats(contribution.userId);
};

const recalcRollingStats = async (userId: string): Promise<void> => {
  const sinceDate = new Date(Date.now() - THIRTY_DAYS_MS);
  const sinceTimestamp = Timestamp.fromDate(sinceDate);

  await ensureValueStatsInitialized(userId);

  const q = CONTRIBUTIONS_COLLECTION.where('userId', '==', userId).where('createdAt', '>=', sinceTimestamp);
  const snapshot = await q.get();

  let postValue = 0;
  let commentValue = 0;
  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    if (data.type === 'post') {
      postValue += data.value || 0;
    } else if (data.type === 'comment') {
      commentValue += data.value || 0;
    }
  });

  const userDocRef = db.collection('users').doc(userId);
  const userDoc = await userDocRef.get();
  const userData = userDoc.data();
  const existingLifetimePost = userData?.valueStats?.lifetimePostValue ?? 0;
  const existingLifetimeComment = userData?.valueStats?.lifetimeCommentValue ?? 0;

  await userDocRef.update({
    'valueStats.postValue30d': postValue,
    'valueStats.commentValue30d': commentValue,
    'valueStats.lifetimePostValue': existingLifetimePost,
    'valueStats.lifetimeCommentValue': existingLifetimeComment,
    'valueStats.lastUpdated': Timestamp.now(),
  });
};

async function contributionExists(chirpId: string, userId: string): Promise<boolean> {
  const q = CONTRIBUTIONS_COLLECTION.where('chirpId', '==', chirpId)
    .where('userId', '==', userId)
    .where('type', '==', 'post')
    .limit(1);
  const snapshot = await q.get();
  return !snapshot.empty;
}

export async function recordPostValue(chirp: Chirp, valueScore: ValueScore, claims: Claim[]): Promise<void> {
  const exists = await contributionExists(chirp.id, chirp.authorId);
  if (exists) {
    return;
  }

  const domain = dominantDomain(claims.map((claim) => claim.domain)) || chirp.topic;
  await recordContribution({
    userId: chirp.authorId,
    type: 'post',
    value: valueScore.total,
    domain,
    chirpId: chirp.id,
  });
}

export async function recordCommentValue(
  comment: Comment,
  contribution: ValueVector & { total: number },
  domain?: string
): Promise<void> {
  await recordContribution({
    userId: comment.authorId,
    type: 'comment',
    value: contribution.total,
    domain,
    chirpId: comment.chirpId,
    commentId: comment.id,
  });
}


