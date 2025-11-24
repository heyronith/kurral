import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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
import { ComposerProvider } from './webapp/context/ComposerContext';

const App = () => {
  return (
    <BrowserRouter>
      <ComposerProvider>
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </ComposerProvider>
    </BrowserRouter>
  );
};

export default App;
