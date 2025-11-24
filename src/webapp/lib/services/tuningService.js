// Background service for algorithm tuning
import { getTuningAgent, TuningAgent } from '../agents/tuningAgent';
import { useFeedStore } from '../../store/useFeedStore';
import { useUserStore } from '../../store/useUserStore';
import { useConfigStore } from '../../store/useConfigStore';
// Local storage keys
const VIEWED_CHIRPS_KEY = 'chirp_viewed_ids';
const ENGAGED_CHIRPS_KEY = 'chirp_engaged_ids';
const LAST_TUNING_KEY = 'last_tuning_suggestion';
const LAST_TUNING_TIME_KEY = 'last_tuning_time';
// How often to suggest tuning (in milliseconds) - 24 hours
const TUNING_INTERVAL = 24 * 60 * 60 * 1000;
export class TuningService {
    constructor() {
        Object.defineProperty(this, "intervalId", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
    }
    static getInstance() {
        if (!TuningService.instance) {
            TuningService.instance = new TuningService();
        }
        return TuningService.instance;
    }
    /**
     * Track that a user viewed a chirp
     */
    trackChirpView(chirpId) {
        try {
            const viewed = this.getViewedChirps();
            if (!viewed.includes(chirpId)) {
                viewed.push(chirpId);
                // Keep only last 1000 viewed chirps
                const trimmed = viewed.slice(-1000);
                localStorage.setItem(VIEWED_CHIRPS_KEY, JSON.stringify(trimmed));
            }
        }
        catch (error) {
            console.error('Error tracking chirp view:', error);
        }
    }
    /**
     * Track that a user engaged with a chirp (commented, liked, etc.)
     */
    trackChirpEngagement(chirpId) {
        try {
            const engaged = this.getEngagedChirps();
            if (!engaged.includes(chirpId)) {
                engaged.push(chirpId);
                // Keep only last 500 engaged chirps
                const trimmed = engaged.slice(-500);
                localStorage.setItem(ENGAGED_CHIRPS_KEY, JSON.stringify(trimmed));
            }
        }
        catch (error) {
            console.error('Error tracking chirp engagement:', error);
        }
    }
    /**
     * Get viewed chirp IDs from localStorage
     */
    getViewedChirps() {
        try {
            const stored = localStorage.getItem(VIEWED_CHIRPS_KEY);
            return stored ? JSON.parse(stored) : [];
        }
        catch {
            return [];
        }
    }
    /**
     * Get engaged chirp IDs from localStorage
     */
    getEngagedChirps() {
        try {
            const stored = localStorage.getItem(ENGAGED_CHIRPS_KEY);
            return stored ? JSON.parse(stored) : [];
        }
        catch {
            return [];
        }
    }
    /**
     * Check if it's time to suggest tuning
     */
    shouldSuggestTuning() {
        try {
            const lastTime = localStorage.getItem(LAST_TUNING_TIME_KEY);
            if (!lastTime)
                return true;
            const lastTimeMs = parseInt(lastTime, 10);
            const now = Date.now();
            return now - lastTimeMs >= TUNING_INTERVAL;
        }
        catch {
            return true;
        }
    }
    /**
     * Get the last tuning suggestion
     */
    getLastSuggestion() {
        try {
            const stored = localStorage.getItem(LAST_TUNING_KEY);
            return stored ? JSON.parse(stored) : null;
        }
        catch {
            return null;
        }
    }
    /**
     * Save tuning suggestion
     */
    saveSuggestion(suggestion) {
        try {
            localStorage.setItem(LAST_TUNING_KEY, JSON.stringify(suggestion));
            localStorage.setItem(LAST_TUNING_TIME_KEY, Date.now().toString());
        }
        catch (error) {
            console.error('Error saving tuning suggestion:', error);
        }
    }
    /**
     * Analyze user behavior and generate tuning suggestion
     */
    async analyzeAndSuggest() {
        const tuningAgent = getTuningAgent();
        if (!tuningAgent) {
            console.warn('Tuning agent not available');
            return null;
        }
        try {
            const currentUser = useUserStore.getState().currentUser;
            const allChirps = useFeedStore.getState().chirps;
            const currentConfig = useConfigStore.getState().forYouConfig;
            if (!currentUser || allChirps.length === 0) {
                return null;
            }
            const viewedIds = this.getViewedChirps();
            const engagedIds = this.getEngagedChirps();
            // Need at least some engagement data
            if (engagedIds.length < 5) {
                return null;
            }
            const behaviorData = TuningAgent.collectBehaviorData(currentUser, allChirps, viewedIds, engagedIds, currentConfig);
            const response = await tuningAgent.suggestTuning(behaviorData);
            if (response.success && response.data) {
                this.saveSuggestion(response.data);
                return response.data;
            }
            return null;
        }
        catch (error) {
            console.error('Error analyzing and suggesting tuning:', error);
            return null;
        }
    }
    /**
     * Start periodic tuning analysis
     */
    start() {
        if (this.intervalId) {
            return; // Already started
        }
        // Run immediately if needed
        if (this.shouldSuggestTuning()) {
            this.analyzeAndSuggest().catch(console.error);
        }
        // Then check every hour
        this.intervalId = setInterval(() => {
            if (this.shouldSuggestTuning()) {
                this.analyzeAndSuggest().catch(console.error);
            }
        }, 60 * 60 * 1000); // Every hour
    }
    /**
     * Stop periodic tuning analysis
     */
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }
    /**
     * Apply a tuning suggestion
     */
    applySuggestion(suggestion) {
        const configStore = useConfigStore.getState();
        // Update following weight
        configStore.setFollowingWeight(suggestion.followingWeight);
        // Update active conversations boost
        configStore.setBoostActiveConversations(suggestion.boostActiveConversations);
        // Update liked topics
        const currentLiked = configStore.forYouConfig.likedTopics;
        suggestion.likedTopics.forEach(topic => {
            if (!currentLiked.includes(topic)) {
                configStore.addLikedTopic(topic);
            }
        });
        // Update muted topics
        const currentMuted = configStore.forYouConfig.mutedTopics;
        suggestion.mutedTopics.forEach(topic => {
            if (!currentMuted.includes(topic)) {
                configStore.addMutedTopic(topic);
            }
        });
        // Save that suggestion was applied
        this.saveSuggestion(suggestion);
    }
}
Object.defineProperty(TuningService, "instance", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: null
});
// Export singleton
export const tuningService = TuningService.getInstance();
