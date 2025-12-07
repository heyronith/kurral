import { create } from 'zustand';
import type { Notification, NotificationPreferences } from '../types';
import { notificationService } from '../lib/services/notificationService';
import { useEffect } from 'react';
import { useUserStore } from './useUserStore';

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  preferences: NotificationPreferences | null;
  unsubscribe: (() => void) | null;
  
  // Actions
  loadNotifications: () => Promise<void>;
  loadAllNotifications: (userId?: string) => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  dismissNotification: (notificationId: string) => Promise<void>;
  subscribeToNotifications: (userId: string) => void;
  unsubscribeFromNotifications: () => void;
  loadPreferences: (userId: string) => Promise<void>;
  updatePreferences: (userId: string, preferences: Partial<NotificationPreferences>) => Promise<void>;
  refreshUnreadCount: (userId: string) => Promise<void>;
}

const preloadNotificationActors = async (notifications: Notification[]) => {
  if (!notifications || notifications.length === 0) return;
  const { loadUser, users } = useUserStore.getState();
  if (!loadUser) return;

  const actorIds = Array.from(
    new Set(
      notifications
        .map((notification) => notification.actorId)
        .filter((id): id is string => Boolean(id))
    )
  );

  const missingActorIds = actorIds.filter((id) => !users[id]);
  if (missingActorIds.length === 0) return;

  await Promise.all(missingActorIds.map((actorId) => loadUser(actorId)));
};

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  preferences: null,
  unsubscribe: null,

  loadNotifications: async () => {
    const currentUser = get().preferences?.userId;
    if (!currentUser) return;
    
    set({ isLoading: true });
    try {
      const notifications = await notificationService.getNotifications(currentUser, {
        read: false,
        limitCount: 50,
      });
      set({ notifications, isLoading: false });
      preloadNotificationActors(notifications).catch((error) => {
        console.error('Error preloading notification actors:', error);
      });
    } catch (error) {
      console.error('Error loading notifications:', error);
      set({ isLoading: false });
    }
  },

  loadAllNotifications: async (userId?: string) => {
    const targetUserId = userId ?? get().preferences?.userId;
    if (!targetUserId) return;
    
    set({ isLoading: true });
    try {
      const notifications = await notificationService.getNotifications(targetUserId, {
        limitCount: 100,
      });
      set({ notifications, isLoading: false });
      preloadNotificationActors(notifications).catch((error) => {
        console.error('Error preloading notification actors:', error);
      });
      // Update unread count
      const unreadCount = notifications.filter((n) => !n.read).length;
      set({ unreadCount });
    } catch (error) {
      console.error('Error loading all notifications:', error);
      set({ isLoading: false });
    }
  },

  markAsRead: async (notificationId: string) => {
    try {
      await notificationService.markAsRead(notificationId);
      
      // Update local state
      set((state) => ({
        notifications: state.notifications.map((n) =>
          n.id === notificationId ? { ...n, read: true } : n
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
      }));
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  },

  markAllAsRead: async () => {
    const currentUser = get().preferences?.userId;
    if (!currentUser) return;
    
    try {
      await notificationService.markAllAsRead(currentUser);
      
      // Update local state
      set((state) => ({
        notifications: state.notifications.map((n) => ({ ...n, read: true })),
        unreadCount: 0,
      }));
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      throw error;
    }
  },

  dismissNotification: async (notificationId: string) => {
    try {
      await notificationService.dismissNotification(notificationId);
      
      // Remove from local state
      set((state) => ({
        notifications: state.notifications.filter((n) => n.id !== notificationId),
        unreadCount: state.notifications.find((n) => n.id === notificationId && !n.read)
          ? Math.max(0, state.unreadCount - 1)
          : state.unreadCount,
      }));
    } catch (error) {
      console.error('Error dismissing notification:', error);
      throw error;
    }
  },

  subscribeToNotifications: (userId: string) => {
    // Unsubscribe from previous subscription if exists
    const currentUnsubscribe = get().unsubscribe;
    if (currentUnsubscribe) {
      currentUnsubscribe();
    }
    
    const unsubscribe = notificationService.subscribeToNotifications(
      userId,
      (notifications) => {
        set({ notifications });
        // Update unread count
        const unreadCount = notifications.filter((n) => !n.read).length;
        set({ unreadCount });
        preloadNotificationActors(notifications).catch((error) => {
          console.error('Error preloading notification actors:', error);
        });
      },
      {
        read: false,
        limitCount: 50,
      }
    );
    
    set({ unsubscribe });
  },

  unsubscribeFromNotifications: () => {
    const unsubscribe = get().unsubscribe;
    if (unsubscribe) {
      unsubscribe();
      set({ unsubscribe: null });
    }
  },

  loadPreferences: async (userId: string) => {
    try {
      const preferences = await notificationService.getNotificationPreferences(userId);
      set({ preferences });
    } catch (error) {
      console.error('Error loading notification preferences:', error);
    }
  },

  updatePreferences: async (userId: string, updates: Partial<NotificationPreferences>) => {
    try {
      await notificationService.updateNotificationPreferences(userId, updates);
      
      // Update local state
      set((state) => ({
        preferences: state.preferences
          ? { ...state.preferences, ...updates }
          : null,
      }));
    } catch (error) {
      console.error('Error updating notification preferences:', error);
      throw error;
    }
  },

  refreshUnreadCount: async (userId: string) => {
    try {
      const count = await notificationService.getUnreadCount(userId);
      set({ unreadCount: count });
    } catch (error) {
      console.error('Error refreshing unread count:', error);
    }
  },
}));

// Hook to initialize notifications for a user
export const useNotificationSetup = (userId: string | null) => {
  const { subscribeToNotifications, unsubscribeFromNotifications, loadPreferences, refreshUnreadCount } = useNotificationStore();
  
  useEffect(() => {
    if (!userId) {
      unsubscribeFromNotifications();
      return;
    }
    
    // Load preferences
    loadPreferences(userId);
    
    // Subscribe to real-time notifications
    subscribeToNotifications(userId);
    
    // Refresh unread count
    refreshUnreadCount(userId);
    
    // Cleanup on unmount
    return () => {
      unsubscribeFromNotifications();
    };
  }, [userId, subscribeToNotifications, unsubscribeFromNotifications, loadPreferences, refreshUnreadCount]);
};

