import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect } from 'react';
import { useNotificationStore } from '../store/useNotificationStore';
import { useUserStore } from '../store/useUserStore';
import { useThemeStore } from '../store/useThemeStore';
import NotificationItem from '../components/NotificationItem';
import AppLayout from '../components/AppLayout';
const NotificationsPage = () => {
    const { currentUser } = useUserStore();
    const { notifications, unreadCount, loadAllNotifications, markAllAsRead, isLoading } = useNotificationStore();
    const { theme } = useThemeStore();
    useEffect(() => {
        if (currentUser?.id) {
            loadAllNotifications(currentUser.id);
        }
    }, [currentUser?.id, loadAllNotifications]);
    const handleMarkAllAsRead = async () => {
        try {
            await markAllAsRead();
        }
        catch (error) {
            console.error('Error marking all as read:', error);
        }
    };
    return (_jsx(AppLayout, { pageTitle: "Notifications", wrapContent: true, children: _jsxs("div", { className: "p-6", children: [unreadCount > 0 && (_jsx("div", { className: "mb-4 flex justify-end", children: _jsx("button", { onClick: handleMarkAllAsRead, className: `text-sm text-accent hover:text-accent/80 font-medium transition-colors px-3 py-1.5 rounded-lg ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-backgroundElevated/60'}`, children: "Mark all as read" }) })), isLoading ? (_jsx("div", { className: `text-center py-12 ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'}`, children: "Loading notifications..." })) : notifications.length === 0 ? (_jsxs("div", { className: `text-center py-12 ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'}`, children: [_jsx("p", { className: "text-lg mb-2", children: "No notifications" }), _jsx("p", { className: "text-sm", children: "You're all caught up!" })] })) : (_jsx("div", { className: "flex flex-col gap-3", children: notifications.map((notification) => (_jsx(NotificationItem, { notification: notification }, notification.id))) }))] }) }));
};
export default NotificationsPage;
