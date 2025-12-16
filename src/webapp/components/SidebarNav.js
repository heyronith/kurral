import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useLocation } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { useUserStore } from '../store/useUserStore';
import { useThemeStore } from '../store/useThemeStore';
import { HomeIcon, ProfileIcon, SettingsIcon, ComposeIcon, BookmarkIcon } from './Icon';
const SidebarNav = () => {
    const { currentUser } = useUserStore();
    const { theme } = useThemeStore();
    const location = useLocation();
    const handleComposeFocus = () => {
        document.getElementById('composer-input')?.focus();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    const isActive = (path) => {
        if (path === '/app') {
            return location.pathname === '/app';
        }
        return location.pathname.startsWith(path);
    };
    return (_jsxs("aside", { className: "sticky top-24 hidden lg:flex w-20 flex-col items-center gap-4 py-4 z-30", children: [_jsx(Link, { to: "/app", className: `flex items-center justify-center w-12 h-12 rounded-xl transition-all duration-200 ${isActive('/app')
                    ? 'bg-primary/20 text-primary shadow-subtle'
                    : `text-textMuted hover:text-textPrimary ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-backgroundElevated/60'}`}`, "aria-label": "Home", children: _jsx(HomeIcon, { size: 24 }) }), _jsx(Link, { to: `/app/profile/${currentUser?.id || ''}`, className: `flex items-center justify-center w-12 h-12 rounded-xl transition-all duration-200 ${isActive('/app/profile')
                    ? 'bg-primary/20 text-primary shadow-subtle'
                    : `text-textMuted hover:text-textPrimary ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-backgroundElevated/60'}`}`, "aria-label": "Profile", children: _jsx(ProfileIcon, { size: 24 }) }), _jsx(Link, { to: "/app/bookmarks", className: `flex items-center justify-center w-12 h-12 rounded-xl transition-all duration-200 ${isActive('/app/bookmarks')
                    ? 'bg-primary/20 text-primary shadow-subtle'
                    : `text-textMuted hover:text-textPrimary ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-backgroundElevated/60'}`}`, "aria-label": "Bookmarks", children: _jsx(BookmarkIcon, { size: 24 }) }), _jsx(Link, { to: "/app/settings", className: `flex items-center justify-center w-12 h-12 rounded-xl transition-all duration-200 ${isActive('/app/settings')
                    ? 'bg-primary/20 text-primary shadow-subtle'
                    : `text-textMuted hover:text-textPrimary ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-backgroundElevated/60'}`}`, "aria-label": "Settings", children: _jsx(SettingsIcon, { size: 24 }) }), _jsx("button", { onClick: handleComposeFocus, className: "flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-primary to-accent text-white transition-all duration-200 hover:from-primaryHover hover:to-accentHover hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary/40 shadow-button hover:shadow-buttonHover", "aria-label": "Compose", children: _jsx(ComposeIcon, { size: 28 }) })] }));
};
export default SidebarNav;
