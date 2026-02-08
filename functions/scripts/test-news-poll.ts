/**
 * Manual test script for the news poll pipeline.
 * Fetches from GNews, deduplicates, and posts up to 2 new chirps to Kural News.
 *
 * Run from project root:
 *   cd functions && npm run build && GNEWS_API_KEY=your_key node lib/scripts/test-news-poll.js
 *
 * Or with .env containing GNEWS_API_KEY:
 *   cd functions && npm run build && node lib/scripts/test-news-poll.js
 *
 * Requires Firebase Admin (GOOGLE_APPLICATION_CREDENTIALS or gcloud auth) for Firestore.
 */

import * as path from 'path';
import { config } from 'dotenv';

// Load .env from project root: from compiled script (lib/scripts) go up to project root
const projectRootEnv = path.join(__dirname, '..', '..', '..', '.env');
config({ path: projectRootEnv });
// Fallback: when cwd is functions/, project root is ..
const cwdRootEnv = path.join(process.cwd(), '..', '.env');
config({ path: cwdRootEnv });

async function main() {
  if (!process.env.GNEWS_API_KEY?.trim()) {
    console.error('❌ GNEWS_API_KEY is not set. Set it in .env or: GNEWS_API_KEY=your_key node lib/scripts/test-news-poll.js');
    process.exit(1);
  }

  // Firebase Admin must be initialized before importing news module (it uses admin.firestore())
  const admin = await import('firebase-admin');
  if (admin.apps.length === 0) {
    admin.initializeApp({
      projectId: process.env.VITE_FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT,
    });
  }

  const { runNewsPoll } = await import('../src/news');

  console.log('[TestNewsPoll] Running news poll...\n');
  const result = await runNewsPoll({
    maxArticlesPerCategory: 5,
    maxPostsPerPoll: 2,
    maxArticleAgeHours: 24,
  });

  console.log('[TestNewsPoll] Result:');
  console.log(`  Articles fetched:     ${result.articlesFetched}`);
  console.log(`  After age filter:     ${result.articlesAfterAgeFilter}`);
  console.log(`  After dedup:           ${result.articlesAfterDedup}`);
  console.log(`  Chirps created:       ${result.chirpsCreated}`);
  if (result.errors.length > 0) {
    console.log('  Errors:');
    result.errors.forEach((e) => console.log(`    - ${e}`));
  }
  console.log('\n[TestNewsPoll] Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
