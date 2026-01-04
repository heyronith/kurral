import Constants from 'expo-constants';
import { auth } from '../config/firebase';

const EMBEDDING_MODEL = 'text-embedding-3-small';

const getProxyEndpoint = (): string => {
  const fromConfig = Constants.expoConfig?.extra?.EXPO_PUBLIC_OPENAI_PROXY_URL;
  if (fromConfig && typeof fromConfig === 'string' && fromConfig.length > 0) {
    return fromConfig;
  }
  const fromEnv = process.env.EXPO_PUBLIC_OPENAI_PROXY_URL;
  if (fromEnv && fromEnv.length > 0) {
    return fromEnv;
  }
  throw new Error(
    'OpenAI proxy URL is not configured. Set EXPO_PUBLIC_OPENAI_PROXY_URL in app.config.js or env.'
  );
};

async function callOpenAIEmbeddingsProxy(body: any): Promise<any> {
  const proxyUrl = getProxyEndpoint();
  
  // Get Firebase ID token for authentication
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('You must be signed in to use embedding features.');
  }
  
  const idToken = await currentUser.getIdToken();
  
  const response = await fetch(proxyUrl, {
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
}

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

export const tryGenerateEmbedding = async (text?: string): Promise<number[] | undefined> => {
  if (!text) {
    return undefined;
  }

  const embedding = await generateEmbedding(text);
  return embedding.length > 0 ? embedding : undefined;
};

