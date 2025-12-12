// Notification service layer
import { collection, query, where, orderBy, limit, getDocs, doc, getDoc, setDoc, updateDoc, Timestamp, writeBatch, onSnapshot, deleteDoc, } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
// Helper to convert Firestore Timestamp to Date
const toDate = (timestamp) => {
    if (timestamp?.toDate) {
        return timestamp.toDate();
    }
    if (timestamp instanceof Date) {
        return timestamp;
    }
    return new Date(timestamp);
};
// Convert Firestore document to app type
const notificationFromFirestore = (doc) => {
    const data = doc.data();
    return {
        id: doc.id,
        userId: data.userId,
        type: data.type,
        read: data.read || false,
        dismissed: data.dismissed || false,
        createdAt: toDate(data.createdAt),
        actorId: data.actorId,
        chirpId: data.chirpId || undefined,
        commentId: data.commentId || undefined,
        aggregatedCount: data.aggregatedCount || undefined,
        aggregatedActorIds: data.aggregatedActorIds || undefined,
        metadata: data.metadata || undefined,
    };
};
// Convert app type to Firestore document
const notificationToFirestore = (notification) => {
    const data = {
        userId: notification.userId,
        type: notification.type,
        read: notification.read,
        dismissed: notification.dismissed,
        createdAt: Timestamp.now(),
        actorId: notification.actorId,
    };
    if (notification.chirpId)
        data.chirpId = notification.chirpId;
    if (notification.commentId)
        data.commentId = notification.commentId;
    if (notification.aggregatedCount !== undefined)
        data.aggregatedCount = notification.aggregatedCount;
    if (notification.aggregatedActorIds)
        data.aggregatedActorIds = notification.aggregatedActorIds;
    if (notification.metadata)
        data.metadata = notification.metadata;
    return data;
};
// Aggregation window (15 minutes in milliseconds)
const AGGREGATION_WINDOW_MS = 15 * 60 * 1000;
// Cloud Function reference
const createNotificationFunction = httpsCallable(functions, 'createNotification');
export const notificationService = {
    /**
     * Create a new notification via Cloud Function (server-side validation and creation)
     */
    async createNotification(notificationData) {
        try {
            // Call Cloud Function which handles all validation, preferences, rate limiting, and aggregation
            const result = await createNotificationFunction(notificationData);
            // If notification was skipped (disabled, muted, quiet hours, etc.), throw a special error
            if (result.data.skipped || !result.data.success) {
                const reason = result.data.reason || 'unknown';
                const error = new Error(`Notification skipped: ${reason}`);
                error.skipped = true;
                error.reason = reason;
                throw error;
            }
            // If notification was created/aggregated, fetch it from Firestore
            if (result.data.notificationId) {
                const docSnap = await getDoc(doc(db, 'notifications', result.data.notificationId));
                if (!docSnap.exists()) {
                    throw new Error('Failed to fetch created notification');
                }
                return notificationFromFirestore(docSnap);
            }
            throw new Error('Unexpected response from notification service');
        }
        catch (error) {
            // Re-throw skipped notifications (expected behavior)
            if (error.skipped || error.code === 'functions/not-found') {
                throw error;
            }
            // Handle Firebase Functions errors
            if (error.code && error.code.startsWith('functions/')) {
                console.error('Error from notification Cloud Function:', error);
                throw error;
            }
            // Don't throw if notification is disabled or muted - this is expected
            if (error.message?.includes('disabled') || error.message?.includes('muted') || error.message?.includes('skipped')) {
                console.log(`Notification skipped: ${error.message}`);
                throw error;
            }
            console.error('Error creating notification:', error);
            throw error;
        }
    },
    /**
     * Save FCM push token for a user (one document per token)
     */
    async savePushToken(userId, token) {
        const tokenRef = doc(db, 'users', userId, 'pushTokens', token);
        await setDoc(tokenRef, {
            token,
            userId,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
            platform: 'web',
        });
    },
    /**
     * Remove FCM push token for a user
     */
    async removePushToken(userId, token) {
        const tokenRef = doc(db, 'users', userId, 'pushTokens', token);
        await deleteDoc(tokenRef);
    },
    // Note: Aggregation is now handled server-side in Cloud Functions
    // The tryAggregateNotification method has been removed as it's no longer needed
    /**
     * Get notifications for a user
     */
    async getNotifications(userId, options = {}) {
        // Extract options outside try-catch for use in catch block
        const { read = null, type, limitCount = 50 } = options;
        try {
            const constraints = [
                where('userId', '==', userId),
                orderBy('createdAt', 'desc'),
            ];
            if (read !== null) {
                constraints.push(where('read', '==', read));
            }
            if (type) {
                // If type filter is specified, need to filter by type first
                // Note: Firestore requires single field index, so we'll filter client-side if needed
                constraints.splice(constraints.length - 1, 0, where('type', '==', type));
            }
            // Always filter out dismissed
            constraints.push(where('dismissed', '==', false));
            constraints.push(limit(limitCount));
            const q = query(collection(db, 'notifications'), ...constraints);
            const snapshot = await getDocs(q);
            return snapshot.docs.map(notificationFromFirestore);
        }
        catch (error) {
            // Handle missing index gracefully
            if (error.code === 'failed-precondition') {
                console.warn('Firestore index missing for notification query, fetching all and filtering client-side');
                // Fallback: fetch all notifications and filter client-side
                const q = query(collection(db, 'notifications'), where('userId', '==', userId), where('dismissed', '==', false), orderBy('createdAt', 'desc'), limit(100));
                const snapshot = await getDocs(q);
                let notifications = snapshot.docs.map(notificationFromFirestore);
                if (read !== null) {
                    notifications = notifications.filter(n => n.read === read);
                }
                if (type) {
                    notifications = notifications.filter(n => n.type === type);
                }
                return notifications.slice(0, limitCount);
            }
            console.error('Error fetching notifications:', error);
            return [];
        }
    },
    /**
     * Get unread notification count
     */
    async getUnreadCount(userId) {
        try {
            const q = query(collection(db, 'notifications'), where('userId', '==', userId), where('read', '==', false), where('dismissed', '==', false));
            const snapshot = await getDocs(q);
            return snapshot.size;
        }
        catch (error) {
            console.error('Error getting unread count:', error);
            return 0;
        }
    },
    /**
     * Mark notification as read
     */
    async markAsRead(notificationId) {
        try {
            await updateDoc(doc(db, 'notifications', notificationId), {
                read: true,
            });
        }
        catch (error) {
            console.error('Error marking notification as read:', error);
            throw error;
        }
    },
    /**
     * Mark all notifications as read for a user
     */
    async markAllAsRead(userId) {
        try {
            const q = query(collection(db, 'notifications'), where('userId', '==', userId), where('read', '==', false), where('dismissed', '==', false));
            const snapshot = await getDocs(q);
            if (snapshot.empty)
                return;
            const batch = writeBatch(db);
            snapshot.docs.forEach((docSnap) => {
                batch.update(doc(db, 'notifications', docSnap.id), {
                    read: true,
                });
            });
            await batch.commit();
        }
        catch (error) {
            console.error('Error marking all notifications as read:', error);
            throw error;
        }
    },
    /**
     * Dismiss a notification
     */
    async dismissNotification(notificationId) {
        try {
            await updateDoc(doc(db, 'notifications', notificationId), {
                dismissed: true,
                read: true, // Also mark as read when dismissing
            });
        }
        catch (error) {
            console.error('Error dismissing notification:', error);
            throw error;
        }
    },
    /**
     * Subscribe to real-time notifications
     */
    subscribeToNotifications(userId, callback, options = {}) {
        const { read = false, limitCount = 50 } = options;
        const constraints = [
            where('userId', '==', userId),
            where('dismissed', '==', false),
            orderBy('createdAt', 'desc'),
        ];
        if (read !== null) {
            constraints.push(where('read', '==', read));
        }
        constraints.push(limit(limitCount));
        const q = query(collection(db, 'notifications'), ...constraints);
        return onSnapshot(q, (snapshot) => {
            const notifications = snapshot.docs.map(notificationFromFirestore);
            callback(notifications);
        }, (error) => {
            console.error('Error in notification subscription:', error);
            callback([]);
        });
    },
    /**
     * Get notification preferences for a user
     */
    async getNotificationPreferences(userId) {
        try {
            const docSnap = await getDoc(doc(db, 'users', userId, 'preferences', 'notifications'));
            if (!docSnap.exists()) {
                // Return default preferences
                return this.getDefaultPreferences(userId);
            }
            const data = docSnap.data();
            return {
                userId: data.userId || userId,
                commentNotifications: data.commentNotifications ?? true,
                replyNotifications: data.replyNotifications ?? true,
                rechirpNotifications: data.rechirpNotifications ?? true,
                followNotifications: data.followNotifications ?? true,
                mentionNotifications: data.mentionNotifications ?? true,
                quietHoursStart: data.quietHoursStart,
                quietHoursEnd: data.quietHoursEnd,
                mutedUserIds: data.mutedUserIds || [],
                mutedChirpIds: data.mutedChirpIds || [],
                mutedThreadIds: data.mutedThreadIds || [],
            };
        }
        catch (error) {
            console.error('Error fetching notification preferences:', error);
            return this.getDefaultPreferences(userId);
        }
    },
    /**
     * Update notification preferences
     */
    async updateNotificationPreferences(userId, preferences) {
        try {
            const prefsRef = doc(db, 'users', userId, 'preferences', 'notifications');
            const existing = await this.getNotificationPreferences(userId);
            const updated = {
                userId,
                ...existing,
                ...preferences,
            };
            // Remove undefined values
            Object.keys(updated).forEach(key => {
                if (updated[key] === undefined) {
                    delete updated[key];
                }
            });
            await updateDoc(prefsRef, updated);
        }
        catch (error) {
            // If document doesn't exist, create it
            if (error.code === 'not-found') {
                const prefsRef = doc(db, 'users', userId, 'preferences', 'notifications');
                const existing = this.getDefaultPreferences(userId);
                const updated = { ...existing, ...preferences };
                // Remove undefined values
                Object.keys(updated).forEach(key => {
                    if (updated[key] === undefined) {
                        delete updated[key];
                    }
                });
                await setDoc(prefsRef, updated);
            }
            else {
                console.error('Error updating notification preferences:', error);
                throw error;
            }
        }
    },
    /**
     * Get default notification preferences
     */
    getDefaultPreferences(userId) {
        return {
            userId,
            commentNotifications: true,
            replyNotifications: true,
            rechirpNotifications: true,
            followNotifications: true,
            mentionNotifications: true,
            mutedUserIds: [],
            mutedChirpIds: [],
            mutedThreadIds: [],
        };
    },
    /**
     * Check if notification type is enabled for user
     */
    isNotificationTypeEnabled(type, preferences) {
        if (!preferences)
            return true; // Default to enabled
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
    },
    /**
     * Check if quiet hours are active
     */
    isQuietHoursActive(preferences) {
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
    },
};
