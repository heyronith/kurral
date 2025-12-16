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
/**
 * Sanitizes user input to prevent prompt injection attacks
 * Detects and neutralizes common injection patterns while preserving legitimate content
 */
const sanitizeForPrompt = (value) => {
    if (!value)
        return '';
    let sanitized = value;
    // Remove null bytes and control characters (except newlines and tabs for readability)
    sanitized = sanitized.replace(/\u0000/g, '');
    sanitized = sanitized.replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '');
    // Remove code fences and code blocks that could contain instructions
    sanitized = sanitized.replace(/```[\s\S]*?```/g, '[code block removed]');
    sanitized = sanitized.replace(/`[^`]+`/g, '[code removed]');
    // Remove special tokens used in LLM training
    sanitized = sanitized.replace(/<\|[^|]+\|>/g, '');
    sanitized = sanitized.replace(/\[INST\]/gi, '');
    sanitized = sanitized.replace(/\[\/INST\]/gi, '');
    sanitized = sanitized.replace(/<\|im_start\|>/gi, '');
    sanitized = sanitized.replace(/<\|im_end\|>/gi, '');
    // Detect and neutralize common prompt injection patterns
    // Pattern: Instructions to ignore previous/system prompts
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
    for (const pattern of ignorePatterns) {
        sanitized = sanitized.replace(pattern, '[instruction removed]');
    }
    // Pattern: Role-playing and persona hijacking attempts
    const rolePatterns = [
        /you\s+are\s+(now\s+)?(a|an)\s+[^\.]+(\.|,|;)/gi,
        /act\s+as\s+(if\s+you\s+are\s+)?(a|an)\s+[^\.]+(\.|,|;)/gi,
        /pretend\s+(to\s+be|that\s+you\s+are)\s+(a|an)\s+[^\.]+/gi,
        /role\s*:\s*[^\n]+/gi,
        /persona\s*:\s*[^\n]+/gi,
    ];
    for (const pattern of rolePatterns) {
        sanitized = sanitized.replace(pattern, '[role instruction removed]');
    }
    // Pattern: Output format manipulation
    const outputPatterns = [
        /output\s+(format|style|mode)\s*:\s*[^\n]+/gi,
        /respond\s+(in|as|with)\s+(the\s+following|this|json|xml|markdown|html)/gi,
        /use\s+(the\s+following|this)\s+(format|structure|template)/gi,
        /return\s+([^\.]+)\s+instead/gi,
    ];
    for (const pattern of outputPatterns) {
        sanitized = sanitized.replace(pattern, '[format instruction removed]');
    }
    // Pattern: Context confusion attacks (delimiters that could break context)
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
    for (const pattern of delimiterPatterns) {
        sanitized = sanitized.replace(pattern, '[delimiter removed]');
    }
    // Pattern: Direct instruction injections
    const directInstructionPatterns = [
        /(^|\n)\s*instruction\s*[:\-]\s*/gim,
        /(^|\n)\s*command\s*[:\-]\s*/gim,
        /(^|\n)\s*execute\s*[:\-]\s*/gim,
        /(^|\n)\s*do\s+this\s*[:\-]\s*/gim,
    ];
    for (const pattern of directInstructionPatterns) {
        sanitized = sanitized.replace(pattern, '$1[instruction header removed]: ');
    }
    // Limit length to prevent resource exhaustion attacks
    const MAX_LENGTH = 2000;
    if (sanitized.length > MAX_LENGTH) {
        sanitized = sanitized.slice(0, MAX_LENGTH) + ' [truncated]';
    }
    // Final cleanup: remove excessive whitespace introduced by replacements
    sanitized = sanitized.replace(/\s+/g, ' ');
    sanitized = sanitized.replace(/\n\s*\n\s*\n/g, '\n\n'); // Max 2 consecutive newlines
    return sanitized.trim();
};
const resolveDominantDomain = (chirp, claims) => {
    const normalizedTopic = chirp.topic?.toLowerCase?.() || 'general';
    const semanticTopics = chirp.semanticTopics?.map((t) => t.toLowerCase().trim()).filter(Boolean) || [];
    // Count domains, favoring non-general and higher-risk claims
    const domainCounts = new Map();
    for (const claim of claims) {
        const domain = claim.domain?.toLowerCase();
        if (!domain || domain === 'general')
            continue;
        const weight = claim.riskLevel === 'high' ? 2 : claim.riskLevel === 'medium' ? 1.5 : 1;
        domainCounts.set(domain, (domainCounts.get(domain) || 0) + weight);
    }
    const topDomain = [...domainCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || normalizedTopic;
    const isConsistentWithTopic = topDomain === normalizedTopic ||
        semanticTopics.some((topic) => topic.includes(topDomain) || topDomain.includes(topic));
    return isConsistentWithTopic ? topDomain : normalizedTopic;
};
const getDimensionWeights = (chirp, claims) => {
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
        `Post text: """${sanitizeForPrompt(chirp.text).slice(0, 700)}"""`,
        claimSummary,
        factSummary,
        discussionSummary,
        commentsSummary,
    ].join('\n');
};
const applyFactCheckPenalty = (vector, factChecks) => {
    if (!factChecks || factChecks.length === 0) {
        // If we have claims but no fact-checks, keep epistemic conservative
        return { ...vector, epistemic: Math.min(vector.epistemic, 0.35) };
    }
    const confidentFalseCount = factChecks.filter((check) => check.verdict === 'false' && check.confidence > 0.7).length;
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
const validateVector = (vector) => {
    const safe = (value) => (Number.isFinite(value) ? clamp01(value) : 0.5);
    return {
        epistemic: safe(vector.epistemic),
        insight: safe(vector.insight),
        practical: safe(vector.practical),
        relational: safe(vector.relational),
        effort: safe(vector.effort),
    };
};
export async function scoreChirpValue(chirp, claims, factChecks, discussion) {
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
        const response = await agent.generateJSON(prompt, 'Value scoring agent', VALUE_SCHEMA);
        // Initial clamp
        let vector = {
            epistemic: clamp01(response.scores.epistemic),
            insight: clamp01(response.scores.insight),
            practical: clamp01(response.scores.practical),
            relational: clamp01(response.scores.relational),
            effort: clamp01(response.scores.effort),
        };
        // Apply fact-check-aware penalties and validate
        vector = applyFactCheckPenalty(vector, factChecks);
        vector = validateVector(vector);
        const weights = getDimensionWeights(chirp, claims);
        const total = vector.epistemic * weights.epistemic +
            vector.insight * weights.insight +
            vector.practical * weights.practical +
            vector.relational * weights.relational +
            vector.effort * weights.effort;
        return {
            ...vector,
            total: clamp01(total),
            confidence: clamp01(response.confidence),
            updatedAt: new Date(),
            drivers: response.drivers?.filter((driver) => driver.trim().length > 0),
        };
    }
    catch (error) {
        console.error('[ValueScoringAgent] Error scoring post:', error);
        throw error; // Re-throw to let pipeline handle retry logic
    }
}
