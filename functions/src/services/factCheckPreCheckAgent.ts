import { BaseAgent } from '../agents/baseAgent';
import type { Chirp, Comment } from '../types';

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
        'other',
      ],
    },
  },
  required: ['needsFactCheck', 'confidence', 'reasoning', 'contentType'],
};

type PreCheckResponse = {
  needsFactCheck: boolean;
  confidence: number;
  reasoning: string;
  contentType:
    | 'factual_claim'
    | 'opinion'
    | 'experience'
    | 'question'
    | 'emotion'
    | 'conversation'
    | 'mixed'
    | 'other';
};

export type PreCheckResult = {
  needsFactCheck: boolean;
  confidence: number;
  reasoning: string;
  contentType: PreCheckResponse['contentType'];
};

const fallbackPreCheck = (text: string): PreCheckResult => {
  const lowerText = text.toLowerCase();
  const factualIndicators = [
    /\d+%/,
    /\d+ out of \d+/,
    /according to/,
    /study shows/,
    /research indicates/,
    /scientists say/,
    /experts claim/,
    /\d{4}/,
    /million|billion/,
    /proven|evidence|data|statistics/,
  ];
  const hasFactualIndicators = factualIndicators.some((pattern) => pattern.test(lowerText));

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
    /^can someone/i,
  ];
  const hasOpinionIndicators = opinionIndicators.some((pattern) => pattern.test(text));

  if (hasFactualIndicators && !hasOpinionIndicators) {
    return {
      needsFactCheck: true,
      confidence: 0.6,
      reasoning: 'Heuristic detection: Contains factual indicators',
      contentType: 'factual_claim',
    };
  }

  if (hasOpinionIndicators && !hasFactualIndicators) {
    return {
      needsFactCheck: false,
      confidence: 0.7,
      reasoning: 'Heuristic detection: Contains opinion/experience indicators',
      contentType: 'opinion',
    };
  }

  return {
    needsFactCheck: false,
    confidence: 0.5,
    reasoning: 'Heuristic detection: Unclear content type, defaulting to skip',
    contentType: 'other',
  };
};

export async function preCheckChirp(chirp: Chirp): Promise<PreCheckResult> {
  const hasText = chirp.text?.trim() && chirp.text.trim().length > 0;
  const hasImage = chirp.imageUrl && chirp.imageUrl.trim().length > 0;

  if (!hasText && !hasImage) {
    return {
      needsFactCheck: false,
      confidence: 1.0,
      reasoning: 'No content to analyze',
      contentType: 'other',
    };
  }

  if (!BaseAgent.isAvailable()) {
    return fallbackPreCheck(chirp.text || '');
  }

  const agent = new BaseAgent('gpt-4o-mini');

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
    } else {
      prompt += `

This content contains only an image. Analyze if the image contains verifiable factual claims that need fact-checking.`;
    }
  }

  prompt += `

Analyze this content and determine if it needs fact-checking. Follow the decision rules provided.`;

  try {
    let response: PreCheckResponse;

    if (hasImage) {
      response = await agent.generateJSONWithVision<PreCheckResponse>(
        prompt,
        chirp.imageUrl || null,
        SYSTEM_PROMPT,
        PRECHECK_RESPONSE_SCHEMA
      );
    } else {
      response = await agent.generateJSON<PreCheckResponse>(prompt, SYSTEM_PROMPT, PRECHECK_RESPONSE_SCHEMA);
    }

    return {
      needsFactCheck: Boolean(response.needsFactCheck),
      confidence: Math.max(0, Math.min(1, Number(response.confidence) || 0.5)),
      reasoning: String(response.reasoning || 'Agent analysis'),
      contentType: response.contentType || 'other',
    };
  } catch (error) {
    return fallbackPreCheck(chirp.text || '');
  }
}

export async function preCheckComment(comment: Comment): Promise<PreCheckResult> {
  const hasText = comment.text?.trim() && comment.text.trim().length > 0;
  const hasImage = comment.imageUrl && comment.imageUrl.trim().length > 0;

  if (!hasText && !hasImage) {
    return {
      needsFactCheck: false,
      confidence: 1.0,
      reasoning: 'No content to analyze',
      contentType: 'other',
    };
  }

  if (!BaseAgent.isAvailable()) {
    return fallbackPreCheck(comment.text || '');
  }

  const agent = new BaseAgent('gpt-4o-mini');

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
    } else {
      prompt += `

This comment contains only an image. Analyze if the image contains verifiable factual claims that need fact-checking.`;
    }
  }

  prompt += `

Analyze this comment/reply and determine if it contains verifiable factual claims that need fact-checking. Follow the decision rules provided.`;

  try {
    let response: PreCheckResponse;

    if (hasImage) {
      response = await agent.generateJSONWithVision<PreCheckResponse>(
        prompt,
        comment.imageUrl || null,
        SYSTEM_PROMPT,
        PRECHECK_RESPONSE_SCHEMA
      );
    } else {
      response = await agent.generateJSON<PreCheckResponse>(prompt, SYSTEM_PROMPT, PRECHECK_RESPONSE_SCHEMA);
    }

    return {
      needsFactCheck: Boolean(response.needsFactCheck),
      confidence: Math.max(0, Math.min(1, Number(response.confidence) || 0.5)),
      reasoning: String(response.reasoning || 'Agent analysis'),
      contentType: response.contentType || 'other',
    };
  } catch (error) {
    return fallbackPreCheck(comment.text || '');
  }
}

export async function preCheckText(text: string, imageUrl?: string): Promise<PreCheckResult> {
  const hasText = text?.trim() && text.trim().length > 0;
  const hasImage = imageUrl && imageUrl.trim().length > 0;

  if (!hasText && !hasImage) {
    return {
      needsFactCheck: false,
      confidence: 1.0,
      reasoning: 'No content to analyze',
      contentType: 'other',
    };
  }

  if (!BaseAgent.isAvailable()) {
    return fallbackPreCheck(text || '');
  }

  const agent = new BaseAgent('gpt-4o-mini');

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
    } else {
      prompt += `

This content contains only an image. Analyze if the image contains verifiable factual claims that need fact-checking.`;
    }
  }

  prompt += `

Follow the decision rules provided.`;

  try {
    let response: PreCheckResponse;

    if (hasImage) {
      response = await agent.generateJSONWithVision<PreCheckResponse>(
        prompt,
        imageUrl || null,
        SYSTEM_PROMPT,
        PRECHECK_RESPONSE_SCHEMA
      );
    } else {
      response = await agent.generateJSON<PreCheckResponse>(prompt, SYSTEM_PROMPT, PRECHECK_RESPONSE_SCHEMA);
    }

    return {
      needsFactCheck: Boolean(response.needsFactCheck),
      confidence: Math.max(0, Math.min(1, Number(response.confidence) || 0.5)),
      reasoning: String(response.reasoning || 'Agent analysis'),
      contentType: response.contentType || 'other',
    };
  } catch (error) {
    return fallbackPreCheck(text || '');
  }
}


