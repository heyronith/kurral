// Value pipeline service for webapp
// Uses Firebase Cloud Functions (server-side processing)
// Same approach as mobile app for consistency and security

import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

// Helper to convert Firestore timestamps to Date objects
const toDate = (value) => {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  if (value.toDate && typeof value.toDate === 'function') return value.toDate();
  if (typeof value === 'number') return new Date(value);
  if (typeof value === 'string') return new Date(value);
  return undefined;
};

const normalizeChirp = (chirp) => ({
  ...chirp,
  createdAt: toDate(chirp.createdAt) || new Date(),
  analyzedAt: toDate(chirp.analyzedAt),
  scheduledAt: toDate(chirp.scheduledAt),
  factCheckingStartedAt: toDate(chirp.factCheckingStartedAt),
  claims: chirp.claims?.map((c) => ({
    ...c,
    extractedAt: toDate(c.extractedAt) || new Date(),
  })),
  factChecks: chirp.factChecks?.map((f) => ({
    ...f,
    checkedAt: toDate(f.checkedAt) || new Date(),
  })),
  valueScore: chirp.valueScore ? {
    ...chirp.valueScore,
    updatedAt: toDate(chirp.valueScore.updatedAt) || new Date(),
  } : undefined,
});

/**
 * Process chirp through value pipeline
 *
 * This function calls a Firebase Cloud Function to process the chirp
 * through the value pipeline (fact-checking, value scoring, etc.)
 *
 * All processing happens server-side in Firebase Cloud Functions,
 * which is more secure and consistent with the mobile app.
 */
export async function processChirpValue(chirp, options) {
  try {
    const callable = httpsCallable(functions, 'processChirpValue');
    const result = await callable({ chirpId: chirp.id, chirp, options });
    return normalizeChirp(result.data);
  } catch (error) {
    console.error('[ValuePipeline] Failed to process chirp value:', error);
    // Return the original chirp on error - pipeline will handle retries
    return chirp;
  }
}

/**
 * Process comment through value pipeline
 *
 * This function calls a Firebase Cloud Function to process the comment
 * through the value pipeline (fact-checking, value scoring, etc.)
 */
export async function processCommentValue(comment) {
  try {
    const callable = httpsCallable(functions, 'processCommentValue');
    const result = await callable({ commentId: comment.id, comment });
    const data = result.data;
    
    return {
      commentInsights: data.commentInsights,
      updatedChirp: data.updatedChirp ? normalizeChirp(data.updatedChirp) : undefined,
    };
  } catch (error) {
    console.error('[ValuePipeline] Failed to process comment value:', error);
    // Return empty object on error - pipeline will handle retries
    return {};
  }
}

/**
 * Process pending rechirps (no-op for webapp - handled by scheduled Cloud Function)
 *
 * This is kept for API compatibility but does nothing on webapp.
 * Rechirps are processed by the scheduled Cloud Function (processPendingRechirpsCron).
 */
export async function processPendingRechirps(limitCount = 50) {
  // No-op: rechirps are processed by scheduled Cloud Function
  console.log('[ValuePipeline] processPendingRechirps is handled by scheduled Cloud Function');
}
