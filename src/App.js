import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect, lazy, Suspense } from 'react';
import LandingPage from './pages/LandingPage';
import { ComposerProvider } from './webapp/context/ComposerContext';
import { useThemeStore } from './webapp/store/useThemeStore';
import { botService } from './webapp/lib/services/botService';
import { newsPipelineService } from './webapp/lib/services/newsPipelineService';
import { botPostService } from './webapp/lib/services/botPostService';
// Lazy load heavy webapp routes to reduce landing page bundle
const ChirpApp = lazy(() => import('./webapp/pages/ChirpApp'));
const ProfilePage = lazy(() => import('./webapp/pages/ProfilePage'));
const SettingsPage = lazy(() => import('./webapp/pages/SettingsPage'));
const Login = lazy(() => import('./webapp/components/Login'));
const Signup = lazy(() => import('./webapp/components/Signup'));
const Onboarding = lazy(() => import('./webapp/components/Onboarding'));
const ProtectedRoute = lazy(() => import('./webapp/components/ProtectedRoute'));
const PostDetailView = lazy(() => import('./webapp/components/PostDetailView'));
const BookmarksPage = lazy(() => import('./webapp/pages/BookmarksPage'));
const NotificationsPage = lazy(() => import('./webapp/pages/NotificationsPage'));
const DashboardPage = lazy(() => import('./webapp/pages/DashboardPage'));
// Minimal loading fallback
const PageLoader = () => (_jsx("div", { className: "min-h-screen bg-black flex items-center justify-center", children: _jsx("div", { className: "w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" }) }));
// Component to update document title based on current route
const DocumentTitle = () => {
    const location = useLocation();
    useEffect(() => {
        const pathname = location.pathname;
        let title = 'Kural';
        if (pathname === '/lp') {
            title = 'Kural';
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
            title = 'Kurals';
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
    useEffect(() => {
        let isMounted = true;
        const initializeBots = async () => {
            try {
                // Step 1: Ensure bot profiles are created
                const botResult = await botService.ensureBotProfiles();
                if (!botResult.success) {
                    console.error(`[App] Failed to initialize bot profiles: ${botResult.error}`);
                    console.error('[App] Bot posting services will not start. Please check bot configuration and Firestore connection.');
                    return;
                }
                if (botResult.bots.length === 0) {
                    console.error('[App] No bot profiles were created. Bot posting services will not start.');
                    return;
                }
                console.log(`[App] Successfully ensured ${botResult.bots.length} bot profiles.`);
                if (!isMounted) {
                    return;
                }
                // Step 2: Validate setup before starting services
                const apiKey = import.meta.env.VITE_NEWS_API_KEY;
                if (!apiKey) {
                    console.warn('[App] VITE_NEWS_API_KEY is not set. Bot posts will not be created until the API key is configured.');
                    console.warn('[App] Set VITE_NEWS_API_KEY in your .env file to enable bot posting.');
                }
                // Step 3: Start bot post service
                const posterIntervalMs = Number(import.meta.env.VITE_BOT_POSTER_INTERVAL_MS || 15000);
                const postServiceResult = botPostService.start(posterIntervalMs);
                if (!postServiceResult.success) {
                    console.error(`[App] Failed to start bot post service: ${postServiceResult.reason}`);
                }
                // Step 4: Start news pipeline service
                const intervalMs = Number(import.meta.env.VITE_NEWS_PIPELINE_INTERVAL_MS || 0);
                const pipelineResult = await newsPipelineService.start(intervalMs);
                if (!pipelineResult.success) {
                    console.error(`[App] Failed to start news pipeline service: ${pipelineResult.reason}`);
                }
                else {
                    console.log('[App] Bot services initialized successfully.');
                }
            }
            catch (error) {
                console.error('[App] Critical error initializing bot services:', error);
            }
        };
        initializeBots();
        return () => {
            isMounted = false;
            botPostService.stop();
            newsPipelineService.stop();
        };
    }, []);
    return (_jsx(BrowserRouter, { children: _jsxs(ComposerProvider, { children: [_jsx(DocumentTitle, {}), _jsx(FaviconUpdater, {}), _jsx(Suspense, { fallback: _jsx(PageLoader, {}), children: _jsxs(Routes, { children: [_jsx(Route, { path: "/lp", element: _jsx(LandingPage, {}) }), _jsx(Route, { path: "/", element: _jsx(Navigate, { to: "/app", replace: true }) }), _jsx(Route, { path: "/login", element: _jsx(Login, {}) }), _jsx(Route, { path: "/signup", element: _jsx(Signup, {}) }), _jsx(Route, { path: "/onboarding", element: _jsx(ProtectedRoute, { children: _jsx(Onboarding, {}) }) }), _jsx(Route, { path: "/app", element: _jsx(ProtectedRoute, { children: _jsx(ChirpApp, {}) }) }), _jsx(Route, { path: "/post/:postId", element: _jsx(ProtectedRoute, { children: _jsx(PostDetailView, {}) }) }), _jsx(Route, { path: "/profile/:userId", element: _jsx(ProtectedRoute, { children: _jsx(ProfilePage, {}) }) }), _jsx(Route, { path: "/bookmarks", element: _jsx(ProtectedRoute, { children: _jsx(BookmarksPage, {}) }) }), _jsx(Route, { path: "/settings", element: _jsx(ProtectedRoute, { children: _jsx(SettingsPage, {}) }) }), _jsx(Route, { path: "/notifications", element: _jsx(ProtectedRoute, { children: _jsx(NotificationsPage, {}) }) }), _jsx(Route, { path: "/dashboard", element: _jsx(ProtectedRoute, { children: _jsx(DashboardPage, {}) }) }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: "/", replace: true }) })] }) })] }) }));
};
export default App;
