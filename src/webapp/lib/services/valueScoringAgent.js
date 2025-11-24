import { BaseAgent } from '../agents/baseAgent';
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
const clamp01 = (value) => Math.max(0, Math.min(1, value));
const fallbackScore = (chirp, claims, factChecks, discussion) => {
    const claimStrength = claims.length > 0 ? Math.min(1, claims.length / 4) : 0.2;
    const factConfidence = factChecks.length > 0
        ? factChecks.reduce((sum, fc) => sum + (fc.verdict === 'true' ? 1 : fc.verdict === 'mixed' ? 0.5 : 0.2) * fc.confidence, 0) /
            factChecks.length
        : 0.4;
    const discussionScore = discussion
        ? (discussion.informativeness + discussion.reasoningDepth + discussion.crossPerspective + discussion.civility) / 4
        : 0.3;
    const textLengthScore = clamp01(chirp.text.length / 800);
    const vector = {
        epistemic: clamp01(factConfidence),
        insight: clamp01(claimStrength * 0.7 + textLengthScore * 0.5),
        practical: clamp01(textLengthScore * 0.6 + discussionScore * 0.4),
        relational: clamp01((discussion?.civility || 0.4) * 0.6 + (discussion?.crossPerspective || 0.3) * 0.4),
        effort: clamp01(textLengthScore * 0.7 + claims.length * 0.05),
    };
    const total = Object.values(vector).reduce((sum, value) => sum + value, 0) / 5;
    return {
        ...vector,
        total,
        confidence: clamp01((factConfidence + discussionScore) / 2),
        updatedAt: new Date(),
        drivers: [
            `Baseline heuristic scoring applied (${claims.length} claims, ${factChecks.length} fact checks).`,
            discussion ? `Discussion quality heuristic: ${discussion.summary}` : 'No discussion yet.',
        ],
    };
};
const buildSummary = (chirp, claims, factChecks, discussion, commentInsightsCount) => {
    const claimSummary = claims.length === 0
        ? 'No explicit extracted claims.'
        : `${claims.length} claims (${claims.filter((c) => c.riskLevel !== 'low').length} medium/high risk).`;
    const factSummary = factChecks.length === 0
        ? 'Fact checks pending.'
        : factChecks
            .map((fc) => `${fc.verdict} (${fc.confidence.toFixed(2)}) on claim ${fc.claimId}`)
            .slice(0, 5)
            .join('; ');
    const discussionSummary = discussion
        ? `Discussion quality -> inform:${discussion.informativeness.toFixed(2)}, civility:${discussion.civility.toFixed(2)}, reasoning:${discussion.reasoningDepth.toFixed(2)}, perspective:${discussion.crossPerspective.toFixed(2)}`
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
export async function scoreChirpValue(chirp, claims, factChecks, discussion) {
    if (!BaseAgent.isAvailable()) {
        return fallbackScore(chirp, claims, factChecks, discussion?.threadQuality);
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
        const response = await agent.generateJSON(prompt, 'Value scoring agent', VALUE_SCHEMA);
        const vector = {
            epistemic: clamp01(response.scores.epistemic),
            insight: clamp01(response.scores.insight),
            practical: clamp01(response.scores.practical),
            relational: clamp01(response.scores.relational),
            effort: clamp01(response.scores.effort),
        };
        const total = Object.values(vector).reduce((sum, value) => sum + value, 0) / 5;
        return {
            ...vector,
            total,
            confidence: clamp01(response.confidence),
            updatedAt: new Date(),
            drivers: response.drivers?.filter((driver) => driver.trim().length > 0),
        };
    }
    catch (error) {
        console.error('[ValueScoringAgent] Error scoring post:', error);
        return fallbackScore(chirp, claims, factChecks, discussion?.threadQuality);
    }
}
