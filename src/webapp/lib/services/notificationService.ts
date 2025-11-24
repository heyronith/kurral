// Notification service layer
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  addDoc,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  Timestamp,
  writeBatch,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase';
import type {
  Notification,
  NotificationType,
  NotificationPreferences,
} from '../../types';

// Helper to convert Firestore Timestamp to Date
const toDate = (timestamp: any): Date => {
  if (timestamp?.toDate) {
    return timestamp.toDate();
  }
  if (timestamp instanceof Date) {
    return timestamp;
  }
  return new Date(timestamp);
};

// Convert Firestore document to app type
const notificationFromFirestore = (doc: any): Notification => {
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
const notificationToFirestore = (notification: Omit<Notification, 'id' | 'createdAt'>): any => {
  const data: any = {
    userId: notification.userId,
    type: notification.type,
    read: notification.read,
    dismissed: notification.dismissed,
    createdAt: Timestamp.now(),
    actorId: notification.actorId,
  };
  
  if (notification.chirpId) data.chirpId = notification.chirpId;
  if (notification.commentId) data.commentId = notification.commentId;
  if (notification.aggregatedCount !== undefined) data.aggregatedCount = notification.aggregatedCount;
  if (notification.aggregatedActorIds) data.aggregatedActorIds = notification.aggregatedActorIds;
  if (notification.metadata) data.metadata = notification.metadata;
  
  return data;
};

// Aggregation window (15 minutes in milliseconds)
const AGGREGATION_WINDOW_MS = 15 * 60 * 1000;

export const notificationService = {
  /**
   * Create a new notification with smart aggregation
   */
  async createNotification(
    notificationData: Omit<Notification, 'id' | 'createdAt' | 'read' | 'dismissed'>
  ): Promise<Notification> {
    try {
      // Check user preferences first
      const preferences = await this.getNotificationPreferences(notificationData.userId);
      
      // Check if this notification type is enabled
      const typeEnabled = this.isNotificationTypeEnabled(notificationData.type, preferences);
      if (!typeEnabled) {
        throw new Error(`Notification type ${notificationData.type} is disabled`);
      }
      
      // Check if actor or post is muted
      if (preferences) {
        if (preferences.mutedUserIds.includes(notificationData.actorId)) {
          throw new Error('User is muted');
        }
        if (notificationData.chirpId && preferences.mutedChirpIds.includes(notificationData.chirpId)) {
          throw new Error('Post is muted');
        }
      }
      
      // Try to aggregate with existing notification
      const aggregated = await this.tryAggregateNotification(notificationData);
      if (aggregated) {
        return aggregated;
      }
      
      // Create new notification
      const firestoreData = notificationToFirestore({
        ...notificationData,
        read: false,
        dismissed: false,
      });
      
      const docRef = await addDoc(collection(db, 'notifications'), firestoreData);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        throw new Error('Failed to create notification');
      }
      
      return notificationFromFirestore(docSnap);
    } catch (error: any) {
      // Don't throw if notification is disabled or muted - this is expected
      if (error.message?.includes('disabled') || error.message?.includes('muted')) {
        console.log(`Notification skipped: ${error.message}`);
        throw error; // Re-throw to signal that notification was intentionally skipped
      }
      console.error('Error creating notification:', error);
      throw error;
    }
  },

  /**
   * Try to aggregate notification with existing unread notification
   */
  async tryAggregateNotification(
    notificationData: Omit<Notification, 'id' | 'createdAt' | 'read' | 'dismissed'>
  ): Promise<Notification | null> {
    try {
      const now = Date.now();
      const windowStart = now - AGGREGATION_WINDOW_MS;
      
      // Find unread notifications of same type in aggregation window
      const q = query(
        collection(db, 'notifications'),
        where('userId', '==', notificationData.userId),
        where('type', '==', notificationData.type),
        where('read', '==', false),
        where('dismissed', '==', false),
        orderBy('createdAt', 'desc'),
        limit(10)
      );
      
      const snapshot = await getDocs(q);
      
      // Find matching notification (same chirpId or commentId, depending on type)
      for (const docSnap of snapshot.docs) {
        const existing = notificationFromFirestore(docSnap);
        const existingTime = existing.createdAt.getTime();
        
        // Check if within aggregation window
        if (existingTime < windowStart) {
          continue;
        }
        
        // Check if same target (chirpId for comments/rechirps, commentId for replies)
        let canAggregate = false;
        
        if (notificationData.type === 'comment' || notificationData.type === 'rechirp') {
          canAggregate = existing.chirpId === notificationData.chirpId;
        } else if (notificationData.type === 'reply') {
          // For replies, aggregate if same comment thread (parentCommentId)
          const existingParentId = existing.metadata?.parentCommentId;
          const newParentId = notificationData.metadata?.parentCommentId;
          canAggregate = Boolean(existingParentId && newParentId && existingParentId === newParentId);
          
          // Also aggregate if replying to same comment
          if (!canAggregate && existing.commentId && notificationData.metadata?.parentCommentId) {
            canAggregate = existing.commentId === notificationData.metadata.parentCommentId;
          }
        } else if (notificationData.type === 'follow') {
          // Don't aggregate follows - always create separate notifications
          continue;
        }
        
        if (canAggregate) {
          // Update existing notification with aggregated count
          const currentCount = existing.aggregatedCount || 1;
          const currentActorIds = existing.aggregatedActorIds || [existing.actorId];
          
          // Don't double-count same actor
          if (!currentActorIds.includes(notificationData.actorId)) {
            currentActorIds.push(notificationData.actorId);
          }
          
          const newCount = currentCount + 1;
          
          await updateDoc(doc(db, 'notifications', existing.id), {
            aggregatedCount: newCount,
            aggregatedActorIds: currentActorIds,
            createdAt: Timestamp.now(), // Update to most recent time
          });
          
          // Return updated notification
          const updatedDoc = await getDoc(doc(db, 'notifications', existing.id));
          return notificationFromFirestore(updatedDoc);
        }
      }
      
      return null; // No aggregation possible
    } catch (error) {
      console.error('Error trying to aggregate notification:', error);
      return null; // Fail gracefully, will create new notification
    }
  },

  /**
   * Get notifications for a user
   */
  async getNotifications(
    userId: string,
    options: {
      read?: boolean | null; // null = all, true = only read, false = only unread
      type?: NotificationType;
      limitCount?: number;
    } = {}
  ): Promise<Notification[]> {
    // Extract options outside try-catch for use in catch block
    const { read = null, type, limitCount = 50 } = options;
    
    try {
      
      const constraints: any[] = [
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
    } catch (error: any) {
      // Handle missing index gracefully
      if (error.code === 'failed-precondition') {
        console.warn('Firestore index missing for notification query, fetching all and filtering client-side');
        // Fallback: fetch all notifications and filter client-side
        const q = query(
          collection(db, 'notifications'),
          where('userId', '==', userId),
          where('dismissed', '==', false),
          orderBy('createdAt', 'desc'),
          limit(100)
        );
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
  async getUnreadCount(userId: string): Promise<number> {
    try {
      const q = query(
        collection(db, 'notifications'),
        where('userId', '==', userId),
        where('read', '==', false),
        where('dismissed', '==', false)
      );
      const snapshot = await getDocs(q);
      return snapshot.size;
    } catch (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }
  },

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<void> {
    try {
      await updateDoc(doc(db, 'notifications', notificationId), {
        read: true,
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  },

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<void> {
    try {
      const q = query(
        collection(db, 'notifications'),
        where('userId', '==', userId),
        where('read', '==', false),
        where('dismissed', '==', false)
      );
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) return;
      
      const batch = writeBatch(db);
      snapshot.docs.forEach((docSnap) => {
        batch.update(doc(db, 'notifications', docSnap.id), {
          read: true,
        });
      });
      
      await batch.commit();
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      throw error;
    }
  },

  /**
   * Dismiss a notification
   */
  async dismissNotification(notificationId: string): Promise<void> {
    try {
      await updateDoc(doc(db, 'notifications', notificationId), {
        dismissed: true,
        read: true, // Also mark as read when dismissing
      });
    } catch (error) {
      console.error('Error dismissing notification:', error);
      throw error;
    }
  },

  /**
   * Subscribe to real-time notifications
   */
  subscribeToNotifications(
    userId: string,
    callback: (notifications: Notification[]) => void,
    options: {
      read?: boolean | null;
      limitCount?: number;
    } = {}
  ): Unsubscribe {
    const { read = false, limitCount = 50 } = options;
    
    const constraints: any[] = [
      where('userId', '==', userId),
      where('dismissed', '==', false),
      orderBy('createdAt', 'desc'),
    ];
    
    if (read !== null) {
      constraints.push(where('read', '==', read));
    }
    
    constraints.push(limit(limitCount));
    
    const q = query(collection(db, 'notifications'), ...constraints);
    
    return onSnapshot(q, 
      (snapshot) => {
        const notifications = snapshot.docs.map(notificationFromFirestore);
        callback(notifications);
      },
      (error) => {
        console.error('Error in notification subscription:', error);
        callback([]);
      }
    );
  },

  /**
   * Get notification preferences for a user
   */
  async getNotificationPreferences(userId: string): Promise<NotificationPreferences | null> {
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
    } catch (error) {
      console.error('Error fetching notification preferences:', error);
      return this.getDefaultPreferences(userId);
    }
  },

  /**
   * Update notification preferences
   */
  async updateNotificationPreferences(
    userId: string,
    preferences: Partial<NotificationPreferences>
  ): Promise<void> {
    try {
      const prefsRef = doc(db, 'users', userId, 'preferences', 'notifications');
      const existing = await this.getNotificationPreferences(userId);
      
      const updated: any = {
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
    } catch (error: any) {
      // If document doesn't exist, create it
      if (error.code === 'not-found') {
        const prefsRef = doc(db, 'users', userId, 'preferences', 'notifications');
        const existing = this.getDefaultPreferences(userId);
        const updated: any = { ...existing, ...preferences };
        
        // Remove undefined values
        Object.keys(updated).forEach(key => {
          if (updated[key] === undefined) {
            delete updated[key];
          }
        });
        
        await setDoc(prefsRef, updated);
      } else {
        console.error('Error updating notification preferences:', error);
        throw error;
      }
    }
  },

  /**
   * Get default notification preferences
   */
  getDefaultPreferences(userId: string): NotificationPreferences {
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
  isNotificationTypeEnabled(
    type: NotificationType,
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
  },

  /**
   * Check if quiet hours are active
   */
  isQuietHoursActive(preferences: NotificationPreferences | null): boolean {
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

