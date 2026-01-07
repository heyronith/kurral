/**
 * Pipeline Step 1: Agentic Pre-check
 * 
 * Uses an LLM to intelligently decide if content needs fact-checking.
 * Fast, cheap (gpt-4o-mini), and more accurate than rule-based checks.
 */

import { BaseAgent } from '../../../agents/baseAgent';
import { logger } from 'firebase-functions';
import type { PreCheckResult } from '../types';

const PRECHECK_SCHEMA = {
  type: 'object',
  properties: {
    needsFactCheck: { type: 'boolean' },
    confidence: { type: 'number' },
    reasoning: { type: 'string' },
    contentType: {
      type: 'string',
      enum: ['factual', 'news', 'opinion', 'experience', 'question', 'humor', 'other'],
    },
  },
  required: ['needsFactCheck', 'confidence', 'contentType'],
};

const SYSTEM_PROMPT = `You are a content classification agent. Analyze text and decide if it contains factual claims that need verification.

Output JSON with:
- needsFactCheck: boolean (true if content has verifiable claims)
- confidence: number 0-1 (how confident you are)
- reasoning: string (brief explanation)
- contentType: one of "factual", "news", "opinion", "experience", "question", "humor", "other"

CLASSIFY AS NEEDS FACT-CHECK (needsFactCheck=true):
- Statistics, numbers, percentages
- Claims about public figures, companies, events
- Health/medical claims
- Financial claims
- Scientific claims
- News-like assertions
- Claims citing "studies", "experts", "research"

CLASSIFY AS NO FACT-CHECK NEEDED (needsFactCheck=false):
- Pure opinions ("I think...", "In my opinion...")
- Personal experiences ("I went to...", "My day was...")
- Questions without embedded claims
- Jokes, memes, humor
- Greetings, small talk
- Emotional expressions

When uncertain, lean toward needsFactCheck=true (better to verify than miss).`;

/**
 * Run agentic pre-check on text content
 */
export async function runPreCheck(
  text: string,
  imageUrl?: string
): Promise<PreCheckResult> {
  // Empty content = no fact check needed
  if (!text?.trim() && !imageUrl) {
    return {
      needsFactCheck: false,
      confidence: 1.0,
      reasoning: 'No content to analyze',
      contentType: 'other',
    };
  }

  // Check if AI is available
  if (!BaseAgent.isAvailable()) {
    logger.warn('[PreCheck] AI not available, defaulting to needs fact-check');
    return {
      needsFactCheck: true,
      confidence: 0.5,
      reasoning: 'AI unavailable, defaulting to fact-check',
      contentType: 'other',
    };
  }

  const agent = new BaseAgent('gpt-4o-mini');

  let prompt = 'Analyze this content:\n\n';
  if (text?.trim()) {
    prompt += `Text: """${text}"""\n`;
  }
  if (imageUrl) {
    prompt += '\n(Image attached - analyze any text/claims visible in the image)\n';
  }
  prompt += '\nClassify and decide if fact-checking is needed.';

  try {
    let response: any;

    if (imageUrl) {
      response = await agent.generateJSONWithVision(
        prompt,
        imageUrl,
        SYSTEM_PROMPT,
        PRECHECK_SCHEMA
      );
    } else {
      response = await agent.generateJSON(prompt, SYSTEM_PROMPT, PRECHECK_SCHEMA);
    }

    const result: PreCheckResult = {
      needsFactCheck: Boolean(response.needsFactCheck),
      confidence: Math.max(0, Math.min(1, Number(response.confidence) || 0.5)),
      reasoning: String(response.reasoning || 'No reasoning provided'),
      contentType: response.contentType || 'other',
    };

    logger.info('[PreCheck] Result', {
      needsFactCheck: result.needsFactCheck,
      contentType: result.contentType,
      confidence: result.confidence,
    });

    return result;
  } catch (error: any) {
    logger.error('[PreCheck] Failed, defaulting to needs fact-check', { error: error.message });
    
    // On error, default to fact-checking (safer)
    return {
      needsFactCheck: true,
      confidence: 0.3,
      reasoning: `Pre-check failed: ${error.message}`,
      contentType: 'other',
    };
  }
}

