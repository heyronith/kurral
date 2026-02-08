/**
 * GNews API client for fetching top headlines by category.
 * Uses the official top-headlines endpoint: https://gnews.io/api/v4/top-headlines
 */

import type { GNewsArticle, GNewsCategory, GNewsTopHeadlinesResponse } from './types';

const GNEWS_BASE_URL = 'https://gnews.io/api/v4/top-headlines';

export interface GNewsClientOptions {
  apiKey: string;
  language?: string;
  country?: string;
  max?: number;
}

/**
 * Fetch top headlines for a single category.
 * Throws on HTTP error or invalid response.
 */
export async function fetchTopHeadlines(
  category: GNewsCategory,
  options: GNewsClientOptions
): Promise<GNewsArticle[]> {
  const url = new URL(GNEWS_BASE_URL);
  url.searchParams.set('category', category);
  url.searchParams.set('apikey', options.apiKey);
  url.searchParams.set('lang', options.language ?? 'en');
  url.searchParams.set('country', options.country ?? 'us');
  url.searchParams.set('max', String(Math.min(100, Math.max(1, options.max ?? 10))));

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `GNews API error: ${response.status} ${response.statusText}. ${body.slice(0, 200)}`
    );
  }

  const data = (await response.json()) as GNewsTopHeadlinesResponse | { errors?: unknown };
  if (!data || typeof data !== 'object') {
    throw new Error('GNews API returned invalid JSON');
  }

  if ('errors' in data && data.errors) {
    throw new Error(`GNews API errors: ${JSON.stringify(data.errors)}`);
  }

  const typed = data as GNewsTopHeadlinesResponse;
  const articles = Array.isArray(typed.articles) ? typed.articles : [];
  return articles.filter(
    (a): a is GNewsArticle =>
      a != null &&
      typeof a === 'object' &&
      typeof a.title === 'string' &&
      typeof a.url === 'string'
  );
}

/** Delay helper to avoid GNews 429 rate limits when polling multiple categories. */
function delayMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch top headlines for multiple categories sequentially (to respect rate limits).
 * Waits delayMsBetweenCategories between each request to avoid 429 Too Many Requests.
 * Returns a flat list of articles with their category attached via a parallel array.
 */
export async function fetchTopHeadlinesForCategories(
  categories: GNewsCategory[],
  options: GNewsClientOptions & { delayMsBetweenCategories?: number }
): Promise<{ article: GNewsArticle; category: GNewsCategory }[]> {
  const delayMsBetweenCategories = options.delayMsBetweenCategories ?? 1500;
  const results: { article: GNewsArticle; category: GNewsCategory }[] = [];
  for (let i = 0; i < categories.length; i++) {
    if (i > 0) {
      await delayMs(delayMsBetweenCategories);
    }
    const category = categories[i];
    try {
      const articles = await fetchTopHeadlines(category, options);
      for (const article of articles) {
        results.push({ article, category });
      }
    } catch (err) {
      console.error(`[GNews] Failed to fetch category "${category}":`, err);
      // Continue with other categories
    }
  }
  return results;
}
