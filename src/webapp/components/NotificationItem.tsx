import { useNavigate } from 'react-router-dom';
import type { Notification } from '../types';
import { useNotificationStore } from '../store/useNotificationStore';
import { useThemeStore } from '../store/useThemeStore';
import { useState } from 'react';
import { useUserStore } from '../store/useUserStore';

interface NotificationItemProps {
  notification: Notification;
}

const NotificationItem = ({ notification }: NotificationItemProps) => {
  const navigate = useNavigate();
  const actor = useUserStore((state) => state.users[notification.actorId]);
  const { markAsRead, dismissNotification } = useNotificationStore();
  const { theme } = useThemeStore();
  const [isDismissing, setIsDismissing] = useState(false);
  
  const actorName = actor?.name ?? 'Someone';
  const actorProfilePictureUrl = actor?.profilePictureUrl;
  const fallbackInitial = actorName.charAt(0).toUpperCase() || 'U';
  
  const formatTime = (date: Date): string => {
    const minutesAgo = Math.floor((Date.now() - date.getTime()) / 60000);
    let relativeLabel: string;
    if (minutesAgo < 1) relativeLabel = 'now';
    else if (minutesAgo < 60) relativeLabel = `${minutesAgo}m`;
    else {
      const hoursAgo = Math.floor(minutesAgo / 60);
      if (hoursAgo < 24) relativeLabel = `${hoursAgo}h`;
      else {
        const daysAgo = Math.floor(hoursAgo / 24);
        if (daysAgo < 7) relativeLabel = `${daysAgo}d`;
        else {
          const weeksAgo = Math.floor(daysAgo / 7);
          relativeLabel = `${weeksAgo}w`;
        }
      }
    }
    const exactTime = date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    return `${relativeLabel} · ${exactTime}`;
  };

  const getNotificationMessage = (): string => {
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
    } else {
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

  const getNotificationIcon = (): string => {
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
    
    const profileTargetId = actor?.id ?? notification.actorId;
    
    if (notification.chirpId && notification.commentId) {
      navigate(`/app/post/${notification.chirpId}#comment-${notification.commentId}`);
    } else if (notification.chirpId) {
      navigate(`/app/post/${notification.chirpId}`);
    } else if (notification.type === 'follow' && profileTargetId) {
      navigate(`/app/profile/${profileTargetId}`);
    }
  };

  const handleDismiss = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDismissing) return;
    
    setIsDismissing(true);
    try {
      await dismissNotification(notification.id);
    } catch (error) {
      console.error('Error dismissing notification:', error);
      setIsDismissing(false);
    }
  };

  // Get card styling similar to ChirpCard
  const getCardStyling = () => {
    const baseClasses = 'rounded-xl p-4 border cursor-pointer transition-all duration-200';
    
    let borderColor: string;
    let bgColor: string;
    let hoverBg: string;
    
    if (theme === 'dark') {
      borderColor = notification.read ? 'border-darkBorder' : 'border-accent/40';
      bgColor = notification.read ? 'bg-darkBgElevated/30' : 'bg-accent/5';
      hoverBg = 'hover:bg-white/10';
    } else {
      borderColor = notification.read ? 'border-border' : 'border-accent/50';
      bgColor = notification.read ? 'bg-backgroundElevated' : 'bg-accent/5';
      hoverBg = 'hover:bg-backgroundElevated/80';
    }
    
    return `${baseClasses} ${borderColor} ${bgColor} ${hoverBg}`;
  };

  return (
    <div
      onClick={handleClick}
      className={`${getCardStyling()} ${theme === 'dark' ? 'text-darkTextPrimary' : 'text-textPrimary'}`}
    >
      <div className="flex items-start gap-3">
        {/* Actor Avatar */}
        <div className="flex-shrink-0">
          {actorProfilePictureUrl ? (
            <img
              src={actorProfilePictureUrl}
              alt={actorName}
              className="w-10 h-10 rounded-full object-cover border border-border/50"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center border border-border/50">
              <span className="text-primary font-semibold text-sm">
                {fallbackInitial}
              </span>
            </div>
          )}
        </div>
        
        {/* Notification Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{getNotificationIcon()}</span>
                <p className={`text-sm font-medium leading-snug ${theme === 'dark' ? 'text-darkTextPrimary' : 'text-textPrimary'}`}>
                  {getNotificationMessage()}
                </p>
              </div>
              <p className={`text-xs ${theme === 'dark' ? 'text-darkTextMuted' : 'text-textMuted'}`}>{formatTime(notification.createdAt)}</p>
            </div>
            
            {/* Dismiss Button */}
            <button
              onClick={handleDismiss}
              disabled={isDismissing}
              className={`flex-shrink-0 ${theme === 'dark' ? 'text-darkTextMuted hover:text-accent' : 'text-textMuted hover:text-accent'} transition-colors p-1 rounded ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-backgroundElevated/60'} disabled:opacity-50`}
              aria-label="Dismiss notification"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* Unread Indicator */}
          {!notification.read && (
            <div className="mt-2 h-1 w-1 rounded-full bg-accent" />
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationItem;

