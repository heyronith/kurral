// Value pipeline service for mobile app
// Calls the server-side API endpoint instead of trying to import webapp services
import Constants from 'expo-constants';
import { auth } from '../config/firebase';
import type { Chirp } from '../types';

const getApiEndpoint = (): string => {
  // Priority 1: Try to get from app config (works in production builds)
  const fromConfig = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_BASE_URL;
  if (fromConfig && typeof fromConfig === 'string' && fromConfig.length > 0) {
    // Remove trailing slash if present
    const baseUrl = fromConfig.replace(/\/$/, '');
    return `${baseUrl}/api/process-chirp-value`;
  }
  
  // Priority 2: Try environment variable (works in development)
  const fromEnv = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (fromEnv && typeof fromEnv === 'string' && fromEnv.length > 0) {
    const baseUrl = fromEnv.replace(/\/$/, '');
    return `${baseUrl}/api/process-chirp-value`;
  }
  
  // Priority 3: Fallback - derive from OpenAI proxy URL if available
  const openaiProxyUrl = Constants.expoConfig?.extra?.EXPO_PUBLIC_OPENAI_PROXY_URL || process.env.EXPO_PUBLIC_OPENAI_PROXY_URL;
  if (openaiProxyUrl && typeof openaiProxyUrl === 'string') {
    try {
      const url = new URL(openaiProxyUrl);
      return `${url.origin}/api/process-chirp-value`;
    } catch (e) {
      // If URL parsing fails, try to extract base manually
      const match = openaiProxyUrl.match(/^(https?:\/\/[^\/]+)/);
      if (match) {
        return `${match[1]}/api/process-chirp-value`;
      }
    }
  }
  
  // Production fallback: If we're in production and no URL is set, this is a configuration error
  const isProduction = __DEV__ === false;
  if (isProduction) {
    throw new Error(
      'API base URL is not configured for production. Set EXPO_PUBLIC_API_BASE_URL in app.config.js or configure EXPO_PUBLIC_OPENAI_PROXY_URL. ' +
      'For EAS builds, set these as environment variables in EAS secrets or app.config.js.'
    );
  }
  
  throw new Error(
    'API base URL is not configured. Set EXPO_PUBLIC_API_BASE_URL in app.config.js or env, or configure EXPO_PUBLIC_OPENAI_PROXY_URL.'
  );
};

// Convert ISO strings back to Date objects
const deserializeChirp = (chirp: any): Chirp => {
  if (!chirp) return chirp;
  
  const deserialized: any = { ...chirp };
  
  // Convert ISO strings to Date objects
  if (typeof deserialized.createdAt === 'string') {
    deserialized.createdAt = new Date(deserialized.createdAt);
  }
  if (typeof deserialized.scheduledAt === 'string') {
    deserialized.scheduledAt = new Date(deserialized.scheduledAt);
  }
  if (typeof deserialized.analyzedAt === 'string') {
    deserialized.analyzedAt = new Date(deserialized.analyzedAt);
  }
  if (typeof deserialized.factCheckingStartedAt === 'string') {
    deserialized.factCheckingStartedAt = new Date(deserialized.factCheckingStartedAt);
  }
  
  // Convert nested Date objects in valueScore
  if (deserialized.valueScore && typeof deserialized.valueScore.updatedAt === 'string') {
    deserialized.valueScore = {
      ...deserialized.valueScore,
      updatedAt: new Date(deserialized.valueScore.updatedAt),
    };
  }
  
  // Convert Date objects in claims
  if (Array.isArray(deserialized.claims)) {
    deserialized.claims = deserialized.claims.map((claim: any) => {
      if (typeof claim.extractedAt === 'string') {
        return {
          ...claim,
          extractedAt: new Date(claim.extractedAt),
        };
      }
      return claim;
    });
  }
  
  // Convert Date objects in factChecks
  if (Array.isArray(deserialized.factChecks)) {
    deserialized.factChecks = deserialized.factChecks.map((factCheck: any) => {
      if (typeof factCheck.checkedAt === 'string') {
        return {
          ...factCheck,
          checkedAt: new Date(factCheck.checkedAt),
        };
      }
      return factCheck;
    });
  }
  
  return deserialized as Chirp;
};

// Convert Date objects to ISO strings for JSON serialization
const serializeChirp = (chirp: Chirp): any => {
  if (!chirp) return null;
  
  const serialized: any = { ...chirp };
  
  // Convert Date objects to ISO strings
  if (serialized.createdAt instanceof Date) {
    serialized.createdAt = serialized.createdAt.toISOString();
  }
  if (serialized.scheduledAt instanceof Date) {
    serialized.scheduledAt = serialized.scheduledAt.toISOString();
  }
  if (serialized.analyzedAt instanceof Date) {
    serialized.analyzedAt = serialized.analyzedAt.toISOString();
  }
  if (serialized.factCheckingStartedAt instanceof Date) {
    serialized.factCheckingStartedAt = serialized.factCheckingStartedAt.toISOString();
  }
  
  // Convert nested Date objects in valueScore
  if (serialized.valueScore?.updatedAt instanceof Date) {
    serialized.valueScore = {
      ...serialized.valueScore,
      updatedAt: serialized.valueScore.updatedAt.toISOString(),
    };
  }
  
  // Convert Date objects in claims
  if (Array.isArray(serialized.claims)) {
    serialized.claims = serialized.claims.map((claim: any) => {
      if (claim.extractedAt instanceof Date) {
        return {
          ...claim,
          extractedAt: claim.extractedAt.toISOString(),
        };
      }
      return claim;
    });
  }
  
  // Convert Date objects in factChecks
  if (Array.isArray(serialized.factChecks)) {
    serialized.factChecks = serialized.factChecks.map((factCheck: any) => {
      if (factCheck.checkedAt instanceof Date) {
        return {
          ...factCheck,
          checkedAt: factCheck.checkedAt.toISOString(),
        };
      }
      return factCheck;
    });
  }
  
  return serialized;
};

/**
 * Process chirp through value pipeline via API endpoint
 * This calls the server-side API which has access to all webapp services
 */
export async function processChirpValue(
  chirp: Chirp,
  options?: { skipFactCheck?: boolean }
): Promise<Chirp> {
  const apiUrl = getApiEndpoint();
  
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('You must be signed in to process chirp value.');
    }
    
    const idToken = await currentUser.getIdToken();
    
    // Serialize chirp data (convert Date objects to ISO strings)
    const serializedChirp = serializeChirp(chirp);
    
    console.log(`[ValuePipeline] Calling API: ${apiUrl}`);
    console.log(`[ValuePipeline] Request method: POST, has token: ${!!idToken}`);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        chirp: serializedChirp,
        options: options || {},
      }),
    });

    console.log(`[ValuePipeline] Response status: ${response.status}, ok: ${response.ok}`);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error(`[ValuePipeline] API error:`, errorData);
      const error = new Error(errorData.message || `HTTP ${response.status}`);
      (error as any).status = response.status;
      (error as any).errorData = errorData;
      throw error;
    }

    const result = await response.json();
    
    if (!result.success || !result.chirp) {
      throw new Error(result.message || 'Failed to process chirp value');
    }
    
    // Deserialize the response (convert ISO strings back to Date objects)
    const enrichedChirp = deserializeChirp(result.chirp);
    
    return enrichedChirp;
  } catch (error: any) {
    console.error('[ValuePipeline] Failed to process chirp via API:', error);
    throw new Error(error?.message || 'Value pipeline API call failed');
  }
}
