import * as admin from 'firebase-admin';
import { chirpService } from './firestoreService';

const db = admin.firestore();
const { Timestamp } = admin.firestore;

/**
 * Validate engagement predictions for chirps created 7 days ago
 * Compares predicted engagement to actual engagement and flags suspicious posts
 */
export async function validateEngagementPredictions(): Promise<void> {
  try {
    // Calculate date range (7 days ago ± 1 day window)
    const now = new Date();
    const sixDaysAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
    const eightDaysAgo = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);

    const startTimestamp = Timestamp.fromDate(eightDaysAgo);
    const endTimestamp = Timestamp.fromDate(sixDaysAgo);

    console.log(`[ValidationService] Validating predictions for chirps created between ${eightDaysAgo.toISOString()} and ${sixDaysAgo.toISOString()}`);

    // Query chirps created in the date range
    // Firestore doesn't support != null queries, so we'll filter client-side for predictedEngagement
    const snapshot = await db
      .collection('chirps')
      .where('createdAt', '>=', startTimestamp)
      .where('createdAt', '<=', endTimestamp)
      .limit(200)
      .get();

    if (snapshot.empty) {
      console.log('[ValidationService] No chirps found for validation');
      return;
    }

    console.log(`[ValidationService] Found ${snapshot.docs.length} chirps to validate`);

    const validationResults: Array<{
      chirpId: string;
      authorId: string;
      flaggedForReview: boolean;
      overallError: number;
    }> = [];

    // Validate each chirp
    for (const doc of snapshot.docs) {
      try {
        const chirp = await chirpService.getChirp(doc.id);
        
        // Filter client-side for predictedEngagement (since Firestore doesn't support != null)
        if (!chirp || !chirp.predictedEngagement) {
          continue;
        }

        // Get actual engagement metrics
        const actualBookmarks = chirp.bookmarkCount ?? 0;
        const actualRechirps = chirp.rechirpCount ?? 0;
        const actualComments = chirp.commentCount ?? 0;

        const predicted = chirp.predictedEngagement;

        // Calculate prediction errors (absolute error / max(predicted, 1) to avoid division by zero)
        const bookmarkError = Math.abs(predicted.expectedBookmarks7d - actualBookmarks) / Math.max(predicted.expectedBookmarks7d, 1);
        const rechirpError = Math.abs(predicted.expectedRechirps7d - actualRechirps) / Math.max(predicted.expectedRechirps7d, 1);
        const commentError = Math.abs(predicted.expectedComments7d - actualComments) / Math.max(predicted.expectedComments7d, 1);

        // Overall error (average of all errors)
        const overallError = (bookmarkError + rechirpError + commentError) / 3;

        // Flag as suspicious if high prediction error AND low actual engagement
        // This suggests gaming attempt (LLM predicted high value, but users didn't engage)
        const flaggedForReview =
          overallError > 0.8 &&
          actualBookmarks < predicted.expectedBookmarks7d * 0.2 &&
          actualRechirps < predicted.expectedRechirps7d * 0.2 &&
          actualComments < predicted.expectedComments7d * 0.2;

        // Store validation result
        await db.collection('chirps').doc(doc.id).update({
          predictionValidation: {
            flaggedForReview,
            overallError,
            validatedAt: Timestamp.now(),
          },
        });

        validationResults.push({
          chirpId: doc.id,
          authorId: chirp.authorId,
          flaggedForReview,
          overallError,
        });

        console.log(`[ValidationService] Validated chirp ${doc.id}: error=${overallError.toFixed(2)}, flagged=${flaggedForReview}`);
      } catch (error: any) {
        console.error(`[ValidationService] Error validating chirp ${doc.id}:`, error);
        // Continue with next chirp
      }
    }

    // Update Kurral Scores based on prediction accuracy
    const userAccuracyMap = new Map<string, { total: number; accurate: number; errors: number[] }>();

    for (const result of validationResults) {
      const existing = userAccuracyMap.get(result.authorId) || { total: 0, accurate: 0, errors: [] };
      existing.total += 1;
      existing.errors.push(result.overallError);
      // Consider accurate if error < 0.5 (50% threshold)
      if (result.overallError < 0.5) {
        existing.accurate += 1;
      }
      userAccuracyMap.set(result.authorId, existing);
    }

    // Update Kurral Scores for users with validation results
    for (const [userId, stats] of userAccuracyMap.entries()) {
      try {
        const avgError = stats.errors.reduce((sum, err) => sum + err, 0) / stats.errors.length;
        const accuracyRate = stats.accurate / stats.total;

        // Update user's prediction accuracy (stored in user document for future use)
        // For now, we'll just log it - Kurral Score update will be done separately
        console.log(`[ValidationService] User ${userId}: accuracy=${accuracyRate.toFixed(2)}, avgError=${avgError.toFixed(2)}`);

        // Note: Kurral Score update based on prediction accuracy would go here
        // For MVP, we'll skip this to avoid complexity
      } catch (error: any) {
        console.error(`[ValidationService] Error updating user ${userId}:`, error);
      }
    }

    console.log(`[ValidationService] Validation complete: ${validationResults.length} chirps validated, ${validationResults.filter(r => r.flaggedForReview).length} flagged`);
  } catch (error: any) {
    console.error('[ValidationService] Error in validation job:', error);
    throw error;
  }
}

