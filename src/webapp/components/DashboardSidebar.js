import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Link } from 'react-router-dom';
import { useNotificationStore } from '../store/useNotificationStore';
import { useUserStore } from '../store/useUserStore';
import { ChartIcon, ForumIcon, HomeIcon, ImageIcon, MessageIcon, SettingsIcon, UserPlusIcon, } from './Icon';
const DashboardSidebar = ({ className = '', isCompact = false }) => {
    const { currentUser } = useUserStore();
    const { unreadCount } = useNotificationStore();
    const navItems = [
        {
            id: 'news-feed',
            label: 'News Feed',
            hint: 'Your main timeline',
            Icon: HomeIcon,
            to: '/app',
        },
        {
            id: 'messages',
            label: 'Messages',
            hint: `${unreadCount} unread`,
            Icon: MessageIcon,
            badge: unreadCount,
        },
        {
            id: 'forums',
            label: 'Forums',
            hint: 'Community threads',
            Icon: ForumIcon,
        },
        {
            id: 'friends',
            label: 'Friends',
            hint: `${currentUser?.following.length ?? 0} following`,
            Icon: UserPlusIcon,
            badge: currentUser?.following.length ?? 0,
        },
        {
            id: 'media',
            label: 'Media',
            hint: 'Assets & uploads',
            Icon: ImageIcon,
        },
        {
            id: 'insights',
            label: 'Insights',
            hint: 'Personal metrics',
            Icon: ChartIcon,
        },
        {
            id: 'settings',
            label: 'Settings',
            hint: 'App preferences',
            Icon: SettingsIcon,
            to: '/settings',
        },
    ];
    const profileName = currentUser?.name ?? 'User';
    const profileHandle = currentUser?.handle ? `@${currentUser.handle}` : '@you';
    return (_jsxs("aside", { className: `flex flex-col gap-5 rounded-[28px] border border-border/60 bg-card/70 p-5 shadow-card backdrop-blur-xl transition-all duration-200 ${className}`, children: [_jsxs("div", { className: `flex items-center gap-3 ${isCompact ? 'flex-row' : 'flex-col'}`, children: [_jsx("div", { className: "h-14 w-14 rounded-2xl border border-border bg-background/30 overflow-hidden", children: currentUser?.profilePictureUrl ? (_jsx("img", { src: currentUser.profilePictureUrl, alt: `${currentUser.name}'s avatar`, className: "h-full w-full object-cover" })) : (_jsx("div", { className: "flex h-full w-full items-center justify-center text-xs font-semibold text-textMuted", children: profileName.charAt(0) })) }), _jsxs("div", { className: "flex flex-1 flex-col space-y-1 text-left", children: [_jsx("p", { className: "text-base font-semibold text-textPrimary leading-tight", children: profileName }), _jsx("p", { className: "text-[12px] uppercase tracking-wide text-textMuted", children: profileHandle }), currentUser?.bio && !isCompact && (_jsx("p", { className: "text-xs text-textMuted line-clamp-2", children: currentUser.bio }))] })] }), _jsx("div", { className: "space-y-3", children: navItems.map(({ id, label, hint, Icon, badge, to }) => to ? (_jsxs(Link, { to: to, className: "flex items-center justify-between rounded-2xl border border-border/50 bg-background/30 px-3 py-2 text-left text-sm font-semibold text-textPrimary transition hover:border-accent/40 hover:bg-accent/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("span", { className: "text-textPrimary", children: _jsx(Icon, { size: 18 }) }), _jsxs("div", { className: "flex flex-col leading-tight", children: [_jsx("span", { children: label }), _jsx("span", { className: "text-[11px] text-textMuted font-normal", children: hint })] })] }), badge ? (_jsx("span", { className: "text-[10px] font-semibold text-accent", children: badge })) : null] }, id)) : (_jsxs("button", { type: "button", className: "flex items-center justify-between rounded-2xl border border-border/50 bg-background/30 px-3 py-2 text-left text-sm font-semibold text-textPrimary transition hover:border-accent/40 hover:bg-accent/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("span", { className: "text-textPrimary", children: _jsx(Icon, { size: 18 }) }), _jsxs("div", { className: "flex flex-col leading-tight", children: [_jsx("span", { children: label }), _jsx("span", { className: "text-[11px] text-textMuted font-normal", children: hint })] })] }), badge ? (_jsx("span", { className: "text-[10px] font-semibold text-accent", children: badge })) : null] }, id))) })] }));
};
export default DashboardSidebar;
