import BaseAgent from '../agents/baseAgent';
import type { ForYouConfig, Topic, FollowingWeight } from '../../types';
import { ALL_TOPICS } from '../../types';

const SYSTEM_INSTRUCTION = `You are a helpful feed tuning assistant. Interpret the user's short instruction about how their "For You" feed should behave and translate that into a valid config object.

IMPORTANT: Always provide a clear, user-friendly explanation in the "explanation" field that describes what changes you made and why. The explanation should be 1-2 sentences and written in plain language.

CRITICAL: Always extract semantic interests from the user's instruction. If they mention topics, subjects, technologies, or content types (e.g., "react", "AI", "startup funding", "design tutorials"), add them to interestsToAdd as lowercase keywords. If they say they want less of something or to avoid something, add it to interestsToRemove.

Example explanations:
- "Boosted posts from people you follow and prioritized active discussions. Added interests: react, ai research"
- "Set to discovery mode with no following boost, focusing on new voices. Added interests: design, ui ux"
- "Added #design to liked topics and muted #politics. Added interests: design tutorials. Removed interests: politics"
- "No changes needed - your current settings already match this preference"

Interests Extraction:
- Extract ALL topic-related keywords mentioned in the instruction (technologies, subjects, content types)
- Convert to lowercase, remove punctuation
- Examples: "react tutorials" → ["react", "tutorials"], "AI research" → ["ai", "research"], "startup funding" → ["startup", "funding"]
- If user says "less politics" or "avoid crypto", add to interestsToRemove

If the instruction is unclear or the current config already matches the request, explain that in the explanation field.`;

const INSTRUCTION_SCHEMA = {
  type: 'object',
  properties: {
    newConfig: {
      type: 'object',
      properties: {
        followingWeight: { type: 'string', enum: ['none', 'light', 'medium', 'heavy'] },
        boostActiveConversations: { type: 'boolean' },
        likedTopics: {
          type: 'array',
          items: { type: 'string' },
        },
        mutedTopics: {
          type: 'array',
          items: { type: 'string' },
        },
      },
      required: ['followingWeight', 'boostActiveConversations', 'likedTopics', 'mutedTopics'],
    },
    explanation: { type: 'string' },
    interestsToAdd: {
      type: 'array',
      items: { type: 'string' },
    },
    interestsToRemove: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: ['newConfig', 'explanation'],
};

const normalizeInstructionTopic = (topic?: string): string | null => {
  if (!topic) {
    return null;
  }
  const normalized = topic.replace(/#/g, '').trim().toLowerCase();
  return normalized || null;
};

const sanitizeInstructionTopics = (topics: string[] = []): string[] => {
  const seen = new Set<string>();
  topics.forEach((topic) => {
    const normalized = normalizeInstructionTopic(topic);
    if (normalized) {
      seen.add(normalized);
    }
  });
  return Array.from(seen);
};

export interface InstructionInterpretation {
  newConfig: ForYouConfig;
  explanation: string;
  interestsToAdd?: string[];
  interestsToRemove?: string[];
}


export class InstructionService {
  private agent: BaseAgent;

  constructor() {
    if (!BaseAgent.isAvailable()) {
      throw new Error(
        'AI agent is not available. Please set VITE_OPENAI_API_KEY environment variable to use instruction interpretation.'
      );
    }
      this.agent = new BaseAgent();
  }

  async interpretInstruction(
    instruction: string,
    currentConfig: ForYouConfig,
    preferredTopics: Topic[],
    currentInterests: string[] = []
  ): Promise<InstructionInterpretation> {
    const trimmedInstruction = instruction.trim();
    if (!trimmedInstruction) {
      throw new Error('Please describe how you want the feed to behave.');
    }

    const topicPool = this.buildTopicPool(preferredTopics, currentInterests);

      try {
        const aiResponse = await this.callAiInterpreter(trimmedInstruction, currentConfig, topicPool, currentInterests);
        return this.normalizeAiResponse(aiResponse, currentConfig);
    } catch (error: any) {
      console.error('[InstructionService] AI agent failed:', error);
      throw new Error(
        error?.message || 'Failed to interpret instruction. Please check your OpenAI API key and try again.'
      );
    }
  }

  private async callAiInterpreter(
    instruction: string,
    currentConfig: ForYouConfig,
    topicPool: string[],
    currentInterests: string[] = []
  ): Promise<InstructionInterpretation> {
    const prompt = `User instruction: "${instruction}"

Current For You settings:
- Following weight: ${currentConfig.followingWeight}
- Boost active conversations: ${currentConfig.boostActiveConversations ? 'on' : 'off'}
- Liked topics: ${currentConfig.likedTopics.length > 0 ? currentConfig.likedTopics.map((topic) => `#${topic}`).join(', ') : 'none'}
- Muted topics: ${currentConfig.mutedTopics.length > 0 ? currentConfig.mutedTopics.map((topic) => `#${topic}`).join(', ') : 'none'}
- Current interests: ${currentInterests.length > 0 ? currentInterests.join(', ') : 'none'}

Available topics: ${topicPool.map((topic) => `#${topic}`).join(', ')}

IMPORTANT: Extract semantic interests from the instruction. If the user mentions topics, technologies, or content types, add them to interestsToAdd. If they want less of something, add to interestsToRemove.

Use the user's instruction to return a new For You configuration.`;

    return this.agent.generateJSON<InstructionInterpretation>(prompt, SYSTEM_INSTRUCTION, INSTRUCTION_SCHEMA);
  }

  private normalizeAiResponse(
    response: InstructionInterpretation,
    currentConfig: ForYouConfig
  ): InstructionInterpretation {
    const sanitizedLiked = this.sanitizeTopics(response.newConfig.likedTopics);
    const sanitizedMuted = this.sanitizeTopics(response.newConfig.mutedTopics);
    const resolved = this.resolveTopicConflicts(sanitizedLiked, sanitizedMuted);
    const normalizedConfig: ForYouConfig = {
      followingWeight: this.normalizeFollowingWeight(response.newConfig.followingWeight, currentConfig.followingWeight),
      boostActiveConversations: response.newConfig.boostActiveConversations ?? currentConfig.boostActiveConversations,
      likedTopics: this.sortTopics(resolved.liked),
      mutedTopics: this.sortTopics(resolved.muted),
    };

    // Generate explanation if AI didn't provide one or if it's empty
    let explanation = response.explanation.trim();
    if (!explanation) {
      explanation = this.generateExplanationFromChanges(currentConfig, normalizedConfig);
    }

    const sanitizedInterestsToAdd = this.sanitizeInterests(response.interestsToAdd || []);
    const sanitizedInterestsToRemove = this.sanitizeInterests(response.interestsToRemove || []);

    return {
      newConfig: normalizedConfig,
      explanation,
      interestsToAdd: sanitizedInterestsToAdd,
      interestsToRemove: sanitizedInterestsToRemove,
    };
  }

  private generateExplanationFromChanges(
    oldConfig: ForYouConfig,
    newConfig: ForYouConfig
  ): string {
    const changes: string[] = [];

    // Following weight changes
    if (oldConfig.followingWeight !== newConfig.followingWeight) {
      const weightLabels: Record<FollowingWeight, string> = {
        none: 'discovery mode (no following boost)',
        light: 'light following boost',
        medium: 'balanced following',
        heavy: 'prioritizing people you follow',
      };
      changes.push(`Set to ${weightLabels[newConfig.followingWeight]}`);
    }

    // Active conversations changes
    if (oldConfig.boostActiveConversations !== newConfig.boostActiveConversations) {
      changes.push(
        newConfig.boostActiveConversations
          ? 'enabled active conversation boost'
          : 'disabled active conversation boost'
      );
    }

    // Topic changes
    const addedLiked = newConfig.likedTopics.filter(t => !oldConfig.likedTopics.includes(t));
    const removedLiked = oldConfig.likedTopics.filter(t => !newConfig.likedTopics.includes(t));
    const addedMuted = newConfig.mutedTopics.filter(t => !oldConfig.mutedTopics.includes(t));
    const removedMuted = oldConfig.mutedTopics.filter(t => !newConfig.mutedTopics.includes(t));

    if (addedLiked.length > 0) {
      changes.push(`added ${addedLiked.map(t => `#${t}`).join(', ')} to liked topics`);
    }
    if (removedLiked.length > 0) {
      changes.push(`removed ${removedLiked.map(t => `#${t}`).join(', ')} from liked topics`);
    }
    if (addedMuted.length > 0) {
      changes.push(`muted ${addedMuted.map(t => `#${t}`).join(', ')}`);
    }
    if (removedMuted.length > 0) {
      changes.push(`unmuted ${removedMuted.map(t => `#${t}`).join(', ')}`);
    }

    if (changes.length === 0) {
      return 'No changes needed - your current settings already match this preference.';
    }

    return `Updated: ${changes.join(', ')}.`;
  }

  private buildTopicPool(preferredTopics: Topic[], currentInterests: string[]): string[] {
    const topicSet = new Set<string>();

    preferredTopics.forEach((topic) => {
      const normalized = normalizeInstructionTopic(topic);
      if (normalized) {
        topicSet.add(normalized);
      }
    });

    sanitizeInstructionTopics(currentInterests).forEach((topic) => topicSet.add(topic));

    if (topicSet.size === 0) {
    return [...ALL_TOPICS];
    }

    return Array.from(topicSet);
  }

  private sanitizeInterests(interests: string[]): string[] {
    return Array.from(
      new Set(
        interests
          .map((interest) => interest.trim().toLowerCase())
          .filter(Boolean)
      )
    );
  }

  private sanitizeTopics(topics: string[]): string[] {
    return sanitizeInstructionTopics(topics);
  }

  private resolveTopicConflicts(liked: string[], muted: string[]): { liked: string[]; muted: string[] } {
    const cleanedMuted = muted.filter((topic) => !liked.includes(topic));

    return {
      liked,
      muted: cleanedMuted,
    };
  }

  private normalizeFollowingWeight(weight: string, fallback: FollowingWeight): FollowingWeight {
    const normalized = weight as FollowingWeight;
    if (['none', 'light', 'medium', 'heavy'].includes(normalized)) {
      return normalized;
    }
    return fallback;
  }

  private sortTopics(topics: string[]): string[] {
    return [...topics].sort((a, b) => a.localeCompare(b));
  }
}

// Create instructionService instance
// Will throw error at construction if BaseAgent is not available
let instructionServiceInstance: InstructionService | null = null;

export const instructionService = (() => {
  if (!BaseAgent.isAvailable()) {
    console.error(
      'InstructionService cannot be initialized: VITE_OPENAI_API_KEY is not set. ' +
      'Please set the environment variable to use instruction interpretation features.'
    );
    // Return a proxy that throws on any method call
    return new Proxy({} as InstructionService, {
      get() {
        throw new Error(
          'AI agent is not available. Please set VITE_OPENAI_API_KEY environment variable to use instruction interpretation.'
        );
      },
    });
  }
  if (!instructionServiceInstance) {
    instructionServiceInstance = new InstructionService();
  }
  return instructionServiceInstance;
})();

