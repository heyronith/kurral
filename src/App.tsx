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
    } else if (pathname === '/login') {
      title = 'Login';
    } else if (pathname === '/signup') {
      title = 'Sign Up';
    } else if (pathname === '/onboarding') {
      title = 'Onboarding';
    } else if (pathname === '/app') {
      title = 'Feed';
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
      </ComposerProvider>
    </BrowserRouter>
  );
};

export default App;
