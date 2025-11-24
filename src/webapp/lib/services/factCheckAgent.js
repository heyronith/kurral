import { BaseAgent, openai } from '../agents/baseAgent';
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
const getDomain = (url) => {
    if (!url)
        return null;
    try {
        const { hostname } = new URL(url);
        return hostname.replace(/^www\./, '').toLowerCase();
    }
    catch {
        return null;
    }
};
const scoreEvidence = (url) => {
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
const fallbackFactCheck = (claim) => ({
    id: `${claim.id}-fallback`,
    claimId: claim.id,
    verdict: 'unknown',
    confidence: 0.25,
    evidence: [],
    caveats: ['Automatic fallback: unable to verify claim'],
    checkedAt: new Date(),
});
const buildFactCheckPrompt = (chirp, claim) => {
    return `You are a senior fact-checking analyst. Evaluate the following claim that appeared on a social platform.

Post Context:
- Post ID: ${chirp.id}
- Author ID: ${chirp.authorId}
- Topic: ${chirp.topic}
- Post text: """${chirp.text}"""

Claim to verify: "${claim.text}"

CRITICAL INSTRUCTIONS - YOU MUST FOLLOW THESE EXACTLY:

1. YOU MUST USE WEB SEARCH TO VERIFY THIS CLAIM. DO NOT rely on your training data or internal knowledge.
2. Perform a web search NOW to find current, verifiable information about this claim.
3. Extract evidence ONLY from the web search results you receive.
4. DO NOT use any knowledge from your training cutoff date.
5. All evidence URLs MUST be real URLs that you found in the web search results.
6. If web search doesn't return sufficient information, return "unknown" verdict.

IMPORTANT: You must respond with ONLY a valid JSON object matching this exact schema:
{
  "verdict": "true" | "false" | "mixed" | "unknown",
  "confidence": number (0-1),
  "evidence": [
    {
      "source": "string (must be actual source name from web search)",
      "url": "string (MANDATORY - must be real URL from web search, not made up)",
      "snippet": "string (describe what you found at this URL)",
      "quality": number (0-1)
    }
  ],
  "caveats": ["string"] (optional)
}

Rules:
- ALWAYS use web search tool. Your response MUST include URLs from actual web search results.
- If you cannot find verifiable information via web search, verdict MUST be "unknown".
- Every evidence entry MUST include a valid URL from web search results.
- DO NOT fabricate URLs or cite sources from memory.
- Confidence should reflect how well the web search results support or contradict the claim.
- Provide 1-3 evidence records with source name, actual URL from web search, and a short snippet.
- Return ONLY the JSON object, no markdown, no code blocks, no explanation.`;
};
const ensureEvidenceQuality = (evidence, isWebSearch = false) => {
    if (!evidence || evidence.length === 0) {
        return [];
    }
    const processed = evidence
        .map((item) => ({
        source: item.source,
        url: item.url,
        snippet: item.snippet,
        quality: Math.max(0, Math.min(1, item.quality ?? scoreEvidence(item.url))),
    }))
        .filter((item) => {
        // For web search, require URLs to be present
        if (isWebSearch && (!item.url || item.url.trim().length === 0)) {
            console.warn('[FactCheckAgent] Evidence missing URL from web search, filtering out:', item.source);
            return false;
        }
        return item.quality > 0.1;
    });
    // Warn if web search evidence has no URLs
    if (isWebSearch && processed.length > 0) {
        const urlsCount = processed.filter(e => e.url && e.url.trim().length > 0).length;
        if (urlsCount === 0) {
            console.warn('[FactCheckAgent] WARNING: Web search evidence has no URLs - web search may not have been used');
        }
        else {
            console.log('[FactCheckAgent] Web search evidence validated:', urlsCount, 'evidence entries with URLs');
        }
    }
    return processed;
};
const sanitizeVerdict = (verdict) => {
    if (verdict === 'true' || verdict === 'false' || verdict === 'mixed' || verdict === 'unknown') {
        return verdict;
    }
    return 'unknown';
};
const ENABLE_WEB_SEARCH = import.meta.env.VITE_OPENAI_WEB_SEARCH === 'true';
const WEB_SEARCH_MODEL = 'gpt-4o-mini';
const parseJsonFromSearchResponse = (response) => {
    // Try to extract JSON from output_text
    const textPayload = response?.output_text;
    if (typeof textPayload === 'string') {
        // Remove markdown code blocks if present
        let jsonText = textPayload.trim();
        if (jsonText.includes('```json')) {
            const match = jsonText.match(/```json\s*([\s\S]*?)\s*```/);
            if (match && match[1]) {
                jsonText = match[1].trim();
            }
        }
        else if (jsonText.includes('```')) {
            const match = jsonText.match(/```[^\n]*\s*([\s\S]*?)\s*```/);
            if (match && match[1]) {
                jsonText = match[1].trim();
            }
        }
        // Try to find JSON object in the text
        const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try {
                const parsed = JSON.parse(jsonMatch[0]);
                if (parsed && typeof parsed === 'object' && 'verdict' in parsed) {
                    return parsed;
                }
            }
            catch (error) {
                console.warn('[FactCheckAgent] Failed to parse JSON from responses output_text', error);
            }
        }
    }
    // Also check output array for structured content
    if (response?.output && Array.isArray(response.output)) {
        for (const outputBlock of response.output) {
            if (outputBlock?.content && Array.isArray(outputBlock.content)) {
                for (const contentBlock of outputBlock.content) {
                    if (contentBlock?.type === 'text' && contentBlock?.text) {
                        const jsonMatch = contentBlock.text.match(/\{[\s\S]*\}/);
                        if (jsonMatch) {
                            try {
                                const parsed = JSON.parse(jsonMatch[0]);
                                if (parsed && typeof parsed === 'object' && 'verdict' in parsed) {
                                    return parsed;
                                }
                            }
                            catch (error) {
                                console.warn('[FactCheckAgent] Failed to parse JSON from output content block', error);
                            }
                        }
                    }
                }
            }
        }
    }
    return null;
};
const runFactCheckWithWebSearch = async (chirp, claim) => {
    if (!openai) {
        throw new Error('OpenAI client not configured for web search');
    }
    const systemPrompt = `You are a rigorous fact-checking agent that ALWAYS uses web search to verify claims. You MUST use the web_search tool for every fact-check. Do NOT rely on training data. Always cite credible sources from web search results with real URLs. Avoid speculation. If web search doesn't provide sufficient information, answer "unknown" and explain why.`;
    const userPrompt = buildFactCheckPrompt(chirp, claim);
    const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;
    console.log('[FactCheckAgent] Using web search to verify claim:', claim.text);
    const response = await openai.responses.create({
        model: WEB_SEARCH_MODEL,
        input: fullPrompt,
        tools: [{ type: 'web_search' }],
    });
    // Log response structure for debugging and verify web search was used
    const responseDebug = {
        hasOutputText: !!response?.output_text,
        hasOutput: !!response?.output,
        outputLength: response?.output?.length || 0,
        hasCitations: false,
        hasWebSearchResults: false,
    };
    // Check if response contains web search results or citations
    if (response?.output && Array.isArray(response.output)) {
        for (const outputBlock of response.output) {
            // Check if outputBlock has content array (type guard)
            if ('content' in outputBlock && Array.isArray(outputBlock.content)) {
                for (const contentBlock of outputBlock.content) {
                    if (contentBlock?.type === 'web_search' || contentBlock?.type === 'citation') {
                        responseDebug.hasWebSearchResults = true;
                        responseDebug.hasCitations = true;
                        break;
                    }
                }
            }
            // Also check for tool_calls indicating web search was used
            if ('tool_calls' in outputBlock && Array.isArray(outputBlock.tool_calls)) {
                const toolCalls = outputBlock.tool_calls;
                if (toolCalls.some((tc) => tc?.type === 'web_search' || tc?.function?.name === 'web_search')) {
                    responseDebug.hasWebSearchResults = true;
                }
            }
        }
    }
    // Check output_text for citation markers
    if (response?.output_text && typeof response.output_text === 'string') {
        if (response.output_text.includes('[citation') || response.output_text.includes('http')) {
            responseDebug.hasCitations = true;
            responseDebug.hasWebSearchResults = true;
        }
    }
    console.log('[FactCheckAgent] Web search response received:', responseDebug);
    if (!responseDebug.hasWebSearchResults && !responseDebug.hasCitations) {
        console.warn('[FactCheckAgent] WARNING: Response does not appear to contain web search results or citations. Web search may not have been invoked.');
    }
    const factCheckResponse = parseJsonFromSearchResponse(response);
    if (!factCheckResponse) {
        throw new Error('Failed to extract JSON fact-check from web search response');
    }
    // Validate that evidence includes URLs (indicates web search was used)
    const hasUrls = factCheckResponse.evidence?.some(e => e.url && e.url.trim().length > 0);
    if (!hasUrls && factCheckResponse.evidence && factCheckResponse.evidence.length > 0) {
        console.warn('[FactCheckAgent] WARNING: Fact-check response has evidence but no URLs - web search may not have been used');
    }
    const finalFactCheck = {
        id: `${claim.id}-fact-check`,
        claimId: claim.id,
        verdict: sanitizeVerdict(factCheckResponse.verdict),
        confidence: Math.max(0, Math.min(1, Number(factCheckResponse.confidence) || 0.5)),
        evidence: ensureEvidenceQuality(factCheckResponse.evidence, true), // Pass isWebSearch flag
        caveats: factCheckResponse.caveats?.filter((caveat) => caveat.trim().length > 0) || [],
        checkedAt: new Date(),
    };
    // Add warning to caveats if no URLs found (indicates web search wasn't used)
    if (!hasUrls && finalFactCheck.evidence.length === 0 && finalFactCheck.verdict !== 'unknown') {
        finalFactCheck.caveats.push('Warning: No web search URLs found in evidence - verification may be incomplete');
    }
    return finalFactCheck;
};
const runFactCheck = async (chirp, claim, agent) => {
    const prompt = buildFactCheckPrompt(chirp, claim);
    const systemPrompt = `You are a rigorous fact-checking agent. Always cite credible sources. Avoid speculation. If unsure, answer "unknown" and explain why.`;
    const response = await agent.generateJSON(prompt, systemPrompt, FACT_CHECK_SCHEMA);
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
export async function factCheckClaims(chirp, claims) {
    if (!claims.length) {
        return [];
    }
    if (ENABLE_WEB_SEARCH && openai) {
        const results = [];
        for (const claim of claims) {
            try {
                const factCheck = await runFactCheckWithWebSearch(chirp, claim);
                results.push(factCheck);
            }
            catch (error) {
                console.error('[FactCheckAgent] Web search fact-check failed', claim.id, error);
                results.push(fallbackFactCheck(claim));
            }
        }
        return results;
    }
    if (!BaseAgent.isAvailable()) {
        return claims.map(fallbackFactCheck);
    }
    const agent = new BaseAgent();
    const results = [];
    for (const claim of claims) {
        try {
            const factCheck = await runFactCheck(chirp, claim, agent);
            results.push(factCheck);
        }
        catch (error) {
            console.error('[FactCheckAgent] Error fact-checking claim', claim.id, error);
            results.push(fallbackFactCheck(claim));
        }
    }
    return results;
}
