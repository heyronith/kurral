// Value pipeline service for webapp
// Uses Firebase Cloud Functions (server-side processing)
// Same approach as mobile app for consistency and security

import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
import type { Chirp, Comment } from '../../types';

// Pipeline result type (matches Cloud Function response)
export interface PipelineResult {
  success: boolean;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  claims: any[];
  factChecks: any[];
  factCheckStatus: 'clean' | 'needs_review' | 'blocked';
  valueScore?: {
    epistemic: number;
    insight: number;
    practical: number;
    relational: number;
    effort: number;
    total: number;
    confidence: number;
    updatedAt: Date;
    drivers?: string[];
  };
  processedAt: Date;
  durationMs: number;
  stepsCompleted: string[];
  error?: {
    step: string;
    message: string;
    isRetryable: boolean;
  };
}

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
    
    // The Cloud Function returns an enriched Chirp
    const enrichedChirp = result.data as Chirp;
    
    // Ensure dates are properly converted
    return {
      ...enrichedChirp,
      createdAt: enrichedChirp.createdAt instanceof Date 
        ? enrichedChirp.createdAt 
        : new Date(enrichedChirp.createdAt as any),
      valueScore: enrichedChirp.valueScore ? {
        ...enrichedChirp.valueScore,
        updatedAt: enrichedChirp.valueScore.updatedAt instanceof Date
          ? enrichedChirp.valueScore.updatedAt
          : new Date(enrichedChirp.valueScore.updatedAt as any),
      } : undefined,
      claims: enrichedChirp.claims?.map((c: any) => ({
        ...c,
        extractedAt: c.extractedAt instanceof Date ? c.extractedAt : new Date(c.extractedAt),
      })),
      factChecks: enrichedChirp.factChecks?.map((f: any) => ({
        ...f,
        checkedAt: f.checkedAt instanceof Date ? f.checkedAt : new Date(f.checkedAt),
      })),
    };
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
