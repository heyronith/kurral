import { BaseAgent } from '../agents/baseAgent';
import type {
  Chirp,
  Claim,
  FactCheck,
  DiscussionQuality,
  ValueScore,
  ValueVector,
} from '../../types';
import type { DiscussionAnalysis } from './discussionQualityAgent';

const VALUE_SCHEMA = {
  type: 'object',
  properties: {
    scores: {
      type: 'object',
      properties: {
        epistemic: { type: 'number' },
        insight: { type: 'number' },
        practical: { type: 'number' },
        relational: { type: 'number' },
        effort: { type: 'number' },
      },
      required: ['epistemic', 'insight', 'practical', 'relational', 'effort'],
    },
    drivers: {
      type: 'array',
      items: { type: 'string' },
    },
    confidence: { type: 'number' },
  },
  required: ['scores', 'confidence'],
};

type ValueResponse = {
  scores: ValueVector;
  drivers?: string[];
  confidence: number;
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const getDimensionWeights = (chirp: Chirp, claims: Claim[]): Record<keyof ValueVector, number> => {
  const normalizedTopic = chirp.topic.toLowerCase();
  const dominantDomain =
    claims.find((claim) => claim.domain && claim.domain !== 'general')?.domain?.toLowerCase() || normalizedTopic;

  if (dominantDomain === 'health' || dominantDomain === 'politics') {
    return {
      epistemic: 0.35,
      insight: 0.25,
      practical: 0.2,
      relational: 0.1,
      effort: 0.1,
    };
  }

  if (dominantDomain === 'technology' || normalizedTopic === 'startups') {
    return {
      epistemic: 0.25,
      insight: 0.35,
      practical: 0.2,
      relational: 0.1,
      effort: 0.1,
    };
  }

  if (normalizedTopic === 'productivity' || normalizedTopic === 'design') {
    return {
      epistemic: 0.2,
      insight: 0.25,
      practical: 0.35,
      relational: 0.1,
      effort: 0.1,
    };
  }

  return {
    epistemic: 0.3,
    insight: 0.25,
    practical: 0.2,
    relational: 0.15,
    effort: 0.1,
  };
};

const buildSummary = (
  chirp: Chirp,
  claims: Claim[],
  factChecks: FactCheck[],
  discussion?: DiscussionQuality,
  commentInsightsCount?: number
): string => {
  const claimSummary =
    claims.length === 0
      ? 'No explicit extracted claims.'
      : `${claims.length} claims (${claims.filter((c) => c.riskLevel !== 'low').length} medium/high risk).`;
  const factSummary =
    factChecks.length === 0
      ? 'Fact checks pending.'
      : factChecks
          .map((fc) => `${fc.verdict} (${fc.confidence.toFixed(2)}) on claim ${fc.claimId}`)
          .slice(0, 5)
          .join('; ');
  const discussionSummary = discussion
    ? `Discussion quality -> inform:${discussion.informativeness.toFixed(2)}, civility:${discussion.civility.toFixed(
        2
      )}, reasoning:${discussion.reasoningDepth.toFixed(2)}, perspective:${discussion.crossPerspective.toFixed(2)}`
    : 'No discussion data yet.';
  const commentsSummary = commentInsightsCount
    ? `${commentInsightsCount} scored comments`
    : '0 scored comments';

  return [
    `Post text: """${chirp.text.slice(0, 700)}"""`,
    claimSummary,
    factSummary,
    discussionSummary,
    commentsSummary,
  ].join('\n');
};

export async function scoreChirpValue(
  chirp: Chirp,
  claims: Claim[],
  factChecks: FactCheck[],
  discussion: DiscussionAnalysis | undefined
): Promise<ValueScore | null> {
  if (!BaseAgent.isAvailable()) {
    console.warn('[ValueScoringAgent] BaseAgent not available, skipping value scoring');
    return null;
  }

  const agent = new BaseAgent();
  const prompt = `You are scoring post value for a social network.

Dimensions (0-1 each):
- Epistemic: factual rigor and correctness.
- Insight: novelty, synthesis, non-obvious perspective.
- Practical: actionable guidance or clear takeaways.
- Relational: healthy discourse, empathy, constructive tone.
- Effort: depth of work, sourcing, structure.

Input summary:
${buildSummary(chirp, claims, factChecks, discussion?.threadQuality, discussion ? Object.keys(discussion.commentInsights).length : 0)}

Instructions:
- Base scores on provided evidence only.
- Reward posts with true/high-confidence claims.
- Penalize misinformation (false verdicts or missing evidence).
- Practical value depends on concrete steps or useful tips.
- Relational value depends on civility and cross-perspective markers.
- Effort considers text length, number of claims, and clarity indicators.
- Return JSON matching schema.`;

  try {
    const response = await agent.generateJSON<ValueResponse>(prompt, 'Value scoring agent', VALUE_SCHEMA);
    const vector: ValueVector = {
      epistemic: clamp01(response.scores.epistemic),
      insight: clamp01(response.scores.insight),
      practical: clamp01(response.scores.practical),
      relational: clamp01(response.scores.relational),
      effort: clamp01(response.scores.effort),
    };

    const weights = getDimensionWeights(chirp, claims);
    const total =
      vector.epistemic * weights.epistemic +
      vector.insight * weights.insight +
      vector.practical * weights.practical +
      vector.relational * weights.relational +
      vector.effort * weights.effort;

    return {
      ...vector,
      total,
      confidence: clamp01(response.confidence),
      updatedAt: new Date(),
      drivers: response.drivers?.filter((driver) => driver.trim().length > 0),
    };
  } catch (error) {
    console.error('[ValueScoringAgent] Error scoring post:', error);
    throw error; // Re-throw to let pipeline handle retry logic
  }
}

