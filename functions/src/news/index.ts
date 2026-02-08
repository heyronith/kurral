/**
 * News module: GNews API integration for automated posting to Kural News.
 * Step 1 implementation: types, client, deduplication, and posting.
 */

import type { GNewsCategory, NewsConfig, NormalizedArticle } from './types';
import { fetchTopHeadlinesForCategories } from './gnewsClient';
import {
  normalizeArticle,
  filterUnprocessed,
  getChirpIdForArticle,
} from './deduplication';
import { getKuralNewsUserId, postArticleAsChirp, formatArticleAsChirpText } from './postNews';
import { getTopTopicsForAnalysis } from '../services/topicService';
import { getReachAgent } from '../agents/reachAgent';

export * from './types';
export * from './gnewsClient';
export * from './deduplication';
export * from './postNews';

/** Default categories to poll (all 9 GNews categories). */
export const DEFAULT_GNEWS_CATEGORIES: GNewsCategory[] = [
  'general',
  'world',
  'nation',
  'business',
  'technology',
  'entertainment',
  'sports',
  'science',
  'health',
];

/**
 * Build config from environment. Throws if required env vars are missing.
 */
export function getNewsConfigFromEnv(): NewsConfig {
  const gnewsApiKey = process.env.GNEWS_API_KEY;
  if (!gnewsApiKey || !gnewsApiKey.trim()) {
    throw new Error('[News] GNEWS_API_KEY is not set. Set it in Firebase Functions config or .env.');
  }
  return {
    gnewsApiKey: gnewsApiKey.trim(),
    kuralnewsUserId: '', // Resolved in runNewsPoll
    maxArticlesPerCategory: 10,
    maxPostsPerPoll: 2,
    maxArticleAgeHours: 24,
    language: 'en',
    country: 'us',
  };
}

/**
 * Run a single news poll: fetch headlines, deduplicate, and post up to maxPostsPerPoll new chirps.
 * Resolves Kural News user ID from Firestore. Returns stats for logging.
 */
export async function runNewsPoll(
  configOverride?: Partial<Pick<NewsConfig, 'maxArticlesPerCategory' | 'maxPostsPerPoll' | 'maxArticleAgeHours' | 'language' | 'country'>>
): Promise<{
  articlesFetched: number;
  articlesAfterAgeFilter: number;
  articlesAfterDedup: number;
  chirpsCreated: number;
  errors: string[];
}> {
  const config = getNewsConfigFromEnv();
  Object.assign(config, configOverride ?? {});

  const kuralnewsUserId = await getKuralNewsUserId();
  config.kuralnewsUserId = kuralnewsUserId;

  const categories = DEFAULT_GNEWS_CATEGORIES;
  const maxAgeMs = config.maxArticleAgeHours * 60 * 60 * 1000;
  const now = Date.now();
  const errors: string[] = [];

  const fetched = await fetchTopHeadlinesForCategories(categories, {
    apiKey: config.gnewsApiKey,
    language: config.language,
    country: config.country,
    max: config.maxArticlesPerCategory,
    delayMsBetweenCategories: 1500,
  });

  const normalized: NormalizedArticle[] = [];
  for (const { article, category } of fetched) {
    const n = normalizeArticle(article, category);
    if (now - n.publishedAt.getTime() <= maxAgeMs) {
      normalized.push(n);
    }
  }

  const afterDedup = await filterUnprocessed(normalized);
  const sorted = [...afterDedup].sort(
    (a, b) => b.publishedAt.getTime() - a.publishedAt.getTime()
  );
  const toPost = sorted.slice(0, config.maxPostsPerPoll);

  const topics = await getTopTopicsForAnalysis(30);
  const bucketNames = topics.map((t) => t.name);
  const reachAgent = getReachAgent();

  let chirpsCreated = 0;
  for (const article of toPost) {
    try {
      let semanticAnalysis;
      if (reachAgent) {
        const text = formatArticleAsChirpText(article);
        semanticAnalysis = await reachAgent.analyzePostContent(text, topics, bucketNames);
      }
      const chirpId = await postArticleAsChirp(article, kuralnewsUserId, semanticAnalysis);
      if (chirpId) chirpsCreated++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`post ${getChirpIdForArticle(article.articleId)}: ${msg}`);
      console.error('[News] Failed to post article:', err);
    }
  }

  return {
    articlesFetched: fetched.length,
    articlesAfterAgeFilter: normalized.length,
    articlesAfterDedup: afterDedup.length,
    chirpsCreated,
    errors,
  };
}
