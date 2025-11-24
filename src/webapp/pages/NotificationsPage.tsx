import { useEffect } from 'react';
import { useNotificationStore } from '../store/useNotificationStore';
import { useUserStore } from '../store/useUserStore';
import NotificationItem from '../components/NotificationItem';
import AppLayout from '../components/AppLayout';

const NotificationsPage = () => {
  const { currentUser } = useUserStore();
  const { notifications, unreadCount, loadAllNotifications, markAllAsRead, isLoading } = useNotificationStore();

  useEffect(() => {
    if (currentUser?.id) {
      loadAllNotifications();
    }
  }, [currentUser?.id, loadAllNotifications]);

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead();
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  return (
    <AppLayout pageTitle="Notifications" wrapContent={true}>
      <div className="p-6">
        {/* Header with Mark all as read */}
        {unreadCount > 0 && (
          <div className="mb-4 flex justify-end">
            <button
              onClick={handleMarkAllAsRead}
              className="text-sm text-accent hover:text-accent/80 font-medium transition-colors px-3 py-1.5 rounded-lg hover:bg-backgroundElevated/60"
            >
              Mark all as read
            </button>
          </div>
        )}

        {/* Notifications List */}
        {isLoading ? (
          <div className="text-center py-12 text-textMuted">Loading notifications...</div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-12 text-textMuted">
            <p className="text-lg mb-2">No notifications</p>
            <p className="text-sm">You're all caught up!</p>
          </div>
        ) : (
          <div className="space-y-1">
            {notifications.map((notification) => (
              <NotificationItem key={notification.id} notification={notification} />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default NotificationsPage;

