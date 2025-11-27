import { BaseAgent } from '../agents/baseAgent';
import type { User } from '../../types';
import { userService } from '../firestore';
import { tryGenerateEmbedding } from './embeddingService';

const SYSTEM_INSTRUCTION = `You are a profile analysis expert. Your task is to create a concise, semantic summary of a user's profile that captures their interests, expertise, values, and context. This summary will be used for personalized content recommendations.

Guidelines:
- Be concise (2-4 sentences, max 300 characters)
- Focus on actionable signals: interests, expertise areas, values, location context
- Use natural language that flows well
- Include implicit signals from bio, location, and URL
- Don't repeat information unnecessarily
- Write in third person
- Be specific about domains/expertise when available
- If information is sparse, focus on what's available`;

export async function generateProfileSummary(user: User): Promise<string> {
  if (!BaseAgent.isAvailable()) {
    console.warn('[ProfileSummaryAgent] OpenAI not available, skipping summary generation');
    return '';
  }

  try {
    const agent = new BaseAgent();
    
    // Build comprehensive profile context
    const profileParts: string[] = [];
    
    // Basic info
    if (user.displayName || user.name) {
      profileParts.push(`Name: ${user.displayName || user.name}`);
    }
    
    // Interests (primary signal)
    if (user.interests && user.interests.length > 0) {
      profileParts.push(`Interests: ${user.interests.join(', ')}`);
    }
    
    // Bio (rich context)
    if (user.bio && user.bio.trim()) {
      profileParts.push(`Bio: ${user.bio.trim()}`);
    }
    
    // Location (geographic context)
    if (user.location && user.location.trim()) {
      profileParts.push(`Location: ${user.location.trim()}`);
    }
    
    // URL (affiliation/expertise signal)
    if (user.url && user.url.trim()) {
      profileParts.push(`Website: ${user.url.trim()}`);
    }
    
    // Reputation domains (expertise areas)
    if (user.reputation && Object.keys(user.reputation).length > 0) {
      const topDomains = Object.entries(user.reputation)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([domain]) => domain);
      if (topDomains.length > 0) {
        profileParts.push(`Expertise domains: ${topDomains.join(', ')}`);
      }
    }
    
    // Value stats (activity level)
    if (user.valueStats) {
      const hasActivity = user.valueStats.postValue30d > 0 || user.valueStats.commentValue30d > 0;
      if (hasActivity) {
        profileParts.push(`Active contributor with ${user.valueStats.postValue30d > 0 ? 'valuable posts' : 'valuable comments'}`);
      }
    }
    
    // Following count (social signal)
    if (user.following && user.following.length > 0) {
      profileParts.push(`Following ${user.following.length} users`);
    }
    
    // If no meaningful data, return empty
    if (profileParts.length === 0) {
      console.warn('[ProfileSummaryAgent] No profile data available for summary generation');
      return '';
    }
    
    const profileContext = profileParts.join('\n');
    
    const prompt = `Create a concise semantic profile summary based on this user information:

${profileContext}

Generate a 2-4 sentence summary that captures:
1. Their primary interests and expertise areas
2. Any implicit signals from bio, location, or URL
3. Their activity level and engagement style
4. Geographic or domain context if relevant

Return ONLY the summary text, no labels, no formatting, just the natural language summary.`;

    const summary = await agent.generate(prompt, SYSTEM_INSTRUCTION);
    
    // Validate and clean summary
    const cleanedSummary = summary.trim();
    
    if (cleanedSummary.length === 0) {
      console.warn('[ProfileSummaryAgent] Generated empty summary');
      return '';
    }
    
    // Enforce max length
    const maxLength = 300;
    const finalSummary = cleanedSummary.length > maxLength 
      ? cleanedSummary.substring(0, maxLength - 3) + '...'
      : cleanedSummary;
    
    console.log('[ProfileSummaryAgent] Generated profile summary:', finalSummary.substring(0, 100) + '...');
    
    return finalSummary;
  } catch (error: any) {
    console.error('[ProfileSummaryAgent] Error generating summary:', error);
    // Don't throw - return empty string so profile update can continue
    return '';
  }
}

/**
 * Generate and save profile summary for a user
 * This should be called after profile updates
 */
export async function generateAndSaveProfileSummary(userId: string): Promise<string | null> {
  try {
    // Fetch latest user data
    const user = await userService.getUser(userId);
    if (!user) {
      console.error('[ProfileSummaryAgent] User not found:', userId);
      return null;
    }
    
    // Generate summary
    const summary = await generateProfileSummary(user);
    
    if (!summary) {
      console.warn('[ProfileSummaryAgent] No summary generated for user:', userId);
      return null;
    }
    
    // Get current version or start at 1
    const currentVersion = user.profileSummaryVersion || 0;
    const newVersion = currentVersion + 1;
    
    // Update user with new summary
    const summaryEmbedding = await tryGenerateEmbedding(summary);

    await userService.updateUser(userId, {
      profileSummary: summary,
      profileSummaryVersion: newVersion,
      profileSummaryUpdatedAt: new Date(),
      profileEmbedding: summaryEmbedding,
      profileEmbeddingVersion: summaryEmbedding ? newVersion : user.profileEmbeddingVersion || 0,
    });
    
    console.log('[ProfileSummaryAgent] Saved profile summary version', newVersion, 'for user:', userId);
    
    return summary;
  } catch (error: any) {
    console.error('[ProfileSummaryAgent] Error in generateAndSaveProfileSummary:', error);
    return null;
  }
}

