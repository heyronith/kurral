const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY;

export class RateLimitExceededError extends Error {
  /**
   * @param {number} retryAfterMs
   */
  constructor(retryAfterMs) {
    super('Rate limit exceeded');
    this.name = 'RateLimitExceededError';
    this.retryAfterMs = Math.max(0, retryAfterMs);
  }
}

/**
 * Simple in-memory rate limiter that survives across warm serverless invocations.
 * It does not persist across cold starts, but it gives us prevention until more
 * fully featured infrastructure (Redis, Upstash, etc.) is added.
 */
const getRateLimitStore = () => {
  const globalStore = /** @type {Map<string, { count: number; resetAt: number }>} */ (
    globalThis.__openaiProxyRateLimits
  );

  if (globalStore) {
    return globalStore;
  }

  const newStore = new Map();
  globalThis.__openaiProxyRateLimits = newStore;
  return newStore;
};

/**
 * Enforces a fixed-window rate limit.
 * Throws RateLimitExceededError when the limit is hit.
 */
export function enforceRateLimit(key, { maxRequests, windowMs }) {
  if (maxRequests <= 0 || windowMs <= 0) {
    throw new Error('Invalid rate limit configuration');
  }

  const store = getRateLimitStore();
  const now = Date.now();
  const entry = store.get(key);
  let count = 0;
  let resetAt = now + windowMs;

  if (entry && entry.resetAt > now) {
    count = entry.count;
    resetAt = entry.resetAt;
  } else {
    count = 0;
  }

  const nextCount = count + 1;
  if (nextCount > maxRequests) {
    throw new RateLimitExceededError(resetAt - now);
  }

  store.set(key, {
    count: nextCount,
    resetAt,
  });

  return {
    remaining: maxRequests - nextCount,
    resetAt,
  };
}

/**
 * Verifies a Firebase ID token using Identity Toolkit.
 * Falls back to the Google OAuth tokeninfo endpoint when Identity Toolkit is missing.
 */
export async function verifyFirebaseIdToken(idToken) {
  if (!idToken) {
    throw new Error('Missing Firebase ID token');
  }

  if (!FIREBASE_API_KEY) {
    throw new Error('FIREBASE_API_KEY is required to verify Firebase ID tokens');
  }

  const url = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(
    FIREBASE_API_KEY
  )}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ idToken }),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => 'Failed to read error details');
    throw new Error(`Firebase token verification failed (${response.status}): ${details}`);
  }

  const payload = await response.json();
  const users = Array.isArray(payload.users) ? payload.users : [];
  if (!users.length) {
    throw new Error('Firebase ID token did not return user data');
  }

  const [user] = users;
  return {
    userId: user.localId,
    email: user.email,
  };
}

export const RATE_LIMIT_CONFIG = {
  user: {
    maxRequests: 200,
    windowMs: 60 * 60 * 1000, // 1 hour
  },
  ip: {
    maxRequests: 30,
    windowMs: 60 * 1000, // 1 minute
  },
};

