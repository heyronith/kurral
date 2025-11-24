// News Generation Agent - Uses AI to generate news stories from aggregated posts
import { BaseAgent } from '../agents/baseAgent';
// Generate news story from aggregated posts
export async function generateNewsFromPosts(posts, topic, context) {
    if (posts.length === 0) {
        throw new Error('No posts provided for news generation');
    }
    const agent = new BaseAgent();
    // Prepare post data for analysis
    const postsText = posts
        .slice(0, 100) // Limit to top 100 posts to avoid token limits
        .map((post, index) => {
        const timeAgo = Math.floor((Date.now() - post.createdAt.getTime()) / 60000);
        return `Post ${index + 1} (${timeAgo}m ago, ${post.commentCount} comments): ${post.text}`;
    })
        .join('\n\n');
    const totalPosts = posts.length;
    const totalEngagement = posts.reduce((sum, p) => sum + p.commentCount, 0);
    const timeRange = posts.length > 0
        ? Math.floor((Date.now() - posts[posts.length - 1].createdAt.getTime()) / 60000)
        : 0;
    const contextBlock = context
        ? `
STORY CONTEXT:
- Discovery summary: ${context.summary || 'N/A'}
- Suggested headline: ${context.headlineIdea || 'N/A'}
- Key entities: ${(context.keyEntities || []).join(', ') || 'N/A'}
- Suggested keywords: ${(context.keywords || []).join(', ') || 'N/A'}
`
        : '';
    const prompt = `Analyze these ${totalPosts} posts about the topic "${topic}" and create a comprehensive news story.

${contextBlock}

POSTS DATA:
${postsText}

STATISTICS:
- Total posts: ${totalPosts}
- Total engagement (comments): ${totalEngagement}
- Time range: ${timeRange} minutes
- Average engagement per post: ${totalEngagement / totalPosts}

TASK:
Create a news story that synthesizes information from these posts. Follow these guidelines:

1. HEADLINE (max 60 characters):
   - Be factual and concise
   - Include key entities (who/what/where)
   - Avoid sensationalism
   - Make it engaging but accurate

2. SUMMARY (max 280 characters):
   - One to two sentences
   - Capture the main story
   - Include key facts

3. FULL DESCRIPTION (2-3 paragraphs):
   - Synthesize information from multiple posts
   - Highlight key developments and facts
   - Note if information is evolving or conflicting
   - Be neutral and factual
   - Include context about what users are discussing

4. KEY FACTS (array of 5-10 facts):
   - Extract verifiable facts mentioned in posts
   - Prioritize facts mentioned in multiple posts
   - Include who, what, when, where details

5. CONFIDENCE (0-1):
   - Higher if facts are consistent across posts
   - Lower if there are contradictions
   - Consider source diversity

6. RELATED TOPICS (array):
   - Topics that might be related (from: dev, startups, music, sports, productivity, design, politics, crypto)
   - Only include if relevant

7. KEYWORDS (array of 10-15):
   - Important keywords for matching and search
   - Include entities, concepts, and key terms

IMPORTANT:
- If posts contain conflicting information, note this in the description
- If information is incomplete, indicate this
- Be factual, don't make assumptions beyond what's in the posts
- The description should read like a news article, not a social media summary

Respond with ONLY a valid JSON object in this exact format:
{
  "headline": "Concise headline max 60 chars",
  "summary": "1-2 sentence summary max 280 chars",
  "fullDescription": "2-3 paragraph detailed description",
  "keyFacts": ["fact1", "fact2", ...],
  "confidence": 0.85,
  "relatedTopics": ["topic1", "topic2"],
  "keywords": ["keyword1", "keyword2", ...]
}`;
    const systemInstruction = `You are a professional news summarization agent. Your job is to analyze social media posts and create accurate, factual news stories. Always be neutral, verify facts when possible, and clearly indicate when information is uncertain or evolving. Always respond with valid JSON only.`;
    try {
        const response = await agent.generateJSON(prompt, systemInstruction);
        // Validate and clean response
        if (!response.headline || response.headline.length > 60) {
            response.headline = response.headline?.substring(0, 57) + '...' || `Breaking: ${topic} discussion`;
        }
        if (!response.summary || response.summary.length > 280) {
            response.summary = response.summary?.substring(0, 277) + '...' || 'Users are discussing this topic.';
        }
        if (!response.fullDescription) {
            response.fullDescription = response.summary || 'No detailed description available.';
        }
        if (!response.keyFacts || !Array.isArray(response.keyFacts)) {
            response.keyFacts = [];
        }
        if (typeof response.confidence !== 'number' || response.confidence < 0 || response.confidence > 1) {
            response.confidence = 0.7;
        }
        if (!response.relatedTopics || !Array.isArray(response.relatedTopics)) {
            response.relatedTopics = [];
        }
        if (!response.keywords || !Array.isArray(response.keywords)) {
            response.keywords = [];
        }
        return response;
    }
    catch (error) {
        console.error('Error generating news from posts:', error);
        // Fallback: create basic news from first few posts
        const firstPost = posts[0];
        const postTexts = posts.slice(0, 5).map(p => p.text).join(' ');
        return {
            headline: `Breaking: ${topic} discussion trending`,
            summary: postTexts.length > 280 ? postTexts.substring(0, 277) + '...' : postTexts,
            fullDescription: `Users are actively discussing ${topic}. ${posts.length} posts have been made in the last few hours with ${totalEngagement} total comments. The discussion covers various aspects of this topic.`,
            keyFacts: [
                `${posts.length} posts about ${topic}`,
                `${totalEngagement} total comments`,
                `Active discussion in progress`,
            ],
            confidence: 0.5,
            relatedTopics: [],
            keywords: [topic, 'discussion', 'trending'],
        };
    }
}
