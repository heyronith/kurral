import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useRef } from 'react';
import { useNotificationStore } from '../store/useNotificationStore';
import NotificationItem from './NotificationItem';
import { Link } from 'react-router-dom';
const NotificationBell = () => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);
    const { notifications, unreadCount, markAllAsRead } = useNotificationStore();
    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => {
                document.removeEventListener('mousedown', handleClickOutside);
            };
        }
    }, [isOpen]);
    const handleMarkAllAsRead = async () => {
        try {
            await markAllAsRead();
        }
        catch (error) {
            console.error('Error marking all as read:', error);
        }
    };
    return (_jsxs("div", { className: "relative", ref: dropdownRef, children: [_jsxs("button", { onClick: () => setIsOpen(!isOpen), className: "relative p-2 rounded-lg text-textMuted hover:text-accent hover:bg-backgroundElevated/60 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-accent/30 active:scale-95", "aria-label": `Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`, children: [_jsx("svg", { className: "w-5 h-5", fill: "none", strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "2", viewBox: "0 0 24 24", stroke: "currentColor", children: _jsx("path", { d: "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" }) }), unreadCount > 0 && (_jsx("span", { className: "absolute top-0 right-0 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-xs font-bold text-white bg-accent rounded-full border-2 border-background", children: unreadCount > 99 ? '99+' : unreadCount }))] }), isOpen && (_jsxs("div", { className: "absolute right-0 top-full mt-2 w-[380px] max-w-[calc(100vw-2rem)] max-h-[600px] bg-card border border-border/60 rounded-xl shadow-lg z-50 overflow-hidden backdrop-blur-lg", children: [_jsxs("div", { className: "sticky top-0 bg-card/95 backdrop-blur-sm border-b border-border/60 px-4 py-3 flex items-center justify-between", children: [_jsx("h3", { className: "text-lg font-semibold text-textPrimary", children: "Notifications" }), unreadCount > 0 && (_jsx("button", { onClick: handleMarkAllAsRead, className: "text-xs text-accent hover:text-accent/80 font-medium transition-colors", children: "Mark all as read" }))] }), _jsx("div", { className: "overflow-y-auto max-h-[500px]", children: notifications.length > 0 ? (_jsx("div", { className: "divide-y divide-border/40", children: notifications.map((notification) => (_jsx(NotificationItem, { notification: notification }, notification.id))) })) : (_jsxs("div", { className: "flex flex-col items-center justify-center py-12 px-4", children: [_jsx("svg", { className: "w-12 h-12 text-textMuted mb-4", fill: "none", strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "1.5", viewBox: "0 0 24 24", stroke: "currentColor", children: _jsx("path", { d: "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" }) }), _jsx("p", { className: "text-sm text-textMuted text-center", children: "No notifications yet" }), _jsx("p", { className: "text-xs text-textMuted text-center mt-1", children: "You'll see notifications here when people interact with your content" })] })) }), notifications.length > 0 && (_jsx("div", { className: "sticky bottom-0 bg-card/95 backdrop-blur-sm border-t border-border/60 px-4 py-3", children: _jsx(Link, { to: "/settings?tab=notifications", onClick: () => setIsOpen(false), className: "block text-center text-xs text-accent hover:text-accent/80 font-medium transition-colors", children: "Manage notification preferences" }) }))] }))] }));
};
export default NotificationBell;
