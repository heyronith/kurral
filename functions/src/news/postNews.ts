/**
 * Post news articles as chirps under the Kural News account.
 * Resolves Kural News user ID, formats article text, and writes to Firestore chirps.
 * Optional semantic analysis (ReachAgent) can be passed so bot posts get semanticTopics/entities/intent for the pipeline.
 */

import * as admin from 'firebase-admin';
import type { NormalizedArticle } from './types';
import { getChirpIdForArticle, markArticleProcessed, chirpExists } from './deduplication';
import type { ContentAnalysis } from '../agents/reachAgent';

const db = admin.firestore();

const MAX_CHIRP_TEXT_LENGTH = 500;

/**
 * Resolve Kural News user ID from Firestore users collection (handle === 'kuralnews', isPlatformAccount === true).
 * Throws if not found.
 */
export async function getKuralNewsUserId(): Promise<string> {
  const snapshot = await db
    .collection('users')
    .where('isPlatformAccount', '==', true)
    .where('handle', '==', 'kuralnews')
    .limit(1)
    .get();

  if (snapshot.empty) {
    throw new Error(
      '[News] Kural News account not found. Ensure a user exists with handle "kuralnews" and isPlatformAccount true.'
    );
  }
  return snapshot.docs[0].id;
}

/**
 * Format a GNews article as chirp text: title, optional description snippet, source, and link.
 */
export function formatArticleAsChirpText(article: NormalizedArticle): string {
  const title = (article.raw.title || '').trim();
  const desc = (article.raw.description || '').trim().replace(/<[^>]*>/g, '');
  const sourceName = (article.raw.source?.name || 'Source').trim();
  const url = (article.raw.url || '').trim();

  let text = `📰 ${title}`;
  if (desc && text.length + 2 + desc.length <= MAX_CHIRP_TEXT_LENGTH) {
    const snippet = desc.length > 120 ? desc.slice(0, 117) + '...' : desc;
    text += `\n\n${snippet}`;
  }
  if (sourceName && text.length + 2 + sourceName.length + 2 + url.length <= MAX_CHIRP_TEXT_LENGTH) {
    text += `\n\nSource: ${sourceName}\n${url}`;
  } else if (url && text.length + 1 + url.length <= MAX_CHIRP_TEXT_LENGTH) {
    text += `\n${url}`;
  }
  if (text.length > MAX_CHIRP_TEXT_LENGTH) {
    text = text.slice(0, MAX_CHIRP_TEXT_LENGTH - 3) + '...';
  }
  return text;
}

/**
 * Create a chirp document for a normalized article and mark the article as processed.
 * Uses deterministic chirp ID so the same article is never duplicated.
 * Skips if the chirp already exists.
 * Optional semanticAnalysis: when provided, chirp is created with semanticTopics, entities, intent, semanticTopicBuckets for the value pipeline.
 * Returns the chirp ID if created, null if skipped.
 */
export async function postArticleAsChirp(
  article: NormalizedArticle,
  kuralnewsUserId: string,
  semanticAnalysis?: ContentAnalysis
): Promise<string | null> {
  const chirpId = getChirpIdForArticle(article.articleId);
  const existing = await chirpExists(chirpId);
  if (existing) {
    await markArticleProcessed(article.articleId, chirpId, {
      url: article.raw.url,
      title: article.raw.title,
    }).catch((err) => console.error('[News] Failed to mark article as processed:', err));
    return null;
  }

  const text = formatArticleAsChirpText(article);
  const topic = article.category;

  const chirpData: Record<string, unknown> = {
    authorId: kuralnewsUserId,
    text,
    topic,
    reachMode: 'forAll',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    commentCount: 0,
    factCheckStatus: 'clean',
    isAutomatedPost: true,
    sourceUrl: article.raw.url || null,
    imageUrl: (article.raw.image && article.raw.image.trim()) || null,
  };

  if (semanticAnalysis) {
    if (semanticAnalysis.semanticTopics?.length) {
      chirpData.semanticTopics = semanticAnalysis.semanticTopics;
    }
    if (semanticAnalysis.entities?.length) {
      chirpData.entities = semanticAnalysis.entities;
    }
    if (semanticAnalysis.intent) {
      chirpData.intent = semanticAnalysis.intent;
    }
    if (semanticAnalysis.suggestedBucket) {
      const bucket = semanticAnalysis.suggestedBucket.trim().replace(/^#+/, '').toLowerCase();
      if (bucket) {
        chirpData.semanticTopicBuckets = { [bucket]: bucket };
      }
    }
  }

  const chirpRef = db.collection('chirps').doc(chirpId);
  await chirpRef.set(chirpData);

  await markArticleProcessed(article.articleId, chirpId, {
    url: article.raw.url,
    title: article.raw.title,
  }).catch((err) => console.error('[News] Failed to mark article as processed:', err));

  return chirpId;
}
