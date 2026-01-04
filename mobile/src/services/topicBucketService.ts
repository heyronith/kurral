import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { LEGACY_TOPICS, isValidTopic, type Topic } from '../types';

const normalizeName = (value?: string | null): string | null => {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (!/^[a-z0-9-]{2,50}$/.test(normalized)) return null;
  return normalized;
};

export async function getAllBuckets(): Promise<string[]> {
  const topicsSnap = await getDocs(collection(db, 'topics'));
  const topicNames = topicsSnap.docs.map((docSnap) => docSnap.id.toLowerCase());
  return Array.from(new Set([...LEGACY_TOPICS, ...topicNames]));
}

export async function ensureBucket(bucketName: string): Promise<void> {
  const normalized = normalizeName(bucketName);
  if (!normalized) throw new Error(`Invalid bucket name: ${bucketName}`);
  const topicRef = doc(db, 'topics', normalized);
  const topicSnap = await getDoc(topicRef);
  if (!topicSnap.exists()) {
    await setDoc(topicRef, {
      name: normalized,
      postsLast48h: 0,
      postsLast1h: 0,
      postsLast4h: 0,
      totalUsers: 0,
      lastEngagementUpdate: Timestamp.now(),
      averageVelocity1h: 0,
      isTrending: false,
    });
  }
}

export async function mapSemanticTopicToBucket(
  semanticTopic: string,
  suggestedBucket?: string
): Promise<string> {
  const normalizedSemantic = normalizeName(semanticTopic);
  if (!normalizedSemantic) {
    throw new Error(`Invalid semantic topic: ${semanticTopic}`);
  }

  const mappingRef = doc(db, 'topicMappings', normalizedSemantic);
  const existing = await getDoc(mappingRef);
  if (existing.exists()) {
    const data = existing.data() as { bucket: string };
    return data.bucket;
  }

  let bucket: Topic | string | null = null;
  if (suggestedBucket && isValidTopic(suggestedBucket)) {
    bucket = suggestedBucket.toLowerCase();
  } else {
    const matchedLegacy = LEGACY_TOPICS.find((legacy) => normalizedSemantic.includes(legacy));
    bucket = matchedLegacy || 'dev';
  }

  const normalizedBucket = normalizeName(bucket) || 'dev';

  await ensureBucket(normalizedBucket);

  await setDoc(mappingRef, {
    semanticTopic: normalizedSemantic,
    bucket: normalizedBucket,
    createdAt: Timestamp.now(),
  });

  return normalizedBucket;
}

