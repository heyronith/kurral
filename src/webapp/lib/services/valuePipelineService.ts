// Value pipeline service for webapp
// Uses Firebase Cloud Functions (server-side processing)
// Same approach as mobile app for consistency and security

import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
import type { Chirp, Comment } from '../../types';

/**
 * Process chirp through value pipeline
 * 
 * This function calls a Firebase Cloud Function to process the chirp
 * through the value pipeline (fact-checking, value scoring, etc.)
 * 
 * All processing happens server-side in Firebase Cloud Functions,
 * which is more secure and consistent with the mobile app.
 */
export async function processChirpValue(
  chirp: Chirp,
  options?: { skipFactCheck?: boolean }
): Promise<Chirp> {
  try {
    const callable = httpsCallable(functions, 'processChirpValue');
    const result = await callable({ chirpId: chirp.id, chirp, options });
    return result.data as Chirp;
  } catch (error: any) {
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
export async function processCommentValue(
  comment: Comment
): Promise<{
  commentInsights?: Record<string, any>;
  updatedChirp?: Chirp;
}> {
  try {
    const callable = httpsCallable(functions, 'processCommentValue');
    const result = await callable({ commentId: comment.id, comment });
    return result.data as {
      commentInsights?: Record<string, any>;
      updatedChirp?: Chirp;
    };
  } catch (error: any) {
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
export async function processPendingRechirps(limitCount: number = 50): Promise<void> {
  // No-op: rechirps are processed by scheduled Cloud Function
  console.log('[ValuePipeline] processPendingRechirps is handled by scheduled Cloud Function');
}
