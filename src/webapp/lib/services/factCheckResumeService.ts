import { chirpService } from '../firestore';
import { processChirpValue } from './valuePipelineService';
import { Chirp } from '../../types';

/**
 * Service to handle resuming interrupted fact-checking processes.
 * It finds chirps that are stuck in 'pending' or 'in_progress' state
 * and restarts the value pipeline for them.
 */

const STALE_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

export async function findChirpsNeedingFactCheck(authorId: string): Promise<Chirp[]> {
  return chirpService.getChirpsNeedingFactCheck(authorId);
}

export async function resumeFactChecking(chirp: Chirp): Promise<void> {
  console.log(`[FactCheckResume] Resuming fact checking for chirp ${chirp.id}`);
  
  // Check for stale lock
  if (chirp.factCheckingStartedAt) {
    const age = Date.now() - chirp.factCheckingStartedAt.getTime();
    if (age > STALE_THRESHOLD_MS) {
      console.log(`[FactCheckResume] Found stale lock for ${chirp.id} (${Math.round(age/60000)} mins old), restarting...`);
    }
  }

  // Re-run the pipeline. 
  // The pipeline is now idempotent and progressively saves, so it will pick up where it left off
  // or retry failed steps.
  try {
    await processChirpValue(chirp);
    console.log(`[FactCheckResume] Successfully completed fact checking for ${chirp.id}`);
  } catch (error) {
    console.error(`[FactCheckResume] Failed to resume fact checking for ${chirp.id}:`, error);
  }
}

