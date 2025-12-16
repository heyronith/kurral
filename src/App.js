import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect, lazy, Suspense } from 'react';
import LandingPage from './pages/LandingPage';
import TermsOfService from './pages/TermsOfService';
import PrivacyPolicy from './pages/PrivacyPolicy';
import { ComposerProvider } from './webapp/context/ComposerContext';
import { useThemeStore } from './webapp/store/useThemeStore';
// Lazy load heavy webapp routes to reduce landing page bundle
const ChirpApp = lazy(() => import('./webapp/pages/ChirpApp'));
const ProfilePage = lazy(() => import('./webapp/pages/ProfilePage'));
const SettingsPage = lazy(() => import('./webapp/pages/SettingsPage'));
const Login = lazy(() => import('./webapp/components/Login'));
const Signup = lazy(() => import('./webapp/components/Signup'));
const ForgotPassword = lazy(() => import('./webapp/components/ForgotPassword'));
const Onboarding = lazy(() => import('./webapp/components/Onboarding'));
const ProtectedRoute = lazy(() => import('./webapp/components/ProtectedRoute'));
const PostDetailView = lazy(() => import('./webapp/components/PostDetailView'));
const BookmarksPage = lazy(() => import('./webapp/pages/BookmarksPage'));
const NotificationsPage = lazy(() => import('./webapp/pages/NotificationsPage'));
const DashboardPage = lazy(() => import('./webapp/pages/DashboardPage'));
const MostValuedPage = lazy(() => import('./webapp/pages/MostValuedPage'));
// Minimal loading fallback
const PageLoader = () => (_jsx("div", { className: "min-h-screen bg-black flex items-center justify-center", children: _jsx("div", { className: "w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" }) }));
// Component to update document title based on current route
const DocumentTitle = () => {
    const location = useLocation();
    useEffect(() => {
        const pathname = location.pathname;
        let title = 'Kural';
        if (pathname === '/' || pathname === '/info') {
            title = 'Kural';
        }
        else if (pathname === '/terms') {
            title = 'Terms of Service';
        }
        else if (pathname === '/privacy') {
            title = 'Privacy Policy';
        }
        else if (pathname === '/login') {
            title = 'Login';
        }
        else if (pathname === '/signup') {
            title = 'Sign Up';
        }
        else if (pathname === '/forgot-password') {
            title = 'Reset Password';
        }
        else if (pathname === '/onboarding') {
            title = 'Onboarding';
        }
        else if (pathname === '/app') {
            title = 'Kurals';
        }
        else if (pathname.startsWith('/app/post/')) {
            title = 'Post';
        }
        else if (pathname.startsWith('/app/profile/')) {
            title = 'Profile';
        }
        else if (pathname === '/app/bookmarks') {
            title = 'Bookmarks';
        }
        else if (pathname === '/app/settings') {
            title = 'Settings';
        }
        else if (pathname === '/app/notifications') {
            title = 'Notifications';
        }
        else if (pathname === '/app/dashboard') {
            title = 'Dashboard';
        }
        else if (pathname === '/app/most-valued') {
            title = 'Most Valued';
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
    return (_jsx(BrowserRouter, { children: _jsxs(ComposerProvider, { children: [_jsx(DocumentTitle, {}), _jsx(FaviconUpdater, {}), _jsx(Suspense, { fallback: _jsx(PageLoader, {}), children: _jsxs(Routes, { children: [_jsx(Route, { path: "/", element: _jsx(LandingPage, {}) }), _jsx(Route, { path: "/info", element: _jsx(LandingPage, {}) }), _jsx(Route, { path: "/terms", element: _jsx(TermsOfService, {}) }), _jsx(Route, { path: "/privacy", element: _jsx(PrivacyPolicy, {}) }), _jsx(Route, { path: "/login", element: _jsx(Login, {}) }), _jsx(Route, { path: "/signup", element: _jsx(Signup, {}) }), _jsx(Route, { path: "/forgot-password", element: _jsx(ForgotPassword, {}) }), _jsx(Route, { path: "/onboarding", element: _jsx(ProtectedRoute, { children: _jsx(Onboarding, {}) }) }), _jsx(Route, { path: "/app", element: _jsx(ProtectedRoute, { children: _jsx(ChirpApp, {}) }) }), _jsx(Route, { path: "/app/post/:postId", element: _jsx(ProtectedRoute, { children: _jsx(PostDetailView, {}) }) }), _jsx(Route, { path: "/app/profile/:userId", element: _jsx(ProtectedRoute, { children: _jsx(ProfilePage, {}) }) }), _jsx(Route, { path: "/app/bookmarks", element: _jsx(ProtectedRoute, { children: _jsx(BookmarksPage, {}) }) }), _jsx(Route, { path: "/app/settings", element: _jsx(ProtectedRoute, { children: _jsx(SettingsPage, {}) }) }), _jsx(Route, { path: "/app/notifications", element: _jsx(ProtectedRoute, { children: _jsx(NotificationsPage, {}) }) }), _jsx(Route, { path: "/app/dashboard", element: _jsx(ProtectedRoute, { children: _jsx(DashboardPage, {}) }) }), _jsx(Route, { path: "/app/most-valued", element: _jsx(ProtectedRoute, { children: _jsx(MostValuedPage, {}) }) }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: "/", replace: true }) })] }) })] }) }));
};
export default App;
