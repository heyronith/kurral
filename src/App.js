import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import LandingPage from './pages/LandingPage';
import ChirpApp from './webapp/pages/ChirpApp';
import ProfilePage from './webapp/pages/ProfilePage';
import SettingsPage from './webapp/pages/SettingsPage';
import Login from './webapp/components/Login';
import Signup from './webapp/components/Signup';
import Onboarding from './webapp/components/Onboarding';
import ProtectedRoute from './webapp/components/ProtectedRoute';
import PostDetailView from './webapp/components/PostDetailView';
import BookmarksPage from './webapp/pages/BookmarksPage';
import NotificationsPage from './webapp/pages/NotificationsPage';
import DashboardPage from './webapp/pages/DashboardPage';
import { ComposerProvider } from './webapp/context/ComposerContext';
import { useThemeStore } from './webapp/store/useThemeStore';
// Component to update document title based on current route
const DocumentTitle = () => {
    const location = useLocation();
    useEffect(() => {
        const pathname = location.pathname;
        let title = 'Kurral';
        if (pathname === '/lp') {
            title = 'Kurral';
        }
        else if (pathname === '/login') {
            title = 'Login';
        }
        else if (pathname === '/signup') {
            title = 'Sign Up';
        }
        else if (pathname === '/onboarding') {
            title = 'Onboarding';
        }
        else if (pathname === '/app') {
            title = 'Feed';
        }
        else if (pathname.startsWith('/post/')) {
            title = 'Post';
        }
        else if (pathname.startsWith('/profile/')) {
            title = 'Profile';
        }
        else if (pathname === '/bookmarks') {
            title = 'Bookmarks';
        }
        else if (pathname === '/settings') {
            title = 'Settings';
        }
        else if (pathname === '/notifications') {
            title = 'Notifications';
        }
        else if (pathname === '/dashboard') {
            title = 'Dashboard';
        }
        document.title = title;
    }, [location.pathname]);
    return null;
};
// Component to update favicon based on theme
const FaviconUpdater = () => {
    const { theme } = useThemeStore();
    useEffect(() => {
        // Find existing favicon link or create one
        let link = document.querySelector("link[rel~='icon']");
        if (!link) {
            link = document.createElement('link');
            link.rel = 'icon';
            link.type = 'image/png';
            document.getElementsByTagName('head')[0].appendChild(link);
        }
        // Update favicon based on theme - use right-quotation-mark in dark mode
        link.href = theme === 'dark' ? '/right-quotation-mark.png' : '/quotation-marks.png';
    }, [theme]);
    return null;
};
const App = () => {
    return (_jsx(BrowserRouter, { children: _jsxs(ComposerProvider, { children: [_jsx(DocumentTitle, {}), _jsx(FaviconUpdater, {}), _jsxs(Routes, { children: [_jsx(Route, { path: "/lp", element: _jsx(LandingPage, {}) }), _jsx(Route, { path: "/", element: _jsx(Navigate, { to: "/app", replace: true }) }), _jsx(Route, { path: "/login", element: _jsx(Login, {}) }), _jsx(Route, { path: "/signup", element: _jsx(Signup, {}) }), _jsx(Route, { path: "/onboarding", element: _jsx(ProtectedRoute, { children: _jsx(Onboarding, {}) }) }), _jsx(Route, { path: "/app", element: _jsx(ProtectedRoute, { children: _jsx(ChirpApp, {}) }) }), _jsx(Route, { path: "/post/:postId", element: _jsx(ProtectedRoute, { children: _jsx(PostDetailView, {}) }) }), _jsx(Route, { path: "/profile/:userId", element: _jsx(ProtectedRoute, { children: _jsx(ProfilePage, {}) }) }), _jsx(Route, { path: "/bookmarks", element: _jsx(ProtectedRoute, { children: _jsx(BookmarksPage, {}) }) }), _jsx(Route, { path: "/settings", element: _jsx(ProtectedRoute, { children: _jsx(SettingsPage, {}) }) }), _jsx(Route, { path: "/notifications", element: _jsx(ProtectedRoute, { children: _jsx(NotificationsPage, {}) }) }), _jsx(Route, { path: "/dashboard", element: _jsx(ProtectedRoute, { children: _jsx(DashboardPage, {}) }) }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: "/", replace: true }) })] })] }) }));
};
export default App;
