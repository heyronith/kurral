import { Link, useNavigate } from 'react-router-dom';
import type { Notification } from '../types';
import { useUserStore } from '../store/useUserStore';
import { useNotificationStore } from '../store/useNotificationStore';
import { useState } from 'react';

interface NotificationItemProps {
  notification: Notification;
}

const NotificationItem = ({ notification }: NotificationItemProps) => {
  const navigate = useNavigate();
  const { getUser } = useUserStore();
  const { markAsRead, dismissNotification } = useNotificationStore();
  const [isDismissing, setIsDismissing] = useState(false);
  
  const actor = getUser(notification.actorId);
  
  const formatTime = (date: Date): string => {
    const minutesAgo = Math.floor((Date.now() - date.getTime()) / 60000);
    if (minutesAgo < 1) return 'now';
    if (minutesAgo < 60) return `${minutesAgo}m`;
    const hoursAgo = Math.floor(minutesAgo / 60);
    if (hoursAgo < 24) return `${hoursAgo}h`;
    const daysAgo = Math.floor(hoursAgo / 24);
    if (daysAgo < 7) return `${daysAgo}d`;
    const weeksAgo = Math.floor(daysAgo / 7);
    return `${weeksAgo}w`;
  };

  const getNotificationMessage = (): string => {
    if (!actor) return 'New notification';
    
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
            ? `${actorName} and 1 other rechirped your post`
            : `${actorName} and ${othersCount} others rechirped your post`;
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
          return `${actorName} rechirped your post`;
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
    
    // Navigate to relevant content
    if (notification.chirpId) {
      navigate(`/post/${notification.chirpId}`);
    } else if (notification.commentId && notification.chirpId) {
      navigate(`/post/${notification.chirpId}#comment-${notification.commentId}`);
    } else if (notification.type === 'follow' && actor) {
      navigate(`/profile/${actor.id}`);
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

  if (!actor) return null;

  return (
    <div
      onClick={handleClick}
      className={`p-3 border-b border-border/40 cursor-pointer transition-all duration-200 hover:bg-backgroundElevated/60 ${
        !notification.read ? 'bg-accent/5' : ''
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Actor Avatar */}
        <div className="flex-shrink-0">
          {actor.profilePictureUrl ? (
            <img
              src={actor.profilePictureUrl}
              alt={actor.name}
              className="w-10 h-10 rounded-full object-cover border border-border/50"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center border border-border/50">
              <span className="text-primary font-semibold text-sm">
                {actor.name.charAt(0).toUpperCase()}
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
                <p className="text-sm text-textPrimary font-medium leading-snug">
                  {getNotificationMessage()}
                </p>
              </div>
              <p className="text-xs text-textMuted">{formatTime(notification.createdAt)}</p>
            </div>
            
            {/* Dismiss Button */}
            <button
              onClick={handleDismiss}
              disabled={isDismissing}
              className="flex-shrink-0 text-textMuted hover:text-accent transition-colors p-1 rounded hover:bg-backgroundElevated/60 disabled:opacity-50"
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

