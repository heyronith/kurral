import { BaseAgent } from '../agents/baseAgent';
import type { Chirp, Comment, Claim } from '../types';

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
- For images, also extract any statistical claims, quotes, or factual statements shown visually.
- NEVER return an empty claims list when input text (or image text) contains any statement.
- If uncertain, return a single claim that mirrors the input text with low confidence.
- If the content is a denial or controversy (e.g., "X is a scam"), still treat it as a claim.`;

const STRICT_SUFFIX =
  '\n\nIMPORTANT: Every claim must have a non-empty "text" field. Do not return empty strings.';

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
  if (!chirp.text?.trim() && !chirp.imageUrl) {
    return [];
  }

  if (!chirp.text?.trim() && chirp.imageUrl) {
    return [
      {
        id: `${chirp.id}-heuristic-image`,
        text: 'Image content requires analysis',
        type: 'fact',
        domain: 'general',
        riskLevel: 'medium',
        confidence: 0.2,
        extractedAt: new Date(),
      },
    ];
  }

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

const normalizeType = (value: string | undefined): Claim['type'] => {
  const t = (value || '').toLowerCase();
  if (t === 'fact' || t === 'opinion' || t === 'experience') return t;
  return 'fact';
};

const normalizeDomain = (value: string | undefined): Claim['domain'] => {
  const d = (value || '').toLowerCase();
  const allowed: Claim['domain'][] = [
    'health',
    'finance',
    'politics',
    'technology',
    'science',
    'society',
    'general',
  ];
  return allowed.includes(d as Claim['domain']) ? (d as Claim['domain']) : 'general';
};

const normalizeRisk = (value: string | undefined): Claim['riskLevel'] => {
  const r = (value || '').toLowerCase();
  if (r === 'low' || r === 'medium' || r === 'high') return r;
  return 'low';
};

const toClaim = (chirpId: string, raw: ClaimExtractionResponse['claims'][number], index: number): Claim => ({
  id: ensureClaimId(chirpId, raw.id, index),
  text: (raw.text || '').trim(),
  type: normalizeType(raw.type),
  domain: normalizeDomain(raw.domain),
  riskLevel: normalizeRisk(raw.riskLevel),
  confidence: Math.max(0, Math.min(1, Number(raw.confidence) || 0)),
  extractedAt: new Date(),
  evidence: Array.isArray(raw.evidence)
    ? raw.evidence
        .filter((item) => item && (item.source || item.snippet))
        .map((item) => ({
          source: item.source,
          url: item.url,
          snippet: item.snippet,
          quality: Math.max(0, Math.min(1, Number(item.quality) || 0.5)),
        }))
    : undefined,
});

export async function extractClaimsForChirp(chirp: Chirp, quotedChirp?: Chirp): Promise<Claim[]> {
  const hasText = chirp.text?.trim() && chirp.text.trim().length > 0;
  const hasImage = chirp.imageUrl && chirp.imageUrl.trim().length > 0;
  const hasQuotedText = quotedChirp?.text?.trim() && quotedChirp.text.trim().length > 0;
  const hasQuotedImage = quotedChirp?.imageUrl && quotedChirp.imageUrl.trim().length > 0;

  if (!hasText && !hasImage && !hasQuotedText && !hasQuotedImage) {
    return [];
  }

  if (!BaseAgent.isAvailable()) {
    return fallbackExtract(chirp);
  }

  const hasAnyImage = hasImage || hasQuotedImage;
  const modelName = hasAnyImage ? 'gpt-4o' : 'gpt-4o-mini';
  const agent = new BaseAgent(modelName);

  let prompt = `Post ID: ${chirp.id}
Author: ${chirp.authorId}
Topic: ${chirp.topic}`;

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
  } else if (hasText) {
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
    } else {
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

  const imageUrlForVision = hasImage ? chirp.imageUrl : hasQuotedImage ? quotedChirp?.imageUrl : null;

  const runExtraction = async (useStrictPrompt: boolean): Promise<Claim[]> => {
    let response: ClaimExtractionResponse;
    const systemPrompt = useStrictPrompt ? `${SYSTEM_PROMPT}${STRICT_SUFFIX}` : SYSTEM_PROMPT;
    const finalPrompt = useStrictPrompt ? `${prompt}${STRICT_SUFFIX}` : prompt;

    if (hasAnyImage && imageUrlForVision) {
      response = await agent.generateJSONWithVision<ClaimExtractionResponse>(
        finalPrompt,
        imageUrlForVision || null,
        systemPrompt,
        CLAIM_RESPONSE_SCHEMA
      );
    } else {
      response = await agent.generateJSON<ClaimExtractionResponse>(finalPrompt, systemPrompt, CLAIM_RESPONSE_SCHEMA);
    }

    if (!response?.claims?.length) {
      return [];
    }

    const rawClaims = response.claims || [];
    const claims = rawClaims
      .filter((claim) => typeof claim.text === 'string' && claim.text.trim().length > 0)
      .map((claim, index) => toClaim(chirp.id, claim, index));

    if (claims.length === 0) {
      console.warn('[ClaimExtraction] Agent returned only empty claims', {
        chirpId: chirp.id,
        rawCount: rawClaims.length,
        emptyTextCount: rawClaims.filter((claim) => !claim?.text || !String(claim.text).trim()).length,
      });
    }

    return claims;
  };

  try {
    let claims = await runExtraction(false);

    if (claims.length === 0) {
      console.warn('[ClaimExtraction] Retrying extraction with strict prompt', { chirpId: chirp.id });
      claims = await runExtraction(true);
    }

    if (claims.length === 0) {
      console.warn('[ClaimExtraction] No claims after retry, using fallback', {
        chirpId: chirp.id,
        hasText,
        hasImage,
        hasQuotedText,
        hasQuotedImage,
      });
      return fallbackExtract(chirp);
    }

    console.log('[ClaimExtraction] Extracted claims', {
      chirpId: chirp.id,
      count: claims.length,
      sample: claims[0]?.text?.slice(0, 120) || null,
    });

    return claims;
  } catch (error) {
    console.error('[ClaimExtraction] Agent error, using fallback', { chirpId: chirp.id, error });
    return fallbackExtract(chirp);
  }
}

export async function extractClaimsForComment(comment: Comment): Promise<Claim[]> {
  const hasText = comment.text?.trim() && comment.text.trim().length > 0;
  const hasImage = comment.imageUrl && comment.imageUrl.trim().length > 0;

  if (!hasText && !hasImage) {
    return [];
  }

  if (!BaseAgent.isAvailable()) {
    const fallbackChirp = { id: comment.id, text: comment.text || '', imageUrl: comment.imageUrl };
    return fallbackExtract(fallbackChirp);
  }

  const modelName = hasImage ? 'gpt-4o' : 'gpt-4o-mini';
  const agent = new BaseAgent(modelName);

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
    } else {
      prompt += `

This comment contains only an image. Read ALL text in the image (including any overlays, captions, memes, infographics, or embedded text) and extract all verifiable claims from it.`;
    }
    prompt += ` Analyze the image content carefully and extract any factual claims, statistics, quotes, or statements that can be verified.`;
  }

  prompt += `

Extract claims following the schema. Ignore emojis or filler text.`;

  const runExtraction = async (useStrictPrompt: boolean): Promise<Claim[]> => {
    let response: ClaimExtractionResponse;
    const systemPrompt = useStrictPrompt ? `${SYSTEM_PROMPT}${STRICT_SUFFIX}` : SYSTEM_PROMPT;
    const finalPrompt = useStrictPrompt ? `${prompt}${STRICT_SUFFIX}` : prompt;

    if (hasImage) {
      response = await agent.generateJSONWithVision<ClaimExtractionResponse>(
        finalPrompt,
        comment.imageUrl || null,
        systemPrompt,
        CLAIM_RESPONSE_SCHEMA
      );
    } else {
      response = await agent.generateJSON<ClaimExtractionResponse>(finalPrompt, systemPrompt, CLAIM_RESPONSE_SCHEMA);
    }

    if (!response?.claims?.length) {
      return [];
    }

    const rawClaims = response.claims || [];
    const claims = rawClaims
      .filter((claim) => typeof claim.text === 'string' && claim.text.trim().length > 0)
      .map((claim, index) => toClaim(comment.id, claim, index));

    if (claims.length === 0) {
      console.warn('[ClaimExtraction] Comment agent returned only empty claims', {
        commentId: comment.id,
        rawCount: rawClaims.length,
        emptyTextCount: rawClaims.filter((claim) => !claim?.text || !String(claim.text).trim()).length,
      });
    }

    return claims;
  };

  try {
    let claims = await runExtraction(false);
    if (claims.length === 0) {
      console.warn('[ClaimExtraction] Retrying comment extraction with strict prompt', { commentId: comment.id });
      claims = await runExtraction(true);
    }

    if (claims.length === 0) {
      const fallbackChirp = { id: comment.id, text: comment.text || '', imageUrl: comment.imageUrl };
      return fallbackExtract(fallbackChirp);
    }

    return claims;
  } catch (error) {
    const fallbackChirp = { id: comment.id, text: comment.text || '', imageUrl: comment.imageUrl };
    return fallbackExtract(fallbackChirp);
  }
}
