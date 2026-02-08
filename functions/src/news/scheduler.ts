/**
 * News poll scheduler: scheduled Cloud Function (every 15 min) and manual HTTPS callable.
 * Uses Secret Manager (not deprecated functions.config()). Set the key with:
 *   firebase functions:secrets:set GNEWS_API_KEY
 */

import * as functions from 'firebase-functions/v2';
import { runNewsPoll } from './index';

const SCHEDULE = 'every 15 minutes';
const TIMEZONE = 'Etc/UTC';

/**
 * Scheduled Cloud Function: poll GNews every 15 minutes and post up to 2 new chirps to Kural News.
 * Set API key before deploy: firebase functions:secrets:set GNEWS_API_KEY
 */
export const pollGNewsCron = functions.scheduler.onSchedule(
  {
    schedule: SCHEDULE,
    timeZone: TIMEZONE,
    maxInstances: 1,
    secrets: ['GNEWS_API_KEY'],
  },
  async () => {
    console.log('[pollGNewsCron] Starting news poll...');
    const startMs = Date.now();
    try {
      if (!process.env.GNEWS_API_KEY?.trim()) {
        console.error('[pollGNewsCron] GNEWS_API_KEY not set. Skipping. Set with: firebase functions:secrets:set GNEWS_API_KEY');
        return;
      }
      const result = await runNewsPoll();
      const durationMs = Date.now() - startMs;
      console.log('[pollGNewsCron] Completed', {
        articlesFetched: result.articlesFetched,
        articlesAfterAgeFilter: result.articlesAfterAgeFilter,
        articlesAfterDedup: result.articlesAfterDedup,
        chirpsCreated: result.chirpsCreated,
        durationMs,
        errorCount: result.errors.length,
      });
      if (result.errors.length > 0) {
        result.errors.forEach((e) => console.warn('[pollGNewsCron] Error:', e));
      }
    } catch (err) {
      console.error('[pollGNewsCron] Failed:', err);
      throw err;
    }
  }
);

/**
 * Manual HTTPS callable: run the news poll once (for testing or ad-hoc runs).
 * Requires auth. Returns the same stats as the cron for monitoring.
 */
export const pollGNewsManual = functions.https.onCall(
  {
    cors: true,
    maxInstances: 5,
    memory: '512MiB',
    timeoutSeconds: 300,
    secrets: ['GNEWS_API_KEY'],
  },
  async (request) => {
    if (!request.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    }
    if (!process.env.GNEWS_API_KEY?.trim()) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'GNEWS_API_KEY not set. Set with: firebase functions:secrets:set GNEWS_API_KEY'
      );
    }
    const startMs = Date.now();
    const result = await runNewsPoll();
    const durationMs = Date.now() - startMs;
    return {
      success: true,
      articlesFetched: result.articlesFetched,
      articlesAfterAgeFilter: result.articlesAfterAgeFilter,
      articlesAfterDedup: result.articlesAfterDedup,
      chirpsCreated: result.chirpsCreated,
      durationMs,
      errors: result.errors,
    };
  }
);
