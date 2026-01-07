// Value pipeline service for mobile app
// Uses Firebase Cloud Functions (server-side processing)

import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';
import type { Chirp, Claim, FactCheck, ValueScore } from '../types';

// Helper to convert Firestore timestamps to Date objects
const toDate = (value: any): Date | undefined => {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  if (value.toDate && typeof value.toDate === 'function') return value.toDate();
  if (typeof value === 'number') return new Date(value);
  if (typeof value === 'string') return new Date(value);
  return undefined;
};

const normalizeClaims = (claims?: Claim[]): Claim[] | undefined =>
  claims?.map((claim) => ({
    ...claim,
    extractedAt: toDate((claim as any).extractedAt) || new Date(),
  }));

const normalizeFactChecks = (factChecks?: FactCheck[]): FactCheck[] | undefined =>
  factChecks?.map((factCheck) => ({
    ...factCheck,
    checkedAt: toDate((factCheck as any).checkedAt) || new Date(),
  }));

const normalizeValueScore = (valueScore?: ValueScore): ValueScore | undefined => {
  if (!valueScore) return undefined;
  return {
    ...valueScore,
    updatedAt: toDate((valueScore as any).updatedAt) || new Date(),
  };
};

const normalizeChirp = (chirp: Chirp): Chirp => ({
  ...chirp,
  createdAt: toDate((chirp as any).createdAt) || new Date(),
  analyzedAt: toDate((chirp as any).analyzedAt),
  scheduledAt: toDate((chirp as any).scheduledAt),
  factCheckingStartedAt: toDate((chirp as any).factCheckingStartedAt),
  claims: normalizeClaims((chirp as any).claims),
  factChecks: normalizeFactChecks((chirp as any).factChecks),
  valueScore: normalizeValueScore((chirp as any).valueScore),
});

// Pipeline result type (matches Cloud Function response)
export interface PipelineResult {
  success: boolean;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  claims: any[];
  factChecks: any[];
  factCheckStatus: 'clean' | 'needs_review' | 'blocked';
  valueScore?: ValueScore;
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
 * All processing happens server-side in Firebase Cloud Functions.
 */
export async function processChirpValue(
  chirp: Chirp,
  options?: { skipFactCheck?: boolean }
): Promise<Chirp> {
  try {
    const callable = httpsCallable(functions, 'processChirpValue');
    const result = await callable({ chirpId: chirp.id, chirp, options });
    
    // The Cloud Function returns an enriched Chirp
    return normalizeChirp(result.data as Chirp);
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
  comment: any
): Promise<{
  commentInsights?: Record<string, any>;
  updatedChirp?: Chirp;
}> {
  try {
    const callable = httpsCallable(functions, 'processCommentValue');
    const result = await callable({ commentId: comment.id, comment });
    const data = result.data as {
      commentInsights?: Record<string, any>;
      updatedChirp?: Chirp;
    };
    
    return {
      commentInsights: data.commentInsights,
      updatedChirp: data.updatedChirp ? normalizeChirp(data.updatedChirp) : undefined,
    };
  } catch (error: any) {
    console.error('[ValuePipeline] Failed to process comment value:', error);
    // Return empty object on error
    return {};
  }
}

/**
 * Process pending rechirps (no-op for mobile - handled by scheduled Cloud Function)
 */
export async function processPendingRechirps(limitCount: number = 50): Promise<void> {
  // No-op: rechirps are processed by scheduled Cloud Function
  console.log('[ValuePipeline] processPendingRechirps is handled by scheduled Cloud Function');
}
