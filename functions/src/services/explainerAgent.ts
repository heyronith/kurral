import { BaseAgent } from '../agents/baseAgent';
import type { Chirp, Claim, FactCheck, ValueScore, DiscussionQuality } from '../types';

const EXPLANATION_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
  },
  required: ['summary'],
};

type ExplanationResponse = { summary: string };

const fallbackExplanation = (
  valueScore: ValueScore,
  claims: Claim[],
  factChecks: FactCheck[],
  discussion?: DiscussionQuality
): string => {
  const parts = [
    `Epistemic ${valueScore.epistemic.toFixed(2)} driven by ${factChecks.filter((f) => f.verdict === 'true').length} verified claims.`,
    `Insight ${valueScore.insight.toFixed(2)} from ${claims.length} extracted claims.`,
  ];

  if (discussion) {
    parts.push(`Discussion quality ${discussion.informativeness.toFixed(2)} with civility ${discussion.civility.toFixed(2)}.`);
  }

  return parts.join(' ');
};

export async function generateValueExplanation(
  chirp: Chirp,
  valueScore: ValueScore,
  claims: Claim[],
  factChecks: FactCheck[],
  discussion?: DiscussionQuality
): Promise<string> {
  if (!BaseAgent.isAvailable()) {
    return fallbackExplanation(valueScore, claims, factChecks, discussion);
  }

  const agent = new BaseAgent();
  const prompt = `You are writing a short explanation for why a social post received its value score.

Post text: """${chirp.text.slice(0, 700)}"""
Value vector: ${JSON.stringify({
    epistemic: valueScore.epistemic,
    insight: valueScore.insight,
    practical: valueScore.practical,
    relational: valueScore.relational,
    effort: valueScore.effort,
  })}
Total score: ${valueScore.total.toFixed(2)} (confidence ${valueScore.confidence.toFixed(2)})
Claims analyzed: ${claims.length}
Fact checks: ${factChecks.length ? factChecks.map((fc) => `${fc.claimId}:${fc.verdict}`).join(', ') : 'none'}
Discussion summary: ${discussion ? discussion.summary : 'No discussion yet'}

Instructions:
- Be concise (max 3 sentences).
- Reference the strongest positive driver first.
- Mention any concerns if verdicts were mixed/false.
- Avoid jargon; address the author directly.
- Return JSON with a single "summary" field.`;

  try {
    const response = await agent.generateJSON<ExplanationResponse>(prompt, 'Value explanation writer', EXPLANATION_SCHEMA);
    return response.summary.trim();
  } catch (error) {
    return fallbackExplanation(valueScore, claims, factChecks, discussion);
  }
}


