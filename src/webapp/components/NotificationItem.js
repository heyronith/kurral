import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '../store/useUserStore';
import { useNotificationStore } from '../store/useNotificationStore';
import { useThemeStore } from '../store/useThemeStore';
import { useState } from 'react';
const NotificationItem = ({ notification }) => {
    const navigate = useNavigate();
    const { getUser } = useUserStore();
    const { markAsRead, dismissNotification } = useNotificationStore();
    const { theme } = useThemeStore();
    const [isDismissing, setIsDismissing] = useState(false);
    const actor = getUser(notification.actorId);
    const formatTime = (date) => {
        const minutesAgo = Math.floor((Date.now() - date.getTime()) / 60000);
        if (minutesAgo < 1)
            return 'now';
        if (minutesAgo < 60)
            return `${minutesAgo}m`;
        const hoursAgo = Math.floor(minutesAgo / 60);
        if (hoursAgo < 24)
            return `${hoursAgo}h`;
        const daysAgo = Math.floor(hoursAgo / 24);
        if (daysAgo < 7)
            return `${daysAgo}d`;
        const weeksAgo = Math.floor(daysAgo / 7);
        return `${weeksAgo}w`;
    };
    const getNotificationMessage = () => {
        if (!actor)
            return 'New notification';
        const actorName = actor.name;
        const count = notification.aggregatedCount || 1;
        if (count > 1) {
            const othersCount = count - 1;
            switch (notification.type) {
                case 'comment':
                    return othersCount === 1
                        ? `${actorName} and 1 other commented on your post`
                        : `${actorName} and ${othersCount} others commented on your post`;
                case 'reply':
                    return othersCount === 1
                        ? `${actorName} and 1 other replied to your comment`
                        : `${actorName} and ${othersCount} others replied to your comment`;
                case 'rechirp':
                    return othersCount === 1
                        ? `${actorName} and 1 other reposted your post`
                        : `${actorName} and ${othersCount} others reposted your post`;
                case 'follow':
                    return `${count} new followers`;
                default:
                    return `${actorName} and ${othersCount} others`;
            }
        }
        else {
            switch (notification.type) {
                case 'comment':
                    return `${actorName} commented on your post`;
                case 'reply':
                    return `${actorName} replied to your comment`;
                case 'rechirp':
                    return `${actorName} reposted your post`;
                case 'follow':
                    return `${actorName} followed you`;
                case 'mention':
                    return `${actorName} mentioned you`;
                default:
                    return 'New notification';
            }
        }
    };
    const getNotificationIcon = () => {
        switch (notification.type) {
            case 'comment':
            case 'reply':
                return '💬';
            case 'rechirp':
                return '↻';
            case 'follow':
                return '👤';
            case 'mention':
                return '@';
            default:
                return '🔔';
        }
    };
    const handleClick = async () => {
        // Mark as read when clicked
        if (!notification.read) {
            await markAsRead(notification.id);
        }
        // Navigate to relevant content
        if (notification.chirpId) {
            navigate(`/post/${notification.chirpId}`);
        }
        else if (notification.commentId && notification.chirpId) {
            navigate(`/post/${notification.chirpId}#comment-${notification.commentId}`);
        }
        else if (notification.type === 'follow' && actor) {
            navigate(`/profile/${actor.id}`);
        }
    };
    const handleDismiss = async (e) => {
        e.stopPropagation();
        if (isDismissing)
            return;
        setIsDismissing(true);
        try {
            await dismissNotification(notification.id);
        }
        catch (error) {
            console.error('Error dismissing notification:', error);
            setIsDismissing(false);
        }
    };
    if (!actor)
        return null;
    return (_jsx("div", { onClick: handleClick, className: `p-3 border-b border-border/40 cursor-pointer transition-all duration-200 ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-backgroundElevated/60'} ${!notification.read ? 'bg-accent/5' : ''}`, children: _jsxs("div", { className: "flex items-start gap-3", children: [_jsx("div", { className: "flex-shrink-0", children: actor.profilePictureUrl ? (_jsx("img", { src: actor.profilePictureUrl, alt: actor.name, className: "w-10 h-10 rounded-full object-cover border border-border/50" })) : (_jsx("div", { className: "w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center border border-border/50", children: _jsx("span", { className: "text-primary font-semibold text-sm", children: actor.name.charAt(0).toUpperCase() }) })) }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-start justify-between gap-2", children: [_jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center gap-2 mb-1", children: [_jsx("span", { className: "text-lg", children: getNotificationIcon() }), _jsx("p", { className: "text-sm text-textPrimary font-medium leading-snug", children: getNotificationMessage() })] }), _jsx("p", { className: "text-xs text-textMuted", children: formatTime(notification.createdAt) })] }), _jsx("button", { onClick: handleDismiss, disabled: isDismissing, className: `flex-shrink-0 text-textMuted hover:text-accent transition-colors p-1 rounded ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-backgroundElevated/60'} disabled:opacity-50`, "aria-label": "Dismiss notification", children: _jsx("svg", { className: "w-4 h-4", fill: "none", strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "2", viewBox: "0 0 24 24", stroke: "currentColor", children: _jsx("path", { d: "M6 18L18 6M6 6l12 12" }) }) })] }), !notification.read && (_jsx("div", { className: "mt-2 h-1 w-1 rounded-full bg-accent" }))] })] }) }));
};
export default NotificationItem;
