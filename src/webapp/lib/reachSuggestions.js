/**
 * Generate reach suggestions based on chirp content and topic
 * MVP: Uses heuristics, can be replaced with LLM API call
 */
export const suggestReachSettings = (text, topic) => {
    const lowerText = text.toLowerCase();
    // Heuristic: Check for question words or discussion prompts
    const isDiscussionPrompt = lowerText.includes('?') ||
        lowerText.includes('what do you think') ||
        lowerText.includes('thoughts') ||
        lowerText.includes('opinions') ||
        lowerText.includes('discuss');
    // Heuristic: Check for personal/private content
    const isPersonal = lowerText.includes('i feel') ||
        lowerText.includes('my experience') ||
        lowerText.includes('personal') ||
        lowerText.includes('private');
    // Heuristic: Check for public/announcement content
    const isPublic = lowerText.includes('announcing') ||
        lowerText.includes('launch') ||
        lowerText.includes('release') ||
        lowerText.includes('public');
    // Topic-based suggestions
    const topicSuggestions = {
        dev: { allowFollowers: true, allowNonFollowers: true },
        startups: { allowFollowers: true, allowNonFollowers: true },
        music: { allowFollowers: true, allowNonFollowers: false },
        sports: { allowFollowers: true, allowNonFollowers: true },
        productivity: { allowFollowers: true, allowNonFollowers: false },
        design: { allowFollowers: true, allowNonFollowers: true },
        politics: { allowFollowers: true, allowNonFollowers: false },
        crypto: { allowFollowers: true, allowNonFollowers: true },
    };
    let tunedAudience;
    let explanation;
    if (isDiscussionPrompt) {
        // Discussion prompts: open to followers and non-followers
        tunedAudience = {
            allowFollowers: true,
            allowNonFollowers: true,
        };
        explanation = 'This looks like a discussion prompt. Opening to followers and non-followers.';
    }
    else if (isPersonal) {
        // Personal content: followers only
        tunedAudience = {
            allowFollowers: true,
            allowNonFollowers: false,
        };
        explanation = 'This seems personal. Suggesting followers-only reach for a more intimate audience.';
    }
    else if (isPublic) {
        // Public announcements: everyone
        tunedAudience = {
            allowFollowers: true,
            allowNonFollowers: true,
        };
        explanation = 'This appears to be a public announcement. Suggesting open reach to maximize visibility.';
    }
    else {
        // Default: use topic-based suggestions
        const topicSuggestion = topicSuggestions[topic];
        tunedAudience = {
            allowFollowers: topicSuggestion.allowFollowers ?? true,
            allowNonFollowers: topicSuggestion.allowNonFollowers ?? false,
        };
        explanation = `Based on the #${topic} topic, suggesting this reach configuration for optimal engagement.`;
    }
    return {
        tunedAudience,
        explanation,
    };
};
