// Value pipeline service for webapp
// Uses Firebase Cloud Functions (server-side processing)
// Same approach as mobile app for consistency and security
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
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
        // The Cloud Function returns an enriched Chirp
        const enrichedChirp = result.data;
        // Ensure dates are properly converted
        return {
            ...enrichedChirp,
            createdAt: enrichedChirp.createdAt instanceof Date
                ? enrichedChirp.createdAt
                : new Date(enrichedChirp.createdAt),
            valueScore: enrichedChirp.valueScore ? {
                ...enrichedChirp.valueScore,
                updatedAt: enrichedChirp.valueScore.updatedAt instanceof Date
                    ? enrichedChirp.valueScore.updatedAt
                    : new Date(enrichedChirp.valueScore.updatedAt),
            } : undefined,
            claims: enrichedChirp.claims?.map((c) => ({
                ...c,
                extractedAt: c.extractedAt instanceof Date ? c.extractedAt : new Date(c.extractedAt),
            })),
            factChecks: enrichedChirp.factChecks?.map((f) => ({
                ...f,
                checkedAt: f.checkedAt instanceof Date ? f.checkedAt : new Date(f.checkedAt),
            })),
        };
    }
    catch (error) {
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
        return result.data;
    }
    catch (error) {
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
