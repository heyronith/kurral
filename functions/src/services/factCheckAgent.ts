import OpenAI from 'openai';
import { BaseAgent, isAuthenticationError } from '../agents/baseAgent';
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
- Use web search results to make a definitive verdict (true/false/mixed/unknown).
- Cite specific credible sources with URLs from web search.
- Provide high confidence (0.7+) when sources clearly support or contradict the claim.
- Only use "unknown" with low confidence (0.3-0.5) if no relevant information is found.
- Return ONLY JSON matching the schema with verdict, confidence, evidence (including URLs), and caveats.`;

  return prompt;
};

// Helper to extract URL from markdown link or plain text
const extractUrlFromText = (text: string): string | undefined => {
  if (!text) return undefined;
  
  // Try markdown link format: [text](url)
  const markdownLinkMatch = text.match(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/);
  if (markdownLinkMatch) {
    return markdownLinkMatch[2];
  }
  
  // Try plain URL
  const urlMatch = text.match(/(https?:\/\/[^\s\)\]]+)/);
  if (urlMatch) {
    return urlMatch[1];
  }
  
  return undefined;
};

const ensureEvidenceQuality = (
  evidence: FactCheckResponse['evidence'],
  isWebSearch: boolean = false
): FactCheck['evidence'] => {
  if (!evidence) {
    return [];
  }
  
  // Ensure evidence is an array
  if (!evidence) {
    return [];
  }
  
  const evidenceArray = Array.isArray(evidence) ? evidence : [];
  
  if (evidenceArray.length === 0) {
    return [];
  }

  try {
    return evidenceArray
      .map((item: any) => {
        // Handle case where item might be a string (from AI response)
        if (typeof item === 'string') {
          const url = extractUrlFromText(item);
          return {
            source: 'Web Search',
            url: url || '',
            snippet: item,
            quality: url ? scoreEvidence(url) : 0.5,
          };
        }
        
        // Handle case where item is an object but url might be in snippet
        if (typeof item === 'object' && item !== null) {
          const url = item.url || extractUrlFromText(item.snippet || item.description || '');
          
          return {
            source: item.source || 'Web Search',
            url: url || '',
            snippet: item.snippet || item.description || item.source || '',
            quality: Math.max(0, Math.min(1, item.quality ?? (url ? scoreEvidence(url) : 0.5))),
          };
        }
        
        // Fallback for unexpected types
        return null;
      })
      .filter((item: any): item is NonNullable<typeof item> => {
        if (!item) return false;
        if (isWebSearch && (!item.url || item.url.trim().length === 0)) {
          return false;
        }
        return item.quality > 0.1;
      });
  } catch (error) {
    console.error('[FactCheckAgent] Error processing evidence:', error, { evidence, evidenceType: typeof evidence });
    return [];
  }
};

const sanitizeVerdict = (verdict: string): FactCheck['verdict'] => {
  if (verdict === 'true' || verdict === 'false' || verdict === 'mixed' || verdict === 'unknown') {
    return verdict;
  }
  return 'unknown';
};

const ENABLE_WEB_SEARCH = process.env.OPENAI_WEB_SEARCH !== 'false';
const WEB_SEARCH_MODEL = process.env.OPENAI_WEB_SEARCH_MODEL || 'gpt-4o';

let cachedClient: OpenAI | null = null;
const getOpenAIClient = (): OpenAI => {
  if (!cachedClient) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured for Cloud Functions');
    }
    cachedClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return cachedClient;
};

const parseJsonFromResponse = (response: any): FactCheckResponse | null => {
  // First try output_text (most common)
  if (response?.output_text && typeof response.output_text === 'string') {
    const jsonMatch = response.output_text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch {
        return null;
      }
    }
  }

  // Check output blocks for text content
  if (response?.output && Array.isArray(response.output)) {
    for (const outputBlock of response.output) {
      // Check for text in nested content
      if (outputBlock?.content && Array.isArray(outputBlock.content)) {
        for (const contentBlock of outputBlock.content) {
          if (contentBlock?.type === 'text' && contentBlock?.text) {
            const jsonMatch = contentBlock.text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              try {
                return JSON.parse(jsonMatch[0]);
              } catch {
                return null;
              }
            }
          }
        }
      }
      
      // Check if output block itself has text (for web_search_call results)
      if (outputBlock?.type === 'text' && outputBlock?.text) {
        const jsonMatch = outputBlock.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            return JSON.parse(jsonMatch[0]);
          } catch {
            return null;
          }
        }
      }
    }
  }

  return null;
};

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

const logWebSearchSummary = (response: any, chirpId: string, claimId: string) => {
  const summary = {
    chirpId,
    claimId,
    hasOutputText: Boolean(response?.output_text),
    outputLength: response?.output?.length || 0,
    hasWebSearch: false,
    citationCount: 0,
    contentTypes: [] as string[],
    webSearchCalls: 0,
  };

  if (response?.output && Array.isArray(response.output)) {
    for (const outputBlock of response.output) {
      // Check top-level type (web_search_call is at output block level, not in content)
      const blockType = outputBlock?.type;
      if (blockType) {
        summary.contentTypes.push(blockType);
      }
      
      if (blockType === 'web_search_call' || blockType === 'web_search') {
        summary.hasWebSearch = true;
        summary.webSearchCalls += 1;
        
        // Check for results, citations, or URLs in the web search call
        const hasResults = outputBlock?.results || outputBlock?.results_url || outputBlock?.result;
        if (hasResults) {
          summary.citationCount += 1;
        }
        
        // Check if results is an array with items (multiple citations)
        if (Array.isArray(outputBlock?.results)) {
          summary.citationCount = outputBlock.results.length;
        }
        
        // Check for citations in the action or result fields
        if (outputBlock?.action?.results || outputBlock?.action?.citations) {
          const citations = outputBlock.action.citations || outputBlock.action.results;
          if (Array.isArray(citations)) {
            summary.citationCount += citations.length;
          } else if (citations) {
            summary.citationCount += 1;
          }
        }
      }
      
      // Check for message blocks that might contain citations
      if (blockType === 'message' && outputBlock?.content) {
        const content = Array.isArray(outputBlock.content) ? outputBlock.content : [outputBlock.content];
        for (const contentItem of content) {
          if (contentItem?.type === 'citation' || contentItem?.type === 'citations') {
            summary.citationCount += 1;
          }
          // Check text content for URLs or citation markers
          if (contentItem?.text && typeof contentItem.text === 'string') {
            const urlMatches = contentItem.text.match(/https?:\/\/[^\s\)]+/g);
            if (urlMatches) {
              summary.citationCount += urlMatches.length;
            }
            if (contentItem.text.includes('[citation') || contentItem.text.includes('(citation')) {
              summary.citationCount += 1;
            }
          }
        }
      }
      
      // Also check nested content (for other response formats)
      if (outputBlock?.content && Array.isArray(outputBlock.content)) {
        for (const contentBlock of outputBlock.content) {
          const contentType = contentBlock?.type;
          if (contentType) {
            summary.contentTypes.push(contentType);
          }
          if (contentType === 'web_search' || contentType === 'web_search_preview' || contentType === 'web_search_call') {
            summary.hasWebSearch = true;
          }
          if (contentType === 'citation') {
            summary.citationCount += 1;
          }
        }
      }
    }
  }

  // Also check output_text for citations/URLs
  if (response?.output_text && typeof response.output_text === 'string') {
    const urlMatches = response.output_text.match(/https?:\/\/[^\s\)]+/g);
    if (urlMatches) {
      summary.citationCount += urlMatches.length;
    }
    // Check for citation markers like [citation:1] or (citation:1)
    const citationMarkers = response.output_text.match(/\[citation[^\]]*\]|\(citation[^\)]*\)/gi);
    if (citationMarkers) {
      summary.citationCount += citationMarkers.length;
    }
  }

  console.log('[FactCheckAgent] Web search response summary', summary);
  
  // Log web search call details if found
  if (summary.hasWebSearch && summary.webSearchCalls > 0) {
    const webSearchBlocks = response?.output?.filter((block: any) => 
      block?.type === 'web_search_call' || block?.type === 'web_search'
    ) || [];
    if (webSearchBlocks.length > 0) {
      console.log('[FactCheckAgent] Web search call details:', {
        count: webSearchBlocks.length,
        firstBlock: {
          type: webSearchBlocks[0]?.type,
          status: webSearchBlocks[0]?.status,
          hasResults: !!(webSearchBlocks[0]?.results || webSearchBlocks[0]?.results_url || webSearchBlocks[0]?.result),
          hasAction: !!webSearchBlocks[0]?.action,
          actionType: webSearchBlocks[0]?.action?.type,
        },
      });
    }
  }
  
  // Log full response structure if web search not found
  if (!summary.hasWebSearch && summary.outputLength > 0) {
    console.log('[FactCheckAgent] Response structure (web search not found):', JSON.stringify(response, null, 2).substring(0, 1000));
  }
};

const runFactCheckWithWebSearch = async (chirp: Chirp, claim: Claim): Promise<FactCheck> => {
  const client = getOpenAIClient();
  const systemPrompt =
    'You are a rigorous fact-checking agent that uses web search to verify claims. ' +
    'You MUST use the web_search tool to find current, credible sources. ' +
    'Based on the web search results, make a definitive verdict: ' +
    '- "true" if the claim is supported by credible sources (confidence 0.7+) ' +
    '- "false" if the claim is contradicted by credible sources (confidence 0.7+) ' +
    '- "mixed" if sources conflict or partially support (confidence 0.6+) ' +
    '- "unknown" ONLY if web search finds no relevant information (confidence 0.3-0.5) ' +
    'Always cite specific sources with URLs from web search results. ' +
    'Provide high confidence (0.7-0.95) when sources are clear and credible. ' +
    'Return ONLY JSON matching the schema with verdict, confidence, evidence (with URLs), and caveats.';
  const userPrompt = buildFactCheckPrompt(chirp, claim);

  try {
    // Try web_search first (what web app uses), then fallback to web_search_preview
    // OpenAI may have changed the tool name
    const toolTypes = ['web_search', 'web_search_preview'] as const;
    let response: any = null;
    let lastError: Error | null = null;
    
    for (const toolType of toolTypes) {
      try {
        console.log(`[FactCheckAgent] Attempting web search with tool type: ${toolType}`);
        
        // Use instructions for system prompt, input for user prompt only
        // The Responses API uses 'instructions' for system messages, not 'input'
        response = await client.responses.create({
          model: WEB_SEARCH_MODEL,
          instructions: systemPrompt,
          input: userPrompt, // Only the claim/prompt, not the system instructions
          tools: [{ type: toolType as any }],
          tool_choice: { type: toolType as any },
        });
        
        // Check if this tool type worked - look for web_search_call at top level
        const responseAny = response as any;
        const hasWebSearch = responseAny?.output?.some((block: any) => {
          // Check top-level type (web_search_call is at output block level)
          if (block?.type === 'web_search_call' || block?.type === 'web_search') {
            return true;
          }
          // Also check nested content (for other response formats)
          if (block?.content && Array.isArray(block.content)) {
            return block.content.some((content: any) => 
              content?.type === 'web_search' || 
              content?.type === 'web_search_preview' ||
              content?.type === 'web_search_call' ||
              content?.type === 'citation'
            );
          }
          return false;
        });
        
        if (hasWebSearch) {
          console.log(`[FactCheckAgent] Web search succeeded with tool type: ${toolType}`);
          break; // Success, use this response
        } else {
          console.warn(`[FactCheckAgent] Tool type ${toolType} returned response but no web search detected, trying next...`);
          if (toolType === toolTypes[toolTypes.length - 1]) {
            // Last tool type, keep this response even if no web search
            break;
          }
        }
      } catch (error: any) {
        console.warn(`[FactCheckAgent] Tool type ${toolType} failed:`, error.message);
        lastError = error;
        // Continue to next tool type
      }
    }
    
    if (!response) {
      throw lastError || new Error('All web search tool types failed');
    }

    // Enhanced logging to debug response structure
    const responseAny = response as any;
    console.log('[FactCheckAgent] Full web search response structure:', {
      hasOutput: !!responseAny?.output,
      outputType: Array.isArray(responseAny?.output) ? 'array' : typeof responseAny?.output,
      outputLength: responseAny?.output?.length || 0,
      outputText: !!responseAny?.output_text,
      outputTextLength: responseAny?.output_text?.length || 0,
      firstOutputBlock: responseAny?.output?.[0] ? {
        hasContent: !!(responseAny.output[0] as any).content,
        contentType: Array.isArray((responseAny.output[0] as any).content) ? 'array' : typeof (responseAny.output[0] as any).content,
        contentLength: (responseAny.output[0] as any).content?.length || 0,
        firstContentType: (responseAny.output[0] as any).content?.[0]?.type,
      } : null,
    });

    logWebSearchSummary(response, chirp.id, claim.id);

    // Check if web search actually happened - check for web_search_call at top level
    const hasWebSearch = responseAny?.output?.some((block: any) => {
      // Check top-level type (web_search_call is at output block level)
      if (block?.type === 'web_search_call' || block?.type === 'web_search') {
        return true;
      }
      // Also check nested content (for other response formats)
      if (block?.content && Array.isArray(block.content)) {
        return block.content.some((content: any) => 
          content?.type === 'web_search' || 
          content?.type === 'web_search_preview' ||
          content?.type === 'web_search_call' ||
          content?.type === 'citation' ||
          (content?.text && typeof content.text === 'string' && content.text.includes('http'))
        );
      }
      return false;
    });

    if (!hasWebSearch) {
      console.warn(
        `[FactCheckAgent] Web search was requested but not detected in response for claim ${claim.id}. ` +
        `Response structure may have changed. Checking output_text for fact-check result...`
      );
      // Don't throw - try to parse the response anyway, it might have the fact-check in output_text
    } else {
      console.log(`[FactCheckAgent] ✅ Web search detected in response for claim ${claim.id}`);
    }

    // Log the output_text to see what the AI actually received
    if (responseAny?.output_text) {
      console.log(`[FactCheckAgent] Output text preview (first 500 chars):`, responseAny.output_text.substring(0, 500));
    }
    
    const factCheckResponse = parseJsonFromResponse(response);
    if (!factCheckResponse) {
      throw new Error('Failed to extract JSON fact-check from web search response');
    }
    
    // Log the parsed response to see what verdict the AI chose
    const rawEvidence = factCheckResponse.evidence;
    const evidenceIsArray = Array.isArray(rawEvidence);
    const firstEvidenceItem = evidenceIsArray && rawEvidence.length > 0 ? rawEvidence[0] : null;
    const evidenceSample = firstEvidenceItem && typeof firstEvidenceItem === 'string' 
      ? (firstEvidenceItem as string).substring(0, 100) 
      : firstEvidenceItem;
    
    console.log(`[FactCheckAgent] Parsed fact-check response:`, {
      verdict: factCheckResponse.verdict,
      confidence: factCheckResponse.confidence,
      evidenceType: evidenceIsArray ? 'array' : typeof rawEvidence,
      evidenceCount: evidenceIsArray ? rawEvidence.length : 0,
      hasEvidenceUrls: evidenceIsArray && rawEvidence.length > 0 ? 
        rawEvidence.some((e: any) => e && (typeof e === 'string' || (typeof e === 'object' && e.url))) : false,
      evidenceSample: evidenceSample,
    });

    // Extract citations from web search results if evidence doesn't have URLs
    let evidence = ensureEvidenceQuality(factCheckResponse.evidence, true);
    
    // Ensure evidence is always an array
    if (!Array.isArray(evidence)) {
      evidence = [];
    }
    
    // If no evidence with URLs, try to extract from web search call results
    const hasUrlsInEvidence = evidence.some(e => e.url && e.url.trim().length > 0);
    if (!hasUrlsInEvidence && responseAny?.output && Array.isArray(responseAny.output)) {
      const webSearchBlocks = responseAny.output.filter((block: any) => 
        block?.type === 'web_search_call' || block?.type === 'web_search'
      );
      
      for (const block of webSearchBlocks) {
        // Extract URLs from results_url
        if (block?.results_url && typeof block.results_url === 'string') {
          evidence.push({
            source: 'Web Search',
            url: block.results_url,
            snippet: 'Web search result',
            quality: scoreEvidence(block.results_url),
          });
        }
        
        // Extract from results array
        if (Array.isArray(block?.results)) {
          for (const result of block.results) {
            if (result?.url || result?.link) {
              evidence.push({
                source: result.title || result.source || 'Web Search',
                url: result.url || result.link,
                snippet: result.snippet || result.description || result.text || 'Web search result',
                quality: scoreEvidence(result.url || result.link),
              });
            }
          }
        }
        
        // Check action.results
        if (block?.action?.results && Array.isArray(block.action.results)) {
          for (const result of block.action.results) {
            if (result?.url || result?.link) {
              evidence.push({
                source: result.title || result.source || 'Web Search',
                url: result.url || result.link,
                snippet: result.snippet || result.description || result.text || 'Web search result',
                quality: scoreEvidence(result.url || result.link),
              });
            }
          }
        }
        
        // Check for result field (singular)
        if (block?.result) {
          const result = block.result;
          if (result?.url || result?.link) {
            evidence.push({
              source: result.title || result.source || 'Web Search',
              url: result.url || result.link,
              snippet: result.snippet || result.description || result.text || 'Web search result',
              quality: scoreEvidence(result.url || result.link),
            });
          }
        }
      }
      
      // Also extract URLs from output_text if no evidence found
      if (evidence.length === 0 && responseAny?.output_text) {
        const urlMatches = responseAny.output_text.match(/https?:\/\/[^\s\)\]]+/g);
        if (urlMatches) {
          for (const url of urlMatches.slice(0, 5)) { // Limit to 5 URLs
            evidence.push({
              source: 'Web Search',
              url: url,
              snippet: 'Extracted from web search response',
              quality: scoreEvidence(url),
            });
          }
        }
      }
    }

    return {
      id: `${claim.id}-fact-check`,
      claimId: claim.id,
      verdict: sanitizeVerdict(factCheckResponse.verdict),
      confidence: Math.max(0, Math.min(1, Number(factCheckResponse.confidence) || 0.5)),
      evidence: evidence,
      caveats: Array.isArray(factCheckResponse.caveats) 
        ? factCheckResponse.caveats.filter((caveat) => caveat && typeof caveat === 'string' && caveat.trim().length > 0)
        : [],
      checkedAt: new Date(),
    };
  } catch (error: any) {
    // If web search fails, log and re-throw to fall back to standard fact-checking
    if (error.message?.includes('falling back')) {
      throw error;
    }
    console.error(`[FactCheckAgent] Web search API error for claim ${claim.id}:`, error.message || error);
    throw new Error(`Web search failed: ${error.message || 'Unknown error'}`);
  }
};

export async function factCheckClaims(chirp: Chirp, claims: Claim[]): Promise<FactCheck[]> {
  if (!claims.length) {
    console.warn('[FactCheckAgent] No claims provided, skipping fact-check', { chirpId: chirp.id });
    return [];
  }

  if (!BaseAgent.isAvailable()) {
    console.warn('[FactCheckAgent] BaseAgent unavailable, using fallback fact-checks', { chirpId: chirp.id });
    return claims.map(fallbackFactCheck);
  }

  if (ENABLE_WEB_SEARCH) {
    const results: FactCheck[] = [];
    for (const claim of claims) {
      try {
        const factCheck = await runFactCheckWithWebSearch(chirp, claim);
        results.push(factCheck);
      } catch (error: any) {
        // Log authentication errors prominently
        if (isAuthenticationError(error)) {
          console.error(
            `[FactCheckAgent] ⚠️ CRITICAL: Fact-checking claim ${claim.id} with web search failed due to authentication error - OpenAI API key is invalid or expired. Using standard fact-checking.`,
            error
          );
        } else if (error.message?.includes('falling back')) {
          // Web search not available, fall back to standard fact-checking
          console.warn(`[FactCheckAgent] Web search not available for claim ${claim.id}, using standard fact-checking`);
          try {
            const agent = new BaseAgent();
            const factCheck = await runFactCheck(chirp, claim, agent);
            results.push(factCheck);
            continue;
          } catch (fallbackError) {
            console.error(`[FactCheckAgent] Standard fact-checking also failed for claim ${claim.id}:`, fallbackError);
            results.push({
              ...fallbackFactCheck(claim),
              caveats: ['Both web search and standard fact-checking failed'],
            });
            continue;
          }
        } else {
          console.error(`[FactCheckAgent] Web search fact-check failed for claim ${claim.id}:`, error);
          // Try standard fact-checking as fallback
          try {
            const agent = new BaseAgent();
            const factCheck = await runFactCheck(chirp, claim, agent);
            results.push(factCheck);
            continue;
          } catch (fallbackError) {
            results.push({
              ...fallbackFactCheck(claim),
              caveats: ['Web search failed or returned invalid data'],
            });
          }
        }
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
      // Log authentication errors prominently
      if (isAuthenticationError(error)) {
        console.error(
          `[FactCheckAgent] ⚠️ CRITICAL: Fact-checking claim ${claim.id} failed due to authentication error - OpenAI API key is invalid or expired. Using fallback.`,
          error
        );
      } else {
        console.error(`[FactCheckAgent] Error fact-checking claim ${claim.id}:`, error);
      }
      results.push(fallbackFactCheck(claim));
    }
  }

  console.log('[FactCheckAgent] Completed fact-checks', {
    chirpId: chirp.id,
    claimCount: claims.length,
    factCheckCount: results.length,
    verdicts: results.map((fc) => fc.verdict),
  });

  return results;
}
