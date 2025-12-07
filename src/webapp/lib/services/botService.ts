import { Timestamp } from 'firebase/firestore';
import { userService } from '../firestore';
import { BOT_ROSTER } from './botConfig';
import type { BotProfileConfig, User } from '../../types';

const buildBotPayload = (config: BotProfileConfig, existing?: User): Omit<User, 'id' | 'createdAt'> => ({
  name: config.name,
  handle: config.handle,
  displayName: config.displayName,
  bio: config.bio,
  topics: config.topics,
  semanticTopics: config.semanticTopics,
  interests: config.interests,
  profilePictureUrl: config.profilePictureUrl,
  coverPhotoUrl: config.coverPhotoUrl,
  following: existing?.following || [], // Required field - bots don't follow anyone initially
  isBot: true,
  botType: config.botType,
  botPersonality: config.personality,
  botPostingPreferences: config.postingPreferences,
  onboardingCompleted: true,
  onboardingCompletedAt: existing?.onboardingCompletedAt ?? new Date(),
  firstTimeUser: false,
});

export const botService = {
  getRoster(): BotProfileConfig[] {
    return BOT_ROSTER;
  },

  async ensureBotProfiles(): Promise<{ success: boolean; bots: User[]; error?: string }> {
    const bots: User[] = [];

    try {
      for (const config of BOT_ROSTER) {
        try {
          const existingById = await userService.getUser(config.botId);
          const existing = existingById ?? (await userService.getUserByHandle(config.handle));
          const payload = buildBotPayload(config, existing ?? undefined);

          if (existing) {
            await userService.updateUser(existing.id, payload);
            const refreshed = await userService.getUser(existing.id);
            if (refreshed) {
              bots.push(refreshed);
            }
            continue;
          }

          const created = await userService.createUser(payload, config.botId);
          bots.push(created);
        } catch (error: any) {
          console.error(`[botService] Failed to ensure bot profile for ${config.botId}:`, error);
          // Continue with other bots even if one fails
        }
      }

      if (bots.length === 0) {
        return {
          success: false,
          bots: [],
          error: 'No bot profiles could be created or retrieved',
        };
      }

      if (bots.length < BOT_ROSTER.length) {
        console.warn(
          `[botService] Only ${bots.length} of ${BOT_ROSTER.length} bot profiles were successfully ensured.`
        );
      }

      return { success: true, bots };
    } catch (error: any) {
      console.error('[botService] Critical error ensuring bot profiles:', error);
      return {
        success: false,
        bots: [],
        error: error?.message || 'Unknown error during bot profile creation',
      };
    }
  },

  async listBotProfiles(limitCount: number = 20): Promise<User[]> {
    return userService.getBots(limitCount);
  },

  async validateBotsReady(): Promise<boolean> {
    try {
      const bots = await this.listBotProfiles(BOT_ROSTER.length);
      return bots.length >= BOT_ROSTER.length * 0.5; // At least 50% of bots should exist
    } catch (error) {
      console.error('[botService] Error validating bots:', error);
      return false;
    }
  },
};

