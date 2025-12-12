import { chirpService } from '../firestore';
/**
 * AI-style decision helper.
 *
 * This does not call an external LLM. It combines:
 * - Weighted reviewer consensus (kurralScore-weighted)
 * - Existing fact-check verdicts (if any)
 *
 * Rules:
 * 1) If weighted validate >= 0.6 and confidence >= 0.2 → clean
 * 2) If weighted invalidate >= 0.6 and confidence >= 0.2 → blocked
 * 3) If fact-check verdicts strongly disagree with crowd (mixed/unknown):
 *    require confidence >= 0.7 to flip away from 'needs_review'
 * 4) Otherwise → needs_review
 */
export async function decideFinalStatus(chirpId, consensus) {
    try {
        const chirp = await chirpService.getChirp(chirpId);
        if (!chirp) {
            console.warn(`[AIDecision] Chirp ${chirpId} not found, returning needs_review`);
            return 'needs_review';
        }
        // Baseline ratios
        const validateRatio = consensus.totalWeight > 0 ? consensus.validateWeight / consensus.totalWeight : 0;
        const invalidateRatio = consensus.totalWeight > 0 ? consensus.invalidateWeight / consensus.totalWeight : 0;
        // Fact-check signals (optional)
        const factChecks = chirp.factChecks || [];
        const hasFalseHighConfidence = factChecks.some((fc) => fc.verdict === 'false' && (fc.confidence ?? 0) > 0.7);
        const hasMixed = factChecks.some((fc) => fc.verdict === 'mixed');
        const hasUnknown = factChecks.some((fc) => fc.verdict === 'unknown');
        // If the crowd clearly validates
        if (validateRatio >= 0.6 && consensus.confidence >= 0.2) {
            // But if fact checks are mixed/unknown, require stronger confidence
            if ((hasMixed || hasUnknown) && consensus.confidence < 0.7) {
                return 'needs_review';
            }
            // If fact checks had high-confidence false, override to blocked
            if (hasFalseHighConfidence) {
                return 'blocked';
            }
            return 'clean';
        }
        // If the crowd clearly invalidates
        if (invalidateRatio >= 0.6 && consensus.confidence >= 0.2) {
            // If fact checks were mixed/unknown, require stronger confidence
            if ((hasMixed || hasUnknown) && consensus.confidence < 0.7) {
                return 'needs_review';
            }
            return 'blocked';
        }
        // Not enough signal
        return 'needs_review';
    }
    catch (error) {
        console.error('[AIDecision] Error making final decision:', error);
        return 'needs_review'; // Safe default on error
    }
}
