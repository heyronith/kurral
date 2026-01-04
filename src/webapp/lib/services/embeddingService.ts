import { auth } from '../firebase';

/**
 * Embedding Service - Secure OpenAI Client
 * 
 * Generates embeddings using OpenAI API through secure proxy
 */

const EMBEDDING_MODEL = 'text-embedding-3-small';
const PROXY_ENDPOINT = '/api/openai-proxy';

/**
 * Call OpenAI embeddings API through secure proxy
 */
async function callOpenAIEmbeddingsProxy(body: any): Promise<any> {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('You must be signed in to generate embeddings.');
    }

    const idToken = await currentUser.getIdToken();

    const response = await fetch(PROXY_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        endpoint: '/v1/embeddings',
        method: 'POST',
        body,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const error = new Error(errorData.message || `HTTP ${response.status}`);
      (error as any).status = response.status;
      throw error;
    }

    return await response.json();
  } catch (error: any) {
    if (error.status === 500) {
      throw new Error('Server error: OpenAI proxy is not configured. Please contact support.');
    }
    throw error;
  }
}

/**
 * Generate an embedding vector for the provided text using OpenAI.
 * Returns an empty array when the text is empty or OpenAI is not configured.
 */
export const generateEmbedding = async (text: string): Promise<number[]> => {
  const input = text.trim();
  if (!input) {
    return [];
  }

  try {
    const response = await callOpenAIEmbeddingsProxy({
      model: EMBEDDING_MODEL,
      input,
    });

    const embedding = response.data?.[0]?.embedding;
    if (!Array.isArray(embedding)) {
      throw new Error('Invalid embedding response');
    }

    return embedding;
  } catch (error: any) {
    console.error('[EmbeddingService] Failed to generate embedding:', error);
    return [];
  }
};

/**
 * Safely wraps embedding generation and returns undefined on failure.
 */
export const tryGenerateEmbedding = async (text?: string): Promise<number[] | undefined> => {
  if (!text) {
    return undefined;
  }

  const embedding = await generateEmbedding(text);
  return embedding.length > 0 ? embedding : undefined;
};
