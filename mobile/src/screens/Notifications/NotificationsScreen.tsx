import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NotificationsStackParamList } from '../../navigation/AppNavigator';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { useAuthStore } from '../../stores/useAuthStore';
import { notificationService } from '../../services/notificationService';
import { reviewRequestService } from '../../services/reviewRequestService';
import { useUserStore } from '../../stores/useUserStore';
import type { Notification } from '../../types';
import type { ReviewRequest } from '../../services/reviewRequestService';

type NavigationProp = NativeStackNavigationProp<NotificationsStackParamList>;

interface NotificationItem extends Notification {
  isReviewRequest?: false;
}

interface ReviewRequestItem {
  id: string;
  isReviewRequest: true;
  chirpId: string;
  priority: 'high' | 'medium' | 'low';
  createdAt: Date;
  chirp: ReviewRequest['chirp'];
}

type NotificationListItem = NotificationItem | ReviewRequestItem;

const formatTimeAgo = (date: Date) => {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    return 'recently';
  }
  
  const now = Date.now();
  const diffMs = Math.max(0, now - date.getTime());
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m`;
  if (diffHours < 24) return `${diffHours}h`;
  return `${diffDays}d`;
};

const getNotificationText = (notification: NotificationItem, actorName: string): string => {
  switch (notification.type) {
    case 'comment':
      return `${actorName} commented on your post`;
    case 'reply':
      return `${actorName} replied to your comment`;
    case 'rechirp':
      return `${actorName} rechirped your post`;
    case 'follow':
      return `${actorName} followed you`;
    case 'mention':
      return `${actorName} mentioned you`;
    default:
      return 'New notification';
  }
};

const getPriorityColor = (priority: 'high' | 'medium' | 'low', colors: ReturnType<typeof useTheme>['colors']) => {
  switch (priority) {
    case 'high':
      return {
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderColor: 'rgba(239, 68, 68, 0.2)',
        textColor: '#EF4444',
        label: 'High Priority',
      };
    case 'medium':
      return {
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        borderColor: 'rgba(245, 158, 11, 0.2)',
        textColor: '#F59E0B',
        label: 'Medium Priority',
      };
    default:
      return {
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderColor: 'rgba(59, 130, 246, 0.2)',
        textColor: '#3B82F6',
        label: 'Low Priority',
      };
  }
};

const NotificationsScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const { colors } = useTheme();
  const { user: currentUser } = useAuthStore();
  const { getUser } = useUserStore();
  const dynamicStyles = getStyles(colors);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [reviewRequests, setReviewRequests] = useState<ReviewRequest[]>([]);
  const [combinedItems, setCombinedItems] = useState<NotificationListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (currentUser?.id) {
      loadNotifications();
    }
  }, [currentUser?.id]);

  const loadNotifications = async () => {
    if (!currentUser?.id) return;

    try {
      setIsLoading(true);
      const [fetchedNotifications, fetchedReviewRequests] = await Promise.all([
        notificationService.getNotifications(currentUser.id, { limitCount: 50 }),
        reviewRequestService.getPendingReviewRequests(currentUser.id),
      ]);

      setNotifications(fetchedNotifications);
      setReviewRequests(fetchedReviewRequests);

      // Combine and sort by date (newest first)
      const items: NotificationListItem[] = [
        ...fetchedNotifications.map(n => ({ ...n, isReviewRequest: false as const })),
        ...fetchedReviewRequests.map((rr, index) => ({
          id: `review-request-${rr.chirp.id}-${index}`,
          isReviewRequest: true as const,
          chirpId: rr.chirp.id,
          priority: rr.priority,
          createdAt: rr.chirp.createdAt,
          chirp: rr.chirp,
        })),
      ];

      items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      setCombinedItems(items);
    } catch (error) {
      console.error('[NotificationsScreen] Error loading notifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadNotifications();
    setIsRefreshing(false);
  };

  const handleNotificationPress = async (item: NotificationListItem) => {
    if (item.isReviewRequest) {
      // Navigate to post detail for review request
      navigation.navigate('PostDetail', { postId: item.chirpId });
    } else {
      // For regular notifications, navigate to the related chirp if available
      if (item.chirpId) {
        navigation.navigate('PostDetail', { postId: item.chirpId });
        // Mark as read
        try {
          await notificationService.markAsRead(item.id);
          // Update local state
          setNotifications(prev => prev.map(n => n.id === item.id ? { ...n, read: true } : n));
        } catch (error) {
          console.error('[NotificationsScreen] Error marking notification as read:', error);
        }
      }
    }
  };

  const renderNotificationItem = (item: NotificationListItem) => {
    if (item.isReviewRequest) {
      const priorityStyle = getPriorityColor(item.priority, colors);
      const postPreview = item.chirp.text.length > 100 
        ? item.chirp.text.substring(0, 100) + '...'
        : item.chirp.text;

      return (
        <TouchableOpacity
          key={item.id}
          onPress={() => handleNotificationPress(item)}
          style={[dynamicStyles.notificationItem, { borderLeftColor: priorityStyle.borderColor }]}
          activeOpacity={0.7}
        >
          <View style={dynamicStyles.notificationHeader}>
            <View style={[dynamicStyles.priorityBadge, { backgroundColor: priorityStyle.backgroundColor }]}>
              <Ionicons name="shield-checkmark-outline" size={16} color={priorityStyle.textColor} />
              <Text style={[dynamicStyles.priorityText, { color: priorityStyle.textColor }]}>
                {priorityStyle.label}
              </Text>
            </View>
            <Text style={dynamicStyles.timeAgo}>{formatTimeAgo(item.createdAt)}</Text>
          </View>
          <View style={dynamicStyles.notificationContent}>
            <Text style={dynamicStyles.notificationTitle}>Review Request</Text>
            <Text style={dynamicStyles.notificationText}>
              A post needs your review. Help verify the claims by providing context.
            </Text>
            <View style={dynamicStyles.postPreview}>
              <Text style={dynamicStyles.postPreviewText} numberOfLines={2}>
                "{postPreview}"
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      );
    } else {
      const actor = getUser(item.actorId);
      const actorName = actor?.name || 'Someone';
      const notificationText = getNotificationText(item, actorName);

      return (
        <TouchableOpacity
          key={item.id}
          onPress={() => handleNotificationPress(item)}
          style={[
            dynamicStyles.notificationItem,
            !item.read && dynamicStyles.unreadNotification,
          ]}
          activeOpacity={0.7}
        >
          <View style={dynamicStyles.notificationIcon}>
            <Ionicons
              name={
                item.type === 'comment' ? 'chatbubble-outline' :
                item.type === 'reply' ? 'return-down-forward-outline' :
                item.type === 'rechirp' ? 'repeat-outline' :
                item.type === 'follow' ? 'person-add-outline' :
                'notifications-outline'
              }
              size={24}
              color={item.read ? colors.textMuted : colors.accent}
            />
          </View>
          <View style={dynamicStyles.notificationContent}>
            <Text style={[
              dynamicStyles.notificationText,
              !item.read && dynamicStyles.unreadText,
            ]}>
              {notificationText}
            </Text>
            <Text style={dynamicStyles.timeAgo}>{formatTimeAgo(item.createdAt)}</Text>
          </View>
          {!item.read && <View style={dynamicStyles.unreadDot} />}
        </TouchableOpacity>
      );
    }
  };

  return (
    <SafeAreaView style={dynamicStyles.container} edges={['top']}>
      <View style={dynamicStyles.header}>
        <Text style={dynamicStyles.title}>Notifications</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('NotificationPreferences')}
          style={dynamicStyles.settingsButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="settings-outline" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={dynamicStyles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : combinedItems.length === 0 ? (
        <View style={dynamicStyles.emptyContainer}>
          <Ionicons name="notifications-outline" size={64} color={colors.textMuted} />
          <Text style={dynamicStyles.emptyText}>
            You're all caught up. When someone interacts with your chirps, we'll show it here.
          </Text>
          {reviewRequests.length === 0 && (
            <Text style={dynamicStyles.emptySubtext}>
              Posts that need review will also appear here.
            </Text>
          )}
        </View>
      ) : (
        <ScrollView
          style={dynamicStyles.scrollView}
          contentContainerStyle={dynamicStyles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={colors.accent}
            />
          }
        >
          {combinedItems.map(item => renderNotificationItem(item))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const getStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.backgroundElevated,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  settingsButton: {
    padding: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 24,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  notificationItem: {
    flexDirection: 'row',
    backgroundColor: colors.backgroundElevated,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
  },
  unreadNotification: {
    backgroundColor: colors.accent + '08',
  },
  notificationIcon: {
    marginRight: 12,
    justifyContent: 'flex-start',
    paddingTop: 2,
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  priorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: '700',
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  notificationText: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  unreadText: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  timeAgo: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 4,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
    marginLeft: 8,
    marginTop: 4,
  },
  postPreview: {
    marginTop: 8,
    padding: 12,
    backgroundColor: colors.background,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  postPreviewText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontStyle: 'italic',
    lineHeight: 20,
  },
});

export default NotificationsScreen;

