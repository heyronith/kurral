import { BaseAgent } from '../agents/baseAgent';
const SYSTEM_PROMPT = `You are a discourse analyst. Evaluate comment threads for informativeness, civility, reasoning depth, and perspective diversity.
Classify each comment with a role and assign contribution scores (0-1) for epistemic, insight, practical, relational, and effort dimensions.`;
const ANALYSIS_SCHEMA = {
    type: 'object',
    properties: {
        threadQuality: {
            type: 'object',
            properties: {
                informativeness: { type: 'number' },
                civility: { type: 'number' },
                reasoningDepth: { type: 'number' },
                crossPerspective: { type: 'number' },
                summary: { type: 'string' },
            },
            required: ['informativeness', 'civility', 'reasoningDepth', 'crossPerspective', 'summary'],
        },
        commentInsights: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    commentId: { type: 'string' },
                    role: {
                        type: 'string',
                        enum: ['question', 'answer', 'evidence', 'opinion', 'moderation', 'other'],
                    },
                    contribution: {
                        type: 'object',
                        properties: {
                            epistemic: { type: 'number' },
                            insight: { type: 'number' },
                            practical: { type: 'number' },
                            relational: { type: 'number' },
                            effort: { type: 'number' },
                        },
                        required: ['epistemic', 'insight', 'practical', 'relational', 'effort'],
                    },
                },
                required: ['commentId', 'role', 'contribution'],
            },
        },
    },
    required: ['threadQuality', 'commentInsights'],
};
const normalizeVector = (vector) => {
    const safe = {
        epistemic: Math.max(0, Math.min(1, Number(vector.epistemic) || 0)),
        insight: Math.max(0, Math.min(1, Number(vector.insight) || 0)),
        practical: Math.max(0, Math.min(1, Number(vector.practical) || 0)),
        relational: Math.max(0, Math.min(1, Number(vector.relational) || 0)),
        effort: Math.max(0, Math.min(1, Number(vector.effort) || 0)),
    };
    const total = vector.total ?? Object.values(safe).reduce((sum, value) => sum + value, 0) / 5;
    return { ...safe, total };
};
const fallbackAnalysis = (comments) => {
    if (comments.length === 0) {
        return {
            threadQuality: {
                informativeness: 0,
                civility: 0,
                reasoningDepth: 0,
                crossPerspective: 0,
                summary: 'No discussion yet.',
            },
            commentInsights: {},
        };
    }
    const summary = `${comments.length} comment${comments.length === 1 ? '' : 's'} with simple heuristics applied.`;
    const insights = {};
    comments.forEach((comment) => {
        const lengthScore = Math.min(1, comment.text.length / 400);
        insights[comment.id] = {
            role: comment.text.includes('?') ? 'question' : 'opinion',
            contribution: {
                epistemic: lengthScore * 0.6,
                insight: lengthScore * 0.5,
                practical: lengthScore * 0.3,
                relational: 0.4,
                effort: lengthScore,
                total: lengthScore * 0.56,
            },
        };
    });
    return {
        threadQuality: {
            informativeness: 0.4,
            civility: 0.7,
            reasoningDepth: 0.35,
            crossPerspective: 0.3,
            summary,
        },
        commentInsights: insights,
    };
};
const summarizeComment = (comment) => {
    return `Comment ${comment.id} by ${comment.authorId}: ${comment.text.trim()}`.slice(0, 600);
};
export async function analyzeDiscussion(chirp, comments) {
    if (comments.length === 0) {
        return fallbackAnalysis(comments);
    }
    if (!BaseAgent.isAvailable()) {
        return fallbackAnalysis(comments);
    }
    const agent = new BaseAgent();
    const commentsForPrompt = comments.slice(0, 20).map(summarizeComment).join('\n\n');
    const prompt = `Post ID: ${chirp.id}
Topic: ${chirp.topic}
Post text: """${chirp.text}"""

Comments (${Math.min(comments.length, 20)} of ${comments.length} shown):
${commentsForPrompt}

Analyze the discussion. Score each dimension from 0 (poor) to 1 (excellent). Return JSON per schema.`;
    try {
        const response = await agent.generateJSON(prompt, SYSTEM_PROMPT, ANALYSIS_SCHEMA);
        const commentInsights = {};
        response.commentInsights?.forEach((insight) => {
            if (!insight.commentId)
                return;
            commentInsights[insight.commentId] = {
                role: insight.role || 'other',
                contribution: normalizeVector(insight.contribution),
            };
        });
        return {
            threadQuality: {
                informativeness: Math.max(0, Math.min(1, Number(response.threadQuality.informativeness) || 0)),
                civility: Math.max(0, Math.min(1, Number(response.threadQuality.civility) || 0)),
                reasoningDepth: Math.max(0, Math.min(1, Number(response.threadQuality.reasoningDepth) || 0)),
                crossPerspective: Math.max(0, Math.min(1, Number(response.threadQuality.crossPerspective) || 0)),
                summary: response.threadQuality.summary || 'No summary provided.',
            },
            commentInsights,
        };
    }
    catch (error) {
        console.error('[DiscussionQualityAgent] Error analyzing thread:', error);
        return fallbackAnalysis(comments);
    }
}
