import { openai } from '../agents/baseAgent';
const EMBEDDING_MODEL = 'text-embedding-3-small';
/**
 * Generate an embedding vector for the provided text using OpenAI.
 * Returns an empty array when the text is empty or OpenAI is not configured.
 */
export const generateEmbedding = async (text) => {
    const input = text.trim();
    if (!input) {
        return [];
    }
    if (!openai) {
        console.warn('[EmbeddingService] OpenAI client unavailable; skipping embedding generation.');
        return [];
    }
    try {
        const response = await openai.embeddings.create({
            model: EMBEDDING_MODEL,
            input,
        });
        const embedding = response.data?.[0]?.embedding;
        if (!Array.isArray(embedding)) {
            throw new Error('Invalid embedding response');
        }
        return embedding;
    }
    catch (error) {
        console.error('[EmbeddingService] Failed to generate embedding:', error);
        return [];
    }
};
/**
 * Safely wraps embedding generation and returns undefined on failure.
 */
export const tryGenerateEmbedding = async (text) => {
    if (!text) {
        return undefined;
    }
    const embedding = await generateEmbedding(text);
    return embedding.length > 0 ? embedding : undefined;
};
