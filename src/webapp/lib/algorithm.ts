// Re-export algorithm from shared
// This wrapper ensures webapp uses the shared algorithm implementation
export {
  generateForYouFeed,
  scoreChirpForViewer,
  isChirpEligibleForViewer,
  type ChirpScore,
} from '../../../shared/lib/algorithm';
