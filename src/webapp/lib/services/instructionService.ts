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

const FOLLOWING_WEIGHT_TIERS: Array<{ weight: FollowingWeight; keywords: string[] }> = [
  {
    weight: 'heavy',
    keywords: [
      'only show me people I follow',
      'max following',
      'heavy following',
      'more from people I follow',
      'keep it personal',
      'all from people I follow',
    ],
  },
  {
    weight: 'medium',
    keywords: [
      'balanced',
      'mix discovery',
      'medium following',
      'half following',
      'mixed feed',
    ],
  },
  {
    weight: 'light',
    keywords: [
      'discovery mode',
      'light following',
      'some new people',
      'less following',
      'more surprises',
      'open feed',
    ],
  },
  {
    weight: 'none',
    keywords: [
      'full discovery',
      'no following boost',
      'show me random people',
      'everyone',
      'no following',
      'fresh content',
    ],
  },
];

const POSITIVE_TOPIC_KEYWORDS = [
  'more',
  'boost',
  'show',
  'focus on',
  'love',
  'want',
  'favor',
  'highlight',
  'prioritize',
  'again',
];

const NEGATIVE_TOPIC_KEYWORDS = [
  'less',
  'avoid',
  'stop',
  'mute',
  'no',
  "don't",
  'dont',
  'skip',
  'drop',
  'hide',
  'calm',
];

const ACTIVE_ON_KEYWORDS = ['active conversation', 'active discussions', 'boost active', 'lively conversation', 'hot discussion', 'more active'];
const ACTIVE_OFF_KEYWORDS = ['less active', 'not active', 'quiet conversations', 'calm feed', 'avoid active', 'reduce active'];

export interface InstructionInterpretation {
  newConfig: ForYouConfig;
  explanation: string;
  interestsToAdd?: string[];
  interestsToRemove?: string[];
}

interface TopicAdjustment {
  liked: Topic[];
  muted: Topic[];
  changes: string[];
  updated: boolean;
}

export class InstructionService {
  private agent: BaseAgent | null = null;

  constructor() {
    if (BaseAgent.isAvailable()) {
      this.agent = new BaseAgent();
    }
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

    const topicPool = this.buildTopicPool(preferredTopics);

    if (this.agent) {
      try {
        const aiResponse = await this.callAiInterpreter(trimmedInstruction, currentConfig, topicPool, currentInterests);
        return this.normalizeAiResponse(aiResponse, currentConfig);
      } catch (error) {
        console.warn('Instruction agent failed, falling back to heuristics:', error);
      }
    }

    return this.fallbackInterpretation(trimmedInstruction, currentConfig, topicPool);
  }

  private async callAiInterpreter(
    instruction: string,
    currentConfig: ForYouConfig,
    topicPool: Topic[],
    currentInterests: string[] = []
  ): Promise<InstructionInterpretation> {
    if (!this.agent) {
      throw new Error('Instruction agent is not available.');
    }

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

  private fallbackInterpretation(
    instruction: string,
    currentConfig: ForYouConfig,
    topicPool: Topic[]
  ): InstructionInterpretation {
    const lowers = instruction.toLowerCase();
    const changes: string[] = [];
    const newConfig: ForYouConfig = { ...currentConfig };

    const detectedWeight = this.detectFollowingWeight(lowers);
    if (detectedWeight && detectedWeight !== currentConfig.followingWeight) {
      newConfig.followingWeight = detectedWeight;
      changes.push(`Set following boost to ${detectedWeight}`);
    }

    const detectedActive = this.detectActiveBoost(lowers);
    if (detectedActive !== null && detectedActive !== currentConfig.boostActiveConversations) {
      newConfig.boostActiveConversations = detectedActive;
      changes.push(
        detectedActive
          ? 'Boosted active conversations'
          : 'Reduced the emphasis on active conversations'
      );
    }

    const topicAdjustment = this.adjustTopicsFromInstruction(lowers, currentConfig, topicPool);
    const interestAdjustment = this.extractInterestsFromInstruction(lowers, topicPool);
    if (topicAdjustment.updated) {
      newConfig.likedTopics = this.sortTopics(topicAdjustment.liked);
      newConfig.mutedTopics = this.sortTopics(topicAdjustment.muted);
      changes.push(...topicAdjustment.changes);
    }

    // Always extract interests from instruction, even in fallback
    if (interestAdjustment.add.length > 0 || interestAdjustment.remove.length > 0) {
      if (interestAdjustment.add.length > 0) {
        changes.push(`Added interests: ${interestAdjustment.add.join(', ')}`);
      }
      if (interestAdjustment.remove.length > 0) {
        changes.push(`Removed interests: ${interestAdjustment.remove.join(', ')}`);
      }
    }

    const explanation =
      changes.length > 0
        ? `AI heuristics applied: ${changes.join('; ')}.`
        : "Couldn't detect any strong signal in your instruction, so the configuration stayed as is.";

    return {
      newConfig,
      explanation,
      interestsToAdd: interestAdjustment.add,
      interestsToRemove: interestAdjustment.remove,
    };
  }

  private detectFollowingWeight(instruction: string): FollowingWeight | null {
    for (const tier of FOLLOWING_WEIGHT_TIERS) {
      if (this.containsAny(instruction, tier.keywords)) {
        return tier.weight;
      }
    }
    return null;
  }

  private detectActiveBoost(instruction: string): boolean | null {
    if (this.containsAny(instruction, ACTIVE_OFF_KEYWORDS)) {
      return false;
    }
    if (this.containsAny(instruction, ACTIVE_ON_KEYWORDS)) {
      return true;
    }
    return null;
  }

  private adjustTopicsFromInstruction(
    instruction: string,
    currentConfig: ForYouConfig,
    topicPool: Topic[]
  ): TopicAdjustment {
    const likedSet = new Set(currentConfig.likedTopics);
    const mutedSet = new Set(currentConfig.mutedTopics);
    const mentionedTopics = this.findMentionedTopics(instruction, topicPool);
    const changes: string[] = [];

    mentionedTopics.forEach((topic) => {
      const positiveNear = this.topicReferencedWithKeywords(instruction, topic, POSITIVE_TOPIC_KEYWORDS);
      const negativeNear = this.topicReferencedWithKeywords(instruction, topic, NEGATIVE_TOPIC_KEYWORDS);

      if (positiveNear && !negativeNear) {
        if (!likedSet.has(topic)) {
          likedSet.add(topic);
          mutedSet.delete(topic);
          changes.push(`Liked #${topic}`);
        }
      } else if (negativeNear && !positiveNear) {
        if (!mutedSet.has(topic)) {
          mutedSet.add(topic);
          likedSet.delete(topic);
          changes.push(`Muted #${topic}`);
        }
      }
    });

    return {
      liked: Array.from(likedSet),
      muted: Array.from(mutedSet),
      changes,
      updated: changes.length > 0,
    };
  }

  private findMentionedTopics(instruction: string, topicPool: Topic[]): Topic[] {
    const pool = Array.from(new Set<Topic>([...topicPool, ...ALL_TOPICS]));
    const matches: Topic[] = [];

    pool.forEach((topic) => {
      const normalized = topic.toLowerCase();
      if (
        instruction.includes(normalized) ||
        instruction.includes(`#${normalized}`)
      ) {
        matches.push(topic);
      }
    });

    return matches;
  }

  private topicReferencedWithKeywords(
    instruction: string,
    topic: Topic,
    keywords: string[]
  ): boolean {
    return keywords.some((keyword) => {
      const escapedKeyword = this.escapeRegex(keyword);
      const escapedTopic = this.escapeRegex(topic);
      const regex1 = new RegExp(`\\b${escapedKeyword}\\b[\\s\\S]{0,10}\\b${escapedTopic}\\b`, 'i');
      const regex2 = new RegExp(`\\b${escapedTopic}\\b[\\s\\S]{0,10}\\b${escapedKeyword}\\b`, 'i');
      return regex1.test(instruction) || regex2.test(instruction);
    });
  }

  private buildTopicPool(preferredTopics: Topic[]): Topic[] {
    if (preferredTopics.length > 0) {
      return Array.from(new Set<Topic>([...preferredTopics]));
    }
    return [...ALL_TOPICS];
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

  private extractInterestsFromInstruction(
    instruction: string,
    topicPool: Topic[]
  ): { add: string[]; remove: string[] } {
    const add: string[] = [];
    const remove: string[] = [];
    const topicSet = new Set(topicPool.map((topic) => topic.toLowerCase()));
    const lowers = instruction.toLowerCase();

    // Extract interests from explicit patterns: "more X", "show me X", "interested in X"
    const addPatterns = [
      /(?:more|show me|i want|prefer|focus on|love|interested in|add|like|want to see)\s+([a-z0-9#][a-z0-9#\s-]{2,})/gi,
      /(?:about|regarding|concerning|related to)\s+([a-z0-9#][a-z0-9#\s-]{2,})/gi,
    ];

    // Extract interests from removal patterns: "less X", "avoid X", "no X"
    const removePatterns = [
      /(?:less|avoid|stop|no more|hide|tired of|don't want|don't show|remove|exclude)\s+([a-z0-9#][a-z0-9#\s-]{2,})/gi,
    ];

    // Extract from patterns
    addPatterns.forEach((regex) => {
      let match: RegExpExecArray | null;
      while ((match = regex.exec(instruction)) !== null) {
        const term = match[1].trim().toLowerCase();
        if (term.length < 3) continue;
        if (topicSet.has(term)) continue;
        // Split compound terms like "react tutorials" → ["react", "tutorials"]
        const parts = term.split(/\s+/);
        parts.forEach((part) => {
          if (part.length >= 3 && !topicSet.has(part) && !add.includes(part)) {
            add.push(part);
          }
        });
        if (term.length >= 3 && term.split(/\s+/).length <= 3 && !add.includes(term)) {
          add.push(term);
        }
      }
    });

    removePatterns.forEach((regex) => {
      let match: RegExpExecArray | null;
      while ((match = regex.exec(instruction)) !== null) {
        const term = match[1].trim().toLowerCase();
        if (term.length < 3) continue;
        if (topicSet.has(term)) continue;
        const parts = term.split(/\s+/);
        parts.forEach((part) => {
          if (part.length >= 3 && !topicSet.has(part) && !remove.includes(part)) {
            remove.push(part);
          }
        });
        if (term.length >= 3 && term.split(/\s+/).length <= 3 && !remove.includes(term)) {
          remove.push(term);
        }
      }
    });

    // Also extract standalone topic keywords (technologies, subjects mentioned directly)
    const commonTechKeywords = [
      'react', 'vue', 'angular', 'javascript', 'typescript', 'python', 'java', 'go', 'rust',
      'ai', 'machine learning', 'deep learning', 'neural networks', 'nlp',
      'design', 'ui', 'ux', 'figma', 'sketch',
      'startup', 'funding', 'vc', 'saas', 'startup funding',
      'crypto', 'blockchain', 'bitcoin', 'ethereum', 'defi',
      'productivity', 'workflow', 'habit', 'routine',
      'music', 'guitar', 'piano', 'album',
      'sports', 'nba', 'nfl', 'soccer', 'football',
    ];

    commonTechKeywords.forEach((keyword) => {
      const keywordLower = keyword.toLowerCase();
      const regex = new RegExp(`\\b${keywordLower.replace(/\s+/g, '\\s+')}\\b`, 'i');
      if (regex.test(instruction) && !topicSet.has(keywordLower) && !add.includes(keywordLower)) {
        // Only add if not in a removal context
        const beforeContext = lowers.substring(0, lowers.indexOf(keywordLower));
        const isRemoval = /(?:less|avoid|stop|no more|hide|tired of|don't want|don't show|remove|exclude)\s*$/i.test(beforeContext);
        if (isRemoval) {
          if (!remove.includes(keywordLower)) {
            remove.push(keywordLower);
          }
        } else {
          add.push(keywordLower);
        }
      }
    });

    return {
      add: this.sanitizeInterests(add),
      remove: this.sanitizeInterests(remove),
    };
  }

  private sanitizeTopics(topics: string[]): Topic[] {
    const seen = new Set<Topic>();
    const cleaned: Topic[] = [];

    topics.forEach((topic) => {
      const normalized = topic.trim().toLowerCase();
      const match = ALL_TOPICS.find((available) => available === normalized);
      if (match && !seen.has(match)) {
        seen.add(match);
        cleaned.push(match);
      }
    });

    return cleaned;
  }

  private resolveTopicConflicts(liked: Topic[], muted: Topic[]): { liked: Topic[]; muted: Topic[] } {
    const mutedSet = new Set(muted);
    const cleanedMuted = muted.filter((topic) => {
      if (liked.includes(topic)) {
        return false;
      }
      return true;
    });

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

  private sortTopics(topics: Topic[]): Topic[] {
    return [...topics].sort((a, b) => a.localeCompare(b));
  }

  private containsAny(input: string, keywords: string[]): boolean {
    const lowered = input.toLowerCase();
    return keywords.some((keyword) => lowered.includes(keyword.toLowerCase()));
  }

  private escapeRegex(value: string): string {
    return value.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  }
}

export const instructionService = new InstructionService();

