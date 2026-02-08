import * as admin from 'firebase-admin';
import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import { NotificationType } from '../types';

const expo = new Expo();

export interface PushPayload {
    title: string;
    body: string;
    data?: Record<string, any>;
    url?: string;
}

export const notificationService = {
    /**
     * Create a notification in Firestore and send push notification
     */
    async createNotification(data: {
        userId: string;
        type: NotificationType;
        actorId: string;
        chirpId?: string;
        commentId?: string;
        metadata?: any;
    }) {
        const db = admin.firestore();

        // 1. Create Firestore notification
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

        // 2. Send Push Notification
        await this.sendPushNotification(data.userId, data, docRef.id);

        return docRef.id;
    },

    /**
     * Send push notification to all registered tokens for a user
     */
    async sendPushNotification(userId: string, data: any, notificationId: string) {
        const db = admin.firestore();

        // Get actor info
        const actorDoc = await db.collection('users').doc(data.actorId).get();
        const actorName = actorDoc.exists ? (actorDoc.data()?.name || 'Someone') : 'Someone';

        // Build payload
        const payload = this.buildPushPayload(data, notificationId, actorName);

        // Get tokens
        const tokensSnap = await db.collection('users').doc(userId).collection('pushTokens').get();
        const tokens = tokensSnap.docs.map(d => d.data().token).filter(Boolean);

        if (tokens.length === 0) return;

        const expoMessages: ExpoPushMessage[] = [];
        const fcmTokens: string[] = [];

        for (const token of tokens) {
            if (Expo.isExpoPushToken(token)) {
                expoMessages.push({
                    to: token,
                    sound: 'default',
                    title: payload.title,
                    body: payload.body,
                    data: { ...payload.data, url: payload.url },
                    badge: 1, // Optional: handle badge counts dynamically
                });
            } else {
                // Assume FCM for other tokens
                fcmTokens.push(token);
            }
        }

        // Send via Expo
        if (expoMessages.length > 0) {
            const chunks = expo.chunkPushNotifications(expoMessages);
            for (const chunk of chunks) {
                try {
                    await expo.sendPushNotificationsAsync(chunk);
                } catch (error) {
                    console.error('[NotificationService] Error sending Expo push:', error);
                }
            }
        }

        // Send via FCM
        if (fcmTokens.length > 0) {
            try {
                await admin.messaging().sendEachForMulticast({
                    tokens: fcmTokens,
                    notification: {
                        title: payload.title,
                        body: payload.body,
                    },
                    data: payload.data,
                });
            } catch (error) {
                console.error('[NotificationService] Error sending FCM push:', error);
            }
        }
    },

    /**
     * Build push notification payload
     */
    buildPushPayload(data: any, notificationId: string, actorName: string): PushPayload {
        let title = 'New notification';
        let body = 'You have a new notification';
        let url = 'kural://notifications';

        switch (data.type) {
            case 'comment':
                title = `${actorName} commented on your post`;
                body = 'Tap to view the comment';
                url = data.chirpId ? `kural://post/${data.chirpId}` : 'kural://notifications';
                break;
            case 'reply':
                title = `${actorName} replied to your comment`;
                body = 'Tap to view the reply';
                url = data.chirpId ? `kural://post/${data.chirpId}` : 'kural://notifications';
                break;
            case 'rechirp':
                title = `${actorName} reposted your post`;
                body = 'Tap to view the repost';
                url = data.chirpId ? `kural://post/${data.chirpId}` : 'kural://notifications';
                break;
            case 'follow':
                title = `${actorName} followed you`;
                body = 'See their profile';
                url = data.actorId ? `kural://profile/${data.actorId}` : 'kural://notifications';
                break;
            case 'mention':
                title = `${actorName} mentioned you`;
                body = 'Tap to view the mention';
                url = data.chirpId ? `kural://post/${data.chirpId}` : 'kural://notifications';
                break;
            case 'review_request':
                title = 'Content Review Request';
                body = 'A post in your area of expertise needs review.';
                url = data.chirpId ? `kural://post/${data.chirpId}` : 'kural://notifications';
                break;
            default:
                break;
        }

        return {
            title,
            body,
            url,
            data: {
                notificationId,
                type: data.type,
                chirpId: data.chirpId || '',
                commentId: data.commentId || '',
                url,
            },
        };
    }
};
