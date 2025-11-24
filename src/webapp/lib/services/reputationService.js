import { addDoc, collection, doc, getDoc, getDocs, increment, query, setDoc, Timestamp, updateDoc, where, } from 'firebase/firestore';
import { db } from '../firebase';
const CONTRIBUTIONS_COLLECTION = collection(db, 'valueContributions');
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const dominantDomain = (domains) => {
    const counts = new Map();
    domains.filter(Boolean).forEach((domain) => {
        const lower = (domain || 'general').toLowerCase();
        counts.set(lower, (counts.get(lower) || 0) + 1);
    });
    let best;
    let bestCount = 0;
    counts.forEach((count, domain) => {
        if (count > bestCount) {
            best = domain;
            bestCount = count;
        }
    });
    return best;
};
/**
 * Initialize valueStats for a user if it doesn't exist
 */
const ensureValueStatsInitialized = async (userId) => {
    try {
        const userDocRef = doc(db, 'users', userId);
        const userDoc = await getDoc(userDocRef);
        if (!userDoc.exists()) {
            console.warn(`[ReputationService] User ${userId} does not exist, skipping valueStats init`);
            return;
        }
        const userData = userDoc.data();
        // If valueStats doesn't exist or is incomplete, initialize it
        if (!userData.valueStats ||
            userData.valueStats.postValue30d === undefined ||
            userData.valueStats.commentValue30d === undefined) {
            const now = Timestamp.now();
            await setDoc(userDocRef, {
                valueStats: {
                    postValue30d: userData.valueStats?.postValue30d ?? 0,
                    commentValue30d: userData.valueStats?.commentValue30d ?? 0,
                    lifetimePostValue: userData.valueStats?.lifetimePostValue ?? 0,
                    lifetimeCommentValue: userData.valueStats?.lifetimeCommentValue ?? 0,
                    lastUpdated: now,
                },
            }, { merge: true });
            console.log(`[ReputationService] Initialized valueStats for user ${userId}`);
        }
    }
    catch (error) {
        console.error(`[ReputationService] Failed to initialize valueStats for user ${userId}:`, error);
    }
};
const recordContribution = async (contribution) => {
    const now = Timestamp.now();
    await addDoc(CONTRIBUTIONS_COLLECTION, {
        ...contribution,
        createdAt: now,
    });
    // Ensure valueStats structure exists before using increment
    await ensureValueStatsInitialized(contribution.userId);
    const userDocRef = doc(db, 'users', contribution.userId);
    const lifetimeField = contribution.type === 'post' ? 'valueStats.lifetimePostValue' : 'valueStats.lifetimeCommentValue';
    await updateDoc(userDocRef, {
        [lifetimeField]: increment(contribution.value),
        'valueStats.lastUpdated': now,
    }).catch((error) => {
        console.error('[ReputationService] Failed to update lifetime stats:', error);
    });
    await recalcRollingStats(contribution.userId);
};
const recalcRollingStats = async (userId) => {
    const sinceDate = new Date(Date.now() - THIRTY_DAYS_MS);
    const sinceTimestamp = Timestamp.fromDate(sinceDate);
    try {
        // Ensure valueStats structure exists
        await ensureValueStatsInitialized(userId);
        const q = query(CONTRIBUTIONS_COLLECTION, where('userId', '==', userId), where('createdAt', '>=', sinceTimestamp));
        const snapshot = await getDocs(q);
        let postValue = 0;
        let commentValue = 0;
        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            if (data.type === 'post') {
                postValue += data.value || 0;
            }
            else if (data.type === 'comment') {
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
    }
    catch (error) {
        console.error('[ReputationService] Failed to recalc rolling stats:', error);
    }
};
/**
 * Check if a contribution already exists for a chirp
 */
async function contributionExists(chirpId, userId) {
    try {
        const q = query(CONTRIBUTIONS_COLLECTION, where('chirpId', '==', chirpId), where('userId', '==', userId), where('type', '==', 'post'));
        const snapshot = await getDocs(q);
        return !snapshot.empty;
    }
    catch (error) {
        console.error('[ReputationService] Error checking contribution existence:', error);
        // If we can't check, assume it doesn't exist to avoid missing contributions
        return false;
    }
}
export async function recordPostValue(chirp, valueScore, claims) {
    // Check if contribution already exists to avoid duplicates
    const exists = await contributionExists(chirp.id, chirp.authorId);
    if (exists) {
        console.log(`[ReputationService] Contribution already exists for chirp ${chirp.id}, skipping`);
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
export async function recordCommentValue(comment, contribution, domain) {
    await recordContribution({
        userId: comment.authorId,
        type: 'comment',
        value: contribution.total,
        domain,
        chirpId: comment.chirpId,
        commentId: comment.id,
    });
}
