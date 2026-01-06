import { logger } from 'firebase-functions';
import { BaseAgent } from '../agents/baseAgent';
import { Chirp, Comment } from '../types';

export type PreCheckResult = {
  needsFactCheck: boolean;
  confidence: number;
  reasoning: string;
  contentType?: 'factual' | 'news' | 'opinion' | 'experience' | 'other';
  riskScore?: number;
  signals?: string[];
};

type RiskInput = {
  text?: string;
  topic?: string;
  semanticTopics?: string[];
  entities?: string[];
  imageUrl?: string;
};

const HIGH_RISK_TOPICS = ['health', 'medical', 'finance', 'money', 'invest', 'stocks', 'economy', 'politics', 'election', 'science'];
const HIGH_RISK_KEYWORDS = [
  'vaccine',
  'treatment',
  'cancer',
  'covid',
  'virus',
  'pandemic',
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
const OPINION_INDICATORS = [/^i think/i, /^i believe/i, /^in my opinion/i, /^i feel/i, /just my opinion/i, /personally/i];

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const containsAny = (haystack: string, patterns: RegExp[]) => patterns.some((p) => p.test(haystack));
const containsAnyKeyword = (haystack: string, keywords: string[]) =>
  keywords.some((kw) => kw.length > 0 && haystack.includes(kw));

export const calculateContentRiskScore = (input: RiskInput): number => {
  const text = (input.text || '').toLowerCase();
  const topic = (input.topic || '').toLowerCase();
  const semanticTopics = (input.semanticTopics || []).map((t) => (t || '').toLowerCase());
  const entities = (input.entities || []).map((e) => (e || '').toLowerCase());

  let score = 0.1; // base

  const bump = (v: number) => {
    score += v;
  };

  const topicMatches =
    containsAnyKeyword(topic, HIGH_RISK_TOPICS) || semanticTopics.some((t) => containsAnyKeyword(t, HIGH_RISK_TOPICS));
  if (topicMatches) bump(0.35);

  if (entities.some((e) => containsAnyKeyword(e, HIGH_RISK_TOPICS))) bump(0.15);
  if (containsAny(text, STAT_INDICATORS)) bump(0.2);
  if (containsAny(text, AUTHORITY_INDICATORS)) bump(0.15);
  if (containsAnyKeyword(text, HIGH_RISK_KEYWORDS)) bump(0.2);

  const len = (input.text || '').length;
  if (len > 200) bump(0.1);
  if (len < 40) bump(-0.05);

  if (input.imageUrl && input.imageUrl.trim().length > 0) bump(0.05);

  return clamp01(score);
};

const fallbackPreCheck = (text: string, imageUrl?: string): PreCheckResult => {
  const riskScore = calculateContentRiskScore({ text, imageUrl });
  const hasOpinion = OPINION_INDICATORS.some((p) => p.test((text || '').toLowerCase()));

  if (hasOpinion && riskScore < 0.3) {
    return {
      needsFactCheck: false,
      confidence: 0.7,
      reasoning: 'Heuristic: opinion/experience detected',
      contentType: 'opinion',
      riskScore,
    };
  }

  const needsFactCheck = riskScore >= 0.35;
  return {
    needsFactCheck,
    confidence: 0.65,
    reasoning: needsFactCheck ? 'Heuristic: content risk is medium/high' : 'Heuristic: low-risk content',
    contentType: 'other',
    riskScore,
  };
};

const PRECHECK_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    needsFactCheck: { type: 'boolean' },
    confidence: { type: 'number' },
    reasoning: { type: 'string' },
    contentType: { type: 'string' },
  },
  required: ['needsFactCheck'],
};

const SYSTEM_PROMPT = `You are a pre-check agent. Output ONLY JSON: { "needsFactCheck": boolean, "confidence": number, "reasoning": string, "contentType": "factual|news|opinion|experience|other" }.
- Set needsFactCheck=true if there is ANY verifiable factual claim, statistic, date, named entity, public figure, or news-like assertion.
- Set needsFactCheck=false ONLY when the content is clearly opinion, personal experience, humor, or non-verifiable chatter with no factual claims.
- If uncertain, choose needsFactCheck=true (erring on the side of verification).
Keep it concise and decisive.`;

const detectSignals = (input: RiskInput): string[] => {
  const signals: string[] = [];
  const text = (input.text || '').toLowerCase();
  const topic = (input.topic || '').toLowerCase();

  if (STAT_INDICATORS.some((pattern) => pattern.test(text))) {
    signals.push('stats_or_numbers');
  }
  if (AUTHORITY_INDICATORS.some((pattern) => pattern.test(text))) {
    signals.push('authority_cue');
  }
  if (containsAnyKeyword(text, HIGH_RISK_KEYWORDS)) {
    signals.push('high_risk_keywords');
  }
  if (containsAnyKeyword(topic, HIGH_RISK_TOPICS)) {
    signals.push('high_risk_topic');
  }
  if (input.imageUrl && input.imageUrl.trim().length > 0) {
    signals.push('has_image');
  }
  if (OPINION_INDICATORS.some((pattern) => pattern.test(text))) {
    signals.push('opinion_marker');
  }
  if (text.split(/\s+/).filter(Boolean).length >= 25) {
    signals.push('long_text');
  }

  return signals;
};

const runPreCheck = async (content: { id: string; authorId: string; text?: string; topic?: string; imageUrl?: string }) => {
  const hasText = content.text?.trim() && content.text.trim().length > 0;
  const hasImage = content.imageUrl && content.imageUrl.trim().length > 0;

  if (!hasText && !hasImage) {
    return {
      needsFactCheck: false,
      confidence: 1.0,
      reasoning: 'No content to analyze',
      contentType: 'other',
      riskScore: 0,
    } as PreCheckResult;
  }

  const riskScore = calculateContentRiskScore({
    text: content.text,
    topic: content.topic,
    semanticTopics: [],
    entities: [],
    imageUrl: content.imageUrl,
  });

  if (!BaseAgent.isAvailable()) {
    return fallbackPreCheck(content.text || '', content.imageUrl);
  }

  const agent = new BaseAgent('gpt-4o-mini');
  const signals = detectSignals({
    text: content.text,
    topic: content.topic,
    imageUrl: content.imageUrl,
  });

  let prompt = `Content ID: ${content.id}
Author: ${content.authorId}`;
  if (content.topic) prompt += `\nTopic: ${content.topic}`;
  if (signals.length > 0) {
    prompt += `\nSignals: ${signals.join(', ')}`;
  }
  if (hasText) {
    prompt += `\n\nText:\n"""\n${content.text}\n"""`;
  }

  prompt += `\n\nAnalyze and decide yes/no for fact-checking per the system rules.`;

  try {
    let response: any;
    if (hasImage) {
      response = await agent.generateJSONWithVision(prompt, content.imageUrl || null, SYSTEM_PROMPT, PRECHECK_RESPONSE_SCHEMA);
    } else {
      response = await agent.generateJSON(prompt, SYSTEM_PROMPT, PRECHECK_RESPONSE_SCHEMA);
    }

    const result: PreCheckResult = {
      needsFactCheck: Boolean(response.needsFactCheck),
      confidence: clamp01(Number(response.confidence) || 0.5),
      reasoning: String(response.reasoning || 'Agent decision'),
      contentType: (response.contentType as PreCheckResult['contentType']) || 'other',
      riskScore,
    };
    return result;
  } catch (error) {
    logger.error('[FactCheckPreCheck] AI pre-check failed, using fallback', error);
    return { ...fallbackPreCheck(content.text || '', content.imageUrl), riskScore };
  }
};

export async function preCheckChirp(chirp: Chirp): Promise<PreCheckResult> {
  return runPreCheck({
    id: chirp.id,
    authorId: chirp.authorId,
    text: chirp.text,
    topic: typeof chirp.topic === 'string' ? chirp.topic : '',
    imageUrl: chirp.imageUrl,
  });
}

export async function preCheckComment(comment: Comment): Promise<PreCheckResult> {
  return runPreCheck({
    id: comment.id,
    authorId: comment.authorId,
    text: comment.text,
    topic: undefined,
    imageUrl: comment.imageUrl,
  });
}

export async function preCheckText(text: string, imageUrl?: string): Promise<PreCheckResult> {
  return runPreCheck({
    id: 'text',
    authorId: 'system',
    text,
    imageUrl,
  });
}
