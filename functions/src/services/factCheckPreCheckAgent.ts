import { BaseAgent } from '../agents/baseAgent';
import type { Chirp, Comment } from '../types';

type RiskInput = {
  text?: string | null;
  topic?: string | null;
  semanticTopics?: string[] | null;
  entities?: string[] | null;
  imageUrl?: string | null;
};

const HIGH_RISK_TOPICS = ['health', 'medical', 'finance', 'money', 'invest', 'stocks', 'economy', 'politics', 'election', 'climate'];
const HIGH_RISK_KEYWORDS = [
  'cure',
  'vaccine',
  'treatment',
  'cancer',
  'covid',
  'virus',
  'inflation',
  'recession',
  'investment',
  'returns',
  'guaranteed',
  'election',
  'vote',
  'fraud',
  'war',
  'nuclear',
];
const STAT_INDICATORS = [/\d+%/, /\d+ out of \d+/, /\d{4}/, /\b(million|billion|trillion)\b/i];
const AUTHORITY_INDICATORS = [/according to/i, /study shows/i, /research indicates/i, /experts? (say|claim)/i, /scientists/i, /doctors/i];

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export const calculateContentRiskScore = (input: RiskInput): number => {
  const text = (input.text || '').toLowerCase();
  const topic = (input.topic || '').toLowerCase();
  const semanticTopics = (input.semanticTopics || []).map((t) => (t || '').toLowerCase());
  const entities = (input.entities || []).map((e) => (e || '').toLowerCase());

  let score = 0.2; // base

  const bump = (v: number) => {
    score += v;
  };

  const containsAny = (haystack: string, patterns: RegExp[]) => patterns.some((p) => p.test(haystack));
  const containsAnyKeyword = (haystack: string, keywords: string[]) =>
    keywords.some((kw) => kw.length > 0 && haystack.includes(kw));

  // Topic/semantic topic risk
  const topicMatchesHighRisk =
    containsAnyKeyword(topic, HIGH_RISK_TOPICS) ||
    semanticTopics.some((t) => containsAnyKeyword(t, HIGH_RISK_TOPICS));
  if (topicMatchesHighRisk) bump(0.25);

  // Entities risk
  if (entities.some((e) => containsAnyKeyword(e, HIGH_RISK_TOPICS))) bump(0.15);

  // Statistical indicators
  if (containsAny(text, STAT_INDICATORS)) bump(0.2);

  // Authority indicators
  if (containsAny(text, AUTHORITY_INDICATORS)) bump(0.15);

  // High-risk keywords
  if (containsAnyKeyword(text, HIGH_RISK_KEYWORDS)) bump(0.2);

  // Length heuristic
  const len = (input.text || '').length;
  if (len > 200) bump(0.1);
  else if (len < 40) bump(-0.05);

  // Image present slightly increases risk (could contain claims)
  if (input.imageUrl && input.imageUrl.trim().length > 0) bump(0.05);

  // Normalize
  return clamp01(score);
};

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

const fallbackPreCheck = (input: RiskInput): PreCheckResult => {
  const text = (input.text || '').toLowerCase();
  const riskScore = calculateContentRiskScore(input);

  const hasFactualIndicators = STAT_INDICATORS.some((pattern) => pattern.test(text)) || AUTHORITY_INDICATORS.some((pattern) => pattern.test(text));
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
  const hasOpinionIndicators = opinionIndicators.some((pattern) => pattern.test(input.text || ''));

  // Fail-open for ambiguous/medium risk
  if (riskScore > 0.7 || (hasFactualIndicators && !hasOpinionIndicators)) {
    return {
      needsFactCheck: true,
      confidence: Math.max(0.6, riskScore),
      reasoning: 'Heuristic: high-risk indicators present',
      contentType: hasOpinionIndicators ? 'mixed' : 'factual_claim',
    };
  }

  if (hasOpinionIndicators && !hasFactualIndicators && riskScore < 0.4) {
    return {
      needsFactCheck: false,
      confidence: Math.max(0.7, 1 - riskScore),
      reasoning: 'Heuristic: opinion/experience indicators with low risk',
      contentType: 'opinion',
    };
  }

  // Ambiguous → proceed (needsFactCheck: true) to avoid false negatives
  return {
    needsFactCheck: true,
    confidence: Math.max(0.5, riskScore),
    reasoning: 'Heuristic: ambiguous content, fail-open to fact-check',
    contentType: hasOpinionIndicators && hasFactualIndicators ? 'mixed' : 'other',
  };
};

export async function preCheckChirp(chirp: Chirp): Promise<PreCheckResult> {
  const hasText = chirp.text?.trim() && chirp.text.trim().length > 0;
  const hasImage = chirp.imageUrl && chirp.imageUrl.trim().length > 0;
  const riskScore = calculateContentRiskScore({
    text: chirp.text,
    topic: chirp.topic,
    semanticTopics: chirp.semanticTopics,
    entities: chirp.entities,
    imageUrl: chirp.imageUrl,
  });

  if (!hasText && !hasImage) {
    return {
      needsFactCheck: false,
      confidence: 1.0,
      reasoning: 'No content to analyze',
      contentType: 'other',
    };
  }

  // Risk-based shortcuts
  if (riskScore > 0.7) {
    return {
      needsFactCheck: true,
      confidence: riskScore,
      reasoning: 'Risk score high, proceeding to fact-check',
      contentType: 'factual_claim',
    };
  }

  if (riskScore < 0.3 && !hasImage) {
    return {
      needsFactCheck: false,
      confidence: 0.8,
      reasoning: 'Risk score low, skipping fact-check',
      contentType: 'other',
    };
  }

  if (!BaseAgent.isAvailable()) {
    return fallbackPreCheck({
      text: chirp.text,
      topic: chirp.topic,
      semanticTopics: chirp.semanticTopics,
      entities: chirp.entities,
      imageUrl: chirp.imageUrl,
    });
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

    const result: PreCheckResult = {
      needsFactCheck: Boolean(response.needsFactCheck),
      confidence: Math.max(0, Math.min(1, Number(response.confidence) || 0.5)),
      reasoning: String(response.reasoning || 'Agent analysis'),
      contentType: response.contentType || 'other',
    };
    // Confidence-based override: if skip with low confidence and medium/high risk, proceed
    if (!result.needsFactCheck && (result.confidence < 0.8 && riskScore >= 0.4)) {
      return {
        ...result,
        needsFactCheck: true,
        reasoning: `${result.reasoning} | Overridden due to risk/low confidence`,
      };
    }
    return result;
  } catch (error) {
    return fallbackPreCheck({
      text: chirp.text,
      topic: chirp.topic,
      semanticTopics: chirp.semanticTopics,
      entities: chirp.entities,
      imageUrl: chirp.imageUrl,
    });
  }
}

export async function preCheckComment(comment: Comment): Promise<PreCheckResult> {
  const hasText = comment.text?.trim() && comment.text.trim().length > 0;
  const hasImage = comment.imageUrl && comment.imageUrl.trim().length > 0;
  const riskScore = calculateContentRiskScore({
    text: comment.text,
    topic: undefined,
    semanticTopics: undefined,
    entities: undefined,
    imageUrl: comment.imageUrl,
  });

  if (!hasText && !hasImage) {
    return {
      needsFactCheck: false,
      confidence: 1.0,
      reasoning: 'No content to analyze',
      contentType: 'other',
    };
  }

  if (riskScore > 0.7) {
    return {
      needsFactCheck: true,
      confidence: riskScore,
      reasoning: 'Risk score high, proceeding to fact-check',
      contentType: 'factual_claim',
    };
  }

  if (riskScore < 0.3 && !hasImage) {
    return {
      needsFactCheck: false,
      confidence: 0.8,
      reasoning: 'Risk score low, skipping fact-check',
      contentType: 'other',
    };
  }

  if (!BaseAgent.isAvailable()) {
    return fallbackPreCheck({
      text: comment.text,
      topic: undefined,
      semanticTopics: undefined,
      entities: undefined,
      imageUrl: comment.imageUrl,
    });
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

    const result: PreCheckResult = {
      needsFactCheck: Boolean(response.needsFactCheck),
      confidence: Math.max(0, Math.min(1, Number(response.confidence) || 0.5)),
      reasoning: String(response.reasoning || 'Agent analysis'),
      contentType: response.contentType || 'other',
    };
    if (!result.needsFactCheck && (result.confidence < 0.8 && riskScore >= 0.4)) {
      return {
        ...result,
        needsFactCheck: true,
        reasoning: `${result.reasoning} | Overridden due to risk/low confidence`,
      };
    }
    return result;
  } catch (error) {
    return fallbackPreCheck({
      text: comment.text,
      topic: undefined,
      semanticTopics: undefined,
      entities: undefined,
      imageUrl: comment.imageUrl,
    });
  }
}

export async function preCheckText(text: string, imageUrl?: string): Promise<PreCheckResult> {
  const hasText = text?.trim() && text.trim().length > 0;
  const hasImage = imageUrl && imageUrl.trim().length > 0;
  const riskScore = calculateContentRiskScore({
    text,
    topic: undefined,
    semanticTopics: undefined,
    entities: undefined,
    imageUrl,
  });

  if (!hasText && !hasImage) {
    return {
      needsFactCheck: false,
      confidence: 1.0,
      reasoning: 'No content to analyze',
      contentType: 'other',
    };
  }

  if (riskScore > 0.7) {
    return {
      needsFactCheck: true,
      confidence: riskScore,
      reasoning: 'Risk score high, proceeding to fact-check',
      contentType: 'factual_claim',
    };
  }

  if (riskScore < 0.3 && !hasImage) {
    return {
      needsFactCheck: false,
      confidence: 0.8,
      reasoning: 'Risk score low, skipping fact-check',
      contentType: 'other',
    };
  }

  if (!BaseAgent.isAvailable()) {
    return fallbackPreCheck({ text, topic: undefined, semanticTopics: undefined, entities: undefined, imageUrl });
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

    const result: PreCheckResult = {
      needsFactCheck: Boolean(response.needsFactCheck),
      confidence: Math.max(0, Math.min(1, Number(response.confidence) || 0.5)),
      reasoning: String(response.reasoning || 'Agent analysis'),
      contentType: response.contentType || 'other',
    };
    if (!result.needsFactCheck && (result.confidence < 0.8 && riskScore >= 0.4)) {
      return {
        ...result,
        needsFactCheck: true,
        reasoning: `${result.reasoning} | Overridden due to risk/low confidence`,
      };
    }
    return result;
  } catch (error) {
    return fallbackPreCheck({ text, topic: undefined, semanticTopics: undefined, entities: undefined, imageUrl });
  }
}


