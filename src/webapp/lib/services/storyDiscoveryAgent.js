import { BaseAgent } from '../agents/baseAgent';
const MIN_POSTS_PER_STORY = 5;
const MAX_STORIES = 3;
const clampScore = (value, fallback = 0.5) => {
    if (typeof value !== 'number' || Number.isNaN(value))
        return fallback;
    return Math.max(0, Math.min(1, value));
};
const sanitizeSummary = (text) => {
    if (!text)
        return '';
    return text.trim();
};
export async function discoverStories(posts, userTopics) {
    if (posts.length === 0) {
        return [];
    }
    const limitedPosts = posts.slice(0, 120); // Prevent token bloat
    const postMap = new Map(limitedPosts.map((post) => [post.id, post]));
    const postsPayload = limitedPosts
        .map((post) => {
        const minutesAgo = Math.max(0, Math.floor((Date.now() - post.createdAt.getTime()) / 60000));
        const snippet = post.text.length > 400 ? `${post.text.slice(0, 397)}...` : post.text;
        return [
            `ID: ${post.id}`,
            `Topic: ${post.topic}`,
            `MinutesAgo: ${minutesAgo}`,
            `Comments: ${post.commentCount}`,
            `Text: ${snippet}`,
        ].join('\n');
    })
        .join('\n\n');
    const agent = new BaseAgent();
    const prompt = `You are given a collection of social posts from the following user-selected topics: ${userTopics.join(', ')}.

Analyze the posts and identify distinct newsworthy stories. Posts that refer to the same real-world event should be grouped together.

POSTS:
${postsPayload}

OUTPUT REQUIREMENTS:
- Return max ${MAX_STORIES} stories.
- Each story MUST reference at least ${MIN_POSTS_PER_STORY} post IDs from the list above.
- Stories should be distinct. Do not duplicate the same narrative with different wording.
- Prefer stories with breaking news, concrete events, or strong engagement signals (comments).

Respond ONLY with valid JSON:
{
  "stories": [
    {
      "storyId": "string", // unique identifier (e.g., \"story_npm_vuln\")
      "summary": "Concise description of what is happening",
      "headlineIdea": "Optional punchy headline idea",
      "postIds": ["post1","post5","post9"],
      "topics": ["dev","startups"],
      "newsworthinessScore": 0.0-1.0,
      "keyEntities": ["entity1","entity2"],
      "keywords": ["keyword1","keyword2"],
      "confidence": 0.0-1.0 // how confident you are that this is a coherent story
    }
  ]
}`;
    const systemInstruction = 'You are an elite newsroom analyst who groups social posts into factual news stories. Always respond with valid JSON.';
    let response = null;
    try {
        response = await agent.generateJSON(prompt, systemInstruction);
    }
    catch (error) {
        console.error('[StoryDiscoveryAgent] Error generating stories:', error);
        return [];
    }
    if (!response?.stories || !Array.isArray(response.stories)) {
        return [];
    }
    const seenSummaries = new Set();
    const clusters = response.stories
        .map((story, index) => {
        const cleanSummary = sanitizeSummary(story.summary);
        const normalizedSummary = cleanSummary.toLowerCase();
        if (seenSummaries.has(normalizedSummary)) {
            return null;
        }
        seenSummaries.add(normalizedSummary);
        const validPostIds = (story.postIds || []).filter((id) => postMap.has(id));
        if (validPostIds.length < MIN_POSTS_PER_STORY) {
            return null;
        }
        const topics = story.topics && story.topics.length > 0
            ? story.topics
            : Array.from(new Set(validPostIds.map((id) => postMap.get(id)?.topic).filter(Boolean)));
        return {
            storyId: story.storyId ||
                `story_${Date.now()}_${Math.random().toString(36).slice(2, 6)}_${index + 1}`,
            summary: cleanSummary,
            headlineIdea: sanitizeSummary(story.headlineIdea),
            postIds: validPostIds,
            topics,
            newsworthinessScore: clampScore(story.newsworthinessScore, 0.6),
            keyEntities: story.keyEntities || [],
            keywords: story.keywords || [],
            confidence: clampScore(story.confidence, 0.7),
        };
    })
        .filter((cluster) => Boolean(cluster));
    return clusters.slice(0, MAX_STORIES);
}
