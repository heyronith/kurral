import { create } from 'zustand';
import { userService } from '../lib/firestore';
import { useUserStore } from './useUserStore';
import { DEFAULT_FOR_YOU_CONFIG } from '../types';
const STORAGE_PREFIX = 'dumbfeed:forYouConfig';
const MAX_TIME_WINDOW_DAYS = 30;
const clampTimeWindow = (value) => {
    if (typeof value !== 'number' || Number.isNaN(value)) {
        return DEFAULT_FOR_YOU_CONFIG.timeWindowDays ?? 7;
    }
    const floored = Math.max(1, Math.floor(value));
    return Math.min(floored, MAX_TIME_WINDOW_DAYS);
};
const normalizeTopicName = (value) => {
    if (!value)
        return null;
    const normalized = value.trim().toLowerCase();
    return normalized || null;
};
const normalizeTopicList = (topics) => {
    if (!topics || topics.length === 0)
        return [];
    const normalizedSet = new Set();
    topics.forEach((topic) => {
        const normalized = normalizeTopicName(topic);
        if (normalized) {
            normalizedSet.add(normalized);
        }
    });
    return Array.from(normalizedSet);
};
const removeTopic = (list, topic) => {
    if (!topic)
        return list;
    return list.filter((t) => t !== topic);
};
const normalizeConfig = (config) => {
    const base = {
        ...DEFAULT_FOR_YOU_CONFIG,
        ...config,
    };
    return {
        followingWeight: base.followingWeight,
        boostActiveConversations: base.boostActiveConversations,
        likedTopics: normalizeTopicList(base.likedTopics),
        mutedTopics: normalizeTopicList(base.mutedTopics),
        timeWindowDays: clampTimeWindow(base.timeWindowDays),
    };
};
const storageKeyForUser = (userId) => `${STORAGE_PREFIX}:${userId ?? 'guest'}`;
const readConfigFromStorage = (userId) => {
    if (typeof window === 'undefined') {
        return undefined;
    }
    try {
        const raw = window.localStorage.getItem(storageKeyForUser(userId));
        if (!raw)
            return undefined;
        const parsed = JSON.parse(raw);
        return normalizeConfig(parsed);
    }
    catch (error) {
        console.warn('[ForYouConfig] Unable to read stored config', error);
        return undefined;
    }
};
const persistConfig = (config) => {
    const currentUser = useUserStore.getState().currentUser;
    if (typeof window !== 'undefined') {
        try {
            window.localStorage.setItem(storageKeyForUser(currentUser?.id), JSON.stringify(config));
        }
        catch (error) {
            console.warn('[ForYouConfig] Failed to write to localStorage', error);
        }
    }
    if (currentUser?.id) {
        userService.updateUser(currentUser.id, { forYouConfig: config }).catch((error) => {
            console.error('[ForYouConfig] Failed to persist config to Firestore:', error);
        });
    }
};
export const useConfigStore = create((set, get) => {
    const applyConfigUpdate = (updater) => {
        const updated = normalizeConfig(updater(get().forYouConfig));
        get().setForYouConfig(updated);
    };
    return {
        forYouConfig: DEFAULT_FOR_YOU_CONFIG,
        setFollowingWeight: (weight) => applyConfigUpdate((current) => ({ ...current, followingWeight: weight })),
        setBoostActiveConversations: (boost) => applyConfigUpdate((current) => ({ ...current, boostActiveConversations: boost })),
        addLikedTopic: (topic) => applyConfigUpdate((current) => {
            const normalized = normalizeTopicName(topic);
            if (!normalized) {
                return current;
            }
            const newLiked = current.likedTopics.includes(normalized)
                ? current.likedTopics
                : [...current.likedTopics, normalized];
            const filteredMuted = removeTopic(current.mutedTopics, normalized);
            return {
                ...current,
                likedTopics: newLiked,
                mutedTopics: filteredMuted,
            };
        }),
        removeLikedTopic: (topic) => applyConfigUpdate((current) => {
            const normalized = normalizeTopicName(topic);
            if (!normalized) {
                return current;
            }
            return {
                ...current,
                likedTopics: current.likedTopics.filter((t) => t !== normalized),
            };
        }),
        addMutedTopic: (topic) => applyConfigUpdate((current) => {
            const normalized = normalizeTopicName(topic);
            if (!normalized) {
                return current;
            }
            const newMuted = current.mutedTopics.includes(normalized)
                ? current.mutedTopics
                : [...current.mutedTopics, normalized];
            const filteredLiked = removeTopic(current.likedTopics, normalized);
            return {
                ...current,
                likedTopics: filteredLiked,
                mutedTopics: newMuted,
            };
        }),
        removeMutedTopic: (topic) => applyConfigUpdate((current) => {
            const normalized = normalizeTopicName(topic);
            if (!normalized) {
                return current;
            }
            return {
                ...current,
                mutedTopics: current.mutedTopics.filter((t) => t !== normalized),
            };
        }),
        setForYouConfig: (config) => {
            const normalized = normalizeConfig(config);
            const oldConfig = get().forYouConfig;
            set({ forYouConfig: normalized });
            console.log('[ForYouConfig] Config updated:', {
                previous: oldConfig,
                new: normalized,
                changes: {
                    followingWeight: oldConfig.followingWeight !== normalized.followingWeight
                        ? `${oldConfig.followingWeight} → ${normalized.followingWeight}`
                        : null,
                    boostActiveConversations: oldConfig.boostActiveConversations !== normalized.boostActiveConversations
                        ? `${oldConfig.boostActiveConversations} → ${normalized.boostActiveConversations}`
                        : null,
                    likedTopics: {
                        added: normalized.likedTopics.filter((t) => !oldConfig.likedTopics.includes(t)),
                        removed: oldConfig.likedTopics.filter((t) => !normalized.likedTopics.includes(t)),
                    },
                    mutedTopics: {
                        added: normalized.mutedTopics.filter((t) => !oldConfig.mutedTopics.includes(t)),
                        removed: oldConfig.mutedTopics.filter((t) => !normalized.mutedTopics.includes(t)),
                    },
                    timeWindowDays: oldConfig.timeWindowDays !== normalized.timeWindowDays
                        ? `${oldConfig.timeWindowDays} → ${normalized.timeWindowDays}`
                        : null,
                },
            });
            persistConfig(normalized);
        },
        initializeConfig: (user) => {
            const stored = user?.forYouConfig ? normalizeConfig(user.forYouConfig) : readConfigFromStorage(user?.id);
            const finalConfig = stored ?? DEFAULT_FOR_YOU_CONFIG;
            set({ forYouConfig: finalConfig });
        },
        resetConfig: () => {
            get().setForYouConfig(DEFAULT_FOR_YOU_CONFIG);
        },
    };
});
