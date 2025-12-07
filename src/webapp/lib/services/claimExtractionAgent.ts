import { BaseAgent } from '../agents/baseAgent';
import type { Chirp, Claim } from '../../types';

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

type ClaimExtractionResponse = {
  claims: Array<{
    id?: string;
    text: string;
    type: 'fact' | 'opinion' | 'experience';
    domain: Claim['domain'];
    riskLevel: Claim['riskLevel'];
    confidence: number;
    evidence?: Array<{
      source: string;
      url?: string;
      snippet: string;
      quality: number;
    }>;
  }>;
};

const ensureClaimId = (chirpId: string, candidateId: string | undefined, index: number): string => {
  const safeCandidate = candidateId?.trim();
  if (safeCandidate) {
    return `${chirpId}-${safeCandidate}`;
  }
  return `${chirpId}-claim-${index + 1}`;
};

const fallbackExtract = (chirp: Pick<Chirp, 'id' | 'text' | 'imageUrl'>): Claim[] => {
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
      type: 'fact' as const,
      domain: 'general' as const,
      riskLevel: 'medium' as const,
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

const toClaim = (chirpId: string, raw: ClaimExtractionResponse['claims'][number], index: number): Claim => ({
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

export async function extractClaimsForChirp(chirp: Chirp): Promise<Claim[]> {
  // Check if we have any content to analyze (text or image)
  const hasText = chirp.text?.trim() && chirp.text.trim().length > 0;
  const hasImage = chirp.imageUrl && chirp.imageUrl.trim().length > 0;

  // If no text and no image, return empty
  if (!hasText && !hasImage) {
    return [];
  }

  if (!BaseAgent.isAvailable()) {
    return fallbackExtract(chirp);
  }

  // Determine model based on whether image exists
  // Use vision model (gpt-4o) if image exists, otherwise use text-only (gpt-4o-mini)
  const modelName = hasImage ? 'gpt-4o' : 'gpt-4o-mini';
  const agent = new BaseAgent(modelName);

  // Build prompt
  let prompt = `Post ID: ${chirp.id}
Author: ${chirp.authorId}
Topic: ${chirp.topic}`;

  if (hasText) {
    prompt += `
Text:
"""
${chirp.text}
"""`;
  }

  if (hasImage) {
    if (hasText) {
      prompt += `
      
An image is attached to this post. Extract claims from BOTH the text above AND any text/claims visible in the image.`;
    } else {
      prompt += `
      
This post contains only an image. Read ALL text in the image (including any overlays, captions, memes, infographics, or embedded text) and extract all verifiable claims from it.`;
    }
    prompt += ` Analyze the image content carefully and extract any factual claims, statistics, quotes, or statements that can be verified.`;
  }

  prompt += `

Extract claims following the schema. Ignore emojis or filler text.`;

  try {
    let response: ClaimExtractionResponse;
    
    if (hasImage) {
      // Use vision API when image exists
      console.log('[ClaimExtractionAgent] Using vision model (gpt-4o) to extract claims with image');
      response = await agent.generateJSONWithVision<ClaimExtractionResponse>(
        prompt,
        chirp.imageUrl || null,
        SYSTEM_PROMPT,
        CLAIM_RESPONSE_SCHEMA
      );
    } else {
      // Use text-only API when no image
      console.log('[ClaimExtractionAgent] Using text-only model (gpt-4o-mini) to extract claims');
      response = await agent.generateJSON<ClaimExtractionResponse>(prompt, SYSTEM_PROMPT, CLAIM_RESPONSE_SCHEMA);
    }

    if (!response?.claims?.length) {
      console.warn('[ClaimExtractionAgent] No claims extracted, falling back to heuristic extraction');
      return fallbackExtract(chirp);
    }

    return response.claims
      .filter((claim) => typeof claim.text === 'string' && claim.text.trim().length > 0)
      .map((claim, index) => toClaim(chirp.id, claim, index));
  } catch (error) {
    console.error('[ClaimExtractionAgent] Error during claim extraction, falling back:', error);
    return fallbackExtract(chirp);
  }
}

