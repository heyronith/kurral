// Value pipeline service for mobile app
// TODO: This will be replaced with Firebase Cloud Functions implementation
// The previous Vercel serverless function approach has been removed

import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';
import type { Chirp, Claim, FactCheck, ValueScore } from '../types';

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

/**
 * Process chirp through value pipeline
 * TODO: Implement using Firebase Cloud Functions (callable function)
 * 
 * This function will call a Firebase Cloud Function to process the chirp
 * through the value pipeline (fact-checking, value scoring, etc.)
 */
export async function processChirpValue(
  chirp: Chirp,
  options?: { skipFactCheck?: boolean }
): Promise<Chirp> {
  const callable = httpsCallable(functions, 'processChirpValue');
  const result = await callable({ chirpId: chirp.id, chirp, options });
  return normalizeChirp(result.data as Chirp);
}
