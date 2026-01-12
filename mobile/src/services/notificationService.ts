// Notification service for mobile app
// Uses Cloud Function to create notifications (matches webapp behavior)
import { httpsCallable } from 'firebase/functions';
import { getFunctions } from 'firebase/functions';
import { app } from '../config/firebase';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  doc,
  updateDoc,
  writeBatch,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { Notification } from '../types';

const functions = getFunctions(app);

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

// Cloud Function reference
const createNotificationFunction = httpsCallable<
  Omit<Notification, 'id' | 'createdAt' | 'read' | 'dismissed'>,
  {
    success: boolean;
    skipped?: boolean;
    reason?: string;
    aggregated?: boolean;
    notificationId?: string;
    notification?: any;
  }
>(functions, 'createNotification');

export const notificationService = {
  /**
   * Create a new notification via Cloud Function (server-side validation and creation)
   */
  async createNotification(
    notificationData: Omit<Notification, 'id' | 'createdAt' | 'read' | 'dismissed'>
  ): Promise<Notification> {
    try {
      // Call Cloud Function which handles all validation, preferences, rate limiting, and aggregation
      const result = await createNotificationFunction(notificationData);
      
      // If notification was skipped (disabled, muted, quiet hours, etc.), throw a special error
      if (result.data.skipped || !result.data.success) {
        const reason = result.data.reason || 'unknown';
        const error = new Error(`Notification skipped: ${reason}`);
        (error as any).skipped = true;
        (error as any).reason = reason;
        throw error;
      }

      // For mobile, we'll return a simplified notification object
      // The actual notification is created server-side
      if (result.data.notificationId) {
        // Return a basic notification object (mobile can fetch full details if needed)
        return {
          id: result.data.notificationId,
          userId: notificationData.userId,
          type: notificationData.type,
          read: false,
          dismissed: false,
          createdAt: new Date(),
          actorId: notificationData.actorId,
          chirpId: notificationData.chirpId,
          commentId: notificationData.commentId,
          aggregatedCount: result.data.aggregated ? 1 : undefined,
          aggregatedActorIds: result.data.aggregated ? [notificationData.actorId] : undefined,
          metadata: notificationData.metadata,
        };
      }

      throw new Error('Unexpected response from notification service');
    } catch (error: any) {
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
   * Get notifications for a user
   */
  async getNotifications(
    userId: string,
    options: {
      read?: boolean | null; // null = all, true = only read, false = only unread
      type?: string;
      limitCount?: number;
    } = {}
  ): Promise<Notification[]> {
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
    ];
    
    if (read !== null) {
      constraints.push(where('read', '==', read));
    }
    
    constraints.push(orderBy('createdAt', 'desc'));
    constraints.push(limit(limitCount));
    
    const q = query(collection(db, 'notifications'), ...constraints);
    
    return onSnapshot(
      q,
      (snapshot) => {
        const notifications = snapshot.docs.map(notificationFromFirestore);
        callback(notifications);
      },
      (error) => {
        console.error('Error subscribing to notifications:', error);
        callback([]);
      }
    );
  },
};

