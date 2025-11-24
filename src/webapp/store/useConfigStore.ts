import { create } from 'zustand';
import type { ForYouConfig, FollowingWeight, Topic } from '../types';

interface ConfigState {
  forYouConfig: ForYouConfig;
  setFollowingWeight: (weight: FollowingWeight) => void;
  setBoostActiveConversations: (boost: boolean) => void;
  addLikedTopic: (topic: Topic) => void;
  removeLikedTopic: (topic: Topic) => void;
  addMutedTopic: (topic: Topic) => void;
  removeMutedTopic: (topic: Topic) => void;
  resetConfig: () => void;
  setForYouConfig: (config: ForYouConfig) => void;
}

const defaultConfig: ForYouConfig = {
  followingWeight: 'medium',
  boostActiveConversations: true,
  likedTopics: [],
  mutedTopics: [],
};

export const useConfigStore = create<ConfigState>((set, get) => ({
  forYouConfig: defaultConfig,

  setFollowingWeight: (weight) =>
    set((state) => ({
      forYouConfig: { ...state.forYouConfig, followingWeight: weight },
    })),

  setBoostActiveConversations: (boost) =>
    set((state) => ({
      forYouConfig: { ...state.forYouConfig, boostActiveConversations: boost },
    })),

  addLikedTopic: (topic) =>
    set((state) => {
      const { mutedTopics, likedTopics } = state.forYouConfig;
      // Remove from muted if present
      const newMuted = mutedTopics.filter((t) => t !== topic);
      // Add to liked if not present
      const newLiked = likedTopics.includes(topic)
        ? likedTopics
        : [...likedTopics, topic];
      
      return {
        forYouConfig: {
          ...state.forYouConfig,
          likedTopics: newLiked,
          mutedTopics: newMuted,
        },
      };
    }),

  removeLikedTopic: (topic) =>
    set((state) => ({
      forYouConfig: {
        ...state.forYouConfig,
        likedTopics: state.forYouConfig.likedTopics.filter((t) => t !== topic),
      },
    })),

  addMutedTopic: (topic) =>
    set((state) => {
      const { mutedTopics, likedTopics } = state.forYouConfig;
      // Remove from liked if present
      const newLiked = likedTopics.filter((t) => t !== topic);
      // Add to muted if not present
      const newMuted = mutedTopics.includes(topic)
        ? mutedTopics
        : [...mutedTopics, topic];
      
      return {
        forYouConfig: {
          ...state.forYouConfig,
          likedTopics: newLiked,
          mutedTopics: newMuted,
        },
      };
    }),

  removeMutedTopic: (topic) =>
    set((state) => ({
      forYouConfig: {
        ...state.forYouConfig,
        mutedTopics: state.forYouConfig.mutedTopics.filter((t) => t !== topic),
      },
    })),

  setForYouConfig: (config) => {
    const oldConfig = get().forYouConfig;
    set({ forYouConfig: config });
    
    // Log config changes for verification
    console.log('[ForYouConfig] Config updated:', {
      previous: oldConfig,
      new: config,
      changes: {
        followingWeight: oldConfig.followingWeight !== config.followingWeight 
          ? `${oldConfig.followingWeight} → ${config.followingWeight}` 
          : null,
        boostActiveConversations: oldConfig.boostActiveConversations !== config.boostActiveConversations
          ? `${oldConfig.boostActiveConversations} → ${config.boostActiveConversations}`
          : null,
        likedTopics: {
          added: config.likedTopics.filter(t => !oldConfig.likedTopics.includes(t)),
          removed: oldConfig.likedTopics.filter(t => !config.likedTopics.includes(t)),
        },
        mutedTopics: {
          added: config.mutedTopics.filter(t => !oldConfig.mutedTopics.includes(t)),
          removed: oldConfig.mutedTopics.filter(t => !config.mutedTopics.includes(t)),
        },
      },
    });
  },

  resetConfig: () => set({ forYouConfig: defaultConfig }),
}));

