// Value pipeline service for mobile app
// TODO: This will be replaced with Firebase Cloud Functions implementation
// The previous Vercel serverless function approach has been removed

import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';
import type { Chirp } from '../types';

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
  return result.data as Chirp;
}
