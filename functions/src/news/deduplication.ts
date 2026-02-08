/**
 * Deduplication for news articles: normalize URL, generate stable IDs,
 * check and mark processed articles in Firestore.
 */

import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import type { GNewsArticle, GNewsCategory, NormalizedArticle } from './types';

const db = admin.firestore();

const PROCESSED_ARTICLES_COLLECTION = 'processedArticles';
const CHIRP_ID_PREFIX = 'gnews_';

/**
 * Normalize URL for stable hashing: strip query, fragment, www, trailing slash.
 */
export function normalizeUrl(urlStr: string): string {
  try {
    const url = new URL(urlStr);
    const host = url.host.replace(/^www\./i, '');
    const path = url.pathname.replace(/\/$/, '') || '/';
    return `${url.protocol}//${host}${path}`.toLowerCase();
  } catch {
    return urlStr.toLowerCase().trim();
  }
}

/**
 * Generate a deterministic article ID from normalized URL (safe for Firestore doc IDs).
 */
export function generateArticleId(url: string): string {
  const normalized = normalizeUrl(url);
  return crypto.createHash('md5').update(normalized).digest('hex');
}

/**
 * Generate the chirp document ID used for this article (deterministic, one chirp per article).
 */
export function getChirpIdForArticle(articleId: string): string {
  return CHIRP_ID_PREFIX + articleId;
}

/**
 * Parse GNews publishedAt string to Date; return epoch if invalid.
 */
function parsePublishedAt(publishedAt: string): Date {
  if (!publishedAt) return new Date(0);
  const d = new Date(publishedAt);
  return isNaN(d.getTime()) ? new Date(0) : d;
}

/**
 * Build a normalized article with articleId and publishedAt for filtering and dedup.
 */
export function normalizeArticle(
  raw: GNewsArticle,
  category: GNewsCategory
): NormalizedArticle {
  const articleId = generateArticleId(raw.url);
  const publishedAt = parsePublishedAt(raw.publishedAt);
  return { raw, articleId, publishedAt, category };
}

/**
 * Check whether an article has already been processed (posted).
 */
export async function isArticleProcessed(articleId: string): Promise<boolean> {
  const docRef = db.collection(PROCESSED_ARTICLES_COLLECTION).doc(articleId);
  const snap = await docRef.get();
  return snap.exists;
}

/**
 * Filter a list of normalized articles to only those not yet processed.
 */
export async function filterUnprocessed(
  articles: NormalizedArticle[]
): Promise<NormalizedArticle[]> {
  const result: NormalizedArticle[] = [];
  for (const a of articles) {
    const processed = await isArticleProcessed(a.articleId);
    if (!processed) result.push(a);
  }
  return result;
}

/**
 * Mark an article as processed and link it to the created chirp.
 */
export async function markArticleProcessed(
  articleId: string,
  chirpId: string,
  article: { url: string; title: string }
): Promise<void> {
  const ref = db.collection(PROCESSED_ARTICLES_COLLECTION).doc(articleId);
  await ref.set({
    articleId,
    chirpId,
    url: article.url,
    title: article.title,
    processedAt: admin.firestore.FieldValue.serverTimestamp(),
    source: 'gnews',
  });
}

/**
 * Check if a chirp document already exists (e.g. from a previous run).
 */
export async function chirpExists(chirpId: string): Promise<boolean> {
  const snap = await db.collection('chirps').doc(chirpId).get();
  return snap.exists;
}
