import { collection, doc, getDoc, getDocs, limit, orderBy, query, runTransaction, serverTimestamp, setDoc, Timestamp, updateDoc, where } from 'firebase/firestore';
import { chirpService, topicService } from '../firestore';
import { BOT_CONFIG_MAP } from './botConfig';
import { processChirpValue } from './valuePipelineService';
import { isTrustedDomain } from './factCheckAgent';
import type { BotProfileConfig, BotType, NewsArticle, RoutedArticle, Topic } from '../../types';
import { db } from '../firebase';

type BotActivity = {
  dayStart: Date;
  dailyCount: number;
  lastScheduledAt?: Date;
};

type ScheduledBotPost = {
  assignment: RoutedArticle;
  text: string;
  semanticTopics: string[];
  scheduledAt: Date;
  status: 'pending' | 'publishing' | 'published' | 'failed';
};

const BOT_TOPIC_MAP: Record<BotType, Topic> = {
  news: 'politics',
  tech: 'startups',
  science: 'dev',
  finance: 'crypto',
  sports: 'sports',
  entertainment: 'music',
  culture: 'design',
  global: 'politics',
  climate: 'politics',
  lifestyle: 'productivity',
  gaming: 'dev',
  education: 'dev',
};

const DEFAULT_TOPIC: Topic = 'dev';
const DEFAULT_POLL_INTERVAL_MS = 15 * 1000;
const MAX_CLAIMS_PER_CYCLE = 25;
const WORKER_ID = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `worker-${Math.random().toString(36).slice(2)}`;
const scheduledPostsRef = collection(db, 'botScheduledPosts');

const isSameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const parseWindow = (window: string): { startHour: number; startMinute: number; endHour: number; endMinute: number } => {
  const [start, end] = window.split('-').map((segment) => segment.trim());
  const [startHour, startMinute = '00'] = start.split(':');
  const [endHour, endMinute = '00'] = end.split(':');
  return {
    startHour: Number(startHour),
    startMinute: Number(startMinute),
    endHour: Number(endHour),
    endMinute: Number(endMinute),
  };
};

const toWindowStart = (base: Date, window: string): Date => {
  const parsed = parseWindow(window);
  const result = new Date(base);
  result.setHours(parsed.startHour, parsed.startMinute, 0, 0);
  return result;
};

const toWindowEnd = (base: Date, window: string): Date => {
  const parsed = parseWindow(window);
  const result = new Date(base);
  result.setHours(parsed.endHour, parsed.endMinute, 0, 0);
  return result;
};

const findNextActiveTime = (preferences: BotProfileConfig['postingPreferences'], reference: Date): Date | null => {
  if (!preferences.activeHours || preferences.activeHours.length === 0) {
    return reference;
  }

  const candidateTimes: Date[] = [];
  const normalizedReference = new Date(reference);
  normalizedReference.setSeconds(0, 0);

  for (const window of preferences.activeHours) {
    const windowStart = toWindowStart(normalizedReference, window);
    const windowEnd = toWindowEnd(normalizedReference, window);

    if (windowEnd <= windowStart) {
      windowEnd.setDate(windowEnd.getDate() + 1);
    }

    if (normalizedReference <= windowEnd) {
      candidateTimes.push(normalizedReference < windowStart ? windowStart : normalizedReference);
    } else {
      const nextDayStart = new Date(windowStart);
      nextDayStart.setDate(nextDayStart.getDate() + 1);
      candidateTimes.push(nextDayStart);
    }
  }

  candidateTimes.sort((a, b) => a.getTime() - b.getTime());
  return candidateTimes[0] ?? null;
};

const clampTextLength = (text: string): string => {
  const limit = 280;
  if (text.length <= limit) {
    return text;
  }
  return `${text.slice(0, limit - 3)}...`;
};

const normalizeSemanticTopics = (items: string[]): string[] => {
  const normalized = items
    .filter(Boolean)
    .map((item) => item.trim().toLowerCase())
    .map((item) => item.replace(/[^a-z0-9]/g, ''))
    .filter(Boolean);
  return Array.from(new Set(normalized)).slice(0, 10);
};

const buildPostText = (bot: BotProfileConfig, article: NewsArticle, classificationTags: string[], primaryTopic: string): string => {
  const signature = bot.personality.signaturePhrases[0] ?? 'Update:';
  const highlight = article.description || article.content || primaryTopic || '';
  const tags = classificationTags.slice(0, 3).map((tag) => `#${tag.replace(/\s+/g, '')}`).join(' ');
  const base = `${signature} ${article.title}. ${highlight ? `${highlight} ` : ''}Source: ${article.sourceName}. ${article.url}`;
  const withTags = tags ? `${base} ${tags}` : base;
  return clampTextLength(withTags);
};

const mapBotTypeToTopic = (type: BotType): Topic => BOT_TOPIC_MAP[type] ?? DEFAULT_TOPIC;

const botActivityState: Record<string, BotActivity> = {};
let reporter: ReturnType<typeof setInterval> | null = null;

const getActivityForBot = (botId: string, reference: Date): BotActivity => {
  const existing = botActivityState[botId];
  if (!existing) {
    botActivityState[botId] = {
      dayStart: new Date(reference),
      dailyCount: 0,
    };
    return botActivityState[botId];
  }

  if (!isSameDay(existing.dayStart, reference)) {
    existing.dayStart = new Date(reference);
    existing.dailyCount = 0;
  }

  return existing;
};

const schedulePost = (assignment: RoutedArticle, botConfig: BotProfileConfig): ScheduledBotPost | null => {
  const now = new Date();
  const activity = getActivityForBot(botConfig.botId, now);
  if (activity.dailyCount >= botConfig.postingPreferences.dailyFrequency) {
    return null;
  }

  const minGapMs = botConfig.postingPreferences.minGapMinutes * 60 * 1000;
  const earliestAfterGap = activity.lastScheduledAt
    ? new Date(activity.lastScheduledAt.getTime() + minGapMs)
    : new Date(now);

  const candidateBase = earliestAfterGap > now ? earliestAfterGap : now;
  const activeTime = findNextActiveTime(botConfig.postingPreferences, candidateBase);
  if (!activeTime) {
    return null;
  }

  const jitterMs = Math.random() * botConfig.postingPreferences.burstWindowMinutes * 60 * 1000;
  const scheduledAt = new Date(Math.max(activeTime.getTime(), candidateBase.getTime()) + jitterMs);
  const text = buildPostText(botConfig, assignment.article, assignment.classification.tags, assignment.classification.primaryTopic);
  const semanticTopics = normalizeSemanticTopics([
    assignment.classification.primaryTopic,
    ...assignment.classification.secondaryTopics,
    ...assignment.classification.tags,
  ]);

  activity.lastScheduledAt = scheduledAt;
  activity.dailyCount += 1;

  return {
    assignment,
    text,
    semanticTopics,
    scheduledAt,
    status: 'pending',
  };
};

const persistScheduledPost = async (post: ScheduledBotPost): Promise<void> => {
  const docRef = doc(scheduledPostsRef, post.assignment.id);
  const payload = {
    assignment: {
      ...post.assignment,
      // Persist dates as timestamps
      assignedAt: Timestamp.fromDate(new Date(post.assignment.assignedAt)),
      article: {
        ...post.assignment.article,
        publishedAt: Timestamp.fromDate(new Date(post.assignment.article.publishedAt)),
        fetchedAt: Timestamp.fromDate(new Date(post.assignment.article.fetchedAt)),
      },
    },
    text: post.text,
    semanticTopics: post.semanticTopics,
    scheduledAt: Timestamp.fromDate(post.scheduledAt),
    status: 'pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(docRef, payload, { merge: false });
};

const claimDuePosts = async (): Promise<ScheduledBotPost[]> => {
  const now = Timestamp.now();
  const q = query(
    scheduledPostsRef,
    where('status', '==', 'pending'),
    where('scheduledAt', '<=', now),
    orderBy('scheduledAt', 'asc'),
    limit(MAX_CLAIMS_PER_CYCLE)
  );

  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    return [];
  }

  const claimed: ScheduledBotPost[] = [];

  for (const docSnap of snapshot.docs) {
    try {
      await runTransaction(db, async (tx) => {
        const fresh = await tx.get(docSnap.ref);
        if (!fresh.exists()) {
          return;
        }
        const data = fresh.data() as any;
        if (data.status !== 'pending') {
    return;
  }

        tx.update(docSnap.ref, {
          status: 'publishing',
          claimedAt: serverTimestamp(),
          claimedBy: WORKER_ID,
          updatedAt: serverTimestamp(),
        });

        claimed.push({
          assignment: {
            ...data.assignment,
            assignedAt: data.assignment?.assignedAt?.toDate
              ? data.assignment.assignedAt.toDate()
              : new Date(data.assignment?.assignedAt),
            article: {
              ...data.assignment.article,
              publishedAt: data.assignment.article?.publishedAt?.toDate
                ? data.assignment.article.publishedAt.toDate()
                : new Date(data.assignment.article?.publishedAt),
              fetchedAt: data.assignment.article?.fetchedAt?.toDate
                ? data.assignment.article.fetchedAt.toDate()
                : new Date(data.assignment.article?.fetchedAt),
            },
          },
          text: data.text,
          semanticTopics: data.semanticTopics || [],
          scheduledAt: data.scheduledAt?.toDate ? data.scheduledAt.toDate() : new Date(data.scheduledAt),
          status: 'publishing',
        });
      });
    } catch (error) {
      console.error('[BotPostService] Failed to claim scheduled post:', error);
    }
  }

  return claimed;
};

const dispatchDuePosts = async (): Promise<number> => {
  const duePosts = await claimDuePosts();
  if (duePosts.length === 0) {
    return 0;
  }

  for (const post of duePosts) {
    try {
      const newChirp = await chirpService.createChirp({
        authorId: post.assignment.assignedBotId,
        text: post.text,
        topic: mapBotTypeToTopic(post.assignment.classification.botType),
        reachMode: 'forAll',
        semanticTopics: post.semanticTopics,
      });

      const docRef = doc(scheduledPostsRef, post.assignment.id);
      await updateDoc(docRef, {
        status: 'published',
        publishedAt: serverTimestamp(),
        chirpId: newChirp.id,
        updatedAt: serverTimestamp(),
      });

      // Increment topic engagement (async, don't wait)
      const engagementTopics = new Set(
        [newChirp.topic, ...(newChirp.semanticTopics || [])]
          .map((topic) => topic?.trim().toLowerCase())
          .filter((topic): topic is string => Boolean(topic))
      );

      if (engagementTopics.size > 0) {
        topicService
          .incrementTopicEngagement(Array.from(engagementTopics))
          .catch((error) => {
            console.error('[BotPostService] Error incrementing topic engagement:', error);
          });
      }

      // Trigger fact-checking pipeline (async, don't wait)
      const skipFactCheck = isTrustedDomain(post.assignment.article.url);
      processChirpValue(newChirp, { skipFactCheck })
        .then((enrichedChirp) => {
          console.log(`[BotPostService] Fact-checking completed for bot post ${enrichedChirp.id}`);
        })
        .catch((error) => {
          console.error('[BotPostService] Failed to process bot post value:', error);
        });
    } catch (error) {
      console.error('[BotPostService] Failed to publish bot post:', error);
      const docRef = doc(scheduledPostsRef, post.assignment.id);
      await updateDoc(docRef, {
        status: 'failed',
        failureReason: (error as any)?.message || 'Unknown error',
        updatedAt: serverTimestamp(),
      });
    }
  }

  return duePosts.length;
};

const runDispatcher = (): void => {
  dispatchDuePosts().catch((error) => console.error('[BotPostService] Dispatch failed:', error));
};

export const botPostService = {
  enqueue(assignments: RoutedArticle[]): void {
    if (assignments.length === 0) {
      return;
    }

    let enqueuedCount = 0;
    let skippedCount = 0;

    const tasks = assignments.map(async (assignment) => {
      const botConfig = BOT_CONFIG_MAP.get(assignment.assignedBotId);
      if (!botConfig) {
        console.warn(`[BotPostService] No bot config found for ${assignment.assignedBotId}, skipping assignment.`);
        skippedCount++;
        return;
      }

      const docRef = doc(scheduledPostsRef, assignment.id);
      const existing = await getDoc(docRef);
      if (existing.exists()) {
        skippedCount++;
        return;
      }

      const scheduled = schedulePost(assignment, botConfig);
      if (!scheduled) {
        skippedCount++;
        return;
      }

      await persistScheduledPost(scheduled);
      enqueuedCount++;
    });

    Promise.all(tasks)
      .then(() => {
        if (enqueuedCount > 0) {
          console.log(`[BotPostService] Enqueued ${enqueuedCount} posts, skipped ${skippedCount} assignments.`);
        } else {
          console.log('[BotPostService] No posts enqueued.');
        }
      })
      .catch((error) => {
        console.error('[BotPostService] Failed to enqueue posts:', error);
      });
  },

  start(pollIntervalMs: number = DEFAULT_POLL_INTERVAL_MS): { success: boolean; reason?: string } {
    this.stop();

    if (BOT_CONFIG_MAP.size === 0) {
      const reason = 'BOT_CONFIG_MAP is empty. Cannot start bot post service without bot configurations.';
      console.error(`[BotPostService] ${reason}`);
      return { success: false, reason };
    }

    runDispatcher();
    reporter = setInterval(runDispatcher, pollIntervalMs);
    console.log(`[BotPostService] Started with poll interval: ${pollIntervalMs}ms (worker: ${WORKER_ID})`);
    return { success: true };
  },

  stop(): void {
    if (reporter) {
      clearInterval(reporter);
      reporter = null;
      console.log('[BotPostService] Stopped');
    }
  },

  async dispatchDuePostsOnce(): Promise<{ dispatched: number }> {
    const count = await dispatchDuePosts();
    return { dispatched: count };
  },
};

