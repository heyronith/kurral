import * as functions from 'firebase-functions/v2';
import * as functionsV1 from 'firebase-functions';
import * as admin from 'firebase-admin';
import { Resend } from 'resend';
import Parser from 'rss-parser';
import type { Chirp, Comment } from './types';
import { processChirp, processComment } from './services/pipeline';
import { chirpService } from './services/firestoreService';
import { validateEngagementPredictions } from './services/validationService';
import { getReachAgent } from './agents/reachAgent';

// Firebase Admin is initialized in firestoreService.ts
// No need to initialize here to avoid duplicate initialization

const db = admin.firestore();
let resendClient: Resend | null = null;

// Aggregation window (15 minutes in milliseconds)
const AGGREGATION_WINDOW_MS = 15 * 60 * 1000;

// Rate limiting: max notifications per user per hour
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const MAX_NOTIFICATIONS_PER_HOUR = 100;

type Priority = 'high' | 'medium' | 'low';

interface NotificationData {
  userId: string;
  type: 'comment' | 'reply' | 'rechirp' | 'follow' | 'mention';
  actorId: string;
  chirpId?: string;
  commentId?: string;
  metadata?: {
    parentCommentId?: string;
    originalPostAuthorId?: string;
    originalChirpId?: string;
  };
}

interface NotificationPreferences {
  commentNotifications: boolean;
  replyNotifications: boolean;
  rechirpNotifications: boolean;
  followNotifications: boolean;
  mentionNotifications: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  mutedUserIds: string[];
  mutedChirpIds: string[];
  mutedThreadIds: string[];
}

function getResendClient(): Resend {
  if (resendClient) return resendClient;
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY not configured');
  }
  resendClient = new Resend(process.env.RESEND_API_KEY);
  return resendClient;
}

/**
 * Build push notification payload (title/body/url)
 */
function buildPushPayload(
  data: NotificationData,
  notificationId: string,
  actorName: string
): { title: string; body: string; url: string; data: Record<string, string> } {
  let title = 'New notification';
  let body = 'You have a new notification';
  let url = '/';

  switch (data.type) {
    case 'comment':
      title = `${actorName} commented on your post`;
      body = 'Tap to view the comment';
      url = data.chirpId ? `/post/${data.chirpId}` : '/';
      break;
    case 'reply':
      title = `${actorName} replied to your comment`;
      body = 'Tap to view the reply';
      url = data.chirpId ? `/post/${data.chirpId}` : '/';
      break;
    case 'rechirp':
      title = `${actorName} reposted your post`;
      body = 'Tap to view the repost';
      url = data.chirpId ? `/post/${data.chirpId}` : '/';
      break;
    case 'follow':
      title = `${actorName} followed you`;
      body = 'See their profile';
      url = data.actorId ? `/profile/${data.actorId}` : '/';
      break;
    case 'mention':
      title = `${actorName} mentioned you`;
      body = 'Tap to view the mention';
      url = data.chirpId ? `/post/${data.chirpId}` : '/';
      break;
    default:
      title = 'New notification';
      body = 'You have a new notification';
      url = '/';
  }

  return {
    title,
    body,
    url,
    data: {
      notificationId,
      type: data.type,
      userId: data.userId,
      actorId: data.actorId,
      chirpId: data.chirpId || '',
      commentId: data.commentId || '',
      url,
    },
  };
}

/**
 * Get default notification preferences
 */
function getDefaultPreferences(): NotificationPreferences {
  return {
    commentNotifications: true,
    replyNotifications: true,
    rechirpNotifications: true,
    followNotifications: true,
    mentionNotifications: true,
    mutedUserIds: [],
    mutedChirpIds: [],
    mutedThreadIds: [],
  };
}

/**
 * Check if quiet hours are active
 */
function isQuietHoursActive(preferences: NotificationPreferences | null): boolean {
  if (!preferences?.quietHoursStart || !preferences?.quietHoursEnd) {
    return false;
  }
  
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTime = currentHour * 60 + currentMinute; // Minutes since midnight
  
  const [startHour, startMin] = preferences.quietHoursStart.split(':').map(Number);
  const [endHour, endMin] = preferences.quietHoursEnd.split(':').map(Number);
  const startTime = startHour * 60 + startMin;
  const endTime = endHour * 60 + endMin;
  
  // Handle case where quiet hours span midnight
  if (startTime > endTime) {
    return currentTime >= startTime || currentTime < endTime;
  }
  
  return currentTime >= startTime && currentTime < endTime;
}

/**
 * Check if notification type is enabled for user
 */
function isNotificationTypeEnabled(
  type: NotificationData['type'],
  preferences: NotificationPreferences | null
): boolean {
  if (!preferences) return true; // Default to enabled
  
  switch (type) {
    case 'comment':
      return preferences.commentNotifications;
    case 'reply':
      return preferences.replyNotifications;
    case 'rechirp':
      return preferences.rechirpNotifications;
    case 'follow':
      return preferences.followNotifications;
    case 'mention':
      return preferences.mentionNotifications;
    default:
      return true;
  }
}

/**
 * Validate that the actor actually performed the action
 */
async function validateNotificationRequest(data: NotificationData, actorId: string): Promise<void> {
  const { type, userId, actorId: dataActorId, chirpId, commentId } = data;

  // Actor ID must match authenticated user
  if (dataActorId !== actorId) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Actor ID must match authenticated user'
    );
  }

  // Validate based on notification type
  switch (type) {
    case 'follow': {
      // Verify that actor actually follows the user
      const actorDoc = await db.collection('users').doc(actorId).get();
      if (!actorDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Actor user not found');
      }
      const actorData = actorDoc.data();
      if (!actorData?.following?.includes(userId)) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'Actor does not follow the target user'
        );
      }
      break;
    }

    case 'comment': {
      if (!chirpId || !commentId) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'chirpId and commentId required for comment notifications'
        );
      }
      // Verify comment exists and actor is the author
      const commentDoc = await db.collection('comments').doc(commentId).get();
      if (!commentDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Comment not found');
      }
      const commentData = commentDoc.data();
      if (commentData?.authorId !== actorId) {
        throw new functions.https.HttpsError(
          'permission-denied',
          'Comment author does not match actor'
        );
      }
      if (commentData?.chirpId !== chirpId) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Comment does not belong to specified chirp'
        );
      }
      // Verify chirp exists and belongs to recipient
      const chirpDoc = await db.collection('chirps').doc(chirpId).get();
      if (!chirpDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Chirp not found');
      }
      const chirpData = chirpDoc.data();
      if (chirpData?.authorId !== userId) {
        throw new functions.https.HttpsError(
          'permission-denied',
          'Chirp does not belong to notification recipient'
        );
      }
      break;
    }

    case 'reply': {
      if (!chirpId || !commentId || !data.metadata?.parentCommentId) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'chirpId, commentId, and parentCommentId required for reply notifications'
        );
      }
      // Verify reply comment exists and actor is the author
      const replyDoc = await db.collection('comments').doc(commentId).get();
      if (!replyDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Reply comment not found');
      }
      const replyData = replyDoc.data();
      if (replyData?.authorId !== actorId) {
        throw new functions.https.HttpsError(
          'permission-denied',
          'Reply author does not match actor'
        );
      }
      if (replyData?.parentCommentId !== data.metadata.parentCommentId) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Reply does not belong to specified parent comment'
        );
      }
      // Verify parent comment exists and belongs to recipient
      const parentDoc = await db.collection('comments').doc(data.metadata.parentCommentId).get();
      if (!parentDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Parent comment not found');
      }
      const parentData = parentDoc.data();
      if (parentData?.authorId !== userId) {
        throw new functions.https.HttpsError(
          'permission-denied',
          'Parent comment does not belong to notification recipient'
        );
      }
      break;
    }

    case 'rechirp': {
      if (!chirpId) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'chirpId required for rechirp notifications'
        );
      }
      // Verify original chirp exists and belongs to recipient
      const chirpDoc = await db.collection('chirps').doc(chirpId).get();
      if (!chirpDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Chirp not found');
      }
      const chirpData = chirpDoc.data();
      if (chirpData?.authorId !== userId) {
        throw new functions.https.HttpsError(
          'permission-denied',
          'Chirp does not belong to notification recipient'
        );
      }
      // Verify actor has a rechirp of this chirp
      const rechirpsQuery = await db
        .collection('chirps')
        .where('rechirpOfId', '==', chirpId)
        .where('authorId', '==', actorId)
        .limit(1)
        .get();
      if (rechirpsQuery.empty) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'Actor has not rechirped this post'
        );
      }
      break;
    }

    case 'mention': {
      if (!chirpId) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'chirpId required for mention notifications'
        );
      }
      // Verify chirp exists and actor is the author
      const chirpDoc = await db.collection('chirps').doc(chirpId).get();
      if (!chirpDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Chirp not found');
      }
      const chirpData = chirpDoc.data();
      if (chirpData?.authorId !== actorId) {
        throw new functions.https.HttpsError(
          'permission-denied',
          'Chirp author does not match actor'
        );
      }
      // Verify user is mentioned in the chirp
      if (!chirpData?.mentions?.includes(userId)) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'User is not mentioned in the chirp'
        );
      }
      break;
    }

    default:
      throw new functions.https.HttpsError(
        'invalid-argument',
        `Unknown notification type: ${type}`
      );
  }
}

/**
 * Check rate limiting for notifications
 */
async function checkRateLimit(actorId: string, userId: string): Promise<void> {
  const oneHourAgo = Date.now() - RATE_LIMIT_WINDOW_MS;
  const oneHourAgoTimestamp = admin.firestore.Timestamp.fromMillis(oneHourAgo);

  const recentNotifications = await db
    .collection('notifications')
    .where('userId', '==', userId)
    .where('actorId', '==', actorId)
    .where('createdAt', '>=', oneHourAgoTimestamp)
    .get();

  if (recentNotifications.size >= MAX_NOTIFICATIONS_PER_HOUR) {
    throw new functions.https.HttpsError(
      'resource-exhausted',
      'Rate limit exceeded: too many notifications from this actor'
    );
  }
}

/**
 * Try to aggregate notification with existing unread notification
 */
async function tryAggregateNotification(
  data: NotificationData
): Promise<admin.firestore.DocumentReference | null> {
  try {
    const now = Date.now();
    const windowStart = now - AGGREGATION_WINDOW_MS;
    const windowStartTimestamp = admin.firestore.Timestamp.fromMillis(windowStart);

    // Find unread notifications of same type in aggregation window
    let query = db
      .collection('notifications')
      .where('userId', '==', data.userId)
      .where('type', '==', data.type)
      .where('read', '==', false)
      .where('dismissed', '==', false)
      .where('createdAt', '>=', windowStartTimestamp)
      .orderBy('createdAt', 'desc')
      .limit(10);

    const snapshot = await query.get();

    // Find matching notification (same chirpId or commentId, depending on type)
    for (const docSnap of snapshot.docs) {
      const existing = docSnap.data();
      const existingTime = existing.createdAt.toMillis();

      // Check if within aggregation window
      if (existingTime < windowStart) {
        continue;
      }

      // Check if same target (chirpId for comments/rechirps, commentId for replies)
      let canAggregate = false;

      if (data.type === 'comment' || data.type === 'rechirp') {
        canAggregate = existing.chirpId === data.chirpId;
      } else if (data.type === 'reply') {
        const existingParentId = existing.metadata?.parentCommentId;
        const newParentId = data.metadata?.parentCommentId;
        canAggregate = Boolean(
          existingParentId && newParentId && existingParentId === newParentId
        );

        // Also aggregate if replying to same comment
        if (!canAggregate && existing.commentId && data.metadata?.parentCommentId) {
          canAggregate = existing.commentId === data.metadata.parentCommentId;
        }
      } else if (data.type === 'follow') {
        // Don't aggregate follows - always create separate notifications
        continue;
      }

      if (canAggregate) {
        // Update existing notification with aggregated count
        const currentActorIds = existing.aggregatedActorIds || [existing.actorId];

        // Don't double-count same actor
        if (!currentActorIds.includes(data.actorId)) {
          currentActorIds.push(data.actorId);
        }

        // Count is based on number of unique actors
        const newCount = currentActorIds.length;

        await docSnap.ref.update({
          aggregatedCount: newCount,
          aggregatedActorIds: currentActorIds,
          createdAt: admin.firestore.FieldValue.serverTimestamp(), // Update to most recent time
        });

        return docSnap.ref;
      }
    }

    return null; // No aggregation possible
  } catch (error: any) {
    console.error('Error trying to aggregate notification:', error);
    return null; // Fail gracefully, will create new notification
  }
}

/**
 * Create notification callable function
 * This function validates the notification request server-side and creates the notification
 */
export const createNotification = functions.https.onCall(
  { cors: true, maxInstances: 10, memory: '256MiB' },
  async (request) => {
    // Verify authentication
    if (!request.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated to create notifications'
      );
    }

    const actorId = request.auth.uid;
    const data = request.data as NotificationData;

    // Validate required fields
    if (!data.userId || !data.type || !data.actorId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Missing required fields: userId, type, actorId'
      );
    }

    // Don't notify yourself
    if (data.userId === actorId) {
      return { success: false, skipped: true, reason: 'self-notification' };
    }

    try {
      // Validate that the actor actually performed the action
      await validateNotificationRequest(data, actorId);

      // Check rate limiting
      await checkRateLimit(actorId, data.userId);

      // Load user preferences
      const prefsDoc = await db
        .collection('users')
        .doc(data.userId)
        .collection('preferences')
        .doc('notifications')
        .get();

      const preferences: NotificationPreferences = prefsDoc.exists
        ? {
            ...getDefaultPreferences(),
            ...prefsDoc.data(),
          }
        : getDefaultPreferences();

      // Check if notification type is enabled
      if (!isNotificationTypeEnabled(data.type, preferences)) {
        return { success: false, skipped: true, reason: 'type-disabled' };
      }

      // Check if quiet hours are active
      if (isQuietHoursActive(preferences)) {
        return { success: false, skipped: true, reason: 'quiet-hours' };
      }

      // Check if actor is muted
      if (preferences.mutedUserIds.includes(actorId)) {
        return { success: false, skipped: true, reason: 'actor-muted' };
      }

      // Check if chirp is muted (for comment/rechirp notifications)
      if (data.chirpId && preferences.mutedChirpIds.includes(data.chirpId)) {
        return { success: false, skipped: true, reason: 'chirp-muted' };
      }

      // Check if thread is muted (for reply notifications)
      if (
        data.metadata?.parentCommentId &&
        preferences.mutedThreadIds.includes(data.metadata.parentCommentId)
      ) {
        return { success: false, skipped: true, reason: 'thread-muted' };
      }

      // Try to aggregate with existing notification
      const aggregatedRef = await tryAggregateNotification(data);
      if (aggregatedRef) {
        const aggregatedDoc = await aggregatedRef.get();
        return {
          success: true,
          aggregated: true,
          notificationId: aggregatedRef.id,
          notification: {
            id: aggregatedRef.id,
            ...aggregatedDoc.data(),
          },
        };
      }

      // Create new notification
      const notificationData: any = {
        userId: data.userId,
        type: data.type,
        actorId: data.actorId,
        read: false,
        dismissed: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      if (data.chirpId) notificationData.chirpId = data.chirpId;
      if (data.commentId) notificationData.commentId = data.commentId;
      if (data.metadata) notificationData.metadata = data.metadata;

      const docRef = await db.collection('notifications').add(notificationData);

      // Send push notifications if tokens exist
      try {
        // Get actor name for nicer messages
        const actorDoc = await db.collection('users').doc(data.actorId).get();
        const actorName = actorDoc.exists && actorDoc.data()?.name ? actorDoc.data()!.name : 'Someone';

        const tokensSnap = await db
          .collection('users')
          .doc(data.userId)
          .collection('pushTokens')
          .get();

        const tokens: string[] = [];
        tokensSnap.forEach((t) => {
          const token = (t.data() as any)?.token || t.id;
          if (token) tokens.push(token);
        });

        if (tokens.length > 0) {
          const payload = buildPushPayload(data, docRef.id, actorName);
          const response = await admin.messaging().sendEachForMulticast({
            tokens,
            notification: {
              title: payload.title,
              body: payload.body,
            },
            data: payload.data,
            webpush: {
              fcmOptions: {
                link: payload.url,
              },
            },
          });

          // Cleanup invalid tokens
          if (response.failureCount > 0) {
            response.responses.forEach((res, idx) => {
              if (!res.success) {
                const code = res.error?.code || '';
                if (code.includes('registration-token-not-registered') || code.includes('invalid-argument')) {
                  const badToken = tokens[idx];
                  if (badToken) {
                    db.collection('users')
                      .doc(data.userId)
                      .collection('pushTokens')
                      .doc(badToken)
                      .delete()
                      .catch((cleanupErr) => console.error('Error removing bad token', cleanupErr));
                  }
                }
              }
            });
          }
        }
      } catch (pushError) {
        console.error('Error sending push notification:', pushError);
        // Do not fail the main request if push fails
      }

      return {
        success: true,
        aggregated: false,
        notificationId: docRef.id,
      };
    } catch (error: any) {
      console.error('Error creating notification:', error);
      
      // If it's already an HttpsError, re-throw it
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      
      // Otherwise, wrap it
      throw new functions.https.HttpsError(
        'internal',
        `Failed to create notification: ${error.message}`
      );
    }
  }
);

/**
 * Send review request email via Resend
 */
export const sendReviewRequestEmail = functions.https.onCall(
  { cors: true, maxInstances: 10, memory: '256MiB' },
  async (request) => {
    if (!request.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Auth required');
    }
    if (!process.env.RESEND_API_KEY) {
      throw new functions.https.HttpsError('failed-precondition', 'RESEND_API_KEY not configured');
    }

    const {
      to,
      userName,
      topic,
      postPreview,
      claim,
      claimType,
      domain,
      riskLevel,
      postedAgo,
      engagementSummary,
      currentReviews,
      totalReviews,
      timeSinceMarked,
      nextReviewWindowHours,
      priority,
      reviewUrl,
      viewPostUrl,
    } = request.data || {};

    if (!to || !reviewUrl || !postPreview) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing required fields (to, reviewUrl, postPreview)');
    }

    const safe = (val: string | undefined, fallback = '') =>
      typeof val === 'string' ? val : fallback;

    const subjectPreview = postPreview.slice(0, 50).trim();
    const subject = `Review Request: ${subjectPreview || 'Post needs review'}`;

    const priorityBadge = (() => {
      switch (priority) {
        case 'high':
          return '🔴 HIGH PRIORITY';
        case 'medium':
          return '🟡 MEDIUM PRIORITY';
        default:
          return '🔵 LOW PRIORITY';
      }
    })();

    const html = `
      <div style="font-family: Arial, sans-serif; color: #111; max-width: 640px; margin: 0 auto;">
        <p style="margin:0 0 12px;">Hi ${safe(userName, 'there')},</p>
        <p style="margin:0 0 12px;">Your interest in <strong>${safe(topic, 'this topic')}</strong> makes you ideal to review this post.</p>

        <div style="margin:16px 0; padding:10px 12px; border-radius:8px; background:#f4f6fb; font-weight:600;">
          ${priorityBadge} ${nextReviewWindowHours ? `· Needs review within ${nextReviewWindowHours}h` : ''}
        </div>

        <h3 style="margin:12px 0 6px;">📝 Post</h3>
        <p style="margin:0 0 12px; line-height:1.5;">"${safe(postPreview).slice(0, 200)}${postPreview.length > 200 ? '…' : ''}"</p>

        ${claim ? `
          <h3 style="margin:12px 0 6px;">⚠️ Claim requiring verification</h3>
          <p style="margin:0 0 12px; line-height:1.5;">"${safe(claim)}"</p>
        ` : ''}

        <h3 style="margin:12px 0 6px;">📊 Details</h3>
        <ul style="margin:0 0 12px; padding-left:18px; line-height:1.6;">
          <li>Claim Type: ${safe(claimType, 'Fact')}</li>
          <li>Domain: ${safe(domain, 'General')}</li>
          <li>Risk Level: ${safe(riskLevel, 'Unknown')}</li>
          ${postedAgo ? `<li>Posted: ${postedAgo} ago</li>` : ''}
          ${engagementSummary ? `<li>Engagement: ${engagementSummary}</li>` : ''}
        </ul>

        <h3 style="margin:12px 0 6px;">⏱️ Review Status</h3>
        <ul style="margin:0 0 16px; padding-left:18px; line-height:1.6;">
          ${currentReviews && totalReviews ? `<li>Current reviews: ${currentReviews} of ${totalReviews} needed</li>` : ''}
          ${timeSinceMarked ? `<li>Time since marked: ${timeSinceMarked}</li>` : ''}
          ${nextReviewWindowHours ? `<li>Next review needed: Within ${nextReviewWindowHours} hours</li>` : ''}
        </ul>

        <p style="margin:0 0 16px; line-height:1.6;">
          Your expertise in <strong>${safe(topic, 'this topic')}</strong> can help verify its accuracy.
        </p>

        <div style="margin:20px 0;">
          <a href="${reviewUrl}" style="display:inline-block; background:#2563eb; color:#fff; padding:12px 18px; border-radius:8px; text-decoration:none; font-weight:600;">
            REVIEW NOW →
          </a>
        </div>
        ${viewPostUrl ? `<p style="margin:0 0 20px;"><a href="${viewPostUrl}" style="color:#2563eb; text-decoration:none;">Or view the post first</a></p>` : ''}

        <hr style="border:none; border-top:1px solid #eee; margin:24px 0;">
        <p style="margin:0 0 8px; font-size:13px; color:#666;">
          You received this because your expertise and KurralScore make you a trusted reviewer. Help keep the feed accurate.
        </p>
      </div>
    `;

    const text = `
Hi ${safe(userName, 'there')},

Your interest in ${safe(topic, 'this topic')} makes you ideal to review this post.

${priorityBadge} ${nextReviewWindowHours ? `· Needs review within ${nextReviewWindowHours}h` : ''}

Post:
"${safe(postPreview).slice(0, 200)}${postPreview.length > 200 ? '…' : ''}"

${claim ? `Claim requiring verification:\n"${safe(claim)}"\n\n` : ''}
Details:
- Claim Type: ${safe(claimType, 'Fact')}
- Domain: ${safe(domain, 'General')}
- Risk Level: ${safe(riskLevel, 'Unknown')}
${postedAgo ? `- Posted: ${postedAgo} ago` : ''}
${engagementSummary ? `- Engagement: ${engagementSummary}` : ''}

Review Status:
${currentReviews && totalReviews ? `- Current reviews: ${currentReviews} of ${totalReviews} needed\n` : ''}${timeSinceMarked ? `- Time since marked: ${timeSinceMarked}\n` : ''}${nextReviewWindowHours ? `- Next review needed: Within ${nextReviewWindowHours} hours\n` : ''}

Your expertise in ${safe(topic, 'this topic')} can help verify its accuracy.

Review now: ${reviewUrl}
${viewPostUrl ? `View the post: ${viewPostUrl}` : ''}
    `;

    try {
      const resend = getResendClient();
      const result = await resend.emails.send({
        from: 'Kurral Reviews <reviews@notifications.kurral.app>',
        to,
        subject,
        html,
        text,
      });
      return { success: true, id: result.data?.id || null };
    } catch (error: any) {
      console.error('Error sending review request email:', error);
      throw new functions.https.HttpsError('internal', error?.message || 'Failed to send email');
    }
  }
);

// Direct helper (internal) to send review request email
async function sendReviewRequestEmailDirect(payload: {
  to: string;
  userName: string;
  topic: string;
  postPreview: string;
  claim?: string;
  claimType?: string;
  domain?: string;
  riskLevel?: string;
  postedAgo?: string;
  engagementSummary?: string;
  currentReviews?: number;
  totalReviews?: number;
  timeSinceMarked?: string;
  nextReviewWindowHours?: number;
  priority?: Priority;
  reviewUrl: string;
  viewPostUrl?: string;
}) {
  const safeLocal = (val: any, fallback = '') => (typeof val === 'string' ? val : fallback);
  const {
    to,
    userName,
    topic,
    postPreview,
    claim,
    claimType,
    domain,
    riskLevel,
    postedAgo,
    engagementSummary,
    currentReviews,
    totalReviews,
    timeSinceMarked,
    nextReviewWindowHours,
    priority,
    reviewUrl,
    viewPostUrl,
  } = payload;

  const subjectPreview = postPreview.slice(0, 50).trim();
  const subject = `Review Request: ${subjectPreview || 'Post needs review'}`;
  const badge = (() => {
    switch (priority) {
      case 'high':
        return '🔴 HIGH PRIORITY';
      case 'medium':
        return '🟡 MEDIUM PRIORITY';
      default:
        return '🔵 LOW PRIORITY';
    }
  })();

  const html = `
    <div style="font-family: Arial, sans-serif; color: #111; max-width: 640px; margin: 0 auto;">
      <p style="margin:0 0 12px;">Hi ${safeLocal(userName, 'there')},</p>
      <p style="margin:0 0 12px;">Your interest in <strong>${safeLocal(topic, 'this topic')}</strong> makes you ideal to review this post.</p>

      <div style="margin:16px 0; padding:10px 12px; border-radius:8px; background:#f4f6fb; font-weight:600;">
        ${badge} ${nextReviewWindowHours ? `· Needs review within ${nextReviewWindowHours}h` : ''}
      </div>

      <h3 style="margin:12px 0 6px;">📝 Post</h3>
      <p style="margin:0 0 12px; line-height:1.5;">"${safeLocal(postPreview).slice(0, 200)}${postPreview.length > 200 ? '…' : ''}"</p>

      ${claim ? `
        <h3 style="margin:12px 0 6px;">⚠️ Claim requiring verification</h3>
        <p style="margin:0 0 12px; line-height:1.5;">"${safeLocal(claim)}"</p>
      ` : ''}

      <h3 style="margin:12px 0 6px;">📊 Details</h3>
      <ul style="margin:0 0 12px; padding-left:18px; line-height:1.6;">
        <li>Claim Type: ${safeLocal(claimType, 'Fact')}</li>
        <li>Domain: ${safeLocal(domain, 'General')}</li>
        <li>Risk Level: ${safeLocal(riskLevel, 'Unknown')}</li>
        ${postedAgo ? `<li>Posted: ${postedAgo} ago</li>` : ''}
        ${engagementSummary ? `<li>Engagement: ${engagementSummary}</li>` : ''}
      </ul>

      <h3 style="margin:12px 0 6px;">⏱️ Review Status</h3>
      <ul style="margin:0 0 16px; padding-left:18px; line-height:1.6;">
        ${currentReviews && totalReviews ? `<li>Current reviews: ${currentReviews} of ${totalReviews} needed</li>` : ''}
        ${timeSinceMarked ? `<li>Time since marked: ${timeSinceMarked}</li>` : ''}
        ${nextReviewWindowHours ? `<li>Next review needed: Within ${nextReviewWindowHours} hours</li>` : ''}
      </ul>

      <p style="margin:0 0 16px; line-height:1.6;">
        Your expertise in <strong>${safeLocal(topic, 'this topic')}</strong> can help verify its accuracy.
      </p>

      <div style="margin:20px 0;">
        <a href="${reviewUrl}" style="display:inline-block; background:#2563eb; color:#fff; padding:12px 18px; border-radius:8px; text-decoration:none; font-weight:600;">
          REVIEW NOW →
        </a>
      </div>
      ${viewPostUrl ? `<p style="margin:0 0 20px;"><a href="${viewPostUrl}" style="color:#2563eb; text-decoration:none;">Or view the post first</a></p>` : ''}

      <hr style="border:none; border-top:1px solid #eee; margin:24px 0;">
      <p style="margin:0 0 8px; font-size:13px; color:#666;">
        You received this because your expertise and KurralScore make you a trusted reviewer. Help keep the feed accurate.
      </p>
    </div>
  `;

  const text = `
Hi ${safeLocal(userName, 'there')},

Your interest in ${safeLocal(topic, 'this topic')} makes you ideal to review this post.

${badge} ${nextReviewWindowHours ? `· Needs review within ${nextReviewWindowHours}h` : ''}

Post:
"${safeLocal(postPreview).slice(0, 200)}${postPreview.length > 200 ? '…' : ''}"

${claim ? `Claim requiring verification:\n"${safeLocal(claim)}"\n\n` : ''}
Details:
- Claim Type: ${safeLocal(claimType, 'Fact')}
- Domain: ${safeLocal(domain, 'General')}
- Risk Level: ${safeLocal(riskLevel, 'Unknown')}
${postedAgo ? `- Posted: ${postedAgo} ago` : ''}
${engagementSummary ? `- Engagement: ${engagementSummary}` : ''}

Review Status:
${currentReviews && totalReviews ? `- Current reviews: ${currentReviews} of ${totalReviews} needed\n` : ''}${timeSinceMarked ? `- Time since marked: ${timeSinceMarked}\n` : ''}${nextReviewWindowHours ? `- Next review needed: Within ${nextReviewWindowHours} hours\n` : ''}

Your expertise in ${safeLocal(topic, 'this topic')} can help verify its accuracy.

Review now: ${reviewUrl}
${viewPostUrl ? `View the post: ${viewPostUrl}` : ''}
  `;

  const resend = getResendClient();
  const result = await resend.emails.send({
    from: 'Kurral Reviews <reviews@notifications.kurral.app>',
    to,
    subject,
    html,
    text,
  });
  return result.data?.id || null;
}
// ---------- Automated review request email pipeline ----------

function priorityFromTopic(topic: string): Priority {
  const t = topic.toLowerCase();
  if (['health', 'finance', 'politics'].includes(t)) return 'high';
  return 'medium';
}

function formatAgo(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'}`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'}`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days === 1 ? '' : 's'}`;
}

async function recentlySentReviewEmail(userId: string, chirpId: string): Promise<boolean> {
  const docRef = db.collection('users').doc(userId).collection('reviewRequestEmails').doc(chirpId);
  const snap = await docRef.get();
  if (!snap.exists) return false;
  const data = snap.data() || {};
  const ts = data.createdAt?.toDate ? data.createdAt.toDate() : null;
  if (!ts) return false;
  return Date.now() - ts.getTime() < 24 * 60 * 60 * 1000;
}

async function logReviewEmail(userId: string, chirpId: string) {
  const docRef = db.collection('users').doc(userId).collection('reviewRequestEmails').doc(chirpId);
  await docRef.set({
    chirpId,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

async function findReviewersForChirp(chirp: any): Promise<Array<{ userId: string; email: string; name: string; score: number }>> {
  const usersSnap = await db.collection('users').limit(200).get();
  const topic = (chirp.topic || 'general').toLowerCase();
  const semanticTopics: string[] = Array.isArray(chirp.semanticTopics) ? chirp.semanticTopics : [];
  const semLower = semanticTopics.map((t) => (typeof t === 'string' ? t.toLowerCase() : '')).filter(Boolean);
  const reviewers: Array<{ userId: string; email: string; name: string; score: number }> = [];

  usersSnap.forEach((doc) => {
    const data = doc.data();
    const email = data.email as string | undefined;
    if (!email) return;
    const kurralScore = data.kurralScore?.score ?? 0;
    if (kurralScore < 70) return;

    const interests: string[] = Array.isArray(data.interests) ? data.interests : [];
    const topics: string[] = Array.isArray(data.topics) ? data.topics : [];
    const interestLower = interests.map((i) => (typeof i === 'string' ? i.toLowerCase() : '')).filter(Boolean);
    const topicLower = topics.map((i) => (typeof i === 'string' ? i.toLowerCase() : '')).filter(Boolean);

    let score = 0;
    if (topic && topicLower.includes(topic)) score += 40;
    semLower.forEach((t) => {
      if (t && (interestLower.includes(t) || topicLower.includes(t))) score += 30;
    });
    if (score === 0) return;
    reviewers.push({ userId: doc.id, email, name: data.name || 'there', score });
  });

  return reviewers.sort((a, b) => b.score - a.score).slice(0, 10);
}

async function sendReviewRequestsForChirp(chirpId: string): Promise<number> {
  const chirpDoc = await db.collection('chirps').doc(chirpId).get();
  if (!chirpDoc.exists) return 0;
  const chirp = chirpDoc.data() || {};
  if (chirp.factCheckStatus !== 'needs_review') return 0;

  const createdAt: Date = chirp.createdAt?.toDate ? chirp.createdAt.toDate() : new Date();
  const postedAgo = formatAgo(createdAt);
  const engagementSummary = `Comments: ${chirp.commentCount ?? 0}`;
  const domain = chirp.domain || chirp.topic || 'General';
  const riskLevel = priorityFromTopic(domain) === 'high' ? 'High' : 'Medium';
  const claim = Array.isArray(chirp.claims) && chirp.claims.length > 0 ? chirp.claims[0].text || '' : '';
  const claimType = Array.isArray(chirp.claims) && chirp.claims.length > 0 ? chirp.claims[0].type || 'Fact' : 'Fact';
  const reviewers = await findReviewersForChirp(chirp);

  let sent = 0;
  for (const reviewer of reviewers) {
    if (sent >= 20) break; // safety cap
    const already = await recentlySentReviewEmail(reviewer.userId, chirpId);
    if (already) continue;

    try {
      await sendReviewRequestEmailDirect({
        to: reviewer.email,
        userName: reviewer.name,
        topic: domain,
        postPreview: chirp.text || '',
        claim,
        claimType,
        domain,
        riskLevel,
        postedAgo,
        engagementSummary,
        currentReviews: chirp.reviewCount ?? 0,
        totalReviews: chirp.reviewTarget ?? 5,
        timeSinceMarked: postedAgo,
        nextReviewWindowHours: 24,
        priority: priorityFromTopic(domain),
        reviewUrl: `https://kurral.app/post/${chirpId}?review=1`,
        viewPostUrl: `https://kurral.app/post/${chirpId}`,
      });
      await logReviewEmail(reviewer.userId, chirpId);
      sent += 1;
    } catch (err) {
      console.error('Error sending review request email', chirpId, reviewer.userId, err);
    }
  }
  return sent;
}

// Callable trigger: send review emails for a specific chirp
export const triggerReviewRequestEmails = functions.https.onCall(
  { cors: true, maxInstances: 10, memory: '256MiB' },
  async (request) => {
    if (!request.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Auth required');
    }
    const chirpId = request.data?.chirpId as string | undefined;
    if (!chirpId) {
      throw new functions.https.HttpsError('invalid-argument', 'chirpId is required');
    }
    try {
      const sent = await sendReviewRequestsForChirp(chirpId);
      return { success: true, sent };
    } catch (error: any) {
      console.error('Error triggering review emails:', error);
      throw new functions.https.HttpsError('internal', error?.message || 'Failed to send review emails');
    }
  }
);

// Scheduled: every 30 minutes scan recent needs_review posts and send emails
export const sendReviewRequestsCron = functions.scheduler.onSchedule(
  {
    schedule: 'every 30 minutes',
    timeZone: 'Etc/UTC',
    maxInstances: 1,
  },
  async () => {
    if (!process.env.RESEND_API_KEY) {
      console.warn('RESEND_API_KEY not set, skipping review request cron.');
      return;
    }

    const snap = await db
      .collection('chirps')
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    let totalSent = 0;
    for (const doc of snap.docs) {
      const data = doc.data();
      if (data.factCheckStatus !== 'needs_review') continue;
      const sent = await sendReviewRequestsForChirp(doc.id);
      totalSent += sent;
      if (totalSent >= 50) break; // safety cap per run
    }

    console.log(`[ReviewEmailCron] Sent ${totalSent} emails this run.`);
  }
);

// ---------- RSS Feed Polling for Breaking News ----------

interface RSSFeed {
  url: string;
  name: string;
  enabled: boolean;
  lastChecked?: admin.firestore.Timestamp;
}

interface Article {
  title: string;
  link: string;
  pubDate: Date;
  description?: string;
  content?: string;
}

// RSS Feeds configuration
const RSS_FEEDS: RSSFeed[] = [
  { url: 'https://feeds.bbci.co.uk/news/rss.xml', name: 'BBC News', enabled: true },
  { url: 'https://feeds.reuters.com/reuters/topNews', name: 'Reuters Top News', enabled: true },
  { url: 'https://apnews.com/apf-topnews', name: 'AP News', enabled: true },
  { url: 'http://rss.cnn.com/rss/edition.rss', name: 'CNN', enabled: true },
  { url: 'https://feeds.npr.org/1001/rss.xml', name: 'NPR News', enabled: true },
];

// Breaking news keywords
const BREAKING_KEYWORDS = [
  'breaking',
  'urgent',
  'developing',
  'just in',
  'alert',
  'emergency',
  'crisis',
  'major',
  'significant',
  'unprecedented',
];

// Map topics to platform account types
const TOPIC_TO_ACCOUNT_TYPE: Record<string, string> = {
  'technology': 'tech',
  'tech': 'tech',
  'science': 'science',
  'business': 'business',
  'finance': 'business',
  'economy': 'business',
  'sports': 'sports',
  'health': 'health',
  'medical': 'health',
  'wellness': 'health',
  'entertainment': 'entertainment',
  'movies': 'entertainment',
  'tv': 'entertainment',
  'music': 'entertainment',
  'news': 'news',
  'politics': 'news',
  'general': 'news',
};

// Get platform account user ID by topic
async function getPlatformAccountByTopic(topic: string): Promise<string | null> {
  try {
    // Normalize topic to lowercase
    const normalizedTopic = topic.toLowerCase().trim();
    
    // Map topic to account type
    const accountType = TOPIC_TO_ACCOUNT_TYPE[normalizedTopic] || 'news';
    
    // Map account type to handle
    const handleMap: Record<string, string> = {
      'main': 'kural',
      'news': 'kuralnews',
      'tech': 'kuraltech',
      'science': 'kuralscience',
      'business': 'kuralbusiness',
      'sports': 'kuralsports',
      'health': 'kuralhealth',
      'entertainment': 'kuralentertainment',
    };
    
    const handle = handleMap[accountType] || 'kuralnews';
    
    const usersSnapshot = await db
      .collection('users')
      .where('isPlatformAccount', '==', true)
      .where('platformAccountType', '==', accountType)
      .where('handle', '==', handle)
      .limit(1)
      .get();

    if (usersSnapshot.empty) {
      console.warn(`[RSSPoll] Platform account not found for topic "${topic}" (type: ${accountType}, handle: ${handle}), falling back to news`);
      // Fallback to news account
      return await getPlatformAccountByTopic('news');
    }

    return usersSnapshot.docs[0].id;
  } catch (error) {
    console.error(`[RSSPoll] Error finding platform account for topic "${topic}":`, error);
    // Fallback to news account
    try {
      return await getPlatformAccountByTopic('news');
    } catch (fallbackError) {
      console.error('[RSSPoll] Fallback to news account also failed:', fallbackError);
      return null;
    }
  }
}

// Get Kural News platform account user ID (legacy function for backward compatibility)
async function getKuralNewsUserId(): Promise<string | null> {
  return getPlatformAccountByTopic('news');
}

// Check if article is breaking news
function isBreakingNews(article: Article): boolean {
  const titleLower = article.title.toLowerCase();
  const descriptionLower = (article.description || '').toLowerCase();
  const contentLower = (article.content || '').toLowerCase();

  // Check for breaking keywords in title (highest priority)
  const hasBreakingKeyword = BREAKING_KEYWORDS.some((keyword) =>
    titleLower.includes(keyword)
  );

  if (hasBreakingKeyword) {
    return true;
  }

  // Check if article is very recent (published in last 10 minutes)
  const now = new Date();
  const articleAge = now.getTime() - article.pubDate.getTime();
  const tenMinutesAgo = 10 * 60 * 1000;

  if (articleAge < tenMinutesAgo) {
    // Recent article - check description/content for breaking keywords
    return (
      BREAKING_KEYWORDS.some((keyword) => descriptionLower.includes(keyword)) ||
      BREAKING_KEYWORDS.some((keyword) => contentLower.includes(keyword))
    );
  }

  return false;
}

// Generate article ID for deduplication
// IMPROVED: Use article link as primary identifier to prevent duplicates across feeds
function generateArticleId(article: Article, feedUrl: string): string {
  // Primary: Use normalized article link (same story = same link across feeds)
  if (article.link) {
    try {
      const url = new URL(article.link);
      // Normalize URL: remove query params, fragments, trailing slashes, and www
      const normalizedLink = `${url.protocol}//${url.host.replace(/^www\./, '')}${url.pathname.replace(/\/$/, '')}`.toLowerCase();
      // Use normalized link as ID (same article from different feeds will have same ID)
      return `article_${normalizedLink}`;
    } catch {
      // Invalid URL, fallback to feed-specific ID
    }
  }
  // Fallback: feed + title + date (for articles without links)
  return `${feedUrl}_${article.title}_${article.pubDate.getTime()}`;
}

// Check if article has been processed
async function isArticleProcessed(articleId: string): Promise<boolean> {
  try {
    const doc = await db.collection('processedArticles').doc(articleId).get();
    return doc.exists;
  } catch (error) {
    console.error('[RSSPoll] Error checking processed article:', error);
    return false;
  }
}

// Mark article as processed
async function markArticleProcessed(article: Article, feedUrl: string): Promise<void> {
  try {
    const articleId = generateArticleId(article, feedUrl);
    await db.collection('processedArticles').doc(articleId).set({
      articleId,
      feedUrl,
      title: article.title,
      link: article.link,
      pubDate: admin.firestore.Timestamp.fromDate(article.pubDate),
      processedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.error('[RSSPoll] Error marking article as processed:', error);
  }
}

// Format article for posting
function formatArticleForPost(article: Article, feedName: string): string {
  const maxLength = 280;
  let postText = `📰 ${article.title}`;

  // Add description if available and space permits
  if (article.description) {
    const cleanDescription = article.description
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .trim()
      .substring(0, 150);

    if (cleanDescription && postText.length + cleanDescription.length + 10 < maxLength) {
      postText += `\n\n${cleanDescription}`;
    }
  }

  // Add source and link if space permits
  const sourceText = `\n\nSource: ${feedName}`;
  const linkText = `\n${article.link}`;

  if (postText.length + sourceText.length + linkText.length <= maxLength) {
    postText += sourceText + linkText;
  } else if (postText.length + linkText.length <= maxLength) {
    postText += linkText;
  }

  // Truncate if still too long
  if (postText.length > maxLength) {
    postText = postText.substring(0, maxLength - 3) + '...';
  }

  return postText;
}

// Create chirp with semantic topic extraction and route to appropriate platform account
async function createNewsChirp(
  fallbackUserId: string,
  text: string,
  articleLink: string
): Promise<string | null> {
  try {
    // Extract semantic topics using ReachAgent (same as user posts)
    let semanticTopics: string[] = [];
    let entities: string[] = [];
    let intent: string | undefined;
    let analyzedAt: Date | undefined;
    let resolvedTopic: string = 'news'; // Default to 'news'

    try {
      const reachAgent = getReachAgent();
      if (reachAgent) {
        // Get available topics from Firestore for better context
        let availableTopics: Array<{ name: string; postsLast48h?: number; totalUsers?: number }> = [];
        try {
          const topicsSnapshot = await db.collection('topics')
            .orderBy('postsLast48h', 'desc')
            .limit(30)
            .get();
          availableTopics = topicsSnapshot.docs.map(doc => ({
            name: doc.id,
            postsLast48h: doc.data().postsLast48h || 0,
            totalUsers: doc.data().totalUsers || 0,
          }));
        } catch (topicsError) {
          console.warn('[RSSPoll] Could not load topics for analysis:', topicsError);
        }

        // Analyze content to extract semantic topics
        const analysis = await reachAgent.analyzePostContent(text, availableTopics, []);
        semanticTopics = analysis.semanticTopics || [];
        entities = analysis.entities || [];
        intent = analysis.intent;
        resolvedTopic = analysis.suggestedBucket || 'news';
        analyzedAt = new Date();

        console.log(`[RSSPoll] Extracted semantic topics: ${semanticTopics.join(', ')}`);
        console.log(`[RSSPoll] Resolved topic: ${resolvedTopic}`);
      } else {
        console.warn('[RSSPoll] ReachAgent not available, skipping semantic analysis');
      }
    } catch (analysisError) {
      console.warn('[RSSPoll] Failed to extract semantic topics:', analysisError);
      // Continue without semantic topics - post will still be created
    }

    // Get the appropriate platform account based on resolved topic
    let userId = fallbackUserId;
    try {
      const topicBasedUserId = await getPlatformAccountByTopic(resolvedTopic);
      if (topicBasedUserId) {
        userId = topicBasedUserId;
        console.log(`[RSSPoll] Routing to platform account for topic "${resolvedTopic}" (userId: ${userId})`);
      } else {
        console.warn(`[RSSPoll] Could not find platform account for topic "${resolvedTopic}", using fallback`);
      }
    } catch (accountError) {
      console.warn(`[RSSPoll] Error getting platform account for topic "${resolvedTopic}":`, accountError);
      // Use fallback userId
    }

    const chirpData: any = {
      authorId: userId,
      text: text,
      topic: resolvedTopic,
      reachMode: 'forAll',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      commentCount: 0,
      // Skip value pipeline for automated posts - mark as clean immediately
      factCheckingStatus: 'completed',
      factCheckStatus: 'clean',
      // Store original article link for reference
      sourceUrl: articleLink,
      isAutomatedPost: true,
    };

    // Add semantic analysis fields if available
    if (semanticTopics.length > 0) {
      chirpData.semanticTopics = semanticTopics;
    }
    if (entities.length > 0) {
      chirpData.entities = entities;
    }
    if (intent) {
      chirpData.intent = intent;
    }
    if (analyzedAt) {
      chirpData.analyzedAt = admin.firestore.Timestamp.fromDate(analyzedAt);
    }

    const docRef = await db.collection('chirps').add(chirpData);

    // Update topic engagement for resolved topic
    try {
      const topicRef = db.collection('topics').doc(resolvedTopic);
      const topicSnap = await topicRef.get();

      if (topicSnap.exists) {
        await topicRef.update({
          postsLast48h: admin.firestore.FieldValue.increment(1),
          postsLast1h: admin.firestore.FieldValue.increment(1),
          postsLast4h: admin.firestore.FieldValue.increment(1),
          lastEngagementUpdate: admin.firestore.FieldValue.serverTimestamp(),
        });
      } else {
        await topicRef.set({
          name: resolvedTopic,
          postsLast48h: 1,
          postsLast1h: 1,
          postsLast4h: 1,
          totalUsers: 0,
          averageVelocity1h: 0,
          isTrending: false,
          lastEngagementUpdate: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      // Also update semantic topic engagement
      if (semanticTopics.length > 0) {
        for (const semanticTopic of semanticTopics) {
          if (semanticTopic !== resolvedTopic) {
            try {
              const semanticTopicRef = db.collection('topics').doc(semanticTopic);
              const semanticTopicSnap = await semanticTopicRef.get();
              
              if (semanticTopicSnap.exists) {
                await semanticTopicRef.update({
                  postsLast48h: admin.firestore.FieldValue.increment(1),
                  postsLast1h: admin.firestore.FieldValue.increment(1),
                  postsLast4h: admin.firestore.FieldValue.increment(1),
                  lastEngagementUpdate: admin.firestore.FieldValue.serverTimestamp(),
                });
              } else {
                await semanticTopicRef.set({
                  name: semanticTopic,
                  postsLast48h: 1,
                  postsLast1h: 1,
                  postsLast4h: 1,
                  totalUsers: 0,
                  averageVelocity1h: 0,
                  isTrending: false,
                  lastEngagementUpdate: admin.firestore.FieldValue.serverTimestamp(),
                });
              }
            } catch (semanticTopicError) {
              console.warn(`[RSSPoll] Could not update semantic topic engagement for ${semanticTopic}:`, semanticTopicError);
            }
          }
        }
      }
    } catch (topicError) {
      console.warn('[RSSPoll] Could not update topic engagement:', topicError);
    }

    return docRef.id;
  } catch (error) {
    console.error('[RSSPoll] Error creating chirp:', error);
    return null;
  }
}

// Score article for smart selection
interface ArticleScore {
  article: Article;
  score: number;
  reasons: string[];
}

function scoreArticle(article: Article): ArticleScore {
  let score = 0;
  const reasons: string[] = [];

  // Breaking news gets highest priority
  if (isBreakingNews(article)) {
    score += 100;
    reasons.push('breaking-news');
  }

  // Recency bonus (more recent = higher score)
  const ageMinutes = (Date.now() - article.pubDate.getTime()) / (1000 * 60);
  if (ageMinutes < 30) {
    score += 50;
    reasons.push('very-recent');
  } else if (ageMinutes < 120) {
    score += 20;
    reasons.push('recent');
  } else if (ageMinutes < 360) {
    score += 10;
    reasons.push('moderately-recent');
  }

  // Title quality (length, clarity)
  if (article.title) {
    const titleLength = article.title.length;
    if (titleLength > 20 && titleLength < 100) {
      score += 10;
      reasons.push('good-title-length');
    }
    // Check for important keywords
    const titleLower = article.title.toLowerCase();
    const importantKeywords = ['breaking', 'urgent', 'major', 'significant', 'announcement', 'update', 'report'];
    if (importantKeywords.some(keyword => titleLower.includes(keyword))) {
      score += 15;
      reasons.push('important-keywords');
    }
  }

  // Has description
  if (article.description && article.description.length > 50) {
    score += 10;
    reasons.push('has-description');
  }

  // Has content
  if (article.content && article.content.length > 100) {
    score += 5;
    reasons.push('has-content');
  }

  return { article, score, reasons };
}

// Poll a single RSS feed for breaking news
async function pollRSSFeed(feed: RSSFeed, fallbackUserId: string): Promise<number> {
  if (!feed.enabled) {
    return 0;
  }

  try {
    const parser = new Parser();
    const feedData = await parser.parseURL(feed.url);

    if (!feedData.items || feedData.items.length === 0) {
      console.log(`[RSSPoll] No items found in feed: ${feed.name}`);
      return 0;
    }

    let postedCount = 0;

    for (const item of feedData.items) {
      try {
        const pubDate = item.pubDate ? new Date(item.pubDate) : new Date();
        const article: Article = {
          title: item.title || 'Untitled',
          link: item.link || '',
          pubDate: pubDate,
          description: item.contentSnippet || item.content || '',
          content: item.content || item.contentSnippet || '',
        };

        // Generate article ID and check if processed
        const articleId = generateArticleId(article, feed.url);
        if (await isArticleProcessed(articleId)) {
          continue; // Skip already processed articles
        }

        // Check if breaking news
        if (!isBreakingNews(article)) {
          // Mark as processed even if not breaking (to avoid reprocessing)
          await markArticleProcessed(article, feed.url);
          continue;
        }

        // Format and post (will route to appropriate platform account based on topic)
        const postText = formatArticleForPost(article, feed.name);
        const chirpId = await createNewsChirp(fallbackUserId, postText, article.link);

        if (chirpId) {
          await markArticleProcessed(article, feed.url);
          postedCount++;
          console.log(`[RSSPoll] Posted breaking news: ${article.title.substring(0, 50)}...`);
        }
      } catch (itemError) {
        console.error(`[RSSPoll] Error processing article from ${feed.name}:`, itemError);
        continue;
      }
    }

    // Update feed last checked timestamp
    try {
      const feedRef = db.collection('rssFeeds').doc(feed.url);
      await feedRef.set(
        {
          url: feed.url,
          name: feed.name,
          enabled: feed.enabled,
          lastChecked: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    } catch (updateError) {
      console.warn(`[RSSPoll] Could not update feed timestamp for ${feed.name}:`, updateError);
    }

    return postedCount;
  } catch (error) {
    console.error(`[RSSPoll] Error polling feed ${feed.name}:`, error);
    return 0;
  }
}

// Poll RSS feed for top headlines (not just breaking news) with smart scoring
async function pollRSSFeedForTopHeadlines(
  feed: RSSFeed,
  fallbackUserId: string,
  maxArticles: number = 5
): Promise<number> {
  if (!feed.enabled) {
    return 0;
  }

  try {
    const parser = new Parser();
    const feedData = await parser.parseURL(feed.url);

    if (!feedData.items || feedData.items.length === 0) {
      console.log(`[RSSPoll] No items found in feed: ${feed.name}`);
      return 0;
    }

    // Score all articles
    const articles: Article[] = [];
    for (const item of feedData.items) {
      try {
        const pubDate = item.pubDate ? new Date(item.pubDate) : new Date();
        const article: Article = {
          title: item.title || 'Untitled',
          link: item.link || '',
          pubDate: pubDate,
          description: item.contentSnippet || item.content || '',
          content: item.content || item.contentSnippet || '',
        };
        articles.push(article);
      } catch (itemError) {
        console.error(`[RSSPoll] Error parsing article from ${feed.name}:`, itemError);
        continue;
      }
    }

    // Score and sort articles
    const scoredArticles = articles.map(article => scoreArticle(article));
    scoredArticles.sort((a, b) => b.score - a.score);

    // Take top N articles
    const topArticles = scoredArticles.slice(0, maxArticles);
    let postedCount = 0;

    for (const { article, score, reasons } of topArticles) {
      try {
        // Generate article ID and check if processed
        const articleId = generateArticleId(article, feed.url);
        if (await isArticleProcessed(articleId)) {
          continue; // Skip already processed articles
        }

        // Format and post (will route to appropriate platform account based on topic)
        const postText = formatArticleForPost(article, feed.name);
        const chirpId = await createNewsChirp(fallbackUserId, postText, article.link);

        if (chirpId) {
          await markArticleProcessed(article, feed.url);
          postedCount++;
          console.log(`[RSSPoll] Posted top headline (score: ${score}, reasons: ${reasons.join(', ')}): ${article.title.substring(0, 50)}...`);
        }
      } catch (itemError) {
        console.error(`[RSSPoll] Error processing article from ${feed.name}:`, itemError);
        continue;
      }
    }

    // Update feed last checked timestamp
    try {
      const feedRef = db.collection('rssFeeds').doc(feed.url);
      await feedRef.set(
        {
          url: feed.url,
          name: feed.name,
          enabled: feed.enabled,
          lastChecked: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    } catch (updateError) {
      console.warn(`[RSSPoll] Could not update feed timestamp for ${feed.name}:`, updateError);
    }

    return postedCount;
  } catch (error) {
    console.error(`[RSSPoll] Error polling feed ${feed.name} for top headlines:`, error);
    return 0;
  }
}

// Main RSS polling function - polls for breaking news
async function pollAllRSSFeeds(): Promise<void> {
  console.log('[RSSPoll] Starting RSS feed polling (breaking news)...');

  // Get Kural News user ID as fallback
  const kuralNewsUserId = await getKuralNewsUserId();
  if (!kuralNewsUserId) {
    console.error('[RSSPoll] Cannot proceed without Kural News account');
    return;
  }

  let totalBreaking = 0;

  // Poll each enabled feed for breaking news
  for (const feed of RSS_FEEDS) {
    if (!feed.enabled) {
      continue;
    }

    try {
      const posted = await pollRSSFeed(feed, kuralNewsUserId);
      totalBreaking += posted;
    } catch (error) {
      console.error(`[RSSPoll] Error processing feed ${feed.name}:`, error);
    }
  }

  console.log(`[RSSPoll] Completed. Posted ${totalBreaking} breaking news articles.`);
}

// Poll RSS feeds for top headlines (with smart scoring)
async function pollAllRSSFeedsForHeadlines(): Promise<void> {
  console.log('[RSSPoll] Starting RSS feed polling (top headlines)...');

  // Get Kural News user ID as fallback
  const kuralNewsUserId = await getKuralNewsUserId();
  if (!kuralNewsUserId) {
    console.error('[RSSPoll] Cannot proceed without Kural News account');
    return;
  }

  let totalHeadlines = 0;

  // Poll each enabled feed for top headlines
  for (const feed of RSS_FEEDS) {
    if (!feed.enabled) {
      continue;
    }

    try {
      // Post top 3 headlines per feed (smart scoring will select best ones)
      const posted = await pollRSSFeedForTopHeadlines(feed, kuralNewsUserId, 3);
      totalHeadlines += posted;
    } catch (error) {
      console.error(`[RSSPoll] Error processing feed ${feed.name} for headlines:`, error);
    }
  }

  console.log(`[RSSPoll] Completed. Posted ${totalHeadlines} top headline articles.`);
}

// Scheduled Cloud Function: Poll RSS feeds for breaking news every 2 minutes (faster polling)
export const pollRSSFeedsCron = functions.scheduler.onSchedule(
  {
    schedule: 'every 2 minutes',
    timeZone: 'Etc/UTC',
    maxInstances: 1,
  },
  async () => {
    await pollAllRSSFeeds();
  }
);

// Scheduled Cloud Function: Poll RSS feeds for top headlines every 15 minutes (with smart scoring)
export const pollRSSFeedsHeadlinesCron = functions.scheduler.onSchedule(
  {
    schedule: 'every 15 minutes',
    timeZone: 'Etc/UTC',
    maxInstances: 1,
  },
  async () => {
    await pollAllRSSFeedsForHeadlines();
  }
);

// Scheduled Cloud Function: Validate engagement predictions daily at 2 AM UTC
export const validatePredictionsCron = functions.scheduler.onSchedule(
  {
    schedule: '0 2 * * *', // Daily at 2 AM UTC
    timeZone: 'Etc/UTC',
    maxInstances: 1,
  },
  async () => {
    console.log('[ValidatePredictionsCron] Starting prediction validation job...');
    try {
      await validateEngagementPredictions();
      console.log('[ValidatePredictionsCron] Validation job completed successfully');
    } catch (error: any) {
      console.error('[ValidatePredictionsCron] Validation job failed:', error);
      // Don't throw - let the function complete, errors are logged
    }
  }
);

// Manual trigger function (for testing)
export const pollRSSFeedsManual = functions.https.onCall(
  { cors: true, maxInstances: 1, memory: '512MiB' },
  async (request) => {
    // Optional: Add authentication check for admin users
    if (!request.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Authentication required'
      );
    }

    try {
      const mode = request.data?.mode || 'breaking'; // 'breaking' or 'headlines' or 'both'
      
      if (mode === 'breaking' || mode === 'both') {
        await pollAllRSSFeeds();
      }
      
      if (mode === 'headlines' || mode === 'both') {
        await pollAllRSSFeedsForHeadlines();
      }
      
      return { 
        success: true, 
        message: `RSS polling completed (mode: ${mode})`,
        mode 
      };
    } catch (error: any) {
      console.error('[RSSPoll] Manual trigger error:', error);
      throw new functions.https.HttpsError(
        'internal',
        `Failed to poll RSS feeds: ${error.message}`
      );
    }
  }
);

// ---------- Value Pipeline Cloud Functions ----------

const toDateSafe = (value: any): Date => {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  if (value.toDate) return value.toDate();
  return new Date(value);
};

const normalizeChirpPayload = (payload: any): Chirp => ({
  id: payload.id,
  authorId: payload.authorId,
  text: payload.text || '',
  topic: payload.topic,
  semanticTopics: payload.semanticTopics || [],
  semanticTopicBuckets: payload.semanticTopicBuckets,
  entities: payload.entities,
  intent: payload.intent,
  analyzedAt: payload.analyzedAt ? toDateSafe(payload.analyzedAt) : undefined,
  reachMode: payload.reachMode || 'forAll',
  tunedAudience: payload.tunedAudience,
  contentEmbedding: payload.contentEmbedding,
  createdAt: toDateSafe(payload.createdAt || new Date()),
  rechirpOfId: payload.rechirpOfId,
  quotedChirpId: payload.quotedChirpId,
  quotedChirp: payload.quotedChirp ? normalizeChirpPayload(payload.quotedChirp) : undefined,
  commentCount: payload.commentCount ?? 0,
  countryCode: payload.countryCode,
  imageUrl: payload.imageUrl,
  scheduledAt: payload.scheduledAt ? toDateSafe(payload.scheduledAt) : undefined,
  formattedText: payload.formattedText,
  mentions: payload.mentions,
  factCheckingStatus: payload.factCheckingStatus,
  factCheckingStartedAt: payload.factCheckingStartedAt ? toDateSafe(payload.factCheckingStartedAt) : undefined,
  claims: payload.claims?.map((c: any) => ({ ...c, extractedAt: toDateSafe(c.extractedAt) })),
  factChecks: payload.factChecks?.map((f: any) => ({ ...f, checkedAt: toDateSafe(f.checkedAt) })),
  factCheckStatus: payload.factCheckStatus,
  valueScore: payload.valueScore
    ? { ...payload.valueScore, updatedAt: toDateSafe(payload.valueScore.updatedAt || new Date()) }
    : undefined,
  valueExplanation: payload.valueExplanation,
  discussionQuality: payload.discussionQuality,
});

const normalizeCommentPayload = (payload: any): Comment => ({
  id: payload.id,
  chirpId: payload.chirpId,
  authorId: payload.authorId,
  text: payload.text || '',
  createdAt: toDateSafe(payload.createdAt || new Date()),
  parentCommentId: payload.parentCommentId,
  replyToUserId: payload.replyToUserId,
  depth: payload.depth,
  replyCount: payload.replyCount,
  discussionRole: payload.discussionRole,
  valueContribution: payload.valueContribution,
  imageUrl: payload.imageUrl,
  scheduledAt: payload.scheduledAt ? toDateSafe(payload.scheduledAt) : undefined,
  formattedText: payload.formattedText,
  factCheckingStatus: payload.factCheckingStatus,
  factCheckingStartedAt: payload.factCheckingStartedAt ? toDateSafe(payload.factCheckingStartedAt) : undefined,
  claims: payload.claims?.map((c: any) => ({ ...c, extractedAt: toDateSafe(c.extractedAt) })),
  factChecks: payload.factChecks?.map((f: any) => ({ ...f, checkedAt: toDateSafe(f.checkedAt) })),
  factCheckStatus: payload.factCheckStatus,
});

export const processChirpValue = functions.https.onCall(
  { 
    cors: true, 
    maxInstances: 5, 
    memory: '1GiB', 
    timeoutSeconds: 300,
    secrets: ['OPENAI_API_KEY']
  },
  async (request) => {
    console.log('\n' + '='.repeat(80));
    console.log('📞 [CLOUD FUNCTION] processChirpValue called');
    console.log('='.repeat(80));
    console.log(`👤 User: ${request.auth?.uid || 'unauthenticated'}`);
    
    if (!request.auth) {
      console.log('❌ Unauthenticated request - rejecting');
      throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    }

    const { chirpId, chirp: chirpPayload, options } = request.data || {};
    console.log(`📝 Input: chirpId=${chirpId || 'none'}, hasPayload=${!!chirpPayload}`);
    
    let chirp: Chirp | null = null;

    if (chirpId) {
      console.log(`🔍 Fetching chirp from Firestore: ${chirpId}`);
      chirp = await chirpService.getChirp(chirpId);
      if (chirp) {
        console.log(`✅ Chirp found: "${chirp.text?.substring(0, 50)}..."`);
      } else {
        console.log(`⚠️  Chirp not found in Firestore`);
      }
    }

    if (!chirp && chirpPayload) {
      console.log(`📦 Using provided chirp payload`);
      chirp = normalizeChirpPayload(chirpPayload);
    }

    if (!chirp) {
      console.log('❌ No chirp available - rejecting');
      throw new functions.https.HttpsError('invalid-argument', 'chirp or chirpId is required');
    }

    try {
      console.log(`🚀 Starting pipeline processing...`);
      // Use the new simplified pipeline
      const result = await processChirp({ 
        chirp, 
        skipPreCheck: options?.skipFactCheck === false // Force processing if skipFactCheck is explicitly false
      });

      if (!result.success) {
        console.error('[processChirpValue] Pipeline failed:', result.error);
        throw new functions.https.HttpsError(
          'internal', 
          result.error?.message || 'Pipeline processing failed'
        );
      }

      // Return enriched chirp for backward compatibility
      const enrichedChirp: Chirp = {
        ...chirp,
        claims: result.claims,
        factChecks: result.factChecks,
        factCheckStatus: result.factCheckStatus,
        valueScore: result.valueScore,
        factCheckingStatus: undefined,
        factCheckingStartedAt: undefined,
      };

      console.log(`\n✅ Cloud Function completed - Returning enriched chirp`);
      console.log(`   Final Status: ${result.factCheckStatus.toUpperCase()}`);
      console.log('='.repeat(80) + '\n');

      return enrichedChirp;
    } catch (error: any) {
      console.log('\n❌ Cloud Function error');
      console.log(`   Error: ${error.message}`);
      console.log('='.repeat(80) + '\n');
      
      console.error('[processChirpValue] Failed', error);
      
      // Still throw the error so client knows processing failed
      // The Firestore trigger will handle processing as a fallback
      throw new functions.https.HttpsError('internal', error?.message || 'Failed to process chirp value');
    }
  }
);

/**
 * Firestore trigger: Automatically process new chirps
 * 
 * This ensures posts are processed even if the client-side call fails.
 * Uses v1 syntax for Firestore triggers (v2 doesn't support Firestore triggers yet)
 */
export const onChirpCreate = functionsV1.firestore
  .document('chirps/{chirpId}')
  .onCreate(async (snapshot, context) => {
    const chirpData = snapshot.data();
    const chirpId = context.params.chirpId;

    console.log('\n' + '='.repeat(80));
    console.log('🔥 [FIRESTORE TRIGGER] onChirpCreate');
    console.log('='.repeat(80));
    console.log(`📝 Chirp ID: ${chirpId}`);
    console.log(`👤 Author ID: ${chirpData.authorId}`);
    console.log(`📄 Text: "${(chirpData.text || '').substring(0, 100)}${chirpData.text && chirpData.text.length > 100 ? '...' : ''}"`);
    console.log(`📊 Current Status: ${chirpData.factCheckStatus || 'none'}`);
    console.log(`⏳ Processing Status: ${chirpData.factCheckingStatus || 'none'}`);
    console.log(`🤖 Is Automated Post: ${chirpData.isAutomatedPost || false}`);

    // Skip automated posts - they don't need value pipeline processing
    if (chirpData.isAutomatedPost) {
      console.log(`⏭️  Skipping - automated post (no value pipeline needed)`);
      console.log('='.repeat(80) + '\n');
      return;
    }

    // Skip if already processed or if it's a rechirp (for now)
    if (
      chirpData.factCheckStatus === 'clean' ||
      chirpData.factCheckStatus === 'blocked' ||
      chirpData.factCheckStatus === 'needs_review' ||
      chirpData.rechirpOfId
    ) {
      console.log(`⏭️  Skipping - already processed (status: ${chirpData.factCheckStatus}) or rechirp`);
      console.log('='.repeat(80) + '\n');
      return;
    }

    // Skip if processing already started (client-side call succeeded)
    if (chirpData.factCheckingStatus === 'completed') {
      console.log(`⏭️  Skipping - already completed by client-side call`);
      console.log('='.repeat(80) + '\n');
      return;
    }

    console.log(`🚀 Triggering pipeline processing...`);

    try {
      const chirp: Chirp = normalizeChirpPayload({
        id: chirpId,
        ...chirpData,
      });

      // Process through pipeline
      const result = await processChirp({ chirp });

      if (!result.success) {
        console.log('\n❌ Pipeline failed in trigger');
        console.log(`   Error: ${result.error?.message}`);
        console.log(`   Step: ${result.error?.step}`);
        // Mark as needs_review on failure
        await chirpService.updateChirpInsights(chirpId, {
          factCheckStatus: 'needs_review',
          factCheckingStatus: 'failed',
        });
        console.log('💾 Marked as needs_review due to failure');
        console.log('='.repeat(80) + '\n');
        return;
      }

      // Pipeline already saved the result atomically, so we're done
      console.log(`\n✅ Trigger processing complete - Final Status: ${result.factCheckStatus.toUpperCase()}`);
      console.log('='.repeat(80) + '\n');
    } catch (error: any) {
      console.log('\n❌ Trigger error processing chirp');
      console.log(`   Error: ${error.message}`);
      // Mark as needs_review on error
      await chirpService.updateChirpInsights(chirpId, {
        factCheckStatus: 'needs_review',
        factCheckingStatus: 'failed',
      }).catch((saveError) => {
        console.error(`   Failed to save error status: ${saveError.message}`);
      });
      console.log('💾 Marked as needs_review due to error');
      console.log('='.repeat(80) + '\n');
    }
  });

export const processCommentValue = functions.https.onCall(
  { 
    cors: true, 
    maxInstances: 5, 
    memory: '1GiB', 
    timeoutSeconds: 300,
    secrets: ['OPENAI_API_KEY']
  },
  async (request) => {
    if (!request.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    }

    const { comment } = request.data || {};
    if (!comment) {
      throw new functions.https.HttpsError('invalid-argument', 'comment payload is required');
    }

    try {
      const normalizedComment = normalizeCommentPayload(comment);
      
      // Get parent chirp for context
      const parentChirp = await chirpService.getChirp(normalizedComment.chirpId);
      if (!parentChirp) {
        throw new functions.https.HttpsError('not-found', 'Parent chirp not found');
      }

      // Use the new simplified pipeline
      const result = await processComment({ 
        comment: normalizedComment,
        parentChirp,
      });

      if (!result.success) {
        console.error('[processCommentValue] Pipeline failed:', result.error);
        throw new functions.https.HttpsError(
          'internal', 
          result.error?.message || 'Pipeline processing failed'
        );
      }

      // Return result for backward compatibility
      return {
        commentInsights: {},
        updatedChirp: parentChirp,
      };
    } catch (error: any) {
      console.error('[processCommentValue] Failed', error);
      throw new functions.https.HttpsError('internal', error?.message || 'Failed to process comment value');
    }
  }
);

// Note: processPendingRechirpsCron removed - rechirp handling is skipped in v2 pipeline
