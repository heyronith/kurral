// Reach Suggestion Agent - Suggests optimal reach settings and topics for chirps
import BaseAgent, { type AgentResponse } from './baseAgent';
import type { TunedAudience, Topic, TopicMetadata } from '../../types';

const LEGACY_TOPIC_KEYWORDS: Record<Topic, string[]> = {
  dev: ['dev', 'code', 'coding', 'software', 'engineer', 'react', 'javascript', 'typescript', 'programming', 'frontend', 'backend'],
  startups: ['startup', 'founder', 'pitch', 'vc', 'venture', 'funding', 'saas', 'growth'],
  music: ['music', 'song', 'album', 'guitar', 'piano', 'concert', 'dj', 'lyrics'],
  sports: ['sport', 'game', 'match', 'nba', 'nfl', 'goal', 'team', 'league', 'player'],
  productivity: ['productivity', 'focus', 'workflow', 'routine', 'habit', 'deep work'],
  design: ['design', 'ui', 'ux', 'interface', 'figma', 'prototype', 'visual'],
  politics: ['politics', 'election', 'policy', 'government', 'senate', 'president'],
  crypto: ['crypto', 'blockchain', 'bitcoin', 'ethereum', 'defi', 'nft'],
};

const inferLegacyTopicFromText = (text: string): Topic => {
  const lower = text.toLowerCase();
  for (const [topic, keywords] of Object.entries(LEGACY_TOPIC_KEYWORDS) as [Topic, string[]][]) {
    if (keywords.some((keyword) => lower.includes(keyword))) {
      return topic;
    }
  }
  return 'dev';
};

const extractFallbackTopics = (text: string, limit: number = 6): string[] => {
  const tokens =
    text
      .toLowerCase()
      .match(/[a-z0-9#]{3,}/g) || [];
  const unique = Array.from(new Set(tokens));
  return unique.slice(0, limit);
};

const detectIntentFromText = (text: string): string => {
  const lower = text.toLowerCase();
  if (lower.includes('?')) {
    return 'question';
  }
  if (lower.includes('announcing') || lower.includes('launch') || lower.includes('release')) {
    return 'announcement';
  }
  if (lower.includes('learned') || lower.includes('tutorial')) {
    return 'tutorial';
  }
  if (lower.includes('opinion') || lower.includes('i think')) {
    return 'opinion';
  }
  return 'update';
};

export interface TopicSuggestion {
  topic: string;
  confidence: number; // 0-1, how confident the AI is in this suggestion
  explanation: string;
  isUserTopic: boolean; // Whether this topic is from user's profile
}

export interface ReachSuggestion {
  suggestedTopics: TopicSuggestion[]; // Max 3 topics, ranked by relevance
  tunedAudience: TunedAudience;
  explanation: string;
  overallExplanation: string; // Overall explanation for all suggestions
}

export interface ContentAnalysis {
  semanticTopics: string[];
  entities: string[];
  intent: string;
  suggestedLegacyTopic: Topic;
}

const SYSTEM_INSTRUCTION = `You are an expert social media advisor. Your job is to analyze chirp content and suggest:
1. The best matching topic/hashtag (from a provided list)
2. Optimal audience reach settings

Given a chirp's text	content and a list of available topics with engagement data, you should:
1. Suggest 1-3 most relevant topics ranked by how well they match the content (max 3)
2. Suggest reach configuration:
   - allowFollowers: Should followers see this?
   - allowNonFollowers: Should non-followers see this?

Topic Selection Guidelines:
- Suggest topics that genuinely match the content
- User's profile topics should be considered if they match well, but don't force them if they don't fit
- Prioritize topics with higher engagement (more active communities)
- Only suggest topics that are clearly relevant to the content

Reach Settings Guidelines:
- Personal/private content → Followers only
- Discussion questions → Open to followers + non-followers
- Public announcements → Open to all
- Content intent and tone

Respond with a JSON object containing:
- suggestedTopics: Array of 1-3 topic suggestions, each with { topic: string, confidence: number 0-1, explanation: string, isUserTopic: boolean }
- tunedAudience: { allowFollowers: boolean, allowNonFollowers: boolean }
- explanation: Brief explanation for the reach settings
- overallExplanation: Overall explanation for all suggestions (topic + reach)`;

const buildContentAnalysisInstruction = (
  availableTopicNames: string[],
  availableTopicDetails: string
): string => {
  const normalizedList =
    availableTopicNames.length > 0
      ? availableTopicNames.map((name) => `#${name}`).join(', ')
      : 'None';
  const detailsSection = availableTopicDetails
    ? `Available topic context:\n${availableTopicDetails}\n`
    : '';

  return `You are a semantic classification expert. Analyze the post text and extract:
1. semanticTopics: Array of 3-8 concise keywords/phrases that reflect the content's subject (lowercase, no punctuation)
2. entities: Names of products, technologies, people, or companies mentioned (original casing)
3. intent: One of [question, announcement, tutorial, opinion, update, discussion]
4. suggestedLegacyTopic: Best matching legacy topic from [dev, startups, music, sports, productivity, design, politics, crypto]

Guidance:
- Favor existing tags when they match the content. Consider this pool first: ${normalizedList}.
${detailsSection}- When no existing tag covers the concept, you may create a new meaningful tag. Keep new tags lowercase, descriptive, and without punctuation.
- Posts can belong to multiple tags—include every relevant tag in the semanticTopics array (up to 8 entries).
- Only return tags that are clearly reflected in the text; avoid inventing unrelated or vague tags.

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
    suggestedLegacyTopic: {
      type: 'string',
      enum: ['dev', 'startups', 'music', 'sports', 'productivity', 'design', 'politics', 'crypto'],
    },
  },
  required: ['semanticTopics', 'entities', 'intent', 'suggestedLegacyTopic'],
};
export class ReachAgent {
  private agent: BaseAgent;

  constructor() {
    if (!BaseAgent.isAvailable()) {
      throw new Error('OpenAI API is not configured');
    }
    // Use default model (gpt-4o-mini)
    this.agent = new BaseAgent();
  }

  /**
   * Suggest topics and reach settings for a chirp based on content
   * @param text - Chirp content
   * @param availableTopics - List of available topics with engagement data (top 30 + user's topics)
   * @param userTopics - User's profile topics (for marking isUserTopic flag)
   */
  async suggestTopicsAndReach(
    text: string,
    availableTopics: TopicMetadata[],
    userTopics: string[]
  ): Promise<AgentResponse<ReachSuggestion>> {
    try {
      console.log('[ReachAgent] Starting AI suggestion for:', { 
        text: text.substring(0, 50) + '...', 
        availableTopicsCount: availableTopics.length,
        userTopics: userTopics
      });
      
      // Format topics list for AI
      const userTopicsSet = new Set(userTopics.map(t => t.toLowerCase()));
      const topicsList = availableTopics
        .map(topic => {
          const isUserTopic = userTopicsSet.has(topic.name.toLowerCase());
          return `${isUserTopic ? '[YOUR TOPIC] ' : ''}#${topic.name} (${topic.postsLast48h} posts in last 48h, ${topic.totalUsers} users)`;
        })
        .join('\n');

      const prompt = `Analyze this chirp content and suggest:

1. The best 1-3 matching topics/hashtags from this list (ranked by relevance):
${topicsList}

2. Optimal reach settings for the best matching topic.

Chirp content: "${text}"

User's profile topics: ${userTopics.length > 0 ? userTopics.map(t => `#${t}`).join(', ') : 'None'}

Consider:
- Topic relevance to content (most important)
- Topic engagement (active communities are better)
- User's profile topics (consider them if they match, but don't force if they don't fit)
- Content intent and target audience`;

      const result = await this.agent.generateJSON<ReachSuggestion>(
        prompt,
        SYSTEM_INSTRUCTION,
        {
          type: 'object',
          properties: {
            suggestedTopics: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  topic: { type: 'string' },
                  confidence: { type: 'number', minimum: 0, maximum: 1 },
                  explanation: { type: 'string' },
                  isUserTopic: { type: 'boolean' },
                },
                required: ['topic', 'confidence', 'explanation', 'isUserTopic'],
              },
              minItems: 1,
              maxItems: 3,
            },
            tunedAudience: {
              type: 'object',
              properties: {
                allowFollowers: { type: 'boolean' },
                allowNonFollowers: { type: 'boolean' },
              },
              required: ['allowFollowers', 'allowNonFollowers'],
            },
            explanation: { type: 'string' },
            overallExplanation: { type: 'string' },
          },
          required: ['suggestedTopics', 'tunedAudience', 'explanation', 'overallExplanation'],
        }
      );

      console.log('[ReachAgent] AI suggestion received:', result);

      // Validate and ensure at least one topic is suggested
      if (!result.suggestedTopics || result.suggestedTopics.length === 0) {
        throw new Error('No topics suggested');
      }

      // Limit to max 3 topics
      if (result.suggestedTopics.length > 3) {
        result.suggestedTopics = result.suggestedTopics.slice(0, 3);
      }

      // Validate and set isUserTopic flag correctly
      const userTopicsSetLower = new Set(userTopics.map(t => t.toLowerCase()));
      result.suggestedTopics = result.suggestedTopics.map(suggestion => ({
        ...suggestion,
        topic: suggestion.topic.replace('#', '').trim().toLowerCase(),
        isUserTopic: userTopicsSetLower.has(suggestion.topic.replace('#', '').trim().toLowerCase()),
        confidence: Math.max(0, Math.min(1, suggestion.confidence || 0.5)),
      }));

      // Sort by confidence descending
      result.suggestedTopics.sort((a, b) => b.confidence - a.confidence);

      // Validate and ensure at least one audience is enabled
      if (!result.tunedAudience.allowFollowers && !result.tunedAudience.allowNonFollowers) {
        result.tunedAudience.allowFollowers = true;
        result.explanation = 'Suggested followers-only reach to ensure your post is seen.';
      }

      // Ensure overallExplanation exists
      if (!result.overallExplanation) {
        result.overallExplanation = result.explanation || 'AI suggested these settings for optimal engagement.';
      }

      return {
        success: true,
        data: result,
      };
    } catch (error: any) {
      console.error('[ReachAgent] Error generating suggestion:', error);
      console.error('[ReachAgent] Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });
      
      // Fallback: pick top topic by engagement and use defaults
      const topTopic = availableTopics.length > 0 ? availableTopics[0] : null;
      const fallback: ReachSuggestion = {
        suggestedTopics: topTopic ? [{
          topic: topTopic.name,
          confidence: 0.5,
          explanation: 'Suggesting most active topic as fallback.',
          isUserTopic: userTopics.includes(topTopic.name),
        }] : [],
        tunedAudience: {
          allowFollowers: true,
          allowNonFollowers: true,
        },
        explanation: 'Using default settings.',
        overallExplanation: 'Using default settings as fallback.',
      };

      return {
        success: false,
        error: error.message || 'Failed to generate suggestion',
        fallback,
      };
    }
  }

  async analyzePostContent(
    text: string,
    availableTopics: TopicMetadata[] = []
  ): Promise<ContentAnalysis> {
    const trimmed = text.trim();
    if (!trimmed) {
      return {
        semanticTopics: [],
        entities: [],
        intent: 'update',
        suggestedLegacyTopic: 'dev',
      };
    }

    const fallback: ContentAnalysis = {
      semanticTopics: extractFallbackTopics(trimmed),
      entities: [],
      intent: detectIntentFromText(trimmed),
      suggestedLegacyTopic: inferLegacyTopicFromText(trimmed),
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
              `#${topic.name} (${topic.postsLast48h} posts last 48h, ${topic.totalUsers} users)`
          )
          .join('\n')
      : '';

    try {
      const result = await this.agent.generateJSON<ContentAnalysis>(
        `Post text: """${trimmed}"""`,
        buildContentAnalysisInstruction(availableTopicNames, availableTopicDetails),
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
        suggestedLegacyTopic: (result.suggestedLegacyTopic as Topic) || fallback.suggestedLegacyTopic,
      };
    } catch (error) {
      console.warn('[ReachAgent] Falling back to heuristic content analysis:', error);
      return fallback;
    }
  }

  /**
   * Legacy method for backward compatibility (suggest reach settings given a topic)
   */
  async suggestReachSettings(
    text: string,
    topic: Topic,
    userTopics?: string[]
  ): Promise<AgentResponse<Omit<ReachSuggestion, 'suggestedTopics'> & { topic: Topic }>> {
    try {
      // For backward compatibility, just suggest reach settings for given topic
      const lowerText = text.toLowerCase();
      
      const isDiscussionPrompt = 
        lowerText.includes('?') ||
        lowerText.includes('what do you think') ||
        lowerText.includes('thoughts') ||
        lowerText.includes('opinions') ||
        lowerText.includes('discuss');

      const isPersonal = 
        lowerText.includes('i feel') ||
        lowerText.includes('my experience') ||
        lowerText.includes('personal') ||
        lowerText.includes('private');

      const isPublic = 
        lowerText.includes('announcing') ||
        lowerText.includes('launch') ||
        lowerText.includes('release') ||
        lowerText.includes('public');

      let tunedAudience: TunedAudience;
      let explanation: string;

      if (isDiscussionPrompt) {
        tunedAudience = {
          allowFollowers: true,
          allowNonFollowers: true,
        };
        explanation = 'This looks like a discussion prompt. Opening to followers and non-followers.';
      } else if (isPersonal) {
        tunedAudience = {
          allowFollowers: true,
          allowNonFollowers: false,
        };
        explanation = 'This seems personal. Suggesting followers-only reach for a more intimate audience.';
      } else if (isPublic) {
        tunedAudience = {
          allowFollowers: true,
          allowNonFollowers: true,
        };
        explanation = 'This appears to be a public announcement. Suggesting open reach to maximize visibility.';
      } else {
        const topicDefaults: Record<Topic, TunedAudience> = {
          dev: { allowFollowers: true, allowNonFollowers: true },
          startups: { allowFollowers: true, allowNonFollowers: true },
          music: { allowFollowers: true, allowNonFollowers: false },
          sports: { allowFollowers: true, allowNonFollowers: true },
          productivity: { allowFollowers: true, allowNonFollowers: false },
          design: { allowFollowers: true, allowNonFollowers: true },
          politics: { allowFollowers: true, allowNonFollowers: false },
          crypto: { allowFollowers: true, allowNonFollowers: true },
        };
        tunedAudience = topicDefaults[topic];
        explanation = `Based on the #${topic} topic, suggesting this reach configuration for optimal engagement.`;
      }

      return {
        success: true,
        data: {
          topic,
          tunedAudience,
          explanation,
          overallExplanation: explanation, // Add overallExplanation for compatibility
        },
      };
    } catch (error: any) {
      console.error('[ReachAgent] Error in legacy suggestReachSettings:', error);
      return {
        success: false,
        error: error.message || 'Failed to generate suggestion',
      };
    }
  }
}

// Export singleton instance
let reachAgentInstance: ReachAgent | null = null;

export const getReachAgent = (): ReachAgent | null => {
  if (!BaseAgent.isAvailable()) {
    return null;
  }
  
  if (!reachAgentInstance) {
    try {
      reachAgentInstance = new ReachAgent();
    } catch (error) {
      console.error('Failed to initialize ReachAgent:', error);
      return null;
    }
  }
  
  return reachAgentInstance;
};

// Fallback function for when AI is not available (legacy format - topic already selected)
export const suggestReachSettingsFallback = (
  text: string,
  topic: Topic
): { tunedAudience: TunedAudience; explanation: string } => {
  const lowerText = text.toLowerCase();
  
  const isDiscussionPrompt = 
    lowerText.includes('?') ||
    lowerText.includes('what do you think') ||
    lowerText.includes('thoughts') ||
    lowerText.includes('opinions') ||
    lowerText.includes('discuss');

  const isPersonal = 
    lowerText.includes('i feel') ||
    lowerText.includes('my experience') ||
    lowerText.includes('personal') ||
    lowerText.includes('private');

  const isPublic = 
    lowerText.includes('announcing') ||
    lowerText.includes('launch') ||
    lowerText.includes('release') ||
    lowerText.includes('public');

  if (isDiscussionPrompt) {
    return {
      tunedAudience: {
        allowFollowers: true,
        allowNonFollowers: true,
      },
      explanation: 'This looks like a discussion prompt. Opening to followers and non-followers.',
    };
  } else if (isPersonal) {
    return {
      tunedAudience: {
        allowFollowers: true,
        allowNonFollowers: false,
      },
      explanation: 'This seems personal. Suggesting followers-only reach for a more intimate audience.',
    };
  } else if (isPublic) {
    return {
      tunedAudience: {
        allowFollowers: true,
        allowNonFollowers: true,
      },
      explanation: 'This appears to be a public announcement. Suggesting open reach to maximize visibility.',
    };
  } else {
    const topicDefaults: Record<Topic, TunedAudience> = {
      dev: { allowFollowers: true, allowNonFollowers: true },
      startups: { allowFollowers: true, allowNonFollowers: true },
      music: { allowFollowers: true, allowNonFollowers: false },
      sports: { allowFollowers: true, allowNonFollowers: true },
      productivity: { allowFollowers: true, allowNonFollowers: false },
      design: { allowFollowers: true, allowNonFollowers: true },
      politics: { allowFollowers: true, allowNonFollowers: false },
      crypto: { allowFollowers: true, allowNonFollowers: true },
    };

    return {
      tunedAudience: topicDefaults[topic],
      explanation: `Based on the #${topic} topic, suggesting this reach configuration for optimal engagement.`,
    };
  }
};

