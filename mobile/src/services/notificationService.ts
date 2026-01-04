// Notification service for mobile app
// Uses Cloud Function to create notifications (matches webapp behavior)
import { httpsCallable } from 'firebase/functions';
import { getFunctions } from 'firebase/functions';
import { app } from '../config/firebase';
import type { Notification } from '../types';

const functions = getFunctions(app);

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
};

