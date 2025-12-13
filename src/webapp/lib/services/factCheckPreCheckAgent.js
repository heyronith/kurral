import { BaseAgent } from '../agents/baseAgent';
const SYSTEM_PROMPT = `You are a pre-check agent for a fact-checking system. Your job is to determine if content needs fact-checking.

Analyze the provided content and decide if it contains verifiable factual claims that should be fact-checked.

CRITICAL DECISION RULES:

SHOULD BE FACT-CHECKED (needsFactCheck: true):
- Contains verifiable factual claims (dates, numbers, statistics, events)
- Makes claims about health/medical topics
- Makes scientific claims
- Makes news-like statements or reports events
- Makes claims about public figures, events, or organizations
- Contains potentially harmful misinformation
- Makes financial/investment claims
- Makes claims about current events or politics
- Contains statistical data or percentages
- Makes historical claims

SHOULD NOT BE FACT-CHECKED (needsFactCheck: false):
- Pure opinions ("I think X is great", "In my opinion...")
- Personal experiences ("I went to Y yesterday", "I tried X")
- Questions without embedded claims ("What do you think?")
- Expressions of emotion ("I'm so happy!", "This is amazing!")
- General conversation/small talk ("Hope you have a good day")
- Commands/requests ("Please help me", "Can someone explain?")
- Clear jokes or satire (if obviously humorous)
- Subjective statements that cannot be verified
- Simple greetings or acknowledgments

MIXED CONTENT:
- If content contains BOTH opinion/experience AND factual claims, mark as needsFactCheck: true
- Fact-check the factual parts even if mixed with opinion

Respond with a JSON object containing your decision and reasoning.`;
const PRECHECK_RESPONSE_SCHEMA = {
    type: 'object',
    properties: {
        needsFactCheck: { type: 'boolean' },
        confidence: { type: 'number' },
        reasoning: { type: 'string' },
        contentType: {
            type: 'string',
            enum: [
                'factual_claim',
                'opinion',
                'experience',
                'question',
                'emotion',
                'conversation',
                'mixed',
                'other'
            ]
        }
    },
    required: ['needsFactCheck', 'confidence', 'reasoning', 'contentType']
};
const fallbackPreCheck = (text) => {
    // Heuristic fallback if agent is unavailable
    const lowerText = text.toLowerCase();
    // Check for factual indicators
    const factualIndicators = [
        /\d+%/,
        /\d+ out of \d+/,
        /according to/,
        /study shows/,
        /research indicates/,
        /scientists say/,
        /experts claim/,
        /\d{4}/, // years
        /million|billion/,
        /proven|evidence|data|statistics/
    ];
    const hasFactualIndicators = factualIndicators.some(pattern => pattern.test(lowerText));
    // Check for opinion/experience indicators
    const opinionIndicators = [
        /^i think/i,
        /^i believe/i,
        /^in my opinion/i,
        /^i feel/i,
        /^i went/i,
        /^i tried/i,
        /^i saw/i,
        /hope you/i,
        /thank you/i,
        /^what do you think/i,
        /^can someone/i
    ];
    const hasOpinionIndicators = opinionIndicators.some(pattern => pattern.test(text));
    if (hasFactualIndicators && !hasOpinionIndicators) {
        return {
            needsFactCheck: true,
            confidence: 0.6,
            reasoning: 'Heuristic detection: Contains factual indicators',
            contentType: 'factual_claim'
        };
    }
    if (hasOpinionIndicators && !hasFactualIndicators) {
        return {
            needsFactCheck: false,
            confidence: 0.7,
            reasoning: 'Heuristic detection: Contains opinion/experience indicators',
            contentType: 'opinion'
        };
    }
    // Default: if unclear, skip fact-checking (safer for false positives)
    return {
        needsFactCheck: false,
        confidence: 0.5,
        reasoning: 'Heuristic detection: Unclear content type, defaulting to skip',
        contentType: 'other'
    };
};
/**
 * Pre-check if a chirp (post) needs fact-checking
 */
export async function preCheckChirp(chirp) {
    const hasText = chirp.text?.trim() && chirp.text.trim().length > 0;
    const hasImage = chirp.imageUrl && chirp.imageUrl.trim().length > 0;
    // If no content at all, skip fact-checking
    if (!hasText && !hasImage) {
        return {
            needsFactCheck: false,
            confidence: 1.0,
            reasoning: 'No content to analyze',
            contentType: 'other'
        };
    }
    // If agent is not available, use fallback
    if (!BaseAgent.isAvailable()) {
        return fallbackPreCheck(chirp.text || '');
    }
    // Use gpt-4o-mini for cost efficiency (pre-check should be fast and cheap)
    const agent = new BaseAgent('gpt-4o-mini');
    // Build prompt
    let prompt = `Content ID: ${chirp.id}
Author: ${chirp.authorId}
Topic: ${chirp.topic}`;
    if (hasText) {
        prompt += `

Text Content:
"""
${chirp.text}
"""`;
    }
    if (hasImage) {
        if (hasText) {
            prompt += `

An image is attached. Consider BOTH the text above AND any text/claims visible in the image when making your decision.`;
        }
        else {
            prompt += `

This content contains only an image. Analyze if the image contains verifiable factual claims that need fact-checking.`;
        }
    }
    prompt += `

Analyze this content and determine if it needs fact-checking. Follow the decision rules provided.`;
    try {
        let response;
        if (hasImage) {
            // Use vision API for images
            response = await agent.generateJSONWithVision(prompt, chirp.imageUrl || null, SYSTEM_PROMPT, PRECHECK_RESPONSE_SCHEMA);
        }
        else {
            // Use text-only API
            response = await agent.generateJSON(prompt, SYSTEM_PROMPT, PRECHECK_RESPONSE_SCHEMA);
        }
        // Validate and return response
        return {
            needsFactCheck: Boolean(response.needsFactCheck),
            confidence: Math.max(0, Math.min(1, Number(response.confidence) || 0.5)),
            reasoning: String(response.reasoning || 'Agent analysis'),
            contentType: response.contentType || 'other'
        };
    }
    catch (error) {
        console.error('[FactCheckPreCheckAgent] Error during pre-check, using fallback:', error);
        return fallbackPreCheck(chirp.text || '');
    }
}
/**
 * Pre-check if a comment/reply needs fact-checking
 */
export async function preCheckComment(comment) {
    const hasText = comment.text?.trim() && comment.text.trim().length > 0;
    const hasImage = comment.imageUrl && comment.imageUrl.trim().length > 0;
    // If no content at all, skip fact-checking
    if (!hasText && !hasImage) {
        return {
            needsFactCheck: false,
            confidence: 1.0,
            reasoning: 'No content to analyze',
            contentType: 'other'
        };
    }
    // If agent is not available, use fallback
    if (!BaseAgent.isAvailable()) {
        return fallbackPreCheck(comment.text || '');
    }
    // Use gpt-4o-mini for cost efficiency
    const agent = new BaseAgent('gpt-4o-mini');
    // Build prompt
    let prompt = `Comment ID: ${comment.id}
Author: ${comment.authorId}
This is a comment/reply in a discussion thread.`;
    if (hasText) {
        prompt += `

Text Content:
"""
${comment.text}
"""`;
    }
    if (hasImage) {
        if (hasText) {
            prompt += `

An image is attached. Consider BOTH the text above AND any text/claims visible in the image when making your decision.`;
        }
        else {
            prompt += `

This comment contains only an image. Analyze if the image contains verifiable factual claims that need fact-checking.`;
        }
    }
    prompt += `

Analyze this comment/reply and determine if it contains verifiable factual claims that need fact-checking. Follow the decision rules provided.`;
    try {
        let response;
        if (hasImage) {
            // Use vision API for images
            response = await agent.generateJSONWithVision(prompt, comment.imageUrl || null, SYSTEM_PROMPT, PRECHECK_RESPONSE_SCHEMA);
        }
        else {
            // Use text-only API
            response = await agent.generateJSON(prompt, SYSTEM_PROMPT, PRECHECK_RESPONSE_SCHEMA);
        }
        // Validate and return response
        return {
            needsFactCheck: Boolean(response.needsFactCheck),
            confidence: Math.max(0, Math.min(1, Number(response.confidence) || 0.5)),
            reasoning: String(response.reasoning || 'Agent analysis'),
            contentType: response.contentType || 'other'
        };
    }
    catch (error) {
        console.error('[FactCheckPreCheckAgent] Error during comment pre-check, using fallback:', error);
        return fallbackPreCheck(comment.text || '');
    }
}
/**
 * Pre-check plain text content (for quoted posts or general use)
 */
export async function preCheckText(text, imageUrl) {
    const hasText = text?.trim() && text.trim().length > 0;
    const hasImage = imageUrl && imageUrl.trim().length > 0;
    // If no content at all, skip fact-checking
    if (!hasText && !hasImage) {
        return {
            needsFactCheck: false,
            confidence: 1.0,
            reasoning: 'No content to analyze',
            contentType: 'other'
        };
    }
    // If agent is not available, use fallback
    if (!BaseAgent.isAvailable()) {
        return fallbackPreCheck(text || '');
    }
    // Use gpt-4o-mini for cost efficiency
    const agent = new BaseAgent('gpt-4o-mini');
    // Build prompt
    let prompt = 'Analyze the following content and determine if it needs fact-checking.';
    if (hasText) {
        prompt += `

Text Content:
"""
${text}
"""`;
    }
    if (hasImage) {
        if (hasText) {
            prompt += `

An image is attached. Consider BOTH the text above AND any text/claims visible in the image when making your decision.`;
        }
        else {
            prompt += `

This content contains only an image. Analyze if the image contains verifiable factual claims that need fact-checking.`;
        }
    }
    prompt += `

Follow the decision rules provided.`;
    try {
        let response;
        if (hasImage) {
            // Use vision API for images
            response = await agent.generateJSONWithVision(prompt, imageUrl || null, SYSTEM_PROMPT, PRECHECK_RESPONSE_SCHEMA);
        }
        else {
            // Use text-only API
            response = await agent.generateJSON(prompt, SYSTEM_PROMPT, PRECHECK_RESPONSE_SCHEMA);
        }
        // Validate and return response
        return {
            needsFactCheck: Boolean(response.needsFactCheck),
            confidence: Math.max(0, Math.min(1, Number(response.confidence) || 0.5)),
            reasoning: String(response.reasoning || 'Agent analysis'),
            contentType: response.contentType || 'other'
        };
    }
    catch (error) {
        console.error('[FactCheckPreCheckAgent] Error during text pre-check, using fallback:', error);
        return fallbackPreCheck(text || '');
    }
}
