import { collection, query, where, getDocs, getDoc, Timestamp, updateDoc, doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { userService } from '../firestore';

const CONTRIBUTIONS_COLLECTION = collection(db, 'valueContributions');
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Initialize valueStats for a user if it doesn't exist
 */
async function ensureValueStatsInitialized(userId: string): Promise<void> {
  try {
    const userDocRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userDocRef);
    
    if (!userDoc.exists()) {
      console.warn(`[ReputationRecalc] User ${userId} does not exist, skipping valueStats init`);
      return;
    }

    const userData = userDoc.data();
    
    // If valueStats doesn't exist or is incomplete, initialize it
    if (!userData.valueStats || 
        userData.valueStats.postValue30d === undefined ||
        userData.valueStats.commentValue30d === undefined) {
      const now = Timestamp.now();
      await setDoc(
        userDocRef,
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
      console.log(`[ReputationRecalc] Initialized valueStats for user ${userId}`);
    }
  } catch (error) {
    console.error(`[ReputationRecalc] Failed to initialize valueStats for user ${userId}:`, error);
  }
}

export async function recalculateUserReputation(userId: string): Promise<void> {
  try {
    // Ensure valueStats structure exists
    await ensureValueStatsInitialized(userId);

    const sinceDate = new Date(Date.now() - THIRTY_DAYS_MS);
    const sinceTimestamp = Timestamp.fromDate(sinceDate);

    const q = query(
      CONTRIBUTIONS_COLLECTION,
      where('userId', '==', userId),
      where('createdAt', '>=', sinceTimestamp)
    );
    const snapshot = await getDocs(q);

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

    // Get existing lifetime values to preserve them
    const userDocRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userDocRef);
    const userData = userDoc.data();
    const existingLifetimePost = userData?.valueStats?.lifetimePostValue ?? 0;
    const existingLifetimeComment = userData?.valueStats?.lifetimeCommentValue ?? 0;

    await updateDoc(userDocRef, {
      'valueStats.postValue30d': postValue,
      'valueStats.commentValue30d': commentValue,
      'valueStats.lifetimePostValue': existingLifetimePost,
      'valueStats.lifetimeCommentValue': existingLifetimeComment,
      'valueStats.lastUpdated': Timestamp.now(),
    });

    console.log(`[ReputationRecalc] Updated user ${userId}: post=${postValue}, comment=${commentValue}`);
  } catch (error) {
    console.error(`[ReputationRecalc] Failed to recalculate for user ${userId}:`, error);
    throw error;
  }
}

export async function recalculateAllActiveUsers(): Promise<void> {
  try {
    const thirtyDaysAgo = new Date(Date.now() - THIRTY_DAYS_MS);
    const sinceTimestamp = Timestamp.fromDate(thirtyDaysAgo);

    const q = query(
      CONTRIBUTIONS_COLLECTION,
      where('createdAt', '>=', sinceTimestamp)
    );
    const snapshot = await getDocs(q);

    const userIds = new Set<string>();
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.userId) {
        userIds.add(data.userId);
      }
    });

    console.log(`[ReputationRecalc] Recalculating ${userIds.size} active users...`);

    const results = await Promise.allSettled(
      Array.from(userIds).map((userId) => recalculateUserReputation(userId))
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    console.log(`[ReputationRecalc] Completed: ${succeeded} succeeded, ${failed} failed`);
  } catch (error) {
    console.error('[ReputationRecalc] Failed to recalculate all users:', error);
    throw error;
  }
}

export function startPeriodicRecalculation(intervalMs: number = 24 * 60 * 60 * 1000): () => void {
  console.log(`[ReputationRecalc] Starting periodic recalculation (interval: ${intervalMs}ms)`);
  
  const runRecalculation = async () => {
    try {
      await recalculateAllActiveUsers();
    } catch (error) {
      console.error('[ReputationRecalc] Periodic recalculation failed:', error);
    }
  };

  runRecalculation();
  const intervalId = setInterval(runRecalculation, intervalMs);

  return () => {
    clearInterval(intervalId);
    console.log('[ReputationRecalc] Stopped periodic recalculation');
  };
}

