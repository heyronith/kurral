import { BaseAgent } from '../agents/baseAgent';
import type { Chirp, Claim, FactCheck } from '../types';

const TRUSTED_DOMAINS = [
  'who.int',
  'cdc.gov',
  'nih.gov',
  'fda.gov',
  'worldbank.org',
  'imf.org',
  'reuters.com',
  'apnews.com',
  'nature.com',
  'science.org',
  'ft.com',
  'nytimes.com',
  'theguardian.com',
];

const BLOCKED_DOMAINS = ['facebook.com', 'reddit.com', 'tiktok.com', 'instagram.com', 'telegram.org'];

const FACT_CHECK_SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['true', 'false', 'mixed', 'unknown'] },
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
    caveats: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: ['verdict', 'confidence'],
};

type FactCheckResponse = {
  verdict: FactCheck['verdict'];
  confidence: number;
  evidence?: Array<{
    source: string;
    url?: string;
    snippet: string;
    quality: number;
  }>;
  caveats?: string[];
};

const getDomain = (url?: string): string | null => {
  if (!url) return null;
  try {
    const { hostname } = new URL(url);
    return hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
};

const scoreEvidence = (url?: string): number => {
  const domain = getDomain(url);
  if (!domain) {
    return 0.4;
  }
  if (BLOCKED_DOMAINS.includes(domain)) {
    return 0;
  }
  if (TRUSTED_DOMAINS.includes(domain)) {
    return 0.95;
  }
  if (domain.endsWith('.gov') || domain.endsWith('.edu')) {
    return 0.85;
  }
  if (domain.endsWith('.org')) {
    return 0.7;
  }
  return 0.5;
};

export const isTrustedDomain = (url?: string): boolean => {
  const domain = getDomain(url);
  if (!domain) {
    return false;
  }
  if (BLOCKED_DOMAINS.includes(domain)) {
    return false;
  }
  if (TRUSTED_DOMAINS.includes(domain)) {
    return true;
  }
  if (domain.endsWith('.gov') || domain.endsWith('.edu')) {
    return true;
  }
  return false;
};

const fallbackFactCheck = (claim: Claim): FactCheck => ({
  id: `${claim.id}-fallback`,
  claimId: claim.id,
  verdict: 'unknown',
  confidence: 0.25,
  evidence: [],
  caveats: ['Automatic fallback: unable to verify claim'],
  checkedAt: new Date(),
});

const buildFactCheckPrompt = (chirp: Chirp, claim: Claim): string => {
  const hasImage = chirp.imageUrl && chirp.imageUrl.trim().length > 0;
  const hasText = chirp.text?.trim() && chirp.text.trim().length > 0;

  let prompt = `You are a senior fact-checking analyst. Evaluate the following claim that appeared on a social platform.

Post Context:
- Post ID: ${chirp.id}
- Author ID: ${chirp.authorId}
- Topic: ${chirp.topic}`;

  if (hasText) {
    prompt += `
- Post text: """${chirp.text}"""`;
  }

  if (hasImage) {
    if (hasText) {
      prompt += `
- An image is attached to this post (image URL: ${chirp.imageUrl})`;
    } else {
      prompt += `
- This post contains only an image (image URL: ${chirp.imageUrl})`;
    }
    prompt += `. The claim may have been extracted from text visible in the image.`;
  }

  prompt += `

Claim to verify: "${claim.text}"

Instructions:
- Cite credible sources. Avoid speculation.
- If unsure, answer "unknown" and explain why.
- Return ONLY JSON matching the schema.`;

  return prompt;
};

const ensureEvidenceQuality = (
  evidence: FactCheckResponse['evidence'],
  isWebSearch: boolean = false
): FactCheck['evidence'] => {
  if (!evidence || evidence.length === 0) {
    return [];
  }

  return evidence
    .map((item) => ({
      source: item.source,
      url: item.url,
      snippet: item.snippet,
      quality: Math.max(0, Math.min(1, item.quality ?? scoreEvidence(item.url))),
    }))
    .filter((item) => {
      if (isWebSearch && (!item.url || item.url.trim().length === 0)) {
        return false;
      }
      return item.quality > 0.1;
    });
};

const sanitizeVerdict = (verdict: string): FactCheck['verdict'] => {
  if (verdict === 'true' || verdict === 'false' || verdict === 'mixed' || verdict === 'unknown') {
    return verdict;
  }
  return 'unknown';
};

const ENABLE_WEB_SEARCH = process.env.OPENAI_WEB_SEARCH === 'true';

const runFactCheck = async (chirp: Chirp, claim: Claim, agent: BaseAgent): Promise<FactCheck> => {
  const prompt = buildFactCheckPrompt(chirp, claim);
  const systemPrompt =
    'You are a rigorous fact-checking agent. Always cite credible sources. Avoid speculation. If unsure, answer "unknown" and explain why.';

  const response = await agent.generateJSON<FactCheckResponse>(prompt, systemPrompt, FACT_CHECK_SCHEMA);
  return {
    id: `${claim.id}-fact-check`,
    claimId: claim.id,
    verdict: sanitizeVerdict(response.verdict),
    confidence: Math.max(0, Math.min(1, Number(response.confidence) || 0.5)),
    evidence: ensureEvidenceQuality(response.evidence),
    caveats: response.caveats?.filter((caveat) => caveat.trim().length > 0),
    checkedAt: new Date(),
  };
};

const runFactCheckWithWebSearch = async (chirp: Chirp, claim: Claim): Promise<FactCheck> => {
  // Web search is disabled by default; fall back to normal fact-check.
  const agent = new BaseAgent();
  return runFactCheck(chirp, claim, agent);
};

export async function factCheckClaims(chirp: Chirp, claims: Claim[]): Promise<FactCheck[]> {
  if (!claims.length) {
    return [];
  }

  if (!BaseAgent.isAvailable()) {
    return claims.map(fallbackFactCheck);
  }

  if (ENABLE_WEB_SEARCH) {
    const results: FactCheck[] = [];
    for (const claim of claims) {
      try {
        const factCheck = await runFactCheckWithWebSearch(chirp, claim);
        results.push(factCheck);
      } catch (error) {
        results.push(fallbackFactCheck(claim));
      }
    }
    return results;
  }

  const agent = new BaseAgent();
  const results: FactCheck[] = [];

  for (const claim of claims) {
    try {
      const factCheck = await runFactCheck(chirp, claim, agent);
      results.push(factCheck);
    } catch (error) {
      results.push(fallbackFactCheck(claim));
    }
  }

  return results;
}


