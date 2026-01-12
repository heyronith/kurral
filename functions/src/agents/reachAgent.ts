import BaseAgent from './baseAgent';

export interface ContentAnalysis {
  semanticTopics: string[];
  entities: string[];
  intent: string;
  suggestedBucket: string;
}

const LEGACY_TOPIC_KEYWORDS: Record<string, string[]> = {
  dev: ['dev', 'code', 'coding', 'software', 'engineer', 'react', 'javascript', 'typescript', 'programming', 'frontend', 'backend'],
  startups: ['startup', 'founder', 'pitch', 'vc', 'venture', 'funding', 'saas', 'growth'],
  music: ['music', 'song', 'album', 'guitar', 'piano', 'concert', 'dj', 'lyrics'],
  sports: ['sport', 'game', 'match', 'nba', 'nfl', 'goal', 'team', 'league', 'player'],
  productivity: ['productivity', 'focus', 'workflow', 'routine', 'habit', 'deep work'],
  design: ['design', 'ui', 'ux', 'interface', 'figma', 'prototype', 'visual'],
  politics: ['politics', 'election', 'policy', 'government', 'senate', 'president'],
  crypto: ['crypto', 'blockchain', 'bitcoin', 'ethereum', 'defi', 'nft'],
  news: ['news', 'breaking', 'update', 'report', 'announcement', 'alert'],
  business: ['business', 'economy', 'market', 'stock', 'finance', 'bank', 'corporate'],
  technology: ['technology', 'tech', 'ai', 'artificial intelligence', 'software', 'startup', 'innovation'],
  science: ['science', 'research', 'study', 'discovery', 'space', 'climate', 'environment'],
  health: ['health', 'medical', 'disease', 'treatment', 'hospital', 'medicine', 'wellness'],
  entertainment: ['entertainment', 'movie', 'film', 'tv', 'show', 'celebrity', 'hollywood'],
};

const inferLegacyTopicFromText = (text: string): string => {
  const lower = text.toLowerCase();
  for (const [topic, keywords] of Object.entries(LEGACY_TOPIC_KEYWORDS)) {
    if (keywords.some((keyword) => lower.includes(keyword))) {
      return topic;
    }
  }
  return 'news';
};

const extractFallbackTopics = (text: string, limit: number = 6): string[] => {
  const tokens = text.toLowerCase().match(/[a-z0-9#]{3,}/g) || [];
  const unique = Array.from(new Set(tokens));
  return unique.slice(0, limit);
};

const detectIntentFromText = (text: string): string => {
  const lower = text.toLowerCase();
  if (lower.includes('?')) return 'question';
  if (lower.includes('announcing') || lower.includes('launch') || lower.includes('release')) return 'announcement';
  if (lower.includes('learned') || lower.includes('tutorial') || lower.includes('guide')) return 'tutorial';
  if (lower.includes('opinion') || lower.includes('i think')) return 'opinion';
  return 'update';
};

const buildContentAnalysisInstruction = (
  availableTopicNames: string[],
  availableTopicDetails: string
): string => {
  const normalizedList = availableTopicNames.length > 0
    ? availableTopicNames.map((name) => `#${name}`).join(', ')
    : 'None';
  const detailsSection = availableTopicDetails
    ? `Available topic context:\n${availableTopicDetails}\n`
    : '';

  return `You are a semantic classification expert. Analyze the post text and extract:
1. semanticTopics: Array of 3-8 concise keywords/phrases that reflect the content's subject (lowercase, no punctuation)
2. entities: Names of products, technologies, people, or companies mentioned (original casing)
3. intent: One of [question, announcement, tutorial, opinion, update, discussion]
4. suggestedBucket: Best matching topic bucket from [${normalizedList}] OR propose a new bucket name when no existing bucket clearly fits.

Guidance:
- Favor existing buckets when they match the content. Consider this pool first: ${normalizedList}.
${detailsSection}- When no existing bucket covers the concept, you may create a new meaningful bucket. Keep bucket names lowercase, descriptive, alphanumeric/hyphen, 2-50 chars, no punctuation.
- Posts can belong to multiple tags—include every relevant tag in the semanticTopics array (up to 8 entries).
- Only return tags/buckets that are clearly reflected in the text; avoid inventing unrelated or vague tags.

Respond ONLY with JSON matching the schema.`;
};

const CONTENT_ANALYSIS_SCHEMA = {
  type: 'object',
  properties: {
    semanticTopics: {
      type: 'array',
      items: { type: 'string' },
      minItems: 3,
      maxItems: 8,
    },
    entities: {
      type: 'array',
      items: { type: 'string' },
    },
    intent: { type: 'string' },
    suggestedBucket: { type: 'string' },
  },
  required: ['semanticTopics', 'entities', 'intent', 'suggestedBucket'],
};

export class ReachAgent {
  private agent: BaseAgent;

  constructor() {
    if (!BaseAgent.isAvailable()) {
      throw new Error('OpenAI API is not configured');
    }
    this.agent = new BaseAgent();
  }

  async analyzePostContent(
    text: string,
    availableTopics: Array<{ name: string; postsLast48h?: number; totalUsers?: number }> = [],
    existingBuckets: string[] = []
  ): Promise<ContentAnalysis> {
    const trimmed = text.trim();
    if (!trimmed) {
      return {
        semanticTopics: [],
        entities: [],
        intent: 'update',
        suggestedBucket: 'news',
      };
    }

    const fallback: ContentAnalysis = {
      semanticTopics: extractFallbackTopics(trimmed),
      entities: [],
      intent: detectIntentFromText(trimmed),
      suggestedBucket: inferLegacyTopicFromText(trimmed),
    };

    const availableTopicNames = Array.from(
      new Set(
        availableTopics
          .map((topic) => topic?.name?.toLowerCase() || '')
          .filter((name): name is string => Boolean(name))
      )
    );

    const availableTopicDetails = availableTopics.length
      ? availableTopics
          .map(
            (topic) =>
              `#${topic.name} (${topic.postsLast48h || 0} posts last 48h, ${topic.totalUsers || 0} users)`
          )
          .join('\n')
      : '';

    const bucketsForAI = existingBuckets.length > 0 ? existingBuckets : availableTopicNames;

    try {
      const result = await this.agent.generateJSON<ContentAnalysis>(
        `Post text: """${trimmed}"""`,
        buildContentAnalysisInstruction(bucketsForAI, availableTopicDetails),
        CONTENT_ANALYSIS_SCHEMA
      );

      const normalizedTopics = (result.semanticTopics || [])
        .map((topic) => topic.trim().toLowerCase())
        .filter((topic, index, arr) => topic && arr.indexOf(topic) === index);

      const normalizedEntities = (result.entities || [])
        .map((entity) => entity.trim())
        .filter((entity, index, arr) => entity && arr.indexOf(entity) === index);

      return {
        semanticTopics: normalizedTopics.length > 0 ? normalizedTopics : fallback.semanticTopics,
        entities: normalizedEntities,
        intent: result.intent || fallback.intent,
        suggestedBucket: result.suggestedBucket || fallback.suggestedBucket,
      };
    } catch (error) {
      console.warn('[ReachAgent] Falling back to heuristic content analysis:', error);
      return fallback;
    }
  }
}

let reachAgentInstance: ReachAgent | null = null;

export const getReachAgent = (): ReachAgent | null => {
  try {
    if (!BaseAgent.isAvailable()) {
      return null;
    }
    if (!reachAgentInstance) {
      reachAgentInstance = new ReachAgent();
    }
    return reachAgentInstance;
  } catch (error) {
    console.warn('[ReachAgent] Agent not available:', error);
    return null;
  }
};

