import { BaseAgent } from '../agents/baseAgent';
const SYSTEM_PROMPT = `You are a fact-focused claim extraction agent for a social platform.
Extract verifiable claims from the provided post. Split complex posts into atomic claims.

Rules:
- Keep each claim under 240 characters.
- Label each claim as fact, opinion, or experience.
- Detect the domain (health, finance, politics, technology, science, society, general).
- Assign risk level (low, medium, high) based on potential harm if incorrect.
- Estimate confidence 0-1 for how clear and verifiable the claim is.
- Provide any cited evidence snippets if mentioned (optional).
- If an image is provided, read ALL text in the image (including overlays, captions, memes, infographics).
- Extract claims from both the post text AND any text visible in the image.
- For images, also extract any statistical claims, quotes, or factual statements shown visually.`;
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
    // If no text and no image, return empty
    if (!chirp.text?.trim() && !chirp.imageUrl) {
        return [];
    }
    // If only image exists without text, we can't extract claims without vision model
    if (!chirp.text?.trim() && chirp.imageUrl) {
        // Return a placeholder claim indicating image needs analysis
        return [{
                id: `${chirp.id}-heuristic-image`,
                text: 'Image content requires analysis',
                type: 'fact',
                domain: 'general',
                riskLevel: 'medium',
                confidence: 0.2,
                extractedAt: new Date(),
            }];
    }
    // Fallback for text-only extraction
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
export async function extractClaimsForChirp(chirp, quotedChirp) {
    // Check if we have any content to analyze (text or image)
    const hasText = chirp.text?.trim() && chirp.text.trim().length > 0;
    const hasImage = chirp.imageUrl && chirp.imageUrl.trim().length > 0;
    const hasQuotedText = quotedChirp?.text?.trim() && quotedChirp.text.trim().length > 0;
    const hasQuotedImage = quotedChirp?.imageUrl && quotedChirp.imageUrl.trim().length > 0;
    // If no text, no image, and no quoted content, return empty
    if (!hasText && !hasImage && !hasQuotedText && !hasQuotedImage) {
        return [];
    }
    if (!BaseAgent.isAvailable()) {
        return fallbackExtract(chirp);
    }
    // Determine model based on whether image exists (check both user's image and quoted image)
    const hasAnyImage = hasImage || hasQuotedImage;
    const modelName = hasAnyImage ? 'gpt-4o' : 'gpt-4o-mini';
    const agent = new BaseAgent(modelName);
    // Build prompt
    let prompt = `Post ID: ${chirp.id}
Author: ${chirp.authorId}
Topic: ${chirp.topic}`;
    // Handle quoted posts: include both user's text and quoted post text
    if (quotedChirp && (hasQuotedText || hasQuotedImage)) {
        prompt += `

This is a QUOTED POST. Extract claims from BOTH the user's new text AND the original quoted post's text.

ORIGINAL QUOTED POST:
${hasQuotedText ? `"""${quotedChirp.text}"""` : '(image only)'}`;
        if (hasText) {
            prompt += `

USER'S NEW TEXT:
"""
${chirp.text}
"""`;
        }
    }
    else if (hasText) {
        prompt += `

Text:
"""
${chirp.text}
"""`;
    }
    if (hasImage) {
        if (hasText || hasQuotedText) {
            prompt += `
      
An image is attached to this post. Extract claims from BOTH the text above AND any text/claims visible in the image.`;
        }
        else {
            prompt += `
      
This post contains only an image. Read ALL text in the image (including any overlays, captions, memes, infographics, or embedded text) and extract all verifiable claims from it.`;
        }
        prompt += ` Analyze the image content carefully and extract any factual claims, statistics, quotes, or statements that can be verified.`;
    }
    if (hasQuotedImage && (!hasImage || (quotedChirp && quotedChirp.imageUrl !== chirp.imageUrl))) {
        prompt += `

The quoted post also contains an image. Extract claims from any text visible in that image as well.`;
    }
    prompt += `

Extract claims following the schema. Ignore emojis or filler text.`;
    try {
        let response;
        // Use vision API if any image exists (prioritize user's image, but mention quoted image if different)
        const imageUrlForVision = hasImage ? chirp.imageUrl : (hasQuotedImage ? quotedChirp?.imageUrl : null);
        if (hasAnyImage && imageUrlForVision) {
            // Use vision API when image exists
            console.log('[ClaimExtractionAgent] Using vision model (gpt-4o) to extract claims with image');
            response = await agent.generateJSONWithVision(prompt, imageUrlForVision || null, SYSTEM_PROMPT, CLAIM_RESPONSE_SCHEMA);
        }
        else {
            // Use text-only API when no image
            console.log('[ClaimExtractionAgent] Using text-only model (gpt-4o-mini) to extract claims');
            response = await agent.generateJSON(prompt, SYSTEM_PROMPT, CLAIM_RESPONSE_SCHEMA);
        }
        if (!response?.claims?.length) {
            console.warn('[ClaimExtractionAgent] No claims extracted, falling back to heuristic extraction');
            return fallbackExtract(chirp);
        }
        return response.claims
            .filter((claim) => typeof claim.text === 'string' && claim.text.trim().length > 0)
            .map((claim, index) => toClaim(chirp.id, claim, index));
    }
    catch (error) {
        console.error('[ClaimExtractionAgent] Error during claim extraction, falling back:', error);
        return fallbackExtract(chirp);
    }
}
/**
 * Extract claims from a comment/reply
 */
export async function extractClaimsForComment(comment) {
    // Check if we have any content to analyze (text or image)
    const hasText = comment.text?.trim() && comment.text.trim().length > 0;
    const hasImage = comment.imageUrl && comment.imageUrl.trim().length > 0;
    // If no text and no image, return empty
    if (!hasText && !hasImage) {
        return [];
    }
    if (!BaseAgent.isAvailable()) {
        // Fallback for comments - reuse fallback logic with comment structure
        const fallbackChirp = { id: comment.id, text: comment.text || '', imageUrl: comment.imageUrl };
        return fallbackExtract(fallbackChirp);
    }
    // Determine model based on whether image exists
    // Use vision model (gpt-4o) if image exists, otherwise use text-only (gpt-4o-mini)
    const modelName = hasImage ? 'gpt-4o' : 'gpt-4o-mini';
    const agent = new BaseAgent(modelName);
    // Build prompt
    let prompt = `Comment ID: ${comment.id}
Author: ${comment.authorId}
This is a comment/reply in a discussion thread.`;
    if (hasText) {
        prompt += `

Text:
"""
${comment.text}
"""`;
    }
    if (hasImage) {
        if (hasText) {
            prompt += `

An image is attached to this comment. Extract claims from BOTH the text above AND any text/claims visible in the image.`;
        }
        else {
            prompt += `

This comment contains only an image. Read ALL text in the image (including any overlays, captions, memes, infographics, or embedded text) and extract all verifiable claims from it.`;
        }
        prompt += ` Analyze the image content carefully and extract any factual claims, statistics, quotes, or statements that can be verified.`;
    }
    prompt += `

Extract claims following the schema. Ignore emojis or filler text.`;
    try {
        let response;
        if (hasImage) {
            // Use vision API when image exists
            console.log('[ClaimExtractionAgent] Using vision model (gpt-4o) to extract claims from comment with image');
            response = await agent.generateJSONWithVision(prompt, comment.imageUrl || null, SYSTEM_PROMPT, CLAIM_RESPONSE_SCHEMA);
        }
        else {
            // Use text-only API when no image
            console.log('[ClaimExtractionAgent] Using text-only model (gpt-4o-mini) to extract claims from comment');
            response = await agent.generateJSON(prompt, SYSTEM_PROMPT, CLAIM_RESPONSE_SCHEMA);
        }
        if (!response?.claims?.length) {
            console.warn('[ClaimExtractionAgent] No claims extracted from comment, falling back to heuristic extraction');
            const fallbackChirp = { id: comment.id, text: comment.text || '', imageUrl: comment.imageUrl };
            return fallbackExtract(fallbackChirp);
        }
        return response.claims
            .filter((claim) => typeof claim.text === 'string' && claim.text.trim().length > 0)
            .map((claim, index) => toClaim(comment.id, claim, index));
    }
    catch (error) {
        console.error('[ClaimExtractionAgent] Error during comment claim extraction, falling back:', error);
        const fallbackChirp = { id: comment.id, text: comment.text || '', imageUrl: comment.imageUrl };
        return fallbackExtract(fallbackChirp);
    }
}
