/**
 * Process Chirp Value - Serverless Function
 * 
 * This function processes chirps through the value pipeline (fact-checking, value scoring, etc.)
 * It runs server-side where it can access all webapp services without Metro bundler issues.
 * 
 * Usage:
 *   POST /api/process-chirp-value
 *   Body: { chirp, options }
 * 
 * Example:
 *   POST /api/process-chirp-value
 *   {
 *     "chirp": { id: "...", text: "...", ... },
 *     "options": { skipFactCheck: false }
 *   }
 */

import {
  enforceRateLimit,
  RateLimitExceededError,
  RATE_LIMIT_CONFIG,
  verifyFirebaseIdToken,
} from './openai-proxy-utils.js';

const AUTH_HEADER_NAME = 'authorization';
const BEARER_PREFIX = 'Bearer ';

const getClientIp = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }

  return req.socket?.remoteAddress || 'unknown';
};

const extractBearerToken = (req) => {
  const rawHeader = req.headers[AUTH_HEADER_NAME];
  if (!rawHeader) {
    return null;
  }

  const value = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
  if (!value.startsWith(BEARER_PREFIX)) {
    return null;
  }

  return value.substring(BEARER_PREFIX.length).trim();
};

const handleRateLimitError = (res, error) => {
  if (error instanceof RateLimitExceededError) {
    const retryAfterSeconds = Math.max(1, Math.ceil(error.retryAfterMs / 1000));
    res.setHeader('Retry-After', retryAfterSeconds.toString());
    res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'You sent too many requests. Please wait before retrying.',
      retryAfterSeconds,
    });
    return true;
  }
  return false;
};

// Convert Date objects to ISO strings for JSON serialization
const serializeChirp = (chirp) => {
  if (!chirp) return null;
  
  const serialized = { ...chirp };
  
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
    serialized.claims = serialized.claims.map((claim) => {
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
    serialized.factChecks = serialized.factChecks.map((factCheck) => {
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

// Convert ISO strings back to Date objects
const deserializeChirp = (chirp) => {
  if (!chirp) return null;
  
  const deserialized = { ...chirp };
  
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
    deserialized.claims = deserialized.claims.map((claim) => {
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
    deserialized.factChecks = deserialized.factChecks.map((factCheck) => {
      if (typeof factCheck.checkedAt === 'string') {
        return {
          ...factCheck,
          checkedAt: new Date(factCheck.checkedAt),
        };
      }
      return factCheck;
    });
  }
  
  return deserialized;
};

export default async function handler(req, res) {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'This endpoint only accepts POST requests'
    });
  }

  try {
    // Authenticate & rate limit
    const idToken = extractBearerToken(req);
    if (!idToken) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing Firebase ID token. Please sign in and include the Authorization header.',
      });
    }

    const decodedUser = await verifyFirebaseIdToken(idToken);
    const clientIp = getClientIp(req);
    try {
      // Use a more lenient rate limit for value pipeline (it's expensive)
      enforceRateLimit(`user:${decodedUser.userId}`, {
        maxRequests: 50,
        windowMs: 60 * 60 * 1000, // 1 hour
      });
      if (clientIp && clientIp !== 'unknown') {
        enforceRateLimit(`ip:${clientIp}`, {
          maxRequests: 10,
          windowMs: 60 * 1000, // 1 minute
        });
      }
    } catch (rateLimitError) {
      if (handleRateLimitError(res, rateLimitError)) {
        return;
      }
      throw rateLimitError;
    }

    // Extract chirp data from request body
    const { chirp: chirpData, options } = req.body;

    if (!chirpData) {
      return res.status(400).json({ 
        error: 'Missing chirp data',
        message: 'Request must include a "chirp" field with chirp data'
      });
    }

    if (!chirpData.id) {
      return res.status(400).json({ 
        error: 'Invalid chirp data',
        message: 'Chirp must have an "id" field'
      });
    }

    console.log(`[process-chirp-value] Processing chirp ${chirpData.id} for user ${decodedUser.userId}`);

    // Import the value pipeline service (server-side, no Metro issues)
    // Use dynamic import - Vercel serverless functions support ES modules
    // Note: In Vercel, the import path is relative to the project root
    let processChirpValue;
    try {
      // Try importing from the compiled JS file first (production)
      // The path is relative to the project root in Vercel's serverless environment
      const valuePipelineModule = await import('../src/webapp/lib/services/valuePipelineService.js');
      processChirpValue = valuePipelineModule.processChirpValue;
      
      if (typeof processChirpValue !== 'function') {
        // Check if it's a default export
        if (valuePipelineModule.default && typeof valuePipelineModule.default.processChirpValue === 'function') {
          processChirpValue = valuePipelineModule.default.processChirpValue;
        } else {
          throw new Error('processChirpValue is not exported as a function. Available exports: ' + Object.keys(valuePipelineModule).join(', '));
        }
      }
    } catch (importError) {
      console.error('[process-chirp-value] Failed to import valuePipelineService:', importError);
      console.error('[process-chirp-value] Import error details:', {
        message: importError.message,
        stack: importError.stack,
        code: importError.code,
        name: importError.name,
      });
      
      // Provide helpful error message
      const errorMessage = importError.message || 'Unknown import error';
      const isModuleNotFound = errorMessage.includes('Cannot find module') || errorMessage.includes('MODULE_NOT_FOUND');
      
      return res.status(500).json({
        error: 'Server configuration error',
        message: 'Value pipeline service is not available on the server',
        details: `Failed to import valuePipelineService: ${errorMessage}`,
        hint: isModuleNotFound 
          ? 'Ensure the valuePipelineService.js file exists at src/webapp/lib/services/valuePipelineService.js and that Vercel has access to it during build.'
          : 'Check server logs for detailed error information. The module may need to be built or the import path may be incorrect.',
        code: importError.code || 'IMPORT_ERROR'
      });
    }

    if (typeof processChirpValue !== 'function') {
      return res.status(500).json({
        error: 'Server configuration error',
        message: 'Value pipeline service is not properly exported',
        details: 'processChirpValue function not found in valuePipelineService module'
      });
    }

    // Deserialize chirp data (convert ISO strings to Date objects)
    const deserializedChirp = deserializeChirp(chirpData);

    // Process the chirp through the value pipeline
    const enrichedChirp = await processChirpValue(deserializedChirp, options || {});

    // Serialize the result (convert Date objects to ISO strings for JSON)
    const serializedChirp = serializeChirp(enrichedChirp);

    console.log(`[process-chirp-value] Successfully processed chirp ${chirpData.id}`);

    // Return the enriched chirp
    return res.status(200).json({
      success: true,
      chirp: serializedChirp,
    });

  } catch (error) {
    console.error('[process-chirp-value] Error processing chirp:', error);
    console.error('[process-chirp-value] Error details:', {
      message: error.message,
      stack: error.stack,
      cause: error.cause,
      code: error.code
    });
    
    // Return appropriate error response
    if (error.message?.includes('Rate limit')) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: 'Too many requests. Please wait before retrying.',
      });
    }
    
    return res.status(500).json({ 
      error: 'Processing error',
      message: 'Failed to process chirp through value pipeline',
      details: error.message,
      code: error.code
    });
  }
}

