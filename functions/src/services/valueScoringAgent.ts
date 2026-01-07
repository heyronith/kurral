import { BaseAgent } from '../agents/baseAgent';
import type {
  Chirp,
  Claim,
  FactCheck,
  DiscussionQuality,
  ValueScore,
  ValueVector,
} from '../types';
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

// ValueResponse type kept for reference but using 'any' for flexibility
// type ValueResponse = {
//   scores: ValueVector;
//   drivers?: string[];
//   confidence: number;
// };

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const sanitizeForPrompt = (value: string): string => {
  if (!value) return '';

  let sanitized = value;
  sanitized = sanitized.replace(/\u0000/g, '');
  sanitized = sanitized.replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '');
  sanitized = sanitized.replace(/```[\s\S]*?```/g, '[code block removed]');
  sanitized = sanitized.replace(/`[^`]+`/g, '[code removed]');
  sanitized = sanitized.replace(/<\|[^|]+\|>/g, '');
  sanitized = sanitized.replace(/\[INST\]/gi, '');
  sanitized = sanitized.replace(/\[\/INST\]/gi, '');
  sanitized = sanitized.replace(/<\|im_start\|>/gi, '');
  sanitized = sanitized.replace(/<\|im_end\|>/gi, '');

  const ignorePatterns = [
    /ignore\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|directions?|rules?)/gi,
    /disregard\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|directions?)/gi,
    /forget\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?)/gi,
    /override\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?)/gi,
    /system\s*:\s*ignore/gi,
    /you\s+are\s+now/gi,
    /from\s+now\s+on/gi,
    /new\s+instructions?\s*:/gi,
  ];
  ignorePatterns.forEach((pattern) => {
    sanitized = sanitized.replace(pattern, '[instruction removed]');
  });

  const rolePatterns = [
    /you\s+are\s+(now\s+)?(a|an)\s+[^\.]+(\.|,|;)/gi,
    /act\s+as\s+(if\s+you\s+are\s+)?(a|an)\s+[^\.]+(\.|,|;)/gi,
    /pretend\s+(to\s+be|that\s+you\s+are)\s+(a|an)\s+[^\.]+/gi,
    /role\s*:\s*[^\n]+/gi,
    /persona\s*:\s*[^\n]+/gi,
  ];
  rolePatterns.forEach((pattern) => {
    sanitized = sanitized.replace(pattern, '[role instruction removed]');
  });

  const outputPatterns = [
    /output\s+(format|style|mode)\s*:\s*[^\n]+/gi,
    /respond\s+(in|as|with)\s+(the\s+following|this|json|xml|markdown|html)/gi,
    /use\s+(the\s+following|this)\s+(format|structure|template)/gi,
    /return\s+([^\.]+)\s+instead/gi,
  ];
  outputPatterns.forEach((pattern) => {
    sanitized = sanitized.replace(pattern, '[format instruction removed]');
  });

  const delimiterPatterns = [
    /---+\s*new\s+(instruction|prompt|context|task)/gi,
    /===+\s*new\s+(instruction|prompt|context|task)/gi,
    /###+\s*new\s+(instruction|prompt|context|task)/gi,
    /<\|begin_of_text\|>/gi,
    /<\|end_of_text\|>/gi,
    /\[BEGIN\s+INSTRUCTION\]/gi,
    /\[END\s+INSTRUCTION\]/gi,
    /\[BEGIN\s+PROMPT\]/gi,
    /\[END\s+PROMPT\]/gi,
  ];
  delimiterPatterns.forEach((pattern) => {
    sanitized = sanitized.replace(pattern, '[delimiter removed]');
  });

  const directInstructionPatterns = [
    /(^|\n)\s*instruction\s*[:\-]\s*/gim,
    /(^|\n)\s*command\s*[:\-]\s*/gim,
    /(^|\n)\s*execute\s*[:\-]\s*/gim,
    /(^|\n)\s*do\s+this\s*[:\-]\s*/gim,
  ];
  directInstructionPatterns.forEach((pattern) => {
    sanitized = sanitized.replace(pattern, '$1[instruction header removed]: ');
  });

  const MAX_LENGTH = 2000;
  if (sanitized.length > MAX_LENGTH) {
    sanitized = sanitized.slice(0, MAX_LENGTH) + ' [truncated]';
  }

  sanitized = sanitized.replace(/\s+/g, ' ');
  sanitized = sanitized.replace(/\n\s*\n\s*\n/g, '\n\n');

  return sanitized.trim();
};

const resolveDominantDomain = (chirp: Chirp, claims: Claim[]): string => {
  const normalizedTopic = chirp.topic?.toLowerCase?.() || 'general';
  const semanticTopics = chirp.semanticTopics?.map((t) => t.toLowerCase().trim()).filter(Boolean) || [];

  const domainCounts = new Map<string, number>();
  for (const claim of claims) {
    const domain = claim.domain?.toLowerCase();
    if (!domain || domain === 'general') continue;
    const weight = claim.riskLevel === 'high' ? 2 : claim.riskLevel === 'medium' ? 1.5 : 1;
    domainCounts.set(domain, (domainCounts.get(domain) || 0) + weight);
  }

  const topDomain = [...domainCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || normalizedTopic;
  const isConsistentWithTopic =
    topDomain === normalizedTopic ||
    semanticTopics.some((topic) => topic.includes(topDomain) || topDomain.includes(topic));

  return isConsistentWithTopic ? topDomain : normalizedTopic;
};

const getDimensionWeights = (chirp: Chirp, claims: Claim[]): Record<keyof ValueVector, number> => {
  const dominantDomain = resolveDominantDomain(chirp, claims);

  if (dominantDomain === 'health' || dominantDomain === 'politics') {
    return {
      epistemic: 0.35,
      insight: 0.25,
      practical: 0.2,
      relational: 0.1,
      effort: 0.1,
    };
  }

  if (dominantDomain === 'technology' || dominantDomain === 'startups' || dominantDomain === 'ai') {
    return {
      epistemic: 0.25,
      insight: 0.35,
      practical: 0.2,
      relational: 0.1,
      effort: 0.1,
    };
  }

  if (dominantDomain === 'productivity' || dominantDomain === 'design') {
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
  const commentsSummary = commentInsightsCount ? `${commentInsightsCount} scored comments` : '0 scored comments';

  return [
    `Post text: """${sanitizeForPrompt(chirp.text).slice(0, 700)}"""`,
    claimSummary,
    factSummary,
    discussionSummary,
    commentsSummary,
  ].join('\n');
};

const applyFactCheckPenalty = (vector: ValueVector, factChecks: FactCheck[]): ValueVector => {
  if (!factChecks || factChecks.length === 0) {
    return { ...vector, epistemic: Math.min(vector.epistemic, 0.35) };
  }

  const confidentFalseCount = factChecks.filter(
    (check) => check.verdict === 'false' && check.confidence > 0.7
  ).length;
  if (confidentFalseCount === 0) {
    return vector;
  }

  const penalty = Math.min(0.8, confidentFalseCount * 0.25);
  const penalizedEpistemic = clamp01(vector.epistemic * (1 - penalty));
  const cappedInsight = clamp01(vector.insight * (1 - penalty * 0.3));

  return {
    ...vector,
    epistemic: penalizedEpistemic,
    insight: cappedInsight,
  };
};

const validateVector = (vector: ValueVector): ValueVector => {
  const safe = (value: number): number => (Number.isFinite(value) ? clamp01(value) : 0.5);
  return {
    epistemic: safe(vector.epistemic),
    insight: safe(vector.insight),
    practical: safe(vector.practical),
    relational: safe(vector.relational),
    effort: safe(vector.effort),
  };
};

export async function scoreChirpValue(
  chirp: Chirp,
  claims: Claim[],
  factChecks: FactCheck[],
  discussion: DiscussionAnalysis | undefined
): Promise<ValueScore | null> {
  if (!BaseAgent.isAvailable()) {
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

  const response = await agent.generateJSON<any>(prompt, 'Value scoring agent', VALUE_SCHEMA);

  if (!response) {
    console.error('[ValueScoringAgent] No response received');
    return null;
  }

  // Handle multiple response formats:
  // 1. Nested: { scores: { epistemic: ..., ... }, confidence: ... }
  // 2. Flat lowercase: { epistemic: ..., insight: ..., ... }
  // 3. Flat capitalized: { Epistemic: ..., Insight: ..., ... }
  let scores: ValueVector;
  if (response.scores) {
    // Expected format: { scores: { epistemic: ..., ... }, confidence: ... }
    scores = response.scores;
  } else if (
    typeof response.epistemic === 'number' &&
    typeof response.insight === 'number' &&
    typeof response.practical === 'number' &&
    typeof response.relational === 'number' &&
    typeof response.effort === 'number'
  ) {
    // Flat format (lowercase): { epistemic: ..., insight: ..., ... }
    console.warn('[ValueScoringAgent] Received flat response format (lowercase), expected nested format');
    scores = {
      epistemic: response.epistemic,
      insight: response.insight,
      practical: response.practical,
      relational: response.relational,
      effort: response.effort,
    };
  } else if (
    typeof response.Epistemic === 'number' &&
    typeof response.Insight === 'number' &&
    typeof response.Practical === 'number' &&
    typeof response.Relational === 'number' &&
    typeof response.Effort === 'number'
  ) {
    // Flat format (capitalized): { Epistemic: ..., Insight: ..., ... }
    console.warn('[ValueScoringAgent] Received flat response format (capitalized), expected nested format');
    scores = {
      epistemic: response.Epistemic,
      insight: response.Insight,
      practical: response.Practical,
      relational: response.Relational,
      effort: response.Effort,
    };
  } else {
    console.error('[ValueScoringAgent] Invalid response structure:', response);
    return null;
  }

  let vector: ValueVector = {
    epistemic: clamp01(scores.epistemic),
    insight: clamp01(scores.insight),
    practical: clamp01(scores.practical),
    relational: clamp01(scores.relational),
    effort: clamp01(scores.effort),
  };

  vector = applyFactCheckPenalty(vector, factChecks);
  vector = validateVector(vector);

  const weights = getDimensionWeights(chirp, claims);
  const total =
    vector.epistemic * weights.epistemic +
    vector.insight * weights.insight +
    vector.practical * weights.practical +
    vector.relational * weights.relational +
    vector.effort * weights.effort;

  return {
    ...vector,
    total: clamp01(total),
    confidence: clamp01(response.confidence || 0.7),
    updatedAt: new Date(),
    drivers: response.drivers?.filter((driver: string) => driver.trim().length > 0),
  };
}


