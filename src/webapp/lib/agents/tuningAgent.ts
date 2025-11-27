// Algorithm Tuning Agent - Learns optimal algorithm weights for users
import BaseAgent, { type AgentResponse } from './baseAgent';
import type { ForYouConfig, FollowingWeight, Chirp, User } from '../../types';

export interface TuningSuggestion {
  followingWeight: FollowingWeight;
  boostActiveConversations: boolean;
  likedTopics: string[];
  mutedTopics: string[];
  explanation: string;
  confidence: number; // 0-1, how confident the agent is in these suggestions
}

interface UserBehaviorData {
  chirpsViewed: Chirp[];
  chirpsEngaged: Chirp[]; // chirps with comments/likes
  followingList: string[];
  currentConfig: ForYouConfig;
  topicEngagement: Record<string, number>; // Engagement score per topic
}

const normalizeBehaviorTopic = (topic?: string): string | null => {
  if (!topic) return null;
  const normalized = topic.trim().toLowerCase();
  return normalized || null;
};

const buildTopicEngagementMap = (chirps: Chirp[]): Record<string, number> => {
  const counts: Record<string, number> = {};
  const addTopic = (topic?: string) => {
    const normalized = normalizeBehaviorTopic(topic);
    if (!normalized) return;
    counts[normalized] = (counts[normalized] || 0) + 1;
  };

  chirps.forEach((chirp) => {
    addTopic(chirp.topic);
    chirp.semanticTopics?.forEach(addTopic);
  });

  return counts;
};

const SYSTEM_INSTRUCTION = `You are an expert recommendation algorithm analyst. Your job is to analyze user behavior and suggest optimal feed algorithm settings.

Given a user's behavior data:
- Which chirps they viewed
- Which chirps they engaged with (commented, liked)
- Who they follow
- Their current algorithm configuration
- Their engagement patterns by topic

Suggest improvements to:
- followingWeight: How much to boost posts from followed users (none, light, medium, heavy)
- boostActiveConversations: Whether to boost posts with active discussions
- likedTopics: Topics the user seems interested in (based on engagement)
- mutedTopics: Topics the user seems disinterested in

Be conservative with changes - only suggest changes when you're confident based on clear patterns.
Provide a confidence score (0-1) indicating how certain you are in these suggestions.

Respond with JSON containing:
- followingWeight: "none" | "light" | "medium" | "heavy"
- boostActiveConversations: boolean
- likedTopics: array of topic strings
- mutedTopics: array of topic strings
- explanation: Brief explanation of the suggestions
- confidence: number between 0 and 1`;

export class TuningAgent {
  private agent: BaseAgent;

  constructor() {
    if (!BaseAgent.isAvailable()) {
      throw new Error('OpenAI API is not configured');
    }
    // Use default model (gpt-4o-mini)
    this.agent = new BaseAgent();
  }

  /**
   * Analyze user behavior and suggest optimal algorithm tuning
   */
  async suggestTuning(
    behaviorData: UserBehaviorData
  ): Promise<AgentResponse<TuningSuggestion>> {
    try {
      // Calculate engagement metrics
      const topicEngagement = buildTopicEngagementMap(behaviorData.chirpsEngaged);
      const totalEngagement = behaviorData.chirpsEngaged.length;

      // Calculate following engagement rate
      const followingChirps = behaviorData.chirpsEngaged.filter(c => 
        behaviorData.followingList.includes(c.authorId)
      );
      const followingEngagementRate = behaviorData.chirpsEngaged.length > 0
        ? followingChirps.length / behaviorData.chirpsEngaged.length
        : 0;

      // Calculate active conversation engagement
      const activeChirps = behaviorData.chirpsEngaged.filter(c => c.commentCount > 0);
      const activeConversationRate = behaviorData.chirpsEngaged.length > 0
        ? activeChirps.length / behaviorData.chirpsEngaged.length
        : 0;

      const prompt = `Analyze this user's behavior and suggest optimal feed algorithm settings:

User Behavior:
- Total chirps viewed: ${behaviorData.chirpsViewed.length}
- Chirps engaged with: ${behaviorData.chirpsEngaged.length}
- Following count: ${behaviorData.followingList.length}
- Following engagement rate: ${(followingEngagementRate * 100).toFixed(1)}%
- Active conversation engagement rate: ${(activeConversationRate * 100).toFixed(1)}%

Topic Engagement:
${Object.entries(topicEngagement)
  .map(([topic, count]) => `- #${topic}: ${count} engagements (${((count / totalEngagement) * 100).toFixed(1)}%)`)
  .join('\n')}

Current Configuration:
- Following weight: ${behaviorData.currentConfig.followingWeight}
- Boost active conversations: ${behaviorData.currentConfig.boostActiveConversations}
- Liked topics: ${behaviorData.currentConfig.likedTopics.join(', ') || 'None'}
- Muted topics: ${behaviorData.currentConfig.mutedTopics.join(', ') || 'None'}

Suggest improvements based on clear behavioral patterns. Only suggest changes if there's strong evidence.`;

      const result = await this.agent.generateJSON<TuningSuggestion>(
        prompt,
        SYSTEM_INSTRUCTION,
        {
          type: 'object',
          properties: {
            followingWeight: {
              type: 'string',
              enum: ['none', 'light', 'medium', 'heavy'],
            },
            boostActiveConversations: { type: 'boolean' },
            likedTopics: {
              type: 'array',
              items: { type: 'string' },
            },
            mutedTopics: {
              type: 'array',
              items: { type: 'string' },
            },
            explanation: { type: 'string' },
            confidence: { type: 'number', minimum: 0, maximum: 1 },
          },
          required: ['followingWeight', 'boostActiveConversations', 'likedTopics', 'mutedTopics', 'explanation', 'confidence'],
        }
      );

      // Validate and clamp confidence
      result.confidence = Math.max(0, Math.min(1, result.confidence || 0.5));

      // Only return suggestions if confidence is reasonable
      if (result.confidence < 0.3) {
        return {
          success: false,
          error: 'Confidence too low to make recommendations',
          data: result,
        };
      }

      return {
        success: true,
        data: result,
      };
    } catch (error: any) {
      console.error('TuningAgent error:', error);
      return {
        success: false,
        error: error.message || 'Failed to generate tuning suggestions',
      };
    }
  }

  /**
   * Collect behavior data for a user
   */
  static collectBehaviorData(
    user: User,
    allChirps: Chirp[],
    viewedChirpIds: string[],
    engagedChirpIds: string[],
    currentConfig: ForYouConfig
  ): UserBehaviorData {
    const chirpsViewed = allChirps.filter(c => viewedChirpIds.includes(c.id));
    const chirpsEngaged = allChirps.filter(c => engagedChirpIds.includes(c.id));
    
    const topicEngagement = buildTopicEngagementMap(chirpsEngaged);

    return {
      chirpsViewed,
      chirpsEngaged,
      followingList: user.following,
      currentConfig,
      topicEngagement,
    };
  }
}

// Export singleton instance
let tuningAgentInstance: TuningAgent | null = null;

export const getTuningAgent = (): TuningAgent | null => {
  if (!BaseAgent.isAvailable()) {
    return null;
  }
  
  if (!tuningAgentInstance) {
    try {
      tuningAgentInstance = new TuningAgent();
    } catch (error) {
      console.error('Failed to initialize TuningAgent:', error);
      return null;
    }
  }
  
  return tuningAgentInstance;
};

