import * as admin from 'firebase-admin';
import { userService, chirpService } from './firestoreService';

const db = admin.firestore();

/**
 * Calculate quality-weighted bookmark score for a chirp
 * Returns a normalized score (0-1) based on the sum of Kurral Scores of users who bookmarked it
 */
export async function calculateQualityWeightedBookmarkScore(chirpId: string): Promise<number> {
  try {
    // Get all users
    const usersSnapshot = await db.collection('users').get();
    
    if (usersSnapshot.empty) {
      return 0;
    }

    let weightedSum = 0;
    let bookmarkCount = 0;

    // Iterate through all users and check if they bookmarked this chirp
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const bookmarks = userData.bookmarks || [];
      
      if (bookmarks.includes(chirpId)) {
        bookmarkCount++;
        // Get user's Kurral Score (default to 50 if not set)
        const kurralScore = userData.kurralScore?.score ?? 50;
        // Normalize to 0-1 range (Kurral Score is 0-100)
        weightedSum += kurralScore / 100;
      }
    }

    // Normalize: divide by bookmark count to get average, but cap at 1
    // If no bookmarks, return 0
    if (bookmarkCount === 0) {
      return 0;
    }

    // Return the average quality score (already normalized 0-1)
    return Math.min(1, weightedSum / bookmarkCount);
  } catch (error) {
    console.error(`Error calculating quality-weighted bookmark score for chirp ${chirpId}:`, error);
    return 0;
  }
}

/**
 * Calculate quality-weighted rechirp score for a chirp
 * Returns a normalized score (0-1) based on the sum of Kurral Scores of users who rechirped it
 */
export async function calculateQualityWeightedRechirpScore(chirpId: string): Promise<number> {
  try {
    // Get all rechirps of this chirp
    const rechirps = await chirpService.getRechirpsOfOriginal(chirpId);
    
    if (rechirps.length === 0) {
      return 0;
    }

    let weightedSum = 0;

    // For each rechirp, get the author's Kurral Score
    for (const rechirp of rechirps) {
      const author = await userService.getUser(rechirp.authorId);
      if (author) {
        const kurralScore = author.kurralScore?.score ?? 50;
        // Normalize to 0-1 range (Kurral Score is 0-100)
        weightedSum += kurralScore / 100;
      }
    }

    // Normalize: divide by rechirp count to get average, but cap at 1
    const averageScore = weightedSum / rechirps.length;
    return Math.min(1, averageScore);
  } catch (error) {
    console.error(`Error calculating quality-weighted rechirp score for chirp ${chirpId}:`, error);
    return 0;
  }
}

/**
 * Calculate quality-weighted comment score for a chirp
 * Returns a normalized score (0-1) based on the sum of Kurral Scores of users who commented
 */
export async function calculateQualityWeightedCommentScore(chirpId: string): Promise<number> {
  try {
    // Get all comments for this chirp
    const commentsSnapshot = await db
      .collection('comments')
      .where('chirpId', '==', chirpId)
      .get();
    
    if (commentsSnapshot.empty) {
      return 0;
    }

    let weightedSum = 0;
    const uniqueAuthors = new Set<string>();

    // For each comment, get the author's Kurral Score
    for (const commentDoc of commentsSnapshot.docs) {
      const commentData = commentDoc.data();
      const authorId = commentData.authorId;
      
      if (!uniqueAuthors.has(authorId)) {
        uniqueAuthors.add(authorId);
        const author = await userService.getUser(authorId);
        if (author) {
          const kurralScore = author.kurralScore?.score ?? 50;
          // Normalize to 0-1 range (Kurral Score is 0-100)
          weightedSum += kurralScore / 100;
        }
      }
    }

    // Normalize: divide by unique author count to get average, but cap at 1
    if (uniqueAuthors.size === 0) {
      return 0;
    }

    const averageScore = weightedSum / uniqueAuthors.size;
    return Math.min(1, averageScore);
  } catch (error) {
    console.error(`Error calculating quality-weighted comment score for chirp ${chirpId}:`, error);
    return 0;
  }
}

/**
 * Calculate and update all quality-weighted scores for a chirp
 * This function should be called when engagement metrics change
 */
export async function updateQualityWeightedScores(chirpId: string): Promise<void> {
  try {
    const [bookmarkScore, rechirpScore, commentScore] = await Promise.all([
      calculateQualityWeightedBookmarkScore(chirpId),
      calculateQualityWeightedRechirpScore(chirpId),
      calculateQualityWeightedCommentScore(chirpId),
    ]);

    // Update chirp with quality scores
    await db.collection('chirps').doc(chirpId).update({
      qualityWeightedBookmarkScore: bookmarkScore,
      qualityWeightedRechirpScore: rechirpScore,
      qualityWeightedCommentScore: commentScore,
      qualityScoresLastUpdated: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.error(`Error updating quality-weighted scores for chirp ${chirpId}:`, error);
    // Don't throw - this is a non-critical update
  }
}

