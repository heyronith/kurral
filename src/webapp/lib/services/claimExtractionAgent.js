import { BaseAgent } from '../agents/baseAgent';
const SYSTEM_PROMPT = `You are a fact-focused claim extraction agent for a social platform.
Extract verifiable claims from the provided post. Split complex posts into atomic claims.

Rules:
- Keep each claim under 240 characters.
- Label each claim as fact, opinion, or experience.
- Detect the domain (health, finance, politics, technology, science, society, general).
- Assign risk level (low, medium, high) based on potential harm if incorrect.
- Estimate confidence 0-1 for how clear and verifiable the claim is.
- Provide any cited evidence snippets if mentioned (optional).`;
const CLAIM_RESPONSE_SCHEMA = {
    type: 'object',
    properties: {
        claims: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    id: { type: 'string' },
                    text: { type: 'string' },
                    type: { type: 'string', enum: ['fact', 'opinion', 'experience'] },
                    domain: {
                        type: 'string',
                        enum: ['health', 'finance', 'politics', 'technology', 'science', 'society', 'general'],
                    },
                    riskLevel: { type: 'string', enum: ['low', 'medium', 'high'] },
                    confidence: { type: 'number' },
                    evidence: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                source: { type: 'string' },
                                url: { type: 'string' },
                                snippet: { type: 'string' },
                                quality: { type: 'number' },
                            },
                            required: ['source', 'snippet', 'quality'],
                        },
                    },
                },
                required: ['text', 'type', 'domain', 'riskLevel', 'confidence'],
            },
        },
    },
    required: ['claims'],
};
const ensureClaimId = (chirpId, candidateId, index) => {
    const safeCandidate = candidateId?.trim();
    if (safeCandidate) {
        return `${chirpId}-${safeCandidate}`;
    }
    return `${chirpId}-claim-${index + 1}`;
};
const fallbackExtract = (chirp) => {
    const sentences = chirp.text
        .split(/(?<=[.!?])\s+/)
        .map((sentence) => sentence.trim())
        .filter((sentence) => sentence.length >= 8);
    if (sentences.length === 0) {
        return [];
    }
    const now = new Date();
    return sentences.slice(0, 3).map((sentence, index) => ({
        id: `${chirp.id}-heuristic-${index + 1}`,
        text: sentence,
        type: sentence.includes('I ') || sentence.includes('my ') ? 'experience' : 'fact',
        domain: 'general',
        riskLevel: sentence.match(/health|medical|finance|money|investment|politic|election/i) ? 'medium' : 'low',
        confidence: 0.35,
        extractedAt: now,
    }));
};
const toClaim = (chirpId, raw, index) => ({
    id: ensureClaimId(chirpId, raw.id, index),
    text: raw.text.trim(),
    type: raw.type,
    domain: raw.domain || 'general',
    riskLevel: raw.riskLevel || 'low',
    confidence: Math.max(0, Math.min(1, Number(raw.confidence) || 0)),
    extractedAt: new Date(),
    evidence: raw.evidence?.map((item) => ({
        source: item.source,
        url: item.url,
        snippet: item.snippet,
        quality: Math.max(0, Math.min(1, Number(item.quality) || 0.5)),
    })),
});
export async function extractClaimsForChirp(chirp) {
    if (!chirp.text?.trim()) {
        return [];
    }
    if (!BaseAgent.isAvailable()) {
        return fallbackExtract(chirp);
    }
    const agent = new BaseAgent();
    const prompt = `Post ID: ${chirp.id}
Author: ${chirp.authorId}
Topic: ${chirp.topic}
Text:
"""
${chirp.text}
"""

Extract claims following the schema. Ignore emojis or filler text.`;
    try {
        const response = await agent.generateJSON(prompt, SYSTEM_PROMPT, CLAIM_RESPONSE_SCHEMA);
        if (!response?.claims?.length) {
            return fallbackExtract(chirp);
        }
        return response.claims
            .filter((claim) => typeof claim.text === 'string' && claim.text.trim().length > 0)
            .map((claim, index) => toClaim(chirp.id, claim, index));
    }
    catch (error) {
        console.error('[ClaimExtractionAgent] Falling back due to error:', error);
        return fallbackExtract(chirp);
    }
}
