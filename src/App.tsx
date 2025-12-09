import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect, lazy, Suspense } from 'react';
import LandingPage from './pages/LandingPage';
import { ComposerProvider } from './webapp/context/ComposerContext';
import { useThemeStore } from './webapp/store/useThemeStore';

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
const PageLoader = () => (
  <div className="min-h-screen bg-black flex items-center justify-center">
    <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
  </div>
);

// Component to update document title based on current route
const DocumentTitle = () => {
  const location = useLocation();

  useEffect(() => {
    const pathname = location.pathname;
    let title = 'Kural';

    if (pathname === '/lp') {
      title = 'Kural';
    } else if (pathname === '/login') {
      title = 'Login';
    } else if (pathname === '/signup') {
      title = 'Sign Up';
    } else if (pathname === '/onboarding') {
      title = 'Onboarding';
    } else if (pathname === '/app') {
      title = 'Kurals';
    } else if (pathname.startsWith('/post/')) {
      title = 'Post';
    } else if (pathname.startsWith('/profile/')) {
      title = 'Profile';
    } else if (pathname === '/bookmarks') {
      title = 'Bookmarks';
    } else if (pathname === '/settings') {
      title = 'Settings';
    } else if (pathname === '/notifications') {
      title = 'Notifications';
    } else if (pathname === '/dashboard') {
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
    let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
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

  return (
    <BrowserRouter>
      <ComposerProvider>
      <DocumentTitle />
      <FaviconUpdater />
      <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/lp" element={<LandingPage />} />
        <Route path="/" element={<Navigate to="/app" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route
          path="/onboarding"
          element={
            <ProtectedRoute>
              <Onboarding />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <ChirpApp />
            </ProtectedRoute>
          }
        />
        <Route
          path="/post/:postId"
          element={
            <ProtectedRoute>
              <PostDetailView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile/:userId"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/bookmarks"
          element={
            <ProtectedRoute>
              <BookmarksPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/notifications"
          element={
            <ProtectedRoute>
              <NotificationsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
      </ComposerProvider>
    </BrowserRouter>
  );
};

export default App;
