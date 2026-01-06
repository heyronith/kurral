// Re-export algorithm from shared with mobile types
// Import shared algorithm (which uses webapp types - compatible with mobile)
import {
  generateForYouFeed as sharedGenerateForYouFeed,
  scoreChirpForViewer as sharedScoreChirpForViewer,
  isChirpEligibleForViewer as sharedIsChirpEligibleForViewer,
  type ChirpScore as SharedChirpScore,
} from '../../../shared/lib/algorithm';

// Import mobile types
import type { Chirp, User, ForYouConfig } from '../types';

// Re-export with mobile types
export type ChirpScore = SharedChirpScore;

export const generateForYouFeed = sharedGenerateForYouFeed as (
  allChirps: Chirp[],
  viewer: User,
  config: ForYouConfig,
  getAuthor: (userId: string) => User | undefined,
  limit?: number
) => ChirpScore[];

export const scoreChirpForViewer = sharedScoreChirpForViewer as (
  chirp: Chirp,
  viewer: User,
  config: ForYouConfig,
  allChirps: Chirp[],
  getAuthor: (userId: string) => User | undefined
) => ChirpScore;

export const isChirpEligibleForViewer = sharedIsChirpEligibleForViewer as (
  chirp: Chirp,
  viewer: User,
  config: ForYouConfig,
  options?: { ignoreMuted?: boolean }
) => boolean;
