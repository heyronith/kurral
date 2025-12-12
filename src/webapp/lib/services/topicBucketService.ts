import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { topicService } from '../firestore';
import { LEGACY_TOPICS, isValidTopic, type Topic } from '../../types';

const normalizeName = (value?: string | null): string | null => {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (!/^[a-z0-9-]{2,50}$/.test(normalized)) return null;
  return normalized;
};

/**
 * Fetch all known buckets (legacy + dynamically created topics).
 */
export async function getAllBuckets(): Promise<string[]> {
  const topicsSnap = await getDocs(collection(db, 'topics'));
  const topicNames = topicsSnap.docs.map((docSnap) => docSnap.id.toLowerCase());
  return Array.from(new Set([...LEGACY_TOPICS, ...topicNames]));
}

/**
 * Ensure a bucket exists in the topics collection.
 */
export async function ensureBucket(bucketName: string): Promise<void> {
  const normalized = normalizeName(bucketName);
  if (!normalized) throw new Error(`Invalid bucket name: ${bucketName}`);
  // topicService.createTopic is idempotent
  await topicService.createTopic(normalized);
}

/**
 * Map a semantic topic to a bucket, creating the bucket if it does not exist.
 * Persists the mapping in 'topicMappings/{semanticTopic}'.
 */
export async function mapSemanticTopicToBucket(
  semanticTopic: string,
  suggestedBucket?: string
): Promise<string> {
  const normalizedSemantic = normalizeName(semanticTopic);
  if (!normalizedSemantic) {
    throw new Error(`Invalid semantic topic: ${semanticTopic}`);
  }

  // 1) Return existing mapping if present
  const mappingRef = doc(db, 'topicMappings', normalizedSemantic);
  const existing = await getDoc(mappingRef);
  if (existing.exists()) {
    const data = existing.data() as { bucket: string };
    return data.bucket;
  }

  // 2) Choose bucket: suggested if valid, else heuristic over legacy topics, else default 'dev'
  let bucket: Topic | string | null = null;
  if (suggestedBucket && isValidTopic(suggestedBucket)) {
    bucket = suggestedBucket.toLowerCase();
  } else {
    // Heuristic: if semantic topic contains a legacy keyword, map to that legacy bucket
    const matchedLegacy = LEGACY_TOPICS.find((legacy) => normalizedSemantic.includes(legacy));
    bucket = matchedLegacy || 'dev';
  }

  const normalizedBucket = normalizeName(bucket) || 'dev';

  // 3) Ensure bucket exists
  await ensureBucket(normalizedBucket);

  // 4) Persist mapping
  await setDoc(mappingRef, {
    semanticTopic: normalizedSemantic,
    bucket: normalizedBucket,
    createdAt: Timestamp.now(),
  });

  return normalizedBucket;
}
